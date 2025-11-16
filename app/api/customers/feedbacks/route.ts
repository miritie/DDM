/**
 * API Routes - Feedbacks Clients
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { FeedbackService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new FeedbackService();

/**
 * GET /api/customers/feedbacks
 * Liste les feedbacks avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get('customerId');

    if (customerId) {
      const feedbacks = await service.listByCustomer(customerId);
      return NextResponse.json({ data: feedbacks });
    }

    const filters: any = {};

    if (searchParams.get('sentiment')) filters.sentiment = searchParams.get('sentiment') as any;
    if (searchParams.get('isPublic')) filters.isPublic = searchParams.get('isPublic') === 'true';
    if (searchParams.get('isVerified')) filters.isVerified = searchParams.get('isVerified') === 'true';
    if (searchParams.get('minRating')) filters.minRating = parseInt(searchParams.get('minRating')!);
    if (searchParams.get('maxRating')) filters.maxRating = parseInt(searchParams.get('maxRating')!);
    if (searchParams.get('productId')) filters.productId = searchParams.get('productId');
    if (searchParams.get('saleId')) filters.saleId = searchParams.get('saleId');

    const feedbacks = await service.list(workspaceId, filters);

    return NextResponse.json({ data: feedbacks });
  } catch (error: any) {
    console.error('Error fetching feedbacks:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/customers/feedbacks
 * Crée un feedback client
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const feedback = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: feedback }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
