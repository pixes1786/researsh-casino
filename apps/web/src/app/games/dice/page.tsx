'use client';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';

const HOUSE_EDGE = 1;
const WIN_MIN = 0.1;
const WIN_MAX = 82.5;

// Full-circle speedometer, 0% at bottom going clockwise.
const SIZE = 460;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 195;
const R_IN = 155;
const R_RING = (R_OUT + R_IN) / 2;

/** value 0..100 → SVG polar angle (deg) with 0=top, 90=right, 180=bottom */
const valueToSvgAngle = (v: number) => 180 - (v / 100) * 360;
// 0% → 180 (bottom); clockwise in our polar means angle decreases
// 25% → 90 (right); 50% → 0 (top); 75% → -90 (left); 100% → -180 (bottom)

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(a1: number, a2: number, rOut: number, rIn: number) {
  // ensure we always go clockwise visually: sweep-flag = 1 for a2 > a1
  const [x1, y1] = polar(rOut, a1);
  const [x2, y2] = polar(rOut, a2);
  const [x3, y3] = polar(rIn, a2);
  const [x4, y4] = polar(rIn, a1);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 1 : 0;
  return `M ${x1} ${y1} A ${rOut} ${rOut} 0 ${large} ${sweep} ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${large} ${1 - sweep} ${x4} ${y4} Z`;
}

