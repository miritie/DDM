/**
 * Service - Intégration Fidélité avec Ventes
 * Attribue automatiquement des points lors des ventes
 */

import { CustomerService } from './customer-service';
import { LoyaltyService } from './loyalty-service';

const customerService = new CustomerService();
const loyaltyService = new LoyaltyService();

export interface SaleCompletedData {
  saleId: string;
  saleNumber: string;
  customerId: string;
  totalAmount: number;
  saleDate: string;
  workspaceId: string;
}

/**
 * Configuration du programme de fidélité
 */
const LOYALTY_CONFIG = {
  // Taux de base : 1 point pour chaque 1000 F dépensés
  BASE_POINTS_PER_1000: 1,

  // Multiplicateurs par tier
  TIER_MULTIPLIERS: {
    bronze: 1,
    silver: 1.2,
    gold: 1.5,
    platinum: 2,
    diamond: 2.5,
  },

  // Seuils pour montée de tier (en F)
  TIER_THRESHOLDS: {
    bronze: { spent: 0, orders: 0 },
    silver: { spent: 500000, orders: 10 },
    gold: { spent: 1000000, orders: 25 },
    platinum: { spent: 2000000, orders: 50 },
    diamond: { spent: 5000000, orders: 100 },
  },

  // Points bonus spéciaux
  BONUS_POINTS: {
    firstPurchase: 100,
    tierUpgrade: 500,
    milestone: {
      '10orders': 200,
      '25orders': 500,
      '50orders': 1000,
      '100orders': 2000,
    },
  },
};

export class LoyaltyIntegrationService {
  /**
   * Traite une vente complétée et attribue les points
   */
  async processSaleCompleted(saleData: SaleCompletedData): Promise<{
    pointsEarned: number;
    bonusPoints: number;
    newTier?: string;
    tierUpgraded: boolean;
  }> {
    try {
      // 1. Récupérer le client
      const customer = await customerService.getById(saleData.customerId);
      if (!customer) {
        throw new Error('Client non trouvé');
      }

      // 2. Calculer les points de base
      const basePoints = this.calculateBasePoints(
        saleData.totalAmount,
        customer.LoyaltyTier
      );

      // 3. Calculer les bonus éventuels
      const bonusPoints = this.calculateBonusPoints(customer);

      // 4. Total des points à attribuer
      const totalPoints = basePoints + bonusPoints;

      // 5. Attribuer les points
      if (totalPoints > 0) {
        await loyaltyService.earnPoints(
          saleData.customerId,
          totalPoints,
          `Achat ${saleData.saleNumber} - ${new Intl.NumberFormat('fr-FR').format(
            saleData.totalAmount
          )} F`,
          saleData.saleId,
          'sale',
          saleData.workspaceId
        );
      }

      // 6. Mettre à jour les statistiques client
      await customerService.updateStats(
        saleData.customerId,
        saleData.totalAmount,
        totalPoints
      );

      // 7. Vérifier si montée de tier
      // TODO: Implement calculateAndUpdateTier method
      const tierUpgraded = false;

      // 8. Bonus de montée de tier
      if (tierUpgraded) {
        await loyaltyService.earnPoints(
          saleData.customerId,
          LOYALTY_CONFIG.BONUS_POINTS.tierUpgrade,
          `Bonus montée de tier`,
          undefined,
          'promotion',
          saleData.workspaceId
        );
      }

      return {
        pointsEarned: basePoints,
        bonusPoints,
        newTier: undefined,
        tierUpgraded,
      };
    } catch (error) {
      console.error('Erreur traitement fidélité vente:', error);
      throw error;
    }
  }

  /**
   * Calcule les points de base selon le montant et le tier
   */
  private calculateBasePoints(amount: number, tier: string): number {
    const basePoints = Math.floor(amount / 1000) * LOYALTY_CONFIG.BASE_POINTS_PER_1000;
    const multiplier =
      LOYALTY_CONFIG.TIER_MULTIPLIERS[tier as keyof typeof LOYALTY_CONFIG.TIER_MULTIPLIERS] || 1;

    return Math.floor(basePoints * multiplier);
  }

