/**
 * NextAuth Configuration Options
 * Support multi-providers: Credentials, Google OAuth
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { User } from '@/types/modules';
import bcrypt from 'bcryptjs';

// Fonction helper pour obtenir le client (lazy loading)
const getDbClient = () => getPostgresClient();

/**
 * Fonction de vérification des credentials
 */
async function verifyCredentials(email: string, password: string): Promise<any | null> {
  try {
    const dbClient = getDbClient();

    // Récupérer l'utilisateur par email depuis PostgreSQL
    const result = await dbClient.query(
      `SELECT * FROM users WHERE email = $1 AND is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log('User not found:', email);
      return null;
    }

    const user = result.rows[0];

    // Vérifier le mot de passe hashé avec bcrypt
    if (!user.password_hash) {
      console.log('No password hash for user:', email);
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log('Invalid password for user:', email);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
}

/**
 * Fonction pour récupérer ou créer un utilisateur OAuth
 */
async function getOrCreateOAuthUser(
  email: string,
  name: string,
  image?: string
): Promise<any | null> {
  try {
    const dbClient = getDbClient();

    // Chercher l'utilisateur existant
    const result = await dbClient.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Récupérer le premier rôle disponible
    const roleResult = await dbClient.query(
      `SELECT id FROM roles WHERE workspace_id = $1 LIMIT 1`,
      [process.env.DEFAULT_WORKSPACE_ID]
    );

    if (roleResult.rows.length === 0) {
      console.error('No roles found for workspace');
      return null;
    }

    // Créer un nouvel utilisateur
    const newUserResult = await dbClient.query(
      `INSERT INTO users (
        user_id, email, full_name, display_name, workspace_id, role_id, is_active, avatar_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        `USR-${Date.now()}`,
        email,
        name,
        name.split(' ')[0],
        process.env.DEFAULT_WORKSPACE_ID,
        roleResult.rows[0].id,
        true,
        image || null
      ]
    );

    return newUserResult.rows[0];
  } catch (error) {
    console.error('Error getting or creating OAuth user:', error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    // Provider avec identifiants (email/password)
    CredentialsProvider({
      id: 'credentials',
      name: 'Identifiants',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email et mot de passe requis');
        }

        const user = await verifyCredentials(credentials.email, credentials.password);

        if (!user) {
          throw new Error('Email ou mot de passe incorrect');
        }

        return {
          id: user.user_id,
          email: user.email,
          name: user.full_name,
          image: user.avatar_url,
          workspaceId: user.workspace_id,
          roleId: user.role_id,
        };
      },
    }),

    // Provider Google OAuth (optionnel)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],

  callbacks: {
    /**
     * Callback JWT - Enrichir le token avec les données utilisateur
     */
    async jwt({ token, user, account }) {
      // Lors de la première connexion
      if (user) {
        token.userId = user.id;
        token.workspaceId = (user as any).workspaceId;
        token.roleId = (user as any).roleId;
      }

      // Pour les connexions OAuth
      if (account?.provider === 'google' && user?.email && user?.name) {
        const dbUser = await getOrCreateOAuthUser(user.email, user.name, user.image || undefined);
        if (dbUser) {
          token.userId = dbUser.user_id;
          token.workspaceId = dbUser.workspace_id;
          token.roleId = dbUser.role_id;
        }
      }

      return token;
    },

    /**
     * Callback Session - Enrichir la session avec les données du token
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).userId = token.userId;
        (session.user as any).workspaceId = token.workspaceId;
        (session.user as any).roleId = token.roleId;
      }
      return session;
    },

    /**
     * Callback de redirection après connexion/déconnexion
     */
    async redirect({ url, baseUrl }) {
      // Rediriger vers le dashboard après connexion
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl + '/';
    },
  },

  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};
