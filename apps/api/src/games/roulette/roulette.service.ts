import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { spinRoulette, generateServerSeed, hashServerSeed } from '../../rng';
import { BetType, payoutMultiplier, riskyWager } from './payouts';

const STAKE_MIN = 0.1;
const STAKE_MAX = 500;

@Injectable()
export class RouletteService {
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
    return {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
    };
  }

  async updateClientSeed(userId: string, clientSeed: string) {
    if (!clientSeed || clientSeed.length < 4 || clientSeed.length > 64) {
      throw new BadRequestException('BAD_CLIENT_SEED');
    }
    const seed = await this.ensureSeed(userId);
    return this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { clientSeed },
    });
  }

  async rotateSeed(userId: string) {
    const seed = await this.ensureSeed(userId);
    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { revealedAt: new Date() },
    });
    return {
      revealedServerSeed: seed.serverSeed,
      previousServerSeedHash: seed.serverSeedHash,
    };
  }

  async placeBet(userId: string, bets: { bet: BetType; amount: number }[]) {
    if (!bets.length) throw new BadRequestException('NO_BETS');
    const total = bets.reduce((s, b) => s + b.amount, 0);
    if (total < STAKE_MIN) throw new BadRequestException('BELOW_MIN');
    if (total > STAKE_MAX) throw new BadRequestException('ABOVE_MAX');
    for (const b of bets) if (b.amount <= 0) throw new BadRequestException('BAD_AMOUNT');

    const game = await this.prisma.game.findUniqueOrThrow({
      where: { slug: 'european-roulette' },
    });
    const seed = await this.ensureSeed(userId);

    const debit = await this.wallet.applyEntry({
      userId,
      type: 'BET_DEBIT',
      delta: -total,
      refType: 'roulette',
      reason: 'Roulette bet',
    });

    const { outcome } = spinRoulette(seed.serverSeed, seed.clientSeed, seed.nonce);

    let win = 0;
    const graded = bets.map((b) => {
      const mult = payoutMultiplier(b.bet, outcome);
      const p = mult > 0 ? b.amount * mult : 0;
      win += p;
      return { ...b, payout: p, won: mult > 0 };
    });

    // ─── Anti-abuse: в прогресс идёт только рискованная часть ───
    const wageredForRewards = riskyWager(bets);
    const netProfit = win - total;
    const wonNet = netProfit > 0;
    const hedged = wageredForRewards === 0;

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        userId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        result: { outcome, bets: graded, wageredForRewards, hedged } as any,
        totalBet: total,
        totalWin: win,
        wageredForRewards,
        settledAt: new Date(),
        bets: {
          create: graded.map((g) => ({
            userId,
            betType: g.bet.kind,
            betValue: g.bet as any,
            amount: g.amount,
            payout: g.payout,
            won: g.won,
          })),
        },
      },
    });

    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { nonce: seed.nonce + 1 },
    });

    // Promo — только рискованное
    try {
      await this.promo.trackBet(userId, wageredForRewards, wonNet, netProfit);
    } catch { /* non-fatal */ }

    let finalBalance = debit.balance;
    if (win > 0) {
      const credit = await this.wallet.applyEntry({
        userId,
        type: 'BET_WIN',
        delta: win,
        refType: 'gameRound',
        refId: round.id,
        reason: 'Roulette win',
      });
      finalBalance = credit.balance;

      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await this.prisma.liveWin.create({
        data: { username: u.username, gameSlug: 'european-roulette', amount: win },
      });
      this.live.broadcastWin({ username: u.username, gameSlug: 'european-roulette', amount: win });
    }

    return {
      roundId: round.id,
      outcome,
      win,
      totalBet: total,
      balance: finalBalance,
      netProfit,
      wageredForRewards,
      hedged,
      verified: {
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
      },
      bets: graded,
    };
  }

  async verify(roundId: string) {
    const r = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    const { outcome } = spinRoulette(r.serverSeed, r.clientSeed, r.nonce);
    return {
      serverSeedHash: r.serverSeedHash,
      serverSeed: r.serverSeed,
      clientSeed: r.clientSeed,
      nonce: r.nonce,
      recomputedOutcome: outcome,
      storedOutcome: (r.result as any).outcome,
      matches: outcome === (r.result as any).outcome,
    };
  }
}
