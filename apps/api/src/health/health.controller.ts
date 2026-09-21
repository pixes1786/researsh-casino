import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
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
