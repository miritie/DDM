/**
 * API Route - Liste des Notifications
 * Module Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AirtableClient } from '@/lib/airtable/client';
import { Notification } from '@/types/modules';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const airtableClient = new AirtableClient();

/**
 * GET /api/notifications - Liste des notifications
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATION_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    // Build filters
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (searchParams.get('recipientId')) {
      filterFormulas.push(`{RecipientId} = '${searchParams.get('recipientId')}'`);
    }

    if (searchParams.get('channel')) {
      filterFormulas.push(`{Channel} = '${searchParams.get('channel')}'`);
    }

    if (searchParams.get('status')) {
      filterFormulas.push(`{Status} = '${searchParams.get('status')}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    const notifications = await airtableClient.list<Notification>('Notification', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });

    return NextResponse.json({ data: notifications });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
