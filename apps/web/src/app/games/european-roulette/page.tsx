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
import { ResultOverlay } from '@/components/roulette/ResultOverlay';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const SPIN_ANIMATION_MS = 6000;
const labelOf = (n: number) => (n === 37 ? '00' : String(n));
const isGreen = (n: number) => n === 0 || n === 37;

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
  const [pendingOutcome, setPendingOutcome] = useState<number | null>(null);

  const [overlay, setOverlay] = useState<{
    open: boolean; win: boolean; outcome: number | null;
    totalBet: number; payout: number;
  }>({ open: false, win: false, outcome: null, totalBet: 0, payout: 0 });

  const seedQ = useQuery({ queryKey: ['rouletteSeed'], queryFn: api.rouletteSeed });

  const betM = useMutation({
    mutationFn: api.rouletteBet,
    onSuccess: (data: any, variables) => {
      setLastBets(variables.map((v) => ({ ...v })));
      setPendingOutcome(data.outcome);
      setBets([]);

      setTimeout(() => {
        setSpinning(false);
        setPendingOutcome(null);
        setLastOutcome(data.outcome);
        setHistory((h) => [data.outcome, ...h].slice(0, 24));
        setBalance(data.balance);
        qc.invalidateQueries({ queryKey: ['wallet'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        qc.invalidateQueries({ queryKey: ['missions'] });
        qc.invalidateQueries({ queryKey: ['tournament'] });
        qc.invalidateQueries({ queryKey: ['vip'] });

        setOverlay({
          open: true,
          win: data.win > data.totalBet,
          outcome: data.outcome,
          totalBet: data.totalBet,
          payout: data.win,
        });
      }, SPIN_ANIMATION_MS);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setSpinning(false);
      setPendingOutcome(null);
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

  const wheelOutcome = spinning ? pendingOutcome : lastOutcome;

  return (
    <>
      {/* Single-column, centered, full-width on all breakpoints */}
      <div className="mx-auto w-full max-w-4xl space-y-3 md:space-y-4">

        {/* 1. WHEEL */}
        <div className="rounded-2xl border border-border bg-gradient-to-b from-panel to-bg p-2 md:p-4">
          <RouletteWheel spinning={spinning} outcome={wheelOutcome} />
        </div>

        {/* 2. BETTING TABLE */}
        <div className="rounded-2xl border border-border bg-panel p-2 md:p-4">
          <BettingTable chip={chip} bets={bets} onPlace={place} />
        </div>

        {/* 3. CHIPS + SPIN */}
        <div className="rounded-2xl border border-border bg-panel p-3 md:p-4 space-y-3">
          <div className="flex gap-1.5 md:gap-2">
            {[1, 5, 25, 100, 500].map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                disabled={spinning}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition disabled:opacity-50 ${
                  chip === c ? 'bg-gold text-black shadow-gold' : 'bg-bg border border-border hover:border-gold'
                }`}
              >{c}</button>
            ))}
          </div>

          <div className="text-sm flex justify-between items-center">
            <span className="text-gray-400">{t('bet')}</span>
            <span className="text-gold font-bold text-lg">{total.toFixed(2)} RC</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={repeat} disabled={spinning}
              className="py-2.5 rounded-lg border border-border hover:border-neon text-xs md:text-sm disabled:opacity-50">{t('repeat')}</button>
            <button onClick={doubleBets} disabled={spinning}
              className="py-2.5 rounded-lg border border-border hover:border-neon text-xs md:text-sm disabled:opacity-50">{t('double')}</button>
            <button onClick={clear} disabled={spinning}
              className="py-2.5 rounded-lg border border-danger text-danger text-xs md:text-sm disabled:opacity-50">{t('clear')}</button>
          </div>

          <button
            onClick={spin}
            disabled={spinning || !bets.length}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-neon to-accent font-black text-lg disabled:opacity-50 shadow-neon"
          >{spinning ? '…' : t('spin')}</button>
        </div>

        {/* 4. HISTORY + FAIRNESS */}
        <div className="space-y-3 md:space-y-4">
          <div className="rounded-2xl border border-border bg-panel p-3 md:p-4">
            <div className="text-xs text-gray-400 mb-2">{t('last_results')}</div>
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {history.map((n, i) => (
                  <motion.div
                    key={`${n}-${i}-${history.length}`}
                    initial={{ scale: 0, y: -6 }}
                    animate={{ scale: 1, y: 0 }}
                    className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${
                      isGreen(n) ? 'bg-green-600' : RED.has(n) ? 'bg-red-600' : 'bg-zinc-800'
                    }`}
                  >{labelOf(n)}</motion.div>
                ))}
              </AnimatePresence>
              {!history.length && <span className="text-xs text-gray-500">—</span>}
            </div>
          </div>

          <ProvablyFairPanel seed={seedQ.data} />
        </div>
      </div>

      <ResultOverlay
        open={overlay.open}
        win={overlay.win}
        outcome={overlay.outcome}
        totalBet={overlay.totalBet}
        payout={overlay.payout}
        onClose={() => setOverlay((o) => ({ ...o, open: false }))}
      />
    </>
  );
}
