'use client';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-panel/60">
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm text-gray-400">
        <div>
          <div className="font-bold text-white mb-2">Research Casino</div>
          <p className="text-xs">Research prototype. Virtual currency only. No real-money gambling.</p>
        </div>
        <div>
          <div className="text-white mb-2">Games</div>
          <ul className="space-y-1">
            <li><Link href="/lobby?category=slots" className="hover:text-white">Slots</Link></li>
            <li><Link href="/lobby?category=roulette" className="hover:text-white">Roulette</Link></li>
            <li><Link href="/lobby?category=crash" className="hover:text-white">Crash</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-white mb-2">Info</div>
          <ul className="space-y-1">
            <li><Link href="/responsible" className="hover:text-white">Responsible Gaming</Link></li>
            <li><Link href="/help" className="hover:text-white">Help</Link></li>
            <li><Link href="/about" className="hover:text-white">About</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-white mb-2">Legal</div>
          <ul className="space-y-1">
            <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
            <li><Link href="/responsible" className="hover:text-white">RG Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-3 text-center text-[11px] text-gray-500">
        © {new Date().getFullYear()} Research Casino — Research prototype. Virtual currency only.
      </div>
    </footer>
  );
}
