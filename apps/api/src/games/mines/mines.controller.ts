import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';
import { MinesService } from './mines.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class StartDto {
  @IsNumber() @Min(0.1) @Max(500) bet!: number;
  @IsInt() @Min(1) @Max(24) minesCount!: number;
}
class RevealDto {
  @IsString() gameId!: string;
  @IsInt() @Min(0) @Max(24) position!: number;
}
class CashoutDto {
  @IsString() gameId!: string;
}

@Controller('games/mines')
@UseGuards(JwtGuard)
export class MinesController {
  constructor(private mines: MinesService) {}

  @Post('start')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  start(@CurrentUser() u: any, @Body() dto: StartDto) {
    return this.mines.start(u.sub, dto.bet, dto.minesCount);
  }

  @Post('reveal')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  reveal(@CurrentUser() u: any, @Body() dto: RevealDto) {
    return this.mines.reveal(u.sub, dto.gameId, dto.position);
  }

  @Post('cashout')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  cashout(@CurrentUser() u: any, @Body() dto: CashoutDto) {
    return this.mines.cashout(u.sub, dto.gameId);
  }

  @Get('current')
  current(@CurrentUser() u: any) {
    return this.mines.getCurrent(u.sub);
  }

  @Get('history')
  history(@CurrentUser() u: any) {
    return this.mines.history(u.sub, 20);
  }

  @Get('paytable/:mines')
  paytable(@Param('mines') mines: string) {
    return this.mines.paytable(parseInt(mines, 10));
  }
}
