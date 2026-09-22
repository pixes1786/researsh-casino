import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { generateServerSeed, hashServerSeed, intBelow } from '../../rng';

const MIN_BET = 0.1;
const MAX_BET = 500;
const HOUSE_EDGE = 0.035; // RTP 96.5%
const COLS = 6;
const ROWS = 5;
const MIN_CLUSTER = 8; // "Pay Anywhere" — 8+ same symbols anywhere

// Symbol weights and payouts (multiplier per winning cluster of 8+)
const SYMBOLS = [
  { sym: '💎', weight: 2, payout: 10 },   // diamond
  { sym: '🏺', weight: 3, payout: 5 },     // amphora
  { sym: '👑', weight: 3, payout: 4 },     // crown
  { sym: '⚡', weight: 4, payout: 2.5 },   // lightning
  { sym: '🔱', weight: 5, payout: 1.5 },   // trident
  { sym: '🌟', weight: 6, payout: 1 },     // star
  { sym: '🍇', weight: 7, payout: 0.7 },   // grapes
  { sym: '🔥', weight: 7, payout: 0.5 },   // fire
];
const REEL_SIZE = SYMBOLS.reduce((a, b) => a + b.weight, 0);

// Multiplier values that can randomly drop (values of Zeus)
const MULTIPLIER_VALUES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500];

interface GatesState {
  phase: 'playing' | 'settled';
  bet: number;
  cascadeNumber: number;        // increases on each tumble
  grid: string[];              // COLS*ROWS = 30 symbols
  multipliers: { position: number; value: number }[]; // Zeus multipliers on grid
  accumulatedMultiplier: number; // total multiplier applied at end of tumble
  totalWin: number;
  cascadeHistory: { grid: string[]; wins: any[]; multiplier: number }[];
}

