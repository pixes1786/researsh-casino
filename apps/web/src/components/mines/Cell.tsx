'use client';
import { motion } from 'framer-motion';

export type CellState = 'hidden' | 'safe' | 'mine' | 'mine-revealed';

export function Cell({
  state,
  multiplier,
  onClick,
  disabled,
  revealAll,
  isMineOriginal,
}: {
  state: CellState;
  multiplier?: number;
  onClick?: () => void;
  disabled?: boolean;
  revealAll?: boolean;
  isMineOriginal?: boolean;
}) {
  // Если revealAll=true и клетка была миной, но не была открыта пользователем — показываем тускло
  const isRevealedMine = state === 'mine-revealed';
  const isDimMine = revealAll && isMineOriginal && state === 'hidden';

  const base = 'aspect-square rounded-lg flex items-center justify-center font-black select-none relative overflow-hidden';

  if (state === 'safe') {
    return (
      <motion.div
        initial={{ scale: 0.8, rotateY: -90 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`${base} bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]`}
      >
        <span className="text-2xl md:text-3xl">💎</span>
        {multiplier && (
          <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-white/80">
            {multiplier.toFixed(2)}×
          </span>
        )}
      </motion.div>
    );
  }

  if (state === 'mine-revealed') {
    return (
      <motion.div
        initial={{ scale: 1.4, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12 }}
        className={`${base} bg-gradient-to-br from-red-500 to-red-800 border-2 border-red-300 shadow-[0_0_30px_rgba(239,68,68,0.8)]`}
      >
        <span className="text-2xl md:text-3xl">💥</span>
      </motion.div>
    );
  }

  if (state === 'mine') {
    return (
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className={`${base} bg-gradient-to-br from-red-400/40 to-red-700/40 border-2 border-red-500/40`}
      >
        <span className="text-xl md:text-2xl opacity-60">💣</span>
      </motion.div>
    );
  }

  // hidden
  if (isDimMine && revealAll) {
    return (
      <div className={`${base} bg-red-950/30 border border-red-900/40`}>
        <span className="text-xl md:text-2xl opacity-40">💣</span>
      </div>
    );
  }

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.05, borderColor: '#a855f7' }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`${base} bg-gradient-to-br from-[#2a2a38] to-[#15151d] border-2 border-[#2e2e3d] hover:border-neon disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer transition`}
    >
      <span className="text-xl md:text-2xl opacity-0 hover:opacity-20 transition">💎</span>
    </motion.button>
  );
}
