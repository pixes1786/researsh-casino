'use client';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

// 37 = «00»
const ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
];
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

function labelOf(n: number) {
  return n === 37 ? '00' : String(n);
}

export function RouletteWheel({ spinning, outcome }: { spinning: boolean; outcome: number | null }) {
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(4);
  const lastOutcome = useRef<number | null>(null);

  useEffect(() => {
    if (outcome == null || outcome === lastOutcome.current) return;
    lastOutcome.current = outcome;
    const idx = ORDER.indexOf(outcome);
    const targetNorm = ((-idx * STEP) % 360 + 360) % 360;
    const currentNorm = ((rotation % 360) + 360) % 360;
    let delta = targetNorm - currentNorm;
    if (delta < 0) delta += 360;
    const turns = 6 + Math.floor(Math.random() * 4);
    const dur = 4 + Math.random() * 1.8;
    setDuration(dur);
    setRotation((prev) => prev + turns * 360 + delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      <div className="relative aspect-square w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[28px] border-l-transparent border-r-transparent border-t-gold drop-shadow-[0_0_10px_rgba(245,197,66,0.9)]" />
        </div>

        <motion.div
          className="absolute inset-0"
          style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
          animate={{ rotate: rotation }}
          transition={{ duration: spinning ? duration : 0, ease: [0.1, 0.85, 0.15, 1] }}
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full block">
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

            <circle cx={CX} cy={CY} r={R_RIM_OUT} fill="url(#rimGold)" filter="url(#goldGlow)" />
            <circle cx={CX} cy={CY} r={R_RIM_IN} fill="#0a0a12" />

            {ORDER.map((n, i) => {
              const a1 = i * STEP - HALF;
              const a2 = i * STEP + HALF;
              const isGreen = n === 0 || n === 37;
              const color = isGreen ? '#16a34a' : RED.has(n) ? '#b91c1c' : '#0c0c14';
              return (
                <path
                  key={`seg-${n}`}
                  d={arcPath(a1, a2, R_TRACK_IN, R_TRACK_OUT)}
                  fill={color}
                  stroke="#f5c542"
                  strokeWidth="0.5"
                  strokeOpacity="0.45"
                />
              );
            })}

            {ORDER.map((n, i) => {
              const angle = i * STEP;
              const [x, y] = polar((R_TRACK_IN + R_TRACK_OUT) / 2 - 2, angle);
              return (
                <text
                  key={`label-${n}`}
                  x={x}
                  y={y}
                  fill="#fafafa"
                  fontSize={n === 37 ? 12 : 14}
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${angle} ${x} ${y})`}
                  style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.7 }}
                >
                  {labelOf(n)}
                </text>
              );
            })}

            <circle cx={CX} cy={CY} r={R_HUB} fill="url(#hubGrad)" stroke="#d4af37" strokeWidth="2" />
            <circle cx={CX} cy={CY} r={R_HUB - 8} fill="none" stroke="#f5c542" strokeWidth="0.6" opacity="0.5" />

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
      </div>
    </div>
  );
}
