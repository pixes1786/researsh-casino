import { Module } from '@nestjs/common';
import { BlackjackService } from './blackjack.service';
import { BlackjackController } from './blackjack.controller';
import { WalletModule } from '../../wallet/wallet.module';
import { LiveModule } from '../../live/live.module';
import { PromoModule } from '../../promo/promo.module';

@Module({
  imports: [WalletModule, LiveModule, PromoModule],
  providers: [BlackjackService],
  controllers: [BlackjackController],
})
export class BlackjackModule {}
