'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import '../lib/i18n';
import { api } from '../lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
    },
  }));

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Attempt 1: existing cookies
      try {
        const me: any = await api.me();
        if (!cancelled && me?.id) {
          qc.setQueryData(['me'], me);
          return;
        }
      } catch { /* fallthrough */ }

      // If api.me() triggered auto device-login, cookies are fresh now — retry once.
      await new Promise((r) => setTimeout(r, 120));

      try {
        const me: any = await api.me();
        if (!cancelled && me?.id) {
          qc.setQueryData(['me'], me);
          qc.invalidateQueries();
        }
      } catch { /* give up silently */ }
    }

    bootstrap();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
