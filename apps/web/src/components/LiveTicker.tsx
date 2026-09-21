'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';

const WS = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export function LiveTicker() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const s: Socket = io(WS, { transports: ['websocket'] });
    s.on('live:win', (w) => setItems((prev) => [w, ...prev].slice(0, 30)));
    return () => { s.close(); };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-panel/70 p-3 overflow-hidden">
      <div className="text-xs text-gray-400 mb-2">Live wins</div>
      <div className="space-y-1 h-24 overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((i, idx) => (
            <motion.div
              key={`${i.at}-${idx}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-between text-xs"
            >
              <span className="text-gray-300 truncate">{i.username}</span>
              <span className="text-success">+{Number(i.amount).toFixed(2)} RC</span>
            </motion.div>
          ))}
          {!items.length && <div className="text-xs text-gray-500">Waiting for wins…</div>}
        </AnimatePresence>
      </div>
    </div>
  );
}
