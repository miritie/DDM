/**
 * API Routes - Initialisation des Tiers par Défaut
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { TierService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new TierService();

/**
 * POST /api/customers/tiers/initialize
 * Initialise les tiers par défaut
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const tiers = await service.initializeDefaultTiers(workspaceId);

    return NextResponse.json({
      data: tiers,
      message: `${tiers.length} tiers initialisés avec succès`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error initializing tiers:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'initialisation' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
