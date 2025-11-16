/**
 * API Route - Détail et modification d'un partenaire
 * GET /api/consignation/partners/[id] - Détails du partenaire
 * PATCH /api/consignation/partners/[id] - Modifier le partenaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PartnerService } from '@/lib/modules/consignation/partner-service';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';

const partnerService = new PartnerService();

// Schéma de validation pour la modification
const updatePartnerSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['pharmacy', 'relay_point', 'wholesaler', 'retailer', 'other']).optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional(),
  contactPerson: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  paymentTerms: z.number().min(0).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * GET - Détails d'un partenaire
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const partner = await partnerService.getById(id);

    if (!partner) {
      return NextResponse.json(
        { error: 'Partenaire non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier que le partenaire appartient au workspace
    if (partner.WorkspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: partner,
    });
  } catch (error: any) {
    console.error('Erreur récupération partenaire:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Modifier un partenaire
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que le partenaire existe et appartient au workspace
    const existing = await partnerService.getById(id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Partenaire non trouvé' },
        { status: 404 }
      );
    }

    if (existing.WorkspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();

    // Validation
    const validatedData = updatePartnerSchema.parse(body);

    // Mettre à jour
    const updated = await partnerService.update(id, validatedData);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Partenaire mis à jour avec succès',
    });
  } catch (error: any) {
    console.error('Erreur mise à jour partenaire:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
