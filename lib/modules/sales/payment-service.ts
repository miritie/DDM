/**
 * Service - Gestion des Paiements
 * Module Ventes & Encaissements
 */

import { AirtableClient } from '@/lib/airtable/client';
import { SalePayment as Payment } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreatePaymentInput {
  saleId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'check' | 'mobile_money';
  paymentDate: string;
  reference?: string;
  notes?: string;
  workspaceId: string;
  receivedById: string;
}

export class PaymentService {
  /**
   * Créer un nouveau paiement
   */
  async create(input: CreatePaymentInput): Promise<Payment> {
    const paymentNumber = await this.generatePaymentNumber(input.workspaceId);

    const payment: Partial<Payment> = {
      PaymentId: uuidv4(),
      PaymentNumber: paymentNumber,
      SaleId: input.saleId,
      Amount: input.amount,
      PaymentMethod: input.paymentMethod,
      PaymentDate: input.paymentDate,
      Reference: input.reference,
      Notes: input.notes,
      ReceivedById: input.receivedById,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<Payment>('SalePayment', payment);
    if (!created) {
      throw new Error('Failed to create payment - Airtable not configured');
    }
    return created;
  }

  /**
   * Générer un numéro de paiement (PAY-2025-0001)
   */
  async generatePaymentNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const payments = await airtableClient.list<Payment>('SalePayment', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({PaymentDate}) = ${year})`,
    });

    return `PAY-${year}-${String(payments.length + 1).padStart(4, '0')}`;
  }

  /**
   * Récupérer un paiement par ID
   */
  async getById(paymentId: string): Promise<Payment | null> {
    const payments = await airtableClient.list<Payment>('SalePayment', {
      filterByFormula: `{PaymentId} = '${paymentId}'`,
    });
    return payments.length > 0 ? payments[0] : null;
  }

  /**
   * Lister les paiements d'une vente
   */
  async getBySaleId(saleId: string): Promise<Payment[]> {
    return await airtableClient.list<Payment>('SalePayment', {
      filterByFormula: `{SaleId} = '${saleId}'`,
      sort: [{ field: 'PaymentDate', direction: 'desc' }],
    });
  }

  /**
   * Lister tous les paiements
   */
  async list(workspaceId: string, filters: {
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
  } = {}): Promise<Payment[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.startDate) {
      filterFormulas.push(`{PaymentDate} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{PaymentDate} <= '${filters.endDate}'`);
    }
    if (filters.paymentMethod) {
      filterFormulas.push(`{PaymentMethod} = '${filters.paymentMethod}'`);
    }

    const filterByFormula = filterFormulas.length > 1
      ? `AND(${filterFormulas.join(', ')})`
      : filterFormulas[0];

    return await airtableClient.list<Payment>('SalePayment', {
      filterByFormula,
      sort: [{ field: 'PaymentDate', direction: 'desc' }],
    });
  }

  /**
   * Statistiques des paiements
   */
  async getStatistics(workspaceId: string, startDate?: string, endDate?: string): Promise<{
    totalAmount: number;
    paymentCount: number;
    byMethod: Record<string, { count: number; amount: number }>;
  }> {
    const payments = await this.list(workspaceId, { startDate, endDate });

    const totalAmount = payments.reduce((sum, p) => sum + p.Amount, 0);

    const byMethod: Record<string, { count: number; amount: number }> = {};
    payments.forEach(p => {
      if (!byMethod[p.PaymentMethod]) {
        byMethod[p.PaymentMethod] = { count: 0, amount: 0 };
      }
      byMethod[p.PaymentMethod].count += 1;
      byMethod[p.PaymentMethod].amount += p.Amount;
    });

    return {
      totalAmount,
      paymentCount: payments.length,
      byMethod,
    };
  }
}
