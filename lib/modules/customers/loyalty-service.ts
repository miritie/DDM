/**
 * Service - Gestion du Programme de Fidélité
 * Module Clients & Fidélité
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { LoyaltyTransaction, LoyaltyReward, CustomerReward, LoyaltyTierConfig } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { CustomerService } from './customer-service';

const postgresClient = getPostgresClient();
const customerService = new CustomerService();

export type ReferenceType = 'sale' | 'reward' | 'manual' | 'promotion';

export class LoyaltyService {
  // Transactions de points
  async earnPoints(
    customerId: string,
    points: number,
    reason: string,
    referenceId?: string,
    referenceType?: ReferenceType,
    workspaceId: string = ''
  ): Promise<LoyaltyTransaction> {
    const customer = await customerService.getById(customerId);
    if (!customer) throw new Error('Client non trouvé');
    if (!customer.id) throw new Error('Customer ID is missing');

    const transaction = {
      TransactionId: uuidv4(),
      CustomerId: customerId,
      CustomerName: customer.FullName,
      Type: 'earn' as const,
      Points: points,
      BalanceBefore: customer.LoyaltyPoints,
      BalanceAfter: customer.LoyaltyPoints + points,
      Description: reason,
      ReferenceId: referenceId,
      ReferenceType: referenceType,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<LoyaltyTransaction>('loyalty_transactions', transaction);

    // Mettre à jour le solde du client
    await postgresClient.update('customers', customer.id, {
      LoyaltyPoints: transaction.BalanceAfter,
      TotalPointsEarned: customer.TotalPointsEarned + points,
      UpdatedAt: new Date().toISOString(),
    });

    return created;
  }

  async redeemPoints(
    customerId: string,
    points: number,
    reason: string,
    referenceId?: string,
    referenceType?: ReferenceType,
    workspaceId: string = ''
  ): Promise<LoyaltyTransaction> {
    const customer = await customerService.getById(customerId);
    if (!customer) throw new Error('Client non trouvé');
    if (!customer.id) throw new Error('Customer ID is missing');

    if (customer.LoyaltyPoints < points) {
      throw new Error('Solde de points insuffisant');
    }

    const transaction = {
      TransactionId: uuidv4(),
      CustomerId: customerId,
      CustomerName: customer.FullName,
      Type: 'redeem' as const,
      Points: -points,
      BalanceBefore: customer.LoyaltyPoints,
      BalanceAfter: customer.LoyaltyPoints - points,
      Description: reason,
      ReferenceId: referenceId,
      ReferenceType: referenceType,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<LoyaltyTransaction>('loyalty_transactions', transaction);

    await postgresClient.update('customers', customer.id, {
      LoyaltyPoints: transaction.BalanceAfter,
      TotalPointsRedeemed: customer.TotalPointsRedeemed + points,
      UpdatedAt: new Date().toISOString(),
    });

    return created;
  }

  async getTransactionHistory(customerId: string): Promise<LoyaltyTransaction[]> {
    return await postgresClient.list<LoyaltyTransaction>('loyalty_transactions', {
      where: { customer_id: customerId },
      orderBy: { field: 'created_at', direction: 'desc' },
    });
  }

  // Récompenses
  async listRewards(workspaceId: string, filters: any = {}): Promise<LoyaltyReward[]> {
    const where: any = { workspace_id: workspaceId };

    if (filters.type) where.type = filters.type;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    if (filters.minimumTier) where.minimum_tier = filters.minimumTier;

    return await postgresClient.list<LoyaltyReward>('loyalty_rewards', {
      where,
      orderBy: { field: 'points_cost', direction: 'asc' },
    });
  }

  async redeemReward(customerId: string, rewardId: string, workspaceId: string): Promise<CustomerReward> {
    const customer = await customerService.getById(customerId);
    if (!customer) throw new Error('Client non trouvé');

    const rewards = await postgresClient.list<LoyaltyReward>('loyalty_rewards', {
      where: { reward_id: rewardId },
    });

    if (rewards.length === 0) throw new Error('Récompense non trouvée');
    const reward = rewards[0];

    if (!reward.IsActive) throw new Error('Cette récompense n\'est plus disponible');

    if (customer.LoyaltyPoints < reward.PointsCost) {
      throw new Error('Solde de points insuffisant');
    }

    // Vérifier les restrictions de tier
    if (reward.MinimumTier) {
      const tierOrder = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
      const customerTierLevel = tierOrder[customer.LoyaltyTier];
      const requiredTierLevel = tierOrder[reward.MinimumTier];

      if (customerTierLevel < requiredTierLevel) {
        throw new Error('Votre niveau de fidélité ne permet pas de débloquer cette récompense');
      }
    }

    // Utiliser les points
    await this.redeemPoints(
      customerId,
      reward.PointsCost,
      `Échange de récompense: ${reward.Name}`,
      rewardId,
      'reward',
      workspaceId
    );

    // Créer l'enregistrement de récompense client
    const customerReward = {
      CustomerRewardId: uuidv4(),
      CustomerId: customerId,
      CustomerName: customer.FullName,
      RewardId: rewardId,
      RewardName: reward.Name,
      RewardType: reward.Type,
      PointsSpent: reward.PointsCost,
      Status: 'available' as const,
      RedeemedAt: new Date().toISOString(),
      ExpiresAt: reward.ValidUntil || undefined,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<CustomerReward>('customer_rewards', customerReward);
    return created;
  }

  async getCustomerRewards(customerId: string): Promise<CustomerReward[]> {
    return await postgresClient.list<CustomerReward>('customer_rewards', {
      where: { customer_id: customerId },
      orderBy: { field: 'redeemed_at', direction: 'desc' },
    });
  }
}

// Export singleton instance
export const loyaltyService = new LoyaltyService();
