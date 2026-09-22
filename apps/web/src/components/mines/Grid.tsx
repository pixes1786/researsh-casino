'use client';
import { Cell, CellState } from './Cell';

export function Grid({
  revealed,
  minePositions,
  phase,
  onReveal,
  disabled,
  multipliersByPick,
}: {
  revealed: number[];
  minePositions: number[] | null;
  phase: 'playing' | 'busted' | 'cashed';
  onReveal: (i: number) => void;
  disabled: boolean;
  multipliersByPick: number[];
}) {
  const isRevealAll = phase !== 'playing';
  const mineSet = new Set(minePositions ?? []);

  return (
    <div className="grid grid-cols-5 gap-2 md:gap-3">
      {Array.from({ length: 25 }, (_, i) => {
        let state: CellState = 'hidden';
        let mult: number | undefined;

        if (phase === 'playing') {
          if (revealed.includes(i)) {
            state = 'safe';
            const idx = revealed.indexOf(i);
            mult = multipliersByPick[idx];
          }
        } else {
          // Game settled — show all
          if (revealed.includes(i)) {
            state = 'safe';
            const idx = revealed.indexOf(i);
            mult = multipliersByPick[idx];
          } else if (phase === 'busted' && mineSet.has(i)) {
            // Was a mine. If it's the one user clicked — show as exploded
            const isClickedMine = revealed.includes(i);
            state = isClickedMine ? 'mine-revealed' : 'mine';
          }
        }

        // Special case: busted — we need to show the mine user clicked
        if (phase === 'busted' && revealed.includes(i) && mineSet.has(i)) {
          state = 'mine-revealed';
        }

        return (
          <Cell
            key={i}
            state={state}
            multiplier={mult}
            onClick={() => onReveal(i)}
            disabled={disabled || phase !== 'playing' || revealed.includes(i)}
            revealAll={isRevealAll}
            isMineOriginal={mineSet.has(i)}
          />
        );
      })}
    </div>
  );
}
