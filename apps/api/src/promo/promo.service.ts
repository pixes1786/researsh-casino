import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const VIP_LEVELS = [
  { level: 1, name: 'Bronze',   threshold: 0 },
  { level: 2, name: 'Silver',   threshold: 5_000 },
  { level: 3, name: 'Gold',     threshold: 25_000 },
  { level: 4, name: 'Platinum', threshold: 100_000 },
  { level: 5, name: 'Diamond',  threshold: 500_000 },
];

const DEFAULT_MISSIONS = [
  { code: 'daily_rounds_10', title: 'Play 10 rounds', description: 'Complete 10 spins/rounds today.', kind: 'rounds_played', target: 10, reward: 50 },
  { code: 'daily_wager_250', title: 'Wager 250 RC', description: 'Total bets of 250 RC today.', kind: 'wagered_rc', target: 250, reward: 100 },
  { code: 'daily_wins_3',    title: 'Win 3 rounds', description: 'Land 3 winning rounds today.',   kind: 'wins_count', target: 3, reward: 150 },
];

function startOfUtcDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfUtcWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // Monday start
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService, private wallet: WalletService) {}

  // ─── DAILY BONUS ───
  async dailyStatus(userId: string) {
    const today = startOfUtcDay();
    const last = await this.prisma.dailyBonusClaim.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const claimedToday = last ? last.createdAt >= today : false;

    // streak: если последний клейм был вчера — продолжаем серию, иначе сброс
    let streak = 0;
    if (last) {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      if (last.createdAt >= yesterday) streak = last.streak;
    }
    const nextStreak = claimedToday ? streak : Math.min(streak + 1, 7);
    const amounts = [50, 75, 100, 150, 200, 300, 500]; // day 1..7

    return {
      claimedToday,
      currentStreak: streak,
      nextStreak,
      nextAmount: amounts[Math.min(nextStreak, 7) - 1],
      schedule: amounts,
      lastClaimedAt: last?.createdAt ?? null,
    };
  }

  async claimDaily(userId: string) {
    const status = await this.dailyStatus(userId);
    if (status.claimedToday) throw new BadRequestException('ALREADY_CLAIMED');

    const amount = status.nextAmount;
    const res = await this.wallet.applyEntry({
      userId,
      type: 'DAILY_BONUS',
      delta: amount,
      refType: 'daily_bonus',
      reason: `Daily bonus · streak ${status.nextStreak}`,
    });
    await this.prisma.dailyBonusClaim.create({
      data: { userId, amount, streak: status.nextStreak },
    });
    return { amount, balance: res.balance, streak: status.nextStreak };
  }

  // ─── MISSIONS ───
  async ensureMissions(userId: string) {
    // seed default missions on first access
    const count = await this.prisma.mission.count();
    if (count === 0) {
      for (const m of DEFAULT_MISSIONS) {
        await this.prisma.mission.upsert({ where: { code: m.code }, update: {}, create: m });
      }
    }
    const today = startOfUtcDay();
    const missions = await this.prisma.mission.findMany({ where: { isActive: true } });
    for (const m of missions) {
      await this.prisma.userMission.upsert({
        where: { userId_missionId_resetAt: { userId, missionId: m.id, resetAt: today } },
        update: {},
        create: { userId, missionId: m.id, resetAt: today, progress: 0 },
      });
    }
  }

  async missions(userId: string) {
    await this.ensureMissions(userId);
    const today = startOfUtcDay();
    const rows = await this.prisma.userMission.findMany({
      where: { userId, resetAt: today },
      include: { mission: true },
      orderBy: { mission: { reward: 'desc' } },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.mission.code,
      title: r.mission.title,
      description: r.mission.description,
      kind: r.mission.kind,
      target: r.mission.target,
      reward: Number(r.mission.reward),
      progress: r.progress,
      claimed: !!r.claimedAt,
      complete: r.progress >= r.mission.target,
    }));
  }

  async claimMission(userId: string, userMissionId: string) {
    const row = await this.prisma.userMission.findUnique({
      where: { id: userMissionId },
      include: { mission: true },
    });
    if (!row || row.userId !== userId) throw new BadRequestException('NOT_FOUND');
    if (row.claimedAt) throw new BadRequestException('ALREADY_CLAIMED');
    if (row.progress < row.mission.target) throw new BadRequestException('NOT_COMPLETE');

    await this.prisma.userMission.update({
      where: { id: row.id },
      data: { claimedAt: new Date() },
    });

    const res = await this.wallet.applyEntry({
      userId,
      type: 'DAILY_BONUS',
      delta: Number(row.mission.reward),
      refType: 'mission',
      refId: row.mission.code,
      reason: `Mission reward: ${row.mission.title}`,
    });

    return { amount: Number(row.mission.reward), balance: res.balance };
  }

  /**
   * Called from roulette after each settled bet.
   * `wageredForRewards` is the anti-abuse risked amount
   * (total − minGuaranteedReturn), so hedged bets count as 0.
   */
  async trackBet(userId: string, wageredForRewards: number, won: boolean, net: number) {
    // 1) Missions
    await this.ensureMissions(userId);
    if (wageredForRewards > 0 || won) {
      const today = startOfUtcDay();
      const rows = await this.prisma.userMission.findMany({
        where: { userId, resetAt: today },
        include: { mission: true },
      });
      for (const r of rows) {
        if (r.claimedAt) continue;
        let delta = 0;
        if (r.mission.kind === 'rounds_played' && wageredForRewards > 0) delta = 1;
        else if (r.mission.kind === 'wagered_rc') delta = Math.floor(wageredForRewards);
        else if (r.mission.kind === 'wins_count' && won) delta = 1;
        else if (r.mission.kind === 'net_profit' && net > 0) delta = Math.floor(net);
        if (!delta) continue;
        await this.prisma.userMission.update({
          where: { id: r.id },
          data: { progress: { increment: delta } },
        });
      }
    }

    // 2) Loyalty: 1 pt per *risked* RC
    const pts = Math.floor(wageredForRewards);
    if (pts > 0) {
      await this.prisma.profile.updateMany({
        where: { userId },
        data: { loyaltyPts: { increment: pts } },
      });
    }

    // 3) Tournament: only risked amount
    if (wageredForRewards > 0) {
      const active = await this.prisma.tournament.findFirst({
        where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
      });
      if (active) {
        await this.prisma.tournamentEntry.upsert({
          where: { tournamentId_userId: { tournamentId: active.id, userId } },
          update: { wagered: { increment: wageredForRewards } },
          create: { tournamentId: active.id, userId, wagered: wageredForRewards },
        });
      }
    }
  }

  // ─── TOURNAMENT ───
  async ensureTournament() {
    const now = new Date();
    let t = await this.prisma.tournament.findFirst({
      where: { isActive: true, endsAt: { gte: now } },
    });
    if (t) return t;
    const startsAt = startOfUtcWeek(now);
    const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    t = await this.prisma.tournament.create({
      data: {
        name: `Weekly Roulette Race · ${startsAt.toISOString().slice(0, 10)}`,
        startsAt,
        endsAt,
        prizePool: 10_000,
        isActive: true,
      },
    });
    return t;
  }

  async tournament() {
    const t = await this.ensureTournament();
    const entries = await this.prisma.tournamentEntry.findMany({
      where: { tournamentId: t.id },
      orderBy: { wagered: 'desc' },
      take: 20,
      include: { user: { select: { username: true } } },
    });
    return {
      id: t.id,
      name: t.name,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      prizePool: Number(t.prizePool),
      leaderboard: entries.map((e, i) => ({
        rank: i + 1,
        username: e.user.username,
        wagered: Number(e.wagered),
        prize: i === 0 ? Number(t.prizePool) * 0.5
             : i === 1 ? Number(t.prizePool) * 0.25
             : i === 2 ? Number(t.prizePool) * 0.15
             : i < 10 ? Number(t.prizePool) * 0.02
             : 0,
      })),
    };
  }

  // ─── VIP ───
  // NOTE: uses risked wagers (rounds where hedged is false) for tier progression.
  // Hedged rounds have wageredForRewards = 0 and are excluded from reward metrics.
  // We approximate by using totalBets − totalWins (net losses + non-hedged stake),
  // which matches the anti-abuse rule for practical purposes.
  // ─── VIP ───
  // Tier progression based on *risked* wagers only (wageredForRewards).
  // Hedged bets (red+black etc.) contribute 0 — cannot be farmed.
  async vip(userId: string) {
    const agg = await this.prisma.gameRound.aggregate({
      where: { userId },
      _sum: { wageredForRewards: true },
    });
    const riskedWagered = Number(agg._sum.wageredForRewards ?? 0);

    let current = VIP_LEVELS[0];
    let next: typeof VIP_LEVELS[number] | null = null;
    for (let i = 0; i < VIP_LEVELS.length; i++) {
      if (riskedWagered >= VIP_LEVELS[i].threshold) {
        current = VIP_LEVELS[i];
        next = VIP_LEVELS[i + 1] ?? null;
      }
    }
    const progressToNext = next
      ? Math.min(
          100,
          Math.floor(
            ((riskedWagered - current.threshold) / (next.threshold - current.threshold)) * 100,
          ),
        )
      : 100;

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (profile && profile.vipLevel !== current.level) {
      await this.prisma.profile.update({
        where: { userId },
        data: { vipLevel: current.level },
      });
    }

    return {
      current: { level: current.level, name: current.name, threshold: current.threshold },
      next: next ? { level: next.level, name: next.name, threshold: next.threshold } : null,
      wagered: riskedWagered,
      progressToNext,
      loyaltyPts: profile?.loyaltyPts ?? 0,
      levels: VIP_LEVELS,
    };
  }
}
