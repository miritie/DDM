'use client';

/**
 * Page - Édition de Rôle
 */

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Shield, Loader2, AlertCircle } from 'lucide-react';
import { PermissionsSelector } from '@/components/admin/permissions-selector';
import { Permission } from '@/types/modules';

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.roleId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    selectedPermissionIds: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    loadRole();
  }, [roleId]);

  async function loadRole() {
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`);
      if (res.ok) {
        const data = await res.json();
        const role = data.data;

        // Charger les permissions depuis la table role_permissions
        const permissionIds = role.permissions?.map((p: any) => p.id) || [];

        setFormData({
          name: role.Name || '',
          description: role.Description || '',
          selectedPermissionIds: permissionIds,
          isActive: role.IsActive ?? true,
        });
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        setError('Erreur lors du chargement du rôle');
      }
    } catch (err) {
      console.error('Error loading role:', err);
      setError('Erreur lors du chargement du rôle');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        setError('Le nom du rôle est obligatoire');
        setSaving(false);
        return;
      }

      if (formData.selectedPermissionIds.length === 0) {
        setError('Veuillez sélectionner au moins une permission');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          permissionIds: formData.selectedPermissionIds,
          isActive: formData.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la mise à jour du rôle');
      }

      router.push('/admin/roles');
    } catch (err: any) {
      console.error('Error updating role:', err);
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADMIN_ROLES_EDIT}>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-lg">Chargement...</span>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  if (notFound) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADMIN_ROLES_EDIT}>
        <div className="p-8 max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                Rôle non trouvé
              </CardTitle>
            </CardHeader>
            <CardContent className="text-red-700">
              <p className="mb-4">Le rôle avec l'ID "{roleId}" n'a pas été trouvé.</p>
              <Button onClick={() => router.push('/admin/roles')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à la liste
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_ROLES_EDIT}>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Éditer le Rôle
          </h1>
          <Button variant="outline" onClick={() => router.push('/admin/roles')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informations du rôle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du rôle *
                </label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Superviseur, Technicien, etc."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description du rôle et de ses responsabilités"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Rôle actif
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <PermissionsSelector
                selectedPermissionIds={formData.selectedPermissionIds}
                onPermissionsChange={(ids) =>
                  setFormData({ ...formData, selectedPermissionIds: ids })
                }
              />
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement en cours...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Enregistrer les Modifications
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/roles')}
              disabled={saving}
            >
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
