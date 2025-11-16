'use client';

/**
 * Page - Gestion des Utilisateurs
 * Module Administration & Settings
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Role } from '@/types/modules';
import { Users, UserPlus, Mail, Phone, Shield, Activity, AlertCircle, ArrowLeft } from 'lucide-react';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // Load roles first
      const rolesRes = await fetch('/api/admin/roles');
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }

      // Load users with filter
      let url = '/api/admin/users';
      if (filter !== 'all') {
        url += `?isActive=${filter === 'active'}`;
      }
      const usersRes = await fetch(url);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getRoleName(roleId: string): string {
    const role = roles.find((r) => r.RoleId === roleId);
    return role?.Name || 'Rôle inconnu';
  }

  function getStatusBadge(isActive: boolean) {
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {isActive ? 'Actif' : 'Inactif'}
      </span>
    );
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  const stats = {
    total: users.length,
    active: users.filter((u) => u.IsActive).length,
    inactive: users.filter((u) => !u.IsActive).length,
  };

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_USERS_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              Utilisateurs
            </h1>
            <p className="text-gray-600">Gestion des comptes utilisateurs et accès système</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Button onClick={() => router.push('/admin/users/new')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Nouvel Utilisateur
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Comptes créés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                Utilisateurs Actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-gray-500 mt-1">Comptes activés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-gray-600" />
                Utilisateurs Inactifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              <p className="text-xs text-gray-500 mt-1">Comptes désactivés</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Tous
              </Button>
              <Button variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')}>
                Actifs
              </Button>
              <Button variant={filter === 'inactive' ? 'default' : 'outline'} onClick={() => setFilter('inactive')}>
                Inactifs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Utilisateurs</CardTitle>
            <CardDescription>{users.length} utilisateur(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucun utilisateur trouvé</p>
                <Button onClick={() => router.push('/admin/users/new')}>Créer un utilisateur</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Utilisateur
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Dernière connexion
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Créé le
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr
                        key={user.UserId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/admin/users/${user.UserId}`)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{user.FullName}</p>
                            <p className="text-xs text-gray-500">{user.DisplayName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="text-sm flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400" />
                              {user.Email}
                            </p>
                            {user.Phone && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="h-3 w-3 text-gray-400" />
                                {user.Phone}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Shield className="h-3 w-3 text-gray-400" />
                            {getRoleName(user.RoleId)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(user.IsActive)}</td>
                        <td className="px-4 py-3 text-sm">
                          {user.LastLoginAt ? formatDate(user.LastLoginAt) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(user.CreatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
