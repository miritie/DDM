/**
 * Service - Gestion des Ventes
 * Module Ventes & Encaissements
 *
 * Toute vente est désormais rattachée à un outlet (point de vente) et — si possible —
 * à une session POS. Le prix de chaque ligne est résolu via OutletService.resolvePrice
 * (prix outlet > prix type d'outlet) ; la vente est bloquée si aucun prix valide.
 * Le stock outlet est décrémenté à la création.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Sale, SaleItem, SalePayment, SalesStatistics } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { OutletService } from '@/lib/modules/outlets/outlet-service';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';
import { StockService } from '@/lib/modules/stock/stock-service';

const postgresClient = getPostgresClient();
const outletService = new OutletService();
const posSessionService = new PosSessionService();
const stockService = new StockService();

export interface CreateSaleInput {
  clientId?: string;
  clientName?: string;
  saleDate: string;
  dueDate?: string;
  notes?: string;
  currency?: string;
  salesPersonId: string;
  workspaceId: string;
  /** Outlet où la vente est faite. Requis. */
  outletId?: string;
  /** Session POS active (optionnel — si absent, ouverture implicite). */
  posSessionId?: string;
  items: Array<{
    productId?: string;
    productName: string;
    description?: string;
    quantity: number;
    /** Si fourni, doit correspondre au prix résolu par l'outlet — sinon ignoré. */
    unitPrice?: number;
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
   * Crée une nouvelle vente avec ses items.
   *
   * Pré-conditions :
   *   - input.outletId requis
   *   - chaque item.productId doit avoir un prix outlet/type valide à la date de la vente
   *   - le stock outlet doit être suffisant pour chaque produit
   */
  async create(input: CreateSaleInput): Promise<Sale> {
    if (!input.outletId) {
      throw new Error('outletId est obligatoire — toute vente doit être rattachée à un point de vente.');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('Au moins un article est requis');
    }

    // 1. Résoudre le prix de chaque ligne via OutletService (refuse si non listé)
    const resolvedLines: Array<{
      productId: string;
      productName: string;
      description?: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    const saleDateForPrice = input.saleDate.slice(0, 10);
    for (const item of input.items) {
      if (!item.productId) {
        throw new Error(`Article sans productId — un product_id est requis pour résoudre le prix`);
      }
      const price = await outletService.resolvePrice(item.productId, input.outletId, saleDateForPrice);
      if (!price) {
        throw new Error(
          `Aucun prix défini pour ${item.productName} sur ce point de vente à la date du ${saleDateForPrice}`
        );
      }
      resolvedLines.push({
        productId: item.productId,
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(price.UnitPrice),
      });
    }

    // 2. Garantir une session POS (implicite si absente)
    let posSessionId = input.posSessionId;
    if (!posSessionId) {
      const session = await posSessionService.ensureForSale(
        input.outletId, input.salesPersonId, input.workspaceId
      );
      posSessionId = session.id!;
    }

    // 3. Calcul du total
    const totalAmount = resolvedLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

    // 4. Numéro de vente + insertion
    const saleNumber = await this.generateSaleNumber(input.workspaceId);
    const saleUuid = uuidv4();

    const r = await postgresClient.query(
      `INSERT INTO sales
        (sale_id, sale_number, client_id, client_name,
         total_amount, amount_paid, balance, currency,
         status, payment_status, sale_date, due_date, notes,
         sales_person_id, outlet_id, pos_session_id, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        saleUuid,
        saleNumber,
        input.clientId ?? null,
        input.clientName ?? null,
        totalAmount,
        0,
        totalAmount,
        input.currency || 'XOF',
        'draft',
        'unpaid',
        input.saleDate,
        input.dueDate ?? null,
        input.notes ?? null,
        input.salesPersonId,
        input.outletId,
        posSessionId,
        input.workspaceId,
      ]
    );
    const saleRowId = r.rows[0].id as string;

    // 5. Items + décrément stock outlet
    for (const line of resolvedLines) {
      await postgresClient.query(
        `INSERT INTO sale_items
          (sale_item_id, sale_id, product_id, product_name, description,
           quantity, unit_price, total_price, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          uuidv4(),
          saleRowId,
          line.productId,
          line.productName,
          line.description ?? null,
          line.quantity,
          line.unitPrice,
          line.quantity * line.unitPrice,
          input.currency || 'XOF',
        ]
      );

      await stockService.decreaseStockOutlet(line.productId, input.outletId, line.quantity);
    }

    // 6. Renvoyer la vente créée (re-fetch pour mapper proprement)
    const created = await postgresClient.list<Sale>('sales', { where: { id: saleRowId } });
    return created[0];
  }

  /**
   * Récupère une vente par ID avec ses items
   */
  async getById(saleIdOrUuid: string): Promise<(Sale & { items: SaleItem[] }) | null> {
    // Accepte UUID PK ou slug `sale_id` VARCHAR
    const isUuid = /^[0-9a-f-]{36}$/i.test(saleIdOrUuid);
    const sales = await postgresClient.list<Sale>('sales', {
      where: isUuid ? { id: saleIdOrUuid } : { sale_id: saleIdOrUuid },
    });

    if (sales.length === 0) {
      return null;
    }

    const sale = sales[0];

    // Get items via la PK UUID (même clé pour ce qui suit)
    const items = await postgresClient.list<SaleItem>('sale_items', {
      where: { sale_id: sale.id! },
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

    // Résolution slug → UUID pour received_by_id (FK vers users.id)
    let receivedByUuid: string = input.receivedById;
    if (!/^[0-9a-f-]{36}$/i.test(input.receivedById)) {
      const ur = await postgresClient.query(
        `SELECT id FROM users WHERE user_id = $1 OR email = $1 LIMIT 1`,
        [input.receivedById]
      );
      if (ur.rows.length === 0) throw new Error('Utilisateur receveur introuvable');
      receivedByUuid = ur.rows[0].id;
    }

    // Résolution walletId si fourni en slug
    let walletUuid = input.walletId;
    if (walletUuid && !/^[0-9a-f-]{36}$/i.test(walletUuid)) {
      const wr = await postgresClient.query(
        `SELECT id FROM wallets WHERE wallet_id = $1 LIMIT 1`,
        [walletUuid]
      );
      walletUuid = wr.rows[0]?.id ?? undefined;
    }

    // Create payment
    const payment = {
      PaymentId: uuidv4(),
      SaleId: input.saleId,
      PaymentNumber: paymentNumber,
      Amount: input.amount,
      PaymentMethod: input.paymentMethod,
      PaymentDate: input.paymentDate,
      WalletId: walletUuid,
      Reference: input.reference,
      Notes: input.notes,
      ReceivedById: receivedByUuid,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdPayment = await postgresClient.create<SalePayment>(
      'sale_payments',
      payment
    );

    // Update sale amounts via la PK UUID (sale.id), pas le slug
    const newAmountPaid = Number(sale.AmountPaid) + Number(input.amount);
    const newBalance = Number(sale.Balance) - Number(input.amount);
    const newPaymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' =
      newBalance === 0 ? 'fully_paid' : 'partially_paid';

    if (!sale.id) {
      throw new Error('Vente ID manquant');
    }

    // Mise à jour directe (status confirmé + montants en une requête)
    await postgresClient.query(
      `UPDATE sales
       SET amount_paid = $2, balance = $3, payment_status = $4,
           status = CASE WHEN status = 'draft' THEN 'confirmed' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sale.id, newAmountPaid, newBalance, newPaymentStatus]
    );

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
