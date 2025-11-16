/**
 * Hook - Intégration Fidélité dans le Flux de Vente
 * Appelle automatiquement l'attribution de points lors des ventes
 */

/**
 * Fonction à appeler après la confirmation d'une vente
 * À intégrer dans le SaleService
 */
export async function processSaleLoyalty(
  saleId: string,
  saleNumber: string,
  customerId: string | null,
  totalAmount: number,
  saleDate: string
): Promise<{
  success: boolean;
  pointsEarned?: number;
  tierUpgraded?: boolean;
  newTier?: string;
  error?: string;
}> {
  // Si pas de client, pas de points
  if (!customerId) {
    return { success: false, error: 'Pas de client associé' };
  }

  try {
    const response = await fetch('/api/customers/loyalty/process-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saleId,
        saleNumber,
        customerId,
        totalAmount,
        saleDate,
        action: 'complete',
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        pointsEarned: result.data?.pointsEarned + result.data?.bonusPoints || 0,
        tierUpgraded: result.data?.tierUpgraded || false,
        newTier: result.data?.newTier,
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Erreur attribution points',
      };
    }
  } catch (error) {
    console.error('Erreur hook fidélité vente:', error);
    return {
      success: false,
      error: 'Erreur réseau',
    };
  }
}

/**
 * Fonction à appeler lors de l'annulation d'une vente
 */
export async function cancelSaleLoyalty(
  saleId: string,
  saleNumber: string,
  customerId: string | null,
  totalAmount: number,
  saleDate: string
): Promise<{ success: boolean; error?: string }> {
  // Si pas de client, rien à faire
  if (!customerId) {
    return { success: true };
  }

  try {
    const response = await fetch('/api/customers/loyalty/process-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saleId,
        saleNumber,
        customerId,
        totalAmount,
        saleDate,
        action: 'cancel',
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Erreur annulation points',
      };
    }
  } catch (error) {
    console.error('Erreur hook annulation fidélité:', error);
    return {
      success: false,
      error: 'Erreur réseau',
    };
  }
}

/**
 * Obtenir les infos de fidélité d'un client pour affichage dans l'interface de vente
 */
export async function getCustomerLoyaltyForSale(
  customerId: string
): Promise<{
  success: boolean;
  data?: {
    points: number;
    tier: string;
    nextTier?: string;
    progressToNextTier: number;
    availableRewards: number;
  };
  error?: string;
}> {
  try {
    const response = await fetch(
      `/api/customers/loyalty/process-sale?customerId=${customerId}`
    );

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        error: 'Erreur récupération infos fidélité',
      };
    }
  } catch (error) {
    console.error('Erreur récupération fidélité:', error);
    return {
      success: false,
      error: 'Erreur réseau',
    };
  }
}
