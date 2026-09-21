import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  async list(q?: { category?: string; search?: string }) {
    const where: any = { isActive: true };
    if (q?.category) where.category = q.category;
    if (q?.search) where.name = { contains: q.search, mode: 'insensitive' };
    return this.prisma.game.findMany({
      where, include: { provider: true }, orderBy: { playersNow: 'desc' }, take: 60,
    });
  }

  async bySlug(slug: string) {
    const game = await this.prisma.game.findUnique({ where: { slug }, include: { provider: true } });
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return game;
  }

  async recentWins(limit = 15) {
    const rows = await this.prisma.liveWin.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
  }
}
