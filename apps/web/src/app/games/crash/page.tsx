'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';

const MIN_BET = 0.1;
const MAX_BET = 500;
const GROWTH_RATE = 0.092;      // must match backend
const WS = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
const POLL_MS = 1500;            // safety poll only
const TEXT_UPDATE_MS = 60;       // throttle of the big multiplier number

function multiplierAt(elapsedMs: number): number {
  return Math.max(1, Math.exp((elapsedMs / 1000) * GROWTH_RATE));
}

interface ActiveRound {
  roundId: string;
  startedPerf: number;
  bet: number;
}

interface Result {
  won: boolean;
  crashPoint: number;
  cashedAt: number | null;
  payout: number;
  bet: number;
}

export default function CrashPage() {
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [bet, setBet] = useState(5);
  const [round, setRound] = useState<ActiveRound | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [history, setHistory] = useState<{ crashPoint: number; cashedAt: number | null; won: boolean }[]>([]);
  const [lastResult, setLastResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [crashed, setCrashed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roundRef = useRef<ActiveRound | null>(null);
  const pointsRef = useRef<{ t: number; m: number }[]>([{ t: 0, m: 1 }]);
  const crashedRef = useRef(false);
  const lastTextRef = useRef(0);
  const multiplierRef = useRef(1);

  const hist = useQuery({ queryKey: ['crashHistory'], queryFn: api.crashHistory });
  useEffect(() => {
    if (hist.data) {
      setHistory(hist.data.map((r: any) => ({
        crashPoint: r.crashPoint,
        cashedAt: r.cashedAt,
        won: r.outcome === 'WIN',
      })).slice(0, 12));
    }
  }, [hist.data]);

  // ─── canvas painter ───
  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssW, cssH);

    const pts = pointsRef.current;
    const lastT = pts.length ? pts[pts.length - 1].t : 0;
    const lastM = pts.length ? pts[pts.length - 1].m : 1;

    const spanT = Math.max(4000, lastT * 1.15);
    const spanM = Math.max(2.0, lastM * 1.15);

    const toX = (t: number) => (t / spanT) * cssW;
    const toY = (m: number) => cssH - ((m - 1) / (spanM - 1)) * cssH;

    // grid (5 horizontal)
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#5a5a66';
    for (let i = 0; i <= 5; i++) {
      const y = (i / 5) * cssH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
      const val = 1 + (spanM - 1) * (1 - i / 5);
      ctx.fillText(val.toFixed(2) + 'x', 6, y - 4);
    }

    const isCrashed = crashedRef.current;
    const stroke = isCrashed ? '#ef4444' : '#22c55e';

    // gradient fill under curve
    if (pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toX(pts[0].t), toY(pts[0].m));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].t), toY(pts[i].m));
      ctx.lineTo(toX(pts[pts.length - 1].t), cssH);
      ctx.lineTo(toX(pts[0].t), cssH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, cssH);
      grad.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // line
    if (pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toX(pts[0].t), toY(pts[0].m));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].t), toY(pts[i].m));
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = isCrashed ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // tip dot
      ctx.beginPath();
      ctx.arc(toX(pts[pts.length - 1].t), toY(pts[pts.length - 1].m), 5, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
    }
  };

  // ─── animation loop ───
  const startLoops = (r: ActiveRound) => {
    stopLoops();
    crashedRef.current = false;

    const tick = () => {
      if (crashedRef.current) {
        paint();
        return;
      }
      const elapsed = performance.now() - r.startedPerf;
      const m = multiplierAt(elapsed);
      multiplierRef.current = m;

      // push a sample every ~24ms (at 60fps = ~every 1.5 frames)
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      if (!last || elapsed - last.t >= 24) {
        pts.push({ t: elapsed, m });
        if (pts.length > 5000) {
          // keep first 200 + all recent — cheaper than full copy
          const first = pts.slice(0, 200);
          const tail = pts.slice(-4800);
          pointsRef.current = [...first, ...tail];
        }
      }

      // throttled text update (big number)
      const now = performance.now();
      if (now - lastTextRef.current >= TEXT_UPDATE_MS) {
        lastTextRef.current = now;
        setMultiplier(m);
      }

      paint();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // safety poll: is the round still alive?
    pollRef.current = window.setInterval(async () => {
      try {
        const s: any = await api.crashState();
        if (!s) return;
        if (s.active && s.roundId === r.roundId) return;
        if (s.outcome === 'LOSS') handleCrash(s.crashPoint);
        else finishRoundFromServer(s);
      } catch { /* ignore */ }
    }, POLL_MS);
  };

  const stopLoops = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const handleCrash = (crashPoint: number) => {
    if (crashedRef.current) return;
    crashedRef.current = true;
    stopLoops();
    const elapsed = performance.now() - (roundRef.current?.startedPerf ?? performance.now());
    pointsRef.current.push({ t: elapsed, m: crashPoint });
    multiplierRef.current = crashPoint;
    setMultiplier(crashPoint);
    setCrashed(true);
    paint();
    setTimeout(() => finishRoundFromServer(null), 350);
  };

  const finishRoundFromServer = async (preloaded: any) => {
    try {
      const s: any = preloaded ?? await api.crashState();
      if (s && s.roundId && !s.active) {
        setLastResult({
          won: s.outcome === 'WIN',
          crashPoint: s.crashPoint,
          cashedAt: s.cashedAt ?? null,
          payout: s.payout ?? 0,
          bet: s.bet ?? 0,
        });
        setHistory((h) => [{
          crashPoint: s.crashPoint,
          cashedAt: s.cashedAt ?? null,
          won: s.outcome === 'WIN',
        }, ...h].slice(0, 12));
        qc.invalidateQueries({ queryKey: ['wallet'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        qc.invalidateQueries({ queryKey: ['crashHistory'] });
      }
    } catch { /* ignore */ }
    roundRef.current = null;
    setRound(null);
    setCrashed(false);
    crashedRef.current = false;
  };

  // WS for crash event (primary) + resume on mount
  useEffect(() => {
    const s = io(WS, { transports: ['websocket'], withCredentials: true });
    socketRef.current = s;
    s.on('crash:crashed', (payload: { roundId: string; crashPoint: number }) => {
      const active = roundRef.current;
      if (!active || active.roundId !== payload.roundId) return;
      handleCrash(payload.crashPoint);
    });

    (async () => {
      try {
        const st: any = await api.crashState();
        if (st?.active) {
          const serverStart = new Date(st.startedAt).getTime();
          const elapsed = Date.now() - serverStart;
          const startedPerf = performance.now() - elapsed;
          const r: ActiveRound = { roundId: st.roundId, startedPerf, bet: st.bet };
          roundRef.current = r;
          pointsRef.current = [{ t: 0, m: 1 }];
          crashedRef.current = false;
          setRound(r);
          setCrashed(false);
          setMultiplier(multiplierAt(elapsed));
          startLoops(r);
        } else if (st?.roundId && !st.active) {
          setLastResult({
            won: st.outcome === 'WIN',
            crashPoint: st.crashPoint,
            cashedAt: st.cashedAt ?? null,
            payout: st.payout ?? 0,
            bet: st.bet ?? 0,
          });
        }
      } catch { /* ignore */ }
    })();

    return () => { s.close(); stopLoops(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // repaint on resize
  useEffect(() => {
    const onResize = () => paint();
    window.addEventListener('resize', onResize);
    paint();
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useMutation({
    mutationFn: () => api.crashStart(bet),
    onSuccess: (data: any) => {
      setLastResult(null);
      setCrashed(false);
      const serverStart = new Date(data.startedAt).getTime();
      const elapsed = Date.now() - serverStart;
      const startedPerf = performance.now() - elapsed;
      const r: ActiveRound = { roundId: data.roundId, startedPerf, bet: data.bet };
      roundRef.current = r;
      pointsRef.current = [{ t: 0, m: 1 }];
      crashedRef.current = false;
      lastTextRef.current = 0;
      setMultiplier(1);
      setRound(r);
      setBalance(data.balance);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      startLoops(r);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cashout = useMutation({
    mutationFn: (roundId: string) => api.crashCashout(roundId),
    onSuccess: async () => {
      crashedRef.current = true;
      stopLoops();
      await finishRoundFromServer(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCashout = () => {
    if (!round || busy || crashed) return;
    setBusy(true);
    cashout.mutate(round.roundId);
    setTimeout(() => setBusy(false), 200);
  };

  const handleStart = () => {
    if (round || busy) return;
    if (bet < MIN_BET || bet > MAX_BET) return toast.error('Bet 0.1 – 500 RC');
    start.mutate();
  };

  useEffect(() => () => stopLoops(), []);

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="relative rounded-2xl border border-border bg-gradient-to-b from-panel to-bg overflow-hidden">
          <div className="relative aspect-[720/320] w-full">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ display: 'block' }}
            />

            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div
                className={`text-6xl md:text-7xl font-black tabular-nums ${
                  crashed ? 'text-danger'
                    : lastResult?.won ? 'text-success'
                    : round ? 'text-white' : 'text-gray-500'
                }`}
              >
                {multiplier.toFixed(2)}<span className="text-3xl">x</span>
              </div>
            </div>

            <AnimatePresence>
              {lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2"
                >
                  <div className={`px-6 py-2 rounded-full text-sm font-black ${
                    lastResult.won
                      ? 'bg-success/20 border-2 border-success text-success shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                      : 'bg-danger/20 border-2 border-danger text-danger shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                  }`}>
                    {lastResult.won
                      ? `CASHED @ ${lastResult.cashedAt?.toFixed(2)}x · +${(lastResult.payout - lastResult.bet).toFixed(2)} RC`
                      : `CRASHED @ ${lastResult.crashPoint.toFixed(2)}x · −${lastResult.bet.toFixed(2)} RC`}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="flex gap-1">
              {[1, 5, 25, 100, 500].map((c) => (
                <button
                  key={c} onClick={() => setBet(c)} disabled={!!round}
                  className={`flex-1 py-2 rounded text-xs font-bold disabled:opacity-50 transition ${
                    bet === c ? 'bg-gold text-black' : 'bg-bg border border-border hover:border-gold'
                  }`}
                >{c}</button>
              ))}
            </div>
            <input
              type="number" min={MIN_BET} max={MAX_BET} step={0.1} value={bet}
              onChange={(e) => setBet(Math.max(MIN_BET, Math.min(MAX_BET, +e.target.value)))}
              disabled={!!round}
              className="bg-bg border border-border rounded px-3 py-2 text-center font-mono"
            />
          </div>

          {!round ? (
            <button
              onClick={handleStart} disabled={start.isPending}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-neon to-accent font-black text-lg disabled:opacity-50 shadow-neon"
            >{start.isPending ? '…' : `START  ·  ${bet.toFixed(2)} RC`}</button>
          ) : (
            <button
              onClick={handleCashout} disabled={cashout.isPending || busy || crashed}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-success to-emerald-500 text-black font-black text-lg disabled:opacity-50 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
            >CASH OUT  ·  {(round.bet * multiplier).toFixed(2)} RC</button>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">Recent rounds</div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <div key={i} className={`px-2 py-1 rounded font-mono text-xs font-bold ${
                h.won
                  ? 'bg-success/20 text-success border border-success/50'
                  : 'bg-danger/20 text-danger border border-danger/50'
              }`}>
                {h.cashedAt ? `${h.cashedAt.toFixed(2)}x / ${h.crashPoint.toFixed(2)}x` : `${h.crashPoint.toFixed(2)}x`}
              </div>
            ))}
            {!history.length && <span className="text-xs text-gray-500">—</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">How it works</div>
          <ul className="text-gray-500 space-y-1">
            <li>Multiplier grows in real time (public formula).</li>
            <li>Crash point hidden — server fires when it's time.</li>
            <li>Cash out before the crash — server computes payout from its own clock, cannot be faked.</li>
            <li>Provably fair HMAC-SHA256.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
