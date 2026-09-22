import { Module } from '@nestjs/common';
import { MinesService } from './mines.service';
import { MinesController } from './mines.controller';
import { WalletModule } from '../../wallet/wallet.module';
import { LiveModule } from '../../live/live.module';
import { PromoModule } from '../../promo/promo.module';

@Module({
  imports: [WalletModule, LiveModule, PromoModule],
  providers: [MinesService],
  controllers: [MinesController],
})
export class MinesModule {}
