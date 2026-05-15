/**
 * Root Layout
 * Layout principal de l'application avec SessionProvider
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/lib/auth/session-provider';
import { UserMenu } from '@/components/auth/user-menu';
import { HomeButton } from '@/components/auth/home-button';
import { QuickExpenseButton } from '@/components/expenses/quick-expense-button';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DDM - Système Intégré de Gestion',
  description: 'Système de gestion multi-modules pour entreprises',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <SessionProvider>
          <HomeButton />
          <QuickExpenseButton />
          <UserMenu />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
