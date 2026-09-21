'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

const ROLES = ['USER', 'MODERATOR', 'SUPPORT', 'RISK', 'ADMIN', 'SUPERADMIN'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED'];
const KYCS = ['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'];

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<'ledger' | 'bets' | 'sessions'>('ledger');

  const q = useQuery({ queryKey: ['adminUser', id], queryFn: () => api.adminUser(id) });

  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const patch = useMutation({
    mutationFn: (p: any) => api.adminUpdateUser(id, p),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['adminUser', id] });
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: () => api.adminAdjustBalance(id, Number(delta), reason),
    onSuccess: (r: any) => {
      toast.success(`Balance updated: ${r.newBalance.toFixed(2)} RC`);
      setDelta(''); setReason('');
      qc.invalidateQueries({ queryKey: ['adminUser', id] });
      qc.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="text-gray-400">Loading…</div>;
  if (q.error) return <div className="text-danger">{(q.error as any).message}</div>;
  const { user: u, ledger, bets, sessions } = q.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users" className="text-xs text-gray-500 hover:text-white">← Users</Link>
          <h1 className="text-2xl font-bold">{u.username}</h1>
          <p className="text-sm text-gray-400">{u.email}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Balance</div>
          <div className="text-2xl font-black text-gold">{u.balance.toFixed(2)} {u.currency}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-panel p-4 space-y-3">
          <div className="text-sm font-semibold">Access & status</div>

          <label className="block text-xs text-gray-400">Role</label>
          <select
            value={u.role}
            onChange={(e) => {
              const r = e.target.value;
              const why = prompt('Reason for role change?') ?? '';
              patch.mutate({ role: r, reason: why || undefined });
            }}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <label className="block text-xs text-gray-400 mt-2">Status</label>
          <select
            value={u.status}
            onChange={(e) => {
              const why = prompt('Reason?') ?? '';
              patch.mutate({ status: e.target.value, reason: why || undefined });
            }}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label className="block text-xs text-gray-400 mt-2">KYC</label>
          <select
            value={u.kycStatus}
            onChange={(e) => patch.mutate({ kycStatus: e.target.value, reason: 'KYC update' })}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
          >
            {KYCS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="text-[11px] text-gray-500 pt-2">
            Password hash (truncated): <code className="text-[10px] text-gray-400">{u.passwordHash.slice(0, 32)}…</code>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-4 space-y-3">
          <div className="text-sm font-semibold">Balance adjustment</div>
          <div className="text-xs text-gray-500">
            Every adjustment writes an immutable LedgerEntry + AuditLog.
          </div>

          <label className="block text-xs text-gray-400 mt-2">Delta (RC, negative to deduct)</label>
          <input
            value={delta} onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. 500 or -250"
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono"
          />
          <label className="block text-xs text-gray-400">Reason (required)</label>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. manual correction"
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => adjust.mutate()}
            disabled={!delta || !reason || adjust.isPending}
            className="w-full py-2 rounded bg-neon hover:bg-neon/80 font-semibold disabled:opacity-50"
          >{adjust.isPending ? '…' : 'Apply'}</button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="flex border-b border-border">
          {(['ledger', 'bets', 'sessions'] as const).map((t) => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold transition ${
                tab === t ? 'text-white border-b-2 border-neon' : 'text-gray-400 hover:text-white'
              }`}
            >{t}</button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'ledger' && (
            <div className="grid gap-1 text-xs">
              {ledger.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between border-b border-border/40 py-2">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-border text-[10px] uppercase">{e.type}</span>
                    <span className="text-gray-400">{e.reason}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={e.amount >= 0 ? 'text-success font-bold' : 'text-danger font-bold'}>
                      {e.amount >= 0 ? '+' : ''}{e.amount.toFixed(2)}
                    </span>
                    <span className="text-gray-500">bal {e.balanceAfter.toFixed(2)}</span>
                    <span className="text-gray-600">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {!ledger.length && <div className="py-6 text-center text-gray-500">No entries</div>}
            </div>
          )}

          {tab === 'bets' && (
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
                {bets.map((b: any) => (
                  <tr key={b.id} className="border-t border-border/40">
                    <td className="py-2 text-xs text-gray-500">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="text-xs">{b.betType}</td>
                    <td className="text-right">{b.amount.toFixed(2)}</td>
                    <td className="text-right">{b.payout.toFixed(2)}</td>
                    <td className={`text-right font-bold ${b.won ? 'text-success' : 'text-danger'}`}>
                      {b.won ? 'WIN' : 'LOSS'}
                    </td>
                  </tr>
                ))}
                {!bets.length && <tr><td colSpan={5} className="py-6 text-center text-gray-500 text-xs">No bets</td></tr>}
              </tbody>
            </table>
          )}

          {tab === 'sessions' && (
            <div className="grid gap-2 text-xs">
              {sessions.map((s: any) => (
                <div key={s.id} className="rounded-lg border border-border/60 bg-black/20 p-2">
                  <div className="text-gray-400 font-mono text-[10px] break-all">hash {s.serverSeedHash}</div>
                  <div className="flex justify-between mt-1 text-gray-500">
                    <span>nonce {s.nonce}</span>
                    <span>{s.revealedAt ? 'revealed' : 'active'}</span>
                    <span>{new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {!sessions.length && <div className="py-6 text-center text-gray-500">No sessions</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
