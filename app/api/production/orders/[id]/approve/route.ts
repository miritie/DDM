/**
 * POST /api/production/orders/[id]/approve
 *   Admin valide un OP soumis : submitted → planned.
 *   Permission : production:approve OU rôle manager_production/admin/pca.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PERMISSIONS } from '@/lib/rbac/server';
import { requirePermissionOrRole } from '@/lib/rbac/role-guard';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';

const service = new ProductionOrderService();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Le manager production valide les OP même si la permission manque
    // en base (rôle = organigramme, cf. lib/rbac/role-guard)
    await requirePermissionOrRole(PERMISSIONS.PRODUCTION_APPROVE,
      ['manager_production', 'admin', 'pca', 'role_admin']);
    const { id } = await params;
    const userId = await getCurrentUserId();
    const data = await service.approve(id, userId);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
