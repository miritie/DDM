'use client';

/**
 * Page - Édition de Rôle
 */

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Shield, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { PermissionsSelector } from '@/components/admin/permissions-selector';
import { Permission } from '@/types/modules';

/**
 * Calcule le diff entre deux ensembles d'UUIDs de permissions.
 */
function diffPermissionIds(initial: string[], current: string[]) {
  const initialSet = new Set(initial);
  const currentSet = new Set(current);
  const added = current.filter(id => !initialSet.has(id));
  const removed = initial.filter(id => !currentSet.has(id));
  return { added, removed };
}

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = params.roleId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Catalogue des permissions (id -> {code, name}) pour étiqueter le diff
  // affiché dans la modale de confirmation.
  const [permCatalog, setPermCatalog] = useState<Record<string, { code: string; name: string }>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    selectedPermissionIds: [] as string[],
    isActive: true,
  });

  // État initial chargé depuis la DB : référence pour détecter les modifs
  // non sauvegardées (dirty) et calculer le diff au moment de Save.
  const [initialFormData, setInitialFormData] = useState({
    name: '',
    description: '',
    selectedPermissionIds: [] as string[],
    isActive: true,
  });

  const [showConfirm, setShowConfirm] = useState(false);

  // Détecte la dirtyness en comparant le snapshot initial à l'état courant.
  const isDirty = useMemo(() => {
    if (loading) return false;
    if (formData.name !== initialFormData.name) return true;
    if (formData.description !== initialFormData.description) return true;
    if (formData.isActive !== initialFormData.isActive) return true;
    const a = [...formData.selectedPermissionIds].sort().join(',');
    const b = [...initialFormData.selectedPermissionIds].sort().join(',');
    return a !== b;
  }, [formData, initialFormData, loading]);

  const permDiff = useMemo(
    () => diffPermissionIds(initialFormData.selectedPermissionIds, formData.selectedPermissionIds),
    [initialFormData.selectedPermissionIds, formData.selectedPermissionIds]
  );

  // Garde contre la fermeture/rafraîchissement de la page : si dirty,
  // le navigateur affiche son propre prompt de confirmation. Empêche la
  // perte silencieuse signalée par l'utilisateur (cocher sans Enregistrer).
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    loadRole();
    loadPermCatalog();
  }, [roleId]);

  async function loadRole() {
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`);
      if (res.ok) {
        const data = await res.json();
        const role = data.data;

        // Charger les permissions depuis la table role_permissions
        const permissionIds = role.permissions?.map((p: any) => p.id) || [];

        const initial = {
          name: role.Name || '',
          description: role.Description || '',
          selectedPermissionIds: permissionIds,
          isActive: role.IsActive ?? true,
        };
        setFormData(initial);
        setInitialFormData(initial);
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

  async function loadPermCatalog() {
    try {
      const res = await fetch('/api/admin/permissions');
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, { code: string; name: string }> = {};
      for (const p of (data.data || []) as any[]) {
        map[p.id] = { code: p.Code, name: p.Name };
      }
      setPermCatalog(map);
    } catch (err) {
      console.error('Error loading perm catalog:', err);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Le nom du rôle est obligatoire');
      return;
    }
    if (formData.selectedPermissionIds.length === 0) {
      setError('Veuillez sélectionner au moins une permission');
      return;
    }

    // Si aucun changement, on évite le DELETE+INSERT inutile et on ferme.
    if (!isDirty) {
      router.push('/admin/roles');
      return;
    }

    // On affiche la modale de confirmation avec le diff exact avant d'envoyer.
    // Garde contre les modifications accidentelles (la cause possible du
    // décrochage de permission qu'on a investigué).
    setShowConfirm(true);
  }

  async function confirmSave() {
    setShowConfirm(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

      // Sync l'état initial pour ne plus être dirty (évite le beforeunload)
      setInitialFormData(formData);
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
          <Button
            variant="outline"
            onClick={() => {
              if (isDirty && !confirm('Modifications non enregistrées. Quitter quand même ?')) return;
              router.push('/admin/roles');
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {isDirty && (
          <div className="mb-4 p-3 rounded-lg border-2 border-amber-300 bg-amber-50 flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="flex-1 text-sm">
              <strong>Modifications non enregistrées.</strong>{' '}
              {permDiff.added.length + permDiff.removed.length > 0 && (
                <>
                  {permDiff.added.length} permission(s) ajoutée(s), {permDiff.removed.length} retirée(s).
                </>
              )}{' '}
              Clique « Enregistrer » en bas pour confirmer.
            </div>
          </div>
        )}

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
              className={`flex items-center gap-2 ${isDirty ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
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
              onClick={() => {
                if (isDirty && !confirm('Modifications non enregistrées. Annuler quand même ?')) return;
                router.push('/admin/roles');
              }}
              disabled={saving}
            >
              Annuler
            </Button>
          </div>
        </form>

        {showConfirm && (
          <ConfirmDiffModal
            diff={permDiff}
            catalog={permCatalog}
            nameChanged={initialFormData.name !== formData.name}
            activeChanged={initialFormData.isActive !== formData.isActive}
            isActiveNew={formData.isActive}
            onCancel={() => setShowConfirm(false)}
            onConfirm={confirmSave}
          />
        )}
      </div>
    </ProtectedPage>
  );
}

function ConfirmDiffModal({
  diff, catalog, nameChanged, activeChanged, isActiveNew, onCancel, onConfirm,
}: {
  diff: { added: string[]; removed: string[] };
  catalog: Record<string, { code: string; name: string }>;
  nameChanged: boolean;
  activeChanged: boolean;
  isActiveNew: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = (id: string) => {
    const c = catalog[id];
    if (!c) return <code className="font-mono text-xs">{id.slice(0, 8)}…</code>;
    return (
      <>
        <span className="font-medium">{c.name}</span>{' '}
        <code className="font-mono text-xs text-gray-500">({c.code})</code>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Confirmer les modifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {nameChanged && <p className="text-sm">• Nom du rôle modifié</p>}
          {activeChanged && (
            <p className="text-sm">
              • Statut du rôle : {isActiveNew ? <strong>activé</strong> : <strong className="text-red-700">désactivé</strong>}
            </p>
          )}

          {diff.removed.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="font-semibold text-red-800 mb-2">
                {diff.removed.length} permission(s) à RETIRER :
              </p>
              <ul className="space-y-1 text-sm text-red-900">
                {diff.removed.map(id => <li key={id}>− {label(id)}</li>)}
              </ul>
            </div>
          )}

          {diff.added.length > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
              <p className="font-semibold text-emerald-800 mb-2">
                {diff.added.length} permission(s) à AJOUTER :
              </p>
              <ul className="space-y-1 text-sm text-emerald-900">
                {diff.added.map(id => <li key={id}>+ {label(id)}</li>)}
              </ul>
            </div>
          )}

          {diff.added.length === 0 && diff.removed.length === 0 && !nameChanged && !activeChanged && (
            <p className="text-sm text-gray-600 italic">Aucun changement détecté.</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={onConfirm} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              Confirmer et enregistrer
            </Button>
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Annuler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
