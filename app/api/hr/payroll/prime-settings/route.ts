/**
 * API Route - Paramètres des primes commerciaux
 *
 * GET /api/hr/payroll/prime-settings
 *   { global, products: [{id, name, bonus}], employees: [{id, name, transportDaily}] }
 *   - global : forfait par unité vendue (workspaces.sales_bonus_per_unit,
 *     100 F par défaut — règle métier confirmée)
 *   - products : exceptions par produit (NULL = suit le forfait global)
 *   - employees : prime de transport quotidienne par salarié (2 500 F défaut)
 *
 * PUT — modifie tout ou partie : { global?, products?: [{id, bonus|null}],
 *   employees?: [{id, transportDaily}] }. Permission hr:edit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { ensurePayrollTable } from '@/lib/modules/hr/payroll-service';
import { handleApiError, ValidationError } from '@/lib/http/api-error';

const db = getPostgresClient();

async function ensureColumns() {
  await ensurePayrollTable(); // employees.transport_daily
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_bonus_per_unit DECIMAL(15, 2)`);
  await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sales_bonus_per_unit DECIMAL(15, 2) DEFAULT 100`);
  await db.query(`UPDATE workspaces SET sales_bonus_per_unit = 100 WHERE sales_bonus_per_unit IS NULL`);
}

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    await ensureColumns();

    const [wsR, productsR, employeesR] = await Promise.all([
      db.query(`SELECT sales_bonus_per_unit::float AS g FROM workspaces WHERE id = $1`, [workspaceId]),
      db.query(
        `SELECT id, name, sales_bonus_per_unit::float AS bonus
         FROM products WHERE workspace_id = $1 AND is_active = true ORDER BY name`,
        [workspaceId]
      ),
      db.query(
        `SELECT id, full_name AS name, position, transport_daily::float AS "transportDaily"
         FROM employees WHERE workspace_id = $1 AND status = 'active' ORDER BY full_name`,
        [workspaceId]
      ),
    ]);

    return NextResponse.json({
      data: {
        global: wsR.rows[0]?.g ?? 100,
        products: productsR.rows,
        employees: employeesR.rows,
      },
    });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des paramètres');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    await ensureColumns();

    const body = await request.json().catch(() => ({}));
    const { global: globalBonus, products, employees } = body as {
      global?: number;
      products?: Array<{ id: string; bonus: number | null }>;
      employees?: Array<{ id: string; transportDaily: number }>;
    };

    if (globalBonus !== undefined) {
      if (typeof globalBonus !== 'number' || globalBonus < 0 || globalBonus > 100000) {
        throw new ValidationError('Forfait global invalide (0 à 100 000 F)');
      }
      await db.query(
        `UPDATE workspaces SET sales_bonus_per_unit = $1 WHERE id = $2`,
        [globalBonus, workspaceId]
      );
    }

    for (const p of products ?? []) {
      if (p.bonus !== null && (typeof p.bonus !== 'number' || p.bonus < 0 || p.bonus > 100000)) {
        throw new ValidationError('Forfait produit invalide (0 à 100 000 F, ou vide = global)');
      }
      await db.query(
        `UPDATE products SET sales_bonus_per_unit = $1 WHERE id = $2 AND workspace_id = $3`,
        [p.bonus, p.id, workspaceId]
      );
    }

    for (const e of employees ?? []) {
      if (typeof e.transportDaily !== 'number' || e.transportDaily < 0 || e.transportDaily > 100000) {
        throw new ValidationError('Prime de transport invalide (0 à 100 000 F)');
      }
      await db.query(
        `UPDATE employees SET transport_daily = $1 WHERE id = $2 AND workspace_id = $3`,
        [e.transportDaily, e.id, workspaceId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la mise à jour des paramètres');
  }
}
