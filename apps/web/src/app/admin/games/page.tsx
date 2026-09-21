'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function GamesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['adminGames'], queryFn: api.adminGames });

  const patch = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) => api.adminUpdateGame(id, patch),
    onSuccess: () => {
      toast.success('Game updated');
      qc.invalidateQueries({ queryKey: ['adminGames'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Games</h1>
      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-[11px] uppercase tracking-widest text-gray-500">
            <tr>
              <th className="text-left px-4 py-3">Game</th>
              <th className="text-left px-3">Category</th>
              <th className="text-left px-3">Provider</th>
              <th className="text-right px-3">RTP</th>
              <th className="text-right px-3">Players</th>
              <th className="text-center px-3">Active</th>
              <th className="px-3"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((g: any) => (
              <tr key={g.id} className="border-t border-border/40">
                <td className="px-4 py-2.5 font-semibold">{g.name}<div className="text-[11px] text-gray-500 font-mono">{g.slug}</div></td>
                <td className="px-3 text-xs">{g.category}</td>
                <td className="px-3 text-xs text-gray-400">{g.provider}</td>
                <td className="px-3 text-right">
                  <input
                    type="number" step="0.1" min="80" max="99.9"
                    defaultValue={g.rtp}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== g.rtp) patch.mutate({ id: g.id, patch: { rtp: v, reason: 'RTP edit' } });
                    }}
                    className="w-20 bg-bg border border-border rounded px-2 py-1 text-right text-xs"
                  />
                </td>
                <td className="px-3 text-right text-xs">
                  <input
                    type="number" min="0"
                    defaultValue={g.playersNow}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== g.playersNow) patch.mutate({ id: g.id, patch: { playersNow: v, reason: 'players edit' } });
                    }}
                    className="w-20 bg-bg border border-border rounded px-2 py-1 text-right text-xs"
                  />
                </td>
                <td className="px-3 text-center">
                  <button
                    onClick={() => patch.mutate({ id: g.id, patch: { isActive: !g.isActive, reason: 'toggle' } })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      g.isActive ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                    }`}
                  >{g.isActive ? 'ON' : 'OFF'}</button>
                </td>
                <td className="px-3 text-right text-xs text-gray-500">★ {g.rating.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500">
        Изменения пишутся в AuditLog. RTP ограничен 80–99.9%.
      </div>
    </div>
  );
}
