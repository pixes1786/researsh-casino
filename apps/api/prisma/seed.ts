import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const providers = [
    { slug: 'novaplay', name: 'NovaPlay' },
    { slug: 'aurorasoft', name: 'AuroraSoft' },
    { slug: 'bytespin', name: 'ByteSpin' },
  ];
  for (const p of providers) {
    await prisma.gameProvider.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  const pm = Object.fromEntries((await prisma.gameProvider.findMany()).map((p) => [p.slug, p.id]));
  const games = [
    { slug: 'european-roulette', name: 'European Roulette', category: 'roulette', providerId: pm['novaplay'], rtp: 97.3, volatility: 'medium' },
    { slug: 'neon-fruits', name: 'Neon Fruits', category: 'slots', providerId: pm['aurorasoft'], rtp: 96.1, volatility: 'high' },
    { slug: 'aurora-blackjack', name: 'Aurora Blackjack', category: 'blackjack', providerId: pm['bytespin'], rtp: 99.5, volatility: 'low' },
    { slug: 'crash-x', name: 'Crash X', category: 'crash', providerId: pm['novaplay'], rtp: 97.0, volatility: 'high' },
    { slug: 'mines-rc', name: 'Mines RC', category: 'mines', providerId: pm['aurorasoft'], rtp: 97.0, volatility: 'medium' },
  ];
  for (const g of games) {
    await prisma.game.upsert({
      where: { slug: g.slug }, update: {},
      create: { ...g, playersNow: Math.floor(50 + Math.random() * 400), rating: 4.2 + Math.random() * 0.7 },
    });
  }
  const passwordHash = await argon2.hash('demo12345', { type: argon2.argon2id });
  const demo = await prisma.user.upsert({
    where: { email: 'demo@rc.local' }, update: {},
    create: {
      email: 'demo@rc.local', username: 'demo', passwordHash, role: 'USER',
      profile: { create: { locale: 'ru', currency: 'RC' } },
      wallet: { create: { currency: 'RC', balance: 1000 } },
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin@rc.local' }, update: {},
    create: {
      email: 'admin@rc.local', username: 'admin',
      passwordHash: await argon2.hash('admin12345', { type: argon2.argon2id }),
      role: 'ADMIN',
      profile: { create: { locale: 'en', currency: 'RC' } },
      wallet: { create: { currency: 'RC', balance: 0 } },
    },
  });
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: demo.id } });
  if (!(await prisma.ledgerEntry.findFirst({ where: { userId: demo.id } }))) {
    await prisma.ledgerEntry.create({
      data: { walletId: wallet.id, userId: demo.id, type: 'SIGNUP_BONUS', amount: 1000, balanceAfter: 1000, reason: 'Seed bonus' },
    });
  }
  if ((await prisma.liveWin.count()) < 5) {
    for (let i = 0; i < 20; i++) {
      await prisma.liveWin.create({
        data: { username: `player_${Math.floor(Math.random() * 9999)}`, gameSlug: 'european-roulette', amount: 5 + Math.random() * 500 },
      });
    }
  }
  console.log('Seed complete. demo@rc.local / demo12345');
}
main().finally(() => prisma.$disconnect());
