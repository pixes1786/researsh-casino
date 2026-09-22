'use client';
import { motion } from 'framer-motion';

export function Symbol({
  symbol,
  highlighted = false,
  multiplier,
  disappearing = false,
  dropping = false,
  size = 'md',
}: {
  symbol: string;
  highlighted?: boolean;
  multiplier?: number;
  disappearing?: boolean;
  dropping?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'text-2xl md:text-3xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-5xl',
  };

  return (
    <motion.div
      layout
      initial={
        dropping
          ? { y: -100, opacity: 0, scale: 0.7 }
          : { opacity: 0, scale: 0.6 }
      }
      animate={
        disappearing
          ? { opacity: 0, scale: 1.4, filter: 'brightness(2)' }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        opacity: { duration: disappearing ? 0.3 : 0.2 },
      }}
      exit={{ opacity: 0, scale: 0.5 }}
      className={`relative aspect-square rounded-lg grid place-items-center select-none
        bg-gradient-to-br from-[#1a1a2e] via-[#2a1a3e] to-[#0a0a15]
        border-2 transition-colors
        ${highlighted
          ? 'border-gold shadow-[0_0_24px_rgba(245,197,66,0.9)]'
          : 'border-[#2e2e3d]'}
        ${sizes[size]}
      `}
    >
      <motion.span
        animate={highlighted ? { scale: [1, 1.15, 1] } : { scale: 1 }}
        transition={highlighted ? { duration: 0.5, repeat: Infinity, repeatType: 'loop' } : {}}
      >
        {symbol}
      </motion.span>

      {/* Zeus multiplier badge */}
      {multiplier != null && multiplier > 0 && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}
          className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-8 h-8 md:w-10 md:h-10 rounded-full
            grid place-items-center font-black text-[10px] md:text-xs text-black
            bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500
            border-2 border-white shadow-[0_0_20px_rgba(251,191,36,1)] z-10"
        >
          {multiplier}×
        </motion.div>
      )}
    </motion.div>
  );
}
