import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerType } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    return { currency: w.currency, balance: Number(w.balance) };
  }

  async history(userId: string, limit = 50) {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: limit,
    });
    return rows.map((r) => ({ ...r, amount: Number(r.amount), balanceAfter: Number(r.balanceAfter) }));
  }

  async applyEntry(opts: {
    userId: string; type: LedgerType; delta: number;
    refType?: string; refId?: string; reason?: string; requestId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: opts.userId } });
      const newBalance = Number(wallet.balance) + opts.delta;
      if (newBalance < 0) throw new BadRequestException('INSUFFICIENT_FUNDS');

      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
      const entry = await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id, userId: opts.userId, type: opts.type,
          amount: opts.delta, balanceAfter: newBalance,
          refType: opts.refType, refId: opts.refId, reason: opts.reason, requestId: opts.requestId,
        },
      });
      return { balance: newBalance, entryId: entry.id };
    }, { isolationLevel: 'Serializable' });
  }
}
