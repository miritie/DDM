/**
 * Service - Gestion des Tiers de Fidélité
 * Module Clients & Fidélité
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { LoyaltyTierConfig, LoyaltyTier, Customer } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateTierConfigInput {
  tier: LoyaltyTier;
  name: string;
  description?: string;
  minimumPoints?: number;
  minimumSpent?: number;
  minimumOrders?: number;
  pointsEarnRate: number;
  discountPercentage?: number;
  birthdayBonus?: number;
  welcomeBonus?: number;
  freeShipping?: boolean;
  prioritySupport?: boolean;
  exclusiveProducts?: boolean;
  earlyAccessSales?: boolean;
  color?: string;
  iconUrl?: string;
  badgeUrl?: string;
  order: number;
  workspaceId: string;
}

export class TierService {
  /**
   * Crée une configuration de tier
   */
  async create(input: CreateTierConfigInput): Promise<LoyaltyTierConfig> {
    // Vérifier qu'un tier avec ce niveau n'existe pas déjà
    const existing = await postgresClient.list<LoyaltyTierConfig>('loyalty_tier_configs', {
      where: { workspace_id: input.workspaceId, tier: input.tier },
    });

    if (existing.length > 0) {
      throw new Error('Une configuration existe déjà pour ce tier');
    }

    const config = {
      TierConfigId: uuidv4(),
      Tier: input.tier,
      Name: input.name,
      Description: input.description,
      MinimumPoints: input.minimumPoints,
      MinimumSpent: input.minimumSpent,
      MinimumOrders: input.minimumOrders,
      PointsEarnRate: input.pointsEarnRate,
      DiscountPercentage: input.discountPercentage,
      BirthdayBonus: input.birthdayBonus,
      WelcomeBonus: input.welcomeBonus,
      FreeShipping: input.freeShipping || false,
      PrioritySupport: input.prioritySupport || false,
      ExclusiveProducts: input.exclusiveProducts || false,
      EarlyAccessSales: input.earlyAccessSales || false,
      Color: input.color,
      IconUrl: input.iconUrl,
      BadgeUrl: input.badgeUrl,
      Order: input.order,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<LoyaltyTierConfig>('loyalty_tier_configs', config);
    return created;
  }

  /**
   * Récupère toutes les configurations de tier
   */
  async list(workspaceId: string): Promise<LoyaltyTierConfig[]> {
    return await postgresClient.list<LoyaltyTierConfig>('loyalty_tier_configs', {
      where: { workspace_id: workspaceId },
      orderBy: { field: 'order', direction: 'asc' },
    });
  }

  /**
   * Récupère une configuration de tier par tier
   */
  async getByTier(workspaceId: string, tier: LoyaltyTier): Promise<LoyaltyTierConfig | null> {
    const configs = await postgresClient.list<LoyaltyTierConfig>('loyalty_tier_configs', {
      where: { workspace_id: workspaceId, tier: tier, is_active: true },
    });

    return configs.length > 0 ? configs[0] : null;
  }

  /**
   * Met à jour une configuration de tier
   */
  async update(tierConfigId: string, updates: Partial<CreateTierConfigInput>): Promise<LoyaltyTierConfig> {
    const configs = await postgresClient.list<LoyaltyTierConfig>('loyalty_tier_configs', {
      where: { tier_config_id: tierConfigId },
    });

    if (configs.length === 0) {
      throw new Error('Configuration de tier non trouvée');
    }

    const config = configs[0];
    if (!config.id) throw new Error('Tier config ID is missing');

    // Convert to PascalCase
    const formattedUpdates: any = { UpdatedAt: new Date().toISOString() };
    Object.keys(updates).forEach((key) => {
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      formattedUpdates[pascalKey] = updates[key as keyof CreateTierConfigInput];
    });

    const updated = await postgresClient.update<LoyaltyTierConfig>(
      'loyalty_tier_configs',
      config.id,
      formattedUpdates
    );
    return updated;
  }

  /**
   * Détermine le tier approprié pour un client
   */
  async calculateTierForCustomer(customer: Customer, workspaceId: string): Promise<LoyaltyTier> {
    const configs = await this.list(workspaceId);
    const activeTiers = configs.filter((c) => c.IsActive).sort((a, b) => b.Order - a.Order);

    for (const tier of activeTiers) {
      const meetsPoints = !tier.MinimumPoints || customer.LoyaltyPoints >= tier.MinimumPoints;
      const meetsSpent = !tier.MinimumSpent || customer.TotalSpent >= tier.MinimumSpent;
      const meetsOrders = !tier.MinimumOrders || customer.TotalOrders >= tier.MinimumOrders;

      if (meetsPoints && meetsSpent && meetsOrders) {
        return tier.Tier;
      }
    }

    return 'bronze'; // Tier par défaut
  }

  /**
   * Initialise les configurations de tier par défaut
   */
  async initializeDefaultTiers(workspaceId: string): Promise<LoyaltyTierConfig[]> {
    const defaultTiers: CreateTierConfigInput[] = [
      {
        tier: 'bronze',
        name: 'Bronze',
        description: 'Niveau de départ pour tous les nouveaux membres',
        minimumPoints: 0,
        minimumSpent: 0,
        minimumOrders: 0,
        pointsEarnRate: 2,
        welcomeBonus: 100,
        freeShipping: false,
        prioritySupport: false,
        exclusiveProducts: false,
        earlyAccessSales: false,
        color: '#CD7F32',
        order: 1,
        workspaceId,
      },
      {
        tier: 'silver',
        name: 'Argent',
        description: 'Premier niveau de fidélité',
        minimumPoints: 1000,
        minimumSpent: 50000,
        minimumOrders: 5,
        pointsEarnRate: 3,
        welcomeBonus: 200,
        birthdayBonus: 500,
        freeShipping: false,
        prioritySupport: false,
        exclusiveProducts: false,
        earlyAccessSales: false,
        color: '#C0C0C0',
        order: 2,
        workspaceId,
      },
      {
        tier: 'gold',
        name: 'Or',
        description: 'Niveau premium',
        minimumPoints: 5000,
        minimumSpent: 200000,
        minimumOrders: 15,
        pointsEarnRate: 5,
        discountPercentage: 5,
        welcomeBonus: 500,
        birthdayBonus: 1000,
        freeShipping: true,
        prioritySupport: true,
        exclusiveProducts: false,
        earlyAccessSales: true,
        color: '#FFD700',
        order: 3,
        workspaceId,
      },
      {
        tier: 'platinum',
        name: 'Platine',
        description: 'Niveau VIP',
        minimumPoints: 15000,
        minimumSpent: 500000,
        minimumOrders: 30,
        pointsEarnRate: 7,
        discountPercentage: 10,
        welcomeBonus: 1000,
        birthdayBonus: 2000,
        freeShipping: true,
        prioritySupport: true,
        exclusiveProducts: true,
        earlyAccessSales: true,
        color: '#E5E4E2',
        order: 4,
        workspaceId,
      },
      {
        tier: 'diamond',
        name: 'Diamant',
        description: 'Niveau exclusif pour nos meilleurs clients',
        minimumPoints: 50000,
        minimumSpent: 1500000,
        minimumOrders: 50,
        pointsEarnRate: 10,
        discountPercentage: 15,
        welcomeBonus: 2000,
        birthdayBonus: 5000,
        freeShipping: true,
        prioritySupport: true,
        exclusiveProducts: true,
        earlyAccessSales: true,
        color: '#B9F2FF',
        order: 5,
        workspaceId,
      },
    ];

    const createdTiers: LoyaltyTierConfig[] = [];

    for (const tierInput of defaultTiers) {
      try {
        const tier = await this.create(tierInput);
        createdTiers.push(tier);
      } catch (error) {
        // Ignorer si le tier existe déjà
        console.log(`Tier ${tierInput.tier} already exists`);
      }
    }

    return createdTiers;
  }
}
