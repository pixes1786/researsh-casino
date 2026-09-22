'use client';
import { motion } from 'framer-motion';
import { Symbol } from './Symbol';

const COLS = 6;
const ROWS = 5;

export function Grid({
  grid,
  highlighted = new Set<number>(),
  multipliers = new Map<number, number>(),
  disappearing = new Set<number>(),
  dropping = false,
  size = 'md',
}: {
  grid: string[];
  highlighted?: Set<number>;
  multipliers?: Map<number, number>;
  disappearing?: Set<number>;
  dropping?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div
      className="grid gap-1 md:gap-1.5 w-full"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: COLS * ROWS }, (_, i) => (
        <Symbol
          key={`${i}-${grid[i]}`}
          symbol={grid[i] ?? '⚡'}
          highlighted={highlighted.has(i)}
          multiplier={multipliers.get(i)}
          disappearing={disappearing.has(i)}
          dropping={dropping}
          size={size}
        />
      ))}
    </div>
  );
}
