import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WalletService } from './wallet.service';
import { JwtGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('wallet')
@UseGuards(JwtGuard)
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get() balance(@CurrentUser() u: any) { return this.wallet.getBalance(u.sub); }

  @Get('ledger')
  @Throttle({ wallet: { limit: 30, ttl: 60_000 } })
  ledger(@CurrentUser() u: any, @Query('limit') limit?: string) {
    return this.wallet.history(u.sub, limit ? Math.min(+limit, 200) : 50);
  }
}
