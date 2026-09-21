import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MeService } from './me.service';
import { JwtGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('me')
@UseGuards(JwtGuard)
export class MeController {
  constructor(private me: MeService) {}

  @Get('profile') profile(@CurrentUser() u: any) { return this.me.profile(u.sub); }

  @Get('bets')
  bets(@CurrentUser() u: any, @Query('limit') limit?: string) {
    return this.me.bets(u.sub, limit ? Math.min(+limit, 200) : 50);
  }

  @Get('rounds')
  rounds(@CurrentUser() u: any, @Query('limit') limit?: string) {
    return this.me.rounds(u.sub, limit ? Math.min(+limit, 200) : 30);
  }

  @Get('sessions') sessions(@CurrentUser() u: any) { return this.me.sessions(u.sub); }
}
