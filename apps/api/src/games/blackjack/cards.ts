import { floatAt } from '../../rng';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { s: Suit; r: Rank; }

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ s, r });
  return d;
}

/** Deterministic 52-card deck from HMAC stream — Fisher-Yates. */
export function getDeck(serverSeed: string, clientSeed: string, nonce: number): Card[] {
  const rand: number[] = [];
  for (let i = 0; i < 52; i++) {
    rand.push(floatAt(serverSeed, clientSeed, nonce, i));
  }
  const d = makeDeck();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand[i] * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function cardValue(c: Card): number {
  if (c.r === 'A') return 11;
  if (c.r === 'J' || c.r === 'Q' || c.r === 'K') return 10;
  return parseInt(c.r, 10);
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 'A') { aces++; total += 11; }
    else total += cardValue(c);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}
