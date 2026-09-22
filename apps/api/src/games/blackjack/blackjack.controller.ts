import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator';
import { BlackjackService } from './blackjack.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class StartDto {
  @IsNumber() @Min(0.1) @Max(500) bet!: number;
}
class ActionDto {
  @IsString() gameId!: string;
  @IsIn(['hit', 'stand', 'double', 'split']) action!: 'hit' | 'stand' | 'double' | 'split';
}

@Controller('games/blackjack')
@UseGuards(JwtGuard)
export class BlackjackController {
  constructor(private bj: BlackjackService) {}

  @Post('start')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  start(@CurrentUser() u: any, @Body() dto: StartDto) {
    return this.bj.start(u.sub, dto.bet);
  }

  @Post('action')
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  action(@CurrentUser() u: any, @Body() dto: ActionDto) {
    return this.bj.action(u.sub, dto.gameId, dto.action);
  }

  @Get('current')
  current(@CurrentUser() u: any) {
    return this.bj.getCurrent(u.sub);
  }

  @Get('history')
  history(@CurrentUser() u: any) {
    return this.bj.history(u.sub, 20);
  }

  @Get('state/:gameId')
  state(@CurrentUser() u: any, @Param('gameId') gameId: string) {
    return this.bj.getState(u.sub, gameId);
  }
}
