import { Module } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { WalletModule } from '../../wallet/wallet.module';
import { LiveModule } from '../../live/live.module';
import { PromoModule } from '../../promo/promo.module';

@Module({
  imports: [WalletModule, LiveModule, PromoModule],
  providers: [SlotsService],
  controllers: [SlotsController],
})
export class SlotsModule {}
