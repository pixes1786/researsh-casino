import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator';
import { DiceService } from './dice.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class DiceBetDto {
  @IsNumber() @Min(0.1) @Max(99) target!: number;
  @IsIn(['under', 'over']) direction!: 'under' | 'over';
  @IsNumber() @Min(0.1) @Max(500) amount!: number;
}
class ClientSeedDto {
  @IsString() clientSeed!: string;
}

@Controller('games/dice')
@UseGuards(JwtGuard)
export class DiceController {
  constructor(private dice: DiceService) {}

  @Get('seed') seed(@CurrentUser() u: any) { return this.dice.getSeedStatus(u.sub); }

  @Post('seed/client') setClient(@CurrentUser() u: any, @Body() dto: ClientSeedDto) {
    return this.dice.updateClientSeed(u.sub, dto.clientSeed);
  }

  @Post('seed/rotate') rotate(@CurrentUser() u: any) { return this.dice.rotateSeed(u.sub); }

  @Post('bet')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  bet(@CurrentUser() u: any, @Body() dto: DiceBetDto) {
    return this.dice.placeBet(u.sub, dto);
  }

  @Get('verify/:roundId')
  verify(@Param('roundId') roundId: string) { return this.dice.verify(roundId); }
}
