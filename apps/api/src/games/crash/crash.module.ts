import { Module } from '@nestjs/common';
import { CrashService } from './crash.service';
import { CrashController } from './crash.controller';
import { WalletModule } from '../../wallet/wallet.module';
import { LiveModule } from '../../live/live.module';
import { PromoModule } from '../../promo/promo.module';

@Module({
  imports: [WalletModule, LiveModule, PromoModule],
  providers: [CrashService],
  controllers: [CrashController],
})
export class CrashModule {}
