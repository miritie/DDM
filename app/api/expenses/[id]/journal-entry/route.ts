/**
 * GET /api/expenses/[id]/journal-entry
 *
 * Retourne l'écriture comptable (entête + lignes) générée automatiquement
 * au moment du paiement de la dépense. Retourne null si pas d'écriture
 * (dépense non payée ou erreur lors de la génération).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { JournalGenerationService } from '@/lib/modules/accounting/journal-generation-service';

const journalGenerator = new JournalGenerationService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;
    const data = await journalGenerator.getByExpenseId(id);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
