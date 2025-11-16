'use client';

/**
 * Page - Administration Dashboard
 * Module Administration & Settings
 * Vue d'ensemble de l'administration système
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Role, Workspace } from '@/types/modules';
import {
  Settings,
  Users,
  Shield,
  Building2,
  UserPlus,
  ShieldPlus,
  Activity,
  AlertCircle,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    totalRoles: number;
    activeRoles: number;
    totalWorkspaces: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);

      // Load users
      const usersRes = await fetch('/api/admin/users');
      let totalUsers = 0;
      let activeUsers = 0;
      let inactiveUsers = 0;
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const users = usersData.data || [];
        totalUsers = users.length;
        activeUsers = users.filter((u: User) => u.IsActive).length;
        inactiveUsers = users.filter((u: User) => !u.IsActive).length;
      }

      // Load roles
      const rolesRes = await fetch('/api/admin/roles');
      let totalRoles = 0;
      let activeRoles = 0;
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        const roles = rolesData.data || [];
        totalRoles = roles.length;
        activeRoles = roles.filter((r: Role) => r.IsActive).length;
      }

      // Load workspaces
      const workspacesRes = await fetch('/api/admin/workspaces');
      let totalWorkspaces = 0;
      if (workspacesRes.ok) {
        const workspacesData = await workspacesRes.json();
        totalWorkspaces = (workspacesData.data || []).length;
      }

      setStats({
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalRoles,
        activeRoles,
        totalWorkspaces,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8 text-purple-600" />
              Administration
            </h1>
            <p className="text-gray-600">Gestion système, utilisateurs, rôles et permissions</p>
          </div>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Actions Rapides</h2>
                <p className="text-purple-100">Gérer les utilisateurs et les permissions</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/users/new')}
                  className="bg-white text-purple-600 hover:bg-gray-100 border-white"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nouvel Utilisateur
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/admin/roles/new')}
                  className="bg-white text-purple-600 hover:bg-gray-100 border-white"
                >
                  <ShieldPlus className="h-4 w-4 mr-2" />
                  Nouveau Rôle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Users Stats */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/users')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                Utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Chargement...</p>
              ) : (
                <>
                  <p className="text-3xl font-bold text-blue-600">{stats?.totalUsers || 0}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-green-600 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {stats?.activeUsers || 0} actifs
                    </span>
                    <span className="text-gray-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {stats?.inactiveUsers || 0} inactifs
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Roles Stats */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/roles')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Rôles & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Chargement...</p>
              ) : (
                <>
                  <p className="text-3xl font-bold text-green-600">{stats?.totalRoles || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {stats?.activeRoles || 0} rôle(s) actif(s)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Workspaces Stats */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/admin/settings')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Workspaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Chargement...</p>
              ) : (
                <>
                  <p className="text-3xl font-bold text-purple-600">{stats?.totalWorkspaces || 0}</p>
                  <p className="text-xs text-gray-500 mt-2">Espaces de travail configurés</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Management Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Users Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Utilisateurs
              </CardTitle>
              <CardDescription>Gérer les comptes utilisateurs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/admin/users')}
                >
                  Voir tous les utilisateurs
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/admin/users/new')}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Créer un utilisateur
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Roles Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Rôles & Permissions
              </CardTitle>
              <CardDescription>Gérer les droits d'accès</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/admin/roles')}
                >
                  Voir tous les rôles
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/admin/roles/new')}
                >
                  <ShieldPlus className="h-4 w-4 mr-2" />
                  Créer un rôle
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Settings Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600" />
                Paramètres
              </CardTitle>
              <CardDescription>Configuration système</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push('/admin/settings')}
                >
                  Paramètres généraux
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  Logs système
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedPage>
  );
}
