export const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const BLACK = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);
// 0 и 37 (=«00») — зелёные

export type BetType =
  | { kind: 'straight'; number: number }        // 0..36, 37 = 00
  | { kind: 'split'; numbers: number[] }
  | { kind: 'street'; numbers: number[] }
  | { kind: 'corner'; numbers: number[] }
  | { kind: 'line'; numbers: number[] }
  | { kind: 'column'; column: 1 | 2 | 3 }
  | { kind: 'dozen'; dozen: 1 | 2 | 3 }
  | { kind: 'red' } | { kind: 'black' }
  | { kind: 'odd' } | { kind: 'even' }
  | { kind: 'low' } | { kind: 'high' };

export function payoutMultiplier(bet: BetType, outcome: number): number {
  // 0 и 00 закрывают только свой straight
  if (outcome === 0 || outcome === 37) {
    if (bet.kind === 'straight' && bet.number === outcome) return 36;
    return 0;
  }
  switch (bet.kind) {
    case 'straight': return bet.number === outcome ? 36 : 0;
    case 'split':    return bet.numbers.includes(outcome) ? 18 : 0;
    case 'street':   return bet.numbers.includes(outcome) ? 12 : 0;
    case 'corner':   return bet.numbers.includes(outcome) ? 9 : 0;
    case 'line':     return bet.numbers.includes(outcome) ? 6 : 0;
    case 'column':   return Math.ceil(outcome / 12) === bet.column ? 3 : 0;
    case 'dozen': {
      const d = outcome <= 12 ? 1 : outcome <= 24 ? 2 : 3;
      return d === bet.dozen ? 3 : 0;
    }
    case 'red':   return RED.has(outcome) ? 2 : 0;
    case 'black': return BLACK.has(outcome) ? 2 : 0;
    case 'odd':   return outcome % 2 === 1 ? 2 : 0;
    case 'even':  return outcome % 2 === 0 ? 2 : 0;
    case 'low':   return outcome >= 1 && outcome <= 18 ? 2 : 0;
    case 'high':  return outcome >= 19 && outcome <= 36 ? 2 : 0;
  }
}


/**
 * Anti-abuse: risky portion of a bet set.
 * Complementary pairs cancel each other (red+black, odd+even, low+high,
 * all 3 dozens equal, all 3 columns equal).
 * Only the *residual* directional exposure counts toward rewards.
 */
export function riskyWager(bets: { bet: BetType; amount: number }[]): number {
  let total = 0;
  const byKind: Record<string, number> = {};
  const byDozen: Record<string, number> = {};
  const byColumn: Record<string, number> = {};

  for (const b of bets) {
    total += b.amount;
    const k = b.bet.kind;
    if (k === 'dozen') byDozen[(b.bet as any).dozen] = (byDozen[(b.bet as any).dozen] ?? 0) + b.amount;
    else if (k === 'column') byColumn[(b.bet as any).column] = (byColumn[(b.bet as any).column] ?? 0) + b.amount;
    else byKind[k] = (byKind[k] ?? 0) + b.amount;
  }

  let cancelled = 0;

  // Complementary even-money pairs (each pays 2:1 → cancel 2×min)
  const pairs: [string, string][] = [
    ['red', 'black'],
    ['odd', 'even'],
    ['low', 'high'],
  ];
  for (const [a, b] of pairs) {
    const av = byKind[a] ?? 0;
    const bv = byKind[b] ?? 0;
    cancelled += 2 * Math.min(av, bv);
  }

  // All 3 dozens (each pays 3:1 → cancel 3×min)
  const d1 = byDozen['1'] ?? 0, d2 = byDozen['2'] ?? 0, d3 = byDozen['3'] ?? 0;
  if (d1 && d2 && d3) cancelled += 3 * Math.min(d1, d2, d3);

  // All 3 columns
  const c1 = byColumn['1'] ?? 0, c2 = byColumn['2'] ?? 0, c3 = byColumn['3'] ?? 0;
  if (c1 && c2 && c3) cancelled += 3 * Math.min(c1, c2, c3);

  return Math.max(0, total - cancelled);
}
