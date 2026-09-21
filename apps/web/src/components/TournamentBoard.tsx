'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

export function TournamentBoard() {
  const q = useQuery({ queryKey: ['tournament'], queryFn: api.promoTournament, refetchInterval: 15_000 });
  const t = q.data;
  if (!t) return <div className="text-sm text-gray-500">Loading tournament…</div>;

  const now = Date.now();
  const end = new Date(t.endsAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));

  return (
    <div className="rounded-2xl border border-border bg-panel p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Weekly tournament</div>
          <div className="text-lg font-bold">{t.name}</div>
          <div className="text-xs text-gray-500 mt-1">Ends in {daysLeft} day{daysLeft === 1 ? '' : 's'}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Prize pool</div>
          <div className="text-xl font-black text-gold">{t.prizePool.toLocaleString()} RC</div>
        </div>
      </div>

      <div className="grid gap-1">
        {t.leaderboard.length === 0 && (
          <div className="text-center text-xs text-gray-500 py-4">
            No participants yet. Place a bet to enter!
          </div>
        )}
        {t.leaderboard.map((row: any) => (
          <motion.div
            key={row.rank}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              row.rank === 1 ? 'border-gold/60 bg-gold/5'
                : row.rank <= 3 ? 'border-border bg-black/30'
                : 'border-border/60'
            }`}
          >
            <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-black ${
              row.rank === 1 ? 'bg-gold text-black'
                : row.rank === 2 ? 'bg-gray-400 text-black'
                : row.rank === 3 ? 'bg-amber-700 text-white'
                : 'bg-black/40 text-gray-400'
            }`}>{row.rank}</div>
            <div className="flex-1 text-sm font-semibold truncate">{row.username}</div>
            <div className="text-xs text-gray-400">{row.wagered.toFixed(0)} RC</div>
            <div className={`text-xs font-bold ${row.prize > 0 ? 'text-gold' : 'text-gray-600'}`}>
              {row.prize > 0 ? `${row.prize.toFixed(0)} RC` : '—'}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
