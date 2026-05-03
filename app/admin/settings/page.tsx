'use client';

/**
 * Page - Paramètres Système
 * Module Administration & Settings
 *
 * Centralise les liens vers les espaces de paramétrage opérationnels :
 * catalogue produits, utilisateurs, rôles, workspaces, etc.
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
  Package,
  Tag,
  Users as UsersIcon,
  Shield,
  ShoppingCart,
  Award,
  ChevronRight,
} from 'lucide-react';

interface SettingsLink {
  title: string;
  description: string;
  href: string;
  icon: any;
  color: string;
  available: boolean;
  badge?: string;
}

const SETTINGS_GROUPS: Array<{ title: string; items: SettingsLink[] }> = [
  {
    title: 'Données métier',
    items: [
      {
        title: 'Vente rapide (POS)',
        description: 'Caisse — grille produits, panier, encaissement',
        href: '/sales/quick',
        icon: ShoppingCart,
        color: 'text-emerald-600',
        available: true,
      },
      {
        title: 'Catalogue produits',
        description: 'Définir, modifier et activer/désactiver les produits du workspace',
        href: '/products',
        icon: Package,
        color: 'text-blue-600',
        available: true,
      },
      {
        title: 'Catégories de produits',
        description: 'Liste configurable utilisée dans les formulaires produits',
        href: '/admin/product-categories',
        icon: Tag,
        color: 'text-amber-600',
        available: true,
      },
      {
        title: 'Programme de fidélisation',
        description: 'Règles paramétriques de remise (Nième achat, seuils, fenêtres)',
        href: '/admin/loyalty-rules',
        icon: Award,
        color: 'text-amber-600',
        available: true,
      },
      {
        title: 'Clients',
        description: 'Gérer le carnet clients (B2B et particuliers)',
        href: '/customers',
        icon: UsersIcon,
        color: 'text-green-600',
        available: true,
      },
    ],
  },
  {
    title: 'Sécurité & accès',
    items: [
      {
        title: 'Utilisateurs',
        description: 'Comptes utilisateurs, rôles, mots de passe',
        href: '/admin/users',
        icon: UsersIcon,
        color: 'text-purple-600',
        available: true,
      },
      {
        title: 'Rôles & permissions',
        description: 'Définition des rôles et leurs permissions associées',
        href: '/admin/roles',
        icon: Shield,
        color: 'text-red-600',
        available: true,
      },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadWorkspaces();
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

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8 text-purple-600" />
              Paramètres système
            </h1>
            <p className="text-gray-600">Configuration et paramétrage de l'application</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title} className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={() => item.available && router.push(item.href)}
                    disabled={!item.available}
                    className="text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all flex items-center justify-between gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex-shrink-0 p-2 rounded-lg bg-gray-50`}>
                        <Icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 flex items-center gap-2">
                          {item.title}
                          {item.badge && (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                              {item.badge}
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600 truncate">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-600" />
                Base de données
              </CardTitle>
              <CardDescription>Connexion en cours d'utilisation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Provider</span>
                  <span className="font-medium">PostgreSQL (Neon)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Statut</span>
                  <span className="text-green-600 font-medium">Connecté</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-600" />
                Notifications
              </CardTitle>
              <CardDescription>Préférences (lecture seule)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>📧 Notifications email — actif</p>
                <p>📦 Alertes stock faible — actif</p>
                <p>💰 Alertes dettes en retard — actif</p>
                <p className="text-xs text-gray-500 pt-2 border-t">
                  La gestion fine des notifications sera disponible prochainement.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-600" />
                Sécurité
              </CardTitle>
              <CardDescription>Politique d'authentification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>🔐 Hash mot de passe : bcrypt (10 rounds)</p>
                <p>⏱️ Durée session : 30 jours (JWT)</p>
                <p>🛡️ RBAC : permissions par rôle</p>
                <p>👥 Multi-rôles : actif</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Workspaces configurés
            </CardTitle>
            <CardDescription>{workspaces.length} workspace(s) actif(s)</CardDescription>
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
                  <div
                    key={workspace.WorkspaceId}
                    className="border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Building2 className="h-5 w-5 text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{workspace.Name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          Slug : {workspace.Slug} · Créé le {formatDate(workspace.CreatedAt)}
                        </p>
                        {workspace.Description && (
                          <p className="text-sm text-gray-600 mt-1">{workspace.Description}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        workspace.IsActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {workspace.IsActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations système</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Version</p>
                <p className="font-medium">1.0.0</p>
              </div>
              <div>
                <p className="text-gray-600">Environnement</p>
                <p className="font-medium capitalize">{process.env.NODE_ENV || 'development'}</p>
              </div>
              <div>
                <p className="text-gray-600">Framework</p>
                <p className="font-medium">Next.js 16</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
