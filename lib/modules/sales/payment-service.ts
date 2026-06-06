/**
 * Service - Gestion des Paiements
 * Module Ventes & Encaissements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { SalePayment as Payment } from '@/types/modules';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { generatePaymentNumber } from '@/lib/modules/sales/document-numbers';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();
const paymentMethodService = new PaymentMethodService();

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
   * Créer un nouveau paiement.
   * Depuis 2c : on écrit uniquement `payment_method_id` (FK UUID vers
   * `payment_methods`). La colonne `payment_method` (enum) a été supprimée.
   */
  async create(input: CreatePaymentInput): Promise<Payment> {
    const paymentNumber = await this.generatePaymentNumber(input.workspaceId);

    const pm = await paymentMethodService.getByCode(input.workspaceId, input.paymentMethod);
    if (!pm?.Id) {
      throw new Error(`Moyen de paiement "${input.paymentMethod}" introuvable ou inactif dans ce workspace.`);
    }

    const payment: any = {
      PaymentId: uuidv4(),
      PaymentNumber: paymentNumber,
      SaleId: input.saleId,
      Amount: input.amount,
      PaymentMethodId: pm.Id,
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
    // Délégué au helper partagé — une seule séquence PAY-<année> par
    // workspace, quel que soit le chemin d'encaissement.
    return generatePaymentNumber(workspaceId);
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
      // Le filtre arrive en code fonctionnel ; on résout en UUID.
      const pm = await paymentMethodService.getByCode(workspaceId, filters.paymentMethod);
      if (!pm?.Id) return []; // code inconnu ou inactif → aucun match
      where.payment_method_id = pm.Id;
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

    // Agrégation par code fonctionnel (résolu depuis payment_method_id).
    const allMethods = await paymentMethodService.list(workspaceId);
    const codeByUuid = new Map<string, string>();
    allMethods.forEach(m => { if (m.Id) codeByUuid.set(m.Id, m.Code); });

    const byMethod: Record<string, { count: number; amount: number }> = {};
    payments.forEach((p: any) => {
      const code = codeByUuid.get(p.PaymentMethodId) || 'unknown';
      if (!byMethod[code]) byMethod[code] = { count: 0, amount: 0 };
      byMethod[code].count += 1;
      byMethod[code].amount += p.Amount;
    });

    return {
      totalAmount,
      paymentCount: payments.length,
      byMethod,
    };
  }
}
