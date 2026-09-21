'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

const TYPES = ['', 'SIGNUP_BONUS', 'DAILY_BONUS', 'BET_DEBIT', 'BET_WIN', 'ADJUSTMENT', 'REFUND'];

export default function LedgerPage() {
  const [type, setType] = useState('');
  const q = useQuery({ queryKey: ['adminLedger', type], queryFn: () => api.adminLedger(type || undefined), refetchInterval: 15_000 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ledger</h1>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="bg-panel border border-border rounded px-3 py-2 text-sm">
          {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-[11px] uppercase tracking-widest text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-3">User</th>
                <th className="text-left px-3">Type</th>
                <th className="text-right px-3">Amount</th>
                <th className="text-right px-3">Balance after</th>
                <th className="text-left px-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((e: any) => (
                <tr key={e.id} className="border-t border-border/40 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-3 text-xs">
                    <div className="font-semibold">{e.username}</div>
                    <div className="text-gray-500">{e.email}</div>
                  </td>
                  <td className="px-3 text-xs">
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-border text-[10px] uppercase">{e.type}</span>
                  </td>
                  <td className={`px-3 text-right font-mono font-bold ${e.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                    {e.amount >= 0 ? '+' : ''}{e.amount.toFixed(2)}
                  </td>
                  <td className="px-3 text-right font-mono text-xs">{e.balanceAfter.toFixed(2)}</td>
                  <td className="px-3 text-xs text-gray-400">{e.reason ?? '—'}</td>
                </tr>
              ))}
              {!q.data?.length && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-xs">No entries</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
