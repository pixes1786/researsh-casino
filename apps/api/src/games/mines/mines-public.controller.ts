import { Controller, Get, Param } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MinesService } from './mines.service';

@Controller('games/mines')
@SkipThrottle()
export class MinesPublicController {
  constructor(private mines: MinesService) {}

  @Get('paytable/:mines')
  paytable(@Param('mines') mines: string) {
    return this.mines.paytable(parseInt(mines, 10));
  }
}
