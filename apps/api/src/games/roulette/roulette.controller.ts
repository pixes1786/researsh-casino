import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsArray, IsNumber, IsObject, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RouletteService } from './roulette.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class BetItem {
  @IsObject() bet!: any;
  @IsNumber() @Min(0.1) amount!: number;
}
class PlaceBetDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => BetItem)
  bets!: BetItem[];
}
class ClientSeedDto {
  @IsString() clientSeed!: string;
}

@Controller('games/roulette')
@UseGuards(JwtGuard)
export class RouletteController {
  constructor(private roulette: RouletteService) {}

  @Get('seed') seed(@CurrentUser() u: any) { return this.roulette.getSeedStatus(u.sub); }

  @Post('seed/client') setClient(@CurrentUser() u: any, @Body() dto: ClientSeedDto) {
    return this.roulette.updateClientSeed(u.sub, dto.clientSeed);
  }

  @Post('seed/rotate') rotate(@CurrentUser() u: any) { return this.roulette.rotateSeed(u.sub); }

  @Post('bet')
  @Throttle({ default: { limit: 300, ttl: 60_000 } }) bet(@CurrentUser() u: any, @Body() dto: PlaceBetDto) {
    return this.roulette.placeBet(u.sub, dto.bets);
  }

  @Get('verify/:roundId') verify(@Param('roundId') roundId: string) {
    return this.roulette.verify(roundId);
  }
}
