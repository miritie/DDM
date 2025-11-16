'use client';

/**
 * Page - Édition d'Utilisateur
 * TODO: À implémenter
 */

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { User } from '@/types/modules';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const data = await res.json();
          const foundUser = data.data?.find((u: User) => u.UserId === userId);
          setUser(foundUser || null);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [userId]);

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.ADMIN_USERS_EDIT}>
        <div className="p-8 max-w-4xl mx-auto">
          <p>Chargement...</p>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_USERS_EDIT}>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">
            {user ? `Éditer: ${user.FullName}` : 'Éditer l\'Utilisateur'}
          </h1>
          <Button variant="outline" onClick={() => router.push('/admin/users')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {user ? (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Informations de l'utilisateur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">ID utilisateur</label>
                  <p className="text-gray-900">{user.UserId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{user.Email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom complet</label>
                  <p className="text-gray-900">{user.FullName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom d'affichage</label>
                  <p className="text-gray-900">{user.DisplayName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Téléphone</label>
                  <p className="text-gray-900">{user.Phone || 'Non renseigné'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Rôle</label>
                  <p className="text-gray-900">{(user as any).RoleName || user.RoleId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Statut</label>
                  <p className="text-gray-900">{user.IsActive ? 'Actif' : 'Inactif'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  Formulaire d'édition en développement
                </CardTitle>
              </CardHeader>
              <CardContent className="text-yellow-700">
                <p className="mb-4">
                  Le formulaire d'édition d'utilisateurs est en cours d'implémentation.
                </p>
                <p>
                  Pour le moment, les modifications sont effectuées directement en base de données.
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
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
        )}
      </div>
    </ProtectedPage>
  );
}
