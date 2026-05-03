/**
 * API - Liste des rôles de l'utilisateur courant (avec nom et description).
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const roleIds: string[] = (user as any).roleIds || [];
    const activeRoleId: string = (user as any).activeRoleId || user.roleId;

    if (roleIds.length === 0) {
      return NextResponse.json({ roles: [], activeRoleId });
    }

    const db = getPostgresClient();
    const result = await db.query(
      `SELECT id, role_id as "roleId", name, description
       FROM roles
       WHERE id = ANY($1::uuid[])
       ORDER BY name ASC`,
      [roleIds]
    );

    return NextResponse.json({ roles: result.rows, activeRoleId });
  } catch (error: any) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}
