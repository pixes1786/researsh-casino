import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

// /health is hit by Render's healthcheck every 30s.
// Skip throttler entirely — it's read-only, no rate limit needed,
// and this saves ~90% of our Redis commands.
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const checks: Record<string, string> = {};
    let ok = true;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch (e) {
      checks.db = `fail: ${(e as Error).message.slice(0, 80)}`;
      ok = false;
    }

    return {
      status: ok ? 'ok' : 'degraded',
      ts: new Date().toISOString(),
      checks,
    };
  }
}
