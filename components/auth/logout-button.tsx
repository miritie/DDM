/**
 * Bouton de Déconnexion
 * Composant réutilisable pour se déconnecter
 */

'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogoutButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
  className?: string;
}

export function LogoutButton({
  variant = 'ghost',
  size = 'default',
  showText = true,
  className = '',
}: LogoutButtonProps) {
  const handleLogout = async () => {
    await signOut({
      callbackUrl: '/auth/signin',
      redirect: true,
    });
  };

  return (
    <Button
      onClick={handleLogout}
      variant={variant}
      size={size}
      className={className}
    >
      <LogOut className={showText ? 'w-4 h-4 mr-2' : 'w-5 h-5'} />
      {showText && 'Déconnexion'}
    </Button>
  );
}
