/**
 * API Routes - Activation d'un Client
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CustomerService();

/**
 * POST /api/customers/[id]/activate
 * Active un client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const customer = await service.activate(id);

    return NextResponse.json({
      data: customer,
      message: 'Client activé avec succès',
    });
  } catch (error: any) {
    console.error('Error activating customer:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'activation' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
