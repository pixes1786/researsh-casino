import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { LedgerType, Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private wallet: WalletService) {}

  // ─────── DASHBOARD ───────
  async dashboard() {
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [usersTotal, usersActive, rounds24h, bets24h, wagered, paidOut, liveWins] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.gameRound.count({ where: { createdAt: { gte: day } } }),
        this.prisma.bet.count({ where: { createdAt: { gte: day } } }),
        this.prisma.bet.aggregate({
          where: { createdAt: { gte: day } },
          _sum: { amount: true },
        }),
        this.prisma.bet.aggregate({
          where: { createdAt: { gte: day } },
          _sum: { payout: true },
        }),
        this.prisma.liveWin.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      ]);

    const wageredNum = Number(wagered._sum.amount ?? 0);
    const paidNum = Number(paidOut._sum.payout ?? 0);
    const ggr = wageredNum - paidNum;
    const ngr = ggr; // no bonuses deducted for simplicity

    // Top games by bets
    const topGames = await this.prisma.bet.groupBy({
      by: ['betType'],
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { betType: 'desc' } },
      take: 5,
    });

    // Hourly round activity (last 24h, buckets)
    const rounds = await this.prisma.gameRound.findMany({
      where: { createdAt: { gte: day } },
      select: { createdAt: true, totalBet: true, totalWin: true },
    });
    const buckets = new Array(24).fill(0).map((_, i) => ({ hour: i, rounds: 0, net: 0 }));
    for (const r of rounds) {
      const h = Math.floor((now.getTime() - r.createdAt.getTime()) / (60 * 60 * 1000));
      if (h >= 0 && h < 24) {
        const idx = 23 - h;
        buckets[idx].rounds += 1;
        buckets[idx].net += Number(r.totalBet) - Number(r.totalWin);
      }
    }

    return {
      users: { total: usersTotal, active: usersActive },
      last24h: {
        rounds: rounds24h,
        bets: bets24h,
        wagered: wageredNum,
        paidOut: paidNum,
        ggr,
        ngr,
      },
      topBetTypes: topGames.map((g) => ({
        betType: g.betType,
        count: g._count._all,
        wagered: Number(g._sum.amount ?? 0),
      })),
      activity: buckets,
      recentWins: liveWins.map((w) => ({
        username: w.username,
        gameSlug: w.gameSlug,
        amount: Number(w.amount),
        createdAt: w.createdAt,
      })),
    };
  }

  // ─────── USERS ───────
  async users(q: { search?: string; role?: Role; status?: string }) {
    const where: any = {};
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { username: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.role) where.role = q.role;
    if (q.status) where.status = q.status;

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { wallet: true, profile: true },
    });

    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      status: u.status,
      kycStatus: u.kycStatus,
      createdAt: u.createdAt,
      balance: Number(u.wallet?.balance ?? 0),
      currency: u.wallet?.currency ?? 'RC',
      vipLevel: u.profile?.vipLevel ?? 0,
      passwordHashPreview: u.passwordHash.slice(0, 24) + '…',
    }));
  }

  async user(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true, profile: true },
    });
    if (!u) throw new NotFoundException('USER_NOT_FOUND');

    const [ledger, bets, sessions] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.bet.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.fairnessSeed.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        role: u.role,
        status: u.status,
        kycStatus: u.kycStatus,
        createdAt: u.createdAt,
        balance: Number(u.wallet?.balance ?? 0),
        currency: u.wallet?.currency ?? 'RC',
        vipLevel: u.profile?.vipLevel ?? 0,
        loyaltyPts: u.profile?.loyaltyPts ?? 0,
        passwordHash: u.passwordHash,
      },
      ledger: ledger.map((e) => ({ ...e, amount: Number(e.amount), balanceAfter: Number(e.balanceAfter) })),
      bets: bets.map((b) => ({ ...b, amount: Number(b.amount), payout: Number(b.payout) })),
      sessions: sessions.map((s) => ({
        id: s.id,
        serverSeedHash: s.serverSeedHash,
        clientSeed: s.clientSeed,
        nonce: s.nonce,
        revealedAt: s.revealedAt,
        createdAt: s.createdAt,
      })),
    };
  }

  async updateUser(
    actorId: string,
    id: string,
    patch: { role?: Role; status?: string; kycStatus?: string; reason?: string },
  ) {
    if (id === actorId && patch.role && patch.role !== 'ADMIN' && patch.role !== 'SUPERADMIN') {
      throw new BadRequestException('CANNOT_DEMOTE_SELF');
    }
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role: patch.role ?? undefined,
        status: patch.status as any ?? undefined,
        kycStatus: patch.kycStatus as any ?? undefined,
      },
    });

    await this.writeAudit(actorId, 'USER_UPDATE', 'User', id, before, updated, patch.reason);

    return {
      id: updated.id,
      role: updated.role,
      status: updated.status,
      kycStatus: updated.kycStatus,
    };
  }

  async adjustBalance(actorId: string, id: string, delta: number, reason: string) {
    if (!Number.isFinite(delta) || delta === 0) throw new BadRequestException('BAD_DELTA');
    if (!reason || reason.length < 3) throw new BadRequestException('REASON_REQUIRED');

    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('USER_NOT_FOUND');

    const type: LedgerType = delta > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT';
    const res = await this.wallet.applyEntry({
      userId: id,
      type,
      delta,
      refType: 'admin_adjustment',
      reason,
    });

    await this.writeAudit(actorId, 'BALANCE_ADJUST', 'User', id, { balance: null }, { delta, newBalance: res.balance }, reason);

    return { userId: id, newBalance: res.balance, delta };
  }

  // ─────── GAMES ───────
  async games() {
    const rows = await this.prisma.game.findMany({
      include: { provider: true },
      orderBy: { playersNow: 'desc' },
    });
    return rows.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      category: g.category,
      provider: g.provider?.name,
      rtp: g.rtp,
      volatility: g.volatility,
      isActive: g.isActive,
      playersNow: g.playersNow,
      rating: g.rating,
    }));
  }

  async updateGame(actorId: string, id: string, patch: { isActive?: boolean; rtp?: number; playersNow?: number; reason?: string }) {
    const before = await this.prisma.game.findUniqueOrThrow({ where: { id } });
    if (patch.rtp != null && (patch.rtp < 80 || patch.rtp > 99.9)) {
      throw new BadRequestException('RTP_OUT_OF_RANGE');
    }
    const updated = await this.prisma.game.update({
      where: { id },
      data: {
        isActive: patch.isActive ?? undefined,
        rtp: patch.rtp ?? undefined,
        playersNow: patch.playersNow ?? undefined,
      },
    });
    await this.writeAudit(actorId, 'GAME_UPDATE', 'Game', id, before, updated, patch.reason);
    return updated;
  }

  // ─────── LEDGER ───────
  async ledger(q: { type?: string; limit?: number }) {
    const where: any = {};
    if (q.type) where.type = q.type;
    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(q.limit ?? 100, 300),
      include: { user: { select: { username: true, email: true } } },
    });
    return rows.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      username: e.user.username,
      email: e.user.email,
      type: e.type,
      amount: Number(e.amount),
      balanceAfter: Number(e.balanceAfter),
      reason: e.reason,
      refType: e.refType,
      refId: e.refId,
    }));
  }

  // ─────── AUDIT ───────
  async audit(limit = 100) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 300),
      include: { actor: { select: { username: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      actor: a.actor?.username ?? 'system',
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      ip: a.ip,
      userAgent: a.userAgent,
      reason: a.reason,
      diff: a.diff,
    }));
  }

  private async writeAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    before: any,
    after: any,
    reason?: string,
    req?: any,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        reason,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
        diff: { before: stripSensitive(before), after: stripSensitive(after) } as any,
      },
    });
  }
}

function stripSensitive(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  if ('passwordHash' in clone) clone.passwordHash = '[redacted]';
  return clone;
}
