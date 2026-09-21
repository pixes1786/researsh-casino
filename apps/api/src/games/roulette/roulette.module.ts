import { Module } from '@nestjs/common';
import { RouletteService } from './roulette.service';
import { RouletteController } from './roulette.controller';
import { WalletModule } from '../../wallet/wallet.module';
import { LiveModule } from '../../live/live.module';
import { PromoModule } from '../../promo/promo.module';

@Module({
  imports: [WalletModule, LiveModule, PromoModule],
  providers: [RouletteService],
  controllers: [RouletteController],
})
export class RouletteModule {}
