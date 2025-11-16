/**
 * Page de déconnexion
 */

'use client';

import * as React from 'react';
import { signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LogoutPage() {
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleLogout() {
    setIsLoading(true);
    await signOut({ callbackUrl: '/auth/login' });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Déconnexion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            Êtes-vous sûr de vouloir vous déconnecter ?
          </p>
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.history.back()}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={handleLogout}
              disabled={isLoading}
            >
              {isLoading ? 'Déconnexion...' : 'Se déconnecter'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
