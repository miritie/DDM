/**
 * Extension des types NextAuth pour inclure nos données custom
 */

import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      userId: string;
      workspaceId: string;
      roleId: string;
      email: string;
      name: string;
      image?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string;
    workspaceId?: string;
    roleId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    workspaceId: string;
    roleId: string;
  }
}
