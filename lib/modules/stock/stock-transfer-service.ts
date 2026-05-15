/**
 * Service - Transferts de stock 1→N (entrepôts/stands mélangés).
 *
 * Workflow :
 *   1. create() : émetteur saisit, stock source décrémenté (réservation),
 *      legs créés en 'pending', entête en 'in_transit'.
 *   2. confirmLeg(qty)   : destinataire reçoit, stock destination crédité.
 *        - qty = qty_sent → leg_status='confirmed'
 *        - qty < qty_sent → leg_status='adjusted' + shortfall_decision='pending'
 *   3. refuseLeg(reason) : destinataire refuse, stock retourné à la source.
 *   4. decideShortfall(decision) : émetteur arbitre l'écart (perte transit
 *      ou retour à la source).
 *   5. cancel() : annule un transfert encore in_transit, tout retour source.
 *
 * Le statut entête est recalculé automatiquement après chaque changement de
 * leg. Une fois tous les legs terminaux (confirmed/adjusted/refused + shortfall
 * réglé si adjusted), le transfert passe à fully_received et closed_at est posé.
 */
import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Résolution slug ou UUID → UUID interne en colonne `id`.
 *
 * Faux ami : certaines tables legacy DDM (warehouses, clients, etc.) ont
 * un `<table>_id` VARCHAR qui contient en fait un UUID v4 (artefact de la
 * migration Airtable→Postgres). Donc tester UUID_RE.test(value) ne suffit
 * pas pour conclure que la valeur est l'`id` interne. On fait toujours
 * une vraie lookup pour être robuste — coût marginal (1 SELECT par
 * résolution, indexé).
 */
async function resolveUuid(table: string, slugCol: string | null, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (slugCol) {
    const r = await db.query(
      `SELECT id FROM ${table} WHERE id::text = $1 OR ${slugCol} = $1 LIMIT 1`,
      [value]
    );
    return r.rows[0]?.id ?? null;
  }
  if (UUID_RE.test(value)) return value; // pas de slugCol → on accepte uuid brut
  return null;
}

const SELECT_TRANSFER = `
  SELECT
    t.id, t.transfer_id, t.transfer_number, t.status,
    t.source_warehouse_id, t.source_outlet_id,
    sw.name AS source_warehouse_name, so.name AS source_outlet_name,
    t.initiated_by_id, u.full_name AS initiated_by_name,
    t.initiated_at, t.closed_at, t.notes, t.workspace_id,
    t.created_at, t.updated_at
  FROM stock_transfers t
  LEFT JOIN warehouses sw ON sw.id = t.source_warehouse_id
  LEFT JOIN outlets so    ON so.id = t.source_outlet_id
  LEFT JOIN users u       ON u.id = t.initiated_by_id
`;

const SELECT_LINE = `
  SELECT
    l.id, l.transfer_line_id, l.transfer_id,
    l.product_id, l.product_name, l.qty_sent, l.unit,
    l.destination_warehouse_id, l.destination_outlet_id,
    dw.name AS destination_warehouse_name,
    do_.name AS destination_outlet_name,
    l.qty_received, l.leg_status,
    l.confirmed_by_id, cu.full_name AS confirmed_by_name,
    l.confirmed_at, l.adjustment_reason,
    l.shortfall_decision, l.shortfall_decided_at,
    l.shortfall_decided_by_id, sdu.full_name AS shortfall_decided_by_name,
    l.notes, l.created_at, l.updated_at
  FROM stock_transfer_lines l
  LEFT JOIN warehouses dw ON dw.id = l.destination_warehouse_id
  LEFT JOIN outlets    do_ ON do_.id = l.destination_outlet_id
  LEFT JOIN users cu  ON cu.id = l.confirmed_by_id
  LEFT JOIN users sdu ON sdu.id = l.shortfall_decided_by_id
`;

