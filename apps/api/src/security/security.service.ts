import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Severity = 'info' | 'warn' | 'danger';

@Injectable()
export class SecurityService {
  private log = new Logger('Security');
  constructor(private prisma: PrismaService) {}

  async track(
    kind: string,
    opts: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      severity?: Severity;
      meta?: Record<string, any>;
    } = {},
  ) {
    try {
      await this.prisma.securityEvent.create({
        data: {
          kind,
          severity: opts.severity ?? 'info',
          userId: opts.userId,
          ip: opts.ip,
          userAgent: opts.userAgent,
          meta: (opts.meta ?? {}) as any,
        },
      });
    } catch (e) {
      this.log.warn(`Failed to persist SecurityEvent: ${(e as Error).message}`);
    }
  }

  async list(params: { kind?: string; severity?: string; limit?: number } = {}) {
    const where: any = {};
    if (params.kind) where.kind = params.kind;
    if (params.severity) where.severity = params.severity;
    const rows = await this.prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.limit ?? 200, 500),
      include: { user: { select: { username: true, email: true, role: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      kind: r.kind,
      severity: r.severity,
      userId: r.userId,
      username: r.user?.username ?? null,
      email: r.user?.email ?? null,
      role: r.user?.role ?? null,
      ip: r.ip,
      userAgent: r.userAgent,
      meta: r.meta,
    }));
  }

  async summary() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, danger, warn, info, topKinds] = await Promise.all([
      this.prisma.securityEvent.count({ where: { createdAt: { gte: since } } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: since }, severity: 'danger' } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: since }, severity: 'warn' } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: since }, severity: 'info' } }),
      this.prisma.securityEvent.groupBy({
        by: ['kind'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { kind: 'desc' } },
        take: 8,
      }),
    ]);
    return {
      last24h: { total, danger, warn, info },
      topKinds: topKinds.map((k) => ({ kind: k.kind, count: k._count._all })),
    };
  }
}
