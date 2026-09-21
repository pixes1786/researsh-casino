'use client';
import { motion, AnimatePresence } from 'framer-motion';

export function ResultOverlay({
  open,
  win,
  outcome,
  totalBet,
  payout,
  onClose,
}: {
  open: boolean;
  win: boolean;
  outcome: number | null;
  totalBet: number;
  payout: number;
  onClose: () => void;
}) {
  const label = outcome === 37 ? '00' : String(outcome ?? '—');
  const net = payout - totalBet;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.6, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-[min(92vw,420px)] rounded-2xl border-2 p-8 text-center shadow-2xl overflow-hidden ${
              win
                ? 'border-gold bg-gradient-to-br from-[#2a1f00] via-panel to-[#1a1200] shadow-gold'
                : 'border-danger/60 bg-gradient-to-br from-[#2a0a0a] via-panel to-[#1a0505]'
            }`}
          >
            {win && (
              <>
                {Array.from({ length: 24 }).map((_, i) => {
                  const angle = (i / 24) * Math.PI * 2;
                  const dist = 160 + Math.random() * 80;
                  return (
                    <motion.span
                      key={i}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: Math.cos(angle) * dist,
                        y: Math.sin(angle) * dist + 60,
                        opacity: 0,
                        scale: 0.4,
                        rotate: Math.random() * 720,
                      }}
                      transition={{ duration: 1.4, ease: 'easeOut' }}
                      className="absolute left-1/2 top-1/2 w-2 h-2 rounded-sm pointer-events-none"
                      style={{
                        background: ['#f5c542', '#a855f7', '#22d3ee', '#22c55e', '#ef4444'][i % 5],
                      }}
                    />
                  );
                })}
              </>
            )}

            <div className="relative">
              <div className={`text-6xl mb-2 ${win ? '' : 'grayscale opacity-60'}`}>
                {win ? '🎉' : '😔'}
              </div>
              <h2 className={`text-2xl font-black mb-1 ${win ? 'text-gold' : 'text-gray-300'}`}>
                {win ? 'You won!' : 'No luck this time'}
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                Result: <span className="text-white font-bold">{label}</span>
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-lg border border-border bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Bet</div>
                  <div className="text-lg font-bold text-white">{totalBet.toFixed(2)} RC</div>
                </div>
                <div className="rounded-lg border border-border bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Payout</div>
                  <div className={`text-lg font-bold ${win ? 'text-success' : 'text-gray-500'}`}>
                    {payout.toFixed(2)} RC
                  </div>
                </div>
              </div>

              {win && (
                <div className="mb-5 text-sm text-success font-bold">
                  Net profit: +{net.toFixed(2)} RC
                </div>
              )}

              <button
                onClick={onClose}
                className={`w-full py-3 rounded-lg font-bold transition ${
                  win
                    ? 'bg-gradient-to-r from-gold to-amber-400 text-black hover:brightness-110'
                    : 'bg-panel border border-border text-gray-300 hover:border-white'
                }`}
              >
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
