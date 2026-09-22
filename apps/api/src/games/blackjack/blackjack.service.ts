import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { LiveGateway } from '../../live/live.gateway';
import { PromoService } from '../../promo/promo.service';
import { generateServerSeed, hashServerSeed } from '../../rng';
import { Card, getDeck, handValue, isBlackjack } from './cards';

const MIN_BET = 0.1;
const MAX_BET = 500;

type HandStatus = 'playing' | 'stood' | 'bust';
type OutcomeResult = 'win' | 'lose' | 'push' | 'blackjack' | 'bust';

interface Hand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  doubled: boolean;
}

interface BJState {
  dealerCards: Card[];
  hands: Hand[];
  currentHandIndex: number;
  deckCursor: number;
  phase: 'player_turn' | 'settled';
  totalStaked: number;
  outcomes?: { result: OutcomeResult; payout: number }[];
  dealerFinal?: number;
}

@Injectable()
export class BlackjackService {
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

  // ─────────────────── START ───────────────────
  async start(userId: string, bet: number) {
    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      throw new BadRequestException('BAD_BET');
    }

    // Auto-settle any stale game (>5 min old — user closed the tab)
    const stale = await this.prisma.gameRound.findMany({
      where: { userId, settledAt: null, game: { slug: 'aurora-blackjack' } },
    });
    for (const s of stale) {
      const age = Date.now() - s.createdAt.getTime();
      if (age > 5 * 60 * 1000) {
        await this.forceSettleStale(s.id);
      }
    }

