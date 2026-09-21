'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

const KINDS = ['', 'login_failed', 'login_success', 'mfa_failed', 'mfa_enabled', 'mfa_disabled', 'rate_limit'];
const SEVS = ['', 'info', 'warn', 'danger'];

const sevStyle: Record<string, string> = {
  info: 'bg-white/10 text-gray-300 border-border',
  warn: 'bg-gold/20 text-gold border-gold/50',
  danger: 'bg-danger/20 text-danger border-danger/50',
};

export default function SecurityPage() {
  const [kind, setKind] = useState('');
  const [severity, setSeverity] = useState('');

  const summary = useQuery({ queryKey: ['secSummary'], queryFn: api.adminSecuritySummary, refetchInterval: 20_000 });
  const list = useQuery({
    queryKey: ['adminSecurity', kind, severity],
    queryFn: () => api.adminSecurity({ kind, severity }),
    refetchInterval: 15_000,
  });

  const s = summary.data?.last24h;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security events</h1>
        <div className="text-xs text-gray-500">last 24h</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Total</div>
          <div className="text-2xl font-black">{s?.total ?? 0}</div>
        </div>
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Danger</div>
          <div className="text-2xl font-black text-danger">{s?.danger ?? 0}</div>
        </div>
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Warn</div>
          <div className="text-2xl font-black text-gold">{s?.warn ?? 0}</div>
        </div>
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Info</div>
          <div className="text-2xl font-black">{s?.info ?? 0}</div>
        </div>
      </div>

      {summary.data?.topKinds?.length > 0 && (
        <div className="rounded-2xl border border-border bg-panel p-4">
          <div className="text-xs text-gray-400 mb-2">Top kinds (24h)</div>
          <div className="flex flex-wrap gap-2">
            {summary.data.topKinds.map((k: any) => (
              <span key={k.kind} className="px-3 py-1 rounded-full bg-black/40 border border-border text-xs">
                <span className="font-mono">{k.kind}</span>
                <span className="text-gray-500 ml-2">{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-panel p-3 flex flex-wrap gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="bg-bg border border-border rounded px-3 py-2 text-sm">
          {KINDS.map((k) => <option key={k} value={k}>{k || 'All kinds'}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}
          className="bg-bg border border-border rounded px-3 py-2 text-sm">
          {SEVS.map((sv) => <option key={sv} value={sv}>{sv || 'All severities'}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-[11px] uppercase tracking-widest text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-3">Severity</th>
                <th className="text-left px-3">Kind</th>
                <th className="text-left px-3">User</th>
                <th className="text-left px-3">IP</th>
                <th className="text-left px-3">Meta</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((e: any) => (
                <tr key={e.id} className="border-t border-border/40 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sevStyle[e.severity]}`}>
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-3 text-xs font-mono">{e.kind}</td>
                  <td className="px-3 text-xs">
                    {e.username ? (
                      <>
                        <div className="font-semibold">{e.username}</div>
                        <div className="text-gray-500">{e.role}</div>
                      </>
                    ) : <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-3 text-xs text-gray-400">{e.ip ?? '—'}</td>
                  <td className="px-3 text-xs text-gray-500 max-w-md truncate font-mono">
                    {e.meta ? JSON.stringify(e.meta) : '—'}
                  </td>
                </tr>
              ))}
              {!list.data?.length && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-xs">No events</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
