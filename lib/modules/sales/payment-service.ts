/**
 * Service - Gestion des Paiements
 * Module Ventes & Encaissements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { SalePayment as Payment } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

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

    const payment = {
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

    const created = await postgresClient.create<Payment>('sale_payments', payment);
    return created;
  }

  /**
   * Générer un numéro de paiement (PAY-2025-0001)
   */
  async generatePaymentNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const payments = await postgresClient.list<Payment>('sale_payments', {
      where: { workspace_id: workspaceId },
    });

    // Filter by year in application code
    const yearPayments = payments.filter(p => {
      const paymentYear = new Date(p.PaymentDate).getFullYear();
      return paymentYear === year;
    });

    return `PAY-${year}-${String(yearPayments.length + 1).padStart(4, '0')}`;
  }

  /**
   * Récupérer un paiement par ID
   */
  async getById(paymentId: string): Promise<Payment | null> {
    const payments = await postgresClient.list<Payment>('sale_payments', {
      where: { payment_id: paymentId },
    });
    return payments.length > 0 ? payments[0] : null;
  }

  /**
   * Lister les paiements d'une vente
   */
  async getBySaleId(saleId: string): Promise<Payment[]> {
    return await postgresClient.list<Payment>('sale_payments', {
      where: { sale_id: saleId },
      orderBy: { field: 'payment_date', direction: 'desc' },
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
    const where: Record<string, any> = { workspace_id: workspaceId };

    if (filters.paymentMethod) {
      where.payment_method = filters.paymentMethod;
    }

    let payments = await postgresClient.list<Payment>('sale_payments', {
      where,
      orderBy: { field: 'payment_date', direction: 'desc' },
    });

    // Apply date filters in application code
    if (filters.startDate) {
      payments = payments.filter(p => p.PaymentDate >= filters.startDate!);
    }
    if (filters.endDate) {
      payments = payments.filter(p => p.PaymentDate <= filters.endDate!);
    }

    return payments;
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
