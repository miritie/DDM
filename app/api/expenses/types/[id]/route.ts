/**
 * GET    /api/expenses/types/[id] — détail d'un type
 * PATCH  /api/expenses/types/[id] — modification
 * DELETE /api/expenses/types/[id] — suppression (hard delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseTypeService } from '@/lib/modules/expenses/expense-type-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseTypeService();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;
    const data = await service.getById(id);
    if (!data) return NextResponse.json({ error: 'Type introuvable' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { id } = await params;
    const body = await request.json();
    const data = await service.update(id, body);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { id } = await params;
    await service.delete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
