/**
 * GET /api/notifications/inbox/unread-count
 *   Compte les notifications in-app non lues de l'utilisateur courant.
 *   Léger : utilisé par le badge bell qui poll toutes les 60s.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { getNotificationService } from '@/lib/modules/notifications/notification-service';

const service = getNotificationService();

export async function GET(_req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const count = await service.unreadCount(userId);
    return NextResponse.json({ data: { count } });
  } catch {
    // En cas d'erreur (pas connecté etc.), on retourne 0 pour ne pas casser l'UI
    return NextResponse.json({ data: { count: 0 } });
  }
}
