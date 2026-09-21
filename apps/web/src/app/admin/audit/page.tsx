'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function AuditPage() {
  const q = useQuery({ queryKey: ['adminAudit'], queryFn: api.adminAudit, refetchInterval: 20_000 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit log</h1>
        <div className="text-xs text-gray-500">immutable · {(q.data ?? []).length} latest</div>
      </div>

      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-[11px] uppercase tracking-widest text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-3">Actor</th>
                <th className="text-left px-3">Action</th>
                <th className="text-left px-3">Entity</th>
                <th className="text-left px-3">Reason</th>
                <th className="text-left px-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((a: any) => (
                <tr key={a.id} className="border-t border-border/40 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-3 text-xs font-semibold text-gold">{a.actor}</td>
                  <td className="px-3 text-xs">
                    <span className="px-2 py-0.5 rounded bg-black/40 border border-border text-[10px] uppercase">{a.action}</span>
                  </td>
                  <td className="px-3 text-xs text-gray-400">{a.entity}/{a.entityId.slice(0, 8)}…</td>
                  <td className="px-3 text-xs text-gray-400">{a.reason ?? '—'}</td>
                  <td className="px-3 text-xs text-gray-500">{a.ip ?? '—'}</td>
                </tr>
              ))}
              {!q.data?.length && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-xs">No audit entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