export interface CreateTransferInput {
  workspaceId: string;
  initiatedById: string;
  source: { warehouseId?: string; outletId?: string };
  notes?: string;
  lines: Array<{
    productId: string;
    qtySent: number;
    unit?: string;
    destination: { warehouseId?: string; outletId?: string };
    notes?: string;
  }>;
}

export class StockTransferService {

  // -------------------------------------------------------------------------
  // Lecture

  async getById(idOrSlug: string): Promise<any | null> {
    const r = await db.query(
      `${SELECT_TRANSFER} WHERE t.id::text = $1 OR t.transfer_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rowCount === 0) return null;
    const t = r.rows[0];
    const lines = await db.query(
      `${SELECT_LINE} WHERE l.transfer_id = $1 ORDER BY l.created_at ASC`,
      [t.id]
    );
    return { ...t, lines: lines.rows };
  }

  /**
   * Liste les transferts visibles pour l'utilisateur :
   *  - tous ceux qu'il a initiés (sent)
   *  - ceux dont au moins une destination est un emplacement qui le concerne :
   *    pour la v1 on simplifie et on retourne tous les transferts du workspace.
   *  - filtres : status, tab (sent/incoming/closed/all)
   *
   * Le destinataire d'une ligne est identifié par l'utilisateur dont l'email
   * ou les attributs correspondent au manager du warehouse/outlet — pour le
   * MVP on accepte que tous les utilisateurs autorisés voient tous les
   * transferts du workspace.
   */
  async list(workspaceId: string, filters?: { status?: string; userId?: string }): Promise<any[]> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return [];

    const conds: string[] = ['t.workspace_id = $1'];
    const params: any[] = [wsUuid];

    if (filters?.status) {
      params.push(filters.status);
      conds.push(`t.status = $${params.length}`);
    }

    const r = await db.query(
      `${SELECT_TRANSFER} WHERE ${conds.join(' AND ')} ORDER BY t.created_at DESC`,
      params
    );
    const transfers = r.rows;
    // Hydrate lignes en batch
    if (transfers.length > 0) {
      const ids = transfers.map((t: any) => t.id);
      const allLines = await db.query(
        `${SELECT_LINE} WHERE l.transfer_id = ANY($1::uuid[]) ORDER BY l.created_at ASC`,
        [ids]
      );
      const byTransfer = new Map<string, any[]>();
      for (const line of allLines.rows) {
        if (!byTransfer.has(line.transfer_id)) byTransfer.set(line.transfer_id, []);
        byTransfer.get(line.transfer_id)!.push(line);
      }
      for (const t of transfers) {
        t.lines = byTransfer.get(t.id) || [];
      }
    }
    return transfers;
  }

  // -------------------------------------------------------------------------
  // Création

  private async generateNumber(workspaceUuid: string): Promise<string> {
    const now = new Date();
    const prefix = `TR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const r = await db.query(
      `SELECT transfer_number FROM stock_transfers
       WHERE workspace_id = $1 AND transfer_number LIKE $2
       ORDER BY transfer_number DESC LIMIT 1`,
      [workspaceUuid, `${prefix}%`]
    );
    let next = 1;
    if (r.rows[0]) {
      const m = r.rows[0].transfer_number.match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  /**
   * Décrémente le stock d'un emplacement (entrepôt OU outlet) sur un produit.
   * Lève si stock insuffisant.
   */
  private async debitStock(client: any, params: {
    productUuid: string;
    warehouseUuid: string | null;
    outletUuid: string | null;
    qty: number;
    workspaceUuid: string;
  }) {
    const { productUuid, warehouseUuid, outletUuid, qty, workspaceUuid } = params;
    const locCol = warehouseUuid ? 'warehouse_id' : 'outlet_id';
    const locVal = warehouseUuid ?? outletUuid;
    if (!locVal) throw new Error('Emplacement source requis');

    const r = await client.query(
      `SELECT id, quantity FROM stock_items
       WHERE product_id = $1 AND ${locCol} = $2 AND workspace_id = $3
       FOR UPDATE`,
      [productUuid, locVal, workspaceUuid]
    );
    if (r.rowCount === 0) {
      throw new Error(`Aucun stock enregistré pour ce produit à la source`);
    }
    const item = r.rows[0];
    if (Number(item.quantity) < Number(qty)) {
      throw new Error(`Stock source insuffisant : ${item.quantity} disponible, ${qty} demandé`);
    }
    await client.query(
      `UPDATE stock_items SET quantity = quantity - $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [item.id, qty]
    );
  }

  /**
   * Crédite le stock d'un emplacement. Crée la ligne stock_items si elle
   * n'existe pas.
   */
  private async creditStock(client: any, params: {
    productUuid: string;
    warehouseUuid: string | null;
    outletUuid: string | null;
    qty: number;
    unitCost?: number;
    workspaceUuid: string;
  }) {
    const { productUuid, warehouseUuid, outletUuid, qty, workspaceUuid } = params;
    const locCol = warehouseUuid ? 'warehouse_id' : 'outlet_id';
    const locVal = warehouseUuid ?? outletUuid;
    if (!locVal) throw new Error('Emplacement destination requis');

    const exists = await client.query(
      `SELECT id, quantity, unit_cost FROM stock_items
       WHERE product_id = $1 AND ${locCol} = $2 AND workspace_id = $3
       FOR UPDATE`,
      [productUuid, locVal, workspaceUuid]
    );
    if (exists.rowCount > 0) {
      await client.query(
        `UPDATE stock_items SET quantity = quantity + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [exists.rows[0].id, qty]
      );
    } else {
      // Crée la ligne stock_items en réutilisant le unit_cost de la source si dispo
      const otherCol = warehouseUuid ? 'outlet_id' : 'warehouse_id';
      void otherCol;
      await client.query(
        `INSERT INTO stock_items (
           stock_item_id, product_id, ${locCol}, quantity, minimum_stock, unit_cost, workspace_id
         ) VALUES ($1, $2, $3, $4, 0, $5, $6)`,
        [`SI-${uuidv4().slice(0, 8)}`, productUuid, locVal, qty, params.unitCost ?? 0, workspaceUuid]
      );
    }
  }

  async create(input: CreateTransferInput): Promise<any> {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Au moins une ligne est requise');
    }
    if (!input.source.warehouseId && !input.source.outletId) {
      throw new Error('Source requise (entrepôt ou stand)');
    }
    if (input.source.warehouseId && input.source.outletId) {
      throw new Error('La source doit être un entrepôt OU un stand, pas les deux');
    }

    const wsUuid = await resolveUuid('workspaces', 'workspace_id', input.workspaceId);
    if (!wsUuid) throw new Error('Workspace introuvable');
    const userUuid = await resolveUuid('users', 'user_id', input.initiatedById);
    if (!userUuid) throw new Error('Utilisateur introuvable');

    const sourceWh = input.source.warehouseId
      ? await resolveUuid('warehouses', 'warehouse_id', input.source.warehouseId)
      : null;
    const sourceOut = input.source.outletId
      ? await resolveUuid('outlets', 'code', input.source.outletId)
      : null;
    if (!sourceWh && !sourceOut) throw new Error('Source introuvable');

    // Résolution des lignes en amont (vérifie tout avant d'ouvrir la transaction)
    interface ResolvedLine {
      productUuid: string;
      productName: string | null;
      qtySent: number;
      unit: string;
      destWh: string | null;
      destOut: string | null;
      notes: string | null;
    }
    const resolvedLines: ResolvedLine[] = [];
    for (const line of input.lines) {
      if (line.qtySent <= 0) throw new Error(`Quantité invalide pour une ligne (${line.qtySent})`);
      if (!line.destination.warehouseId && !line.destination.outletId) {
        throw new Error('Destination requise pour chaque ligne');
      }
      if (line.destination.warehouseId && line.destination.outletId) {
        throw new Error('Une ligne ne peut pas avoir à la fois un entrepôt et un stand en destination');
      }
      const productUuid = await resolveUuid('products', 'product_id', line.productId);
      if (!productUuid) throw new Error(`Produit ${line.productId} introuvable`);
      const destWh = line.destination.warehouseId
        ? await resolveUuid('warehouses', 'warehouse_id', line.destination.warehouseId)
        : null;
      const destOut = line.destination.outletId
        ? await resolveUuid('outlets', 'code', line.destination.outletId)
        : null;
      if (!destWh && !destOut) throw new Error('Destination introuvable');
      // Empêche source = destination
      if (sourceWh && destWh && sourceWh === destWh) {
        throw new Error('La destination ne peut pas être identique à la source');
      }
      if (sourceOut && destOut && sourceOut === destOut) {
        throw new Error('La destination ne peut pas être identique à la source');
      }
      const prodMeta = await db.query(`SELECT name, unit FROM products WHERE id = $1`, [productUuid]);
      resolvedLines.push({
        productUuid,
        productName: prodMeta.rows[0]?.name ?? null,
        qtySent: Number(line.qtySent),
        unit: line.unit || prodMeta.rows[0]?.unit || 'unit',
        destWh,
        destOut,
        notes: line.notes ?? null,
      });
    }

    const transferNumber = await this.generateNumber(wsUuid);
    const transferSlug = `TR-${uuidv4().slice(0, 8)}`;

    const transferUuid = await db.transaction(async (client) => {
      // 1. Décrémente le stock source pour chaque produit (somme des qty
      //    envoyées si même produit vers plusieurs destinations).
      const byProduct = new Map<string, number>();
      for (const line of resolvedLines) {
        byProduct.set(line.productUuid, (byProduct.get(line.productUuid) || 0) + line.qtySent);
      }
      for (const [productUuid, totalQty] of byProduct.entries()) {
        await this.debitStock(client, {
          productUuid, warehouseUuid: sourceWh, outletUuid: sourceOut,
          qty: totalQty, workspaceUuid: wsUuid,
        });
      }

      // 2. Insère l'entête
      const ins = await client.query(
        `INSERT INTO stock_transfers (
           transfer_id, transfer_number, status,
           source_warehouse_id, source_outlet_id,
           initiated_by_id, initiated_at, notes, workspace_id
         ) VALUES ($1,$2,'in_transit',$3,$4,$5,CURRENT_TIMESTAMP,$6,$7)
         RETURNING id`,
        [transferSlug, transferNumber, sourceWh, sourceOut, userUuid, input.notes ?? null, wsUuid]
      );
      const tUuid = ins.rows[0].id;

      // 3. Insère les lignes
      for (const line of resolvedLines) {
        await client.query(
          `INSERT INTO stock_transfer_lines (
             transfer_line_id, transfer_id, product_id, product_name,
             qty_sent, unit, destination_warehouse_id, destination_outlet_id, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            `STL-${uuidv4().slice(0, 8)}`, tUuid, line.productUuid, line.productName,
            line.qtySent, line.unit, line.destWh, line.destOut, line.notes,
          ]
        );
      }

      return tUuid;
    });

    return (await this.getById(transferUuid))!;
  }

  // -------------------------------------------------------------------------
  // Confirmation / refus / décision écart

  private async getLine(lineIdOrSlug: string): Promise<any | null> {
    const r = await db.query(
      `SELECT l.*, t.workspace_id, t.source_warehouse_id, t.source_outlet_id
       FROM stock_transfer_lines l
       JOIN stock_transfers t ON t.id = l.transfer_id
       WHERE l.id::text = $1 OR l.transfer_line_id = $1
       LIMIT 1`,
      [lineIdOrSlug]
    );
    return r.rows[0] ?? null;
  }

  async confirmLeg(lineIdOrSlug: string, input: {
    qtyReceived: number;
    confirmedById: string;
    adjustmentReason?: string;
  }): Promise<any> {
    const line = await this.getLine(lineIdOrSlug);
    if (!line) throw new Error('Ligne de transfert introuvable');
    if (line.leg_status !== 'pending') {
      throw new Error(`Ligne déjà traitée (statut : ${line.leg_status})`);
    }
    const qtyReceived = Number(input.qtyReceived);
    const qtySent = Number(line.qty_sent);
    if (qtyReceived <= 0) throw new Error('Quantité reçue doit être > 0');
    if (qtyReceived > qtySent) {
      throw new Error(`Quantité reçue (${qtyReceived}) ne peut excéder la quantité envoyée (${qtySent})`);
    }
    const userUuid = await resolveUuid('users', 'user_id', input.confirmedById);
    const isAdjusted = qtyReceived < qtySent;

    await db.transaction(async (client) => {
      // 1. Crédite le stock destination
      await this.creditStock(client, {
        productUuid: line.product_id,
        warehouseUuid: line.destination_warehouse_id,
        outletUuid: line.destination_outlet_id,
        qty: qtyReceived,
        workspaceUuid: line.workspace_id,
      });

      // 2. Met à jour la ligne
      await client.query(
        `UPDATE stock_transfer_lines
           SET qty_received = $2,
               leg_status = $3,
               confirmed_by_id = $4,
               confirmed_at = CURRENT_TIMESTAMP,
               adjustment_reason = $5,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          line.id, qtyReceived,
          isAdjusted ? 'adjusted' : 'confirmed',
          userUuid,
          isAdjusted ? (input.adjustmentReason ?? null) : null,
        ]
      );
    });

    // 3. Recompute statut entête (hors transaction, ok car simple lecture+update)
    await this.recomputeStatus(line.transfer_id);

    return await this.getLine(line.id);
  }

  /**
   * Rappel d'une ligne par l'émetteur du transfert (différent du refus
   * destinataire). Tant que la ligne est pending, l'émetteur peut la
   * récupérer : la qty_sent retourne au stock source, leg_status='recalled'.
   * Caller : la route doit avoir vérifié que userId === transfer.initiated_by_id.
   */
  async recallLeg(lineIdOrSlug: string, input: {
    recalledById: string;
    reason?: string;
  }): Promise<any> {
    const line = await this.getLine(lineIdOrSlug);
    if (!line) throw new Error('Ligne de transfert introuvable');
    if (line.leg_status !== 'pending') {
      throw new Error(`Ligne déjà traitée (statut : ${line.leg_status}), impossible à rappeler`);
    }
    const userUuid = await resolveUuid('users', 'user_id', input.recalledById);

    await db.transaction(async (client) => {
      await this.creditStock(client, {
        productUuid: line.product_id,
        warehouseUuid: line.source_warehouse_id,
        outletUuid: line.source_outlet_id,
        qty: Number(line.qty_sent),
        workspaceUuid: line.workspace_id,
      });
      await client.query(
        `UPDATE stock_transfer_lines
           SET qty_received = 0,
               leg_status = 'recalled',
               confirmed_by_id = $2,
               confirmed_at = CURRENT_TIMESTAMP,
               adjustment_reason = $3,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [line.id, userUuid, input.reason ?? null]
      );
    });

    await this.recomputeStatus(line.transfer_id);
    return await this.getLine(line.id);
  }

  async refuseLeg(lineIdOrSlug: string, input: {
    refusedById: string;
    reason?: string;
  }): Promise<any> {
    const line = await this.getLine(lineIdOrSlug);
    if (!line) throw new Error('Ligne de transfert introuvable');
    if (line.leg_status !== 'pending') {
      throw new Error(`Ligne déjà traitée (statut : ${line.leg_status})`);
    }
    const userUuid = await resolveUuid('users', 'user_id', input.refusedById);

    await db.transaction(async (client) => {
      // Retourne la qty_sent au stock source
      await this.creditStock(client, {
        productUuid: line.product_id,
        warehouseUuid: line.source_warehouse_id,
        outletUuid: line.source_outlet_id,
        qty: Number(line.qty_sent),
        workspaceUuid: line.workspace_id,
      });

      await client.query(
        `UPDATE stock_transfer_lines
           SET qty_received = 0,
               leg_status = 'refused',
               confirmed_by_id = $2,
               confirmed_at = CURRENT_TIMESTAMP,
               adjustment_reason = $3,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [line.id, userUuid, input.reason ?? null]
      );
    });

    await this.recomputeStatus(line.transfer_id);
    return await this.getLine(line.id);
  }

  /**
   * L'émetteur arbitre l'écart d'une ligne adjusted :
   *  - declared_loss : l'écart est perdu (stock source déjà décrémenté, rien à faire)
   *  - returned_to_source : crédite l'écart au stock source
   */
  async decideShortfall(lineIdOrSlug: string, input: {
    decision: 'declared_loss' | 'returned_to_source';
    decidedById: string;
  }): Promise<any> {
    const line = await this.getLine(lineIdOrSlug);
    if (!line) throw new Error('Ligne de transfert introuvable');
    if (line.leg_status !== 'adjusted') {
      throw new Error('Décision possible uniquement sur une ligne ajustée');
    }
    if (line.shortfall_decision !== 'pending') {
      throw new Error(`Décision déjà prise (${line.shortfall_decision})`);
    }
    const userUuid = await resolveUuid('users', 'user_id', input.decidedById);
    const shortfall = Number(line.qty_sent) - Number(line.qty_received);

    await db.transaction(async (client) => {
      if (input.decision === 'returned_to_source') {
        await this.creditStock(client, {
          productUuid: line.product_id,
          warehouseUuid: line.source_warehouse_id,
          outletUuid: line.source_outlet_id,
          qty: shortfall,
          workspaceUuid: line.workspace_id,
        });
      }
      await client.query(
        `UPDATE stock_transfer_lines
           SET shortfall_decision = $2,
               shortfall_decided_at = CURRENT_TIMESTAMP,
               shortfall_decided_by_id = $3,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [line.id, input.decision, userUuid]
      );
    });

    await this.recomputeStatus(line.transfer_id);
    return await this.getLine(line.id);
  }

  async cancel(idOrSlug: string, _reason?: string): Promise<any> {
    const t = await this.getById(idOrSlug);
    if (!t) throw new Error('Transfert introuvable');
    if (t.status === 'fully_received' || t.status === 'cancelled') {
      throw new Error(`Transfert finalisé (${t.status}), impossible à annuler`);
    }

    await db.transaction(async (client) => {
      // Retourne au stock source les qty des legs encore pending
      for (const line of t.lines) {
        if (line.leg_status === 'pending') {
          await this.creditStock(client, {
            productUuid: line.product_id,
            warehouseUuid: line.source_warehouse_id ?? t.source_warehouse_id,
            outletUuid: line.source_outlet_id ?? t.source_outlet_id,
            qty: Number(line.qty_sent),
            workspaceUuid: t.workspace_id,
          });
          await client.query(
            `UPDATE stock_transfer_lines
               SET leg_status = 'refused', qty_received = 0, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [line.id]
          );
        }
      }
      await client.query(
        `UPDATE stock_transfers
           SET status = 'cancelled', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [t.id]
      );
    });

    return await this.getById(t.id);
  }

  /**
   * Recalcule le statut entête en fonction des legs.
   */
  private async recomputeStatus(transferUuid: string): Promise<void> {
    const r = await db.query(
      `SELECT leg_status, shortfall_decision FROM stock_transfer_lines WHERE transfer_id = $1`,
      [transferUuid]
    );
    if (r.rowCount === 0) return;

    const allPending = r.rows.every((l: any) => l.leg_status === 'pending');
    if (allPending) {
      await db.query(
        `UPDATE stock_transfers SET status = 'in_transit', closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transferUuid]
      );
      return;
    }

