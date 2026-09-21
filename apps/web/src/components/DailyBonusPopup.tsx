'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { toast } from 'sonner';

const STORAGE_KEY = 'daily_popup_dismissed_at';

export function DailyBonusPopup() {
  const { user, setBalance } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const daily = useQuery({
    queryKey: ['daily'],
    queryFn: api.promoDaily,
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!user || !daily.data) return;
    if (daily.data.claimedToday) return;
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - last < oneHour) return;
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [user, daily.data]);

  const claim = useMutation({
    mutationFn: api.promoClaimDaily,
    onSuccess: (res: any) => {
      toast.success(`+${res.amount} RC · streak ${res.streak}`);
      setBalance(res.balance);
      qc.invalidateQueries({ queryKey: ['daily'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const close = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  if (!daily.data) return null;

  const streak = daily.data.nextStreak;
  const amount = daily.data.nextAmount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[min(92vw,420px)] rounded-2xl border-2 border-gold bg-gradient-to-br from-[#2a1f00] via-panel to-[#1a1200] p-7 text-center shadow-gold"
          >
            <div className="text-5xl mb-2">🎁</div>
            <h2 className="text-2xl font-black text-gold">Daily bonus</h2>
            <p className="text-xs text-gray-400 mt-1">Streak day {streak} of 7</p>

            <div className="my-5 text-4xl font-black text-white">
              +{amount} <span className="text-base text-gray-400">RC</span>
            </div>

            {/* streak row */}
            <div className="flex justify-center gap-1 mb-5">
              {daily.data.schedule.map((v: number, i: number) => {
                const day = i + 1;
                const done = day < streak;
                const current = day === streak;
                return (
                  <div
                    key={i}
                    className={`w-9 h-9 rounded-lg grid place-items-center text-[10px] font-bold border ${
                      done ? 'bg-success/30 border-success/60 text-success'
                        : current ? 'bg-gold text-black border-gold shadow-gold'
                        : 'bg-black/30 border-border text-gray-500'
                    }`}
                  >{v}</div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => claim.mutate()}
                disabled={claim.isPending}
                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-gold to-amber-400 text-black font-bold hover:brightness-110 disabled:opacity-60"
              >{claim.isPending ? '…' : 'Claim now'}</button>
              <button
                onClick={close}
                className="px-4 rounded-lg border border-border text-gray-300 hover:border-white"
              >Later</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
