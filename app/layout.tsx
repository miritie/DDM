/**
 * Root Layout
 * Layout principal de l'application avec SessionProvider
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/lib/auth/session-provider';
import { AppTopBar } from '@/components/layouts/app-top-bar';
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
          {/* Barre de navigation globale (56 px, fixed top, fond neutre).
              Regroupe Home / FAB dépense / badges alertes / notifs / user.
              Le pt-14 ci-dessous laisse l'espace nécessaire au contenu de
              toutes les pages, sans qu'elles aient à le savoir. */}
          <AppTopBar />
          <div className="pt-14">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
