/**
 * API Routes - Configuration des Tiers de Fidélité
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { TierService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new TierService();

/**
 * GET /api/customers/tiers
 * Liste les configurations de tiers
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const tiers = await service.list(workspaceId);

    return NextResponse.json({ data: tiers });
  } catch (error: any) {
    console.error('Error fetching tiers:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/customers/tiers
 * Crée une configuration de tier
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const tier = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: tier }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating tier:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
