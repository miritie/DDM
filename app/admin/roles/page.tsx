'use client';

/**
 * Page - Gestion des Rôles & Permissions
 * Module Administration & Settings
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Role } from '@/types/modules';
import { Shield, ShieldPlus, ArrowLeft, Users, CheckCircle, XCircle } from 'lucide-react';

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      let url = '/api/admin/roles';
      if (filter !== 'all') {
        url += `?isActive=${filter === 'active'}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data || []);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setLoading(false);
    }
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
    }).format(new Date(dateString));
  }

  const stats = {
    total: roles.length,
    active: roles.filter((r) => r.IsActive).length,
    inactive: roles.filter((r) => !r.IsActive).length,
  };

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_ROLES_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-green-600" />
              Rôles & Permissions
            </h1>
            <p className="text-gray-600">Gestion des rôles et droits d'accès système</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/admin')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Button onClick={() => router.push('/admin/roles/new')}>
              <ShieldPlus className="h-4 w-4 mr-2" />
              Nouveau Rôle
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Rôles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Rôles configurés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Rôles Actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-gray-500 mt-1">Rôles activés</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-gray-600" />
                Rôles Inactifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              <p className="text-xs text-gray-500 mt-1">Rôles désactivés</p>
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

        {/* Roles List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Rôles</CardTitle>
            <CardDescription>{roles.length} rôle(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : roles.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucun rôle trouvé</p>
                <Button onClick={() => router.push('/admin/roles/new')}>Créer un rôle</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <Card
                    key={role.RoleId}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/admin/roles/${role.RoleId}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="h-5 w-5 text-green-600" />
                          <CardTitle className="text-lg">{role.Name}</CardTitle>
                        </div>
                        {getStatusBadge(role.IsActive)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {role.Description || 'Aucune description'}
                      </p>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Permissions</span>
                          <span className="font-medium text-green-600">
                            {role.PermissionIds?.length || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Créé le</span>
                          <span className="text-gray-700">{formatDate(role.CreatedAt)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permissions Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">À propos des Permissions</CardTitle>
            <CardDescription>Comprendre le système de permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Permissions de Base</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Vue (VIEW) - Consulter les données</li>
                  <li>• Création (CREATE) - Créer de nouveaux enregistrements</li>
                  <li>• Édition (EDIT) - Modifier les enregistrements existants</li>
                  <li>• Suppression (DELETE) - Supprimer des enregistrements</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Modules Protégés</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Ventes & Opérations</li>
                  <li>• Stocks & Mouvements</li>
                  <li>• Trésorerie Multi-Wallet</li>
                  <li>• Avances & Dettes</li>
                  <li>• Administration & Settings</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
