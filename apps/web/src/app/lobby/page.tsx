'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { GameCard } from '@/components/GameCard';

const CATS = ['all', 'slots', 'roulette', 'blackjack', 'crash', 'mines', 'live'];

export default function LobbyPage() {
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const q = `?${cat !== 'all' ? `category=${cat}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const games = useQuery({ queryKey: ['games', cat, search], queryFn: () => api.games(q) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              cat === c ? 'bg-neon border-neon text-white' : 'border-border hover:border-neon'
            }`}
          >{c}</button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full sm:w-auto sm:ml-auto bg-panel border border-border rounded px-3 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {(games.data ?? []).map((g) => <GameCard key={g.id} game={g} />)}
      </div>
      {games.isLoading && <div className="text-gray-400 text-sm">Loading…</div>}
    </div>
  );
}
