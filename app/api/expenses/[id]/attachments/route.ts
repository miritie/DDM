/**
 * API Route - Pièces Jointes Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseService();

/**
 * GET /api/expenses/[id]/attachments - Liste des pièces jointes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;

    const attachments = await service.getAttachments(id);

    return NextResponse.json({ data: attachments });
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/expenses/[id]/attachments - Ajouter une pièce jointe
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_EDIT);
    const { id } = await params;
    const body = await request.json();

    const attachment = await service.addAttachment({
      expenseId: id,
      ...body,
    });

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding attachment:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'ajout' },
      { status: 500 }
    );
  }
}
