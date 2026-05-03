/**
 * POST /api/clients/quick — création rapide d'un client par nom et/ou téléphone.
 * Si le téléphone existe déjà, retourne le client existant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ClientService } from '@/lib/modules/sales/client-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ClientService();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const data = await service.quickCreate({
      name: body.name,
      phone: body.phone,
      workspaceId,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
