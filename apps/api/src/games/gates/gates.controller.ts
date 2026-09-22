import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, Max, Min } from 'class-validator';
import { GatesService } from './gates.service';
import { JwtGuard } from '../../common/jwt.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class SpinDto {
  @IsNumber() @Min(0.1) @Max(500) bet!: number;
}

@Controller('games/gates')
@UseGuards(JwtGuard)
export class GatesController {
  constructor(private gates: GatesService) {}

  @Post('spin')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  spin(@CurrentUser() u: any, @Body() dto: SpinDto) {
    return this.gates.spin(u.sub, dto.bet);
  }

  @Get('history')
  history(@CurrentUser() u: any) {
    return this.gates.history(u.sub, 20);
  }
}
