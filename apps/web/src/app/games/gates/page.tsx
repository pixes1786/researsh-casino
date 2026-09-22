'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { Grid } from '@/components/gates/Grid';
import { MultiplierOverlay } from '@/components/gates/MultiplierOverlay';

const MIN_BET = 0.1;
const MAX_BET = 500;
const CASCADE_MS = 900; // per cascade timeline

interface Cascade {
  grid: string[];
  wins: { sym: string; positions: number[]; payout: number }[];
  multipliers: { position: number; value: number }[];
  multiplier: number;
  payout: number;
}

interface SpinResult {
  roundId: string;
  grid: string[];
  cascadeHistory: Cascade[];
  accumulatedMultiplier: number;
  totalBet: number;
  totalWin: number;
  netProfit: number;
  balance: number;
}

export default function GatesPage() {
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [bet, setBet] = useState(5);
  const [grid, setGrid] = useState<string[]>(Array(30).fill('⚡'));
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const [multipliers, setMultipliers] = useState<Map<number, number>>(new Map());
  const [disappearing, setDisappearing] = useState<Set<number>>(new Set());
  const [dropping, setDropping] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(0);
  const [showMultiplier, setShowMultiplier] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [cascadeCounter, setCascadeCounter] = useState(0);

  const timersRef = useRef<number[]>([]);
  const clearTimers = () => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  const hist = useQuery({ queryKey: ['gatesHistory'], queryFn: api.gatesHistory });
  useEffect(() => {
    if (hist.data) setHistory(hist.data.slice(0, 10));
  }, [hist.data]);

  const spin = useMutation({
    mutationFn: () => api.gatesSpin(bet),
    onSuccess: (data: SpinResult) => {
      setResult(null);
      setHighlighted(new Set());
      setMultipliers(new Map());
      setDisappearing(new Set());
      setCurrentMultiplier(0);
      setShowMultiplier(false);
      setCascadeCounter(0);

      playCascades(data);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setAnimating(false);
    },
  });

  const playCascades = (data: SpinResult) => {
    setAnimating(true);
    clearTimers();

    const cascades = data.cascadeHistory;
    if (cascades.length === 0) {
      // No wins — just show the final grid
      setGrid(data.grid);
      finish(data);
      return;
    }

    // Show initial grid
    setGrid(cascades[0].grid);
    setDropping(true);
    const t0 = window.setTimeout(() => setDropping(false), 400);
    timersRef.current.push(t0);

    // Play each cascade
    cascades.forEach((c, idx) => {
      const baseDelay = 500 + idx * CASCADE_MS * 2;

      // 1) Highlight winners
      const t1 = window.setTimeout(() => {
        const h = new Set<number>();
        c.wins.forEach((w) => w.positions.forEach((p) => h.add(p)));
        setHighlighted(h);

        // Show multipliers on grid
        const mm = new Map<number, number>();
        c.multipliers.forEach((m) => mm.set(m.position, m.value));
        setMultipliers(mm);
      }, baseDelay);
      timersRef.current.push(t1);

      // 2) Show big multiplier overlay
      if (c.multiplier > 0) {
        const t2 = window.setTimeout(() => {
          setCurrentMultiplier(c.multiplier);
          setShowMultiplier(true);
        }, baseDelay + 350);
        timersRef.current.push(t2);

        const t2b = window.setTimeout(() => {
          setShowMultiplier(false);
        }, baseDelay + 900);
        timersRef.current.push(t2b);
      }

      // 3) Disappear winners
      const t3 = window.setTimeout(() => {
        const d = new Set<number>();
        c.wins.forEach((w) => w.positions.forEach((p) => d.add(p)));
        setDisappearing(d);
        setHighlighted(new Set());
      }, baseDelay + 800);
      timersRef.current.push(t3);

      // 4) Drop next grid (or keep final)
      const t4 = window.setTimeout(() => {
        setDisappearing(new Set());
        setMultipliers(new Map());
        const nextGrid = cascades[idx + 1]?.grid ?? data.grid;
        setGrid(nextGrid);
        setDropping(true);
        const t4b = window.setTimeout(() => setDropping(false), 300);
        timersRef.current.push(t4b);
      }, baseDelay + 1100);
      timersRef.current.push(t4);
    });

    // Finalize
    const totalDelay = 500 + cascades.length * CASCADE_MS * 2 + 300;
    const tFinish = window.setTimeout(() => {
      setGrid(data.grid);
      setHighlighted(new Set());
      setMultipliers(new Map());
      finish(data);
    }, totalDelay);
    timersRef.current.push(tFinish);
  };

  const finish = (data: SpinResult) => {
    setResult(data);
    setAnimating(false);
    setBalance(data.balance);
    qc.invalidateQueries({ queryKey: ['wallet'] });
    qc.invalidateQueries({ queryKey: ['me'] });
    qc.invalidateQueries({ queryKey: ['missions'] });
    qc.invalidateQueries({ queryKey: ['tournament'] });
    qc.invalidateQueries({ queryKey: ['vip'] });
    qc.invalidateQueries({ queryKey: ['gatesHistory'] });
    if (data.totalWin > 0) {
      toast.success(`+${data.totalWin.toFixed(2)} RC`);
    }
  };

  const handleSpin = () => {
    if (animating) return;
    if (bet < MIN_BET || bet > MAX_BET) return toast.error('Bet 0.1 – 500 RC');
    spin.mutate();
  };

  const bigWin = result && result.totalWin >= result.totalBet * 20;
  const anyWin = result && result.totalWin > 0;

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Grid */}
        <div className="relative rounded-2xl border-2 border-purple-900/60 p-3 md:p-5 overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, #3b0764 0%, #1e1b4b 40%, #0a0a15 100%)',
          }}
        >
          {/* decorative glow */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-purple-500/20 to-transparent pointer-events-none" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

          <div className="relative mx-auto" style={{ maxWidth: 560 }}>
            {/* Zeus Header */}
            <div className="text-center mb-3 md:mb-4">
              <div className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-gold/80">
                ⚡ Gates of Olympus ⚡
              </div>
              {cascadeCounter > 0 && animating && (
                <div className="text-[10px] text-purple-300 mt-1">
                  Cascade #{cascadeCounter}
                </div>
              )}
            </div>

            <div className="relative">
              <Grid
                grid={grid}
                highlighted={highlighted}
                multipliers={multipliers}
                disappearing={disappearing}
                dropping={dropping}
              />
              <MultiplierOverlay visible={showMultiplier} value={currentMultiplier} />
            </div>

            {/* Win overlay */}
            <AnimatePresence>
              {anyWin && !animating && result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="mt-4 flex justify-center"
                >
                  <div className={`px-6 py-3 rounded-2xl text-center font-black ${
                    bigWin
                      ? 'bg-gold/25 border-2 border-gold text-gold shadow-[0_0_50px_rgba(245,197,66,0.9)]'
                      : 'bg-success/25 border-2 border-success text-success shadow-[0_0_30px_rgba(34,197,94,0.6)]'
                  }`}>
                    <div className="text-xl">
                      {bigWin ? '⚡ MEGA WIN ' : 'WIN '}
                      +{result.totalWin.toFixed(2)} RC
                    </div>
                    {result.accumulatedMultiplier > 0 && (
                      <div className="text-sm mt-1 opacity-90">
                        Total multiplier: {result.accumulatedMultiplier}×
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
              {!anyWin && !animating && result && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-center text-xs text-gray-500"
                >
                  No win — try again
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="flex gap-1">
              {[1, 5, 25, 100, 500].map((c) => (
                <button
                  key={c}
                  onClick={() => setBet(c)}
                  disabled={animating}
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
              disabled={animating}
              className="bg-bg border border-border rounded px-3 py-2 text-center font-mono"
            />
          </div>

          <button
            onClick={handleSpin}
            disabled={animating || spin.isPending}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 font-black text-lg disabled:opacity-50 shadow-[0_0_30px_rgba(168,85,247,0.6)]"
          >
            {animating || spin.isPending ? 'TUMBLING…' : `SPIN · ${bet.toFixed(2)} RC`}
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">How it works</div>
          <ul className="text-gray-500 space-y-1">
            <li>• 6×5 grid, <b>Pay Anywhere</b> — 8+ same symbols anywhere win</li>
            <li>• Winning symbols <b>disappear</b> — new ones fall from the top (tumble)</li>
            <li>• ⚡ Zeus multipliers (2× – 500×) can drop — they <b>sum up</b> when a cascade wins</li>
            <li>• Cascades chain until no new win — RTP ≈ 96.5%</li>
            <li>• Max win: 5,000× bet</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">Recent spins</div>
          <div className="grid gap-1 max-h-[280px] overflow-y-auto">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between text-xs border-b border-border/40 py-1.5">
                <span className="text-gray-500">
                  {h.cascades > 0 && `${h.cascades}× casc`}
                  {h.multiplier > 0 && ` · ${h.multiplier}×`}
                  {h.cascades === 0 && 'no win'}
                </span>
                <span className={h.netProfit > 0 ? 'text-success font-bold' : 'text-gray-400'}>
                  {h.netProfit > 0 ? '+' : ''}{h.netProfit.toFixed(2)}
                </span>
              </div>
            ))}
            {!history.length && <span className="text-xs text-gray-500">—</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">Provably fair</div>
          <div className="text-gray-500">
            Symbols + multipliers from HMAC-SHA256 (serverSeed, clientSeed:nonce:cursor).
          </div>
        </div>
      </aside>
    </div>
  );
}
