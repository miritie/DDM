/**
 * Service - Points de Vente (Outlets)
 *
 * - CRUD outlets, types, périodes, prix
 * - CRUD planning hebdomadaire (assignments) + exceptions ad-hoc (overrides)
 * - Résolveurs : "qui est sur cet outlet aujourd'hui", "quel prix appliquer"
 * - Toutes les requêtes sont scope-workspace.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import {
  Outlet,
  OutletType,
  OutletPeriod,
  OutletPrice,
  OutletAssignment,
  OutletAssignmentOverride,
  OutletFeePeriod,
} from '@/types/modules';

const db = getPostgresClient();

// ---------------------------------------------------------------------------
// Helpers

/**
 * Accepte UUID PK ou business code user_id et retourne l'UUID PK.
 * Nécessaire car la session véhicule le business code (USR-…) tandis que
 * outlet_assignments.user_id / .assigned_by_id sont des FK UUID.
 */
async function resolveUserUuid(idOrSlug: string): Promise<string> {
  const r = await db.query(
    `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
    [idOrSlug]
  );
  if (r.rows.length === 0) throw new Error('Utilisateur introuvable');
  return r.rows[0].id;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// ---------------------------------------------------------------------------
// OUTLET TYPES

export interface CreateOutletTypeInput {
  workspaceId: string;
  code: string;
  name: string;
  description?: string;
}

export class OutletService {
  // ===== Types =====

  async listTypes(workspaceId: string): Promise<OutletType[]> {
    const r = await db.query(
      `SELECT * FROM outlet_types WHERE workspace_id = $1 ORDER BY name`,
      [workspaceId]
    );
    return r.rows.map(mapOutletTypeRow);
  }

  async createType(input: CreateOutletTypeInput): Promise<OutletType> {
    const r = await db.query(
      `INSERT INTO outlet_types (code, name, description, workspace_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.code, input.name, input.description || null, input.workspaceId]
    );
    return mapOutletTypeRow(r.rows[0]);
  }

  async updateType(id: string, patch: Partial<CreateOutletTypeInput>): Promise<OutletType> {
    const r = await db.query(
      `UPDATE outlet_types
       SET code = COALESCE($2, code),
           name = COALESCE($3, name),
           description = COALESCE($4, description)
       WHERE id = $1 RETURNING *`,
      [id, patch.code ?? null, patch.name ?? null, patch.description ?? null]
    );
    if (r.rows.length === 0) throw new Error('Type d\'outlet introuvable');
    return mapOutletTypeRow(r.rows[0]);
  }

  async deleteType(id: string): Promise<void> {
    await db.query(`DELETE FROM outlet_types WHERE id = $1`, [id]);
  }

  // ===== Outlets =====

  async list(workspaceId: string, filters: { isActive?: boolean; outletTypeId?: string } = {}): Promise<Outlet[]> {
    const params: any[] = [workspaceId];
    let sql = `SELECT * FROM outlets WHERE workspace_id = $1`;
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      sql += ` AND is_active = $${params.length}`;
    }
    if (filters.outletTypeId) {
      params.push(filters.outletTypeId);
      sql += ` AND outlet_type_id = $${params.length}`;
    }
    sql += ` ORDER BY name`;
    const r = await db.query(sql, params);
    return r.rows.map(mapOutletRow);
  }

  async getById(id: string): Promise<Outlet | null> {
    const r = await db.query(`SELECT * FROM outlets WHERE id = $1`, [id]);
    return r.rows.length > 0 ? mapOutletRow(r.rows[0]) : null;
  }

  async getByQrToken(qrToken: string): Promise<Outlet | null> {
    const r = await db.query(`SELECT * FROM outlets WHERE qr_token = $1`, [qrToken]);
    return r.rows.length > 0 ? mapOutletRow(r.rows[0]) : null;
  }

  async create(input: {
    workspaceId: string;
    code: string;
    name: string;
    outletTypeId?: string;
    address?: string;
    city?: string;
    gpsLat?: number;
    gpsLng?: number;
    managerId?: string;
  }): Promise<Outlet> {
    const r = await db.query(
      `INSERT INTO outlets
        (code, name, outlet_type_id, address, city, gps_lat, gps_lng, manager_id, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.code,
        input.name,
        input.outletTypeId ?? null,
        input.address ?? null,
        input.city ?? null,
        input.gpsLat ?? null,
        input.gpsLng ?? null,
        input.managerId ?? null,
        input.workspaceId,
      ]
    );
    return mapOutletRow(r.rows[0]);
  }

  async update(id: string, patch: Partial<Outlet>): Promise<Outlet> {
    const r = await db.query(
      `UPDATE outlets
       SET name = COALESCE($2, name),
           outlet_type_id = COALESCE($3, outlet_type_id),
           address = COALESCE($4, address),
           city = COALESCE($5, city),
           gps_lat = COALESCE($6, gps_lat),
           gps_lng = COALESCE($7, gps_lng),
           manager_id = COALESCE($8, manager_id),
           is_active = COALESCE($9, is_active)
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.Name ?? null,
        patch.OutletTypeId ?? null,
        patch.Address ?? null,
        patch.City ?? null,
        patch.GpsLat ?? null,
        patch.GpsLng ?? null,
        patch.ManagerId ?? null,
        patch.IsActive ?? null,
      ]
    );
    if (r.rows.length === 0) throw new Error('Outlet introuvable');
    return mapOutletRow(r.rows[0]);
  }

  async deactivate(id: string): Promise<void> {
    await db.query(`UPDATE outlets SET is_active = false WHERE id = $1`, [id]);
  }

  // ===== Periods =====

  async listPeriods(outletId: string): Promise<OutletPeriod[]> {
    const r = await db.query(
      `SELECT * FROM outlet_periods WHERE outlet_id = $1 ORDER BY start_date DESC`,
      [outletId]
    );
    return r.rows.map(mapPeriodRow);
  }

  async createPeriod(input: {
    workspaceId: string;
    outletId: string;
    startDate: string;
    endDate?: string;
    isActive?: boolean;
    isPaid?: boolean;
    feeAmount?: number;
    feePeriod?: OutletFeePeriod;
    notes?: string;
  }): Promise<OutletPeriod> {
    const r = await db.query(
      `INSERT INTO outlet_periods
        (outlet_id, start_date, end_date, is_active, is_paid, fee_amount, fee_period, notes, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.outletId,
        input.startDate,
        input.endDate ?? null,
        input.isActive ?? true,
        input.isPaid ?? false,
        input.feeAmount ?? 0,
        input.feePeriod ?? 'monthly',
        input.notes ?? null,
        input.workspaceId,
      ]
    );
    return mapPeriodRow(r.rows[0]);
  }

  /** Période active à une date donnée (today par défaut). */
  async getActivePeriod(outletId: string, atDate?: string): Promise<OutletPeriod | null> {
    const date = atDate ?? todayIso();
    const r = await db.query(
      `SELECT * FROM outlet_periods
       WHERE outlet_id = $1
         AND start_date <= $2
         AND (end_date IS NULL OR end_date >= $2)
       ORDER BY start_date DESC
       LIMIT 1`,
      [outletId, date]
    );
    return r.rows.length > 0 ? mapPeriodRow(r.rows[0]) : null;
  }

  // ===== Prices =====

  async listPrices(workspaceId: string, filters: { outletId?: string; outletTypeId?: string; productId?: string } = {}): Promise<OutletPrice[]> {
    const params: any[] = [workspaceId];
    let sql = `SELECT * FROM outlet_prices WHERE workspace_id = $1`;
    if (filters.outletId) { params.push(filters.outletId); sql += ` AND outlet_id = $${params.length}`; }
    if (filters.outletTypeId) { params.push(filters.outletTypeId); sql += ` AND outlet_type_id = $${params.length}`; }
    if (filters.productId) { params.push(filters.productId); sql += ` AND product_id = $${params.length}`; }
    sql += ` ORDER BY valid_from DESC`;
    const r = await db.query(sql, params);
    return r.rows.map(mapPriceRow);
  }

  async upsertPrice(input: {
    workspaceId: string;
    productId: string;
    outletId?: string;
    outletTypeId?: string;
    unitPrice: number;
    currency?: string;
    validFrom?: string;
    validTo?: string;
  }): Promise<OutletPrice> {
    if (!input.outletId === !input.outletTypeId) {
      throw new Error('Un prix doit cibler exactement un outlet OU un type d\'outlet');
    }
    const r = await db.query(
      `INSERT INTO outlet_prices
        (product_id, outlet_id, outlet_type_id, unit_price, currency, valid_from, valid_to, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        input.productId,
        input.outletId ?? null,
        input.outletTypeId ?? null,
        input.unitPrice,
        input.currency ?? 'XOF',
        input.validFrom ?? todayIso(),
        input.validTo ?? null,
        input.workspaceId,
      ]
    );
    return mapPriceRow(r.rows[0]);
  }

  async deletePrice(id: string): Promise<void> {
    await db.query(`DELETE FROM outlet_prices WHERE id = $1`, [id]);
  }

  /**
   * Résolveur prix : pour un (produit, outlet), retourne le prix applicable à `atDate`.
   * Précédence : prix outlet > prix type > null (vente bloquée si null).
   */
  async resolvePrice(productId: string, outletId: string, atDate?: string): Promise<OutletPrice | null> {
    const date = atDate ?? todayIso();

    // 1. Prix spécifique outlet
    const outletLevel = await db.query(
      `SELECT * FROM outlet_prices
       WHERE product_id = $1 AND outlet_id = $2
         AND valid_from <= $3 AND (valid_to IS NULL OR valid_to >= $3)
       ORDER BY valid_from DESC LIMIT 1`,
      [productId, outletId, date]
    );
    if (outletLevel.rows.length > 0) return mapPriceRow(outletLevel.rows[0]);

    // 2. Prix par type d'outlet
    const typeLevel = await db.query(
      `SELECT op.* FROM outlet_prices op
       JOIN outlets o ON o.outlet_type_id = op.outlet_type_id
       WHERE op.product_id = $1 AND o.id = $2
         AND op.valid_from <= $3 AND (op.valid_to IS NULL OR op.valid_to >= $3)
       ORDER BY op.valid_from DESC LIMIT 1`,
      [productId, outletId, date]
    );
    if (typeLevel.rows.length > 0) return mapPriceRow(typeLevel.rows[0]);

    return null;
  }

  // ===== Assignments (planning hebdo) =====

  async listAssignments(workspaceId: string, filters: { outletId?: string; userId?: string; weekStart?: string } = {}): Promise<OutletAssignment[]> {
    // user_id est UUID, le filtre peut arriver en business code (USR-…)
    // depuis une querystring : on résout avant filtrage.
    const userUuid = filters.userId ? await resolveUserUuid(filters.userId) : undefined;

    const params: any[] = [workspaceId];
    let sql = `SELECT * FROM outlet_assignments WHERE workspace_id = $1`;
    if (filters.outletId) { params.push(filters.outletId); sql += ` AND outlet_id = $${params.length}`; }
    if (userUuid) { params.push(userUuid); sql += ` AND user_id = $${params.length}`; }
    if (filters.weekStart) { params.push(filters.weekStart); sql += ` AND week_start = $${params.length}`; }
    sql += ` ORDER BY week_start DESC`;
    const r = await db.query(sql, params);
    return r.rows.map(mapAssignmentRow);
  }

  async createAssignment(input: {
    workspaceId: string;
    outletId: string;
    userId: string;
    weekStart: string;
    weekEnd: string;
    assignedById?: string;
    notes?: string;
  }): Promise<OutletAssignment> {
    // assignedById vient typiquement de session.user.userId, qui est le
    // business code (USR-…). La colonne assigned_by_id est UUID — on résout
    // pour éviter "invalid input syntax for type uuid". userId arrive en
    // UUID depuis le picker mais on tolère les deux formats.
    const userUuid = await resolveUserUuid(input.userId);
    const assignedByUuid = input.assignedById ? await resolveUserUuid(input.assignedById) : null;

    const r = await db.query(
      `INSERT INTO outlet_assignments
        (outlet_id, user_id, week_start, week_end, assigned_by_id, notes, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (outlet_id, user_id, week_start) DO UPDATE
         SET week_end = EXCLUDED.week_end,
             assigned_by_id = EXCLUDED.assigned_by_id,
             notes = EXCLUDED.notes
       RETURNING *`,
      [input.outletId, userUuid, input.weekStart, input.weekEnd,
       assignedByUuid, input.notes ?? null, input.workspaceId]
    );
    return mapAssignmentRow(r.rows[0]);
  }

  async deleteAssignment(id: string): Promise<void> {
    await db.query(`DELETE FROM outlet_assignments WHERE id = $1`, [id]);
  }

  // ===== Overrides (exceptions ad-hoc) =====

  async createOverride(input: {
    workspaceId: string;
    outletId: string;
    userId: string;
    dateFrom: string;
    dateTo: string;
    reason?: string;
    overridesAssignmentId?: string;
    assignedById?: string;
  }): Promise<OutletAssignmentOverride> {
    // Même règle que createAssignment : la session véhicule des codes
    // business (USR-…) mais les colonnes FK sont UUID. On résout pour
    // éviter "invalid input syntax for type uuid".
    const userUuid = await resolveUserUuid(input.userId);
    const assignedByUuid = input.assignedById ? await resolveUserUuid(input.assignedById) : null;

    const r = await db.query(
      `INSERT INTO outlet_assignment_overrides
        (outlet_id, user_id, date_from, date_to, reason, overrides_assignment_id, assigned_by_id, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [input.outletId, userUuid, input.dateFrom, input.dateTo,
       input.reason ?? null, input.overridesAssignmentId ?? null,
       assignedByUuid, input.workspaceId]
    );
    return mapOverrideRow(r.rows[0]);
  }

  async deleteOverride(id: string): Promise<void> {
    await db.query(`DELETE FROM outlet_assignment_overrides WHERE id = $1`, [id]);
  }

  /**
   * Résolveur "qui est sur cet outlet à cette date".
   * Précédence : overrides actifs > assignment de la semaine.
   */
  async getActiveAssignees(outletId: string, atDate?: string): Promise<{ userId: string; source: 'override' | 'assignment' }[]> {
    const date = atDate ?? todayIso();

    // Overrides actifs
    const overrides = await db.query(
      `SELECT user_id FROM outlet_assignment_overrides
       WHERE outlet_id = $1 AND date_from <= $2 AND date_to >= $2`,
      [outletId, date]
    );

    // Assignments de la semaine couvrant la date
    const assignments = await db.query(
      `SELECT user_id FROM outlet_assignments
       WHERE outlet_id = $1 AND week_start <= $2 AND week_end >= $2`,
      [outletId, date]
    );

    const result: { userId: string; source: 'override' | 'assignment' }[] = [];
    const seen = new Set<string>();
    for (const r of overrides.rows) {
      if (!seen.has(r.user_id)) {
        result.push({ userId: r.user_id, source: 'override' });
        seen.add(r.user_id);
      }
    }
    for (const r of assignments.rows) {
      if (!seen.has(r.user_id)) {
        result.push({ userId: r.user_id, source: 'assignment' });
        seen.add(r.user_id);
      }
    }
    return result;
  }

  /** Inverse : sur quel(s) outlet(s) un commercial est-il aujourd'hui ? */
  async getOutletsForUser(userId: string, workspaceId: string, atDate?: string): Promise<string[]> {
    const date = atDate ?? todayIso();
    const r = await db.query(
      `SELECT DISTINCT outlet_id FROM (
         SELECT outlet_id FROM outlet_assignment_overrides
           WHERE user_id = $1 AND workspace_id = $2 AND date_from <= $3 AND date_to >= $3
         UNION
         SELECT outlet_id FROM outlet_assignments
           WHERE user_id = $1 AND workspace_id = $2 AND week_start <= $3 AND week_end >= $3
       ) AS combined`,
      [userId, workspaceId, date]
    );
    return r.rows.map((row: any) => row.outlet_id as string);
  }

  // ===== Moyens de paiement acceptés par outlet =====

  /**
   * Liste les payment_methods (UUID PK) explicitement configurés pour cet
   * outlet. Si aucun n'est configuré, on retourne UN SEUL élément : le
   * payment_method de code 'cash' du workspace (défaut prudent métier).
   *
   * Cette même règle est appliquée côté UI checkout : un outlet sans
   * configuration explicite n'accepte que le cash.
   */
  async listAcceptedPaymentMethods(outletIdOrSlug: string): Promise<string[]> {
    const outletUuid = await resolveUuid('outlets', 'code', outletIdOrSlug);
    if (!outletUuid) throw new Error('Outlet introuvable');

    const r = await db.query(
      `SELECT payment_method_id FROM outlet_payment_methods WHERE outlet_id = $1`,
      [outletUuid]
    );
    if (r.rows.length > 0) {
      return r.rows.map((row: any) => row.payment_method_id as string);
    }
    // Fallback : cash uniquement.
    const wsRow = await db.query(
      `SELECT workspace_id FROM outlets WHERE id = $1 LIMIT 1`,
      [outletUuid]
    );
    if (wsRow.rows.length === 0) return [];
    const cashRow = await db.query(
      `SELECT id FROM payment_methods
       WHERE workspace_id = $1 AND code = 'cash' AND is_active = true
       LIMIT 1`,
      [wsRow.rows[0].workspace_id]
    );
    return cashRow.rows.map((row: any) => row.id as string);
  }

  /**
   * Remplace en bloc la liste des payment_methods acceptés pour cet
   * outlet. Une liste vide réinitialise la configuration : on retombe
   * sur le fallback « cash uniquement ».
   * Atomique : DELETE + INSERT dans une transaction.
   */
  async setAcceptedPaymentMethods(outletIdOrSlug: string, paymentMethodIds: string[]): Promise<void> {
    const outletUuid = await resolveUuid('outlets', 'code', outletIdOrSlug);
    if (!outletUuid) throw new Error('Outlet introuvable');

    await db.transaction(async (client) => {
      await client.query(
        `DELETE FROM outlet_payment_methods WHERE outlet_id = $1`,
        [outletUuid]
      );
      for (const pmId of paymentMethodIds) {
        await client.query(
          `INSERT INTO outlet_payment_methods (outlet_id, payment_method_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [outletUuid, pmId]
        );
      }
    });
  }
}

