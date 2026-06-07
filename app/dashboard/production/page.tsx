'use client';

/**
 * Dashboard Production — deux niveaux de lecture, mobile-first.
 *
 * MANAGER (production:approve — 64 ans) : état des lieux synthétique
 * (6 chiffres), puis 3 files d'action compactes (OP à valider en un
 * geste, sollicitations à produire, MP faibles avec demande d'achat),
 * puis accès aux détails (travaux en cours, MP, recettes, achats).
 *
 * AGENT (sans production:approve — opérateurs, niveau < CEPE) : vue
 * SIMPLISTE — ses commandes avec UN gros bouton par étape
 * (▶ COMMENCER / ✓ J'AI TERMINÉ), et deux grandes actions : recevoir
 * des matières, demander une dépense. Le moins de texte possible.
 *
 * Workflow OP : draft → submitted (à valider) → planned (validé)
 *               → in_progress → completed
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Factory, ClipboardList, AlertTriangle, Play, CheckCircle2, Loader2,
  Beaker, FileText, ShoppingCart, ArrowRight, PackagePlus, HandCoins,
  RefreshCw, Hammer,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { usePermissions } from '@/lib/rbac/use-permissions';

const fmtF = (n: number) => {
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';
};

export default function ProductionDashboardPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.PRODUCTION_VIEW}>
      <Router />
    </ProtectedPage>
  );
}

function Router() {
  const { permissions, roleCodes, loading } = usePermissions();
  // Le RÔLE prime : un opérateur de production est TOUJOURS en vue agent,
  // même si son jeu de permissions déborde (constaté en base de prod).
  const isOperator = roleCodes.includes('operateur_production');
  const isManager = !isOperator && permissions.includes(PERMISSIONS.PRODUCTION_APPROVE);
  // Aperçu : un manager/admin peut voir l'écran agent sans se déconnecter
  const [previewAgent, setPreviewAgent] = useState(false);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      </div>
    );
  }
  if (!isManager) return <AgentView />;
  if (previewAgent) {
    return (
      <div>
        <button onClick={() => setPreviewAgent(false)}
          className="w-full bg-amber-100 text-amber-900 text-sm font-bold py-2.5 text-center sticky top-0 z-20">
          👁 Aperçu de l'écran AGENT — revenir à ma vue manager ✕
        </button>
        <AgentView />
      </div>
    );
  }
  return <ManagerView onPreviewAgent={() => setPreviewAgent(true)} />;
}

/* ============================================================
   VUE MANAGER — synthèse d'abord, détails à la demande
   ============================================================ */
