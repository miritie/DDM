/**
 * Service - Gestion des Interactions Clients
 * Module Clients & Fidélité
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { CustomerInteraction } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export type InteractionType = 'call' | 'email' | 'sms' | 'visit' | 'complaint' | 'feedback' | 'note';
export type SentimentType = 'positive' | 'neutral' | 'negative';

export interface CreateInteractionInput {
  customerId: string;
  customerName: string;
  type: InteractionType;
  subject?: string;
  description: string;
  sentiment?: SentimentType;
  interactionDate?: string;
  duration?: number;
  employeeId?: string;
  employeeName?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  tags?: string[];
  attachments?: string[];
  workspaceId: string;
}

export class InteractionService {
  /**
   * Crée une interaction client
   */
  async create(input: CreateInteractionInput): Promise<CustomerInteraction> {
    const interaction = {
      InteractionId: uuidv4(),
      CustomerId: input.customerId,
      CustomerName: input.customerName,
      Type: input.type,
      Subject: input.subject,
      Description: input.description,
      Sentiment: input.sentiment,
      InteractionDate: input.interactionDate || new Date().toISOString(),
      Duration: input.duration,
      EmployeeId: input.employeeId,
      EmployeeName: input.employeeName,
      FollowUpRequired: input.followUpRequired || false,
      FollowUpDate: input.followUpDate,
      FollowUpDone: false,
      Attachments: input.attachments,
      Tags: input.tags,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<CustomerInteraction>('customer_interactions', interaction);
    return created;
  }

  /**
   * Liste les interactions d'un client
   */
  async listByCustomer(customerId: string): Promise<CustomerInteraction[]> {
    return await postgresClient.list<CustomerInteraction>('customer_interactions', {
      where: { customer_id: customerId },
      orderBy: { field: 'interaction_date', direction: 'desc' },
    });
  }

  /**
   * Liste toutes les interactions avec filtres
   */
  async list(
    workspaceId: string,
    filters?: {
      type?: InteractionType;
      sentiment?: SentimentType;
      followUpRequired?: boolean;
      followUpDone?: boolean;
      employeeId?: string;
    }
  ): Promise<CustomerInteraction[]> {
    const where: any = { workspace_id: workspaceId };

    if (filters?.type) where.type = filters.type;
    if (filters?.sentiment) where.sentiment = filters.sentiment;
    if (filters?.followUpRequired !== undefined) where.follow_up_required = filters.followUpRequired;
    if (filters?.followUpDone !== undefined) where.follow_up_done = filters.followUpDone;
    if (filters?.employeeId) where.employee_id = filters.employeeId;

    return await postgresClient.list<CustomerInteraction>('customer_interactions', {
      where,
      orderBy: { field: 'interaction_date', direction: 'desc' },
    });
  }

  /**
   * Récupère une interaction par ID
   */
  async getById(interactionId: string): Promise<CustomerInteraction | null> {
    const interactions = await postgresClient.list<CustomerInteraction>('customer_interactions', {
      where: { interaction_id: interactionId },
    });

    return interactions.length > 0 ? interactions[0] : null;
  }

  /**
   * Met à jour une interaction
   */
  async update(
    interactionId: string,
    updates: Partial<CreateInteractionInput>
  ): Promise<CustomerInteraction> {
    const interactions = await postgresClient.list<CustomerInteraction>('customer_interactions', {
      where: { interaction_id: interactionId },
    });

    if (interactions.length === 0) {
      throw new Error('Interaction non trouvée');
    }

    const interaction = interactions[0];
    if (!interaction.id) throw new Error('Interaction ID is missing');

    const updateData: any = { UpdatedAt: new Date().toISOString() };

    Object.keys(updates).forEach((key) => {
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      updateData[pascalKey] = updates[key as keyof CreateInteractionInput];
    });

    const updated = await postgresClient.update<CustomerInteraction>(
      'customer_interactions',
      interaction.id,
      updateData
    );
    return updated;
  }

  /**
   * Marque un suivi comme terminé
   */
  async markFollowUpDone(interactionId: string): Promise<CustomerInteraction> {
    const interactions = await postgresClient.list<CustomerInteraction>('customer_interactions', {
      where: { interaction_id: interactionId },
    });

    if (interactions.length === 0) {
      throw new Error('Interaction non trouvée');
    }

    const interaction = interactions[0];
    if (!interaction.id) throw new Error('Interaction ID is missing');

    const updated = await postgresClient.update<CustomerInteraction>(
      'customer_interactions',
      interaction.id,
      {
        FollowUpDone: true,
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  /**
   * Récupère les interactions nécessitant un suivi
   */
  async getPendingFollowUps(workspaceId: string): Promise<CustomerInteraction[]> {
    return await this.list(workspaceId, {
      followUpRequired: true,
      followUpDone: false,
    });
  }

  /**
   * Récupère les interactions par type
   */
  async getByType(workspaceId: string, type: InteractionType): Promise<CustomerInteraction[]> {
    return await this.list(workspaceId, { type });
  }

  /**
   * Récupère les plaintes clients
   */
  async getComplaints(workspaceId: string): Promise<CustomerInteraction[]> {
    return await this.getByType(workspaceId, 'complaint');
  }

  /**
   * Statistiques des interactions
   */
  async getStatistics(workspaceId: string): Promise<{
    total: number;
    byType: Record<InteractionType, number>;
    bySentiment: Record<SentimentType, number>;
    pendingFollowUps: number;
  }> {
    const interactions = await this.list(workspaceId);

    const byType: any = {
      call: 0,
      email: 0,
      sms: 0,
      visit: 0,
      complaint: 0,
      feedback: 0,
      note: 0,
    };

    const bySentiment: any = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    let pendingFollowUps = 0;

    interactions.forEach((interaction) => {
      byType[interaction.Type]++;
      if (interaction.Sentiment) {
        bySentiment[interaction.Sentiment]++;
      }
      if (interaction.FollowUpRequired && !interaction.FollowUpDone) {
        pendingFollowUps++;
      }
    });

    return {
      total: interactions.length,
      byType,
      bySentiment,
      pendingFollowUps,
    };
  }
}
