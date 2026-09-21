import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsString, Max, Min } from 'class-validator';
import { CrashService } from './crash.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class StartDto {
  @IsNumber() @Min(0.1) @Max(500) bet!: number;
}
class RoundIdDto {
  @IsString() roundId!: string;
}

@Controller('games/crash')
@UseGuards(JwtGuard)
export class CrashController {
  constructor(private crash: CrashService) {}

  @Post('start')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  start(@CurrentUser() u: any, @Body() dto: StartDto) {
    return this.crash.start(u.sub, dto.bet);
  }

  @Get('state')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  state(@CurrentUser() u: any) {
    return this.crash.state(u.sub);
  }

  @Post('cashout')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  cashout(@CurrentUser() u: any, @Body() dto: RoundIdDto) {
    return this.crash.cashout(u.sub, dto.roundId);
  }

  @Post('crash-out')
  crashOut(@CurrentUser() u: any, @Body() dto: RoundIdDto) {
    return this.crash.crashOut(u.sub, dto.roundId);
  }

  @Get('history')
  history(@CurrentUser() u: any) {
    return this.crash.history(u.sub, 20);
  }
}
