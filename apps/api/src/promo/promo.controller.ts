import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Throttle } from '@nestjs/throttler';
import { PromoService } from './promo.service';
import { JwtGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('promo')
@UseGuards(JwtGuard)
export class PromoController {
  constructor(private promo: PromoService) {}

  @Get('daily') daily(@CurrentUser() u: any) { return this.promo.dailyStatus(u.sub); }

  @Post('daily/claim')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  claimDaily(@CurrentUser() u: any) { return this.promo.claimDaily(u.sub); }

  @Get('missions') missions(@CurrentUser() u: any) { return this.promo.missions(u.sub); }

  @Post('missions/:id/claim')
  claimMission(@CurrentUser() u: any, @Param('id') id: string) {
    return this.promo.claimMission(u.sub, id);
  }

  @Get('tournament') tournament() { return this.promo.tournament(); }

  @Get('vip') vip(@CurrentUser() u: any) { return this.promo.vip(u.sub); }
}