function ManagerView({ onPreviewAgent }: { onPreviewAgent?: () => void }) {
  const [data, setData] = useState<{
    toValidate: any[]; inProgress: number; queue: any; lowIngredients: any[];
    mpValue: number; purchasesOpen: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [submittedR, inProgressR, queueR, lowR, allIngR, prR] = await Promise.allSettled([
        fetch('/api/production/orders?status=submitted'),
        fetch('/api/production/orders?status=in_progress'),
        fetch('/api/dashboard/production-queue'),
        fetch('/api/production/ingredients?belowMinimum=true&isActive=true'),
        fetch('/api/production/ingredients?isActive=true'),
        fetch('/api/production/purchase-requests'),
      ]);
      const arr = async (r: PromiseSettledResult<Response>) =>
        r.status === 'fulfilled' && r.value.ok ? ((await r.value.json()).data || []) : [];
      const toValidate = await arr(submittedR);
      const inProgress = (await arr(inProgressR)).length;
      const queue = queueR.status === 'fulfilled' && queueR.value.ok
        ? (await queueR.value.json()).data
        : { totalCount: 0, pending: [], replenishmentsPending: [] };
      const lowIngredients = await arr(lowR);
      const allIng = await arr(allIngR);
      const mpValue = allIng.reduce((s: number, i: any) =>
        s + (Number(i.CurrentStock) || 0) * (Number(i.UnitCost) || 0), 0);
      const purchases = await arr(prR);
      const purchasesOpen = purchases.filter((p: any) =>
        !['received', 'cancelled', 'rejected'].includes(p.Status)).length;
      setData({ toValidate, inProgress, queue, lowIngredients, mpValue, purchasesOpen });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function approve(order: any) {
    setActing(order.ProductionOrderId);
    try {
      const r = await fetch(`/api/production/orders/${order.ProductionOrderId}/approve`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error || 'Échec de la validation');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  }

  const d = data;
  const solicitations = d
    ? (d.queue.pending?.length || 0) + (d.queue.replenishmentsPending?.length || 0)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-16">
      <Header subtitle="Pilotage de la production" onRefresh={load} />

      <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ===== ÉTAT DES LIEUX : 6 chiffres ===== */}
        <section className="bg-white border-2 border-purple-200 rounded-2xl p-3 sm:p-4">
          <h2 className="text-sm sm:text-base font-bold text-purple-900 mb-2">État des lieux</h2>
          {loading || !d ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Stat label="Sollicitations" value={String(solicitations)} tone={solicitations > 0 ? 'amber' : undefined} />
              <Stat label="OP à valider" value={String(d.toValidate.length)} tone={d.toValidate.length > 0 ? 'red' : 'green'} />
              <Stat label="En cours" value={String(d.inProgress)} tone={d.inProgress > 0 ? 'amber' : undefined}
                href="/production/orders?status=in_progress" />
              <Stat label="MP faibles" value={String(d.lowIngredients.length)} tone={d.lowIngredients.length > 0 ? 'red' : 'green'} />
              <Stat label="Stock MP valorisé" value={fmtF(d.mpValue)} />
              <Stat label="Achats MP en cours" value={String(d.purchasesOpen)} />
            </div>
          )}
        </section>

        {/* ===== À VALIDER : action en un geste ===== */}
        {d && d.toValidate.length > 0 && (
          <section className="bg-white border-2 border-red-200 rounded-2xl p-3 sm:p-4">
            <h2 className="text-sm sm:text-base font-bold text-red-800 mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" /> Mises en production à valider
            </h2>
            <div className="space-y-2">
              {d.toValidate.slice(0, 4).map((o: any) => (
                <div key={o.ProductionOrderId}
                  className="flex items-center justify-between gap-2 bg-red-50 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{o.ProductName}</p>
                    <p className="text-xs text-gray-600">
                      {new Intl.NumberFormat('fr-FR').format(o.PlannedQuantity || 0)} {o.Unit || 'unités'}
                      {o.AssignedToName ? ` · ${o.AssignedToName}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => approve(o)}
                    disabled={acting === o.ProductionOrderId}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                  >
                    {acting === o.ProductionOrderId ? '…' : '✓ Valider'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== SOLLICITATIONS À PRODUIRE ===== */}
        {d && solicitations > 0 && (
          <section className="bg-white border-2 border-amber-200 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm sm:text-base font-bold text-amber-900 flex items-center gap-1.5">
                <Factory className="w-4 h-4" /> À produire
              </h2>
              <Link href="/production/orders/new" className="text-xs font-bold text-amber-700 hover:underline">
                Créer un OP →
              </Link>
            </div>
            <div className="space-y-1.5">
              {(d.queue.pending || []).slice(0, 3).map((c: any) => (
                <QueueLine key={c.id} title={c.client_name || 'Commande client'}
                  sub={`${c.order_number || ''} · ${fmtF(Number(c.total_amount) || 0)}`} />
              ))}
              {(d.queue.replenishmentsPending || []).slice(0, 3).map((r: any) => (
                <QueueLine key={r.id} title="Réappro stands"
                  sub={`${r.order_number || ''} · par ${r.requested_by_name || '—'}`} />
              ))}
            </div>
          </section>
        )}

        {/* ===== MP FAIBLES → demande d'achat ===== */}
        {d && d.lowIngredients.length > 0 && (
          <section className="bg-white border-2 border-orange-200 rounded-2xl p-3 sm:p-4">
            <h2 className="text-sm sm:text-base font-bold text-orange-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Matières premières en faible quantité
            </h2>
            <div className="space-y-1.5 mb-3">
              {d.lowIngredients.slice(0, 4).map((i: any) => (
                <div key={i.IngredientId || i.Id}
                  className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium">{i.Name}</span>
                  <span className="tabular-nums text-orange-800 font-semibold">
                    {Number(i.CurrentStock) || 0} / min {Number(i.MinimumStock) || 0} {i.Unit}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/production/purchase-requests/new"
              className="block w-full text-center py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700">
              Demander l'achat des matières manquantes
            </Link>
          </section>
        )}

        {/* ===== ACCÈS DÉTAILS ===== */}
        <section className="grid grid-cols-2 gap-2.5">
          <NavCard href="/production/orders?status=completed" icon={<CheckCircle2 className="w-5 h-5" />}
            title="Terminés" tone="purple" />
          <NavCard href="/production/ingredients" icon={<Beaker className="w-5 h-5" />}
            title="Matières premières" tone="blue" />
          <NavCard href="/production/recipes" icon={<FileText className="w-5 h-5" />}
            title="Recettes" tone="emerald" />
          <NavCard href="/production/purchase-requests" icon={<ShoppingCart className="w-5 h-5" />}
            title="Achats MP" tone="amber" />
          <NavCard href="/production/orders" icon={<ClipboardList className="w-5 h-5" />}
            title="Tous les ordres" tone="gray" />
          <NavCard href="/production/ingredients/inventory" icon={<PackagePlus className="w-5 h-5" />}
            title="Inventaire MP" tone="gray" />
        </section>

        {onPreviewAgent && (
          <button onClick={onPreviewAgent}
            className="w-full text-center text-xs text-gray-400 hover:text-purple-700 py-2">
            👁 Voir l'écran tel que l'agent de production le voit
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   VUE AGENT — gros boutons, très peu de texte
   ============================================================ */
function AgentView() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<'planned' | 'in_progress'>('planned');

  // STRICT : uniquement les ordres QUI LUI SONT AFFECTÉS (assigned=me,
  // résolu côté serveur). Terminé = sorti de son écran.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plannedR, inProgR] = await Promise.allSettled([
        fetch('/api/production/orders?status=planned&assigned=me'),
        fetch('/api/production/orders?status=in_progress&assigned=me'),
      ]);
      const arr = async (r: PromiseSettledResult<Response>) =>
        r.status === 'fulfilled' && r.value.ok ? ((await r.value.json()).data || []) : [];
      setOrders([...(await arr(inProgR)), ...(await arr(plannedR))]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(order: any, action: 'start' | 'complete') {
    setActing(order.ProductionOrderId);
    setMessage(null);
    try {
      const r = await fetch(`/api/production/orders/${order.ProductionOrderId}/${action}`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      setMessage(action === 'start' ? '✅ Travail commencé !' : '🎉 Travail terminé, bravo !');
      setTab(action === 'start' ? 'in_progress' : 'planned');
      await load();
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-16">
      <Header subtitle="Mon travail du jour" onRefresh={load} />

      <div className="max-w-xl mx-auto p-3 sm:p-6 space-y-4">
        {message && (
          <div className="text-base font-semibold text-center bg-white border-2 border-purple-200 rounded-2xl px-3 py-3">
            {message}
          </div>
        )}

        {/* ===== MES TRAVAUX : PLANIFIÉ / EN COURS cliquables ===== */}
        <section>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setTab('planned')}
              className={'rounded-2xl py-3 text-center border-2 transition-all active:scale-[0.98] ' +
                (tab === 'planned' ? 'bg-purple-700 border-purple-700 text-white' : 'bg-white border-purple-200 text-purple-900')}>
              <p className="text-2xl font-bold tabular-nums">{orders.filter(o => o.Status === 'planned').length}</p>
              <p className="text-xs font-bold uppercase">Planifié</p>
            </button>
            <button onClick={() => setTab('in_progress')}
              className={'rounded-2xl py-3 text-center border-2 transition-all active:scale-[0.98] ' +
                (tab === 'in_progress' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-amber-200 text-amber-900')}>
              <p className="text-2xl font-bold tabular-nums">{orders.filter(o => o.Status === 'in_progress').length}</p>
              <p className="text-xs font-bold uppercase">En cours</p>
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : orders.filter(o => o.Status === tab).length === 0 ? (
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">😌</p>
              <p className="font-bold text-gray-700">
                {tab === 'planned' ? 'Rien de planifié pour vous' : 'Aucun travail en cours'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.filter(o => o.Status === tab).map((o: any) => {
                const inProgress = o.Status === 'in_progress';
                return (
                  <div key={o.ProductionOrderId}
                    className={`bg-white border-2 rounded-2xl p-4 ${inProgress ? 'border-amber-300' : 'border-purple-200'}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold truncate">{o.ProductName}</p>
                        <p className="text-2xl font-bold text-purple-800 tabular-nums">
                          {new Intl.NumberFormat('fr-FR').format(o.PlannedQuantity || 0)}
                          <span className="text-sm font-medium text-gray-500"> {o.Unit || 'unités'}</span>
                        </p>
                      </div>
                      {inProgress && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold shrink-0">
                          EN COURS
                        </span>
                      )}
                    </div>
                    {inProgress ? (
                      <button onClick={() => act(o, 'complete')} disabled={acting === o.ProductionOrderId}
                        className="w-full py-4 rounded-xl bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                        {acting === o.ProductionOrderId
                          ? <Loader2 className="w-6 h-6 animate-spin" />
                          : <><CheckCircle2 className="w-6 h-6" /> J'AI TERMINÉ</>}
                      </button>
                    ) : (
                      <button onClick={() => act(o, 'start')} disabled={acting === o.ProductionOrderId}
                        className="w-full py-4 rounded-xl bg-purple-700 text-white text-lg font-bold hover:bg-purple-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                        {acting === o.ProductionOrderId
                          ? <Loader2 className="w-6 h-6 animate-spin" />
                          : <><Play className="w-6 h-6" /> COMMENCER</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== DEUX GRANDES ACTIONS ===== */}
        <section className="grid grid-cols-1 gap-3">
          <Link href="/production/ingredients"
            className="bg-white border-2 border-blue-200 hover:border-blue-400 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99]">
            <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <PackagePlus className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold">Recevoir des matières</p>
              <p className="text-sm text-gray-500">Miel, pots, emballages…</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link href="/production/ingredients/inventory"
            className="bg-white border-2 border-purple-200 hover:border-purple-400 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99]">
            <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold">Compter les matières</p>
              <p className="text-sm text-gray-500">Inventaire : ce qu'il reste vraiment</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link href="/expenses/requests/quick"
            className="bg-white border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99]">
            <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <HandCoins className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold">Demander de l'argent</p>
              <p className="text-sm text-gray-500">Pour acheter ce qui manque</p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
        </section>
      </div>
    </div>
  );
}

/* ============================================================ */
function Header({ subtitle, onRefresh }: { subtitle: string; onRefresh: () => void }) {
  return (
    <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Factory className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">Production</h1>
            <p className="text-[11px] sm:text-sm opacity-90 truncate">{subtitle}</p>
          </div>
        </div>
        <button onClick={onRefresh} aria-label="Rafraîchir"
          className="p-2.5 bg-white/20 rounded-full hover:bg-white/30 shrink-0">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, href }: {
  label: string; value: string; tone?: 'amber' | 'red' | 'green'; href?: string;
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-900',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  const cls = `block rounded-lg px-2 py-2 text-center ${tone ? tones[tone] : 'bg-gray-50 text-gray-900'}` +
    (href ? ' active:scale-95 hover:ring-2 hover:ring-purple-300' : '');
  const inner = (
    <>
      <p className="text-base sm:text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function QueueLine({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{sub}</p>
      </div>
    </div>
  );
}

function NavCard({ href, icon, title, tone }: {
  href: string; icon: React.ReactNode; title: string;
  tone: 'purple' | 'blue' | 'emerald' | 'amber' | 'gray';
}) {
  const bg: Record<string, string> = {
    purple: 'border-purple-200 hover:border-purple-400',
    blue: 'border-blue-200 hover:border-blue-400',
    emerald: 'border-emerald-200 hover:border-emerald-400',
    amber: 'border-amber-200 hover:border-amber-400',
    gray: 'border-gray-200 hover:border-gray-400',
  };
  const chip: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-50 text-gray-700',
  };
  return (
    <Link href={href}
      className={`flex items-center gap-2.5 bg-white border-2 rounded-2xl p-3.5 transition-all active:scale-[0.99] ${bg[tone]}`}>
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${chip[tone]}`}>
        {icon}
      </span>
      <span className="font-bold text-sm text-gray-900">{title}</span>
    </Link>
  );
}
