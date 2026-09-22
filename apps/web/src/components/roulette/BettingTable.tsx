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
      className="pointer-events-none absolute inset-0 grid place-items-center z-10"
    >
      <span className="min-w-[22px] h-[22px] md:min-w-[26px] md:h-[26px] px-0.5 rounded-full grid place-items-center text-[9px] md:text-[10px] font-black text-amber-900
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
      <button
        type="button"
        onClick={onClick}
        className={`relative border border-border/60 font-bold py-2 md:py-2.5 px-0 text-center select-none
          hover:brightness-125 active:scale-95 transition text-[11px] md:text-xs ${className}`}
      >
        {label}
        {sum != null && <Chip amount={sum} />}
      </button>
    );
  };

  return (
    <div className="select-none w-full">
      {/* ─── MAIN: 0/00 column + numbers + dozens ─── */}
      <div className="flex gap-1">
        {/* 0 / 00 column */}
        <div className="w-[44px] sm:w-[52px] md:w-[60px] shrink-0 grid grid-rows-2 gap-0.5 md:gap-1">
          <Cell
            label="0"
            cellKey="s-0"
            onClick={() => onPlace({ kind: 'straight', number: 0 })}
            className="bg-green-700 text-base md:text-lg !font-black"
          />
          <Cell
            label="00"
            cellKey="s-37"
            onClick={() => onPlace({ kind: 'straight', number: 37 })}
            className="bg-green-700 text-base md:text-lg !font-black"
          />
        </div>

        {/* 1..36 — 12×3 grid, stretches to fill */}
        <div className="grid grid-cols-12 gap-0.5 md:gap-1 flex-1">
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

        {/* dozens column */}
        <div className="w-[80px] sm:w-[100px] md:w-[120px] shrink-0 grid grid-rows-3 gap-0.5 md:gap-1">
          <Cell label={t('dozen1')} cellKey="d-1" onClick={() => onPlace({ kind: 'dozen', dozen: 1 })} className="bg-zinc-900" />
          <Cell label={t('dozen2')} cellKey="d-2" onClick={() => onPlace({ kind: 'dozen', dozen: 2 })} className="bg-zinc-900" />
          <Cell label={t('dozen3')} cellKey="d-3" onClick={() => onPlace({ kind: 'dozen', dozen: 3 })} className="bg-zinc-900" />
        </div>
      </div>

      {/* ─── BOTTOM: six 1:1 bets ─── */}
      <div className="grid grid-cols-6 gap-0.5 md:gap-1 mt-1">
        <Cell label={t('low')}   cellKey="low"   onClick={() => onPlace({ kind: 'low' })}   className="bg-zinc-900" />
        <Cell label={t('even')}  cellKey="even"  onClick={() => onPlace({ kind: 'even' })}  className="bg-zinc-900" />
        <Cell label={t('red')}   cellKey="red"   onClick={() => onPlace({ kind: 'red' })}   className="bg-red-700" />
        <Cell label={t('black')} cellKey="black" onClick={() => onPlace({ kind: 'black' })} className="bg-zinc-950" />
        <Cell label={t('odd')}   cellKey="odd"   onClick={() => onPlace({ kind: 'odd' })}   className="bg-zinc-900" />
        <Cell label={t('high')}  cellKey="high"  onClick={() => onPlace({ kind: 'high' })}  className="bg-zinc-900" />
      </div>

      <div className="text-[10px] md:text-[11px] text-gray-500 mt-2">
        Chip: <span className="text-gold font-bold">{chip} RC</span> · tap a cell to add bet
      </div>
    </div>
  );
}
