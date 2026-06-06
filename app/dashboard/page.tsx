/**
 * Dashboard Page - Tableau de bord principal
 * Route intelligemment vers le dashboard approprié selon le rôle
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';

/**
 * Mapping basé sur le slug du rôle (colonne `roles.role_id`, VARCHAR), pas sur l'UUID.
 * Permet à la redirection de survivre à des rôles recréés avec de nouveaux UUIDs.
 */
const ROLE_DASHBOARDS: Record<string, string> = {
  admin:                  '/dashboard/admin',
  pca:                    '/dashboard/pca',
  dg:                     '/dashboard/dg',
  manager:                '/dashboard/manager',
  manager_commercial:     '/dashboard/manager',
  manager_compta_stocks:  '/dashboard/accountant',
  accountant:             '/dashboard/accountant',
  manager_production:     '/dashboard/production',
  operateur_production:   '/dashboard/production',
  // Le commercial atterrit directement sur l'écran de vente.
  // Le dashboard de performance reste accessible via le bouton « Mes perfs ».
  agent_commercial:       '/sales/quick',
  commercial:             '/sales/quick',
};

async function resolveRoleSlug(roleUuid: string): Promise<string | null> {
  if (!roleUuid) return null;
  try {
    const r = await getPostgresClient().query(
      `SELECT role_id FROM roles WHERE id = $1 LIMIT 1`,
      [roleUuid]
    );
    return r.rows[0]?.role_id ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const slug = await resolveRoleSlug((user as any).activeRoleId || user.roleId);
  const specializedDashboard = slug ? ROLE_DASHBOARDS[slug] : undefined;
  if (specializedDashboard) {
    redirect(specializedDashboard);
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header with gradient background */}
      <div className="relative overflow-hidden rounded-3xl gradient-primary p-8 shadow-strong">
        <div className="relative z-10">
          <h1 className="text-4xl font-display font-bold text-white">Tableau de Bord</h1>
          <p className="mt-2 text-primary-50 text-lg">
            Bienvenue, {user.name}! 👋
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
      </div>

      {/* Statistiques Globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-300"></div>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide">
              💳 Dépenses du Mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-brown-900">--</div>
            <p className="text-xs text-brown-500 mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              En cours de calcul...
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-secondary-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-300"></div>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide">
              🏦 Trésorerie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-brown-900">--</div>
            <p className="text-xs text-brown-500 mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              En cours de calcul...
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-300"></div>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide">
              💰 Ventes du Mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-brown-900">--</div>
            <p className="text-xs text-brown-500 mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              En cours de calcul...
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-300"></div>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide">
              📋 Avances & Dettes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold text-brown-900">--</div>
            <p className="text-xs text-brown-500 mt-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              En cours de calcul...
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Disponibles */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-display font-bold text-brown-900">Modules Disponibles</h2>
          <span className="px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">6 modules</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/expenses/requests" className="group block">
            <Card className="h-full border-2 border-primary-200 hover:border-primary-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center text-3xl mb-3 shadow-medium group-hover:scale-110 transition-transform duration-200">
                  💳
                </div>
                <CardTitle className="text-xl">Dépenses & Sollicitations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-brown-600 mb-4">
                  Module 7.4 - Gestion des demandes et dépenses
                </p>
                <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm group-hover:gap-3 transition-all">
                  Accéder au module
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-60 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">Bientôt</span>
            </div>
            <CardHeader className="pb-4">
              <div className="w-14 h-14 rounded-xl bg-brown-200 flex items-center justify-center text-3xl mb-3">
                📋
              </div>
              <CardTitle className="text-xl">Avances & Dettes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brown-600">
                Module 7.5 - Gestion des avances et dettes
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">Bientôt</span>
            </div>
            <CardHeader className="pb-4">
              <div className="w-14 h-14 rounded-xl bg-brown-200 flex items-center justify-center text-3xl mb-3">
                🏦
              </div>
              <CardTitle className="text-xl">Trésorerie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brown-600">
                Module 7.3 - Gestion multi-wallet
              </p>
            </CardContent>
          </Card>

          <Link href="/sales/quick" className="block">
            <Card className="relative overflow-hidden hover:shadow-strong transition-all duration-300 cursor-pointer group">
              <CardHeader className="pb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-3xl mb-3 shadow-medium">
                  💰
                </div>
                <CardTitle className="text-xl">Vente rapide</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-brown-600 mb-4">
                  Caisse POS — produits, panier, encaissement en un clic
                </p>
                <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm group-hover:gap-3 transition-all">
                  Ouvrir la caisse
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card className="opacity-60 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">Bientôt</span>
            </div>
            <CardHeader className="pb-4">
              <div className="w-14 h-14 rounded-xl bg-brown-200 flex items-center justify-center text-3xl mb-3">
                📦
              </div>
              <CardTitle className="text-xl">Stocks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brown-600">
                Module 7.2 - Stocks & Mouvements
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-60 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold">Bientôt</span>
            </div>
            <CardHeader className="pb-4">
              <div className="w-14 h-14 rounded-xl bg-brown-200 flex items-center justify-center text-3xl mb-3">
                👥
              </div>
              <CardTitle className="text-xl">Ressources Humaines</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brown-600">
                Module 7.6 - RH & Commissions
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Informations Système */}
      <Card className="border-2 border-brown-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            État du Système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col gap-1 p-3 bg-brown-50 rounded-lg">
              <span className="text-brown-600 text-xs font-medium uppercase tracking-wide">Workspace actif</span>
              <span className="font-semibold text-brown-900">{user.workspaceId}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-brown-50 rounded-lg">
              <span className="text-brown-600 text-xs font-medium uppercase tracking-wide">Rôle</span>
              <span className="font-semibold text-brown-900">{user.roleId}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-amber-50 rounded-lg col-span-2">
              <span className="text-amber-700 text-xs font-medium uppercase tracking-wide">⚠️ Aucun dashboard spécialisé pour ce rôle</span>
              <span className="text-sm text-amber-900 mt-1">
                Votre rôle n'est pas mappé à un tableau de bord dédié. Cela peut indiquer un nouveau rôle non encore configuré côté UI.
                Contactez l'administrateur ou ajoutez le mapping dans <code>app/dashboard/page.tsx</code>.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
