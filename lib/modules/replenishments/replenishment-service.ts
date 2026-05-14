/**
 * Service - Approvisionnements stands (commandes internes)
 *
 * Workflow :
 *   draft → submitted → approved → in_production → produced → distributed → (completed)
 *   À tout moment : cancelled
 *
 * - draft       : saisie par manager commercial
 * - submitted   : envoyée pour validation admin
 * - approved    : validée → on peut lancer production OU distribuer directement
 * - in_production : production_order lié et en cours
 * - produced    : production terminée, stock alimenté
 * - distributed : 100 % des targets ont reçu la totalité
 *
 * Une commande peut être valorisée (line.unit_cost × line.quantity_requested)
 * mais n'a aucun paiement. Pas de balance, pas de wallet.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

export type ReplenishmentStatus =
  | 'draft' | 'submitted' | 'approved' | 'in_production'
  | 'produced' | 'distributed' | 'cancelled';

export interface CreateReplenishmentInput {
  workspaceId: string;
  requestedById: string;
  notes?: string;
  requestedDeliveryDate?: string;
  lines: Array<{
    productId: string;             // UUID PK (résolu côté API si slug)
    quantityRequested: number;
    unitCost?: number;             // optionnel : si absent, on lit products.unit_cost
    notes?: string;
    targets: Array<{
      outletId: string;             // UUID PK
      quantityTarget: number;
    }>;
  }>;
}

export interface DistributeInput {
  workspaceId: string;
  processedById: string;
  targetId: string;                 // UUID PK du target
  quantity: number;                 // quantité à livrer maintenant (peut être partielle)
  sourceWarehouseId: string;        // UUID PK entrepôt source (usine de production / dépôt général)
  notes?: string;
}

async function resolveUserUuid(idOrSlug: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
    [idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

async function generateReplenishmentNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM stand_replenishment_orders
     WHERE workspace_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
    [workspaceId, year]
  );
  return `APR-${year}-${String(r.rows[0].n + 1).padStart(4, '0')}`;
}

export class ReplenishmentService {
  /** Crée la demande complète (entête + lignes + cibles) en transaction. */
  async create(input: CreateReplenishmentInput): Promise<any> {
    if (input.lines.length === 0) throw new Error('Au moins une ligne est requise');
    for (const l of input.lines) {
      if (l.quantityRequested <= 0) throw new Error('Quantité demandée doit être positive');
      if (l.targets.length === 0) throw new Error(`Au moins un stand cible pour le produit ${l.productId}`);
      const sumTargets = l.targets.reduce((s, t) => s + t.quantityTarget, 0);
      if (Math.abs(sumTargets - l.quantityRequested) > 0.001) {
        throw new Error(`La somme des cibles (${sumTargets}) doit égaler la quantité demandée (${l.quantityRequested}) pour ce produit`);
      }
    }

    const requesterUuid = await resolveUserUuid(input.requestedById);
    if (!requesterUuid) throw new Error('Demandeur introuvable');

    const replenishmentNumber = await generateReplenishmentNumber(input.workspaceId);

    return await db.transaction(async (client) => {
      // 1) Entête
      const orderRes = await client.query(
        `INSERT INTO stand_replenishment_orders
          (replenishment_id, replenishment_number, status, notes, requested_delivery_date,
           requested_by_id, workspace_id, total_value_estimate)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6, 0) RETURNING id`,
        [
          uuidv4(),
          replenishmentNumber,
          input.notes ?? null,
          input.requestedDeliveryDate ?? null,
          requesterUuid,
          input.workspaceId,
        ]
      );
      const orderId = orderRes.rows[0].id;

      // 2) Lignes + cibles
      let totalValue = 0;
      for (const l of input.lines) {
        // Coût de revient via CUMP des stock_items (moyenne pondérée), pas
        // products.unit_price (qui est le prix de vente).
        let unitCost = 0;
        const cump = await client.query(
          `SELECT COALESCE(SUM(quantity * unit_cost) / NULLIF(SUM(quantity), 0), 0)::float AS w
           FROM stock_items WHERE workspace_id = $1 AND product_id = $2 AND unit_cost > 0`,
          [input.workspaceId, l.productId]
        );
        unitCost = Number(cump.rows[0]?.w || 0);
        // Fallback : 50% du prix de vente si aucun stock_item valorisé
        if (unitCost <= 0) {
          const p = await client.query(`SELECT unit_price FROM products WHERE id = $1`, [l.productId]);
          unitCost = Number(p.rows[0]?.unit_price || 0) * 0.5;
        }
        const productName = (await client.query(`SELECT name FROM products WHERE id = $1`, [l.productId])).rows[0]?.name || 'Produit';
        const lineTotal = unitCost * l.quantityRequested;
        totalValue += lineTotal;

        const lineRes = await client.query(
          `INSERT INTO stand_replenishment_lines
            (replenishment_id, product_id, product_name, quantity_requested,
             unit_cost, line_total, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [orderId, l.productId, productName, l.quantityRequested, unitCost, lineTotal, l.notes ?? null]
        );
        const lineId = lineRes.rows[0].id;

        for (const t of l.targets) {
          await client.query(
            `INSERT INTO stand_replenishment_targets
              (line_id, outlet_id, quantity_target, quantity_received)
             VALUES ($1, $2, $3, 0)`,
            [lineId, t.outletId, t.quantityTarget]
          );
        }
      }

      // 3) Total valorisation
      await client.query(
        `UPDATE stand_replenishment_orders SET total_value_estimate = $2 WHERE id = $1`,
        [orderId, totalValue]
      );

      return { id: orderId };
    }).then(async ({ id }) => this.getById(id));
  }

  /** Récupère une demande complète (entête + lignes + cibles + nom outlet + production_order). */
  async getById(idOrBusinessId: string): Promise<any | null> {
    const order = await db.query(
      `SELECT r.*,
              u.full_name AS requested_by_name,
              ua.full_name AS approved_by_name,
              po.order_number AS production_order_number
       FROM stand_replenishment_orders r
       LEFT JOIN users u  ON u.id  = r.requested_by_id
       LEFT JOIN users ua ON ua.id = r.approved_by_id
       LEFT JOIN production_orders po ON po.id = r.production_order_id
       WHERE r.id::text = $1 OR r.replenishment_id = $1 OR r.replenishment_number = $1
       LIMIT 1`,
      [idOrBusinessId]
    );
    if (order.rows.length === 0) return null;
    const o = order.rows[0];

    const lines = await db.query(
      `SELECT l.*, p.code AS product_code
       FROM stand_replenishment_lines l
       JOIN products p ON p.id = l.product_id
       WHERE replenishment_id = $1
       ORDER BY l.created_at`,
      [o.id]
    );

    const targets = await db.query(
      `SELECT t.*, o.name AS outlet_name, o.code AS outlet_code
       FROM stand_replenishment_targets t
       JOIN outlets o ON o.id = t.outlet_id
       WHERE t.line_id = ANY($1::uuid[])
       ORDER BY o.name`,
      [lines.rows.map(r => r.id)]
    );

    // Group targets by line
    const targetsByLine: Record<string, any[]> = {};
    for (const t of targets.rows) {
      if (!targetsByLine[t.line_id]) targetsByLine[t.line_id] = [];
      targetsByLine[t.line_id].push(t);
    }

    return {
      ...o,
      lines: lines.rows.map(l => ({ ...l, targets: targetsByLine[l.id] || [] })),
    };
  }

  /** Liste filtrée pour la page /replenishments. */
  async list(workspaceId: string, filters: { status?: ReplenishmentStatus } = {}): Promise<any[]> {
    const conds: string[] = ['r.workspace_id = $1'];
    const params: any[] = [workspaceId];
    if (filters.status) { params.push(filters.status); conds.push(`r.status = $${params.length}`); }

    const r = await db.query(
      `SELECT r.id, r.replenishment_id, r.replenishment_number, r.status,
              r.total_value_estimate, r.requested_delivery_date, r.created_at,
              u.full_name AS requested_by_name,
              (SELECT COUNT(*) FROM stand_replenishment_lines WHERE replenishment_id = r.id) AS line_count,
              (SELECT COALESCE(SUM(quantity_target),0)::float
                 FROM stand_replenishment_targets t
                 JOIN stand_replenishment_lines l ON l.id = t.line_id
                 WHERE l.replenishment_id = r.id) AS total_target_qty,
              (SELECT COALESCE(SUM(quantity_received),0)::float
                 FROM stand_replenishment_targets t
                 JOIN stand_replenishment_lines l ON l.id = t.line_id
                 WHERE l.replenishment_id = r.id) AS total_received_qty
       FROM stand_replenishment_orders r
       LEFT JOIN users u ON u.id = r.requested_by_id
       WHERE ${conds.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params
    );
    return r.rows;
  }

  /** Statistiques pour le dashboard. */
  async getStats(workspaceId: string): Promise<any> {
    const r = await db.query(
      `SELECT status, COUNT(*)::int AS n
       FROM stand_replenishment_orders WHERE workspace_id = $1
       GROUP BY status`,
      [workspaceId]
    );
    const byStatus: Record<string, number> = {};
    r.rows.forEach(x => { byStatus[x.status] = x.n; });
    return { byStatus, total: r.rows.reduce((s, x) => s + x.n, 0) };
  }

  /** Transitions de statut (workflow). */
  async submit(id: string): Promise<any> {
    const uuid = await this.resolveOrderUuid(id);
    await this.requireStatus(uuid, 'draft');
    await db.query(`UPDATE stand_replenishment_orders SET status='submitted', updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [uuid]);
    return this.getById(uuid);
  }

  async approve(id: string, approvedById: string): Promise<any> {
    const uuid = await this.resolveOrderUuid(id);
    await this.requireStatus(uuid, 'submitted');
    const userUuid = await resolveUserUuid(approvedById);
    await db.query(
      `UPDATE stand_replenishment_orders
       SET status='approved', approved_by_id=$2, approved_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [uuid, userUuid]
    );
    return this.getById(uuid);
  }

  async linkProductionOrder(id: string, productionOrderId: string): Promise<any> {
    const uuid = await this.resolveOrderUuid(id);
    await db.query(
      `UPDATE stand_replenishment_orders
       SET production_order_id=$2, status='in_production', updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status IN ('approved','in_production')`,
      [uuid, productionOrderId]
    );
    return this.getById(uuid);
  }

  async markProduced(id: string): Promise<any> {
    const uuid = await this.resolveOrderUuid(id);
    await db.query(
      `UPDATE stand_replenishment_orders
       SET status='produced', updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status IN ('in_production','approved')`,
      [uuid]
    );
    return this.getById(uuid);
  }

  async cancel(id: string, reason?: string): Promise<any> {
    const uuid = await this.resolveOrderUuid(id);
    await db.query(
      `UPDATE stand_replenishment_orders
       SET status='cancelled', notes = COALESCE(notes,'') || $2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status NOT IN ('distributed','cancelled')`,
      [uuid, reason ? `\n[annulée: ${reason}]` : '\n[annulée]']
    );
    return this.getById(uuid);
  }

  /**
   * Distribution partielle : transfère X unités du warehouse source vers le
   * stand cible. Met à jour stock_items (décrémente source, incrémente outlet)
   * et trace un stock_movement de type 'transfer' lié au target.
   * Si tous les targets sont 100 % servis, passe le statut à 'distributed'.
   */
  async distribute(input: DistributeInput): Promise<any> {
    const userUuid = await resolveUserUuid(input.processedById);
    if (!userUuid) throw new Error('Utilisateur introuvable');
    if (input.quantity <= 0) throw new Error('Quantité doit être positive');

    const tgtRow = await db.query(
      `SELECT t.id, t.quantity_target, t.quantity_received, t.outlet_id,
              l.id AS line_id, l.product_id, l.unit_cost, l.replenishment_id,
              r.workspace_id
       FROM stand_replenishment_targets t
       JOIN stand_replenishment_lines l ON l.id = t.line_id
       JOIN stand_replenishment_orders r ON r.id = l.replenishment_id
       WHERE t.id = $1 LIMIT 1`,
      [input.targetId]
    );
    if (tgtRow.rows.length === 0) throw new Error('Cible introuvable');
    const t = tgtRow.rows[0];
    if (t.workspace_id !== input.workspaceId) throw new Error('Workspace mismatch');

    const remaining = Number(t.quantity_target) - Number(t.quantity_received);
    if (input.quantity > remaining + 0.001) {
      throw new Error(`La quantité demandée (${input.quantity}) dépasse le reste à livrer (${remaining})`);
    }

    return await db.transaction(async (client) => {
      // 1) Décrémenter stock_items source (warehouse)
      const sourceStock = await client.query(
        `SELECT id, quantity, unit_cost FROM stock_items
         WHERE workspace_id=$1 AND warehouse_id=$2 AND product_id=$3 LIMIT 1`,
        [input.workspaceId, input.sourceWarehouseId, t.product_id]
      );
      if (sourceStock.rows.length === 0 || Number(sourceStock.rows[0].quantity) < input.quantity) {
        throw new Error(`Stock insuffisant à l'entrepôt source (besoin ${input.quantity})`);
      }
      const srcUnitCost = Number(sourceStock.rows[0].unit_cost);
      const newSrcQty = Number(sourceStock.rows[0].quantity) - input.quantity;
      const newSrcVal = newSrcQty * srcUnitCost;
      await client.query(
        `UPDATE stock_items SET quantity=$2, total_value=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [sourceStock.rows[0].id, newSrcQty, newSrcVal]
      );

      // 2) Incrémenter stock_items destination (outlet) — créer si absent
      const destStock = await client.query(
        `SELECT id, quantity FROM stock_items
         WHERE workspace_id=$1 AND outlet_id=$2 AND product_id=$3 LIMIT 1`,
        [input.workspaceId, t.outlet_id, t.product_id]
      );
      if (destStock.rows.length > 0) {
        const newDestQty = Number(destStock.rows[0].quantity) + input.quantity;
        const newDestVal = newDestQty * srcUnitCost;
        await client.query(
          `UPDATE stock_items SET quantity=$2, total_value=$3, unit_cost=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [destStock.rows[0].id, newDestQty, newDestVal, srcUnitCost]
        );
      } else {
        const destTotal = input.quantity * srcUnitCost;
        await client.query(
          `INSERT INTO stock_items
            (stock_item_id, product_id, outlet_id, quantity, minimum_stock, unit_cost, total_value, workspace_id)
           VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
          [`STK-${uuidv4().slice(0, 8)}`, t.product_id, t.outlet_id, input.quantity, srcUnitCost, destTotal, input.workspaceId]
        );
      }

      // 3) Trace stock_movement (transfer) lié au target
      const totalCost = input.quantity * srcUnitCost;
      await client.query(
        `INSERT INTO stock_movements
          (movement_id, movement_number, type, product_id,
           source_warehouse_id, destination_outlet_id,
           quantity, unit_cost, total_cost, reason, status,
           processed_by_id, processed_at, workspace_id, replenishment_target_id)
         VALUES ($1, $2, 'transfer', $3, $4, $5, $6, $7, $8, $9, 'validated', $10, CURRENT_TIMESTAMP, $11, $12)`,
        [
          uuidv4(),
          `APR-DIST-${Date.now()}`,
          t.product_id,
          input.sourceWarehouseId,
          t.outlet_id,
          input.quantity,
          srcUnitCost,
          totalCost,
          input.notes || `Distribution approvisionnement vers stand`,
          userUuid,
          input.workspaceId,
          t.id,
        ]
      );

      // 4) Mettre à jour target.quantity_received
      const newReceived = Number(t.quantity_received) + input.quantity;
      await client.query(
        `UPDATE stand_replenishment_targets
         SET quantity_received=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [t.id, newReceived]
      );

      // 5) Si toutes les cibles sont à 100% → passer la commande en 'distributed'
      const remaining = await client.query(
        `SELECT COUNT(*)::int AS n
         FROM stand_replenishment_targets t
         JOIN stand_replenishment_lines l ON l.id = t.line_id
         WHERE l.replenishment_id = $1 AND t.quantity_received < t.quantity_target`,
        [t.replenishment_id]
      );
      if (remaining.rows[0].n === 0) {
        await client.query(
          `UPDATE stand_replenishment_orders SET status='distributed', updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
          [t.replenishment_id]
        );
      }

      return { targetId: t.id, newReceived, allDone: remaining.rows[0].n === 0 };
    }).then(async () => this.getById(t.replenishment_id));
  }

  private async requireStatus(id: string, expected: ReplenishmentStatus): Promise<void> {
    const r = await db.query(`SELECT status FROM stand_replenishment_orders WHERE id=$1`, [id]);
    if (r.rows.length === 0) throw new Error('Approvisionnement introuvable');
    if (r.rows[0].status !== expected) {
      throw new Error(`Statut invalide : attendu '${expected}', actuel '${r.rows[0].status}'`);
    }
  }

  /**
   * Résout n'importe quel identifiant (UUID PK, replenishment_id business code,
   * replenishment_number "APR-…") vers l'UUID PK. Garantit que les UPDATE
   * en aval (qui filtrent strictement sur id=$1) trouvent la bonne ligne,
   * même si l'URL passe un autre identifiant.
   */
  private async resolveOrderUuid(idOrBusinessId: string): Promise<string> {
    const r = await db.query(
      `SELECT id FROM stand_replenishment_orders
       WHERE id::text = $1 OR replenishment_id = $1 OR replenishment_number = $1
       LIMIT 1`,
      [idOrBusinessId]
    );
    if (r.rows.length === 0) throw new Error('Approvisionnement introuvable');
    return r.rows[0].id;
  }
}
