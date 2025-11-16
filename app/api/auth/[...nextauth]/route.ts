/**
 * NextAuth API Route Handler
 * Gestion de l'authentification avec multiple providers
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
