/**
 * Service - Gestion du Programme de Fidélité
 * Module Clients & Fidélité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { LoyaltyTransaction, LoyaltyReward, CustomerReward, LoyaltyTierConfig } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { CustomerService } from './customer-service';

const airtableClient = new AirtableClient();
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

    const transaction: Partial<LoyaltyTransaction> = {
      TransactionId: uuidv4(),
      CustomerId: customerId,
      CustomerName: customer.FullName,
      Type: 'earn',
      Points: points,
      BalanceBefore: customer.LoyaltyPoints,
      BalanceAfter: customer.LoyaltyPoints + points,
      Description: reason,
      ReferenceId: referenceId,
      ReferenceType: referenceType,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
    };

    await airtableClient.create<LoyaltyTransaction>('LoyaltyTransaction', transaction);

    // Mettre à jour le solde du client
    await airtableClient.update('Customer', (customer as any)._recordId, {
      LoyaltyPoints: transaction.BalanceAfter,
      TotalPointsEarned: customer.TotalPointsEarned + points,
      UpdatedAt: new Date().toISOString(),
    });

    return transaction as LoyaltyTransaction;
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

    if (customer.LoyaltyPoints < points) {
      throw new Error('Solde de points insuffisant');
    }

    const transaction: Partial<LoyaltyTransaction> = {
      TransactionId: uuidv4(),
      CustomerId: customerId,
      CustomerName: customer.FullName,
      Type: 'redeem',
      Points: -points,
      BalanceBefore: customer.LoyaltyPoints,
      BalanceAfter: customer.LoyaltyPoints - points,
      Description: reason,
      ReferenceId: referenceId,
      ReferenceType: referenceType,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
    };

    await airtableClient.create<LoyaltyTransaction>('LoyaltyTransaction', transaction);

    await airtableClient.update('Customer', (customer as any)._recordId, {
      LoyaltyPoints: transaction.BalanceAfter,
      TotalPointsRedeemed: customer.TotalPointsRedeemed + points,
      UpdatedAt: new Date().toISOString(),
    });

    return transaction as LoyaltyTransaction;
  }

  async getTransactionHistory(customerId: string): Promise<LoyaltyTransaction[]> {
    return await airtableClient.list<LoyaltyTransaction>('LoyaltyTransaction', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  // Récompenses
  async listRewards(workspaceId: string, filters: any = {}): Promise<LoyaltyReward[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.type) filterFormulas.push(`{Type} = '${filters.type}'`);
    if (filters.isActive !== undefined) filterFormulas.push(`{IsActive} = ${filters.isActive ? '1' : '0'}`);
    if (filters.minimumTier) filterFormulas.push(`{MinimumTier} = '${filters.minimumTier}'`);

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<LoyaltyReward>('LoyaltyReward', {
      filterByFormula,
      sort: [{ field: 'PointsCost', direction: 'asc' }],
    });
  }

  async redeemReward(customerId: string, rewardId: string, workspaceId: string): Promise<CustomerReward> {
    const customer = await customerService.getById(customerId);
    if (!customer) throw new Error('Client non trouvé');

    const rewards = await airtableClient.list<LoyaltyReward>('LoyaltyReward', {
      filterByFormula: `{RewardId} = '${rewardId}'`,
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
    const customerReward: Partial<CustomerReward> = {
      CustomerRewardId: uuidv4(),
      CustomerId: customerId,
      CustomerName: customer.FullName,
      RewardId: rewardId,
      RewardName: reward.Name,
      RewardType: reward.Type,
      PointsSpent: reward.PointsCost,
      Status: 'available',
      RedeemedAt: new Date().toISOString(),
      ExpiresAt: reward.ValidUntil || undefined,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<CustomerReward>('CustomerReward', customerReward);
  }

  async getCustomerRewards(customerId: string): Promise<CustomerReward[]> {
    return await airtableClient.list<CustomerReward>('CustomerReward', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
      sort: [{ field: 'RedeemedAt', direction: 'desc' }],
    });
  }
}
