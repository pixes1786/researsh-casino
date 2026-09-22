'use client';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const token = search.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Токен отсутствует в ссылке.');
      return;
    }
    api.verifyEmail(token)
      .then(() => {
        setStatus('success');
        qc.invalidateQueries({ queryKey: ['me'] });
        setTimeout(() => router.push('/lobby'), 2500);
      })
      .catch((e: any) => {
        setStatus('error');
        try {
          const parsed = JSON.parse(e.message);
          const code = parsed.message ?? parsed.error ?? '';
          if (code.includes('TOKEN_ALREADY_USED')) {
            setMessage('Этот токен уже был использован. Войдите в аккаунт — email уже подтверждён.');
          } else if (code.includes('TOKEN_EXPIRED')) {
            setMessage('Ссылка истекла. Запросите новое письмо из профиля.');
          } else if (code.includes('TOKEN_NOT_FOUND')) {
            setMessage('Токен не найден. Возможно, ссылка повреждена.');
          } else {
            setMessage('Не удалось подтвердить email.');
          }
        } catch {
          setMessage('Не удалось подтвердить email.');
        }
      });
  }, [token, qc, router]);

  return (
    <div className="max-w-md mx-auto mt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border-2 p-8 text-center ${
          status === 'success'
            ? 'border-success/60 bg-success/5'
            : status === 'error'
            ? 'border-danger/60 bg-danger/5'
            : 'border-border bg-panel'
        }`}
      >
        {status === 'loading' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">📧</div>
            <h1 className="text-xl font-bold mb-2">Проверяем токен…</h1>
            <p className="text-sm text-gray-400">Один момент.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="text-6xl mb-4"
            >
              ✅
            </motion.div>
            <h1 className="text-2xl font-black text-success mb-2">Email подтверждён</h1>
            <p className="text-sm text-gray-300 mb-6">
              Теперь у тебя полный доступ к платформе.
            </p>
            <div className="text-xs text-gray-500">
              Перенаправляем в лобби…
            </div>
            <Link
              href="/lobby"
              className="inline-block mt-4 px-6 py-2 rounded-lg bg-neon hover:bg-neon/80 text-white font-semibold text-sm"
            >
              В лобби
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-black text-danger mb-2">Ошибка</h1>
            <p className="text-sm text-gray-300 mb-6">{message}</p>
            <div className="flex gap-2 justify-center">
              <Link
                href="/login"
                className="px-5 py-2 rounded-lg border border-border hover:border-neon text-sm"
              >
                Войти
              </Link>
              <Link
                href="/profile/security"
                className="px-5 py-2 rounded-lg bg-neon hover:bg-neon/80 text-white text-sm font-semibold"
              >
                Запросить новое письмо
              </Link>
            </div>
          </>
        )}
      </motion.div>

      <div className="text-center text-[10px] text-gray-500 mt-6">
        Research prototype. Virtual currency only. No real-money gambling.
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto mt-16 text-center text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">📧</div>
          <p>Загрузка…</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
