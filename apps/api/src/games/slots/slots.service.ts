import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { generateServerSeed, hashServerSeed, intBelow } from '../../rng';

const MIN_BET = 0.1;
const MAX_BET = 500;

// 5 symbols, weighted reel: common → rare
const SYMBOL_WEIGHTS: { sym: string; weight: number }[] = [
  { sym: '🍒', weight: 8 },
  { sym: '🍋', weight: 6 },
  { sym: '🍊', weight: 4 },
  { sym: '🔔', weight: 2 },
  { sym: '💎', weight: 1 },
];
const REEL_SIZE = SYMBOL_WEIGHTS.reduce((a, b) => a + b.weight, 0); // 21
const REEL: string[] = SYMBOL_WEIGHTS.flatMap((s) => Array(s.weight).fill(s.sym));

// Payouts are multipliers of the TOTAL bet (per winning line)
const PAYOUTS: Record<string, number> = {
  '🍒': 0.5,
  '🍋': 1.5,
  '🍊': 4,
  '🔔': 20,
  '💎': 120,
};

// 3×3 grid, index = row*3 + col
// 8 lines: 3 rows + 3 cols + 2 diagonals
const LINES: { name: string; positions: [number, number, number] }[] = [
  { name: 'Top row',       positions: [0, 1, 2] },
  { name: 'Middle row',    positions: [3, 4, 5] },
  { name: 'Bottom row',    positions: [6, 7, 8] },
  { name: 'Left column',   positions: [0, 3, 6] },
  { name: 'Center column', positions: [1, 4, 7] },
  { name: 'Right column',  positions: [2, 5, 8] },
  { name: 'Diag ↘',        positions: [0, 4, 8] },
  { name: 'Diag ↗',        positions: [6, 4, 2] },
];

@Injectable()
export class SlotsService {
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

  async getSeedStatus(userId: string) {
    const seed = await this.ensureSeed(userId);
    return { serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce: seed.nonce };
  }

  async updateClientSeed(userId: string, clientSeed: string) {
    if (!clientSeed || clientSeed.length < 4 || clientSeed.length > 64) {
      throw new BadRequestException('BAD_CLIENT_SEED');
    }
    const seed = await this.ensureSeed(userId);
    return this.prisma.fairnessSeed.update({ where: { id: seed.id }, data: { clientSeed } });
  }

  async rotateSeed(userId: string) {
    const seed = await this.ensureSeed(userId);
    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { revealedAt: new Date() },
    });
    return { revealedServerSeed: seed.serverSeed, previousServerSeedHash: seed.serverSeedHash };
  }

  async spin(userId: string, bet: number) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException('BAD_BET');
    }

    const game = await this.prisma.game.findUniqueOrThrow({ where: { slug: 'neon-fruits' } });
    const seed = await this.ensureSeed(userId);

    const debit = await this.wallet.applyEntry({
      userId,
      type: 'BET_DEBIT',
      delta: -bet,
      refType: 'slots',
      reason: 'Slots spin',
    });

    // Roll 9 symbols via weighted reel — one HMAC cursor per cell
    const symbols: string[] = [];
    for (let i = 0; i < 9; i++) {
      const { value } = intBelow(seed.serverSeed, seed.clientSeed, seed.nonce, REEL_SIZE, i);
      symbols.push(REEL[value]);
    }

    // Payout is bet * multiplier, per winning line (NOT divided by line count)
    const wins: { line: string; symbol: string; positions: number[]; payout: number; multiplier: number }[] = [];
    let totalWin = 0;

    for (const line of LINES) {
      const [a, b, c] = line.positions;
      if (symbols[a] === symbols[b] && symbols[b] === symbols[c]) {
        const mult = PAYOUTS[symbols[a]] ?? 0;
        const payout = Number((bet * mult).toFixed(4));
        if (payout > 0) {
          wins.push({
            line: line.name,
            symbol: symbols[a],
            positions: line.positions as number[],
            payout,
            multiplier: mult,
          });
          totalWin += payout;
        }
      }
    }
    totalWin = Number(totalWin.toFixed(4));

    const netProfit = totalWin - bet;
    const won = totalWin > 0;

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        userId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        result: { symbols, wins, totalWin } as any,
        totalBet: bet,
        totalWin,
        wageredForRewards: bet,
        settledAt: new Date(),
        bets: {
          create: [
            {
              userId,
              betType: 'slots',
              betValue: { bet } as any,
              amount: bet,
              payout: totalWin,
              won: totalWin > 0,
            },
          ],
        },
      },
    });

    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { nonce: seed.nonce + 1 },
    });

    try {
      await this.promo.trackBet(userId, bet, netProfit > 0, netProfit);
    } catch { /* ignore */ }

    let finalBalance = debit.balance;
    if (totalWin > 0) {
      const credit = await this.wallet.applyEntry({
        userId,
        type: 'BET_WIN',
        delta: totalWin,
        refType: 'gameRound',
        refId: round.id,
        reason: `Slots win (${wins.length} line${wins.length > 1 ? 's' : ''})`,
      });
      finalBalance = credit.balance;

      if (totalWin >= bet * 5) {
        const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        await this.prisma.liveWin.create({
          data: { username: u.username, gameSlug: 'neon-fruits', amount: totalWin },
        });
        this.live.broadcastWin({
          username: u.username,
          gameSlug: 'neon-fruits',
          amount: totalWin,
        });
      }
    }

    return {
      roundId: round.id,
      symbols,
      wins,
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

  async verify(roundId: string) {
    const r = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    const symbols: string[] = [];
    for (let i = 0; i < 9; i++) {
      const { value } = intBelow(r.serverSeed, r.clientSeed, r.nonce, REEL_SIZE, i);
      symbols.push(REEL[value]);
    }
    const stored = (r.result as any).symbols as string[];
    return {
      serverSeed: r.serverSeed,
      serverSeedHash: r.serverSeedHash,
      clientSeed: r.clientSeed,
      nonce: r.nonce,
      recomputedSymbols: symbols,
      storedSymbols: stored,
      matches: JSON.stringify(symbols) === JSON.stringify(stored),
    };
  }

  async paytable() {
    return {
      symbols: SYMBOL_WEIGHTS.map((s) => s.sym),
      weights: Object.fromEntries(SYMBOL_WEIGHTS.map((s) => [s.sym, s.weight])),
      payouts: PAYOUTS,
      lines: LINES,
    };
  }
}
