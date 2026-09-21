'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Step = 'creds' | 'totp';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('creds');
  const [loading, setLoading] = useState(false);

  const finalize = async (setupRequired?: boolean) => {
    // Force cache-bust and verify session cookie really belongs to the new user
    try {
      await api.me();
    } catch {
      /* ignore, reload will re-check anyway */
    }
    // hard redirect with cache-bust
    const dest = setupRequired ? '/profile/security' : '/lobby';
    window.location.replace(`${dest}?_=${Date.now()}`);
  };

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res: any = await api.login({ identifier: identifier.trim(), password });
      if (res.mfaRequired) {
        setStep('totp');
        toast.message('Enter your 2FA code');
        setLoading(false);
        return;
      }
      toast.success('Welcome');
      await finalize(res.setupRequired);
    } catch (e: any) {
      toast.error(e.message || 'Error');
      setLoading(false);
    }
  };

  const submitTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.login({ identifier: identifier.trim(), password, code });
      toast.success('Welcome');
      await finalize();
    } catch (err: any) {
      toast.error(err.message || 'Bad code');
      setCode('');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10">
      <AnimatePresence mode="wait">
        {step === 'creds' && (
          <motion.form
            key="creds"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={submitCreds}
            className="p-6 rounded-xl border border-border bg-panel space-y-4"
          >
            <h1 className="text-xl font-bold">Login</h1>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email or username</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="demo@rc.local or demo"
                autoComplete="username"
                autoFocus
                className="w-full bg-bg border border-border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="w-full bg-bg border border-border rounded px-3 py-2"
              />
            </div>
            <button
              disabled={loading || !identifier || !password}
              className="w-full py-2 rounded bg-neon hover:bg-neon/80 font-semibold disabled:opacity-50"
            >
              {loading ? '…' : 'Continue'}
            </button>
            <div className="text-xs text-gray-500 text-center">
              Demo: <b>demo</b> or <b>demo@rc.local</b> · password <b>demo12345</b>
            </div>
          </motion.form>
        )}

        {step === 'totp' && (
          <motion.form
            key="totp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onSubmit={submitTotp}
            className="p-6 rounded-xl border border-border bg-panel space-y-4"
          >
            <h1 className="text-xl font-bold">Two-factor authentication</h1>
            <p className="text-xs text-gray-400">
              Enter the 6-digit code from your authenticator app.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono bg-bg border border-border rounded px-3 py-3"
            />
            <button
              disabled={loading || code.length < 6}
              className="w-full py-2 rounded bg-neon hover:bg-neon/80 font-semibold disabled:opacity-50"
            >
              {loading ? '…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('creds'); setCode(''); }}
              className="w-full text-xs text-gray-400 hover:text-white"
            >
              ← Back
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
