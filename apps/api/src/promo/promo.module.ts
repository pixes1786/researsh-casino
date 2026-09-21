import { Module } from '@nestjs/common';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  providers: [PromoService],
  controllers: [PromoController],
  exports: [PromoService],
})
export class PromoModule {}
