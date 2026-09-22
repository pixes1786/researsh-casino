import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { generateServerSeed, hashServerSeed, intBelow } from '../../rng';

const GRID = 25;                 // 5×5
const MIN_BET = 0.1;
const MAX_BET = 500;
const MINES_MIN = 1;
const MINES_MAX = 24;
const HOUSE_EDGE = 0.01;         // 1%

// Precomputed binomial for C(n, k)
function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) {
    r = (r * (n - i)) / (i + 1);
  }
  return r;
}

// Probability of k safe picks in a row with M mines out of 25 cells
function safeStreakProb(k: number, mines: number): number {
  if (k === 0) return 1;
  if (k > GRID - mines) return 0;
  // C(25-M, k) / C(25, k)
  return binom(GRID - mines, k) / binom(GRID, k);
}

// Multiplier after k safe picks (with house edge)
function multiplierFor(k: number, mines: number): number {
  if (k === 0) return 1;
  const p = safeStreakProb(k, mines);
  if (p <= 0) return 0;
  const m = (1 - HOUSE_EDGE) / p;
  return Math.floor(m * 10000) / 10000;
}

interface MinesState {
  minesCount: number;
  minePositions: number[];          // hidden from client
  revealed: number[];               // positions user clicked (safe ones)
  phase: 'playing' | 'busted' | 'cashed';
  bet: number;
  currentMultiplier: number;
  nextMultiplier: number;
  payout: number;                   // 0 while playing
}

@Injectable()
export class MinesService {
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

