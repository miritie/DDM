/**
 * API Route - Traitement Paie
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayrollService } from '@/lib/modules/hr/payroll-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserUuid } from '@/lib/auth/get-session';

const service = new PayrollService();

/**
 * POST /api/hr/payroll/[id]/process - Payer une paie
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_APPROVE);
    const { id } = await params;
    const body = await request.json();

    // Le payeur est l'utilisateur connecté (le body peut le préciser,
    // mais on ne fait pas confiance au client par défaut)
    const processedById = await getCurrentUserUuid();
    const payroll = await service.process({
      payrollId: id,
      paymentDate: body.paymentDate || new Date().toISOString().slice(0, 10),
      paymentMethod: body.paymentMethod || 'bank_transfer',
      processedById: processedById ?? body.processedById,
    });

    return NextResponse.json({ data: payroll });
  } catch (error: any) {
    console.error('Error processing payroll:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du traitement' },
      { status: 500 }
    );
  }
}
