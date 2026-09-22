'use client';
import { motion } from 'framer-motion';

export interface CardType {
  s: '♠' | '♥' | '♦' | '♣';
  r: string;
}

export function Card({
  card,
  hidden = false,
  delay = 0,
  small = false,
}: {
  card?: CardType;
  hidden?: boolean;
  delay?: number;
  small?: boolean;
}) {
  const isRed = card?.s === '♥' || card?.s === '♦';
  const w = small ? 'w-14 h-20' : 'w-20 h-28 md:w-24 md:h-32';
  const text = small ? 'text-xl' : 'text-3xl md:text-4xl';
  const corner = small ? 'text-[10px]' : 'text-xs';

  if (hidden || !card) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, rotateY: -90 }}
        animate={{ opacity: 1, y: 0, rotateY: 0 }}
        transition={{ delay, duration: 0.3 }}
        className={`${w} rounded-lg border-2 border-blue-900 shadow-lg relative overflow-hidden`}
        style={{
          background:
            'repeating-linear-gradient(45deg, #1e3a8a, #1e3a8a 6px, #1e40af 6px, #1e40af 12px)',
        }}
      >
        <div className="absolute inset-1 border border-blue-400/40 rounded" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateY: -90, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
      transition={{ delay, duration: 0.35, type: 'spring', stiffness: 200 }}
      className={`${w} rounded-lg bg-white shadow-xl relative select-none flex flex-col justify-between p-1.5
        ${isRed ? 'text-red-600' : 'text-black'}`}
    >
      <div className={`${corner} font-bold leading-none`}>
        <div>{card.r}</div>
        <div>{card.s}</div>
      </div>
      <div className={`text-center ${text} font-black`}>{card.s}</div>
      <div className={`${corner} font-bold leading-none self-end rotate-180`}>
        <div>{card.r}</div>
        <div>{card.s}</div>
      </div>
    </motion.div>
  );
}
