'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { Hand } from '@/components/blackjack/Hand';

const MIN_BET = 0.1;
const MAX_BET = 500;

interface BJState {
  gameId: string;
  phase: 'player_turn' | 'settled';
  balance: number;
  totalStaked: number;
  dealerCards: any[];
  dealerValue: number;
  hands: { cards: any[]; bet: number; status: string; value: number; isBlackjack: boolean; doubled: boolean }[];
  currentHandIndex: number;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  outcomes: { result: string; payout: number }[] | null;
  payout: number;
  netProfit: number;
}

export default function BlackjackPage() {
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [bet, setBet] = useState(5);
  const [state, setState] = useState<BJState | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const hist = useQuery({ queryKey: ['bjHistory'], queryFn: api.blackjackHistory });
  useEffect(() => {
    if (hist.data) setHistory(hist.data.slice(0, 10));
  }, [hist.data]);

  // Resume any active game on mount
  useEffect(() => {
    (async () => {
      try {
        const cur = await api.blackjackCurrent();
        if (cur) setState(cur);
      } catch { /* ignore */ }
    })();
  }, []);

  const start = useMutation({
    mutationFn: () => api.blackjackStart(bet),
    onSuccess: (data: BJState) => {
      setState(data);
      setBalance(data.balance);
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const act = useMutation({
    mutationFn: ({ gameId, action }: { gameId: string; action: 'hit' | 'stand' | 'double' | 'split' }) =>
      api.blackjackAction(gameId, action),
    onSuccess: (data: BJState) => {
      setState(data);
      if (data.phase === 'settled') {
        setBalance(data.balance);
        qc.invalidateQueries({ queryKey: ['wallet'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        qc.invalidateQueries({ queryKey: ['missions'] });
        qc.invalidateQueries({ queryKey: ['tournament'] });
        qc.invalidateQueries({ queryKey: ['vip'] });
        qc.invalidateQueries({ queryKey: ['bjHistory'] });
      } else {
        setBalance(data.balance);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleStart = () => {
    if (busy || (state && state.phase === 'player_turn')) return;
    if (bet < MIN_BET || bet > MAX_BET) return toast.error('Bet 0.1 – 500 RC');
    setBusy(true);
    start.mutate(undefined, { onSettled: () => setBusy(false) });
  };

  const handleAction = (action: 'hit' | 'stand' | 'double' | 'split') => {
    if (!state || busy) return;
    setBusy(true);
    act.mutate({ gameId: state.gameId, action }, { onSettled: () => setBusy(false) });
  };

  const isTurn = state?.phase === 'player_turn';
  const isSettled = state?.phase === 'settled';

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Table */}
        <div
          className="relative rounded-2xl border-2 border-emerald-900 p-6 min-h-[460px] overflow-hidden shadow-2xl"
          style={{
            background:
              'radial-gradient(ellipse at 50% 20%, #064e3b 0%, #022c22 60%, #000 100%)',
          }}
        >
          {/* felt texture */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
            }}
          />

          {!state && (
            <div className="relative z-10 grid place-items-center min-h-[400px] text-center">
              <div>
                <div className="text-5xl mb-4">🃏</div>
                <div className="text-gray-400 text-sm">Place a bet to start</div>
              </div>
            </div>
          )}

          {state && (
            <div className="relative z-10 flex flex-col gap-8 min-h-[440px] justify-between">
              {/* Dealer */}
              <div className="flex justify-center">
                <Hand
                  cards={state.dealerCards}
                  value={state.dealerValue}
                  label="Dealer"
                  hideSecond={isTurn}
                />
              </div>

              {/* Center status */}
              <div className="flex justify-center min-h-[40px]">
                <AnimatePresence>
                  {isSettled && state.outcomes && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className={`px-6 py-3 rounded-2xl text-xl font-black text-center ${
                        state.netProfit > 0
                          ? 'bg-gold/25 border-2 border-gold text-gold shadow-[0_0_40px_rgba(245,197,66,0.7)]'
                          : state.netProfit < 0
                          ? 'bg-red-500/25 border-2 border-red-500 text-red-300'
                          : 'bg-gray-500/25 border-2 border-gray-400 text-gray-200'
                      }`}
                    >
                      {state.outcomes.map((o, i) => (
                        <div key={i} className="text-sm">
                          {o.result === 'blackjack' && '🃏 BLACKJACK!'}
                          {o.result === 'win' && '🎉 WIN'}
                          {o.result === 'push' && '🤝 PUSH'}
                          {o.result === 'lose' && '😔 LOSE'}
                          {o.result === 'bust' && '💥 BUST'}
                          {' — '}
                          <span className={o.payout > 0 ? 'text-gold' : 'text-gray-400'}>
                            {o.payout > 0 ? `+${o.payout.toFixed(2)}` : '0.00'} RC
                          </span>
                        </div>
                      ))}
                      <div className={`mt-1 text-lg ${state.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        Net: {state.netProfit >= 0 ? '+' : ''}{state.netProfit.toFixed(2)} RC
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Player hands */}
              <div className="flex flex-col gap-6 items-center">
                {state.hands.map((h, i) => (
                  <div
                    key={i}
                    className={`relative ${
                      isTurn && i === state.currentHandIndex && state.hands.length > 1
                        ? 'ring-2 ring-gold/60 rounded-lg p-2 -m-2'
                        : ''
                    }`}
                  >
                    <Hand
                      cards={h.cards}
                      value={h.value}
                      status={h.status}
                      label={`You${state.hands.length > 1 ? ` #${i + 1}` : ''} · ${h.bet.toFixed(2)} RC${h.doubled ? ' · 2×' : ''}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-3">
          {!isTurn && (
            <>
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
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 font-black text-lg disabled:opacity-50 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
              >
                {start.isPending ? '…' : isSettled ? `PLAY AGAIN · ${bet.toFixed(2)} RC` : `DEAL · ${bet.toFixed(2)} RC`}
              </button>
            </>
          )}

          {isTurn && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => handleAction('hit')}
                disabled={!state.canHit || busy}
                className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold disabled:opacity-40 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              >HIT</button>
              <button
                onClick={() => handleAction('stand')}
                disabled={!state.canStand || busy}
                className="py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 font-bold disabled:opacity-40 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >STAND</button>
              <button
                onClick={() => handleAction('double')}
                disabled={!state.canDouble || busy}
                className="py-3 rounded-xl bg-gradient-to-r from-gold to-amber-400 text-black font-bold disabled:opacity-40 shadow-[0_0_20px_rgba(245,197,66,0.4)]"
              >DOUBLE</button>
              <button
                onClick={() => handleAction('split')}
                disabled={!state.canSplit || busy}
                className="py-3 rounded-xl bg-gradient-to-r from-neon to-accent font-bold disabled:opacity-40 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              >SPLIT</button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">Rules</div>
          <ul className="text-gray-500 space-y-1">
            <li>• Dealer stands on all 17 (including soft 17)</li>
            <li>• Blackjack pays 3:2</li>
            <li>• Double on first 2 cards</li>
            <li>• Split any pair (one split max)</li>
            <li>• Dealer doesn't play if all hands bust</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">Recent games</div>
          <div className="grid gap-1 max-h-[320px] overflow-y-auto">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-xs border-b border-border/40 py-1.5">
                <span className="text-gray-500">
                  {new Date(h.createdAt).toLocaleTimeString()}
                </span>
                <span className={h.netProfit > 0 ? 'text-success' : h.netProfit < 0 ? 'text-danger' : 'text-gray-400'}>
                  {h.netProfit > 0 ? '+' : ''}{h.netProfit.toFixed(2)} RC
                </span>
              </div>
            ))}
            {!history.length && <span className="text-xs text-gray-500">—</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">Provably fair</div>
          <div className="text-gray-500">
            Deck shuffled via HMAC-SHA256(serverSeed, clientSeed:nonce:cursor) — Fisher-Yates.
          </div>
        </div>
      </aside>
    </div>
  );
}