    // Reject only if a truly live game exists
    const existing = await this.prisma.gameRound.findFirst({
      where: {
        userId,
        settledAt: null,
        game: { slug: 'aurora-blackjack' },
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (existing) throw new BadRequestException('GAME_IN_PROGRESS');

    const game = await this.prisma.game.findUniqueOrThrow({ where: { slug: 'aurora-blackjack' } });
    const seed = await this.ensureSeed(userId);
    const deck = getDeck(seed.serverSeed, seed.clientSeed, seed.nonce);

    // Deal: player, dealer, player, dealer(hole)
    const playerCards: Card[] = [deck[0], deck[2]];
    const dealerCards: Card[] = [deck[1], deck[3]];
    let cursor = 4;

    const debit = await this.wallet.applyEntry({
      userId,
      type: 'BET_DEBIT',
      delta: -bet,
      refType: 'blackjack',
      reason: 'Blackjack bet',
    });

    const state: BJState = {
      dealerCards,
      hands: [{ cards: playerCards, bet, status: 'playing', doubled: false }],
      currentHandIndex: 0,
      deckCursor: cursor,
      phase: 'player_turn',
      totalStaked: bet,
    };

    const round = await this.prisma.gameRound.create({
      data: {
        gameId: game.id,
        userId,
        serverSeed: seed.serverSeed,
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
        result: state as any,
        totalBet: bet,
        totalWin: 0,
        wageredForRewards: bet,
        settledAt: null,
        bets: {
          create: [{
            userId, betType: 'blackjack', betValue: { bet } as any,
            amount: bet, payout: 0, won: false,
          }],
        },
      },
    });

    await this.prisma.fairnessSeed.update({
      where: { id: seed.id },
      data: { nonce: seed.nonce + 1 },
    });

    // Immediate blackjack check
    const playerBJ = isBlackjack(playerCards);
    const dealerBJ = isBlackjack(dealerCards);

    if (playerBJ || dealerBJ) {
      return this.settle(userId, round.id, state, seed, debit.balance);
    }

    return this.publicState(round.id, state, debit.balance, true);
  }

  // ─────────────────── ACTION ───────────────────
  async action(userId: string, gameId: string, act: 'hit' | 'stand' | 'double' | 'split') {
    const round = await this.prisma.gameRound.findUnique({ where: { id: gameId } });
    if (!round) throw new NotFoundException('NOT_FOUND');
    if (round.userId !== userId) throw new ForbiddenException('NOT_YOURS');
    if (round.settledAt) throw new BadRequestException('ALREADY_SETTLED');

    const state = round.result as unknown as BJState;
    if (state.phase !== 'player_turn') throw new BadRequestException('NOT_PLAYER_TURN');

    const hand = state.hands[state.currentHandIndex];
    if (!hand || hand.status !== 'playing') throw new BadRequestException('NO_ACTIVE_HAND');

    const deck = getDeck(round.serverSeed, round.clientSeed, round.nonce);
    const walletRow = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    let balanceNow = Number(walletRow.balance);

    // ── HIT ──
    if (act === 'hit') {
      hand.cards.push(deck[state.deckCursor++]);
      const v = handValue(hand.cards);
      if (v.total > 21) hand.status = 'bust';
      else if (v.total === 21) hand.status = 'stood'; // auto-stand on 21
      return this.advanceOrSettle(userId, round.id, state, round, balanceNow);
    }

    // ── STAND ──
    if (act === 'stand') {
      hand.status = 'stood';
      return this.advanceOrSettle(userId, round.id, state, round, balanceNow);
    }

    // ── DOUBLE ──
    if (act === 'double') {
      if (hand.cards.length !== 2 || hand.doubled) {
        throw new BadRequestException('CANNOT_DOUBLE');
      }
      if (balanceNow < hand.bet) throw new BadRequestException('INSUFFICIENT_FUNDS');

      const debit = await this.wallet.applyEntry({
        userId, type: 'BET_DEBIT', delta: -hand.bet,
        refType: 'blackjack', refId: round.id, reason: 'Blackjack double',
      });
      balanceNow = debit.balance;

      hand.bet *= 2;
      hand.doubled = true;
      state.totalStaked += hand.bet / 2;

      // draw exactly one
      hand.cards.push(deck[state.deckCursor++]);
      const v = handValue(hand.cards);
      hand.status = v.total > 21 ? 'bust' : 'stood';

      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: { totalBet: { increment: new Decimal(hand.bet / 2) } },
      });

      return this.advanceOrSettle(userId, round.id, state, round, balanceNow);
    }

    // ── SPLIT ──
    if (act === 'split') {
      if (hand.cards.length !== 2) throw new BadRequestException('CANNOT_SPLIT');
      if (state.hands.length >= 2) throw new BadRequestException('SPLIT_LIMIT');
      if (hand.cards[0].r !== hand.cards[1].r) throw new BadRequestException('SPLIT_NOT_PAIR');
      if (hand.doubled) throw new BadRequestException('SPLIT_AFTER_DOUBLE');
      if (balanceNow < hand.bet) throw new BadRequestException('INSUFFICIENT_FUNDS');

      const debit = await this.wallet.applyEntry({
        userId, type: 'BET_DEBIT', delta: -hand.bet,
        refType: 'blackjack', refId: round.id, reason: 'Blackjack split',
      });
      balanceNow = debit.balance;

      const [c1, c2] = hand.cards;
      const bet = hand.bet;
      const newHands: Hand[] = [
        { cards: [c1], bet, status: 'playing', doubled: false },
        { cards: [c2], bet, status: 'playing', doubled: false },
      ];
      newHands[0].cards.push(deck[state.deckCursor++]);
      newHands[1].cards.push(deck[state.deckCursor++]);

      // auto-stand if 21
      for (const h of newHands) {
        if (handValue(h.cards).total === 21) h.status = 'stood';
      }

      state.hands = newHands;
      state.currentHandIndex = 0;
      state.totalStaked += bet;

      await this.prisma.gameRound.update({
        where: { id: round.id },
        data: { totalBet: { increment: new Decimal(bet) } },
      });

      return this.advanceOrSettle(userId, round.id, state, round, balanceNow);
    }

    throw new BadRequestException('UNKNOWN_ACTION');
  }

