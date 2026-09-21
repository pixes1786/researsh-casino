'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';

const COLORS = ['#b45309', '#94a3b8', '#f5c542', '#a5b4fc', '#67e8f9'];

export function VIPProgress() {
  const { user } = useSession();
  const q = useQuery({ queryKey: ['vip'], queryFn: api.promoVip, enabled: !!user });
  const d = q.data;
  if (!user) return null;
  if (!d) return <div className="text-sm text-gray-500">Loading VIP…</div>;

  const color = COLORS[d.current.level - 1] ?? COLORS[0];

  return (
    <div className="rounded-2xl border border-border bg-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">VIP tier</div>
          <div className="text-xl font-black" style={{ color }}>{d.current.name}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Loyalty points</div>
          <div className="text-lg font-bold text-gold">{d.loyaltyPts}</div>
        </div>
      </div>

      {d.next && (
        <>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{d.wagered.toFixed(0)} RC wagered</span>
            <span>{d.next.threshold.toFixed(0)} RC → {d.next.name}</span>
          </div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <motion.div
              className="h-full"
              style={{ background: `linear-gradient(90deg, ${color}, #a855f7)` }}
              initial={{ width: 0 }}
              animate={{ width: `${d.progressToNext}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{d.progressToNext}% to {d.next.name}</div>
        </>
      )}

      <div className="mt-5 grid grid-cols-5 gap-1">
        {d.levels.map((l: any) => {
          const reached = d.wagered >= l.threshold;
          const current = l.level === d.current.level;
          return (
            <div
              key={l.level}
              className={`rounded-lg p-2 text-center text-[10px] border ${
                current ? 'border-gold bg-gold/10'
                  : reached ? 'border-success/50 bg-success/5'
                  : 'border-border'
              }`}
            >
              <div className="font-bold" style={{ color: COLORS[l.level - 1] }}>{l.name}</div>
              <div className="text-gray-500 mt-0.5">{(l.threshold / 1000).toFixed(0)}k</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
