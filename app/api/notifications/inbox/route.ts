/**
 * GET /api/notifications/inbox
 *
 * Centre de notifications in-app de l'utilisateur courant.
 *   ?onlyUnread=true             ne retourne que les non lues
 *   ?limit=50&offset=0
 *
 * Pas de permission spécifique requise — chaque user accède forcément
 * à sa propre boîte (filtrée par session).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { getNotificationService } from '@/lib/modules/notifications/notification-service';

const service = getNotificationService();

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const data = await service.listForUser(userId, {
      onlyUnread: searchParams.get('onlyUnread') === 'true',
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