  // ─────────────────── ADVANCE / SETTLE ───────────────────
  private async advanceOrSettle(userId: string, roundId: string, state: BJState, round: any, balance: number) {
    const idx = state.hands.findIndex((h) => h.status === 'playing');
    if (idx !== -1) {
      state.currentHandIndex = idx;
      await this.prisma.gameRound.update({
        where: { id: roundId },
        data: { result: state as any },
      });
      return this.publicState(roundId, state, balance, false);
    }
    // All hands done → dealer plays
    return this.dealerPlay(userId, roundId, state, round, balance);
  }

  private async dealerPlay(userId: string, roundId: string, state: BJState, round: any, balance: number) {
    const deck = getDeck(round.serverSeed, round.clientSeed, round.nonce);

    // Any non-bust hand? If all bust, skip dealer draws (standard rule: dealer doesn't play if all bust)
    const anyLive = state.hands.some((h) => h.status !== 'bust');

    if (anyLive) {
      while (handValue(state.dealerCards).total < 17) {
        state.dealerCards.push(deck[state.deckCursor++]);
      }
    }

    return this.settle(userId, roundId, state, { serverSeed: round.serverSeed, clientSeed: round.clientSeed, nonce: round.nonce }, balance);
  }

  private async settle(
    userId: string,
    roundId: string,
    state: BJState,
    seed: { serverSeed: string; clientSeed: string; nonce: number },
    balanceBefore: number,
  ) {
    const dealerValue = handValue(state.dealerCards).total;
    const dealerBJ = isBlackjack(state.dealerCards);

    let totalPayout = 0;
    const outcomes: { result: OutcomeResult; payout: number }[] = [];

    for (const hand of state.hands) {
      const pv = handValue(hand.cards).total;
      const playerBJ = isBlackjack(hand.cards);

      let result: OutcomeResult;
      let payout: number;

      if (hand.status === 'bust') {
        result = 'bust'; payout = 0;
      } else if (playerBJ && dealerBJ) {
        result = 'push'; payout = hand.bet;
      } else if (playerBJ) {
        result = 'blackjack'; payout = Number((hand.bet * 2.5).toFixed(4));
      } else if (dealerBJ) {
        result = 'lose'; payout = 0;
      } else if (dealerValue > 21) {
        result = 'win'; payout = hand.bet * 2;
      } else if (pv > dealerValue) {
        result = 'win'; payout = hand.bet * 2;
      } else if (pv === dealerValue) {
        result = 'push'; payout = hand.bet;
      } else {
        result = 'lose'; payout = 0;
      }

      outcomes.push({ result, payout: Number(payout.toFixed(4)) });
      totalPayout += payout;
    }
    totalPayout = Number(totalPayout.toFixed(4));

    state.phase = 'settled';
    state.outcomes = outcomes;
    state.dealerFinal = dealerValue;

    const roundBefore = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    const totalStaked = Number(roundBefore.totalBet);

    await this.prisma.gameRound.update({
      where: { id: roundId },
      data: {
        result: state as any,
        totalWin: totalPayout,
        settledAt: new Date(),
      },
    });

    // Update bet record
    await this.prisma.bet.updateMany({
      where: { roundId },
      data: {
        payout: totalPayout,
        won: totalPayout > totalStaked,
      },
    });

    // Credit payout
    let finalBalance = balanceBefore;
    if (totalPayout > 0) {
      const credit = await this.wallet.applyEntry({
        userId,
        type: 'BET_WIN',
        delta: totalPayout,
        refType: 'gameRound',
        refId: roundId,
        reason: 'Blackjack payout',
      });
      finalBalance = credit.balance;
    }

    // Promo tracking
    const netProfit = totalPayout - totalStaked;
    try {
      await this.promo.trackBet(userId, totalStaked, netProfit > 0, netProfit);
    } catch { /* ignore */ }

    // Live feed for big wins
    if (totalPayout >= totalStaked * 2) {
      try {
        const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
        await this.prisma.liveWin.create({
          data: { username: u.username, gameSlug: 'aurora-blackjack', amount: totalPayout },
        });
        this.live.broadcastWin({ username: u.username, gameSlug: 'aurora-blackjack', amount: totalPayout });
      } catch { /* ignore */ }
    }

    return this.publicState(roundId, state, finalBalance, false);
  }