  // ───────────── START ─────────────
  async start(userId: string, bet: number, minesCount: number) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException('BAD_BET');
    }
    if (!Number.isInteger(minesCount) || minesCount < MINES_MIN || minesCount > MINES_MAX) {
      throw new BadRequestException('BAD_MINES');
    }

    // Auto-close stale games (>10 min)
    const stale = await this.prisma.gameRound.findMany({
      where: { userId, settledAt: null, game: { slug: 'mines-rc' } },
    });
    for (const s of stale) {
      if (Date.now() - s.createdAt.getTime() > 10 * 60 * 1000) {
        const st = s.result as any as MinesState;
        await this.forceSettleStale(s.id, st);
      }
    }

    const live = await this.prisma.gameRound.findFirst({
      where: {
        userId,
        settledAt: null,
        game: { slug: 'mines-rc' },
        createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });
    if (live) throw new BadRequestException('GAME_IN_PROGRESS');

    const game = await this.prisma.game.findUniqueOrThrow({ where: { slug: 'mines-rc' } });
    const seed = await this.ensureSeed(userId);

    // Deterministic mines placement via HMAC rejection sampling
    const pool = Array.from({ length: GRID }, (_, i) => i);
    const mines: number[] = [];
    for (let i = 0; i < minesCount; i++) {
      // walk cursors until we find an un-used index
      let cursor = i;
      let tries = 0;
      while (true) {
        const { value } = intBelow(seed.serverSeed, seed.clientSeed, seed.nonce, pool.length, tries + i * 100);
        const idx = value % pool.length;
        const pick = pool.splice(idx, 1)[0];
        mines.push(pick);
        break;
      }
    }

    const debit = await this.wallet.applyEntry({
      userId,
      type: 'BET_DEBIT',
      delta: -bet,
      refType: 'mines',
      reason: 'Mines bet',
    });

    const state: MinesState = {
      minesCount,
      minePositions: mines,
      revealed: [],
      phase: 'playing',
      bet,
      currentMultiplier: 1,
      nextMultiplier: multiplierFor(1, minesCount),
      payout: 0,
    };

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        userId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        result: state as any,
        totalBet: bet,
        totalWin: 0,
        wageredForRewards: bet,
        settledAt: null,
        bets: {
          create: [{
            userId, betType: 'mines', betValue: { bet, minesCount } as any,
            amount: bet, payout: 0, won: false,
          }],
        },
      },
    });

    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { nonce: seed.nonce + 1 },
    });

    return this.publicState(round.id, state, debit.balance, true);
  }

  // ───────────── REVEAL ─────────────
  async reveal(userId: string, gameId: string, position: number) {
    if (!Number.isInteger(position) || position < 0 || position >= GRID) {
      throw new BadRequestException('BAD_POSITION');
    }
    const round = await this.prisma.gameRound.findUnique({ where: { id: gameId } });
    if (!round) throw new NotFoundException('NOT_FOUND');
    if (round.userId !== userId) throw new ForbiddenException('NOT_YOURS');
    if (round.settledAt) throw new BadRequestException('ALREADY_SETTLED');

    const state = round.result as unknown as MinesState;
    if (state.phase !== 'playing') throw new BadRequestException('NOT_PLAYING');
    if (state.revealed.includes(position)) throw new BadRequestException('ALREADY_REVEALED');

    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    let balance = Number(wallet.balance);

    // ── HIT A MINE ──
    if (state.minePositions.includes(position)) {
      state.phase = 'busted';
      state.revealed.push(position);

      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          result: state as any,
          settledAt: new Date(),
        },
      });
      await this.prisma.bet.updateMany({
        where: { roundId: round.id },
        data: { payout: 0, won: false },
      });

      try {
        await this.promo.trackBet(userId, Number(round.totalBet), false, -Number(round.totalBet));
      } catch { /* ignore */ }

      return this.publicState(round.id, state, balance, false, true);
    }

    // ── SAFE PICK ──
    state.revealed.push(position);
    state.currentMultiplier = multiplierFor(state.revealed.length, state.minesCount);
    state.nextMultiplier = multiplierFor(state.revealed.length + 1, state.minesCount);

    // Auto-cash if all safe cells revealed
    const totalSafe = GRID - state.minesCount;
    if (state.revealed.length === totalSafe) {
      return this.cashout(userId, gameId);
    }

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: { result: state as any },
    });

    return this.publicState(round.id, state, balance, false);
  }

  // ───────────── CASHOUT ─────────────
  async cashout(userId: string, gameId: string) {
    const round = await this.prisma.gameRound.findUnique({ where: { id: gameId } });
    if (!round) throw new NotFoundException('NOT_FOUND');
    if (round.userId !== userId) throw new ForbiddenException('NOT_YOURS');
    if (round.settledAt) throw new BadRequestException('ALREADY_SETTLED');

    const state = round.result as unknown as MinesState;
    if (state.phase !== 'playing') throw new BadRequestException('NOT_PLAYING');
    if (state.revealed.length === 0) throw new BadRequestException('NOTHING_TO_CASH');

    const payout = Number((state.bet * state.currentMultiplier).toFixed(4));
    state.payout = payout;
    state.phase = 'cashed';

    const credit = await this.wallet.applyEntry({
      userId,
      type: 'BET_WIN',
      delta: payout,
      refType: 'gameRound',
      refId: round.id,
      reason: `Mines cashout @ ${state.currentMultiplier.toFixed(2)}x`,
    });

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        result: state as any,
        totalWin: payout,
        settledAt: new Date(),
      },
    });
    await this.prisma.bet.updateMany({
      where: { roundId: round.id },
      data: { payout, won: payout > Number(round.totalBet) },
    });

    const net = payout - Number(round.totalBet);
    try {
      await this.promo.trackBet(userId, Number(round.totalBet), net > 0, net);
    } catch { /* ignore */ }

    if (payout >= Number(round.totalBet) * 2) {
      try {
        const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        await this.prisma.liveWin.create({
          data: { username: u.username, gameSlug: 'mines-rc', amount: payout },
        });
        this.live.broadcastWin({ username: u.username, gameSlug: 'mines-rc', amount: payout });
      } catch { /* ignore */ }
    }

    return this.publicState(round.id, state, credit.balance, false, true);
  }

  // ───────────── STALE ─────────────
  private async forceSettleStale(roundId: string, state: MinesState) {
    const round = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    if (round.settledAt) return;
    // Auto-cashout if any safe picks were made, otherwise loss
    if (state.revealed.length > 0) {
      const payout = Number((state.bet * multiplierFor(state.revealed.length, state.minesCount)).toFixed(4));
      const credit = await this.wallet.applyEntry({
        userId: round.userId!,
        type: 'BET_WIN',
        delta: payout,
        refType: 'gameRound',
        refId: round.id,
        reason: 'Mines auto-cashout (stale)',
      });
      state.phase = 'cashed';
      state.payout = payout;
      state.currentMultiplier = multiplierFor(state.revealed.length, state.minesCount);
      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: { result: state as any, totalWin: payout, settledAt: new Date() },
      });
      await this.prisma.bet.updateMany({
        where: { roundId: round.id },
        data: { payout, won: payout > Number(round.totalBet) },
      });
      void credit;
    } else {
      state.phase = 'busted';
      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: { result: state as any, settledAt: new Date() },
      });
    }
  }

  // ───────────── STATE ─────────────
  async getCurrent(userId: string) {
    const round = await this.prisma.gameRound.findFirst({
      where: { userId, settledAt: null, game: { slug: 'mines-rc' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!round) return null;
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const state = round.result as unknown as MinesState;
    return this.publicState(round.id, state, Number(w.balance), false);
  }

  async history(userId: string, limit = 20) {
    const rows = await this.prisma.gameRound.findMany({
      where: { userId, game: { slug: 'mines-rc' }, settledAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
    return rows.map((r) => {
      const s = r.result as unknown as MinesState;
      return {
        id: r.id,
        bet: Number(r.totalBet),
        payout: Number(r.totalWin),
        netProfit: Number(r.totalWin) - Number(r.totalBet),
        minesCount: s.minesCount,
        picks: s.revealed.length,
        multiplier: s.currentMultiplier,
        phase: s.phase,
        createdAt: r.createdAt,
      };
    });
  }

  async paytable(minesCount: number) {
    if (minesCount < MINES_MIN || minesCount > MINES_MAX) {
      throw new BadRequestException('BAD_MINES');
    }
    const steps: { picks: number; multiplier: number }[] = [];
    for (let k = 1; k <= GRID - minesCount; k++) {
      steps.push({ picks: k, multiplier: multiplierFor(k, minesCount) });
    }
    return { minesCount, houseEdge: HOUSE_EDGE, steps };
  }

  // ───────────── SERIALIZER ─────────────
  private publicState(
    gameId: string,
    state: MinesState,
    balance: number,
    hideMines: boolean,
    revealAll = false,
  ) {
    const showMines = !hideMines || state.phase !== 'playing';
    return {
      gameId,
      phase: state.phase,
      balance,
      bet: state.bet,
      minesCount: state.minesCount,
      revealed: state.revealed,
      currentMultiplier: state.currentMultiplier,
      nextMultiplier: state.nextMultiplier,
      payout: state.payout,
      netProfit: state.phase === 'playing' ? 0 : state.payout - state.bet,
      minePositions: showMines ? state.minePositions : null,
      potentialCashout: Number((state.bet * state.currentMultiplier).toFixed(4)),
    };
  }
}