export default function SpeedometerPage() {
  const qc = useQueryClient();
  const { setBalance } = useSession();

  const [winChance, setWinChance] = useState(50);
  const [bet, setBet] = useState(5);

  // CSS rotate in degrees; 0 = marker at top. 0% value = bottom = 180° rotation.
  // value 0..100 → rotation = 180 + value*3.6 (CW)
  const valueToRotation = (v: number) => 180 - (v / 100) * 360;

  const [arrowAngle, setArrowAngle] = useState(valueToRotation(0));
  const [spinning, setSpinning] = useState(false);
  const [spinDur, setSpinDur] = useState(6.5);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [history, setHistory] = useState<{ roll: number; won: boolean }[]>([]);

  const multiplier = useMemo(() => (100 - HOUSE_EDGE) / winChance, [winChance]);
  const profitOnWin = useMemo(() => Number((bet * multiplier - bet).toFixed(2)), [bet, multiplier]);
  const payoutOnWin = useMemo(() => Number((bet * multiplier).toFixed(2)), [bet, multiplier]);

  // SVG angles for the win-zone arc: from 0% (bottom, 180°) to winChance%
  const startSvgAngle = valueToSvgAngle(0); // 180
  const endSvgAngle = valueToSvgAngle(winChance); // decreases with value
  const targetSvgAngle = valueToSvgAngle(winChance);

  const trigger = () => {
    if (spinning) return;
    setSpinning(true);
    setLastRoll(null);
    setLastWon(null);

    api
      .diceBet({ target: winChance, direction: 'under', amount: bet })
      .then((data: any) => {
        // Запускаем анимацию, но НЕ трогаем UI/баланс до её окончания
        const finalRotation = valueToRotation(data.roll);
        const currentNorm = ((arrowAngle % 360) + 360) % 360;
        const targetNorm = ((finalRotation % 360) + 360) % 360;
        let delta = targetNorm - currentNorm;
        if (delta < 0) delta += 360;
        const turns = 5 + Math.floor(Math.random() * 3); // 5..7 полных оборотов
        const dur = 4.8 + Math.random() * 1.2; // 4.8..6.0 сек — медленнее и затяжнее
        setSpinDur(dur);
        setArrowAngle(arrowAngle + turns * 360 + delta);

        // Только после полной остановки показываем результат и обновляем баланс
        setTimeout(() => {
  setSpinning(false);
  setLastRoll(data.roll);
  setLastWon(data.won);
  setHistory((h) => [{ roll: data.roll, won: data.won }, ...h].slice(0, 12));
          }, dur * 1000 + 200);

          // delayed balance + invalidation to avoid leaking the result
          setTimeout(() => {
  setBalance(data.balance);
  qc.invalidateQueries({ queryKey: ['wallet'] });
  qc.invalidateQueries({ queryKey: ['me'] });
  qc.invalidateQueries({ queryKey: ['missions'] });
  qc.invalidateQueries({ queryKey: ['tournament'] });
  qc.invalidateQueries({ queryKey: ['vip'] });
          }, dur * 1000 + 6500);
      })
      .catch((e: any) => {
        toast.error(e.message);
        setSpinning(false);
      });
  };

  const tickValues = Array.from({ length: 11 }, (_, i) => i * 10);

  // Marker position in container %: placed at top edge of a square container, at radius R_RING
  // R_RING/SIZE = 175/460 = 0.38043; center of marker is 50% - 38.043% = 11.957% from top
  // Ring width = (R_OUT-R_IN)/SIZE = 40/460 = 8.696% of container
  const MARKER_TOP_PCT = (50 - (R_RING / SIZE) * 100 - ((R_OUT - R_IN) / SIZE) * 50).toFixed(3);
  const MARKER_HEIGHT_PCT = (((R_OUT - R_IN) / SIZE) * 100).toFixed(3);

  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-panel to-bg p-4 relative overflow-hidden">
          <div className="relative w-full mx-auto aspect-square" style={{ maxWidth: 520 }}>
            {/* SVG ring + ticks + labels */}
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 w-full h-full">
              <defs>
                <radialGradient id="upgBg" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="#16161e" />
                  <stop offset="100%" stopColor="#050508" />
                </radialGradient>
                <linearGradient id="winGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.95" />
                </linearGradient>
                <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <circle cx={CX} cy={CY} r={R_OUT + 22} fill="url(#upgBg)" stroke="#1a1a22" strokeWidth="1" />
              <circle cx={CX} cy={CY} r={R_OUT + 14} fill="none" stroke="#22222e" strokeWidth="1" />

              {/* lose-zone ring (full circle) */}
              <circle
                cx={CX}
                cy={CY}
                r={R_RING}
                fill="none"
                stroke="#1a1a22"
                strokeWidth={R_OUT - R_IN}
              />

              {/* win-zone arc from 0% (bottom) clockwise to winChance% */}
              {winChance > WIN_MIN && (
                <path
                  d={arcPath(startSvgAngle, endSvgAngle, R_OUT, R_IN)}
                  fill="url(#winGrad)"
                  filter="url(#softGlow)"
                />
              )}

              {/* ticks + labels */}
              {tickValues.map((p) => {
                const a = valueToSvgAngle(p);
                const isMajor = p % 50 === 0;
                const [x1, y1] = polar(R_OUT + 4, a);
                const [x2, y2] = polar(R_OUT + (isMajor ? 18 : 11), a);
                const [lx, ly] = polar(R_OUT + 32, a);
                return (
                  <g key={p}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isMajor ? '#f5c542' : '#555'}
                      strokeWidth={isMajor ? 2 : 1}
                    />
                    {p !== 100 && (
                      <text
                        x={lx}
                        y={ly}
                        fill={isMajor ? '#f5c542' : '#7a7a86'}
                        fontSize={isMajor ? 12 : 10}
                        fontWeight={isMajor ? 800 : 600}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {p}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* target boundary marker */}
              <line
                x1={polar(R_OUT + 2, targetSvgAngle)[0]}
                y1={polar(R_OUT + 2, targetSvgAngle)[1]}
                x2={polar(R_IN - 6, targetSvgAngle)[0]}
                y2={polar(R_IN - 6, targetSvgAngle)[1]}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeDasharray="3 2"
                opacity="0.7"
              />

              {/* center text */}
              <text
                x={CX}
                y={CY - 55}
                fill="#7a7a86"
                fontSize="10"
                textAnchor="middle"
                letterSpacing="3"
                fontWeight="600"
              >
                WIN CHANCE
              </text>
              <text
                x={CX}
                y={CY - 12}
                fill="#22c55e"
                fontSize="42"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {winChance.toFixed(winChance < 1 ? 2 : 1)}%
              </text>
              <text
                x={CX}
                y={CY + 34}
                fill="#f5c542"
                fontSize="20"
                fontWeight="800"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {multiplier.toFixed(multiplier >= 100 ? 0 : 2)}×
              </text>
            </svg>

            {/* rotating slider marker */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ transformOrigin: '50% 50%', willChange: 'transform', zIndex: 5 }}
              animate={{ rotate: arrowAngle }}
              transition={
                spinning
                  ? { duration: spinDur, ease: [0.15, 0.7, 0.25, 1] }
                  : { duration: 0 }
              }
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: `${MARKER_TOP_PCT}%`,
                  width: 6,
                  height: `${MARKER_HEIGHT_PCT}%`,
                  marginLeft: -3,
                  borderRadius: 3,
                  background:
                    'linear-gradient(180deg, #f5c542 0%, #ffffff 50%, #f5c542 100%)',
                  boxShadow:
                    '0 0 16px rgba(245,197,66,0.95), 0 0 6px rgba(255,255,255,0.9)',
                }}
              />
            </motion.div>

            {/* result flash */}
            <AnimatePresence>
              {lastWon != null && !spinning && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-0 flex justify-center pointer-events-none"
                  style={{ bottom: '2%' }}
                >
                  <div
                    className={`px-6 py-2 rounded-full text-sm font-black ${
                      lastWon
                        ? 'bg-success/20 border-2 border-success text-success shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                        : 'bg-danger/20 border-2 border-danger text-danger shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                    }`}
                  >
                    {lastWon
                      ? `WIN · +${(payoutOnWin - bet).toFixed(2)} RC`
                      : `LOST · −${bet.toFixed(2)} RC`}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-4">
          <div className="grid grid-cols-6 gap-1">
            {[0.1, 5, 25, 50, 75, 82.5].map((p) => (
              <button
                key={p}
                onClick={() => setWinChance(p)}
                disabled={spinning}
                className={`py-2 rounded text-xs font-bold disabled:opacity-50 transition ${
                  winChance === p
                    ? 'bg-success text-black shadow-[0_0_16px_rgba(34,197,94,0.5)]'
                    : 'bg-bg border border-border hover:border-success'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>
                Win chance:{' '}
                <b className="text-white">{winChance.toFixed(winChance < 1 ? 2 : 1)}%</b>
              </span>
              <span>
                Multiplier:{' '}
                <b className="text-gold">
                  {multiplier.toFixed(multiplier >= 100 ? 0 : 2)}×
                </b>
              </span>
            </div>
            <input
              type="range"
              min={WIN_MIN}
              max={WIN_MAX}
              step={0.1}
              value={winChance}
              onChange={(e) => setWinChance(+e.target.value)}
              disabled={spinning}
              className="w-full accent-success"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>{WIN_MIN}%</span>
              <span>{WIN_MAX}%</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="flex gap-1">
              {[1, 5, 25, 100, 500].map((c) => (
                <button
                  key={c}
                  onClick={() => setBet(c)}
                  disabled={spinning}
                  className={`flex-1 py-2 rounded text-xs font-bold disabled:opacity-50 transition ${
                    bet === c
                      ? 'bg-gold text-black'
                      : 'bg-bg border border-border hover:border-gold'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0.1}
              max={500}
              step={0.1}
              value={bet}
              onChange={(e) => setBet(Math.max(0.1, Math.min(500, +e.target.value)))}
              disabled={spinning}
              className="bg-bg border border-border rounded px-3 py-2 text-center font-mono"
            />
          </div>

          <button
            onClick={trigger}
            disabled={spinning}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-neon to-accent font-black text-lg disabled:opacity-50 shadow-neon"
          >
            {spinning
              ? 'SPINNING…'
              : `UPGRADE  ·  ${bet.toFixed(2)} RC  →  ${payoutOnWin.toFixed(2)} RC`}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-3">
          <div className="text-xs text-gray-400">Summary</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-black/30 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">
                Multiplier
              </div>
              <div className="text-lg font-black text-gold">
                {multiplier.toFixed(multiplier >= 100 ? 0 : 2)}×
              </div>
            </div>
            <div className="rounded-lg border border-border bg-black/30 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">
                Win chance
              </div>
              <div className="text-lg font-black text-success">
                {winChance.toFixed(winChance < 1 ? 2 : 1)}%
              </div>
            </div>
            <div className="rounded-lg border border-border bg-black/30 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">Profit</div>
              <div className="text-lg font-black text-success">
                +{profitOnWin.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-black/30 p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">
                House edge
              </div>
              <div className="text-lg font-black text-gray-400">1%</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">History</div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <div
                key={i}
                className={`px-2 py-1 rounded font-mono text-xs font-bold ${
                  h.won
                    ? 'bg-success/20 text-success border border-success/50'
                    : 'bg-danger/20 text-danger border border-danger/50'
                }`}
              >
                {h.roll.toFixed(2)}
              </div>
            ))}
            {!history.length && <span className="text-xs text-gray-500">—</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 text-xs space-y-2">
          <div className="font-semibold text-sm">Provably fair</div>
          <div className="text-gray-500">
            roll = HMAC-SHA256(serverSeed, clientSeed:nonce:0) → uint32 / 2³² × 100
          </div>
          <div className="text-gray-500">roll &lt; winChance → WIN</div>
        </div>
      </aside>
    </div>
  );
}
