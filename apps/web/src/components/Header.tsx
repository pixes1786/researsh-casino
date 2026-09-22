'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EmailVerificationBanner } from './EmailVerificationBanner';

export function Header() {
  const { t, i18n } = useTranslation();
  const { user, setUser, balance, currency, setBalance } = useSession();
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // bootstrap session
  useEffect(() => {
    let cancelled = false;
    api.me()
      .then((me) => {
        if (cancelled) return;
        if (me?.id) {
          if (!user || user.id !== me.id) setUser(me);
        } else if (user) setUser(null);
      })
      .catch(() => { if (!cancelled && user) setUser(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false, refetchInterval: 20_000 });
  useEffect(() => { if (me.data) setUser(me.data); }, [me.data]); // eslint-disable-line

  const wallet = useQuery({ queryKey: ['wallet'], queryFn: api.wallet, enabled: !!user, refetchInterval: 15_000 });
  useEffect(() => { if (wallet.data) setBalance(wallet.data.balance); }, [wallet.data]); // eslint-disable-line

  // close dropdowns on route change
  useEffect(() => { setUserMenuOpen(false); setDrawerOpen(false); }, [path]);

  // outside click user menu
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [userMenuOpen]);

  // lock scroll when drawer open
  useEffect(() => {
    if (drawerOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const setLocale = (l: string) => {
    i18n.changeLanguage(l);
    localStorage.setItem('locale', l);
  };

  const logout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
    setUserMenuOpen(false);
    setDrawerOpen(false);
    window.location.replace(`/?logout=${Date.now()}`);
  };

  const initials = (user?.username ?? '?').slice(0, 2).toUpperCase();
  const isAdmin = user && ['ADMIN','SUPERADMIN','RISK','SUPPORT','MODERATOR'].includes(user.role);

  const navLinks = (
    <>
      <Link href="/lobby" className="hover:text-white">{t('lobby')}</Link>
      <Link href="/promotions" className="hover:text-white">{t('promotions')}</Link>
      <Link href="/vip" className="hover:text-white">{t('vip')}</Link>
      <Link href="/help" className="hover:text-white">{t('help')}</Link>
      {isAdmin && <Link href="/admin" className="text-gold hover:text-yellow-300 font-semibold">⚙ Admin</Link>}
    </>
  );

  return (
    <>
      <header className="border-b border-border bg-panel/70 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2 md:gap-4">
          {/* Mobile burger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden w-9 h-9 grid place-items-center rounded-lg border border-border hover:border-neon"
            aria-label="Menu"
          >
            <span className="text-lg">☰</span>
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="font-bold text-base md:text-lg bg-gradient-to-r from-neon to-accent bg-clip-text text-transparent whitespace-nowrap"
          >
            Research Casino
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-4 text-sm text-gray-300">
            {navLinks}
          </nav>

          <div className="flex-1" />

          {/* Language — desktop only */}
          <select
            value={i18n.language}
            onChange={(e) => setLocale(e.target.value)}
            className="hidden md:block bg-panel border border-border rounded px-2 py-1 text-xs"
          >
            <option value="ru">RU</option>
            <option value="en">EN</option>
            <option value="zh">中文</option>
          </select>

          {user ? (
            <>
              {/* Deposit — desktop only */}
              <Link
                href="/deposit"
                className="hidden md:block text-xs px-3 py-1.5 rounded border border-border hover:border-gold text-gold"
              >
                {t('deposit')}
              </Link>

              {/* Balance — always visible */}
              <div className="px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-gradient-to-r from-neon/20 to-accent/20 border border-neon/40 text-xs md:text-sm whitespace-nowrap">
                {balance.toFixed(2)} {currency}
              </div>

              {/* 2FA badge — desktop only */}
              {user.mfaEnabled && (
                <span
                  title="2FA enabled"
                  className="hidden md:inline px-2 py-0.5 rounded-full bg-success/20 border border-success/50 text-success text-[10px] font-bold"
                >2FA</span>
              )}

              {/* User chip */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 md:gap-2 pl-1 pr-1.5 md:pr-3 py-1 rounded-full border border-border hover:border-neon transition"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-neon to-accent grid place-items-center text-[11px] font-bold text-white">
                    {initials}
                  </span>
                  <span className="text-xs hidden md:inline">{user.username}</span>
                  <span className={`hidden md:inline text-[10px] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-panel shadow-2xl overflow-hidden z-50">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="text-xs text-gray-400">Signed in as</div>
                      <div className="text-sm font-semibold truncate">{user.username}</div>
                      <div className="text-[10px] text-gray-500 truncate">{user.email}</div>
                    </div>
                    <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2.5 text-sm hover:bg-white/5">👤 Profile</Link>
                    <Link href="/profile/security" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2.5 text-sm hover:bg-white/5">🔒 Security & 2FA</Link>
                    <Link href="/deposit" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2.5 text-sm hover:bg-white/5 md:hidden">💳 Deposit</Link>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-2.5 text-sm text-danger hover:bg-danger/10 border-t border-border font-semibold"
                    >⎋ Logout</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="text-xs md:text-sm px-2 md:px-3 py-1.5 rounded border border-border hover:border-neon whitespace-nowrap">
                {t('login')}
              </Link>
              <Link href="/register" className="text-xs md:text-sm px-2 md:px-3 py-1.5 rounded bg-neon hover:bg-neon/80 text-white whitespace-nowrap">
                {t('register')}
              </Link>
            </>
          )}
        </div>
        <div className="bg-black/40 text-[10px] text-center py-1 text-gray-400 px-2 leading-tight">
          Research prototype. Virtual currency only. No real-money gambling.
        </div>
      </header>

      {/* Email verification banner — appears only for logged-in, unverified users */}
      <EmailVerificationBanner />

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-[60] md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[320px] bg-panel z-[61] md:hidden overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-bold text-lg bg-gradient-to-r from-neon to-accent bg-clip-text text-transparent">
                Research Casino
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-9 h-9 grid place-items-center rounded-lg border border-border"
                aria-label="Close"
              >✕</button>
            </div>

            {user && (
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full bg-gradient-to-br from-neon to-accent grid place-items-center text-lg font-bold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{user.username}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </div>
                <div className="mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-neon/20 to-accent/20 border border-neon/40 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-gray-400">Balance</div>
                  <div className="text-lg font-black">{balance.toFixed(2)} {currency}</div>
                </div>
              </div>
            )}

            <nav className="p-4 flex flex-col gap-1">
              <Link href="/lobby" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">🎮 {t('lobby')}</Link>
              <Link href="/promotions" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">🎁 {t('promotions')}</Link>
              <Link href="/vip" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">👑 {t('vip')}</Link>
              <Link href="/help" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">❓ {t('help')}</Link>
              {isAdmin && (
                <Link href="/admin" className="px-3 py-3 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 text-sm font-semibold">⚙ Admin</Link>
              )}
            </nav>

            {user && (
              <nav className="p-4 pt-0 flex flex-col gap-1 border-t border-border mt-2">
                <Link href="/deposit" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">💳 {t('deposit')}</Link>
                <Link href="/profile" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">👤 Profile</Link>
                <Link href="/profile/security" className="px-3 py-3 rounded-lg hover:bg-white/5 text-sm">🔒 Security & 2FA</Link>
              </nav>
            )}

            <div className="p-4 mt-2 border-t border-border">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Language</div>
              <div className="flex gap-1">
                {(['ru', 'en', 'zh'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`flex-1 py-2 rounded text-sm font-bold ${
                      i18n.language === l ? 'bg-neon text-white' : 'bg-black/40 border border-border'
                    }`}
                  >
                    {l === 'ru' ? 'RU' : l === 'en' ? 'EN' : '中文'}
                  </button>
                ))}
              </div>
            </div>

            {user && (
              <div className="p-4 border-t border-border">
                <button
                  onClick={logout}
                  className="w-full py-3 rounded-lg bg-danger/10 border border-danger/40 text-danger font-semibold"
                >⎋ Logout</button>
              </div>
            )}

            {!user && (
              <div className="p-4 border-t border-border flex flex-col gap-2">
                <Link href="/login" className="w-full py-3 rounded-lg border border-border text-center">{t('login')}</Link>
                <Link href="/register" className="w-full py-3 rounded-lg bg-neon text-white text-center">{t('register')}</Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
