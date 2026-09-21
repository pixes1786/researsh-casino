'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { useEffect, useState } from 'react';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function Stat({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`text-lg font-black mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useSession();
  const [tab, setTab] = useState<'bets' | 'rounds' | 'ledger'>('bets');

  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile, retry: false });
  const bets = useQuery({ queryKey: ['myBets'], queryFn: () => api.myBets(50), enabled: tab === 'bets' });
  const rounds = useQuery({ queryKey: ['myRounds'], queryFn: () => api.myRounds(30), enabled: tab === 'rounds' });
  const ledger = useQuery({ queryKey: ['ledger'], queryFn: api.ledger, enabled: tab === 'ledger' });

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center text-gray-400">
        <p>Please <Link href="/login" className="text-neon underline">login</Link> to view your profile.</p>
      </div>
    );
  }

  const p = profile.data;
  const initials = (p?.username ?? user.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/profile/security"
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-neon"
        >
          🔒 Security & 2FA
        </Link>
      </div>
      {/* Hero card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-gradient-to-br from-neon/15 via-panel to-accent/10 p-6"
      >
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neon to-accent grid place-items-center text-2xl font-black text-white shadow-neon">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold truncate">{p?.username ?? user.username}</div>
            <div className="text-sm text-gray-400 truncate">{p?.email}</div>
            <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-border uppercase tracking-wide">
                {p?.role ?? user.role}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-border">
                KYC: {p?.kycStatus ?? '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-border">
                VIP {p?.vipLevel ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-black/40 border border-border">
                {p?.loyaltyPts ?? 0} pts
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-gray-500">Balance</div>
            <div className="text-2xl font-black text-gold">
              {(p?.balance ?? 0).toFixed(2)} <span className="text-sm">RC</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Rounds played" value={String(p?.stats.roundsPlayed ?? 0)} />
        <Stat label="Total bets" value={String(p?.stats.totalBets ?? 0)} />
        <Stat label="Wagered" value={`${(p?.stats.totalWagered ?? 0).toFixed(2)} RC`} />
        <Stat
          label="Net P/L"
          value={`${(p?.stats.netProfit ?? 0) >= 0 ? '+' : ''}${(p?.stats.netProfit ?? 0).toFixed(2)} RC`}
          accent={(p?.stats.netProfit ?? 0) >= 0 ? 'text-success' : 'text-danger'}
        />
      </section>

      {/* Tabs */}
      <section className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="flex border-b border-border">
          {(['bets', 'rounds', 'ledger'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold transition ${
                tab === t ? 'text-white border-b-2 border-neon' : 'text-gray-400 hover:text-white'
              }`}
            >{t === 'bets' ? 'My bets' : t === 'rounds' ? 'Rounds' : 'Ledger'}</button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'bets' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="text-left py-2">Time</th>
                    <th className="text-left">Type</th>
                    <th className="text-right">Bet</th>
                    <th className="text-right">Payout</th>
                    <th className="text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(bets.data ?? []).map((b: any) => (
                    <tr key={b.id} className="border-t border-border/50">
                      <td className="py-2 text-gray-400 text-xs">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="text-xs">{b.betType}</td>
                      <td className="text-right">{b.amount.toFixed(2)}</td>
                      <td className="text-right">{b.payout.toFixed(2)}</td>
                      <td className={`text-right font-bold ${b.won ? 'text-success' : 'text-danger'}`}>
                        {b.won ? 'WIN' : 'LOSS'}
                      </td>
                    </tr>
                  ))}
                  {!bets.data?.length && <tr><td colSpan={5} className="py-6 text-center text-gray-500 text-xs">No bets yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'rounds' && (
            <div className="grid gap-2">
              {(rounds.data ?? []).map((r: any) => {
                const outcome = r.result?.outcome;
                const color = outcome === 0 ? 'bg-green-600' : RED.has(outcome) ? 'bg-red-600' : 'bg-zinc-800';
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-black/20 p-2">
                    <div className={`w-8 h-8 rounded-full grid place-items-center font-black text-xs ${color}`}>
                      {outcome}
                    </div>
                    <div className="flex-1 text-xs text-gray-400">
                      nonce {r.nonce} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-gray-400">bet {r.totalBet.toFixed(2)}</div>
                      <div className={r.totalWin > 0 ? 'text-success font-bold' : 'text-gray-500'}>
                        win {r.totalWin.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!rounds.data?.length && <div className="text-center text-xs text-gray-500 py-6">No rounds yet</div>}
            </div>
          )}

          {tab === 'ledger' && (
            <div className="grid gap-1">
              {(ledger.data ?? []).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between text-xs border-b border-border/40 py-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-border uppercase tracking-wide text-[10px]">
                      {e.type}
                    </span>
                    <span className="text-gray-400">{e.reason ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={e.amount >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                      {e.amount >= 0 ? '+' : ''}{e.amount.toFixed(2)}
                    </span>
                    <span className="text-gray-500 w-24 text-right">bal {e.balanceAfter.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {!ledger.data?.length && <div className="text-center text-xs text-gray-500 py-6">No transactions yet</div>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
