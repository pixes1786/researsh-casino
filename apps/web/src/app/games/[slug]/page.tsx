'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';

export default function GameEntry() {
  const { slug } = useParams<{ slug: string }>();
  const r = useRouter();
  const g = useQuery({ queryKey: ['game', slug], queryFn: () => api.game(slug) });

  useEffect(() => {
    const routes: Record<string, string> = {
      'european-roulette': '/games/european-roulette',
      'dice-x': '/games/dice',
      'crash-x': '/games/crash',
      'mines-rc': '/games/mines',
      'neon-fruits': '/games/slots',
      'aurora-blackjack': '/games/blackjack',
    };
    const dest = routes[slug as string];
    if (dest) r.replace(dest);
  }, [slug, r]);

  if (g.isLoading) return <div className="text-gray-400">Loading…</div>;
  if (!g.data) return <div>Not found</div>;

  return (
    <div className="rounded-xl border border-border bg-panel p-8">
      <h1 className="text-2xl font-bold">{g.data.name}</h1>
      <p className="text-gray-400 mt-2">
        {g.data.category} · {g.data.provider?.name} · RTP {g.data.rtp}%
      </p>
      <p className="mt-6 text-sm text-gray-300">
        This game is a placeholder in the research prototype. Only European Roulette is fully playable at this stage.
      </p>
    </div>
  );
}
