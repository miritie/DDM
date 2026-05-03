'use client';

/**
 * Page - Édition d'Utilisateur
 * Module Administration & Settings
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertCircle, Save, Loader2, Trash2, KeyRound } from 'lucide-react';
import { User, Role } from '@/types/modules';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    displayName: '',
    phone: '',
    roleIds: [] as string[],
    primaryRoleId: '',
    isActive: true,
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    void loadAll();
  }, [userId]);

  async function loadAll() {
    try {
      setLoading(true);
      const [userRes, rolesRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}`),
        fetch('/api/admin/roles?isActive=true'),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }

      if (!userRes.ok) {
        setUser(null);
        return;
      }

      const userData = await userRes.json();
      const u: User & { roles?: Array<{ id: string; isPrimary: boolean }> } = userData.data;
      setUser(u);
      const userRoles = u.roles || [];
      const assignedIds = userRoles.map((r) => r.id);
      const primary = userRoles.find((r) => r.isPrimary)?.id || u.RoleId || assignedIds[0] || '';
      setFormData({
        email: u.Email || '',
        fullName: u.FullName || '',
        displayName: u.DisplayName || '',
        phone: u.Phone || '',
        roleIds: assignedIds.length > 0 ? assignedIds : (u.RoleId ? [u.RoleId] : []),
        primaryRoleId: primary,
        isActive: u.IsActive ?? true,
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Error loading user:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!formData.email) e.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Email invalide';

    if (!formData.fullName) e.fullName = 'Nom complet requis';
    if (!formData.displayName) e.displayName = 'Nom d\'affichage requis';
    if (formData.roleIds.length === 0) e.roleIds = 'Au moins un rôle requis';
    else if (!formData.primaryRoleId || !formData.roleIds.includes(formData.primaryRoleId))
      e.primaryRoleId = 'Rôle principal invalide';

    if (formData.password) {
      if (formData.password.length < 8) e.password = 'Minimum 8 caractères';
      if (formData.password !== formData.confirmPassword)
        e.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!validate()) return;

    try {
      setSaving(true);

      // Le rôle principal en première position (le service le marquera is_primary=true).
      const orderedRoleIds = [
        formData.primaryRoleId,
        ...formData.roleIds.filter((id) => id !== formData.primaryRoleId),
      ];

      const payload: Record<string, any> = {
        email: formData.email,
        fullName: formData.fullName,
        displayName: formData.displayName,
        phone: formData.phone || null,
        roleId: formData.primaryRoleId,
        roleIds: orderedRoleIds,
        isActive: formData.isActive,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la mise à jour');
      }

      const data = await res.json();
      setUser(data.data);
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      setFeedback({ type: 'success', message: 'Utilisateur mis à jour avec succès' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement l'utilisateur ${user?.FullName} ?`)) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      router.push('/admin/users');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADMIN_USERS_EDIT}>
        <div className="p-8 max-w-4xl mx-auto">
          <p className="text-gray-500">Chargement...</p>
        </div>
      </ProtectedPage>
    );
  }

  if (!user) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADMIN_USERS_EDIT}>
        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Utilisateur introuvable</h1>
            <Button variant="outline" onClick={() => router.push('/admin/users')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                Utilisateur non trouvé
              </CardTitle>
            </CardHeader>
            <CardContent className="text-red-700">
              <p>L'utilisateur avec l'ID "{userId}" n'a pas été trouvé.</p>
            </CardContent>
          </Card>
        </div>
      </ProtectedPage>
    );
  }

  const selectedRoles = roles.filter((r) => formData.roleIds.includes((r as any).id));
  const primaryRole = roles.find((r) => (r as any).id === formData.primaryRoleId);

  function toggleRole(roleUuid: string) {
    setFormData((prev) => {
      const has = prev.roleIds.includes(roleUuid);
      if (has) {
        const next = prev.roleIds.filter((id) => id !== roleUuid);
        const newPrimary =
          prev.primaryRoleId === roleUuid ? next[0] || '' : prev.primaryRoleId;
        return { ...prev, roleIds: next, primaryRoleId: newPrimary };
      }
      const next = [...prev.roleIds, roleUuid];
      return {
        ...prev,
        roleIds: next,
        primaryRoleId: prev.primaryRoleId || roleUuid,
      };
    });
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_USERS_EDIT}>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Éditer : {user.FullName}</h1>
            <p className="text-gray-600">
              {user.Email} · ID : <code className="text-xs">{user.UserId}</code>
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {feedback && (
          <div
            className={`mb-6 px-4 py-3 rounded-md border ${
              feedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations du compte</CardTitle>
              <CardDescription>Identité et coordonnées de l'utilisateur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.fullName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom d'affichage <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.displayName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.displayName && (
                    <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Compte actif</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Décocher empêche l'utilisateur de se connecter.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rôles et permissions</CardTitle>
              <CardDescription>
                Cochez tous les rôles disponibles pour cet utilisateur. Désignez ensuite le rôle
                principal (utilisé par défaut à la connexion).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôles attribués <span className="text-red-500">*</span>
                </label>
                <div
                  className={`space-y-2 p-3 rounded-md border ${
                    errors.roleIds ? 'border-red-500' : 'border-gray-200'
                  }`}
                >
                  {roles.length === 0 && (
                    <p className="text-sm text-gray-500">Aucun rôle disponible.</p>
                  )}
                  {roles.map((role) => {
                    const uuid = (role as any).id;
                    const checked = formData.roleIds.includes(uuid);
                    const isPrimary = formData.primaryRoleId === uuid;
                    return (
                      <div
                        key={role.RoleId}
                        className={`flex items-center justify-between gap-3 p-2 rounded ${
                          checked ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRole(uuid)}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {role.Name}
                          </span>
                          {(role as any).Description && (
                            <span className="text-xs text-gray-500 truncate hidden md:inline">
                              · {(role as any).Description}
                            </span>
                          )}
                        </label>
                        {checked && (
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, primaryRoleId: uuid }))
                            }
                            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                              isPrimary
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title="Définir comme rôle principal (par défaut à la connexion)"
                          >
                            {isPrimary ? '★ Principal' : 'Définir principal'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {errors.roleIds && (
                  <p className="text-red-500 text-xs mt-1">{errors.roleIds}</p>
                )}
                {errors.primaryRoleId && (
                  <p className="text-red-500 text-xs mt-1">{errors.primaryRoleId}</p>
                )}
              </div>

              {selectedRoles.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
                  <p className="font-medium">
                    {selectedRoles.length} rôle{selectedRoles.length > 1 ? 's' : ''} attribué
                    {selectedRoles.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    Principal :{' '}
                    <span className="font-semibold">
                      {primaryRole?.Name || '(à définir)'}
                    </span>
                  </p>
                  {primaryRole && (
                    <a
                      href={`/admin/roles/${primaryRole.RoleId}`}
                      className="text-xs text-blue-700 underline mt-2 inline-block"
                    >
                      Gérer les permissions du rôle principal →
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                Réinitialiser le mot de passe
              </CardTitle>
              <CardDescription>
                Laisser vide pour conserver le mot de passe actuel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Minimum 8 caractères"
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmer
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/users')}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
