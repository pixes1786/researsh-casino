'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { toast } from 'sonner';

export function MissionsWidget() {
  const { user, setBalance } = useSession();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['missions'], queryFn: api.promoMissions, enabled: !!user });

  const claim = useMutation({
    mutationFn: (id: string) => api.promoClaimMission(id),
    onSuccess: (res: any) => {
      toast.success(`+${res.amount} RC`);
      setBalance(res.balance);
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) {
    return <div className="text-sm text-gray-500">Login to see daily missions.</div>;
  }

  return (
    <div className="grid gap-3">
      {(q.data ?? []).map((m: any) => {
        const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-4 ${
              m.claimed
                ? 'border-success/40 bg-success/5'
                : m.complete
                ? 'border-gold/60 bg-gold/5'
                : 'border-border bg-panel'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold text-sm">{m.title}</div>
                <div className="text-[11px] text-gray-500">{m.description}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Reward</div>
                <div className="text-sm font-bold text-gold">{m.reward} RC</div>
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <motion.div
                className={`h-full ${m.claimed ? 'bg-success' : m.complete ? 'bg-gold' : 'bg-neon'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="text-[11px] text-gray-500">{m.progress} / {m.target}</div>
              {m.claimed ? (
                <span className="text-[11px] text-success font-bold">✓ Claimed</span>
              ) : m.complete ? (
                <button
                  onClick={() => claim.mutate(m.id)}
                  disabled={claim.isPending}
                  className="text-[11px] px-3 py-1 rounded bg-gold text-black font-bold disabled:opacity-50"
                >Claim {m.reward} RC</button>
              ) : (
                <span className="text-[11px] text-gray-500">{pct}%</span>
              )}
            </div>
          </motion.div>
        );
      })}
      {!q.data?.length && <div className="text-sm text-gray-500">No missions today.</div>}
    </div>
  );
}
