import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DailyBonusPopup } from '@/components/DailyBonusPopup';

export const metadata: Metadata = { title: 'Research Casino', description: 'Research prototype' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen">
        <Providers>
          <Header />
          <main className="mx-auto max-w-7xl px-3 md:px-4 py-4 md:py-6">{children}</main>
          <Footer />
          <DailyBonusPopup />
        </Providers>
      </body>
    </html>
  );
}