  // ─────────────────── STALE AUTO-SETTLE ───────────────────
  // User closed tab mid-game. Dealer plays out, hands settled as-is.
  private async forceSettleStale(roundId: string) {
    const round = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    if (round.settledAt) return;
    const state = round.result as unknown as BJState;
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId: round.userId! } });
    await this.settle(
      round.userId!,
      round.id,
      state,
      { serverSeed: round.serverSeed, clientSeed: round.clientSeed, nonce: round.nonce },
      Number(w.balance),
    );
  }

  // ─────────────────── STATE ───────────────────
  async getState(userId: string, gameId: string) {
    const round = await this.prisma.gameRound.findUnique({ where: { id: gameId } });
    if (!round) throw new NotFoundException('NOT_FOUND');
    if (round.userId !== userId) throw new ForbiddenException('NOT_YOURS');
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const state = round.result as unknown as BJState;
    return this.publicState(gameId, state, Number(w.balance), false);
  }

  async getCurrent(userId: string) {
    const round = await this.prisma.gameRound.findFirst({
      where: { userId, settledAt: null, game: { slug: 'aurora-blackjack' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!round) return null;
    const w = await this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
    const state = round.result as unknown as BJState;
    return this.publicState(round.id, state, Number(w.balance), false);
  }

  async history(userId: string, limit = 20) {
    const rows = await this.prisma.gameRound.findMany({
      where: { userId, game: { slug: 'aurora-blackjack' }, settledAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
    return rows.map((r) => {
      const s = r.result as unknown as BJState;
      return {
        id: r.id,
        bet: Number(r.totalBet),
        payout: Number(r.totalWin),
        netProfit: Number(r.totalWin) - Number(r.totalBet),
        outcomes: s.outcomes ?? [],
        dealerFinal: s.dealerFinal ?? null,
        createdAt: r.createdAt,
      };
    });
  }

  // ─────────────────── Public state serializer ───────────────────
  private publicState(gameId: string, state: BJState, balance: number, hideHole: boolean) {
    const isTurn = state.phase === 'player_turn';
    const dealerCards = isTurn && hideHole ? [state.dealerCards[0]] : state.dealerCards;
    const dealerValue = isTurn ? handValue([state.dealerCards[0]]).total : (state.dealerFinal ?? handValue(state.dealerCards).total);

    const curHand = state.hands[state.currentHandIndex];
    const canAct = isTurn && curHand?.status === 'playing';

    const canDouble = canAct && curHand.cards.length === 2 && !curHand.doubled;
    const canSplit =
      canAct &&
      curHand.cards.length === 2 &&
      state.hands.length === 1 &&
      curHand.cards[0].r === curHand.cards[1].r;

    return {
      gameId,
      phase: state.phase,
      balance,
      totalStaked: state.totalStaked,
      dealerCards,
      dealerValue,
      hands: state.hands.map((h) => ({
        cards: h.cards,
        bet: h.bet,
        status: h.status,
        value: handValue(h.cards).total,
        isBlackjack: isBlackjack(h.cards),
        doubled: h.doubled,
      })),
      currentHandIndex: state.currentHandIndex,
      canHit: canAct,
      canStand: canAct,
      canDouble,
      canSplit,
      outcomes: state.outcomes ?? null,
      payout: state.outcomes ? state.outcomes.reduce((a, o) => a + o.payout, 0) : 0,
      netProfit: state.outcomes
        ? state.outcomes.reduce((a, o) => a + o.payout, 0) - state.totalStaked
        : 0,
    };
  }
}