    // Une ligne "adjusted" est terminale UNIQUEMENT si la décision écart est tranchée.
    // confirmed/refused/recalled/adjusted+decided sont terminaux.
    const allFinal = r.rows.every((l: any) => {
      if (l.leg_status === 'pending') return false;
      if (l.leg_status === 'adjusted' && l.shortfall_decision === 'pending') return false;
      return true;
    });

    if (allFinal) {
      await db.query(
        `UPDATE stock_transfers
           SET status = 'fully_received', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [transferUuid]
      );
    } else {
      await db.query(
        `UPDATE stock_transfers SET status = 'partially_received', closed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [transferUuid]
      );
    }
  }

  // -------------------------------------------------------------------------
  // Stats / utilitaires

  /**
   * Nombre total de legs pending du workspace (vue globale admin/compta).
   */
  async countPendingLegs(workspaceId: string): Promise<number> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return 0;
    const r = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM stock_transfer_lines l
       JOIN stock_transfers t ON t.id = l.transfer_id
       WHERE t.workspace_id = $1 AND l.leg_status = 'pending'`,
      [wsUuid]
    );
    return r.rows[0]?.n ?? 0;
  }

  /**
   * Nombre de legs pending dont la destination (warehouse OU outlet) a
   * userId comme manager. Vue terrain pour les agents/managers d'un seul
   * emplacement.
   */
  async countPendingLegsForUser(workspaceId: string, userIdOrSlug: string): Promise<number> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    const userUuid = await resolveUuid('users', 'user_id', userIdOrSlug);
    if (!wsUuid || !userUuid) return 0;
    const r = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM stock_transfer_lines l
       JOIN stock_transfers t ON t.id = l.transfer_id
       LEFT JOIN warehouses dw ON dw.id = l.destination_warehouse_id
       LEFT JOIN outlets    do_ ON do_.id = l.destination_outlet_id
       WHERE t.workspace_id = $1
         AND l.leg_status = 'pending'
         AND (dw.manager_id = $2 OR do_.manager_id = $2)`,
      [wsUuid, userUuid]
    );
    return r.rows[0]?.n ?? 0;
  }

  /**
   * Liste les transferts ayant au moins une ligne pending dont la destination
   * a userId comme manager. Pour l'onglet "À recevoir" filtré côté terrain.
   */
  async listIncomingForUser(workspaceId: string, userIdOrSlug: string): Promise<any[]> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    const userUuid = await resolveUuid('users', 'user_id', userIdOrSlug);
    if (!wsUuid || !userUuid) return [];
    const r = await db.query(
      `SELECT DISTINCT t.id
       FROM stock_transfers t
       JOIN stock_transfer_lines l ON l.transfer_id = t.id
       LEFT JOIN warehouses dw ON dw.id = l.destination_warehouse_id
       LEFT JOIN outlets    do_ ON do_.id = l.destination_outlet_id
       WHERE t.workspace_id = $1
         AND l.leg_status = 'pending'
         AND (dw.manager_id = $2 OR do_.manager_id = $2)
       ORDER BY t.id DESC`,
      [wsUuid, userUuid]
    );
    if (r.rowCount === 0) return [];
    const ids = r.rows.map((x: any) => x.id);
    const detailsR = await db.query(
      `${SELECT_TRANSFER} WHERE t.id = ANY($1::uuid[]) ORDER BY t.created_at DESC`,
      [ids]
    );
    const transfers = detailsR.rows;
    const allLines = await db.query(
      `${SELECT_LINE} WHERE l.transfer_id = ANY($1::uuid[]) ORDER BY l.created_at ASC`,
      [ids]
    );
    const byTransfer = new Map<string, any[]>();
    for (const line of allLines.rows) {
      if (!byTransfer.has(line.transfer_id)) byTransfer.set(line.transfer_id, []);
      byTransfer.get(line.transfer_id)!.push(line);
    }
    for (const t of transfers) t.lines = byTransfer.get(t.id) || [];
    return transfers;
  }
}
