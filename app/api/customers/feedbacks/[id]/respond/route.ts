/**
 * API Routes - Réponse aux Feedbacks
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeedbackService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new FeedbackService();

/**
 * POST /api/customers/feedbacks/[id]/respond
 * Répond à un feedback
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const body = await request.json();
    const { response, respondedById, respondedByName } = body;

    if (!response || !respondedById || !respondedByName) {
      return NextResponse.json(
        { error: 'response, respondedById et respondedByName sont requis' },
        { status: 400 }
      );
    }

    const feedback = await service.respond(
      params.id,
      response,
      respondedById,
      respondedByName
    );

    return NextResponse.json({ data: feedback });
  } catch (error: any) {
    console.error('Error responding to feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la réponse' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
