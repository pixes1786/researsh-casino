'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';

const MIN_BET = 0.1;
const MAX_BET = 500;

// must match backend reel
const SYMBOLS = ['🍒', '🍋', '🍊', '🔔', '💎'];

const PAYOUTS: Record<string, number> = {
  '🍒': 0.5,
  '🍋': 1.5,
  '🍊': 4,
  '🔔': 20,
  '💎': 120,
};

const WEIGHTS: Record<string, number> = {
  '🍒': 8,
  '🍋': 6,
  '🍊': 4,
  '🔔': 2,
  '💎': 1,
};

const LINES: { name: string; positions: [number, number, number] }[] = [
  { name: 'Top',       positions: [0, 1, 2] },
  { name: 'Middle',    positions: [3, 4, 5] },
  { name: 'Bottom',    positions: [6, 7, 8] },
  { name: 'Left',      positions: [0, 3, 6] },
  { name: 'Center',    positions: [1, 4, 7] },
  { name: 'Right',     positions: [2, 5, 8] },
  { name: 'Diag ↘',    positions: [0, 4, 8] },
  { name: 'Diag ↗',    positions: [6, 4, 2] },
];

const REEL_STOP_MS = [600, 900, 1200];
const SPIN_TICK_MS = 70;

interface SpinResult {
  symbols: string[];
  wins: { line: string; symbol: string; positions: number[]; payout: number; multiplier: number }[];
  totalBet: number;
  totalWin: number;
  netProfit: number;
  balance: number;
  roundId: string;
}

