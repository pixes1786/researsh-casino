'use client';
import { VIPProgress } from '@/components/VIPProgress';
import { useSession } from '@/lib/store';
import Link from 'next/link';

const PERKS: Record<number, string[]> = {
  1: ['Standard support', 'Access to all games'],
  2: ['Faster withdrawals (virtual)', 'Weekly reload +25%', 'Priority chat'],
  3: ['Personal host', 'Higher bet limits', 'Weekly cashback 5%'],
  4: ['Exclusive games', 'Weekly cashback 8%', 'Birthday bonus'],
  5: ['All Platinum perks', 'Concierge', 'Weekly cashback 10%', 'Custom avatar frame'],
};

export default function Page() {
  const { user } = useSession();
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header>
        <h1 className="text-3xl font-black">VIP Club</h1>
        <p className="text-sm text-gray-400">All perks are virtual. No real-money value.</p>
      </header>

      {user ? <VIPProgress /> : (
        <div className="rounded-2xl border border-border bg-panel p-5">
          <Link href="/login" className="text-neon hover:underline">Login</Link> to see your VIP tier.
        </div>
      )}

      <section className="grid gap-3">
        {[1, 2, 3, 4, 5].map((lvl) => (
          <div key={lvl} className="rounded-xl border border-border bg-panel p-4">
            <div className="font-bold mb-2">Level {lvl} perks</div>
            <ul className="text-xs text-gray-400 list-disc pl-5 space-y-0.5">
              {PERKS[lvl].map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
