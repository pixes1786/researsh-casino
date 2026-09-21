import { createHmac, randomBytes, createHash } from 'node:crypto';

export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}
export function hashServerSeed(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex');
}
export function floatAt(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const msg = `${clientSeed}:${nonce}:${cursor}`;
  const digest = createHmac('sha256', serverSeed).update(msg).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}
export function intBelow(serverSeed: string, clientSeed: string, nonce: number, max: number, startCursor = 0) {
  if (max <= 0) throw new Error('max must be > 0');
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  let cursor = startCursor;
  while (true) {
    const msg = `${clientSeed}:${nonce}:${cursor}`;
    const digest = createHmac('sha256', serverSeed).update(msg).digest();
    const int = digest.readUInt32BE(0);
    if (int < limit) return { value: int % max, cursor: cursor + 1 };
    cursor++;
  }
}
export function spinRoulette(serverSeed: string, clientSeed: string, nonce: number) {
  const { value, cursor } = intBelow(serverSeed, clientSeed, nonce, 38);
  return { outcome: value, cursor };
}
