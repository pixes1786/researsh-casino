import { Module } from '@nestjs/common';
import { DiceService } from './dice.service';
import { DiceController } from './dice.controller';
import { WalletModule } from '../../wallet/wallet.module';
import { LiveModule } from '../../live/live.module';
import { PromoModule } from '../../promo/promo.module';

@Module({
  imports: [WalletModule, LiveModule, PromoModule],
  providers: [DiceService],
  controllers: [DiceController],
})
export class DiceModule {}
