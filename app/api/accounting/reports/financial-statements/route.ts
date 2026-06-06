/**
 * GET /api/accounting/reports/financial-statements?fiscalYear=YYYY
 *
 * Dossier des états financiers annuels SYSCOHADA (Système Normal) :
 * identité entreprise, balance, bilan, compte de résultat, TFT simplifié,
 * livre-journal et grand livre synthétique. Consommé par la page de
 * préparation et le générateur du PDF à remettre à l'expert-comptable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { FinancialStatementsService } from '@/lib/modules/accounting/financial-statements-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError } from '@/lib/http/api-error';

const service = new FinancialStatementsService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || String(new Date().getFullYear()), 10);

    const data = await service.build(workspaceId, fiscalYear);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la construction des états financiers');
  }
}
