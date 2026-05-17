/**
 * POST /api/notifications/inbox/mark-all-read
 *   Marque toutes les notifs in-app non lues de l'utilisateur comme lues.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { getNotificationService } from '@/lib/modules/notifications/notification-service';

const service = getNotificationService();

export async function POST(_req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const n = await service.markAllAsRead(userId);
    return NextResponse.json({ data: { marked: n } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
