/**
 * API Route - Mouvements d'une avance/dette
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AdvanceDebtService();

/**
 * GET /api/advances-debts/[id]/movements
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_VIEW);
    const { id } = await params;

    const movements = await service.getMovements(id);

    return NextResponse.json({ data: movements });
  } catch (error: any) {
    console.error('Error fetching movements:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des mouvements' },
      { status: 500 }
    );
  }
}
