import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { generateServerSeed, hashServerSeed, floatAt } from '../../rng';

const MIN_BET = 0.1;
const MAX_BET = 500;
const HOUSE_EDGE = 0.01;
const ROUND_TIMEOUT_MS = 60_000;
const GROWTH_RATE = 0.092; // multiplier(t) = exp(t_sec * rate)

@Injectable()
export class CrashService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
    private live: LiveGateway,
    private promo: PromoService,
  ) {}

  private async ensureSeed(userId: string) {
    let seed = await this.prisma.fairnessSeed.findFirst({
      where: { userId, revealedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!seed) {
      const serverSeed = generateServerSeed();
      seed = await this.prisma.fairnessSeed.create({
        data: {
          userId,
          serverSeed,
          serverSeedHash: hashServerSeed(serverSeed),
          clientSeed: 'default-client-seed',
        },
      });
    }
    return seed;
  }

  private crashPointFromFloat(u: number): number {
    const raw = (1 - HOUSE_EDGE) / (1 - Math.min(u, 0.999999));
    const clamped = Math.max(1.0, raw);
    return Math.floor(clamped * 100) / 100;
  }

  private multiplierAt(elapsedMs: number): number {
    return Math.exp((elapsedMs / 1000) * GROWTH_RATE);
  }

  private crashDurationMs(crashPoint: number): number {
    return Math.round((Math.log(crashPoint) / GROWTH_RATE) * 1000);
  }

  // ─── start ───
  async start(userId: string, bet: number) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException('BAD_BET');
    }

    // auto-settle any stale pending round
    const stale = await this.prisma.gameRound.findMany({
      where: { userId, settledAt: null, game: { slug: 'crash-x' } },
    });
    for (const s of stale) {
      const age = Date.now() - s.createdAt.getTime();
      if (age > ROUND_TIMEOUT_MS) {
        const res: any = s.result;
        await this.settleLossInternal(s.id, Number(s.totalBet), Number(res.crashPoint), 'STALE');
      }
    }
    const live = await this.prisma.gameRound.findFirst({
      where: {
        userId,
        settledAt: null,
        game: { slug: 'crash-x' },
        createdAt: { gt: new Date(Date.now() - ROUND_TIMEOUT_MS) },
      },
    });
    if (live) throw new BadRequestException('ROUND_IN_PROGRESS');

    const game = await this.prisma.game.findUniqueOrThrow({ where: { slug: 'crash-x' } });
    const seed = await this.ensureSeed(userId);

    const debit = await this.wallet.applyEntry({
      userId,
      type: 'BET_DEBIT',
      delta: -bet,
      refType: 'crash',
      reason: 'Crash bet',
    });

    const u = floatAt(seed.serverSeed, seed.clientSeed, seed.nonce, 0);
    const crashPoint = this.crashPointFromFloat(u);

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        userId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        result: { crashPoint } as any, // never exposed to client
        totalBet: bet,
        totalWin: 0,
        wageredForRewards: bet,
        settledAt: null,
        bets: {
          create: [
            {
              userId,
              betType: 'crash',
              betValue: { bet } as any,
              amount: bet,
              payout: 0,
              won: false,
            },
          ],
        },
      },
    });

    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { nonce: seed.nonce + 1 },
    });

    // Schedule server-side auto-crash via LiveGateway broadcast.
    // No client code needs to know WHEN the crash happens.
    this.scheduleCrash(round.id, crashPoint, round.createdAt.getTime());

    return {
      roundId: round.id,
      startedAt: round.createdAt.toISOString(),
      bet,
      balance: debit.balance,
      serverSeedHash: seed.serverSeedHash,
    };
  }

  /** Broadcast crash event when elapsed reaches crash duration. */
  private scheduleCrash(roundId: string, crashPoint: number, startedAtMs: number) {
    const durationMs = this.crashDurationMs(crashPoint);
    const delay = Math.max(50, startedAtMs + durationMs - Date.now() + 50);
    setTimeout(() => {
      this.settleLossInternal(roundId, 0, crashPoint, 'CRASHED')
        .then(() => {
          this.live.broadcastCrash({ roundId, crashPoint });
        })
        .catch(() => { /* already settled */ });
    }, delay);
  }

  /** Client polling endpoint — state of current active round. */
  async state(userId: string) {
    const round = await this.prisma.gameRound.findFirst({
      where: { userId, game: { slug: 'crash-x' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!round) return { active: false };

    const res: any = round.result;

    if (round.settledAt) {
      return {
        active: false,
        roundId: round.id,
        outcome: res.outcome ?? null,
        crashPoint: Number(res.crashPoint),
        cashedAt: res.cashedAt ?? null,
        payout: Number(round.totalWin),
        bet: Number(round.totalBet),
      };
    }

    const crashPoint = Number(res.crashPoint);
    const elapsed = Date.now() - round.createdAt.getTime();
    const multiplier = this.multiplierAt(elapsed);

    if (multiplier >= crashPoint) {
      // settle now (idempotent)
      await this.settleLossInternal(round.id, Number(round.totalBet), crashPoint, 'CRASHED');
      return {
        active: false,
        roundId: round.id,
        outcome: 'LOSS',
        crashPoint,
        cashedAt: null,
        payout: 0,
        bet: Number(round.totalBet),
      };
    }

    return {
      active: true,
      roundId: round.id,
      multiplier: Number(multiplier.toFixed(4)),
      bet: Number(round.totalBet),
    };
  }

  // ─── cashout ───
  // SERVER-AUTHORITATIVE TIMING:
  // client only sends roundId; multiplier is computed here from server clock.
  // Client-side animation is display-only and cannot influence payout.
  async cashout(userId: string, roundId: string) {
    const round = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    if (round.userId !== userId) throw new BadRequestException('NOT_YOURS');
    if (round.settledAt) throw new BadRequestException('ALREADY_SETTLED');

    const res: any = round.result;
    const crashPoint = Number(res.crashPoint);
    const receivedAt = Date.now();
    const elapsed = receivedAt - round.createdAt.getTime();

    if (elapsed > ROUND_TIMEOUT_MS) {
      return this.settleLossInternal(round.id, Number(round.totalBet), crashPoint, 'TIMEOUT');
    }

    // compute multiplier server-side — client cannot fake this
    const atMultiplier = Number(this.multiplierAt(elapsed).toFixed(4));

    if (atMultiplier >= crashPoint) {
      // too late — the round has already crashed
      return this.settleLossInternal(round.id, Number(round.totalBet), crashPoint, 'ABOVE_CRASH');
    }

    const bet = Number(round.totalBet);
    const payout = Number((bet * atMultiplier).toFixed(4));
    const netProfit = payout - bet;

    await this.prisma.$transaction([
      this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          result: { crashPoint, cashedAt: atMultiplier, outcome: 'WIN' } as any,
          totalWin: payout,
          settledAt: new Date(),
        },
      }),
      this.prisma.bet.updateMany({
        where: { roundId: round.id },
        data: { payout, won: true },
      }),
    ]);

    const credit = await this.wallet.applyEntry({
      userId,
      type: 'BET_WIN',
      delta: payout,
      refType: 'gameRound',
      refId: round.id,
      reason: `Crash win @ ${atMultiplier.toFixed(2)}x`,
    });

    try {
      await this.promo.trackBet(userId, bet, netProfit > 0, netProfit);
    } catch { /* ignore */ }

    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.liveWin.create({
      data: { username: u.username, gameSlug: 'crash-x', amount: payout },
    });
    this.live.broadcastWin({ username: u.username, gameSlug: 'crash-x', amount: payout });

    return {
      roundId: round.id,
      won: true,
      crashPoint,
      cashedAt: atMultiplier,
      payout,
      netProfit,
      balance: credit.balance,
    };
  }

  private async settleLossInternal(
    roundId: string,
    betFallback: number,
    crashPoint: number,
    reason: string,
  ) {
    const round = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    if (round.settledAt) {
      return {
        roundId,
        won: false,
        crashPoint,
        cashedAt: null,
        payout: 0,
        netProfit: -Number(round.totalBet),
        balance: 0,
      };
    }
    const bet = Number(round.totalBet) || betFallback;

    await this.prisma.$transaction([
      this.prisma.gameRound.update({
        where: { id: round.id },
        data: {
          result: { crashPoint, outcome: 'LOSS', reason } as any,
          totalWin: 0,
          settledAt: new Date(),
        },
      }),
      this.prisma.bet.updateMany({
        where: { roundId: round.id },
        data: { payout: 0, won: false },
      }),
    ]);

    try {
      await this.promo.trackBet(round.userId!, bet, false, -bet);
    } catch { /* ignore */ }

    const wallet = await this.prisma.wallet.findUniqueOrThrow({
      where: { userId: round.userId! },
    });

    return {
      roundId: round.id,
      won: false,
      crashPoint,
      cashedAt: null,
      payout: 0,
      netProfit: -bet,
      balance: Number(wallet.balance),
      reason,
    };
  }

  /** Public — kept for backwards compat with /crash-out endpoint. */
  async crashOut(userId: string, roundId: string) {
    const round = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    if (round.userId !== userId) throw new BadRequestException('NOT_YOURS');
    if (round.settledAt) throw new BadRequestException('ALREADY_SETTLED');
    const res: any = round.result;
    return this.settleLossInternal(round.id, Number(round.totalBet), Number(res.crashPoint), 'CRASHED');
  }

  async history(userId: string, limit = 20) {
    const rows = await this.prisma.gameRound.findMany({
      where: { userId, game: { slug: 'crash-x' }, settledAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((r) => {
      const res: any = r.result;
      return {
        id: r.id,
        crashPoint: Number(res.crashPoint),
        cashedAt: res.cashedAt ?? null,
        outcome: res.outcome,
        bet: Number(r.totalBet),
        payout: Number(r.totalWin),
        createdAt: r.createdAt,
      };
    });
  }
}
