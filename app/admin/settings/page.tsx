'use client';

/**
 * Page - Paramètres Système
 * Module Administration & Settings
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Workspace } from '@/types/modules';
import {
  Settings,
  ArrowLeft,
  Building2,
  Globe,
  Database,
  Bell,
  Lock,
  Palette,
  Plus,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.data || []);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(dateString));
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

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8 text-purple-600" />
              Paramètres Système
            </h1>
            <p className="text-gray-600">Configuration et paramètres généraux de l'application</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {/* Settings Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Workspaces */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                Workspaces
              </CardTitle>
              <CardDescription>Gérer les espaces de travail</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => alert('Fonctionnalité à venir')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Gérer les workspaces
              </Button>
            </CardContent>
          </Card>

          {/* Localisation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Localisation
              </CardTitle>
              <CardDescription>Langue et paramètres régionaux</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Langue</span>
                  <span className="font-medium">Français</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fuseau horaire</span>
                  <span className="font-medium">GMT+0 (Abidjan)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Devise</span>
                  <span className="font-medium">XOF</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-600" />
                Base de Données
              </CardTitle>
              <CardDescription>Informations de connexion</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Provider</span>
                  <span className="font-medium">Airtable</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="text-green-600 font-medium">Connecté</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-600" />
                Notifications
              </CardTitle>
              <CardDescription>Paramètres de notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Notifications email</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Alertes stocks faibles</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Alertes dettes en retard</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-600" />
                Sécurité
              </CardTitle>
              <CardDescription>Paramètres de sécurité</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Authentification à deux facteurs</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-sm">Expiration de session (30 min)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">Logs d'audit détaillés</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-pink-600" />
                Apparence
              </CardTitle>
              <CardDescription>Thème et interface</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="theme" className="rounded-full" defaultChecked />
                  <span className="text-sm">Thème clair</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="theme" className="rounded-full" />
                  <span className="text-sm">Thème sombre</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="theme" className="rounded-full" />
                  <span className="text-sm">Automatique</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workspaces List */}
        <Card>
          <CardHeader>
            <CardTitle>Workspaces Configurés</CardTitle>
            <CardDescription>{workspaces.length} workspace(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : workspaces.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucun workspace configuré</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workspaces.map((workspace) => (
                  <Card key={workspace.WorkspaceId} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-purple-600" />
                          <div>
                            <p className="font-semibold">{workspace.Name}</p>
                            <p className="text-xs text-gray-500">
                              Slug: {workspace.Slug} • Créé le {formatDate(workspace.CreatedAt)}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(workspace.IsActive)}
                      </div>
                      {workspace.Description && (
                        <p className="text-sm text-gray-600 mt-2 ml-8">{workspace.Description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Informations Système</CardTitle>
            <CardDescription>Détails de l'application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Version</p>
                <p className="font-medium">1.0.0</p>
              </div>
              <div>
                <p className="text-gray-600">Environnement</p>
                <p className="font-medium">Production</p>
              </div>
              <div>
                <p className="text-gray-600">Framework</p>
                <p className="font-medium">Next.js 16.0.2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
