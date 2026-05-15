'use client';

/**
 * Dashboard Administrateur
 * Vue d'ensemble système, utilisateurs, sécurité, et gestion
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Shield,
  Database,
  Activity,
  CheckCircle,
  Settings,
  FileText,
  Lock,
  TrendingUp,
  Zap,
  RefreshCw,
  Loader2,
  MapPin,
  Layers,
  Gift,
  BarChart3,
  Package,
  Building2,
  Boxes,
  Briefcase,
  Calculator,
  ShoppingBag,
  Eye,
  Wallet as WalletIcon,
} from 'lucide-react';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/logout-button';
import { ApprovalQueue } from '@/components/dashboard/approval-queue';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalPermissions: number;
  totalSales: number;
  totalCustomers: number;
  totalProducts: number;
  totalEmployees: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalRoles: 0,
    totalPermissions: 0,
    totalSales: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalEmployees: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/admin');
      const result = await response.json();

      if (response.ok && result.data) {
        setStats(result.data);
      }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-3">
              <Shield className="w-10 h-10 text-white" />
              <h1 className="text-3xl font-bold">Dashboard Admin</h1>
            </div>
            <p className="mt-2 text-purple-100 text-sm">
              Gestion système et supervision complète
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton
              variant="ghost"
              size="sm"
              showText={false}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white"
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-8">
        {/* Lien vers l'espace PCA (synthèses, formules, contrôle) */}
        <Link
          href="/dashboard/pca"
          className="block bg-gradient-to-r from-purple-700 via-fuchsia-700 to-pink-700 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Espace PCA</h3>
                <p className="text-sm opacity-90">Synthèses stratégiques, formules confidentielles, contrôle</p>
              </div>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </Link>

        {/* File de validation — sollicitations en attente */}
        <ApprovalQueue />

        {/* Stats Système */}
        <div>
          <h2 className="text-2xl font-display font-bold text-brown-900 mb-4 flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-600" />
            Statistiques Système
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="relative overflow-hidden group border-2 border-purple-200 hover:border-purple-400 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  Utilisateurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-brown-900">{stats.totalUsers}</div>
                <p className="text-xs text-brown-500 mt-2">
                  {stats.activeUsers} actifs • {stats.totalUsers - stats.activeUsers} inactifs
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group border-2 border-indigo-200 hover:border-indigo-400 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  Rôles & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-brown-900">{stats.totalRoles}</div>
                <p className="text-xs text-brown-500 mt-2">
                  {stats.totalPermissions} permissions disponibles
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group border-2 border-blue-200 hover:border-blue-400 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Données Métier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-display font-bold text-brown-900">
                  {stats.totalSales} ventes
                </div>
                <p className="text-xs text-brown-500 mt-2">
                  {stats.totalCustomers} clients • {stats.totalProducts} produits
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden group border-2 border-green-200 hover:border-green-400 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-100 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-brown-600 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Ressources Humaines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-brown-900">{stats.totalEmployees}</div>
                <p className="text-xs text-brown-500 mt-2">
                  Employés actifs
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation entre dashboards (vue par profil) */}
        <div>
          <h2 className="text-2xl font-display font-bold text-brown-900 mb-4 flex items-center gap-2">
            <Eye className="w-6 h-6 text-indigo-600" />
            Voir par profil
          </h2>
          <p className="text-sm text-brown-600 mb-4">
            En tant qu'Administrateur multi-profils, vous pouvez accéder directement aux dashboards des autres rôles
            sans changer de session — vos permissions admin restent actives partout.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Link href="/dashboard/dg" className="block">
              <div className="p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 bg-white hover:shadow-md transition text-center">
                <Briefcase className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">Direction (DG/PCA)</p>
              </div>
            </Link>
            <Link href="/dashboard/manager" className="block">
              <div className="p-4 rounded-xl border-2 border-orange-200 hover:border-orange-400 bg-white hover:shadow-md transition text-center">
                <Building2 className="w-7 h-7 text-orange-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">Manager Commercial</p>
              </div>
            </Link>
            <Link href="/dashboard/accountant" className="block">
              <div className="p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 bg-white hover:shadow-md transition text-center">
                <Calculator className="w-7 h-7 text-blue-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">Comptabilité</p>
              </div>
            </Link>
            <Link href="/dashboard/sales" className="block">
              <div className="p-4 rounded-xl border-2 border-pink-200 hover:border-pink-400 bg-white hover:shadow-md transition text-center">
                <ShoppingBag className="w-7 h-7 text-pink-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">Agent Commercial</p>
              </div>
            </Link>
            <Link href="/stock" className="block">
              <div className="p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 bg-white hover:shadow-md transition text-center">
                <Boxes className="w-7 h-7 text-purple-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">Vue Stock</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Actions Rapides Admin */}
        <div>
          <h2 className="text-2xl font-display font-bold text-brown-900 mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-purple-600" />
            Actions Rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/sales/quick">
              <Card className="h-full border-2 border-emerald-200 hover:border-emerald-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Vente rapide</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Caisse POS — produits en grille, panier, encaissement
                  </p>
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Ouvrir →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/users">
              <Card className="h-full border-2 border-purple-200 hover:border-purple-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Gestion Utilisateurs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Créer, modifier et gérer les utilisateurs
                  </p>
                  <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/roles">
              <Card className="h-full border-2 border-indigo-200 hover:border-indigo-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Rôles & Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Configurer les rôles et permissions (RBAC)
                  </p>
                  <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/audit">
              <Card className="h-full border-2 border-blue-200 hover:border-blue-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Journaux d'Audit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Consulter les logs et l'historique des actions
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/expense-config">
              <Card className="h-full border-2 border-amber-200 hover:border-amber-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Calculator className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Config des dépenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Catégories, droits par rôle, plan comptable OHADA, mapping wallets
                  </p>
                  <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/settings">
              <Card className="h-full border-2 border-gray-200 hover:border-gray-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Paramètres Système</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Configuration générale de l'application
                  </p>
                  <div className="flex items-center gap-2 text-gray-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/treasury">
              <Card className="h-full border-2 border-emerald-200 hover:border-emerald-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <WalletIcon className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Comptes & Moyens de paiement</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Portefeuilles (caisses, banques, Mobile Money) et méthodes acceptées — activer / désactiver
                  </p>
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Configurer →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/dg">
              <Card className="h-full border-2 border-green-200 hover:border-green-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Dashboard Direction</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Vue d'ensemble des KPIs et de la performance
                  </p>
                  <div className="flex items-center gap-2 text-green-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/outlets">
              <Card className="h-full border-2 border-amber-200 hover:border-amber-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <MapPin className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Points de vente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Outlets, types, prix, factures, planning, QR
                  </p>
                  <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/outlets/reporting">
              <Card className="h-full border-2 border-cyan-200 hover:border-cyan-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Reporting outlets</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    P&L par stand, perf commerciaux, journaux de caisse
                  </p>
                  <div className="flex items-center gap-2 text-cyan-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/clients">
              <Card className="h-full border-2 border-blue-200 hover:border-blue-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Clients grossistes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Comptes B2B pour les commandes négociées
                  </p>
                  <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/replenishments">
              <Card className="h-full border-2 border-violet-200 hover:border-violet-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Boxes className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Approvisionnements stands</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Commandes internes : production + distribution vers stands
                  </p>
                  <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/product-categories">
              <Card className="h-full border-2 border-pink-200 hover:border-pink-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Layers className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Catégories produits</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Organiser les produits du catalogue
                  </p>
                  <div className="flex items-center gap-2 text-pink-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/loyalty-rules">
              <Card className="h-full border-2 border-yellow-200 hover:border-yellow-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Règles fidélité</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Programme de fidélisation client
                  </p>
                  <div className="flex items-center gap-2 text-yellow-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/products">
              <Card className="h-full border-2 border-teal-200 hover:border-teal-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Catalogue produits</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Liste, prix de référence, images
                  </p>
                  <div className="flex items-center gap-2 text-teal-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/stock/warehouses">
              <Card className="h-full border-2 border-violet-200 hover:border-violet-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Entrepôts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Créer / gérer les dépôts centraux (alimentent les outlets)
                  </p>
                  <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/stock">
              <Card className="h-full border-2 border-purple-200 hover:border-purple-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Boxes className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">État des stocks</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Vue par entrepôt et par outlet, alertes, mouvements
                  </p>
                  <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/orders">
              <Card className="h-full border-2 border-cyan-200 hover:border-cyan-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Commandes clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Approuver les commandes négociées en attente de validation
                  </p>
                  <div className="flex items-center gap-2 text-cyan-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/workspace">
              <Card className="h-full border-2 border-rose-200 hover:border-rose-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Identité entreprise</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Nom, slogan, logo, coordonnées (utilisés sur les en-têtes imprimables)
                  </p>
                  <div className="flex items-center gap-2 text-rose-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin">
              <Card className="h-full border-2 border-orange-200 hover:border-orange-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Centre admin complet</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Tableau de bord administration consolidé
                  </p>
                  <div className="flex items-center gap-2 text-orange-600 font-semibold text-sm group-hover:gap-3 transition-all">
                    Accéder →
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* État du Système */}
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-purple-600" />
              État du Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-brown-900">Base de données PostgreSQL</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-600 text-white text-sm font-semibold">
                  Opérationnel
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-brown-900">API Routes</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-600 text-white text-sm font-semibold">
                  159+ actives
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-brown-900">Authentification NextAuth</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-600 text-white text-sm font-semibold">
                  Sécurisé
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-brown-900">RBAC (Contrôle d'accès)</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-semibold">
                  {stats.totalPermissions} permissions
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations Workspace */}
        <Card className="border-2 border-brown-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-brown-600" />
              Informations Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1 p-3 bg-purple-50 rounded-lg">
                <span className="text-purple-700 text-xs font-medium uppercase tracking-wide">Modules implémentés</span>
                <span className="font-bold text-purple-900 text-lg">28 modules</span>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-brown-50 rounded-lg">
                <span className="text-brown-600 text-xs font-medium uppercase tracking-wide">Version</span>
                <span className="font-semibold text-brown-900">v2.0.0 - PostgreSQL</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
