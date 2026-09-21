'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function ProvablyFairPanel({ seed }: { seed: any }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [clientSeed, setClientSeed] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => { if (seed?.clientSeed) setClientSeed(seed.clientSeed); }, [seed?.clientSeed]);

  const setClient = useMutation({
    mutationFn: () => api.rouletteSetClient(clientSeed),
    onSuccess: () => {
      toast.success('Client seed updated');
      qc.invalidateQueries({ queryKey: ['rouletteSeed'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rotate = useMutation({
    mutationFn: () => api.rouletteRotate(),
    onSuccess: (data: any) => {
      setRevealed(data.revealedServerSeed);
      toast.success('Seed rotated & revealed');
      qc.invalidateQueries({ queryKey: ['rouletteSeed'] });
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-panel p-4 space-y-3 text-xs">
      <div className="font-semibold text-sm">{t('provably_fair')}</div>
      <div>
        <div className="text-gray-400">{t('server_seed')} hash</div>
        <div className="break-all font-mono text-[10px]">{seed?.serverSeedHash ?? '—'}</div>
      </div>
      <div>
        <div className="text-gray-400">{t('client_seed')}</div>
        <div className="flex gap-2 mt-1">
          <input
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            className="flex-1 bg-bg border border-border rounded px-2 py-1 font-mono text-[11px]"
          />
          <button
            onClick={() => setClient.mutate()}
            className="px-2 rounded border border-border hover:border-neon"
          >Save</button>
        </div>
      </div>
      <div className="flex justify-between text-gray-400">
        <span>Nonce</span><span>{seed?.nonce ?? 0}</span>
      </div>
      <button
        onClick={() => rotate.mutate()}
        className="w-full py-1.5 rounded border border-border hover:border-gold text-gold"
      >Rotate &amp; reveal</button>
      {revealed && (
        <div className="rounded bg-black/40 p-2">
          <div className="text-gray-400 mb-1">Revealed server seed</div>
          <div className="font-mono text-[10px] break-all">{revealed}</div>
        </div>
      )}
    </div>
  );
}
