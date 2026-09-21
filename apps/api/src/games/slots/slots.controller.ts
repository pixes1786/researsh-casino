import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsString, Max, Min } from 'class-validator';
import { SlotsService } from './slots.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class SpinDto {
  @IsNumber() @Min(0.1) @Max(500) bet!: number;
}
class ClientSeedDto {
  @IsString() clientSeed!: string;
}

@Controller('games/slots')
@UseGuards(JwtGuard)
export class SlotsController {
  constructor(private slots: SlotsService) {}

  @Get('paytable')
  paytable() { return this.slots.paytable(); }

  @Get('seed') seed(@CurrentUser() u: any) { return this.slots.getSeedStatus(u.sub); }

  @Post('seed/client') setClient(@CurrentUser() u: any, @Body() dto: ClientSeedDto) {
    return this.slots.updateClientSeed(u.sub, dto.clientSeed);
  }

  @Post('seed/rotate') rotate(@CurrentUser() u: any) { return this.slots.rotateSeed(u.sub); }

  @Post('spin')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  spin(@CurrentUser() u: any, @Body() dto: SpinDto) {
    return this.slots.spin(u.sub, dto.bet);
  }

  @Get('verify/:roundId')
  verify(@Param('roundId') roundId: string) { return this.slots.verify(roundId); }
}
