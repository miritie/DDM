/**
 * Service - Segmentation des Clients
 * Module Clients & Fidélité
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { CustomerSegment, Customer, LoyaltyTier } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface SegmentCriteria {
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minOrders?: number;
  maxOrders?: number;
  minAverageOrderValue?: number;
  maxAverageOrderValue?: number;
  loyaltyTiers?: LoyaltyTier[];
  tags?: string[];
  cities?: string[];
  lastOrderDaysAgo?: number;
  memberSinceDaysAgo?: number;
}

export interface CreateSegmentInput {
  name: string;
  description?: string;
  criteria: SegmentCriteria;
  color?: string;
  workspaceId: string;
}

export class SegmentService {
  /**
   * Crée un segment de clients
   */
  async create(input: CreateSegmentInput): Promise<CustomerSegment> {
    const segment = {
      SegmentId: uuidv4(),
      Name: input.name,
      Description: input.description,
      Criteria: input.criteria,
      CustomerCount: 0,
      TotalRevenue: 0,
      Color: input.color,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<CustomerSegment>('customer_segments', segment);
    return created;
  }

  /**
   * Liste tous les segments
   */
  async list(workspaceId: string, activeOnly = false): Promise<CustomerSegment[]> {
    const where: any = { workspace_id: workspaceId };
    if (activeOnly) {
      where.is_active = true;
    }

    return await postgresClient.list<CustomerSegment>('customer_segments', {
      where,
      orderBy: { field: 'name', direction: 'asc' },
    });
  }

  /**
   * Récupère un segment par ID
   */
  async getById(segmentId: string): Promise<CustomerSegment | null> {
    const segments = await postgresClient.list<CustomerSegment>('customer_segments', {
      where: { segment_id: segmentId },
    });

    return segments.length > 0 ? segments[0] : null;
  }

  /**
   * Met à jour un segment
   */
  async update(segmentId: string, updates: Partial<CreateSegmentInput>): Promise<CustomerSegment> {
    const segments = await postgresClient.list<CustomerSegment>('customer_segments', {
      where: { segment_id: segmentId },
    });

    if (segments.length === 0) {
      throw new Error('Segment non trouvé');
    }

    const segment = segments[0];
    if (!segment.id) throw new Error('Segment ID is missing');

    // Convert to PascalCase
    const formattedUpdates: any = { UpdatedAt: new Date().toISOString() };
    Object.keys(updates).forEach((key) => {
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      formattedUpdates[pascalKey] = updates[key as keyof CreateSegmentInput];
    });

    const updated = await postgresClient.update<CustomerSegment>(
      'customer_segments',
      segment.id,
      formattedUpdates
    );
    return updated;
  }

  /**
   * Vérifie si un client correspond aux critères d'un segment
   */
  matchesCriteria(customer: Customer, criteria: SegmentCriteria): boolean {
    // Vérifier le montant total dépensé
    if (criteria.minTotalSpent && customer.TotalSpent < criteria.minTotalSpent) return false;
    if (criteria.maxTotalSpent && customer.TotalSpent > criteria.maxTotalSpent) return false;

    // Vérifier le nombre de commandes
    if (criteria.minOrders && customer.TotalOrders < criteria.minOrders) return false;
    if (criteria.maxOrders && customer.TotalOrders > criteria.maxOrders) return false;

    // Vérifier le panier moyen
    if (criteria.minAverageOrderValue && customer.AverageOrderValue < criteria.minAverageOrderValue)
      return false;
    if (criteria.maxAverageOrderValue && customer.AverageOrderValue > criteria.maxAverageOrderValue)
      return false;

    // Vérifier le tier
    if (criteria.loyaltyTiers && !criteria.loyaltyTiers.includes(customer.LoyaltyTier)) return false;

    // Vérifier les tags
    if (criteria.tags && criteria.tags.length > 0) {
      if (!customer.Tags || !criteria.tags.some((tag) => customer.Tags?.includes(tag))) return false;
    }

    // Vérifier la ville
    if (criteria.cities && criteria.cities.length > 0) {
      if (!customer.City || !criteria.cities.includes(customer.City)) return false;
    }

    // Vérifier la dernière commande
    if (criteria.lastOrderDaysAgo && customer.LastOrderDate) {
      const daysSinceLastOrder = Math.floor(
        (Date.now() - new Date(customer.LastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastOrder < criteria.lastOrderDaysAgo) return false;
    }

    // Vérifier la date d'inscription
    if (criteria.memberSinceDaysAgo) {
      const daysSinceMember = Math.floor(
        (Date.now() - new Date(customer.MemberSince).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceMember < criteria.memberSinceDaysAgo) return false;
    }

    return true;
  }

  /**
   * Calcule les statistiques d'un segment
   */
  async calculateSegmentStats(
    segmentId: string,
    workspaceId: string
  ): Promise<{ customerCount: number; totalRevenue: number }> {
    const segment = await this.getById(segmentId);
    if (!segment) throw new Error('Segment non trouvé');

    // Récupérer tous les clients du workspace
    const allCustomers = await postgresClient.list<Customer>('customers', {
      where: { workspace_id: workspaceId },
    });

    // Filtrer les clients qui correspondent aux critères
    const matchingCustomers = allCustomers.filter((customer) =>
      this.matchesCriteria(customer, segment.Criteria)
    );

    const customerCount = matchingCustomers.length;
    const totalRevenue = matchingCustomers.reduce((sum, customer) => sum + customer.TotalSpent, 0);

    // Mettre à jour le segment
    const segments = await postgresClient.list<CustomerSegment>('customer_segments', {
      where: { segment_id: segmentId },
    });

    if (segments.length > 0) {
      const segmentToUpdate = segments[0];
      if (segmentToUpdate.id) {
        await postgresClient.update<CustomerSegment>(
          'customer_segments',
          segmentToUpdate.id,
          {
            CustomerCount: customerCount,
            TotalRevenue: totalRevenue,
            LastCalculatedAt: new Date().toISOString(),
            UpdatedAt: new Date().toISOString(),
          }
        );
      }
    }

    return { customerCount, totalRevenue };
  }

  /**
   * Récupère les clients d'un segment
   */
  async getSegmentCustomers(segmentId: string, workspaceId: string): Promise<Customer[]> {
    const segment = await this.getById(segmentId);
    if (!segment) throw new Error('Segment non trouvé');

    const allCustomers = await postgresClient.list<Customer>('customers', {
      where: { workspace_id: workspaceId },
    });

    return allCustomers.filter((customer) => this.matchesCriteria(customer, segment.Criteria));
  }

  /**
   * Recalcule tous les segments
   */
  async recalculateAllSegments(workspaceId: string): Promise<void> {
    const segments = await this.list(workspaceId, true);

    for (const segment of segments) {
      await this.calculateSegmentStats(segment.SegmentId, workspaceId);
    }
  }
}
