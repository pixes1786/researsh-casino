'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { TurnstileWidget } from '@/components/TurnstileWidget';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const r = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.register({ email, username, password, turnstileToken: captchaToken });
      toast.success('Registered. +1000 RC welcome bonus');
      window.location.href = '/lobby';
      return;
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-10 p-6 rounded-xl border border-border bg-panel space-y-4">
      <h1 className="text-xl font-bold">Register</h1>
      <input
        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
        className="w-full bg-bg border border-border rounded px-3 py-2"
      />
      <input
        value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username"
        className="w-full bg-bg border border-border rounded px-3 py-2"
      />
      <input
        value={password} onChange={(e) => setPassword(e.target.value)} type="password"
        placeholder="Password (min 8)"
        className="w-full bg-bg border border-border rounded px-3 py-2"
      />
      <TurnstileWidget onToken={setCaptchaToken} />
      <button disabled={loading} className="w-full py-2 rounded bg-neon hover:bg-neon/80 font-semibold">
        {loading ? '…' : 'Create account'}
      </button>
      <div className="text-xs text-gray-500 text-center">Virtual currency only. Research prototype.</div>
    </form>
  );
}