@Injectable()
export class GatesService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
    private live: LiveGateway,
    private promo: PromoService,
  ) {}

  private async ensureSeed(userId: string) {
    let seed = await this.prisma.fairnessSeed.findFirst({
      where: { userId, revealedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!seed) {
      const serverSeed = generateServerSeed();
      seed = await this.prisma.fairnessSeed.create({
        data: {
          userId,
          serverSeed,
          serverSeedHash: hashServerSeed(serverSeed),
          clientSeed: 'default-client-seed',
        },
      });
    }
    return seed;
  }

  /** Fill a full grid (COLS * ROWS) from weighted reel. */
  private fillGrid(serverSeed: string, clientSeed: string, nonce: number, startCursor: number): { grid: string[]; cursor: number } {
    const grid: string[] = [];
    let cursor = startCursor;
    for (let i = 0; i < COLS * ROWS; i++) {
      const { value } = intBelow(serverSeed, clientSeed, nonce, REEL_SIZE, cursor);
      cursor++;
      // weighted pick
      let acc = 0;
      for (const s of SYMBOLS) {
        acc += s.weight;
        if (value < acc) { grid.push(s.sym); break; }
      }
    }
    return { grid, cursor };
  }

  /** Find all winning clusters (8+ same symbols anywhere on grid). */
  private findWins(grid: string[]): { sym: string; positions: number[]; payout: number }[] {
    const bySym: Record<string, number[]> = {};
    grid.forEach((sym, i) => {
      if (!bySym[sym]) bySym[sym] = [];
      bySym[sym].push(i);
    });

    const wins: { sym: string; positions: number[]; payout: number }[] = [];
    for (const [sym, positions] of Object.entries(bySym)) {
      if (positions.length < MIN_CLUSTER) continue;
      const symDef = SYMBOLS.find((s) => s.sym === sym);
      if (!symDef) continue;
      // Payout scales with cluster size beyond minimum
      const multiplier = symDef.payout * (1 + (positions.length - MIN_CLUSTER) * 0.1);
      wins.push({ sym, positions, payout: multiplier });
    }
    return wins;
  }

  /** Generate Zeus multipliers for current cascade. */
  private rollMultipliers(serverSeed: string, clientSeed: string, nonce: number, cursor: number): { multipliers: { position: number; value: number }[]; cursor: number } {
    // 0-3 multipliers can appear, weighted toward 0-1
    const countRoll = intBelow(serverSeed, clientSeed, nonce, 100, cursor);
    cursor++;
    let count = 0;
    if (countRoll.value < 60) count = 0;
    else if (countRoll.value < 85) count = 1;
    else if (countRoll.value < 95) count = 2;
    else count = 3;

    const multipliers: { position: number; value: number }[] = [];
    const usedPositions = new Set<number>();
    for (let i = 0; i < count; i++) {
      const posRoll = intBelow(serverSeed, clientSeed, nonce, COLS * ROWS, cursor);
      cursor++;
      const valRoll = intBelow(serverSeed, clientSeed, nonce, MULTIPLIER_VALUES.length, cursor);
      cursor++;
      let position = posRoll.value;
      // avoid duplicates
      while (usedPositions.has(position)) position = (position + 1) % (COLS * ROWS);
      usedPositions.add(position);
      multipliers.push({ position, value: MULTIPLIER_VALUES[valRoll.value] });
    }
    return { multipliers, cursor };
  }

  async spin(userId: string, bet: number) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException('BAD_BET');
    }
    const game = await this.prisma.game.findUniqueOrThrow({ where: { slug: 'gates-of-olympus' } });
    const seed = await this.ensureSeed(userId);

    const debit = await this.wallet.applyEntry({
      userId, type: 'BET_DEBIT', delta: -bet, refType: 'gates', reason: 'Gates of Olympus spin',
    });

    // Initial fill
    const { grid: initialGrid, cursor: c1 } = this.fillGrid(seed.serverSeed, seed.clientSeed, seed.nonce, 0);
    let grid = [...initialGrid];
    let cursor = c1;

    let totalWin = 0;
    let cascadeNumber = 0;
    const cascadeHistory: any[] = [];
    let accumulatedMultiplier = 0;

    // Cascade loop — max 20 cascades to prevent infinite
    while (cascadeNumber < 20) {
      const wins = this.findWins(grid);
      if (wins.length === 0) break;

      // Roll multipliers for this cascade
      const { multipliers, cursor: cAfterMult } = this.rollMultipliers(seed.serverSeed, seed.clientSeed, seed.nonce, cursor);
      cursor = cAfterMult;

      // If there are multipliers AND a win, they accumulate
      let cascadeMultiplier = 0;
      if (wins.length > 0 && multipliers.length > 0) {
        cascadeMultiplier = multipliers.reduce((sum, m) => sum + m.value, 0);
        accumulatedMultiplier += cascadeMultiplier;
      }

      // Sum base win from this cascade
      const cascadeBasePayout = wins.reduce((sum, w) => sum + w.payout, 0);
      // Apply multiplier ONLY if this cascade has multipliers
      const cascadePayout = cascadeBasePayout * (cascadeMultiplier > 0 ? cascadeMultiplier : 1) * bet;
      totalWin += cascadePayout;

      cascadeHistory.push({
        grid: [...grid],
        wins,
        multiplier: cascadeMultiplier,
        payout: cascadePayout,
      });

      // Remove winning positions
      const toRemove = new Set<number>();
      wins.forEach((w) => w.positions.forEach((p) => toRemove.add(p)));

      // Refill from top with new symbols
      const { grid: refill, cursor: cAfterRefill } = this.fillGrid(seed.serverSeed, seed.clientSeed, seed.nonce, cursor);
      cursor = cAfterRefill;

      let refillIdx = 0;
      const newGrid = [...grid];
      for (let i = 0; i < newGrid.length; i++) {
        if (toRemove.has(i)) {
          newGrid[i] = refill[refillIdx];
          refillIdx++;
        }
      }
      grid = newGrid;
      cascadeNumber++;
    }

    totalWin = Number(totalWin.toFixed(4));
    const netProfit = totalWin - bet;
    const won = totalWin > 0;

    const state: GatesState = {
      phase: 'settled',
      bet,
      cascadeNumber,
      grid,
      multipliers: [],
      accumulatedMultiplier,
      totalWin,
      cascadeHistory,
    };

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id, userId,
        serverSeed: seed.serverSeed, serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed, nonce: seed.nonce,
        result: state as any,
        totalBet: bet, totalWin, wageredForRewards: bet,
        settledAt: new Date(),
        bets: {
          create: [{
            userId, betType: 'gates_spin', betValue: { bet } as any,
            amount: bet, payout: totalWin, won: totalWin > 0,
          }],
        },
      },
    });

    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { nonce: seed.nonce + 1 },
    });

    try {
      await this.promo.trackBet(userId, bet, won, netProfit);
    } catch { /* ignore */ }

    let finalBalance = debit.balance;
    if (totalWin > 0) {
      const credit = await this.wallet.applyEntry({
        userId, type: 'BET_WIN', delta: totalWin,
        refType: 'gameRound', refId: round.id,
        reason: `Gates of Olympus win (${cascadeNumber} cascades)`,
      });
      finalBalance = credit.balance;
      if (totalWin >= bet * 10) {
        const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        await this.prisma.liveWin.create({
          data: { username: u.username, gameSlug: 'gates-of-olympus', amount: totalWin },
        });
        this.live.broadcastWin({ username: u.username, gameSlug: 'gates-of-olympus', amount: totalWin });
      }
    }

    return {
      roundId: round.id,
      grid,
      cascadeHistory,
      accumulatedMultiplier,
      totalBet: bet,
      totalWin,
      netProfit,
      balance: finalBalance,
      verified: {
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
      },
    };
  }

  async history(userId: string, limit = 20) {
    const rows = await this.prisma.gameRound.findMany({
      where: { userId, game: { slug: 'gates-of-olympus' }, settledAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
    return rows.map((r) => {
      const s = r.result as any as GatesState;
      return {
        id: r.id,
        bet: Number(r.totalBet),
        payout: Number(r.totalWin),
        netProfit: Number(r.totalWin) - Number(r.totalBet),
        cascades: s.cascadeNumber,
        multiplier: s.accumulatedMultiplier,
        createdAt: r.createdAt,
      };
    });
  }
}
