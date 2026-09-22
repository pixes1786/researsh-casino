'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';

const DISMISS_KEY = 'email_banner_dismissed_at';

export function EmailVerificationBanner() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const resend = useMutation({
    mutationFn: () => api.resendVerification(),
    onSuccess: (res) => {
      if (res.alreadyVerified) {
        toast.success('Email уже подтверждён');
        qc.invalidateQueries({ queryKey: ['me'] });
      } else {
        toast.success('Письмо отправлено — проверь почту');
      }
    },
    onError: (e: any) => toast.error(e.message ?? 'Не удалось отправить письмо'),
  });

  // Hide if: not logged in, already verified, dismissed, or dismissed recently
  if (!user || user.emailVerified || dismissed) return null;

  const dismissedAt = typeof window !== 'undefined' ? Number(localStorage.getItem(DISMISS_KEY) ?? 0) : 0;
  const oneHour = 60 * 60 * 1000;
  if (Date.now() - dismissedAt < oneHour) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-gradient-to-r from-amber-500/20 via-gold/15 to-amber-500/20 border-b border-gold/50 overflow-hidden"
      >
        <div className="mx-auto max-w-7xl px-3 md:px-4 py-2 flex items-center gap-3 text-xs md:text-sm">
          <span className="text-lg shrink-0">📧</span>
          <div className="flex-1 min-w-0">
            <span className="text-amber-100 font-semibold">
              Подтвердите email
            </span>
            <span className="text-gray-300 ml-2 hidden md:inline">
              Мы отправили письмо на <b>{user.email}</b>. Проверь почту (и спам).
            </span>
          </div>
          <button
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-gold text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 transition"
          >
            {resend.isPending ? '…' : 'Отправить ещё раз'}
          </button>
          <button
            onClick={handleDismiss}
            className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
