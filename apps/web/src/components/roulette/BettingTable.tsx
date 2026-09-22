'use client';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function betKey(bet: any): string {
  switch (bet.kind) {
    case 'straight': return `s-${bet.number}`;
    case 'column': return `c-${bet.column}`;
    case 'dozen': return `d-${bet.dozen}`;
    case 'red':
    case 'black':
    case 'odd':
    case 'even':
    case 'low':
    case 'high': return bet.kind;
    default: return JSON.stringify(bet);
  }
}

function Chip({ amount }: { amount: number }) {
  return (
    <motion.span
      initial={{ scale: 0, y: -10 }}
      animate={{ scale: 1, y: 0 }}
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <span className="min-w-[26px] h-[26px] px-1 rounded-full grid place-items-center text-[10px] font-black text-amber-900
        bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500
        border-2 border-amber-700 shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
        {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
      </span>
    </motion.span>
  );
}

export function BettingTable({
  chip,
  bets,
  onPlace,
}: {
  chip: number;
  bets: { bet: any; amount: number }[];
  onPlace: (bet: any) => void;
}) {
  const { t } = useTranslation();
  const numbers = Array.from({ length: 36 }, (_, i) => i + 1);

  const amountByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bets) {
      const k = betKey(b.bet);
      m.set(k, (m.get(k) ?? 0) + b.amount);
    }
    return m;
  }, [bets]);

  const Cell = ({
    label,
    onClick,
    className = '',
    cellKey,
  }: {
    label: React.ReactNode;
    onClick: () => void;
    className?: string;
    cellKey: string;
  }) => {
    const sum = amountByKey.get(cellKey);
    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={onClick}
        className={`relative border border-border/60 text-[10px] sm:text-xs font-semibold py-1.5 sm:py-2 px-1 sm:px-2 hover:brightness-125 transition ${className}`}
      >
        {label}
        {sum != null && <Chip amount={sum} />}
      </motion.button>
    );
  };

  return (
    <div className="select-none">
      {/* columns 2:1 */}
      <div className="flex gap-1 mb-1">
        <div className="w-[88px]" />
        <div className="grid grid-cols-12 flex-1 gap-1">
          {[3,6,9,12,15,18,21,24,27,30,33,36].map((n) => (
            <Cell
              key={`col-${n}`}
              label="2:1"
              cellKey={`c-${n / 3}`}
              onClick={() => onPlace({ kind: 'column', column: (n / 3) as any })}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[88px_1fr_120px] gap-1">
        {/* zeroes column: 0 (top) / 00 (bottom) */}
        <div className="grid grid-rows-2 gap-1 w-[44px] sm:w-[56px]">
          <Cell
            label="0"
            cellKey="s-0"
            onClick={() => onPlace({ kind: 'straight', number: 0 })}
            className="bg-green-700 min-h-[60px] text-base font-black"
          />
          <Cell
            label="00"
            cellKey="s-37"
            onClick={() => onPlace({ kind: 'straight', number: 37 })}
            className="bg-green-700 min-h-[60px] text-base font-black"
          />
        </div>

        {/* 1..36 */}
        <div className="grid grid-cols-12 gap-1">
          {numbers.map((n) => (
            <Cell
              key={n}
              label={n}
              cellKey={`s-${n}`}
              onClick={() => onPlace({ kind: 'straight', number: n })}
              className={RED.has(n) ? 'bg-red-700' : 'bg-zinc-800'}
            />
          ))}
        </div>

        {/* dozens */}
        <div className="grid grid-rows-3 gap-1 w-[72px] sm:w-[100px]">
          <Cell label={t('dozen1')} cellKey="d-1" onClick={() => onPlace({ kind: 'dozen', dozen: 1 })} className="bg-zinc-900" />
          <Cell label={t('dozen2')} cellKey="d-2" onClick={() => onPlace({ kind: 'dozen', dozen: 2 })} className="bg-zinc-900" />
          <Cell label={t('dozen3')} cellKey="d-3" onClick={() => onPlace({ kind: 'dozen', dozen: 3 })} className="bg-zinc-900" />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1 mt-1">
        <Cell label={t('low')}   cellKey="low"   onClick={() => onPlace({ kind: 'low' })}   className="bg-zinc-900" />
        <Cell label={t('even')}  cellKey="even"  onClick={() => onPlace({ kind: 'even' })}  className="bg-zinc-900" />
        <Cell label={t('red')}   cellKey="red"   onClick={() => onPlace({ kind: 'red' })}   className="bg-red-700" />
        <Cell label={t('black')} cellKey="black" onClick={() => onPlace({ kind: 'black' })} className="bg-zinc-950 border-zinc-700" />
        <Cell label={t('odd')}   cellKey="odd"   onClick={() => onPlace({ kind: 'odd' })}   className="bg-zinc-900" />
        <Cell label={t('high')}  cellKey="high"  onClick={() => onPlace({ kind: 'high' })}  className="bg-zinc-900" />
      </div>

      <div className="text-[11px] text-gray-500 mt-2">
        Chip: <span className="text-gold font-bold">{chip} RC</span> · клик на ячейку = добавить ставку
      </div>
    </div>
  );
}
