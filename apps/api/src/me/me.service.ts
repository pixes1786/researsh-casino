import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeService {
  constructor(private prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, wallet: true },
    });
    const totalBets = await this.prisma.bet.count({ where: { userId } });
    const totalWagered = await this.prisma.bet.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const totalWon = await this.prisma.bet.aggregate({
      where: { userId },
      _sum: { payout: true },
    });
    const roundsPlayed = await this.prisma.gameRound.count({ where: { userId } });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      kycStatus: user.kycStatus,
      status: user.status,
      createdAt: user.createdAt,
      locale: user.profile?.locale ?? 'ru',
      currency: user.wallet?.currency ?? 'RC',
      balance: Number(user.wallet?.balance ?? 0),
      vipLevel: user.profile?.vipLevel ?? 0,
      loyaltyPts: user.profile?.loyaltyPts ?? 0,
      stats: {
        totalBets,
        roundsPlayed,
        totalWagered: Number(totalWagered._sum.amount ?? 0),
        totalWon: Number(totalWon._sum.payout ?? 0),
        netProfit: Number(totalWon._sum.payout ?? 0) - Number(totalWagered._sum.amount ?? 0),
      },
    };
  }

  async bets(userId: string, limit = 50) {
    const rows = await this.prisma.bet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { round: { select: { id: true, gameId: true, result: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      roundId: r.roundId,
      betType: r.betType,
      betValue: r.betValue,
      amount: Number(r.amount),
      payout: Number(r.payout),
      won: r.won,
      createdAt: r.createdAt,
      gameId: r.round.gameId,
    }));
  }

  async rounds(userId: string, limit = 30) {
    const rows = await this.prisma.gameRound.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      gameId: r.gameId,
      result: r.result,
      totalBet: Number(r.totalBet),
      totalWin: Number(r.totalWin),
      nonce: r.nonce,
      createdAt: r.createdAt,
    }));
  }

  async sessions(userId: string) {
    const rows = await this.prisma.fairnessSeed.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((s) => ({
      id: s.id,
      serverSeedHash: s.serverSeedHash,
      clientSeed: s.clientSeed,
      nonce: s.nonce,
      revealedAt: s.revealedAt,
      createdAt: s.createdAt,
    }));
  }
}
