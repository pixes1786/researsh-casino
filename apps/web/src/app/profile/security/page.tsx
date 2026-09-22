'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { toast } from 'sonner';

export default function SecurityPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const status = useQuery({ queryKey: ['mfaStatus'], queryFn: api.mfaStatus, retry: false });

  const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string; recoveryCodes: string[] } | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const start = useMutation({
    mutationFn: api.mfaSetup,
    onSuccess: (data: any) => {
      setSetupData({ qrDataUrl: data.qrDataUrl, secret: data.secret, recoveryCodes: data.recoveryCodes });
      toast.success('Scan the QR with your authenticator');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enable = useMutation({
    mutationFn: () => api.mfaEnable(code),
    onSuccess: () => {
      toast.success('2FA enabled');
      setSetupData(null);
      setCode('');
      qc.invalidateQueries({ queryKey: ['mfaStatus'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const disable = useMutation({
    mutationFn: () => api.mfaDisable(disableCode),
    onSuccess: () => {
      toast.success('2FA disabled');
      setDisableCode('');
      qc.invalidateQueries({ queryKey: ['mfaStatus'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center text-gray-400">
        <Link href="/login" className="text-neon underline">Login</Link> to manage security.
      </div>
    );
  }

  const isAdmin = ['ADMIN', 'SUPERADMIN', 'RISK'].includes(user.role);
  const mfaEnabled = status.data?.enabled;
  const mfaPending = status.data?.pending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/profile" className="text-xs text-gray-500 hover:text-white">← Profile</Link>
        <h1 className="text-2xl font-bold mt-1">Security</h1>
        <p className="text-sm text-gray-400">Manage two-factor authentication and recovery codes.</p>
      </div>

      {isAdmin && !mfaEnabled && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm">
          <b className="text-danger">Admin roles require MFA.</b> You won't be able to access
          the admin console until 2FA is enabled.
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-panel p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Two-factor authentication</div>
            <div className="text-xs text-gray-400">
              {mfaEnabled ? (
                <span className="text-success">● Enabled</span>
              ) : mfaPending ? (
                <span className="text-gold">◐ Setup in progress — confirm your code</span>
              ) : (
                <span className="text-gray-500">○ Disabled</span>
              )}
            </div>
          </div>
          {mfaEnabled && (
            <span className="px-3 py-1 rounded-full bg-success/20 border border-success/50 text-success text-xs font-bold">
              MFA ON
            </span>
          )}
        </div>

        {!mfaEnabled && !setupData && !mfaPending && (
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="px-4 py-2 rounded-lg bg-neon hover:bg-neon/80 font-semibold disabled:opacity-50"
          >
            {start.isPending ? '…' : 'Set up 2FA'}
          </button>
        )}

        {(setupData || mfaPending) && !mfaEnabled && (
          <div className="grid gap-4 md:grid-cols-[auto_1fr] items-start">
            {setupData?.qrDataUrl && (
              <div className="rounded-xl border border-border bg-white p-3">
                <img src={setupData.qrDataUrl} alt="QR" width={180} height={180} />
              </div>
            )}

            <div className="space-y-3 min-w-0">
              <div className="text-xs text-gray-400">
                Scan the QR with Google Authenticator / Authy / 1Password, then enter the 6-digit code.
              </div>

              {setupData?.secret && (
                <div className="rounded-lg border border-border bg-black/30 p-2">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Manual secret</div>
                  <code className="text-xs break-all">{setupData.secret}</code>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  className="flex-1 text-center text-xl tracking-[0.4em] font-mono bg-bg border border-border rounded px-3 py-2"
                />
                <button
                  onClick={() => enable.mutate()}
                  disabled={code.length !== 6 || enable.isPending}
                  className="px-4 rounded bg-neon hover:bg-neon/80 font-semibold disabled:opacity-50"
                >
                  {enable.isPending ? '…' : 'Confirm'}
                </button>
              </div>

              {setupData?.recoveryCodes && (
                <div className="rounded-lg border border-gold/40 bg-gold/10 p-3">
                  <div className="text-xs font-semibold text-gold mb-1">Save your recovery codes</div>
                  <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                    {setupData.recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mfaEnabled && (
          <div className="space-y-3">
            <div className="text-xs text-gray-400">
              Recovery codes left: <b>{status.data?.recoveryCodesLeft ?? 0}</b>
            </div>
            <div className="flex gap-2">
              <input
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="000000"
                className="flex-1 text-center tracking-[0.3em] font-mono bg-bg border border-border rounded px-3 py-2"
              />
              <button
                onClick={() => disable.mutate()}
                disabled={disableCode.length !== 6 || disable.isPending}
                className="px-4 rounded border border-danger text-danger font-semibold disabled:opacity-50"
              >
                {disable.isPending ? '…' : 'Disable 2FA'}
              </button>
            </div>
            <div className="text-[11px] text-gray-500">
              To disable, enter a valid TOTP code. This is logged in the audit trail.
            </div>
          </div>
        )}
      </motion.section>

      <EmailVerificationCard />

      <DevicesSection />
    </div>
  );
}


function DevicesSection() {
  const qc = useQueryClient();
  const [confirmAll, setConfirmAll] = useState(false);
  const q = useQuery({ queryKey: ['devices'], queryFn: api.listDevices });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeDevice(id),
    onSuccess: () => {
      toast.success('Device revoked');
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeAll = useMutation({
    mutationFn: () => api.revokeAllDevices(),
    onSuccess: () => {
      toast.success('All other devices revoked');
      qc.invalidateQueries({ queryKey: ['devices'] });
      setConfirmAll(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-panel p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Trusted devices</div>
          <div className="text-xs text-gray-400">
            Auto-login on these devices for 30 days. Each is bound to the IP and UA it was first used on.
          </div>
        </div>
        <button
          onClick={() => setConfirmAll(true)}
          disabled={revokeAll.isPending || !q.data?.length}
          className="text-xs px-3 py-1.5 rounded border border-danger/60 text-danger hover:bg-danger/10 disabled:opacity-50"
        >Revoke all</button>
      </div>

      {confirmAll && (
        <div className="rounded-lg border border-danger/50 bg-danger/10 p-3 text-xs">
          <div className="mb-2">Revoke all devices? You will need to log in again on all of them.</div>
          <div className="flex gap-2">
            <button onClick={() => revokeAll.mutate()} disabled={revokeAll.isPending}
              className="px-3 py-1 rounded bg-danger text-white font-semibold disabled:opacity-50">Yes, revoke</button>
            <button onClick={() => setConfirmAll(false)} className="px-3 py-1 rounded border border-border">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {(q.data ?? []).map((d: any) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-black/20 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{d.label || 'Unknown device'}</div>
              <div className="text-[11px] text-gray-500">
                IP {d.ip ?? '—'} · last seen {new Date(d.lastSeenAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => revoke.mutate(d.id)}
              disabled={revoke.isPending}
              className="text-xs px-3 py-1 rounded border border-border hover:border-danger hover:text-danger disabled:opacity-50"
            >Revoke</button>
          </div>
        ))}
        {!q.data?.length && (
          <div className="text-xs text-gray-500 text-center py-4">No active devices</div>
        )}
      </div>
    </motion.section>
  );
}



function EmailVerificationCard() {
  const { user } = useSession();
  const qc = useQueryClient();
  const resend = useMutation({
    mutationFn: () => api.resendVerification(),
    onSuccess: (res) => {
      if (res.alreadyVerified) {
        toast.success('Email уже подтверждён');
        qc.invalidateQueries({ queryKey: ['me'] });
      } else {
        toast.success('Письмо отправлено');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!user) return null;
  const verified = !!user.emailVerified;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-6 space-y-3 ${
        verified ? 'border-success/40 bg-success/5' : 'border-gold/50 bg-gold/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Email verification</div>
          <div className="text-xs text-gray-400 mt-1">
            {user.email}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          verified
            ? 'bg-success/20 border border-success/50 text-success'
            : 'bg-gold/20 border border-gold/60 text-gold'
        }`}>
          {verified ? '✓ VERIFIED' : '⚠ UNVERIFIED'}
        </span>
      </div>

      {!verified && (
        <>
          <p className="text-sm text-gray-300">
            Подтверди email — так мы знаем, что ты реальный пользователь.
            Пока не подтверждён — можешь играть, но некоторые функции будут ограничены.
          </p>
          <button
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="px-4 py-2 rounded-lg bg-gold text-black font-bold text-sm disabled:opacity-50 hover:brightness-110 transition"
          >
            {resend.isPending ? '…' : 'Отправить письмо заново'}
          </button>
        </>
      )}

      {verified && (
        <p className="text-sm text-success">
          Твой email подтверждён.
        </p>
      )}
    </motion.section>
  );
}
