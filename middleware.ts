/**
 * Next.js Middleware - Protection des routes
 * Redirige vers /auth/login si l'utilisateur n'est pas authentifié
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Le middleware est exécuté uniquement pour les routes protégées
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // L'utilisateur est autorisé s'il a un token
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/login',
    },
  }
);

/**
 * Configuration des routes à protéger
 * Toutes les routes sauf /auth/* et les assets publics
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /auth/* (pages d'authentification)
     * - /api/auth/* (NextAuth API routes)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt, etc. (static files)
     */
    '/((?!auth|api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
