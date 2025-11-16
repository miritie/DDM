/**
 * API Routes - Interactions Clients
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { InteractionService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new InteractionService();

/**
 * GET /api/customers/interactions
 * Liste les interactions avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const customerId = searchParams.get('customerId');

    if (customerId) {
      const interactions = await service.listByCustomer(customerId);
      return NextResponse.json({ data: interactions });
    }

    const filters: any = {};

    if (searchParams.get('type')) filters.type = searchParams.get('type') as any;
    if (searchParams.get('sentiment')) filters.sentiment = searchParams.get('sentiment') as any;
    if (searchParams.get('followUpRequired')) filters.followUpRequired = searchParams.get('followUpRequired') === 'true';
    if (searchParams.get('followUpDone')) filters.followUpDone = searchParams.get('followUpDone') === 'true';
    if (searchParams.get('employeeId')) filters.employeeId = searchParams.get('employeeId');

    const interactions = await service.list(workspaceId, filters);

    return NextResponse.json({ data: interactions });
  } catch (error: any) {
    console.error('Error fetching interactions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/customers/interactions
 * Crée une interaction client
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const interaction = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: interaction }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating interaction:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
