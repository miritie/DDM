/**
 * POST /api/notifications/inbox/[id]/read
 *   Marque une notif (slug ou UUID) comme lue. Vérifie que la notif
 *   appartient bien à l'utilisateur courant (sinon 403).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { getNotificationService } from '@/lib/modules/notifications/notification-service';

const service = getNotificationService();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;
    const ok = await service.markAsRead(id, userId);
    if (!ok) {
      return NextResponse.json({ error: 'Notification introuvable ou déjà lue' }, { status: 404 });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
