/**
 * GET /api/dashboard/pca-margins
 *
 * Données confidentielles PCA :
 *   - marges par produit (basé sur recettes actives × PMP courants vs prix de vente)
 *   - top / bottom marges
 *   - alertes MP sous le minimum
 *   - évolution coût matière (placeholder : prochaine itération via ingredient_receptions)
 *
 * Permission : recipe:view_formula (secret de fabrication).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const db = getPostgresClient();

export async function GET(_req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.RECIPE_VIEW_FORMULA);
    const workspaceId = await getCurrentWorkspaceId();

    // Marges par recette active (coût matière unitaire vs prix de vente du produit)
    const marginsR = await db.query(
      `WITH recipe_cost AS (
         SELECT
           r.id                                                            AS recipe_uuid,
           r.recipe_id                                                     AS recipe_slug,
           r.name                                                          AS recipe_name,
           r.product_id                                                    AS product_uuid,
           r.output_quantity                                               AS output_qty,
           r.yield_rate                                                    AS yield_rate,
           COALESCE(SUM(rl.quantity * i.unit_cost), 0)::numeric            AS total_material_cost
         FROM recipes r
         LEFT JOIN recipe_lines rl ON rl.recipe_id = r.id
         LEFT JOIN ingredients i ON i.id = rl.ingredient_id
         WHERE r.workspace_id = $1 AND r.is_active = true
         GROUP BY r.id, r.recipe_id, r.name, r.product_id, r.output_quantity, r.yield_rate
       )
       SELECT
         rc.recipe_slug                                AS "RecipeId",
         rc.recipe_name                                AS "RecipeName",
         p.name                                        AS "ProductName",
         p.unit_price::numeric                         AS "UnitPrice",
         rc.output_qty::numeric                        AS "OutputQty",
         rc.yield_rate::numeric                        AS "YieldRate",
         rc.total_material_cost                        AS "TotalMaterialCost",
         CASE WHEN rc.output_qty > 0 THEN (rc.total_material_cost / rc.output_qty)::numeric ELSE 0 END
                                                       AS "CostPerUnit",
         (p.unit_price - CASE WHEN rc.output_qty > 0 THEN rc.total_material_cost / rc.output_qty ELSE 0 END)::numeric
                                                       AS "MarginPerUnit",
         CASE WHEN p.unit_price > 0 THEN
           ((p.unit_price - CASE WHEN rc.output_qty > 0 THEN rc.total_material_cost / rc.output_qty ELSE 0 END) / p.unit_price * 100)::numeric
         ELSE 0 END                                    AS "MarginRate"
       FROM recipe_cost rc
       JOIN products p ON p.id = rc.product_uuid
       ORDER BY p.name`,
      [workspaceId]
    );

    // Ingrédients sous mini
    const belowR = await db.query(
      `SELECT
         ingredient_id AS "IngredientId",
         name          AS "Name",
         current_stock AS "CurrentStock",
         minimum_stock AS "MinimumStock",
         unit          AS "Unit"
       FROM ingredients
       WHERE workspace_id = $1 AND is_active = true AND current_stock < minimum_stock
       ORDER BY name`,
      [workspaceId]
    );

    // Valeur totale stock MP
    const valR = await db.query(
      `SELECT COALESCE(SUM(current_stock * unit_cost), 0)::numeric AS v
       FROM ingredients WHERE workspace_id = $1`,
      [workspaceId]
    );

    const margins = marginsR.rows.map((r) => ({
      ...r,
      UnitPrice: Number(r.UnitPrice),
      OutputQty: Number(r.OutputQty),
      YieldRate: Number(r.YieldRate),
      TotalMaterialCost: Number(r.TotalMaterialCost),
      CostPerUnit: Number(r.CostPerUnit),
      MarginPerUnit: Number(r.MarginPerUnit),
      MarginRate: Number(r.MarginRate),
    }));
    margins.sort((a, b) => b.MarginRate - a.MarginRate);

    return NextResponse.json({
      data: {
        margins,
        topMargins: margins.slice(0, 5),
        bottomMargins: margins.filter((m) => m.MarginPerUnit <= 0 || m.MarginRate < 30).slice(0, 5),
        ingredientsBelowMinimum: belowR.rows,
        totalStockValue: Number(valR.rows[0].v),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
