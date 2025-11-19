/**
 * Service - Gestion des Ventes
 * Module Ventes & Encaissements
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Sale, SaleItem, SalePayment, SalesStatistics } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    const sales = await airtableClient.list<Sale>('Sale', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({SaleDate}) = ${year})`,
    });

    const count = sales.length + 1;
    return `SAL-${year}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Génère un numéro de paiement unique
   */
  async generatePaymentNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const payments = await airtableClient.list<SalePayment>('SalePayment', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({PaymentDate}) = ${year})`,
    });

    const count = payments.length + 1;
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
    const sale: Partial<Sale> = {
      SaleId: saleId,
      SaleNumber: saleNumber,
      ClientId: input.clientId,
      ClientName: input.clientName,
      TotalAmount: totalAmount,
      AmountPaid: 0,
      Balance: totalAmount,
      Currency: input.currency || 'XOF',
      Status: 'draft',
      PaymentStatus: 'unpaid',
      SaleDate: input.saleDate,
      DueDate: input.dueDate,
      Notes: input.notes,
      SalesPersonId: input.salesPersonId,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdSale = await airtableClient.create<Sale>('Sale', sale);
    if (!createdSale) {
      throw new Error('Failed to create sale - Airtable not configured');
    }

    // Create sale items
    for (const item of input.items) {
      const saleItem: Partial<SaleItem> = {
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

      const createdItem = await airtableClient.create<SaleItem>('SaleItem', saleItem);
      if (!createdItem) {
        throw new Error('Failed to create sale item - Airtable not configured');
      }
    }

    return createdSale;
  }

  /**
   * Récupère une vente par ID avec ses items
   */
  async getById(saleId: string): Promise<(Sale & { items: SaleItem[] }) | null> {
    const sales = await airtableClient.list<Sale>('Sale', {
      filterByFormula: `{SaleId} = '${saleId}'`,
    });

    if (sales.length === 0) {
      return null;
    }

    const sale = sales[0];

    // Get items
    const items = await airtableClient.list<SaleItem>('SaleItem', {
      filterByFormula: `{SaleId} = '${saleId}'`,
    });

    return { ...sale, items };
  }

  /**
   * Liste toutes les ventes d'un workspace avec filtres
   */
  async list(workspaceId: string, filters: SaleFilters = {}): Promise<Sale[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }

    if (filters.paymentStatus) {
      filterFormulas.push(`{PaymentStatus} = '${filters.paymentStatus}'`);
    }

    if (filters.clientId) {
      filterFormulas.push(`{ClientId} = '${filters.clientId}'`);
    }

    if (filters.dateFrom) {
      filterFormulas.push(`{SaleDate} >= '${filters.dateFrom}'`);
    }

    if (filters.dateTo) {
      filterFormulas.push(`{SaleDate} <= '${filters.dateTo}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<Sale>('Sale', {
      filterByFormula,
      sort: [{ field: 'SaleDate', direction: 'desc' }],
    });
  }

  /**
   * Met à jour une vente
   */
  async update(saleId: string, input: UpdateSaleInput): Promise<Sale> {
    const sales = await airtableClient.list<Sale>('Sale', {
      filterByFormula: `{SaleId} = '${saleId}'`,
    });

    if (sales.length === 0) {
      throw new Error('Vente non trouvée');
    }

    const updates: Partial<Sale> = {
      ...input,
      UpdatedAt: new Date().toISOString(),
    };

    const updated = await airtableClient.update<Sale>(
      'Sale',
      (sales[0] as any)._recordId,
      updates
    );
    if (!updated) {
      throw new Error('Failed to update sale - Airtable not configured');
    }
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
    const payment: Partial<SalePayment> = {
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

    const createdPayment = await airtableClient.create<SalePayment>(
      'SalePayment',
      payment
    );
    if (!createdPayment) {
      throw new Error('Failed to create sale payment - Airtable not configured');
    }

    // Update sale amounts
    const newAmountPaid = sale.AmountPaid + input.amount;
    const newBalance = sale.Balance - input.amount;
    const newPaymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' =
      newBalance === 0 ? 'fully_paid' : 'partially_paid';

    await this.update(input.saleId, {
      status: 'confirmed', // Auto-confirm on payment
    });

    // Update amounts in database
    const sales = await airtableClient.list<Sale>('Sale', {
      filterByFormula: `{SaleId} = '${input.saleId}'`,
    });

    const updatedSale = await airtableClient.update<Sale>('Sale', (sales[0] as any)._recordId, {
      AmountPaid: newAmountPaid,
      Balance: newBalance,
      PaymentStatus: newPaymentStatus,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updatedSale) {
      throw new Error('Failed to update sale - Airtable not configured');
    }

    return createdPayment;
  }

  /**
   * Récupère tous les paiements d'une vente
   */
  async getPayments(saleId: string): Promise<SalePayment[]> {
    return await airtableClient.list<SalePayment>('SalePayment', {
      filterByFormula: `{SaleId} = '${saleId}'`,
      sort: [{ field: 'PaymentDate', direction: 'desc' }],
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
    const allItems = await airtableClient.list<SaleItem>('SaleItem', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
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