  /**
   * Calcule les points bonus éventuels
   */
  private calculateBonusPoints(customer: any): number {
    let bonus = 0;

    // Bonus première commande
    if (customer.TotalOrders === 0) {
      bonus += LOYALTY_CONFIG.BONUS_POINTS.firstPurchase;
    }

    // Bonus paliers de commandes
    const newOrderCount = customer.TotalOrders + 1;
    if (newOrderCount === 10) {
      bonus += LOYALTY_CONFIG.BONUS_POINTS.milestone['10orders'];
    } else if (newOrderCount === 25) {
      bonus += LOYALTY_CONFIG.BONUS_POINTS.milestone['25orders'];
    } else if (newOrderCount === 50) {
      bonus += LOYALTY_CONFIG.BONUS_POINTS.milestone['50orders'];
    } else if (newOrderCount === 100) {
      bonus += LOYALTY_CONFIG.BONUS_POINTS.milestone['100orders'];
    }

    return bonus;
  }

  /**
   * Annule les points d'une vente annulée
   */
  async processSaleCancelled(saleData: SaleCompletedData): Promise<void> {
    try {
      const customer = await customerService.getById(saleData.customerId);
      if (!customer) {
        return;
      }

      // Calculer les points qui avaient été attribués
      const pointsToRemove = this.calculateBasePoints(
        saleData.totalAmount,
        customer.LoyaltyTier
      );

      if (pointsToRemove > 0) {
        await loyaltyService.redeemPoints(
          saleData.customerId,
          pointsToRemove,
          `Annulation vente ${saleData.saleNumber}`,
          saleData.saleId,
          'manual' as any,
          saleData.workspaceId
        );
      }

      // Mettre à jour les statistiques (soustraire)
      const newTotalOrders = Math.max(0, customer.TotalOrders - 1);
      const newTotalSpent = Math.max(0, customer.TotalSpent - saleData.totalAmount);
      const newAverageOrderValue =
        newTotalOrders > 0 ? newTotalSpent / newTotalOrders : 0;

      // Recalculer le tier
      // TODO: Implement calculateAndUpdateTier method in CustomerService
      // await customerService.calculateAndUpdateTier(saleData.customerId);
    } catch (error) {
      console.error('Erreur annulation fidélité vente:', error);
      throw error;
    }
  }

  /**
   * Applique une récompense à une vente
   */
  async applyRewardToSale(
    customerId: string,
    rewardId: string,
    saleAmount: number
  ): Promise<{
    discountAmount: number;
    discountPercentage: number;
  }> {
    try {
      // Récupérer la récompense
      const rewards = await loyaltyService.listRewards('', { isActive: true });
      const reward = rewards.find((r) => r.RewardId === rewardId);

      if (!reward) {
        throw new Error('Récompense non trouvée');
      }

      let discountAmount = 0;
      let discountPercentage = 0;

      // Calculer la remise selon le type de récompense
      if (reward.Type === 'discount' && reward.DiscountPercentage) {
        discountPercentage = reward.DiscountPercentage;
        discountAmount = (saleAmount * discountPercentage) / 100;
      } else if (reward.Type === 'discount' && reward.DiscountAmount) {
        discountAmount = reward.DiscountAmount;
        discountPercentage = (discountAmount / saleAmount) * 100;
      } else if (reward.Type === 'cashback' && reward.CashbackAmount) {
        discountAmount = reward.CashbackAmount;
      }

      return {
        discountAmount: Math.min(discountAmount, saleAmount),
        discountPercentage,
      };
    } catch (error) {
      console.error('Erreur application récompense:', error);
      throw error;
    }
  }

  /**
   * Obtient les informations de fidélité pour un client
   */
  async getCustomerLoyaltyInfo(customerId: string): Promise<{
    points: number;
    tier: string;
    nextTier?: string;
    progressToNextTier: number;
    availableRewards: number;
  }> {
    try {
      const customer = await customerService.getById(customerId);
      if (!customer) {
        throw new Error('Client non trouvé');
      }

      // Calculer la progression vers le tier suivant
      const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
      const currentIndex = tierOrder.indexOf(customer.LoyaltyTier);
      const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;

      let progressToNextTier = 100;
      if (nextTier) {
        const threshold =
          LOYALTY_CONFIG.TIER_THRESHOLDS[
            nextTier as keyof typeof LOYALTY_CONFIG.TIER_THRESHOLDS
          ];
        progressToNextTier = Math.min(
          (customer.TotalSpent / threshold.spent) * 100,
          100
        );
      }

      // Compter les récompenses disponibles
      const rewards = await loyaltyService.listRewards('', { isActive: true });
      const availableRewards = rewards.filter(
        (r) => r.PointsCost <= customer.LoyaltyPoints
      ).length;

      return {
        points: customer.LoyaltyPoints,
        tier: customer.LoyaltyTier,
        nextTier: nextTier || undefined,
        progressToNextTier,
        availableRewards,
      };
    } catch (error) {
      console.error('Erreur récupération infos fidélité:', error);
      throw error;
    }
  }
}
