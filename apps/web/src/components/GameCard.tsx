'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';

const EMOJI_BY_SLUG: Record<string, string> = {
  'dice-x': '⏱️',
  'gates-of-olympus': '⚡',
};

const EMOJI: Record<string, string> = {
  slots: '🎰',
  roulette: '🎡',
  blackjack: '🃏',
  crash: '🚀',
  mines: '💎',
  live: '📺',
  baccarat: '🎴',
  poker: '♠️',
  dice: '⏱️',
  speedometer: '⏱️',
  jackpot: '💰',
  'table-games': '🎯',
};

const PALETTE: Record<string, [string, string]> = {
  slots:       ['#7c3aed', '#06b6d4'],
  roulette:    ['#dc2626', '#f59e0b'],
  blackjack:   ['#0f766e', '#065f46'],
  crash:       ['#ec4899', '#7c3aed'],
  mines:       ['#0891b2', '#0e7490'],
  live:        ['#a855f7', '#ec4899'],
  dice:        ['#22c55e', '#065f46'],
  speedometer: ['#22c55e', '#065f46'],
};

export function GameCard({ game }: { game: any }) {
  const [c1, c2] = PALETTE[game.category] ?? PALETTE[game.slug] ?? ['#3f3f46', '#18181b'];
  const emoji = EMOJI_BY_SLUG[game.slug] ?? EMOJI[game.category] ?? '🎮';

  return (
    <motion.div whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }} className="group">
      <Link
        href={`/games/${game.slug}`}
        className="block rounded-2xl overflow-hidden border border-border bg-panel hover:border-neon transition shadow-lg hover:shadow-neon"
      >
        <div
          className="aspect-[4/5] relative overflow-hidden"
          style={{ background: `radial-gradient(circle at 30% 20%, ${c1}, ${c2} 80%)` }}
        >
          <div
            className="absolute -bottom-12 -right-12 w-40 h-40 rounded-full opacity-30 blur-2xl"
            style={{ background: c1 }}
          />
          <div
            className="absolute -top-10 -left-10 w-32 h-32 rounded-full opacity-25 blur-2xl"
            style={{ background: '#fff' }}
          />

          <div className="absolute inset-0 grid place-items-center">
            <motion.div
              whileHover={{ scale: 1.12 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="text-7xl drop-shadow-[0_6px_20px_rgba(0,0,0,0.55)] will-change-transform"
              style={{ transformOrigin: '50% 50%' }}
            >
              {emoji}
            </motion.div>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="text-sm font-bold text-white truncate drop-shadow">{game.name}</div>
          </div>

          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] text-accent border border-white/10">
            {game.provider?.name}
          </div>

          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] text-gold border border-white/10">
            ★ {game.rating.toFixed(1)}
          </div>

          <div className="absolute bottom-12 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {game.playersNow}
          </div>
        </div>

        <div className="p-3 flex justify-between text-[11px] text-gray-400">
          <span>RTP {game.rtp}%</span>
          <span className="uppercase tracking-wide">{game.volatility}</span>
        </div>
      </Link>
    </motion.div>
  );
}
