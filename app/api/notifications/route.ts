/**
 * API Route - Liste des Notifications
 * Module Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const postgresClient = getPostgresClient();

/**
 * GET /api/notifications - Liste des notifications
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATION_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    // Build filters
    const filters: string[] = [`workspace_id = $1`];
    const values: any[] = [workspaceId];
    let paramIndex = 2;

    if (searchParams.get('recipientId')) {
      filters.push(`recipient_id = $${paramIndex++}`);
      values.push(searchParams.get('recipientId'));
    }

    if (searchParams.get('channel')) {
      filters.push(`channel = $${paramIndex++}`);
      values.push(searchParams.get('channel'));
    }

    if (searchParams.get('status')) {
      filters.push(`status = $${paramIndex++}`);
      values.push(searchParams.get('status'));
    }

    const whereClause = filters.join(' AND ');

    const notifications = await postgresClient.query(
      `SELECT * FROM notifications WHERE ${whereClause} ORDER BY created_at DESC`,
      values
    );

    const formattedNotifications = notifications.rows.map((n: any) => ({
      NotificationId: n.notification_id,
      RecipientId: n.recipient_id,
      Channel: n.channel,
      Subject: n.subject,
      Message: n.message,
      Status: n.status,
      SentAt: n.sent_at,
      ErrorMessage: n.error_message,
      WorkspaceId: n.workspace_id,
      CreatedAt: n.created_at,
      UpdatedAt: n.updated_at,
    }));

    return NextResponse.json({ data: formattedNotifications });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la recuperation' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
