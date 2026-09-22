'use client';
import { motion } from 'framer-motion';
import { Card as CardComp, CardType } from './Card';

export function Hand({
  cards,
  value,
  label,
  hideSecond = false,
  status,
  small = false,
}: {
  cards: CardType[];
  value: number;
  label: string;
  hideSecond?: boolean;
  status?: string;
  small?: boolean;
}) {
  const bust = status === 'bust' || value > 21;
  const bj = cards.length === 2 && value === 21 && !hideSecond;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-gray-500">{label}</span>
        <motion.span
          key={value}
          initial={{ scale: 1.3, color: '#fff' }}
          animate={{ scale: 1, color: bust ? '#ef4444' : bj ? '#f5c542' : '#22c55e' }}
          transition={{ duration: 0.3 }}
          className={`text-lg font-black tabular-nums px-2 py-0.5 rounded ${
            bust ? 'bg-red-500/20' : bj ? 'bg-gold/20' : 'bg-black/30'
          }`}
        >
          {hideSecond ? `${value}+` : value}
          {bj && <span className="ml-1 text-gold">BJ!</span>}
        </motion.span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {cards.map((c, i) => (
          <CardComp
            key={i}
            card={hideSecond && i === 1 ? undefined : c}
            hidden={hideSecond && i === 1}
            delay={i * 0.08}
            small={small}
          />
        ))}
        {cards.length === 0 && (
          <div className="w-20 h-28 md:w-24 md:h-32 rounded-lg border-2 border-dashed border-border opacity-30" />
        )}
      </div>
    </div>
  );
}
