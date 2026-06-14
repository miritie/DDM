'use client';

/**
 * Dashboard Administrateur — mobile-first.
 *
 * Standard maison : ÉTAT DES LIEUX système d'abord (chiffres avec
 * lien), la FILE DE VALIDATION (action principale de l'admin) juste
 * après, puis les accès groupés : dashboards par rôle, gestion
 * système, configuration métier.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, Users, UserCog, ShoppingBag, RefreshCw, Crown, Store,
  Calculator, Factory, MapPin, Package, Boxes, Building2, Gift,
  Layers, BarChart3, FileText, Settings, Wallet, ShieldCheck,
  Beaker, Eye, PlayCircle,
} from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { ApprovalQueue } from '@/components/dashboard/approval-queue';

interface SystemStats {
  totalUsers: number; activeUsers: number; totalRoles: number; totalPermissions: number;
  totalSales: number; totalCustomers: number; totalProducts: number; totalEmployees: number;
}

const EMPTY: SystemStats = {
  totalUsers: 0, activeUsers: 0, totalRoles: 0, totalPermissions: 0,
  totalSales: 0, totalCustomers: 0, totalProducts: 0, totalEmployees: 0,
};

const num = (n: number) => new Intl.NumberFormat('fr-FR').format(n || 0);

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SystemStats>(EMPTY);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/admin');
      const result = await response.json();
      if (response.ok && result.data) setStats(result.data);
    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const s = stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-16">
      {/* Header compact */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Administration</h1>
              <p className="text-[11px] sm:text-sm opacity-90 truncate">Système & supervision</p>
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
        {/* ===== ÉTAT DES LIEUX SYSTÈME ===== */}
        <section className="bg-white border-2 border-purple-200 rounded-2xl p-3 sm:p-4">
          <h2 className="text-sm sm:text-base font-bold text-purple-900 mb-2">État des lieux</h2>
          {loading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Stat label="Utilisateurs" value={num(s.totalUsers)} sub={`${s.activeUsers} actifs`} href="/admin/users" />
              <Stat label="Rôles" value={num(s.totalRoles)} sub={`${s.totalPermissions} permissions`} href="/admin/roles" />
              <Stat label="Employés" value={num(s.totalEmployees)} href="/hr/employees" />
              <Stat label="Produits" value={num(s.totalProducts)} href="/products" />
              <Stat label="Clients" value={num(s.totalCustomers)} href="/clients" />
              <Stat label="Ventes" value={num(s.totalSales)} href="/reports" />
            </div>
          )}
        </section>

        {/* ===== FILE DE VALIDATION (action principale de l'admin) ===== */}
        <ApprovalQueue />

        {/* ===== DASHBOARDS PAR RÔLE ===== */}
        <Group title="Voir comme…">
          <NavCard href="/dashboard/pca" icon={<Crown className="w-5 h-5" />} title="Espace PCA" tone="purple" />
          <NavCard href="/dashboard/manager" icon={<Store className="w-5 h-5" />} title="Commercial" tone="amber" />
          <NavCard href="/dashboard/accountant" icon={<Calculator className="w-5 h-5" />} title="Comptable" tone="emerald" />
          <NavCard href="/dashboard/production" icon={<Factory className="w-5 h-5" />} title="Production" tone="blue" />
        </Group>

        {/* ===== GESTION SYSTÈME ===== */}
        <Group title="Gestion système">
          <NavCard href="/admin/users" icon={<Users className="w-5 h-5" />} title="Utilisateurs" />
          <NavCard href="/admin/roles" icon={<UserCog className="w-5 h-5" />} title="Rôles & permissions" />
          <NavCard href="/admin/audit" icon={<ShieldCheck className="w-5 h-5" />} title="Journaux d'audit" />
          <NavCard href="/admin/workspace" icon={<Building2 className="w-5 h-5" />} title="Identité entreprise" />
          <NavCard href="/settings" icon={<Settings className="w-5 h-5" />} title="Paramètres" />
          <NavCard href="/admin/simulate" icon={<PlayCircle className="w-5 h-5" />} title="Simulation données" />
        </Group>

        {/* ===== CONFIGURATION MÉTIER ===== */}
        <Group title="Configuration métier">
          <NavCard href="/admin/outlets" icon={<MapPin className="w-5 h-5" />} title="Stands" />
          <NavCard href="/products" icon={<ShoppingBag className="w-5 h-5" />} title="Catalogue produits" />
          <NavCard href="/admin/product-categories" icon={<Layers className="w-5 h-5" />} title="Catégories" />
          <NavCard href="/stock/warehouses" icon={<Boxes className="w-5 h-5" />} title="Entrepôts" />
          <NavCard href="/admin/expense-config" icon={<FileText className="w-5 h-5" />} title="Config dépenses" />
          <NavCard href="/admin/loyalty-rules" icon={<Gift className="w-5 h-5" />} title="Règles fidélité" />
          <NavCard href="/treasury" icon={<Wallet className="w-5 h-5" />} title="Comptes & paiements" />
          <NavCard href="/production/recipes" icon={<Beaker className="w-5 h-5" />} title="Recettes" />
        </Group>

        {/* ===== PILOTAGE ===== */}
        <Group title="Pilotage">
          <NavCard href="/reports/annual" icon={<BarChart3 className="w-5 h-5" />} title="Rapport annuel" tone="purple" />
          <NavCard href="/reports" icon={<Eye className="w-5 h-5" />} title="Rapports & analyses" tone="emerald" />
          <NavCard href="/accounting" icon={<Calculator className="w-5 h-5" />} title="Comptabilité" tone="amber" />
          <NavCard href="/stock" icon={<Package className="w-5 h-5" />} title="État des stocks" tone="blue" />
        </Group>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, href }: {
  label: string; value: string; sub?: string; href?: string;
}) {
  const cls = 'block rounded-lg px-2 py-2 text-center bg-gray-50 text-gray-900' +
    (href ? ' active:scale-95 hover:ring-2 hover:ring-purple-300' : '');
  const inner = (
    <>
      <p className="text-base sm:text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-gray-400 leading-tight">{sub}</p>}
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">{title}</h2>
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
    </section>
  );
}

function NavCard({ href, icon, title, tone }: {
  href: string; icon: React.ReactNode; title: string;
  tone?: 'purple' | 'amber' | 'emerald' | 'blue';
}) {
  const borders: Record<string, string> = {
    purple: 'border-purple-200 hover:border-purple-400',
    amber: 'border-amber-200 hover:border-amber-400',
    emerald: 'border-emerald-200 hover:border-emerald-400',
    blue: 'border-blue-200 hover:border-blue-400',
  };
  const chips: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  const border = tone ? borders[tone] : 'border-gray-200 hover:border-purple-300';
  const chip = tone ? chips[tone] : 'bg-gray-50 text-gray-600';
  return (
    <Link href={href}
      className={`flex items-center gap-2.5 bg-white border-2 rounded-2xl p-3.5 transition-all active:scale-[0.99] ${border}`}>
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${chip}`}>{icon}</span>
      <span className="font-bold text-sm text-gray-900">{title}</span>
    </Link>
  );
}
