'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';

function KPI({
  label, value, accent = '', hint,
}: { label: string; value: string; accent?: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-panel p-4"
    >
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`text-2xl font-black mt-1 ${accent}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </motion.div>
  );
}

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['adminDash'], queryFn: api.adminDashboard, refetchInterval: 15_000 });
  const d = q.data;

  if (q.isLoading) return <div className="text-gray-400">Loading dashboard…</div>;
  if (q.error) return <div className="text-danger">{(q.error as any).message}</div>;
  if (!d) return null;

  const maxBar = Math.max(1, ...d.activity.map((b: any) => b.rounds));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-400">Live metrics — last 24 hours</p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Users total" value={String(d.users.total)} hint={`${d.users.active} active`} />
        <KPI label="Rounds (24h)" value={String(d.last24h.rounds)} />
        <KPI label="Bets (24h)" value={String(d.last24h.bets)} />
        <KPI
          label="GGR (24h)"
          value={`${d.last24h.ggr.toFixed(2)} RC`}
          accent={d.last24h.ggr >= 0 ? 'text-success' : 'text-danger'}
          hint="wagered − paid out"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-sm font-semibold mb-3">Wagered vs Paid (24h)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-gray-500">Wagered</div>
              <div className="text-lg font-black">{d.last24h.wagered.toFixed(2)} RC</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">Paid out</div>
              <div className="text-lg font-black text-success">{d.last24h.paidOut.toFixed(2)} RC</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">GGR</div>
              <div className={`text-lg font-black ${d.last24h.ggr >= 0 ? 'text-success' : 'text-danger'}`}>
                {d.last24h.ggr.toFixed(2)} RC
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">NGR</div>
              <div className="text-lg font-black">{d.last24h.ngr.toFixed(2)} RC</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-sm font-semibold mb-3">Top bet types</div>
          <div className="space-y-2">
            {d.topBetTypes.map((t: any) => (
              <div key={t.betType} className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-black/40 border border-border font-mono">{t.betType}</span>
                <span className="text-gray-400">{t.count} × </span>
                <span className="text-gold font-bold">{t.wagered.toFixed(2)} RC</span>
              </div>
            ))}
            {!d.topBetTypes.length && <div className="text-xs text-gray-500">No bets yet</div>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-panel p-4">
        <div className="text-sm font-semibold mb-3">Rounds per hour (24h)</div>
        <div className="flex items-end gap-1 h-40">
          {d.activity.map((b: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-gradient-to-t from-neon/60 to-accent"
                style={{ height: `${(b.rounds / maxBar) * 100}%`, minHeight: b.rounds ? 4 : 1 }}
                title={`hour ${b.hour}: ${b.rounds} rounds, net ${b.net.toFixed(2)} RC`}
              />
              <div className="text-[8px] text-gray-500">{i % 3 === 0 ? b.hour : ''}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-panel p-4">
        <div className="text-sm font-semibold mb-3">Recent wins</div>
        <div className="grid gap-1 max-h-64 overflow-y-auto">
          {d.recentWins.map((w: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs border-b border-border/40 py-1.5">
              <span className="text-gray-300">{w.username}</span>
              <span className="text-gray-500">{w.gameSlug}</span>
              <span className="text-success font-bold">+{w.amount.toFixed(2)} RC</span>
              <span className="text-gray-500">{new Date(w.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
          {!d.recentWins.length && <div className="text-xs text-gray-500">No wins yet</div>}
        </div>
      </section>
    </div>
  );
}
