/**
 * NextAuth Configuration Options
 * Support multi-providers: Credentials, Google OAuth
 * Support multi-rôles : un utilisateur peut avoir plusieurs rôles, un seul actif à la fois.
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { getPostgresClient } from '@/lib/database/postgres-client';
import bcrypt from 'bcryptjs';

const getDbClient = () => getPostgresClient();

/**
 * Récupère les UUIDs des rôles d'un utilisateur (par users.id UUID).
 * Le rôle primaire est en première position.
 */
async function fetchUserRoleIds(userUuid: string): Promise<{ roleIds: string[]; primaryRoleId: string | null }> {
  const db = getDbClient();
  const result = await db.query(
    `SELECT role_id, is_primary
     FROM user_roles
     WHERE user_id = $1
     ORDER BY is_primary DESC, role_id ASC`,
    [userUuid]
  );

  const roleIds = result.rows.map((r: any) => r.role_id as string);
  const primary = result.rows.find((r: any) => r.is_primary)?.role_id ?? roleIds[0] ?? null;
  return { roleIds, primaryRoleId: primary };
}

/**
 * Vérifie les credentials et retourne l'utilisateur enrichi de ses rôles.
 * Accepte un identifiant qui peut être soit l'email, soit le username (prénom).
 */
async function verifyCredentials(identifier: string, password: string): Promise<any | null> {
  try {
    const dbClient = getDbClient();
    const id = identifier.trim().toLowerCase();

    // Lookup par email OU username (case-insensitive)
    const result = await dbClient.query(
      `SELECT * FROM users
       WHERE (LOWER(email) = $1 OR LOWER(username) = $1)
         AND is_active = true
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      console.log('User not found:', identifier);
      return null;
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      console.log('No password hash for user:', identifier);
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      console.log('Invalid password for user:', identifier);
      return null;
    }

    const { roleIds, primaryRoleId } = await fetchUserRoleIds(user.id);

    // Fallback : si aucun user_roles (ne devrait pas arriver après migration), utilise users.role_id
    const finalRoleIds = roleIds.length > 0 ? roleIds : (user.role_id ? [user.role_id] : []);
    const finalPrimary = primaryRoleId ?? user.role_id ?? null;

    return {
      ...user,
      roleIds: finalRoleIds,
      primaryRoleId: finalPrimary,
    };
  } catch (error) {
    console.error('Error verifying credentials:', error);
    return null;
  }
}

/**
 * Récupère ou crée un utilisateur OAuth.
 */
async function getOrCreateOAuthUser(
  email: string,
  name: string,
  image?: string
): Promise<any | null> {
  try {
    const dbClient = getDbClient();

    const result = await dbClient.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length > 0) {
      const u = result.rows[0];
      const { roleIds, primaryRoleId } = await fetchUserRoleIds(u.id);
      return {
        ...u,
        roleIds: roleIds.length > 0 ? roleIds : (u.role_id ? [u.role_id] : []),
        primaryRoleId: primaryRoleId ?? u.role_id,
      };
    }

    const roleResult = await dbClient.query(
      `SELECT id FROM roles WHERE workspace_id = $1 LIMIT 1`,
      [process.env.DEFAULT_WORKSPACE_ID]
    );

    if (roleResult.rows.length === 0) {
      console.error('No roles found for workspace');
      return null;
    }

    const defaultRoleId = roleResult.rows[0].id;

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
        defaultRoleId,
        true,
        image || null,
      ]
    );

    const newUser = newUserResult.rows[0];

    await dbClient.query(
      `INSERT INTO user_roles (user_id, role_id, is_primary)
       VALUES ($1, $2, true)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [newUser.id, defaultRoleId]
    );

    return {
      ...newUser,
      roleIds: [defaultRoleId],
      primaryRoleId: defaultRoleId,
    };
  } catch (error) {
    console.error('Error getting or creating OAuth user:', error);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Identifiants',
      credentials: {
        email: { label: 'Identifiant', type: 'text' }, // accepte username OU email
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Identifiant et mot de passe requis');
        }

        const user = await verifyCredentials(credentials.email, credentials.password);

        if (!user) {
          throw new Error('Identifiant ou mot de passe incorrect');
        }

        return {
          id: user.user_id,
          email: user.email,
          name: user.full_name,
          image: user.avatar_url,
          workspaceId: user.workspace_id,
          roleId: user.primaryRoleId,
          activeRoleId: user.primaryRoleId,
          roleIds: user.roleIds,
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],

  callbacks: {
    /**
     * JWT - première connexion : peuple roleIds + activeRoleId.
     * Sur trigger:'update' avec session.activeRoleId : change le rôle actif si autorisé.
     */
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.userId = (user as any).id;
        token.workspaceId = (user as any).workspaceId;
        token.roleIds = (user as any).roleIds || [];
        token.activeRoleId = (user as any).activeRoleId || (user as any).roleId;
        token.roleId = token.activeRoleId;
      }

      if (account?.provider === 'google' && user?.email && user?.name) {
        const dbUser = await getOrCreateOAuthUser(user.email, user.name, user.image || undefined);
        if (dbUser) {
          token.userId = dbUser.user_id;
          token.workspaceId = dbUser.workspace_id;
          token.roleIds = dbUser.roleIds;
          token.activeRoleId = dbUser.primaryRoleId;
          token.roleId = token.activeRoleId;
        }
      }

      // Switch de rôle pendant la session : useSession().update({ activeRoleId })
      if (trigger === 'update' && session?.activeRoleId) {
        const requested = session.activeRoleId as string;
        if (Array.isArray(token.roleIds) && token.roleIds.includes(requested)) {
          token.activeRoleId = requested;
          token.roleId = requested;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).userId = token.userId;
        (session.user as any).workspaceId = token.workspaceId;
        (session.user as any).roleId = token.activeRoleId || token.roleId;
        (session.user as any).activeRoleId = token.activeRoleId || token.roleId;
        (session.user as any).roleIds = token.roleIds || [];
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
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
    maxAge: 30 * 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};
