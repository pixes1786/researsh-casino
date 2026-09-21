import { Controller, Get, Param, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GamesService } from './games.service';

@Controller('games')
@SkipThrottle()
export class GamesController {
  constructor(private games: GamesService) {}

  @Get() list(@Query('category') c?: string, @Query('search') s?: string) {
    return this.games.list({ category: c, search: s });
  }

  @Get('live-feed') feed() { return this.games.recentWins(); }

  @Get(':slug') bySlug(@Param('slug') slug: string) { return this.games.bySlug(slug); }
}
