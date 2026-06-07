'use client';

/**
 * Dashboard Manager Commercial — mobile-first.
 *
 * Standard maison : ÉTAT DES LIEUX d'abord (9 chiffres, chacun
 * CLIQUABLE vers son détail), puis les actions du métier (vente,
 * mouvement de stock, réappro, client), puis les accès stands.
 * Les alertes remontent au-dessus de tout.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Package, Users, AlertTriangle, RefreshCw,
  ArrowRight, MapPin, BarChart3, Store, UserPlus, Repeat,
} from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';

interface ManagerDashboardData {
  sales: { today: number; week: number; month: number; pending: number };
  stock: { lowStock: number; outOfStock: number; totalProducts: number; totalValue: number };
  employees: { total: number; present: number; absent: number; onLeave: number };
  customers: { total: number; new: number; active: number };
  alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; action?: string; link?: string }>;
}

const fmtF = (n: number) => {
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';
};

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ManagerDashboardData | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/manager');
      const result = await response.json();
      if (response.ok) setData(result.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const d = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 pb-16">
      {/* Header compact */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Store className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Commercial</h1>
              <p className="text-[11px] sm:text-sm opacity-90 truncate">Stands, ventes & équipe</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleRefresh} disabled={refreshing} aria-label="Rafraîchir"
              className="p-2.5 bg-white/20 rounded-full hover:bg-white/30">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <LogoutButton variant="ghost" size="sm" showText={false}
              className="p-2.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white" />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
        {/* Alertes */}
        {d?.alerts && d.alerts.length > 0 && (
          <div className="space-y-2">
            {d.alerts.map((alert, idx) => (
              <button key={idx}
                onClick={() => alert.link && router.push(alert.link)}
                className={'w-full text-left flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm ' +
                  (alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800'
                    : alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800')}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="font-medium">{alert.message}</span>
              </button>
            ))}
          </div>
        )}

        {/* ===== ÉTAT DES LIEUX : 9 chiffres cliquables ===== */}
        <section className="bg-white border-2 border-orange-200 rounded-2xl p-3 sm:p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm sm:text-base font-bold text-orange-900">État des lieux</h2>
            <span className="text-[10px] text-gray-400">
              {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </span>
          </div>
          {loading || !d ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Stat label="Ventes aujourd'hui" value={fmtF(d.sales.today)} tone="amber" href="/reports" />
              <Stat label="Ventes 7 jours" value={fmtF(d.sales.week)} tone="amber" href="/reports" />
              <Stat label="Ventes 30 jours" value={fmtF(d.sales.month)} tone="amber" href="/reports" />
              <Stat label="Stock valorisé" value={fmtF(d.stock.totalValue)} href="/stock" />
              <Stat label="Ruptures" value={String(d.stock.outOfStock)}
                tone={d.stock.outOfStock > 0 ? 'red' : 'green'} href="/stock/alerts" />
              <Stat label="Stock bas" value={String(d.stock.lowStock)}
                tone={d.stock.lowStock > 0 ? 'amber' : 'green'} href="/stock/alerts" />
              <Stat label="Présents / équipe" value={`${d.employees.present}/${d.employees.total}`}
                tone={d.employees.present === 0 ? 'red' : undefined} href="/hr/attendance" />
              <Stat label="Clients" value={String(d.customers.total)} href="/customers" />
              <Stat label="Ventes en attente" value={String(d.sales.pending)}
                tone={d.sales.pending > 0 ? 'amber' : undefined} href="/sales?filter=pending" />
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center mt-2">Touchez un chiffre pour voir le détail</p>
        </section>

        {/* ===== ACTIONS DU MÉTIER ===== */}
        <section className="grid grid-cols-2 gap-2.5">
          <ActionCard href="/sales/quick" icon={<ShoppingCart className="w-6 h-6" />}
            title="Vente rapide" sub="Ouvrir la caisse" tone="emerald" />
          <ActionCard href="/replenishments" icon={<Repeat className="w-6 h-6" />}
            title="Réappro stands" sub="Demander à produire" tone="amber" />
          <ActionCard href="/stock/movements/quick" icon={<Package className="w-6 h-6" />}
            title="Mouvement stock" sub="Entrées / sorties" tone="blue" />
          <ActionCard href="/customers/quick" icon={<UserPlus className="w-6 h-6" />}
            title="Client rapide" sub="Enregistrer un client" tone="purple" />
        </section>

        {/* ===== STANDS & PILOTAGE ===== */}
        <section className="grid grid-cols-2 gap-2.5">
          <NavCard href="/admin/outlets" icon={<MapPin className="w-5 h-5" />} title="Stands" />
          <NavCard href="/admin/outlets/planning" icon={<Users className="w-5 h-5" />} title="Planning vendeurs" />
          <NavCard href="/admin/outlets/reporting" icon={<BarChart3 className="w-5 h-5" />} title="Rapports stands" />
          <NavCard href="/orders" icon={<ArrowRight className="w-5 h-5" />} title="Commandes clients" />
        </section>
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
    (href ? ' active:scale-95 hover:ring-2 hover:ring-orange-300' : '');
  const inner = (
    <>
      <p className="text-base sm:text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function ActionCard({ href, icon, title, sub, tone }: {
  href: string; icon: React.ReactNode; title: string; sub: string;
  tone: 'emerald' | 'amber' | 'blue' | 'purple';
}) {
  const chips: Record<string, { chip: string; border: string }> = {
    emerald: { chip: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200 hover:border-emerald-400' },
    amber: { chip: 'bg-amber-100 text-amber-700', border: 'border-amber-200 hover:border-amber-400' },
    blue: { chip: 'bg-blue-100 text-blue-700', border: 'border-blue-200 hover:border-blue-400' },
    purple: { chip: 'bg-purple-100 text-purple-700', border: 'border-purple-200 hover:border-purple-400' },
  };
  return (
    <Link href={href}
      className={`bg-white border-2 rounded-2xl p-3.5 flex flex-col gap-2 transition-all active:scale-[0.99] ${chips[tone].border}`}>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${chips[tone].chip}`}>
        {icon}
      </span>
      <span>
        <span className="block font-bold text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </Link>
  );
}

function NavCard({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 bg-white border-2 border-gray-200 hover:border-orange-300 rounded-2xl p-3.5 transition-all active:scale-[0.99]">
      <span className="w-9 h-9 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="font-bold text-sm text-gray-900">{title}</span>
    </Link>
  );
}
