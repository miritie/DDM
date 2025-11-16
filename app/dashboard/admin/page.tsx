/**
 * Dashboard Administrateur
 * Vue d'ensemble système, utilisateurs, sécurité, et gestion
 */

'use client';

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
} from 'lucide-react';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/logout-button';

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
              size="icon"
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

        {/* Actions Rapides Admin */}
        <div>
          <h2 className="text-2xl font-display font-bold text-brown-900 mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-purple-600" />
            Actions Rapides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            <Link href="/admin/backup">
              <Card className="h-full border-2 border-orange-200 hover:border-orange-400 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-3 shadow-medium group-hover:scale-110 transition-transform">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">Sauvegardes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brown-600 mb-4">
                    Gérer les sauvegardes de la base de données
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
