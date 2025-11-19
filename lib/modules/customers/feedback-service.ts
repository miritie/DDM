/**
 * Service - Gestion des Feedbacks Clients
 * Module Clients & Fidélité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { CustomerFeedback } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative';

export interface CreateFeedbackInput {
  customerId: string;
  customerName: string;
  rating: number; // 1-5
  productRating?: number;
  serviceRating?: number;
  deliveryRating?: number;
  comment?: string;
  sentiment?: FeedbackSentiment;
  saleId?: string;
  saleNumber?: string;
  productId?: string;
  productName?: string;
  isPublic?: boolean;
  workspaceId: string;
}

export class FeedbackService {
  /**
   * Crée un feedback client
   */
  async create(input: CreateFeedbackInput): Promise<CustomerFeedback> {
    // Calculer le sentiment automatiquement si non fourni
    const sentiment = input.sentiment || this.calculateSentiment(input.rating);

    const feedback: Partial<CustomerFeedback> = {
      FeedbackId: uuidv4(),
      CustomerId: input.customerId,
      CustomerName: input.customerName,
      Rating: input.rating,
      ProductRating: input.productRating,
      ServiceRating: input.serviceRating,
      DeliveryRating: input.deliveryRating,
      Comment: input.comment,
      Sentiment: sentiment,
      SaleId: input.saleId,
      SaleNumber: input.saleNumber,
      ProductId: input.productId,
      ProductName: input.productName,
      IsPublic: input.isPublic || false,
      IsVerified: false,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<CustomerFeedback>('CustomerFeedback', feedback);
    if (!created) {
      throw new Error('Failed to create customer feedback - Airtable not configured');
    }
    return created;
  }

  /**
   * Calcule le sentiment basé sur la note
   */
  private calculateSentiment(rating: number): FeedbackSentiment {
    if (rating >= 4) return 'positive';
    if (rating >= 3) return 'neutral';
    return 'negative';
  }

  /**
   * Liste les feedbacks d'un client
   */
  async listByCustomer(customerId: string): Promise<CustomerFeedback[]> {
    return await airtableClient.list<CustomerFeedback>('CustomerFeedback', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Liste tous les feedbacks avec filtres
   */
  async list(
    workspaceId: string,
    filters?: {
      sentiment?: FeedbackSentiment;
      isPublic?: boolean;
      isVerified?: boolean;
      minRating?: number;
      maxRating?: number;
      productId?: string;
      saleId?: string;
    }
  ): Promise<CustomerFeedback[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters?.sentiment) filterFormulas.push(`{Sentiment} = '${filters.sentiment}'`);
    if (filters?.isPublic !== undefined)
      filterFormulas.push(`{IsPublic} = ${filters.isPublic ? 1 : 0}`);
    if (filters?.isVerified !== undefined)
      filterFormulas.push(`{IsVerified} = ${filters.isVerified ? 1 : 0}`);
    if (filters?.minRating) filterFormulas.push(`{Rating} >= ${filters.minRating}`);
    if (filters?.maxRating) filterFormulas.push(`{Rating} <= ${filters.maxRating}`);
    if (filters?.productId) filterFormulas.push(`{ProductId} = '${filters.productId}'`);
    if (filters?.saleId) filterFormulas.push(`{SaleId} = '${filters.saleId}'`);

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<CustomerFeedback>('CustomerFeedback', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Récupère un feedback par ID
   */
  async getById(feedbackId: string): Promise<CustomerFeedback | null> {
    const feedbacks = await airtableClient.list<CustomerFeedback>('CustomerFeedback', {
      filterByFormula: `{FeedbackId} = '${feedbackId}'`,
    });

    return feedbacks.length > 0 ? feedbacks[0] : null;
  }

  /**
   * Répond à un feedback
   */
  async respond(
    feedbackId: string,
    response: string,
    respondedById: string,
    respondedByName: string
  ): Promise<CustomerFeedback> {
    const feedbacks = await airtableClient.list<CustomerFeedback>('CustomerFeedback', {
      filterByFormula: `{FeedbackId} = '${feedbackId}'`,
    });

    if (feedbacks.length === 0) {
      throw new Error('Feedback non trouvé');
    }

    const updated = await airtableClient.update<CustomerFeedback>(
      'CustomerFeedback',
      (feedbacks[0] as any)._recordId,
      {
        Response: response,
        RespondedById: respondedById,
        RespondedByName: respondedByName,
        RespondedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update customer feedback - Airtable not configured');
    }
    return updated;
  }

  /**
   * Vérifie un feedback
   */
  async verify(feedbackId: string): Promise<CustomerFeedback> {
    const feedbacks = await airtableClient.list<CustomerFeedback>('CustomerFeedback', {
      filterByFormula: `{FeedbackId} = '${feedbackId}'`,
    });

    if (feedbacks.length === 0) {
      throw new Error('Feedback non trouvé');
    }

    const updated = await airtableClient.update<CustomerFeedback>(
      'CustomerFeedback',
      (feedbacks[0] as any)._recordId,
      {
        IsVerified: true,
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update customer feedback - Airtable not configured');
    }
    return updated;
  }

  /**
   * Publie/Dépublie un feedback
   */
  async togglePublic(feedbackId: string, isPublic: boolean): Promise<CustomerFeedback> {
    const feedbacks = await airtableClient.list<CustomerFeedback>('CustomerFeedback', {
      filterByFormula: `{FeedbackId} = '${feedbackId}'`,
    });

    if (feedbacks.length === 0) {
      throw new Error('Feedback non trouvé');
    }

    const updated = await airtableClient.update<CustomerFeedback>(
      'CustomerFeedback',
      (feedbacks[0] as any)._recordId,
      {
        IsPublic: isPublic,
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update customer feedback - Airtable not configured');
    }
    return updated;
  }

  /**
   * Récupère les feedbacks publics
   */
  async getPublicFeedbacks(workspaceId: string): Promise<CustomerFeedback[]> {
    return await this.list(workspaceId, {
      isPublic: true,
      isVerified: true,
    });
  }

  /**
   * Récupère les feedbacks négatifs
   */
  async getNegativeFeedbacks(workspaceId: string): Promise<CustomerFeedback[]> {
    return await this.list(workspaceId, {
      sentiment: 'negative',
    });
  }

  /**
   * Statistiques des feedbacks
   */
  async getStatistics(workspaceId: string): Promise<{
    total: number;
    averageRating: number;
    averageProductRating: number;
    averageServiceRating: number;
    averageDeliveryRating: number;
    bySentiment: Record<FeedbackSentiment, number>;
    byRating: Record<number, number>;
    totalResponded: number;
    totalPublic: number;
    totalVerified: number;
  }> {
    const feedbacks = await this.list(workspaceId);

    const bySentiment: any = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    const byRating: any = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    let totalRating = 0;
    let totalProductRating = 0;
    let productRatingCount = 0;
    let totalServiceRating = 0;
    let serviceRatingCount = 0;
    let totalDeliveryRating = 0;
    let deliveryRatingCount = 0;
    let totalResponded = 0;
    let totalPublic = 0;
    let totalVerified = 0;

    feedbacks.forEach((feedback) => {
      if (feedback.Sentiment) {
        bySentiment[feedback.Sentiment]++;
      }
      byRating[feedback.Rating]++;
      totalRating += feedback.Rating;

      if (feedback.ProductRating) {
        totalProductRating += feedback.ProductRating;
        productRatingCount++;
      }

      if (feedback.ServiceRating) {
        totalServiceRating += feedback.ServiceRating;
        serviceRatingCount++;
      }

      if (feedback.DeliveryRating) {
        totalDeliveryRating += feedback.DeliveryRating;
        deliveryRatingCount++;
      }

      if (feedback.Response) totalResponded++;
      if (feedback.IsPublic) totalPublic++;
      if (feedback.IsVerified) totalVerified++;
    });

    return {
      total: feedbacks.length,
      averageRating: feedbacks.length > 0 ? totalRating / feedbacks.length : 0,
      averageProductRating: productRatingCount > 0 ? totalProductRating / productRatingCount : 0,
      averageServiceRating: serviceRatingCount > 0 ? totalServiceRating / serviceRatingCount : 0,
      averageDeliveryRating:
        deliveryRatingCount > 0 ? totalDeliveryRating / deliveryRatingCount : 0,
      bySentiment,
      byRating,
      totalResponded,
      totalPublic,
      totalVerified,
    };
  }
}
