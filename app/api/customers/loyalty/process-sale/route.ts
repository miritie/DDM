/**
 * API Route - Traitement Fidélité sur Vente
 * POST /api/customers/loyalty/process-sale
 *
 * Webhook appelé automatiquement lors de la confirmation d'une vente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { LoyaltyIntegrationService } from '@/lib/modules/customers/loyalty-integration';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LoyaltyIntegrationService();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.LOYALTY_MANAGE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const { saleId, saleNumber, customerId, totalAmount, saleDate, action } = body;

    // Validation
    if (!saleId || !customerId || !totalAmount) {
      return NextResponse.json(
        { error: 'Données manquantes : saleId, customerId et totalAmount requis' },
        { status: 400 }
      );
    }

    // Traiter selon l'action
    if (action === 'cancel') {
      // Annulation de vente - retirer les points
      await service.processSaleCancelled({
        saleId,
        saleNumber,
        customerId,
        totalAmount,
        saleDate: saleDate || new Date().toISOString(),
        workspaceId,
      });

      return NextResponse.json({
        success: true,
        message: 'Points annulés avec succès',
      });
    } else {
      // Vente complétée - attribuer les points
      const result = await service.processSaleCompleted({
        saleId,
        saleNumber,
        customerId,
        totalAmount,
        saleDate: saleDate || new Date().toISOString(),
        workspaceId,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: result.tierUpgraded
          ? `Félicitations ! Montée de tier : ${result.newTier?.toUpperCase()}`
          : `${result.pointsEarned + result.bonusPoints} points attribués`,
      });
    }
  } catch (error: any) {
    console.error('Erreur traitement fidélité vente:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du traitement' },
      { status: 500 }
    );
  }
}

/**
 * GET - Obtenir les infos de fidélité pour un client
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.LOYALTY_VIEW);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId requis' },
        { status: 400 }
      );
    }

    const info = await service.getCustomerLoyaltyInfo(customerId);

    return NextResponse.json({ data: info });
  } catch (error: any) {
    console.error('Erreur récupération infos fidélité:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}
