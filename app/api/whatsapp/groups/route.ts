/**
 * API Route - Groupes WhatsApp
 * GET /api/whatsapp/groups - Liste les groupes
 * POST /api/whatsapp/groups - Sauvegarde les groupes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const postgresClient = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATION_SEND);
    const workspaceId = 'default'; // TODO: Recuperer depuis session

    // Recuperer les groupes depuis PostgreSQL
    const groups = await postgresClient.query(
      `SELECT * FROM whatsapp_groups WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    );

    const formattedGroups = (groups.rows || []).map((group: any) => ({
      GroupId: group.id,
      Name: group.name,
      Description: group.description,
      WorkspaceId: group.workspace_id,
      CreatedAt: group.created_at,
    }));

    return NextResponse.json(
      {
        success: true,
        data: formattedGroups,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur recuperation groupes:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATION_SEND);
    const workspaceId = 'default'; // TODO: Recuperer depuis session
    const { groups } = await request.json();

    if (!Array.isArray(groups)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format invalide',
        },
        { status: 400 }
      );
    }

    // Sauvegarder dans PostgreSQL
    for (const group of groups) {
      await postgresClient.query(
        `INSERT INTO whatsapp_groups (name, description, workspace_id, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name, workspace_id) DO UPDATE SET description = $2`,
        [group.name, group.description, workspaceId, new Date().toISOString()]
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Groupes sauvegardes avec succes',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur sauvegarde groupes:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
