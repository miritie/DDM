/**
 * Service - Gestion des Interactions Clients
 * Module Clients & Fidélité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { CustomerInteraction } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    const interaction: Partial<CustomerInteraction> = {
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

    return await airtableClient.create<CustomerInteraction>('CustomerInteraction', interaction);
  }

  /**
   * Liste les interactions d'un client
   */
  async listByCustomer(customerId: string): Promise<CustomerInteraction[]> {
    return await airtableClient.list<CustomerInteraction>('CustomerInteraction', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
      sort: [{ field: 'InteractionDate', direction: 'desc' }],
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
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters?.type) filterFormulas.push(`{Type} = '${filters.type}'`);
    if (filters?.sentiment) filterFormulas.push(`{Sentiment} = '${filters.sentiment}'`);
    if (filters?.followUpRequired !== undefined)
      filterFormulas.push(`{FollowUpRequired} = ${filters.followUpRequired ? 1 : 0}`);
    if (filters?.followUpDone !== undefined)
      filterFormulas.push(`{FollowUpDone} = ${filters.followUpDone ? 1 : 0}`);
    if (filters?.employeeId) filterFormulas.push(`{EmployeeId} = '${filters.employeeId}'`);

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<CustomerInteraction>('CustomerInteraction', {
      filterByFormula,
      sort: [{ field: 'InteractionDate', direction: 'desc' }],
    });
  }

  /**
   * Récupère une interaction par ID
   */
  async getById(interactionId: string): Promise<CustomerInteraction | null> {
    const interactions = await airtableClient.list<CustomerInteraction>('CustomerInteraction', {
      filterByFormula: `{InteractionId} = '${interactionId}'`,
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
    const interactions = await airtableClient.list<CustomerInteraction>('CustomerInteraction', {
      filterByFormula: `{InteractionId} = '${interactionId}'`,
    });

    if (interactions.length === 0) {
      throw new Error('Interaction non trouvée');
    }

    const updateData: any = { UpdatedAt: new Date().toISOString() };

    Object.keys(updates).forEach((key) => {
      const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
      updateData[pascalKey] = updates[key as keyof CreateInteractionInput];
    });

    return await airtableClient.update<CustomerInteraction>(
      'CustomerInteraction',
      (interactions[0] as any)._recordId,
      updateData
    );
  }

  /**
   * Marque un suivi comme terminé
   */
  async markFollowUpDone(interactionId: string): Promise<CustomerInteraction> {
    const interactions = await airtableClient.list<CustomerInteraction>('CustomerInteraction', {
      filterByFormula: `{InteractionId} = '${interactionId}'`,
    });

    if (interactions.length === 0) {
      throw new Error('Interaction non trouvée');
    }

    return await airtableClient.update<CustomerInteraction>(
      'CustomerInteraction',
      (interactions[0] as any)._recordId,
      {
        FollowUpDone: true,
        UpdatedAt: new Date().toISOString(),
      }
    );
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
