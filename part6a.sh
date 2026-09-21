#!/usr/bin/env bash
set -euo pipefail
cd research-casino

# ─────────── RouletteWheel: полноценное SVG-колесо ───────────
cat > apps/web/src/components/roulette/RouletteWheel.tsx <<'RC_EOF'
'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const STEP = 360 / ORDER.length;
const HALF = STEP / 2;

const SIZE = 560;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_RIM_OUT = 275;
const R_RIM_IN = 262;
const R_TRACK_OUT = 258;
const R_TRACK_IN = 165;
const R_HUB = 78;

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(a1: number, a2: number, rIn: number, rOut: number): string {
  const [x1, y1] = polar(rOut, a1);
  const [x2, y2] = polar(rOut, a2);
  const [x3, y3] = polar(rIn, a2);
  const [x4, y4] = polar(rIn, a1);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function RouletteWheel({ spinning, outcome }: { spinning: boolean; outcome: number | null }) {
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(4);

  useEffect(() => {
    if (outcome == null) return;
    const idx = ORDER.indexOf(outcome);
    const targetNorm = ((-idx * STEP) % 360 + 360) % 360;
    const currentNorm = ((rotation % 360) + 360) % 360;
    let delta = targetNorm - currentNorm;
    if (delta < 0) delta += 360;
    const turns = 6 + Math.floor(Math.random() * 4); // 6..9 полных оборотов
    const dur = 4 + Math.random() * 1.8;             // 4..5.8 сек
    setDuration(dur);
    setRotation((prev) => prev + turns * 360 + delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <div className="relative aspect-square max-w-[600px] mx-auto pt-6">
      {/* Result above wheel */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 text-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Result</div>
        <div
          className={`text-4xl font-black leading-none transition-colors duration-200 ${
            outcome == null
              ? 'text-gray-600'
              : outcome === 0
              ? 'text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.7)]'
              : RED.has(outcome)
              ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]'
              : 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]'
          }`}
        >
          {outcome ?? '—'}
        </div>
      </div>

      <motion.div
        className="absolute inset-0 pt-6"
        animate={{ rotate: rotation }}
        transition={{
          duration: spinning ? duration : 0,
          ease: [0.1, 0.85, 0.15, 1], // резкое замедление в конце
        }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
          <defs>
            <radialGradient id="rimGold" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fbe08a" />
              <stop offset="55%" stopColor="#c79a34" />
              <stop offset="100%" stopColor="#7a5a18" />
            </radialGradient>
            <radialGradient id="hubGrad" cx="50%" cy="40%">
              <stop offset="0%" stopColor="#2c2c3a" />
              <stop offset="100%" stopColor="#0a0a12" />
            </radialGradient>
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* gold rim */}
          <circle cx={CX} cy={CY} r={R_RIM_OUT} fill="url(#rimGold)" filter="url(#goldGlow)" />
          <circle cx={CX} cy={CY} r={R_RIM_IN} fill="#0a0a12" />

          {/* segments */}
          {ORDER.map((n, i) => {
            const a1 = i * STEP - HALF;
            const a2 = i * STEP + HALF;
            const color = n === 0 ? '#16a34a' : RED.has(n) ? '#b91c1c' : '#0c0c14';
            return (
              <path
                key={n}
                d={arcPath(a1, a2, R_TRACK_IN, R_TRACK_OUT)}
                fill={color}
                stroke="#f5c542"
                strokeWidth="0.5"
                strokeOpacity="0.45"
              />
            );
          })}

          {/* numbers */}
          {ORDER.map((n, i) => {
            const angle = i * STEP;
            const [x, y] = polar((R_TRACK_IN + R_TRACK_OUT) / 2 - 4, angle);
            return (
              <text
                key={`n-${n}`}
                x={x}
                y={y}
                fill="#fafafa"
                fontSize="15"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${angle} ${x} ${y})`}
                style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.7 }}
              >
                {n}
              </text>
            );
          })}

          {/* hub */}
          <circle cx={CX} cy={CY} r={R_HUB} fill="url(#hubGrad)" stroke="#d4af37" strokeWidth="2" />
          <circle cx={CX} cy={CY} r={R_HUB - 8} fill="none" stroke="#f5c542" strokeWidth="0.6" opacity="0.5" />

          {/* spokes */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const [x1, y1] = polar(R_HUB, a);
            const [x2, y2] = polar(R_TRACK_IN - 2, a);
            return (
              <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#f5c542" strokeWidth="0.8" opacity="0.28" />
            );
          })}

          <circle cx={CX} cy={CY} r={6} fill="#f5c542" />
          <circle cx={CX} cy={CY} r={3} fill="#3a2a08" />
        </svg>
      </motion.div>

      {/* top pointer */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 -translate-y-2 z-10 pointer-events-none">
        <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[28px] border-l-transparent border-r-transparent border-t-gold drop-shadow-[0_0_10px_rgba(245,197,66,0.9)]" />
      </div>
    </div>
  );
}
RC_EOF

# ─────────── BettingTable: фишки на ячейках ───────────
cat > apps/web/src/components/roulette/BettingTable.tsx <<'RC_EOF'
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
      <span className="min-w-[28px] h-[28px] px-1 rounded-full grid place-items-center text-[10px] font-black text-amber-900
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
        className={`relative border border-border/60 text-xs font-semibold py-2 px-2 hover:brightness-125 transition ${className}`}
      >
        {label}
        {sum != null && <Chip amount={sum} />}
      </motion.button>
    );
  };

  return (
    <div className="select-none">
      {/* column 2:1 */}
      <div className="flex gap-1 mb-1">
        <div className="w-12" />
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

      <div className="grid grid-cols-[48px_1fr_120px] gap-1">
        <div className="grid">
          <Cell
            label="0"
            cellKey="s-0"
            onClick={() => onPlace({ kind: 'straight', number: 0 })}
            className="bg-green-700 h-full min-h-[120px]"
          />
        </div>

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

        <div className="grid grid-rows-3 gap-1">
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
RC_EOF

# ─────────── page.tsx рулетки — обновлённая логика ───────────
cat > apps/web/src/app/games/european-roulette/page.tsx <<'RC_EOF'
'use client';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { useTranslation } from 'react-i18next';
import { RouletteWheel } from '@/components/roulette/RouletteWheel';
import { BettingTable } from '@/components/roulette/BettingTable';
import { ProvablyFairPanel } from '@/components/roulette/ProvablyFairPanel';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export default function RoulettePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [chip, setChip] = useState(5);
  const [bets, setBets] = useState<{ bet: any; amount: number }[]>([]);
  const [lastBets, setLastBets] = useState<{ bet: any; amount: number }[]>([]);
  const [history, setHistory] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<number | null>(null);

  const seedQ = useQuery({ queryKey: ['rouletteSeed'], queryFn: api.rouletteSeed });

  const betM = useMutation({
    mutationFn: api.rouletteBet,
    onSuccess: (data: any, variables) => {
      setLastBets(variables.map((v) => ({ ...v })));
      setLastOutcome(data.outcome);
      setHistory((h) => [data.outcome, ...h].slice(0, 24));
      setBalance(data.balance);
      if (data.win > 0) toast.success(`+${data.win.toFixed(2)} RC`);
      else toast.message(`${t('bet')}: ${data.totalBet.toFixed(2)} RC`);
      setBets([]);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      setTimeout(() => setSpinning(false), 5200);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setSpinning(false);
    },
  });

  const place = (bet: any) => setBets((b) => [...b, { bet, amount: chip }]);
  const clear = () => setBets([]);
  const total = useMemo(() => bets.reduce((s, b) => s + b.amount, 0), [bets]);

  const spin = () => {
    if (spinning) return;
    if (!bets.length) return toast.error('Place a bet first');
    setSpinning(true);
    betM.mutate(bets);
  };

  const repeat = () => {
    if (!lastBets.length) return toast.message('No bets to repeat');
    setBets(lastBets.map((b) => ({ ...b })));
  };
  const doubleBets = () => setBets((b) => b.map((x) => ({ ...x, amount: x.amount * 2 })));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-panel to-bg p-4 shadow-neon/20">
          <RouletteWheel spinning={spinning} outcome={lastOutcome} />
        </div>
        <div className="rounded-2xl border border-border bg-panel p-4">
          <BettingTable chip={chip} bets={bets} onPlace={place} />
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-3">
          <div className="flex gap-2">
            {[1, 5, 25, 100, 500].map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                  chip === c
                    ? 'bg-gold text-black shadow-gold'
                    : 'bg-bg border border-border hover:border-gold'
                }`}
              >{c}</button>
            ))}
          </div>
          <div className="text-sm flex justify-between">
            <span className="text-gray-400">{t('bet')}</span>
            <span className="text-gold font-bold">{total.toFixed(2)} RC</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={repeat} className="py-2 rounded border border-border hover:border-neon text-sm">
              {t('repeat')}
            </button>
            <button onClick={doubleBets} className="py-2 rounded border border-border hover:border-neon text-sm">
              {t('double')}
            </button>
            <button onClick={clear} className="py-2 rounded border border-danger text-sm text-danger">
              {t('clear')}
            </button>
          </div>
          <button
            onClick={spin}
            disabled={spinning || !bets.length}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-neon to-accent font-bold disabled:opacity-50 shadow-neon"
          >{spinning ? '…' : t('spin')}</button>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">{t('last_results')}</div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {history.map((n, i) => (
                <motion.div
                  key={`${n}-${i}-${history.length}`}
                  initial={{ scale: 0, y: -6 }}
                  animate={{ scale: 1, y: 0 }}
                  className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${
                    n === 0 ? 'bg-green-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-800'
                  }`}
                >{n}</motion.div>
              ))}
            </AnimatePresence>
            {!history.length && <span className="text-xs text-gray-500">—</span>}
          </div>
        </div>

        <ProvablyFairPanel seed={seedQ.data} />
      </aside>
    </div>
  );
}
RC_EOF

echo "OK part6a"
