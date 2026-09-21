'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { useEffect } from 'react';

const ALLOWED = ['ADMIN', 'SUPERADMIN', 'RISK', 'SUPPORT', 'MODERATOR'];

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/games', label: 'Games', icon: '🎮' },
  { href: '/admin/ledger', label: 'Ledger', icon: '📒' },
  { href: '/admin/audit', label: 'Audit log', icon: '🛡' },
  { href: '/admin/security', label: 'Security', icon: '⚠' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, setUser } = useSession();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false });
  useEffect(() => { if (me.data) setUser(me.data); }, [me.data, setUser]);

  const role = user?.role;
  const allowed = role && ALLOWED.includes(role);

  if (me.isLoading) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="max-w-md mx-auto mt-20 rounded-2xl border border-danger/40 bg-panel p-8 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-danger">Access denied</h1>
        <p className="text-sm text-gray-400 mt-2">
          This area is restricted to operators. Your role: <b>{role ?? 'guest'}</b>.
        </p>
        <Link href="/" className="inline-block mt-4 text-neon hover:underline">← Back to lobby</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-border bg-panel p-3 h-fit sticky top-24">
        <div className="px-3 py-2 mb-2">
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Operator</div>
          <div className="text-sm font-bold">Admin Console</div>
        </div>
        <nav className="grid gap-1">
          {NAV.map((n) => {
            const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? 'bg-neon/20 border border-neon/50 text-white'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <span>{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 px-3 py-2 rounded-lg bg-black/30 text-[10px] text-gray-500">
          Research prototype.<br />No real money.
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
