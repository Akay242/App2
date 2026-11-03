import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AdminShell } from '@/components/AdminShell';

import './globals.css';

export const metadata: Metadata = {
  title: 'Salon Bonus – Verwaltung',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
