'use client';
import { motion } from 'framer-motion';
import { MissionsWidget } from '@/components/MissionsWidget';
import { VIPProgress } from '@/components/VIPProgress';
import { TournamentBoard } from '@/components/TournamentBoard';

export default function Page() {
  const promos = [
    { emoji: '🎁', title: 'Welcome package', text: '+1 000 RC on signup, +500 RC after first bet', accent: 'from-neon/20' },
    { emoji: '☀️', title: 'Daily bonus', text: 'Claim once a day, streak up to 500 RC', accent: 'from-gold/20' },
    { emoji: '♻️', title: 'Weekly reload', text: '50% bonus in RC every Monday', accent: 'from-accent/20' },
    { emoji: '💸', title: 'Cashback', text: 'Up to 10% back on net losses, weekly', accent: 'from-success/20' },
    { emoji: '🎟', title: 'Free spins', text: '50 free spins in Neon Fruits, RC only', accent: 'from-danger/20' },
    { emoji: '🏆', title: 'Tournaments', text: 'Weekly race, 10 000 RC prize pool', accent: 'from-neon/20' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black">Promotions</h1>
        <p className="text-sm text-gray-400">All rewards are virtual RC. No real-money value.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {promos.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-2xl border border-border bg-gradient-to-br ${p.accent} to-panel p-5 hover:border-neon transition`}
          >
            <div className="text-4xl mb-2">{p.emoji}</div>
            <div className="font-bold">{p.title}</div>
            <div className="text-xs text-gray-400 mt-1">{p.text}</div>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold mb-3">Daily missions</h2>
          <MissionsWidget />
        </div>
        <div className="space-y-6">
          <VIPProgress />
          <TournamentBoard />
        </div>
      </section>
    </div>
  );
}
