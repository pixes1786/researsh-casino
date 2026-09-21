import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { GamesModule } from './games/games.module';
import { RouletteModule } from './games/roulette/roulette.module';
import { DiceModule } from './games/dice/dice.module';
import { CrashModule } from './games/crash/crash.module';
import { SlotsModule } from './games/slots/slots.module';
import { LiveModule } from './live/live.module';
import { MeModule } from './me/me.module';
import { AdminModule } from './admin/admin.module';
import { PromoModule } from './promo/promo.module';
import { SecurityModule } from './security/security.module';
import { CaptchaModule } from './captcha/captcha.module';
import { HealthModule } from './health/health.module';
import { makeRedisStorage } from './throttler/redis-throttler.module';

const storage = makeRedisStorage();

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 1000 },
        { name: 'auth',    ttl: 60_000, limit: 30   },
        { name: 'wallet',  ttl: 60_000, limit: 200  },
      ],
      ...(storage ? { storage } : {}),
    }),
    PrismaModule,
    AuthModule,
    WalletModule,
    GamesModule,
    RouletteModule,
    DiceModule,
    CrashModule,
    SlotsModule,
    LiveModule,
    MeModule,
    AdminModule,
    PromoModule,
    SecurityModule,
    CaptchaModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
