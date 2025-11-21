/**
 * Service - Gestion des Ventes
 * Module Ventes & Encaissements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Sale, SaleItem, SalePayment, SalesStatistics } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateSaleInput {
  clientId?: string;
  clientName?: string;
  saleDate: string;
  dueDate?: string;
  notes?: string;
  currency?: string;
  salesPersonId: string;
  workspaceId: string;
  items: Array<{
    productId?: string;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface UpdateSaleInput {
  clientId?: string;
  clientName?: string;
  dueDate?: string;
  notes?: string;
  status?: 'draft' | 'confirmed' | 'cancelled';
}

export interface RecordPaymentInput {
  saleId: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'mobile_money' | 'check' | 'card' | 'other';
  paymentDate: string;
  walletId?: string;
  reference?: string;
  notes?: string;
  receivedById: string;
  workspaceId: string;
}

export interface SaleFilters {
  status?: string;
  paymentStatus?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Service de gestion des ventes
 */
export class SaleService {
  /**
   * Génère un numéro de vente unique
   */
  async generateSaleNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const sales = await postgresClient.list<Sale>('sales', {
      where: { workspace_id: workspaceId },
    });

    // Filter by year in application code
    const yearSales = sales.filter(s => {
      const saleYear = new Date(s.SaleDate).getFullYear();
      return saleYear === year;
    });

