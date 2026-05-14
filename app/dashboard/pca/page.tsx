'use client';

/**
 * Espace PCA — Synthèses stratégiques et secret de fabrication.
 *
 * Accessible aux rôles `pca` et `admin` (gardé par recipe:view_formula).
 * Vue de contrôle uniquement — pas d'écran opérationnel.
 *
 * Contenu :
 * - Section marges & coûts (PCAMarginsPanel : top marges, marges négatives,
 *   alertes MP, valeur stock)
 * - Accès secret de fabrication (formules, matières premières)
 * - Vue lecture seule (rapports, comptabilité)
 */
import Link from 'next/link';
import {
  Lock, FileText, Beaker, BarChart3, Calculator, Briefcase, ArrowRight, Crown,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { PCAMarginsPanel } from '@/components/dashboard/pca-margins-panel';
import { LogoutButton } from '@/components/auth/logout-button';

export default function PCADashboardPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.RECIPE_VIEW_FORMULA}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 via-fuchsia-700 to-pink-700 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                Espace PCA
                <Lock className="w-5 h-5 opacity-80" />
              </h1>
              <p className="text-sm opacity-90">Synthèses stratégiques, formules & contrôle</p>
            </div>
          </div>
          <LogoutButton
            variant="ghost"
            size="sm"
            showText={false}
            className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Bannière confidentialité */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Espace confidentiel</p>
            <p className="text-sm text-amber-800">
              Les formules de fabrication et marges détaillées affichées ici sont strictement
              réservées au PCA et à l'administrateur décideur.
            </p>
          </div>
        </div>

        {/* SECTION 1 — Marges & coûts (vue confidentielle) */}
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-purple-900">
            <BarChart3 className="w-6 h-6" /> Marges & coûts matières
          </h2>
          <PCAMarginsPanel />
        </section>

        {/* SECTION 2 — Secret de fabrication */}
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-purple-900">
            <Lock className="w-6 h-6" /> Secret de fabrication
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AccessCard
              href="/production/recipes"
              icon={<FileText className="w-6 h-6" />}
              title="Formules / Recettes"
              description="Composition de chaque produit (ingrédients, %, rendement). Création, édition, versioning."
              tone="purple"
            />
            <AccessCard
              href="/production/ingredients"
              icon={<Beaker className="w-6 h-6" />}
              title="Matières premières"
              description="PMP, stocks, fournisseurs préférés, historique des réceptions."
              tone="blue"
            />
          </div>
        </section>

        {/* SECTION 3 — Vue d'ensemble lecture seule */}
        <section>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-purple-900">
            <Briefcase className="w-6 h-6" /> Pilotage & audit
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AccessCard
              href="/reports"
              icon={<BarChart3 className="w-6 h-6" />}
              title="Rapports"
              description="Tableaux de bord transverses : ventes, dépenses, stocks, RH, comptabilité."
              tone="emerald"
            />
            <AccessCard
              href="/accounting"
              icon={<Calculator className="w-6 h-6" />}
              title="Comptabilité"
              description="Plan comptable, journaux, écritures, exercices."
              tone="amber"
            />
            <AccessCard
              href="/dashboard/admin"
              icon={<Briefcase className="w-6 h-6" />}
              title="Dashboard admin"
              description="File de validation, sollicitations, contrôle utilisateurs."
              tone="gray"
              adminOnly
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AccessCard({ href, icon, title, description, tone, adminOnly }: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: 'purple' | 'blue' | 'emerald' | 'amber' | 'gray';
  adminOnly?: boolean;
}) {
  const palette: Record<string, string> = {
    purple: 'border-purple-200 hover:border-purple-400 from-purple-100 to-pink-100 text-purple-700',
    blue: 'border-blue-200 hover:border-blue-400 from-blue-100 to-cyan-100 text-blue-700',
    emerald: 'border-emerald-200 hover:border-emerald-400 from-emerald-100 to-green-100 text-emerald-700',
    amber: 'border-amber-200 hover:border-amber-400 from-amber-100 to-orange-100 text-amber-700',
    gray: 'border-gray-200 hover:border-gray-400 from-gray-100 to-slate-100 text-gray-700',
  };
  return (
    <Link
      href={href}
      className={`group block bg-white border-2 rounded-2xl p-5 transition-all hover:shadow-lg ${palette[tone]}`}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center ${palette[tone]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
            {title}
            {adminOnly && (
              <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">admin only</span>
            )}
          </h3>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
      </div>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}