export default function SlotsPage() {
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [bet, setBet] = useState(5);
  const [grid, setGrid] = useState<string[]>(Array(9).fill('🍒'));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const tickRef = useRef<number | null>(null);
  const stopRefs = useRef<number[]>([]);

  const paytable = useQuery({ queryKey: ['slotsPaytable'], queryFn: api.slotsPaytable });

  const clearTimers = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    for (const t of stopRefs.current) clearTimeout(t);
    stopRefs.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const startSpin = () => {
    if (spinning || busy) return;
    if (bet < MIN_BET || bet > MAX_BET) return toast.error('Bet 0.1 – 500 RC');
    setBusy(true);
    setSpinning(true);
    setResult(null);
    setHighlighted(new Set());

    api.slotsSpin(bet)
      .then((data: SpinResult) => {
        scheduleStops(data);
      })
      .catch((e: any) => {
        clearTimers();
        setSpinning(false);
        setBusy(false);
        toast.error(e.message);
      });

    tickRef.current = window.setInterval(() => {
      setGrid((prev) => {
        const next = [...prev];
        for (let i = 0; i < 9; i++) {
          next[i] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        }
        return next;
      });
    }, SPIN_TICK_MS);
  };

  const scheduleStops = (data: SpinResult) => {
    const finalSymbols = data.symbols;
    const stopCol = (col: number) => {
      setGrid((prev) => {
        const next = [...prev];
        for (let row = 0; row < 3; row++) {
          next[row * 3 + col] = finalSymbols[row * 3 + col];
        }
        return next;
      });
    };

    REEL_STOP_MS.forEach((ms, col) => {
      const t = window.setTimeout(() => stopCol(col), ms);
      stopRefs.current.push(t);
    });

    const finishT = window.setTimeout(() => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      setGrid([...finalSymbols]);
      setResult(data);
      setSpinning(false);
      setBusy(false);
      const hl = new Set<number>();
      for (const w of data.wins) for (const p of w.positions) hl.add(p);
      setHighlighted(hl);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.invalidateQueries({ queryKey: ['tournament'] });
      qc.invalidateQueries({ queryKey: ['vip'] });
    }, REEL_STOP_MS[2] + 300);
    stopRefs.current.push(finishT);
  };

  const bigWin = useMemo(() => result && result.totalWin >= result.totalBet * 10, [result]);
  const anyWin = useMemo(() => !!result && result.totalWin > 0, [result]);

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="relative rounded-2xl border border-border bg-gradient-to-b from-panel to-bg p-3 md:p-6 overflow-hidden">
          <div className="relative mx-auto" style={{ maxWidth: 520 }}>
            {/* paylines legend */}
            <div className="flex justify-center gap-1 flex-wrap mb-3 text-[10px] text-gray-500">
              {LINES.map((l) => (
                <span key={l.name} className="px-2 py-0.5 rounded bg-black/30 border border-border">
                  {l.name}
                </span>
              ))}
            </div>

            <div className="relative rounded-xl border-2 border-gold/60 bg-black/40 p-3 shadow-[0_0_30px_rgba(245,197,66,0.15)]">
              <div className="grid grid-cols-3 gap-2">
                {grid.map((sym, i) => {
                  const isWin = highlighted.has(i);
                  return (
                    <motion.div
                      key={i}
                      animate={isWin ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={isWin ? { duration: 0.5, repeat: Infinity, repeatType: 'loop' } : {}}
                      className={`aspect-square rounded-lg grid place-items-center text-5xl md:text-6xl select-none
                        bg-gradient-to-br from-panel to-black/60 border ${
                          isWin ? 'border-gold shadow-[0_0_20px_rgba(245,197,66,0.7)]' : 'border-border'
                        }`}
                    >
                      <span className={spinning ? 'opacity-90' : ''}>{sym}</span>
                    </motion.div>
                  );
                })}
              </div>

              <AnimatePresence>
                {anyWin && !spinning && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="absolute inset-0 grid place-items-center pointer-events-none"
                  >
                    <div className={`px-6 py-3 rounded-2xl text-2xl font-black ${
                      bigWin
                        ? 'bg-gold/30 border-2 border-gold text-gold shadow-[0_0_40px_rgba(245,197,66,0.8)]'
                        : 'bg-success/25 border-2 border-success text-success shadow-[0_0_30px_rgba(34,197,94,0.6)]'
                    }`}>
                      {bigWin ? '🎉 BIG WIN ' : 'WIN '}
                      +{result!.totalWin.toFixed(2)} RC
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-3 text-center text-xs text-gray-500 h-5">
              {result && !spinning && (
                result.totalWin > 0
                  ? `Won on ${result.wins.length} line${result.wins.length > 1 ? 's' : ''}: ${result.wins.map((w) => `${w.symbol}×3 → ×${w.multiplier}`).join(', ')}`
                  : 'No win — try again'
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="flex gap-1">
              {[1, 5, 25, 100, 500].map((c) => (
                <button
                  key={c}
                  onClick={() => setBet(c)}
                  disabled={spinning}
                  className={`flex-1 py-2 rounded text-xs font-bold disabled:opacity-50 transition ${
                    bet === c ? 'bg-gold text-black' : 'bg-bg border border-border hover:border-gold'
                  }`}
                >{c}</button>
              ))}
            </div>
            <input
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              step={0.1}
              value={bet}
              onChange={(e) => setBet(Math.max(MIN_BET, Math.min(MAX_BET, +e.target.value)))}
              disabled={spinning}
              className="bg-bg border border-border rounded px-3 py-2 text-center font-mono"
            />
          </div>

          <button
            onClick={startSpin}
            disabled={spinning || busy}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-neon to-accent font-black text-lg disabled:opacity-50 shadow-neon"
          >
            {spinning ? 'SPINNING…' : `SPIN  ·  ${bet.toFixed(2)} RC`}
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">Paytable (× total bet)</div>
          <div className="grid gap-1.5 text-xs">
            {Object.entries(PAYOUTS).reverse().map(([sym, mult]) => (
              <div key={sym} className="flex items-center justify-between rounded bg-black/30 border border-border px-2 py-1.5">
                <span className="text-xl tracking-tight">{sym}{sym}{sym}</span>
                <span className="text-[10px] text-gray-500">1 in {Math.pow((WEIGHTS[sym] / 21) * 100 || 0.01, -3) < 1000 ? Math.round(Math.pow(21 / WEIGHTS[sym], 3)) : '—'}</span>
                <span className="text-gold font-bold">{mult}×</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-500 mt-2">
            8 lines: 3 rows + 3 columns + 2 diagonals. Payout applies to the full bet per line.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">Provably fair</div>
          <div className="text-gray-500">
            Each cell = weighted reel index via intBelow(HMAC(serverSeed, clientSeed:nonce:cursor), {21}), cursor 0..8.
          </div>
          <div className="text-gray-500">RTP ≈ 96%</div>
        </div>
      </aside>
    </div>
  );
}