    const count = yearSales.length + 1;
    return `SAL-${year}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Génère un numéro de paiement unique
   */
  async generatePaymentNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const payments = await postgresClient.list<SalePayment>('sale_payments', {
      where: { workspace_id: workspaceId },
    });

    // Filter by year in application code
    const yearPayments = payments.filter(p => {
      const paymentYear = new Date(p.PaymentDate).getFullYear();
      return paymentYear === year;
    });

    const count = yearPayments.length + 1;
    return `PAY-${year}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Crée une nouvelle vente avec ses items
   */
  async create(input: CreateSaleInput): Promise<Sale> {
    // Calculate total
    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // Generate sale number
    const saleNumber = await this.generateSaleNumber(input.workspaceId);
    const saleId = uuidv4();

    // Create sale
    const sale = {
      SaleId: saleId,
      SaleNumber: saleNumber,
      ClientId: input.clientId,
      ClientName: input.clientName,
      TotalAmount: totalAmount,
      AmountPaid: 0,
      Balance: totalAmount,
      Currency: input.currency || 'XOF',
      Status: 'draft' as const,
      PaymentStatus: 'unpaid' as const,
      SaleDate: input.saleDate,
      DueDate: input.dueDate,
      Notes: input.notes,
      SalesPersonId: input.salesPersonId,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdSale = await postgresClient.create<Sale>('sales', sale);

    // Create sale items
    for (const item of input.items) {
      const saleItem = {
        SaleItemId: uuidv4(),
        SaleId: saleId,
        ProductId: item.productId,
        ProductName: item.productName,
        Description: item.description,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        TotalPrice: item.quantity * item.unitPrice,
        Currency: input.currency || 'XOF',
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      await postgresClient.create<SaleItem>('sale_items', saleItem);
    }

    return createdSale;
  }

  /**
   * Récupère une vente par ID avec ses items
   */
  async getById(saleId: string): Promise<(Sale & { items: SaleItem[] }) | null> {
    const sales = await postgresClient.list<Sale>('sales', {
      where: { sale_id: saleId },
    });

    if (sales.length === 0) {
      return null;
    }

    const sale = sales[0];

    // Get items
    const items = await postgresClient.list<SaleItem>('sale_items', {
      where: { sale_id: saleId },
    });

    return { ...sale, items };
  }

  /**
   * Liste toutes les ventes d'un workspace avec filtres
   */
  async list(workspaceId: string, filters: SaleFilters = {}): Promise<Sale[]> {
    const where: Record<string, any> = { workspace_id: workspaceId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentStatus) {
      where.payment_status = filters.paymentStatus;
    }

    if (filters.clientId) {
      where.client_id = filters.clientId;
    }

    let sales = await postgresClient.list<Sale>('sales', {
      where,
      orderBy: { field: 'sale_date', direction: 'desc' },
    });

    // Apply date filters in application code
    if (filters.dateFrom) {
      sales = sales.filter(s => s.SaleDate >= filters.dateFrom!);
    }

    if (filters.dateTo) {
      sales = sales.filter(s => s.SaleDate <= filters.dateTo!);
    }

    return sales;
  }

  /**
   * Met à jour une vente
   */
  async update(saleId: string, input: UpdateSaleInput): Promise<Sale> {
    const sales = await postgresClient.list<Sale>('sales', {
      where: { sale_id: saleId },
    });

    if (sales.length === 0) {
      throw new Error('Vente non trouvée');
    }

    if (!sales[0].id) {
      throw new Error('Vente ID manquant');
    }

    const updates: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };

    if (input.clientId !== undefined) updates.ClientId = input.clientId;
    if (input.clientName !== undefined) updates.ClientName = input.clientName;
    if (input.dueDate !== undefined) updates.DueDate = input.dueDate;
    if (input.notes !== undefined) updates.Notes = input.notes;
    if (input.status !== undefined) updates.Status = input.status;

    const updated = await postgresClient.update<Sale>(
      'sales',
      sales[0].id,
      updates
    );
    return updated;
  }

  /**
   * Confirme une vente (passe de draft à confirmed)
   */
  async confirm(saleId: string): Promise<Sale> {
    return await this.update(saleId, { status: 'confirmed' });
  }

  /**
   * Annule une vente
   */
  async cancel(saleId: string): Promise<Sale> {
    return await this.update(saleId, { status: 'cancelled' });
  }

  /**
   * Enregistre un paiement pour une vente
   */
  async recordPayment(input: RecordPaymentInput): Promise<SalePayment> {
    // Get sale
    const sale = await this.getById(input.saleId);
    if (!sale) {
      throw new Error('Vente non trouvée');
    }

    if (sale.Status === 'cancelled') {
      throw new Error('Impossible d\'enregistrer un paiement pour une vente annulée');
    }

    if (input.amount <= 0) {
      throw new Error('Le montant du paiement doit être positif');
    }

    if (input.amount > sale.Balance) {
      throw new Error('Le montant du paiement dépasse le solde restant');
    }

    // Generate payment number
    const paymentNumber = await this.generatePaymentNumber(input.workspaceId);

    // Create payment
    const payment = {
      PaymentId: uuidv4(),
      SaleId: input.saleId,
      PaymentNumber: paymentNumber,
      Amount: input.amount,
      PaymentMethod: input.paymentMethod,
      PaymentDate: input.paymentDate,
      WalletId: input.walletId,
      Reference: input.reference,
      Notes: input.notes,
      ReceivedById: input.receivedById,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdPayment = await postgresClient.create<SalePayment>(
      'sale_payments',
      payment
    );

    // Update sale amounts
    const newAmountPaid = sale.AmountPaid + input.amount;
    const newBalance = sale.Balance - input.amount;
    const newPaymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' =
      newBalance === 0 ? 'fully_paid' : 'partially_paid';

    await this.update(input.saleId, {
      status: 'confirmed', // Auto-confirm on payment
    });

    // Update amounts in database
    const sales = await postgresClient.list<Sale>('sales', {
      where: { sale_id: input.saleId },
    });

    if (!sales[0].id) {
      throw new Error('Vente ID manquant');
    }

    await postgresClient.update<Sale>('sales', sales[0].id, {
      AmountPaid: newAmountPaid,
      Balance: newBalance,
      PaymentStatus: newPaymentStatus,
      UpdatedAt: new Date().toISOString(),
    });

    return createdPayment;
  }

  /**
   * Récupère tous les paiements d'une vente
   */
  async getPayments(saleId: string): Promise<SalePayment[]> {
    return await postgresClient.list<SalePayment>('sale_payments', {
      where: { sale_id: saleId },
      orderBy: { field: 'payment_date', direction: 'desc' },
    });
  }

  /**
   * Récupère les statistiques des ventes
   */
  async getStatistics(workspaceId: string): Promise<SalesStatistics> {
    const sales = await this.list(workspaceId);

    const totalRevenue = sales.reduce((sum, sale) => {
      if (sale.Status !== 'cancelled') {
        return sum + sale.TotalAmount;
      }
      return sum;
    }, 0);

    const totalPaid = sales.reduce((sum, sale) => {
      if (sale.Status !== 'cancelled') {
        return sum + sale.AmountPaid;
      }
      return sum;
    }, 0);

    const totalUnpaid = totalRevenue - totalPaid;

    const activeSales = sales.filter((s) => s.Status !== 'cancelled');
    const paidSales = activeSales.filter((s) => s.PaymentStatus === 'fully_paid');
    const unpaidSales = activeSales.filter(
      (s) => s.PaymentStatus === 'unpaid' || s.PaymentStatus === 'partially_paid'
    );

    const averageSaleAmount = activeSales.length > 0 ? totalRevenue / activeSales.length : 0;

    // Get all sale items for top products
    const allItems = await postgresClient.list<SaleItem>('sale_items', {
      where: { workspace_id: workspaceId },
    });

    // Calculate top products
    const productStats = new Map<
      string,
      { quantity: number; revenue: number }
    >();

    for (const item of allItems) {
      const existing = productStats.get(item.ProductName) || {
        quantity: 0,
        revenue: 0,
      };
      productStats.set(item.ProductName, {
        quantity: existing.quantity + item.Quantity,
        revenue: existing.revenue + item.TotalPrice,
      });
    }

    const topProducts = Array.from(productStats.entries())
      .map(([productName, stats]) => ({
        productName,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Calculate top clients
    const clientStats = new Map<
      string,
      { salesCount: number; totalRevenue: number }
    >();

    for (const sale of activeSales) {
      const clientName = sale.ClientName || 'Client anonyme';
      const existing = clientStats.get(clientName) || {
        salesCount: 0,
        totalRevenue: 0,
      };
      clientStats.set(clientName, {
        salesCount: existing.salesCount + 1,
        totalRevenue: existing.totalRevenue + sale.TotalAmount,
      });
    }

    const topClients = Array.from(clientStats.entries())
      .map(([clientName, stats]) => ({
        clientName,
        salesCount: stats.salesCount,
        totalRevenue: stats.totalRevenue,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    return {
      totalSales: activeSales.length,
      totalRevenue,
      totalPaid,
      totalUnpaid,
      averageSaleAmount,
      salesCount: activeSales.length,
      paidSalesCount: paidSales.length,
      unpaidSalesCount: unpaidSales.length,
      topProducts,
      topClients,
    };
  }
}
