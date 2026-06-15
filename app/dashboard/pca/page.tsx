'use client';

/**
 * Espace PCA — Synthèses stratégiques et secret de fabrication.
 *
 * Accessible aux rôles `pca` et `admin` (gardé par recipe:view_formula).
 * Vue de contrôle uniquement — pas d'écran opérationnel.
 *
 * MOBILE-FIRST : pensé pour le téléphone du PCA. Les marges produits
 * (confidentielles, volumineuses) sont REPLIÉES par défaut et ne se
 * chargent qu'à la demande.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Lock, FileText, Beaker, BarChart3, Calculator, Briefcase, ArrowRight,
  Crown, FileBarChart, Landmark, ChevronDown, ChevronUp,
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

// Lisibilité maximale : montants compacts (« 12,4 M ») dès le million
const fmtF = (n: number) => {
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' F';
};

function Content() {
  const [showMargins, setShowMargins] = useState(false);
  const [snap, setSnap] = useState<any | null>(null);
  // Drill-down : chaque chiffre ouvre sa décomposition
  const [drill, setDrill] = useState<{ kpi: string; title: string; rows: any[] } | null>(null);
  const [drillLoading, setDrillLoading] = useState<string | null>(null);
  async function openDrill(kpi: string) {
    setDrillLoading(kpi);
    try {
      const r = await fetch(`/api/dashboard/pca-drill?kpi=${kpi}`);
      if (r.ok) {
        const d = (await r.json()).data;
        setDrill({ kpi, title: d.title, rows: d.rows });
      }
    } finally {
      setDrillLoading(null);
    }
  }
  useEffect(() => {
    fetch('/api/dashboard/pca-snapshot')
      .then(r => (r.ok ? r.json() : null))
      .then(b => b?.data && setSnap(b.data))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 pb-16">
      {/* Header compact (mobile-first) */}
      <div className="bg-gradient-to-r from-purple-700 via-fuchsia-700 to-pink-700 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Crown className="w-7 h-7 sm:w-9 sm:h-9 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-1.5 truncate">
                Espace PCA <Lock className="w-4 h-4 opacity-80 shrink-0" />
              </h1>
              <p className="text-[11px] sm:text-sm opacity-90 truncate">
                Synthèses stratégiques, formules & contrôle
              </p>
            </div>
          </div>
          <LogoutButton
            variant="ghost"
            size="sm"
            showText={false}
            className="p-2.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white shrink-0"
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* SECTION 0 — ÉTAT DES LIEUX : les 9 chiffres, d'entrée de jeu */}
        <section className="bg-white border-2 border-purple-200 rounded-2xl p-3 sm:p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm sm:text-base font-bold text-purple-900">État des lieux</h2>
            <span className="text-[10px] text-gray-400">
              {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          {!snap ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Stat label="CA aujourd'hui" value={fmtF(snap.ca.day)} tone="amber"
                onClick={() => openDrill('ca_day')} loading={drillLoading === 'ca_day'} />
              <Stat label="CA du mois" value={fmtF(snap.ca.month)} tone="amber"
                onClick={() => openDrill('ca_month')} loading={drillLoading === 'ca_month'} />
              <Stat label="CA de l'année" value={fmtF(snap.ca.year)} tone="amber"
                onClick={() => openDrill('ca_year')} loading={drillLoading === 'ca_year'} />
              <Stat label="Stock stands" value={fmtF(snap.stock.stands)}
                onClick={() => openDrill('stock_stands')} loading={drillLoading === 'stock_stands'} />
              <Stat label="Stock entrepôt" value={fmtF(snap.stock.warehouse)}
                onClick={() => openDrill('stock_warehouse')} loading={drillLoading === 'stock_warehouse'} />
              <Stat label="MP en faible qté" value={String(snap.stock.mpLow)}
                tone={snap.stock.mpLow > 0 ? 'red' : 'green'}
                onClick={() => openDrill('mp_low')} loading={drillLoading === 'mp_low'} />
              <Stat label="Dépenses du mois" value={fmtF(snap.engagements.expensesMonth)}
                onClick={() => openDrill('expenses_month')} loading={drillLoading === 'expenses_month'} />
              <Stat label="Engagements à payer" value={fmtF(snap.engagements.pending)}
                tone={snap.engagements.pending > 0 ? 'red' : undefined}
                onClick={() => openDrill('commitments')} loading={drillLoading === 'commitments'} />
              <Stat label="Réappros demandés" value={fmtF(snap.engagements.replenishments)}
                onClick={() => openDrill('replenishments')} loading={drillLoading === 'replenishments'} />
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center mt-2">Touchez un chiffre pour voir le détail</p>
        </section>

        {/* Panneau de détail (drill-down) */}
        {drill && (
          <section className="bg-white border-2 border-purple-300 rounded-2xl p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="text-sm sm:text-base font-bold text-purple-900">{drill.title}</h2>
              <button onClick={() => setDrill(null)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200">
                Fermer ✕
              </button>
            </div>
            {drill.rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Rien à afficher.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {drill.rows.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.label}</p>
                      {r.sub && <p className="text-xs text-gray-500 truncate">{r.sub}</p>}
                    </div>
                    <p className="text-sm font-bold tabular-nums shrink-0">
                      {typeof r.value === 'number' ? fmtF(r.value) : r.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 1 — Pilotage : l'essentiel d'abord */}
        <section>
          <h2 className="text-base sm:text-xl font-bold mb-2 sm:mb-3 flex items-center gap-2 text-purple-900">
            <Briefcase className="w-5 h-5" /> Pilotage & audit
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <AccessCard
              href="/reports/annual"
              icon={<FileBarChart className="w-5 h-5" />}
              title="Rapport annuel"
              description="Bilan moral & financier d'une année : CA, stands, vendeurs, paie, charges, dettes. Imprimable."
              tone="purple"
            />
            <AccessCard
              href="/reports"
              icon={<BarChart3 className="w-5 h-5" />}
              title="Rapports & analyses"
              description="Dashboard décisionnel : filtres croisés, périodes superposées, stands et vendeurs."
              tone="emerald"
            />
            <AccessCard
              href="/accounting"
              icon={<Calculator className="w-5 h-5" />}
              title="Comptabilité"
              description="Journaux, écritures, balance, bilan, états financiers OHADA."
              tone="amber"
            />
            <AccessCard
              href="/hr/payroll/charges"
              icon={<Landmark className="w-5 h-5" />}
              title="Charges sociales"
              description="CNPS · DGI · FDFP — dû, réglé, reste, échéances du 15."
              tone="blue"
            />
            <AccessCard
              href="/debts"
              icon={<Landmark className="w-5 h-5" />}
              title="Dettes & créances"
              description="Fournisseurs, salaires, charges, clients, avances — à payer / à recevoir."
              tone="amber"
            />
          </div>
        </section>

        {/* SECTION 2 — Marges (confidentiel) : repliée par défaut */}
        <section>
          <button
            onClick={() => setShowMargins(v => !v)}
            className="w-full flex items-center justify-between gap-2 bg-white border-2 border-purple-200 hover:border-purple-400 rounded-2xl px-4 py-3 transition-colors"
          >
            <span className="flex items-center gap-2 font-bold text-purple-900 text-sm sm:text-base">
              <Lock className="w-4 h-4" /> Marges & coûts matières
              <span className="hidden sm:inline text-xs font-normal text-purple-500">— confidentiel</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-purple-700">
              {showMargins ? 'Masquer' : 'Afficher'}
              {showMargins ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>
          {showMargins && (
            <div className="mt-3">
              <PCAMarginsPanel />
            </div>
          )}
        </section>

        {/* SECTION 3 — Secret de fabrication */}
        <section>
          <h2 className="text-base sm:text-xl font-bold mb-2 sm:mb-3 flex items-center gap-2 text-purple-900">
            <Lock className="w-5 h-5" /> Secret de fabrication
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
            <AccessCard
              href="/production/recipes"
              icon={<FileText className="w-5 h-5" />}
              title="Formules / Recettes"
              description="Composition de chaque produit (ingrédients, %, rendement)."
              tone="purple"
            />
            <AccessCard
              href="/production/ingredients"
              icon={<Beaker className="w-5 h-5" />}
              title="Matières premières"
              description="PMP, stocks, fournisseurs, historique des réceptions."
              tone="blue"
            />
          </div>
        </section>

        {/* SECTION 4 — Admin */}
        <section>
          <AccessCard
            href="/dashboard/admin"
            icon={<Briefcase className="w-5 h-5" />}
            title="Dashboard admin"
            description="File de validation, sollicitations, contrôle utilisateurs."
            tone="gray"
            adminOnly
          />
        </section>

        <p className="text-[11px] text-gray-400 flex items-start gap-1.5 px-1">
          <Lock className="w-3 h-3 mt-0.5 shrink-0" />
          Les formules de fabrication et marges détaillées sont strictement réservées
          au PCA et à l'administrateur décideur.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, onClick, loading }: {
  label: string; value: string; tone?: 'amber' | 'red' | 'green';
  onClick?: () => void; loading?: boolean;
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-900',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`rounded-lg px-2 py-2 text-center transition-all ${tone ? tones[tone] : 'bg-gray-50 text-gray-900'} ` +
        (onClick ? 'active:scale-95 hover:ring-2 hover:ring-purple-300 cursor-pointer' : '')}>
      <p className="text-base sm:text-xl font-bold tabular-nums leading-tight">
        {loading ? '…' : value}
      </p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
    </button>
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
      className={`group block bg-white border-2 rounded-2xl p-3.5 sm:p-5 transition-all hover:shadow-lg active:scale-[0.99] ${palette[tone]}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 ${palette[tone]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
            {title}
            {adminOnly && (
              <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">admin only</span>
            )}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform shrink-0" />
      </div>
    </Link>
  );
}
