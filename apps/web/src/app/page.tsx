'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { GameCard } from '@/components/GameCard';
import { LiveTicker } from '@/components/LiveTicker';

export default function HomePage() {
  const { t } = useTranslation();
  const games = useQuery({ queryKey: ['games', 'top'], queryFn: () => api.games() });

  return (
    <div className="space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden border border-border p-8 md:p-14 bg-gradient-to-br from-neon/20 via-panel to-accent/10"
      >
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-accent mb-2">Research Prototype</div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
            Play. Research.{' '}
            <span className="bg-gradient-to-r from-neon to-gold bg-clip-text text-transparent">No real money.</span>
          </h1>
          <p className="mt-4 text-gray-300 max-w-xl">{t('tagline')}</p>
          <div className="mt-6 flex gap-3">
            <Link href="/lobby" className="px-6 py-3 rounded-lg bg-neon hover:bg-neon/80 font-semibold shadow-neon">
              {t('play')}
            </Link>
            <Link href="/register" className="px-6 py-3 rounded-lg border border-border hover:border-accent">
              {t('register')}
            </Link>
          </div>
        </div>
      </motion.section>

      <LiveTicker />

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-2xl font-bold">Top games</h2>
          <Link href="/lobby" className="text-sm text-accent hover:underline">See all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {(games.data ?? []).slice(0, 10).map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      </section>
    </div>
  );
}
