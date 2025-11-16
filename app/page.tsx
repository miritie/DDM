/**
 * Home Page - Redirige vers dashboard ou login selon l'état d'authentification
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';

export default async function HomePage() {
  const session = await getSession();

  if (session && session.user) {
    redirect('/dashboard');
  } else {
    redirect('/auth/login');
  }
}
