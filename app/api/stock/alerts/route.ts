/**
 * API Route - Alertes de Stock
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { StockService } from '@/lib/modules/stock/stock-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new StockService();

/**
 * GET /api/stock/alerts - Alertes actives
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('alertType')) {
      filters.alertType = searchParams.get('alertType');
    }
    if (searchParams.get('warehouseId')) {
      filters.warehouseId = searchParams.get('warehouseId');
    }

    const alerts = await service.getActiveAlerts(workspaceId, filters);

    return NextResponse.json({ data: alerts });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}
