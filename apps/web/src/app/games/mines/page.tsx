'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { Grid } from '@/components/mines/Grid';

const MIN_BET = 0.1;
const MAX_BET = 500;
const MINES_MIN = 1;
const MINES_MAX = 24;

interface MinesState {
  gameId: string;
  phase: 'playing' | 'busted' | 'cashed';
  balance: number;
  bet: number;
  minesCount: number;
  revealed: number[];
  currentMultiplier: number;
  nextMultiplier: number;
  payout: number;
  netProfit: number;
  minePositions: number[] | null;
  potentialCashout: number;
}

export default function MinesPage() {
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [bet, setBet] = useState(5);
  const [minesCount, setMinesCount] = useState(3);
  const [state, setState] = useState<MinesState | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // fetch paytable for current minesCount
  const paytable = useQuery({
    queryKey: ['minesPaytable', minesCount],
    queryFn: () => api.minesPaytable(minesCount),
    enabled: minesCount >= MINES_MIN && minesCount <= MINES_MAX,
  });

  const multipliersByPick = useMemo<number[]>(() => {
    return (paytable.data?.steps ?? []).map((s: { picks: number; multiplier: number }) => s.multiplier);
  }, [paytable.data]);

  const hist = useQuery({ queryKey: ['minesHistory'], queryFn: api.minesHistory });
  useEffect(() => {
    if (hist.data) setHistory(hist.data.slice(0, 10));
  }, [hist.data]);

  // resume
  useEffect(() => {
    (async () => {
      try {
        const cur = await api.minesCurrent();
        if (cur) {
          setState(cur);
          setMinesCount(cur.minesCount);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const start = useMutation({
    mutationFn: () => api.minesStart(bet, minesCount),
    onSuccess: (data: MinesState) => {
      setState(data);
      setBalance(data.balance);
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reveal = useMutation({
    mutationFn: (position: number) => api.minesReveal(state!.gameId, position),
    onSuccess: (data: MinesState) => {
      setState(data);
      if (data.phase !== 'playing') {
        setBalance(data.balance);
        qc.invalidateQueries({ queryKey: ['wallet'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        qc.invalidateQueries({ queryKey: ['missions'] });
        qc.invalidateQueries({ queryKey: ['tournament'] });
        qc.invalidateQueries({ queryKey: ['vip'] });
        qc.invalidateQueries({ queryKey: ['minesHistory'] });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cashout = useMutation({
    mutationFn: () => api.minesCashout(state!.gameId),
    onSuccess: (data: MinesState) => {
      setState(data);
      setBalance(data.balance);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.invalidateQueries({ queryKey: ['tournament'] });
      qc.invalidateQueries({ queryKey: ['vip'] });
      qc.invalidateQueries({ queryKey: ['minesHistory'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleStart = () => {
    if (busy || (state && state.phase === 'playing')) return;
    if (bet < MIN_BET || bet > MAX_BET) return toast.error('Bet 0.1 – 500 RC');
    setBusy(true);
    start.mutate(undefined, { onSettled: () => setBusy(false) });
  };

  const handleReveal = (i: number) => {
    if (!state || state.phase !== 'playing' || busy) return;
    if (state.revealed.includes(i)) return;
    setBusy(true);
    reveal.mutate(i, { onSettled: () => setBusy(false) });
  };

  const handleCashout = () => {
    if (!state || state.phase !== 'playing' || state.revealed.length === 0 || busy) return;
    setBusy(true);
    cashout.mutate(undefined, { onSettled: () => setBusy(false) });
  };

  const isPlaying = state?.phase === 'playing';
  const isSettled = state?.phase === 'busted' || state?.phase === 'cashed';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Grid */}
        <div className="relative rounded-2xl border border-border bg-gradient-to-b from-panel to-bg p-4 md:p-6">
          <div className="mx-auto" style={{ maxWidth: 560 }}>
            <Grid
              revealed={state?.revealed ?? []}
              minePositions={state?.minePositions ?? null}
              phase={state?.phase ?? 'playing'}
              onReveal={handleReveal}
              disabled={busy || !isPlaying}
              multipliersByPick={multipliersByPick}
            />

            {/* Result overlay */}
            <AnimatePresence>
              {isSettled && state && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  className="mt-4 flex justify-center"
                >
                  <div className={`px-6 py-3 rounded-2xl text-center font-black ${
                    state.phase === 'cashed'
                      ? 'bg-gold/25 border-2 border-gold text-gold shadow-[0_0_40px_rgba(245,197,66,0.7)]'
                      : 'bg-red-500/25 border-2 border-red-500 text-red-200 shadow-[0_0_40px_rgba(239,68,68,0.5)]'
                  }`}>
                    {state.phase === 'cashed' ? (
                      <>
                        <div className="text-lg">💰 CASHED OUT @ {state.currentMultiplier.toFixed(2)}×</div>
                        <div className="text-sm mt-1">
                          +{state.payout.toFixed(2)} RC · net {state.netProfit >= 0 ? '+' : ''}{state.netProfit.toFixed(2)} RC
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg">💥 BOOM</div>
                        <div className="text-sm mt-1">
                          −{state.bet.toFixed(2)} RC
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-4">
          {!isPlaying && (
            <>
              {/* Mines selector */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Mines: <b className="text-white">{minesCount}</b></span>
                  <span className="text-gray-500">
                    {multipliersByPick[0] != null && (
                      <>1st pick: <b className="text-gold">{multipliersByPick[0].toFixed(2)}×</b></>
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={MINES_MIN}
                  max={MINES_MAX}
                  value={minesCount}
                  onChange={(e) => setMinesCount(+e.target.value)}
                  disabled={busy}
                  className="w-full accent-danger"
                />
                <div className="flex gap-1 mt-2">
                  {[1, 3, 5, 10, 20, 24].map((c) => (
                    <button
                      key={c}
                      onClick={() => setMinesCount(c)}
                      disabled={busy}
                      className={`flex-1 py-1.5 rounded text-[11px] font-bold disabled:opacity-50 transition ${
                        minesCount === c ? 'bg-danger text-white' : 'bg-bg border border-border hover:border-danger'
                      }`}
                    >{c}💣</button>
                  ))}
                </div>
              </div>

              {/* Bet */}
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="flex gap-1">
                  {[1, 5, 25, 100, 500].map((c) => (
                    <button
                      key={c}
                      onClick={() => setBet(c)}
                      disabled={busy}
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
                  disabled={busy}
                  className="bg-bg border border-border rounded px-3 py-2 text-center font-mono"
                />
              </div>

              <button
                onClick={handleStart}
                disabled={busy || start.isPending}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-danger to-red-700 font-black text-lg disabled:opacity-50 shadow-[0_0_30px_rgba(239,68,68,0.5)]"
              >
                {start.isPending ? '…' : isSettled ? `PLAY AGAIN · ${bet.toFixed(2)} RC` : `START · ${bet.toFixed(2)} RC`}
              </button>
            </>
          )}

          {isPlaying && state && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-black/30 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Multiplier</div>
                  <div className="text-lg font-black text-gold">{state.currentMultiplier.toFixed(4)}×</div>
                </div>
                <div className="rounded-lg border border-border bg-black/30 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Picks</div>
                  <div className="text-lg font-black">{state.revealed.length}/{25 - state.minesCount}</div>
                </div>
                <div className="rounded-lg border border-border bg-black/30 p-2 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Next</div>
                  <div className="text-lg font-black text-accent">{state.nextMultiplier.toFixed(2)}×</div>
                </div>
              </div>

              <button
                onClick={handleCashout}
                disabled={state.revealed.length === 0 || busy}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-success to-emerald-500 text-black font-black text-lg disabled:opacity-50 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
              >
                {busy ? '…' : `CASH OUT · ${state.potentialCashout.toFixed(2)} RC`}
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">How it works</div>
          <ul className="text-gray-500 space-y-1">
            <li>• 5×5 grid, {minesCount} hidden mines</li>
            <li>• Reveal safe cells to grow your multiplier</li>
            <li>• Hit a mine → lose everything</li>
            <li>• Cash out anytime — the higher you climb, the bigger the payout</li>
            <li>• Provably fair HMAC mine placement</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">Paytable · {minesCount} mines</div>
          <div className="grid grid-cols-2 gap-1">
            {multipliersByPick.slice(0, 10).map((m: number, i: number) => (
              <div key={i} className="flex justify-between rounded bg-black/30 border border-border px-2 py-1">
                <span className="text-gray-500">{i + 1} pick{i > 0 ? 's' : ''}</span>
                <span className="text-gold font-bold">{m.toFixed(2)}×</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">Recent games</div>
          <div className="grid gap-1 max-h-[280px] overflow-y-auto">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-xs border-b border-border/40 py-1.5">
                <span className="text-gray-500">
                  {h.minesCount}💣 · {h.picks} picks
                </span>
                <span className={h.netProfit > 0 ? 'text-success' : h.netProfit < 0 ? 'text-danger' : 'text-gray-400'}>
                  {h.netProfit > 0 ? '+' : ''}{h.netProfit.toFixed(2)} RC
                </span>
              </div>
            ))}
            {!history.length && <span className="text-xs text-gray-500">—</span>}
          </div>
        </div>
      </aside>
    </div>
  );
}
