'use client';
import { motion, AnimatePresence } from 'framer-motion';

export function MultiplierOverlay({
  visible,
  value,
}: {
  visible: boolean;
  value: number;
}) {
  return (
    <AnimatePresence>
      {visible && value > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="absolute inset-0 grid place-items-center pointer-events-none z-20"
        >
          <div className="text-center">
            <div className="text-[10px] md:text-xs uppercase tracking-widest text-gold mb-1">
              Zeus Multiplier
            </div>
            <div className="text-5xl md:text-7xl font-black bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(245,197,66,0.9)]">
              {value}×
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
