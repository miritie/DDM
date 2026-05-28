'use client';

/**
 * Barre de navigation globale fixée en haut de l'application.
 *
 * Regroupe tous les widgets qui auparavant flottaient indépendamment en
 * `fixed top-4` au-dessus de chaque page (Home, FAB dépense, badges
 * mes-dépenses / transferts-à-recevoir, cloche notifs, menu utilisateur).
 *
 * Effet : un bandeau unique de hauteur constante (56 px), couleur neutre
 * cohérente avec le système, qui ne masque plus le contenu et qui sert de
 * conteneur visuel pour toutes les icônes de chrome.
 *
 * Le padding-top correspondant est appliqué globalement dans RootLayout
 * (pt-14 sur le wrapper main).
 *
 * Chacun des widgets supporte `inline` et ne gère plus son propre
 * positionnement quand cette prop vaut true.
 */

import { HomeButton } from '@/components/auth/home-button';
import { QuickExpenseButton } from '@/components/expenses/quick-expense-button';
import { MyExpensesAlertBadge } from '@/components/expenses/my-expenses-badge';
import { TransferAlertBadge } from '@/components/stock/transfer-alert-badge';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { UserMenu } from '@/components/auth/user-menu';

export function AppTopBar() {
  return (
    <header
      role="banner"
      // Fond blanc solide + ombre + border : la barre est franchement
      // distincte du contenu de la page (bg-gray-50). z-50 pour passer
      // devant tout sticky local qui scrolle dessous.
      className="fixed top-0 inset-x-0 z-50 h-14 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] border-b border-slate-200"
    >
      <div className="h-full max-w-screen-2xl mx-auto px-3 flex items-center gap-2">
        {/* Cluster gauche : navigation rapide */}
        <HomeButton inline />
        <QuickExpenseButton inline />

        {/* Cluster milieu : alertes contextuelles (apparaissent quand count > 0) */}
        <MyExpensesAlertBadge inline />
        <TransferAlertBadge inline />

        <div className="flex-1" />

        {/* Cluster droite : notifs + utilisateur */}
        <NotificationBell inline />
        <UserMenu inline />
      </div>
    </header>
  );
}
