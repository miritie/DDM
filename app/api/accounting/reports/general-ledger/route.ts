/**
 * GET /api/accounting/reports/general-ledger?fiscalYear=YYYY[&account=411000]
 *
 * Grand livre :
 *   - sans `account` : synthèse par compte (débit, crédit, solde, nb lignes)
 *   - avec `account` : mouvements détaillés du compte (drill-down)
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
    const account = searchParams.get('account');

    if (account) {
      const lines = await service.accountLedger(workspaceId, fiscalYear, account);
      return NextResponse.json({ data: { account, fiscalYear, lines } });
    }

    const statements = await service.build(workspaceId, fiscalYear);
    return NextResponse.json({ data: { fiscalYear, accounts: statements.ledger } });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement du grand livre');
  }
}
