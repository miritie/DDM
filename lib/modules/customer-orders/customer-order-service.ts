/**
 * Service - Commandes Clients Négociées
 *
 * Workflow :
 *   draft → submitted → approved → in_production → produced → transferred → delivered → completed
 *   À tout moment : cancelled
 *
 * - draft : saisie par le manager commercial
 * - submitted : envoyée pour validation
 * - approved : validée par l'administrateur
 * - in_production : un production_order a été lancé
 * - produced : production terminée
 * - transferred : stock transféré vers l'entrepôt destination
 * - delivered : livrée au client
 * - completed : intégralement payée et soldée → génère la sale
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { v4 as uuidv4 } from 'uuid';
import { assertPositiveFinishedProductQuantity } from '@/lib/schemas/quantity';

const db = getPostgresClient();
const paymentMethodService = new PaymentMethodService();
const transactionService = new TransactionService();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CustomerOrderStatus =
  | 'draft' | 'submitted' | 'approved' | 'in_production'
  | 'produced' | 'transferred' | 'delivered' | 'completed' | 'cancelled';

export interface CreateCustomerOrderInput {
  workspaceId: string;
  clientId?: string | null;
  clientName?: string;
  clientPhone?: string;
  totalAmount: number;
  notes?: string;
  requestedDeliveryDate?: string;
  destinationWarehouseId?: string;
  destinationOutletId?: string;
  requestedById: string;       // user_id slug ou UUID
  lines: Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }>;
  initialAdvance?: { amount: number; paymentMethod: string; walletId?: string };
}

async function resolveUuid(table: string, slugCol: string | null, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  // Toujours vérifier l'existence en base. Accepte : UUID PK, slug business code,
  // ou UUID stocké à tort dans le slug column (bug data historique sur certaines
  // tables). Un UUID au format valide mais inexistant retourne null — évite la
  // propagation d'un id corrompu jusqu'à la FK.
  const where = slugCol ? `id::text = $1 OR ${slugCol} = $1` : `id::text = $1`;
  const r = await db.query(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, [value]);
  return r.rows[0]?.id ?? null;
}

export class CustomerOrderService {

  // -------------------------------------------------------------------------

  async generateOrderNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const r = await db.query(
      `SELECT COUNT(*) AS c FROM customer_orders
       WHERE workspace_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
      [workspaceId, year]
    );
    return `CMD-${year}-${String(parseInt(r.rows[0].c, 10) + 1).padStart(4, '0')}`;
  }

  // -------------------------------------------------------------------------
  // CREATE

  async create(input: CreateCustomerOrderInput): Promise<any> {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Au moins une ligne de produit est requise');
    }

    // Résolution slugs → UUIDs
    const requestedByUuid = await resolveUuid('users', 'user_id', input.requestedById);
    if (!requestedByUuid) throw new Error('Utilisateur demandeur introuvable');

    const clientUuid = await resolveUuid('clients', 'client_id', input.clientId);
    const warehouseUuid = await resolveUuid('warehouses', 'warehouse_id', input.destinationWarehouseId);
    const outletUuid = await resolveUuid('outlets', 'code', input.destinationOutletId);

    // Résolution products + calcul total
    const lines = await Promise.all(input.lines.map(async (l) => {
      const productUuid = await resolveUuid('products', 'product_id', l.productId);
      if (!productUuid) throw new Error(`Produit introuvable : ${l.productId}`);
      const p = await db.query(`SELECT name FROM products WHERE id = $1`, [productUuid]);
      const qty = assertPositiveFinishedProductQuantity(l.quantity, `Quantité pour ${l.productId}`);
      const price = Number(l.unitPrice);
      return {
        productUuid,
        productName: p.rows[0].name,
        quantity: qty,
        unitPrice: price,
        lineTotal: qty * price,
        notes: l.notes ?? null,
      };
    }));

    const computedTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const total = Number(input.totalAmount) || computedTotal;
    const advance = Number(input.initialAdvance?.amount) || 0;

    const orderNumber = await this.generateOrderNumber(input.workspaceId);
    const orderId = `CO-${uuidv4().slice(0, 8)}`;

    // Insert avec amount_paid=0 et balance=total : l'éventuelle avance est
    // enregistrée juste après via recordPayment qui se charge d'incrémenter
    // amount_paid et de décrémenter balance. Sinon on double-compte l'avance
    // (INSERT met advance dans amount_paid, puis recordPayment ajoute encore advance).
    const inserted = await db.query(
      `INSERT INTO customer_orders
        (order_id, order_number, client_id, client_name, client_phone,
         total_amount, amount_paid, balance, currency, status,
         requested_delivery_date, destination_warehouse_id, destination_outlet_id,
         notes, requested_by_id, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,'XOF','draft',$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        orderId, orderNumber, clientUuid,
        input.clientName ?? null, input.clientPhone ?? null,
        total, total,
        input.requestedDeliveryDate ?? null,
        warehouseUuid,
        outletUuid,
        input.notes ?? null, requestedByUuid, input.workspaceId,
      ]
    );
    const order = inserted.rows[0];

    // Lignes
    for (const l of lines) {
      await db.query(
        `INSERT INTO customer_order_lines
          (customer_order_id, product_id, product_name, quantity, unit_price, line_total, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, l.productUuid, l.productName, l.quantity, l.unitPrice, l.lineTotal, l.notes]
      );
    }

    // Avance si fournie : recordPayment met à jour amount_paid + balance.
    if (advance > 0 && input.initialAdvance) {
      await this.recordPayment(order.id, {
        amount: advance,
        paymentMethod: input.initialAdvance.paymentMethod,
        walletId: input.initialAdvance.walletId,
        receivedById: requestedByUuid,
        workspaceId: input.workspaceId,
        isAdvance: true,
        notes: 'Avance versée à la création',
      });
    }

    return await this.getById(order.id);
  }

  // -------------------------------------------------------------------------
  // READ

  async getById(idOrSlug: string): Promise<any | null> {
    const isUuid = UUID_RE.test(idOrSlug);
    const r = await db.query(
      `SELECT co.*,
              c.name AS client_full_name,
              ru.full_name AS requested_by_name,
              ru.user_id  AS requested_by_user_id,
              au.full_name AS approved_by_name,
              po.order_number AS production_order_number,
              s.sale_number AS sale_number_linked
       FROM customer_orders co
       LEFT JOIN clients c ON c.id = co.client_id
       LEFT JOIN users ru ON ru.id = co.requested_by_id
       LEFT JOIN users au ON au.id = co.approved_by_id
       LEFT JOIN production_orders po ON po.id = co.production_order_id
       LEFT JOIN sales s ON s.id = co.sale_id
       WHERE ${isUuid ? 'co.id = $1' : 'co.order_id = $1'}
       LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) return null;
    const order = r.rows[0];

    const lines = await db.query(
      `SELECT col.*, p.code AS product_code
       FROM customer_order_lines col
       JOIN products p ON p.id = col.product_id
       WHERE customer_order_id = $1 ORDER BY col.created_at`,
      [order.id]
    );
    const payments = await db.query(
      `SELECT cop.*,
              pm.code AS payment_method,
              pm.label AS payment_method_label,
              u.full_name AS received_by_name,
              w.name AS wallet_name
       FROM customer_order_payments cop
       LEFT JOIN payment_methods pm ON pm.id = cop.payment_method_id
       LEFT JOIN users u ON u.id = cop.received_by_id
       LEFT JOIN wallets w ON w.id = cop.wallet_id
       WHERE customer_order_id = $1 ORDER BY payment_date DESC`,
      [order.id]
    );

    return { ...order, lines: lines.rows, payments: payments.rows };
  }

  async list(workspaceId: string, filters: { status?: CustomerOrderStatus; clientId?: string } = {}): Promise<any[]> {
    const params: any[] = [workspaceId];
    let sql = `SELECT co.*, c.name AS client_full_name, ru.full_name AS requested_by_name,
                      (SELECT COUNT(*) FROM customer_order_lines WHERE customer_order_id = co.id) AS line_count
               FROM customer_orders co
               LEFT JOIN clients c ON c.id = co.client_id
               LEFT JOIN users ru ON ru.id = co.requested_by_id
               WHERE co.workspace_id = $1`;
    if (filters.status)   { params.push(filters.status);   sql += ` AND co.status = $${params.length}`; }
    if (filters.clientId) { params.push(filters.clientId); sql += ` AND co.client_id = $${params.length}`; }
    sql += ` ORDER BY co.created_at DESC`;
    const r = await db.query(sql, params);
    return r.rows;
  }

  // -------------------------------------------------------------------------
  // STATE TRANSITIONS

  async setStatus(idOrSlug: string, status: CustomerOrderStatus, extras: Record<string, any> = {}): Promise<any> {
    const sets = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [idOrSlug, status];
    for (const [k, v] of Object.entries(extras)) {
      params.push(v);
      sets.push(`${k} = $${params.length}`);
    }
    // Accepte UUID interne OU business code (order_id 'CO-xxxxxxxx')
    await db.query(
      `UPDATE customer_orders SET ${sets.join(', ')} WHERE id::text = $1 OR order_id = $1`,
      params
    );
    return await this.getById(idOrSlug);
  }

  /**
   * Manager commercial soumet sa commande au décideur (draft → submitted).
   * Seule étape légitime depuis 'draft' : l'approbation par l'admin n'est plus possible
   * en raccourci.
   */
  async submit(id: string): Promise<any> {
    const order = await this.getById(id);
    if (!order) throw new Error('Commande introuvable');
    if (order.status !== 'draft') {
      throw new Error(`Seul un brouillon peut être soumis (statut actuel : ${order.status})`);
    }
    return this.setStatus(id, 'submitted');
  }

  /**
   * Admin approuve une commande soumise (submitted → approved).
   * Refuse les raccourcis depuis 'draft' : le manager doit explicitement soumettre avant.
   */
  async approve(id: string, approvedById: string): Promise<any> {
    const order = await this.getById(id);
    if (!order) throw new Error('Commande introuvable');
    if (order.status !== 'submitted') {
      throw new Error(`Seule une commande soumise peut être approuvée (statut actuel : ${order.status}). Le manager doit d'abord la soumettre.`);
    }
    const approverUuid = await resolveUuid('users', 'user_id', approvedById);
    // Séparation des pouvoirs : l'approbateur ne peut pas être le requester
    // (l'utilisateur qui a soumis la commande). Même si l'UI le cache, on
    // refuse côté serveur — défense en profondeur contre un appel direct.
    if (approverUuid === order.requested_by_id) {
      throw new Error('Vous ne pouvez pas approuver une commande que vous avez soumise. Un autre administrateur doit le faire (séparation des pouvoirs).');
    }
    return this.setStatus(id, 'approved', {
      approved_by_id: approverUuid,
      approved_at: new Date().toISOString(),
    });
  }

  async cancel(id: string, reason?: string): Promise<any> {
    const order = await this.getById(id);
    if (!order) throw new Error('Commande introuvable');
    if (['delivered', 'completed', 'cancelled'].includes(order.status)) {
      throw new Error(`Impossible d'annuler une commande au statut ${order.status}`);
    }
    return this.setStatus(id, 'cancelled', { notes: reason ? `${order.notes ?? ''}\n[ANNULÉE] ${reason}`.trim() : order.notes });
  }

  /** Lie un production_order à la commande et passe en in_production. */
  async linkProduction(id: string, productionOrderId: string): Promise<any> {
    return this.setStatus(id, 'in_production', { production_order_id: productionOrderId });
  }

  async markProduced(id: string): Promise<any> {
    return this.setStatus(id, 'produced');
  }

  async markTransferred(id: string): Promise<any> {
    return this.setStatus(id, 'transferred');
  }

  async markDelivered(id: string): Promise<any> {
    return this.setStatus(id, 'delivered');
  }

  // -------------------------------------------------------------------------
  // PAYMENTS

  async recordPayment(id: string, input: {
    amount: number; paymentMethod: string; walletId?: string;
    receivedById: string; workspaceId: string; isAdvance?: boolean; notes?: string;
  }): Promise<any> {
    const order = await this.getById(id);
    if (!order) throw new Error('Commande introuvable');

    const amt = Number(input.amount);
    if (amt <= 0) throw new Error('Montant invalide');
    if (amt > Number(order.balance)) {
      throw new Error(`Le montant dépasse le solde dû (${order.balance})`);
    }

    const walletUuid = await resolveUuid('wallets', 'wallet_id', input.walletId);
    const receivedByUuid = await resolveUuid('users', 'user_id', input.receivedById);

    // Résolution payment_method_id depuis le code fonctionnel (table payment_methods).
    const pm = await paymentMethodService.getByCode(input.workspaceId, input.paymentMethod);
    if (!pm?.Id) {
      throw new Error(`Moyen de paiement "${input.paymentMethod}" introuvable ou inactif dans ce workspace.`);
    }

    await db.query(
      `INSERT INTO customer_order_payments
        (customer_order_id, amount, payment_method_id, wallet_id, received_by_id,
         is_advance, notes, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [order.id, amt, pm.Id, walletUuid, receivedByUuid,
       input.isAdvance ?? false, input.notes ?? null, input.workspaceId]
    );

    const newPaid = Number(order.amount_paid) + amt;
    const newBalance = Number(order.total_amount) - newPaid;

    await db.query(
      `UPDATE customer_orders SET amount_paid = $2, balance = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [order.id, newPaid, newBalance]
    );

    // Si livrée et soldée → completed
    if (order.status === 'delivered' && newBalance === 0) {
      await this.setStatus(id, 'completed');
    }

    // Crédite le wallet pour que l'encaissement apparaisse dans la
    // trésorerie du comptable (KPI Revenus + liste transactions). Skip
    // silencieusement si pas de wallet rattaché (paiement non-traçable
    // ex. main à main). NB : finalizeAsSale recopie ces paiements vers
    // sale_payments mais ne doit PAS créer de nouvelle transaction —
    // l'encaissement physique a lieu ici, une seule fois.
    if (walletUuid && receivedByUuid) {
      try {
        await transactionService.createIncome({
          type: 'income',
          category: 'sale',
          amount: amt,
          destinationWalletId: walletUuid,
          description: `Encaissement commande ${order.order_number}${input.isAdvance ? ' (avance)' : ''}`,
          reference: order.order_number,
          processedById: receivedByUuid,
          workspaceId: input.workspaceId,
        });
      } catch (e: any) {
        console.error('[customer-order recordPayment] Transaction wallet non créée :', e?.message);
      }
    }

    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // FINALIZE → génère une sale liée

  async finalizeAsSale(id: string, options: { outletId: string; salesPersonId: string }): Promise<any> {
    const order = await this.getById(id);
    if (!order) throw new Error('Commande introuvable');
    if (order.sale_id) {
      return order; // déjà finalisée
    }

    const sellerUuid = await resolveUuid('users', 'user_id', options.salesPersonId);
    if (!sellerUuid) throw new Error('Vendeur introuvable');

    const year = new Date().getFullYear();
    const c = await db.query(
      `SELECT COUNT(*) AS c FROM sales WHERE workspace_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
      [order.workspace_id, year]
    );
    const saleNumber = `VT-${year}-${String(parseInt(c.rows[0].c, 10) + 1).padStart(4, '0')}`;
    const saleUuid = uuidv4();

    const paymentStatus =
      Number(order.balance) === 0 ? 'fully_paid' :
      Number(order.amount_paid) > 0 ? 'partially_paid' : 'unpaid';

    const sale = await db.query(
      `INSERT INTO sales
        (sale_id, sale_number, client_id, client_name,
         total_amount, amount_paid, balance, currency, status, payment_status,
         sale_date, notes, sales_person_id, outlet_id, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'XOF','confirmed',$8,
               CURRENT_DATE,$9,$10,$11,$12)
       RETURNING *`,
      [
        saleUuid, saleNumber, order.client_id,
        order.client_full_name || order.client_name,
        order.total_amount, order.amount_paid, order.balance,
        paymentStatus, `Issue de la commande ${order.order_number}`,
        sellerUuid, options.outletId, order.workspace_id,
      ]
    );

    // Items
    for (const l of order.lines) {
      await db.query(
        `INSERT INTO sale_items
          (sale_item_id, sale_id, product_id, product_name, quantity, unit_price, total_price, currency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'XOF')`,
        [uuidv4(), sale.rows[0].id, l.product_id, l.product_name, l.quantity, l.unit_price, l.line_total]
      );
    }

    // Reporte les paiements de la commande sur la sale (sale_payments).
    // Le payment_method_id de chaque ligne customer_order_payments est repris tel quel.
    for (const p of order.payments) {
      await db.query(
        `INSERT INTO sale_payments
          (payment_id, sale_id, payment_number, amount, payment_method_id, payment_date,
           wallet_id, received_by_id, workspace_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          uuidv4(), sale.rows[0].id, `PAY-${Date.now()}`,
          p.amount, p.payment_method_id, p.payment_date,
          p.wallet_id, p.received_by_id, order.workspace_id,
          `Reporté depuis commande ${order.order_number}${p.is_advance ? ' (avance)' : ''}`,
        ]
      );
    }

    await this.setStatus(id, 'completed', { sale_id: sale.rows[0].id });
    return this.getById(id);
  }

  // -------------------------------------------------------------------------
  // STATS

  async getStats(workspaceId: string): Promise<any> {
    const r = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'draft') AS drafts,
         COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
         COUNT(*) FILTER (WHERE status IN ('approved', 'in_production', 'produced', 'transferred')) AS in_progress,
         COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_unpaid,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COALESCE(SUM(balance) FILTER (WHERE status NOT IN ('cancelled', 'completed')), 0) AS outstanding_amount,
         COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled', 'completed')), 0) AS in_progress_amount
       FROM customer_orders WHERE workspace_id = $1`,
      [workspaceId]
    );
    const row = r.rows[0];
    return {
      drafts: Number(row.drafts),
      submitted: Number(row.submitted),
      inProgress: Number(row.in_progress),
      deliveredUnpaid: Number(row.delivered_unpaid),
      completed: Number(row.completed),
      outstandingAmount: Number(row.outstanding_amount),
      inProgressAmount: Number(row.in_progress_amount),
    };
  }
}