/**
 * Résolution UUID|business code → UUID PK. Pattern dual-id du projet.
 * Helper local pour éviter d'importer le helper global du stock-transfer-service.
 */
async function resolveUuid(table: string, slugCol: string, value: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM ${table} WHERE id::text = $1 OR ${slugCol} = $1 LIMIT 1`,
    [value]
  );
  return r.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Mappers row -> PascalCase

function mapOutletTypeRow(r: any): OutletType {
  return {
    id: r.id,
    Code: r.code,
    Name: r.name,
    Description: r.description ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapOutletRow(r: any): Outlet {
  return {
    id: r.id,
    Code: r.code,
    Name: r.name,
    OutletTypeId: r.outlet_type_id ?? undefined,
    Address: r.address ?? undefined,
    City: r.city ?? undefined,
    GpsLat: r.gps_lat !== null ? Number(r.gps_lat) : undefined,
    GpsLng: r.gps_lng !== null ? Number(r.gps_lng) : undefined,
    QrToken: r.qr_token,
    ManagerId: r.manager_id ?? undefined,
    IsActive: r.is_active,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapPeriodRow(r: any): OutletPeriod {
  return {
    id: r.id,
    OutletId: r.outlet_id,
    StartDate: toIsoDate(r.start_date)!,
    EndDate: toIsoDate(r.end_date) ?? undefined,
    IsActive: r.is_active,
    IsPaid: r.is_paid,
    FeeAmount: Number(r.fee_amount),
    FeePeriod: r.fee_period,
    Notes: r.notes ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapPriceRow(r: any): OutletPrice {
  return {
    id: r.id,
    ProductId: r.product_id,
    OutletId: r.outlet_id ?? undefined,
    OutletTypeId: r.outlet_type_id ?? undefined,
    UnitPrice: Number(r.unit_price),
    Currency: r.currency,
    ValidFrom: toIsoDate(r.valid_from)!,
    ValidTo: toIsoDate(r.valid_to) ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapAssignmentRow(r: any): OutletAssignment {
  return {
    id: r.id,
    OutletId: r.outlet_id,
    UserId: r.user_id,
    WeekStart: toIsoDate(r.week_start)!,
    WeekEnd: toIsoDate(r.week_end)!,
    AssignedById: r.assigned_by_id ?? undefined,
    Notes: r.notes ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapOverrideRow(r: any): OutletAssignmentOverride {
  return {
    id: r.id,
    OutletId: r.outlet_id,
    UserId: r.user_id,
    DateFrom: toIsoDate(r.date_from)!,
    DateTo: toIsoDate(r.date_to)!,
    Reason: r.reason ?? undefined,
    OverridesAssignmentId: r.overrides_assignment_id ?? undefined,
    AssignedById: r.assigned_by_id ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}
