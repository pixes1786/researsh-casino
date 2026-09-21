'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { useEffect, useRef, useState } from 'react';

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, setUser, balance, currency, setBalance } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ─── direct session bootstrap on mount — does NOT depend on any cache ───
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (me?.id) {
          // if server says a different user is logged in — replace local state
          if (user && user.id !== me.id) {
            setUser(me);
          } else if (!user) {
            setUser(me);
          }
        } else if (user) {
          // server has no session but we still think we're logged in — clear
          setUser(null);
        }
      })
      .catch(() => {
        if (!cancelled && user) setUser(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── periodic refresh (for balance sanity) ───
  const me = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    retry: false,
    refetchInterval: 20_000,
  });
  useEffect(() => {
    if (me.data) setUser(me.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: api.wallet,
    enabled: !!user,
    refetchInterval: 15_000,
  });
  useEffect(() => {
    if (wallet.data) setBalance(wallet.data.balance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.data]);

  // close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const setLocale = (l: string) => {
    i18n.changeLanguage(l);
    localStorage.setItem('locale', l);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
    setMenuOpen(false);
    // hard reload with cache-bust — clears cookies + all caches
    window.location.replace(`/?logout=${Date.now()}`);
  };

  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <header className="border-b border-border bg-panel/70 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
        <Link
          href="/"
          className="font-bold text-lg bg-gradient-to-r from-neon to-accent bg-clip-text text-transparent whitespace-nowrap"
        >
          Research Casino
        </Link>
        <nav className="hidden md:flex gap-4 text-sm text-gray-300">
          <Link href="/lobby" className="hover:text-white">{t('lobby')}</Link>
          <Link href="/promotions" className="hover:text-white">{t('promotions')}</Link>
          <Link href="/vip" className="hover:text-white">{t('vip')}</Link>
          <Link href="/help" className="hover:text-white">{t('help')}</Link>
          {user && ['ADMIN', 'SUPERADMIN', 'RISK', 'SUPPORT', 'MODERATOR'].includes(user.role) && (
            <Link href="/admin" className="text-gold hover:text-yellow-300 font-semibold">
              ⚙ Admin
            </Link>
          )}
        </nav>
        <div className="flex-1" />
        <select
          value={i18n.language}
          onChange={(e) => setLocale(e.target.value)}
          className="bg-panel border border-border rounded px-2 py-1 text-xs"
        >
          <option value="ru">RU</option>
          <option value="en">EN</option>
          <option value="zh">中文</option>
        </select>

        {user ? (
          <>
            <Link
              href="/deposit"
              className="hidden md:block text-xs px-3 py-1.5 rounded border border-border hover:border-gold text-gold"
            >
              {t('deposit')}
            </Link>

            <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-neon/20 to-accent/20 border border-neon/40 text-sm whitespace-nowrap">
              {balance.toFixed(2)} {currency}
            </div>

            {user.mfaEnabled ? (
              <span
                title="2FA enabled"
                className="hidden md:inline px-2 py-0.5 rounded-full bg-success/20 border border-success/50 text-success text-[10px] font-bold"
              >
                2FA
              </span>
            ) : (
              ['ADMIN', 'SUPERADMIN', 'RISK'].includes(user.role) && (
                <Link
                  href="/profile/security"
                  title="2FA required for admins"
                  className="hidden md:inline px-2 py-0.5 rounded-full bg-danger/20 border border-danger/50 text-danger text-[10px] font-bold animate-pulse"
                >
                  ⚠ 2FA off
                </Link>
              )
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border hover:border-neon transition"
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-neon to-accent grid place-items-center text-[11px] font-bold text-white">
                  {initials}
                </span>
                <span className="text-xs hidden md:inline">{user.username}</span>
                <span className={`text-[10px] transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-panel shadow-2xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <div className="text-xs text-gray-400">Signed in as</div>
                    <div className="text-sm font-semibold truncate">{user.username}</div>
                    <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-white/5"
                  >
                    👤 Profile
                  </Link>
                  <Link
                    href="/profile/security"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-white/5"
                  >
                    🔒 Security & 2FA
                  </Link>
                  <Link
                    href="/deposit"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm hover:bg-white/5 md:hidden"
                  >
                    💳 Deposit
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-danger/10 border-t border-border font-semibold"
                  >
                    ⎋ Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm px-3 py-1.5 rounded border border-border hover:border-neon"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              className="text-sm px-3 py-1.5 rounded bg-neon hover:bg-neon/80 text-white"
            >
              {t('register')}
            </Link>
          </>
        )}
      </div>
      <div className="bg-black/40 text-[10px] text-center py-1 text-gray-400">
        Research prototype. Virtual currency only. No real-money gambling. Not for commercial use.
      </div>
    </header>
  );
}
