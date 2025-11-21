/**
 * API Route - /api/stock/markdowns
 * Gestion des demarques (pertes, casses, vols, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPostgresClient } from '@/lib/database/postgres-client';

const postgresClient = getPostgresClient();

const markdownLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  reason: z.enum(['damaged', 'expired', 'theft', 'loss', 'quality', 'other']),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
});

const createMarkdownSchema = z.object({
  warehouseId: z.string(),
  markdownDate: z.string(),
  lines: z.array(markdownLineSchema).min(1),
  notes: z.string().optional(),
});

/**
 * GET /api/stock/markdowns
 * Liste des demarques avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      filters.push(`warehouse_id = $${paramIndex++}`);
      values.push(warehouseId);
    }

    if (reason) {
      filters.push(`reason ILIKE $${paramIndex++}`);
      values.push(`%${reason}%`);
    }

    if (startDate) {
      filters.push(`markdown_date >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      filters.push(`markdown_date <= $${paramIndex++}`);
      values.push(endDate);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const records = await postgresClient.query(
      `SELECT * FROM stock_markdowns ${whereClause} ORDER BY markdown_date DESC`,
      values
    );

    const markdowns = records.rows.map((record: any) => ({
      MarkdownId: record.id,
      MarkdownNumber: record.markdown_number,
      WarehouseId: record.warehouse_id,
      MarkdownDate: record.markdown_date,
      TotalQuantity: record.total_quantity,
      Status: record.status,
      Notes: record.notes,
      MovementId: record.movement_id,
      LineIds: record.line_ids,
      ValidatedAt: record.validated_at,
      CreatedAt: record.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: markdowns,
    });
  } catch (error) {
    console.error('Error fetching markdowns:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la recuperation des demarques',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock/markdowns
 * Creer une nouvelle demarque (avec mouvement de stock automatique)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createMarkdownSchema.parse(body);

    // Generer numero de demarque
    const markdownNumber = `DEM-${Date.now()}`;

    // Calculer totaux
    const totalQuantity = validatedData.lines.reduce((sum, line) => sum + line.quantity, 0);

    // Creer la demarque
    const markdownRecords = await postgresClient.query(
      `INSERT INTO stock_markdowns (markdown_number, warehouse_id, markdown_date, total_quantity, status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        markdownNumber,
        validatedData.warehouseId,
        validatedData.markdownDate,
        totalQuantity,
        'pending',
        validatedData.notes,
        new Date().toISOString(),
      ]
    );

    const markdownRecord = markdownRecords.rows[0];

    // Creer les lignes
    const lineIds: string[] = [];
    for (const line of validatedData.lines) {
      const lineRecords = await postgresClient.query(
        `INSERT INTO stock_markdown_lines (markdown_id, product_id, quantity, reason, notes, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          markdownRecord.id,
          line.productId,
          line.quantity,
          line.reason,
          line.notes,
          line.photoUrl,
        ]
      );
      lineIds.push(lineRecords.rows[0].id);
    }

    // Creer mouvement de stock automatique (sortie)
    const movementRecords = await postgresClient.query(
      `INSERT INTO stock_movements (movement_number, movement_type, source_warehouse_id, movement_date, status, reason, reference_type, reference_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        `MVT-${Date.now()}`,
        'adjustment',
        validatedData.warehouseId,
        validatedData.markdownDate,
        'pending',
        'markdown',
        'markdown',
        markdownRecord.id,
        `Demarque ${markdownNumber}`,
        new Date().toISOString(),
      ]
    );

    const movement = movementRecords.rows[0];

    // Creer lignes de mouvement
    for (const line of validatedData.lines) {
      await postgresClient.query(
        `INSERT INTO stock_movement_lines (movement_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [movement.id, line.productId, -line.quantity, 0]
      );
    }

    // Valider automatiquement le mouvement pour deduire le stock
    await postgresClient.query(
      `UPDATE stock_movements SET status = $1, validated_at = $2 WHERE id = $3`,
      ['completed', new Date().toISOString(), movement.id]
    );

    // Mettre a jour le stock pour chaque produit
    for (const line of validatedData.lines) {
      const stockItems = await postgresClient.query(
        `SELECT * FROM stock_items WHERE product_id = $1 AND warehouse_id = $2`,
        [line.productId, validatedData.warehouseId]
      );

      if (stockItems.rows.length > 0) {
        const currentStock = stockItems.rows[0];
        const currentQuantity = currentStock.quantity || 0;
        const newQuantity = Math.max(0, currentQuantity - line.quantity);

        await postgresClient.query(
          `UPDATE stock_items SET quantity = $1, last_updated = $2 WHERE id = $3`,
          [newQuantity, new Date().toISOString(), currentStock.id]
        );
      }
    }

    // Valider la demarque
    await postgresClient.query(
      `UPDATE stock_markdowns SET status = $1, movement_id = $2, line_ids = $3, validated_at = $4 WHERE id = $5`,
      ['validated', movement.id, lineIds, new Date().toISOString(), markdownRecord.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        MarkdownId: markdownRecord.id,
        MarkdownNumber: markdownNumber,
        MovementId: movement.id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Donnees invalides',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error creating markdown:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la creation de la demarque',
      },
      { status: 500 }
    );
  }
}
