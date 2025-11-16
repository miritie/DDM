/**
 * API Route - Liste et création des partenaires
 * GET /api/consignation/partners - Liste des partenaires
 * POST /api/consignation/partners - Créer un partenaire
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PartnerService } from '@/lib/modules/consignation/partner-service';
import { getWorkspaceId } from '@/lib/auth/workspace';

const partnerService = new PartnerService();

// Schéma de validation pour la création
const createPartnerSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  type: z.enum(['pharmacy', 'relay_point', 'wholesaler', 'retailer', 'other']),
  contactPerson: z.string().min(2, 'Le nom du contact est requis'),
  phone: z.string().min(8, 'Le téléphone doit contenir au moins 8 chiffres'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  contractStartDate: z.string(),
  contractEndDate: z.string().optional(),
  commissionRate: z.number().min(0).max(100, 'La commission doit être entre 0 et 100%'),
  paymentTerms: z.number().min(0, 'Les termes de paiement doivent être positifs'),
  currency: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * GET - Liste des partenaires avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const city = searchParams.get('city');
    const region = searchParams.get('region');

    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (city) filters.city = city;
    if (region) filters.region = region;

    const partners = await partnerService.list(workspaceId, filters);

    return NextResponse.json({
      success: true,
      data: partners,
      count: partners.length,
    });
  } catch (error: any) {
    console.error('Erreur récupération partenaires:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST - Créer un nouveau partenaire
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();

    // Validation
    const validatedData = createPartnerSchema.parse(body);

    // Créer le partenaire
    const partner = await partnerService.create({
      ...validatedData,
      workspaceId,
    });

    return NextResponse.json(
      {
        success: true,
        data: partner,
        message: 'Partenaire créé avec succès',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erreur création partenaire:', error);

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
