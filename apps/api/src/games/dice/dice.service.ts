import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { generateServerSeed, hashServerSeed, floatAt } from '../../rng';

const HOUSE_EDGE = 1;       // 1%
const MIN_BET = 0.1;
const MAX_BET = 500;
const TARGET_MIN = 0.1;
const TARGET_MAX = 99;

@Injectable()
export class DiceService {
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

  async placeBet(
    userId: string,
    body: { target: number; direction: 'under' | 'over'; amount: number },
  ) {
    const { target, direction, amount } = body;
    if (!Number.isFinite(target) || target < TARGET_MIN || target > TARGET_MAX) {
      throw new BadRequestException('BAD_TARGET');
    }
    if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
      throw new BadRequestException('BAD_AMOUNT');
    }
    if (direction !== 'under' && direction !== 'over') {
      throw new BadRequestException('BAD_DIRECTION');
    }

    const winChance = direction === 'under' ? target : 100 - target;
    const multiplier = Number(((100 - HOUSE_EDGE) / winChance).toFixed(4));

    const game = await this.prisma.game.findUniqueOrThrow({ where: { slug: 'dice-x' } });
    const seed = await this.ensureSeed(userId);

    const debit = await this.wallet.applyEntry({
      userId,
      type: 'BET_DEBIT',
      delta: -amount,
      refType: 'dice',
      reason: 'Dice bet',
    });

    const r = floatAt(seed.serverSeed, seed.clientSeed, seed.nonce, 0);
    const roll = Math.floor(r * 10000) / 100; // 0.00 .. 99.99
    const won = direction === 'under' ? roll < target : roll > target;
    const payout = won ? Number((amount * multiplier).toFixed(4)) : 0;
    const netProfit = payout - amount;
    const hedged = false;
    const wageredForRewards = amount;

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        userId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        result: { roll, target, direction, multiplier, won } as any,
        totalBet: amount,
        totalWin: payout,
        wageredForRewards,
        settledAt: new Date(),
        bets: {
          create: [
            {
              userId,
              betType: `${direction}:${target}`,
              betValue: { target, direction, multiplier } as any,
              amount,
              payout,
              won,
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
      await this.promo.trackBet(userId, wageredForRewards, netProfit > 0, netProfit);
    } catch { /* non-fatal */ }

    let finalBalance = debit.balance;
    if (payout > 0) {
      const credit = await this.wallet.applyEntry({
        userId,
        type: 'BET_WIN',
        delta: payout,
        refType: 'gameRound',
        refId: round.id,
        reason: 'Dice win',
      });
      finalBalance = credit.balance;

      const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await this.prisma.liveWin.create({
        data: { username: u.username, gameSlug: 'dice-x', amount: payout },
      });
      this.live.broadcastWin({ username: u.username, gameSlug: 'dice-x', amount: payout });
    }

    return {
      roundId: round.id,
      roll,
      target,
      direction,
      multiplier,
      winChance,
      won,
      payout,
      netProfit,
      balance: finalBalance,
      wageredForRewards,
      hedged,
      verified: {
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
      },
    };
  }

  async verify(roundId: string) {
    const r = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    const res: any = r.result;
    const rnd = floatAt(r.serverSeed, r.clientSeed, r.nonce, 0);
    const roll = Math.floor(rnd * 10000) / 100;
    return {
      serverSeed: r.serverSeed,
      serverSeedHash: r.serverSeedHash,
      clientSeed: r.clientSeed,
      nonce: r.nonce,
      recomputedRoll: roll,
      storedRoll: res.roll,
      matches: Math.abs(roll - res.roll) < 0.001,
    };
  }
}
