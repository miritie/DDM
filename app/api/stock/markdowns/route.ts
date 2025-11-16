/**
 * API Route - /api/stock/markdowns
 * Gestion des démarques (pertes, casses, vols, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAirtableClient } from '@/lib/airtable/client';

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
 * Liste des démarques avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId');
    const reason = searchParams.get('reason');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const airtable = getAirtableClient();
    const base = airtable.base(process.env.AIRTABLE_BASE_ID!);

    let filterFormula = '';
    const filters: string[] = [];

    if (warehouseId) {
      filters.push(`{WarehouseId} = '${warehouseId}'`);
    }

    if (reason) {
      filters.push(`FIND('${reason}', {Reason}) > 0`);
    }

    if (startDate) {
      filters.push(`{MarkdownDate} >= '${startDate}'`);
    }

    if (endDate) {
      filters.push(`{MarkdownDate} <= '${endDate}'`);
    }

    if (filters.length > 0) {
      filterFormula = `AND(${filters.join(', ')})`;
    }

    const records = await base('StockMarkdowns')
      .select({
        filterByFormula: filterFormula || undefined,
        sort: [{ field: 'MarkdownDate', direction: 'desc' }],
      })
      .all();

    const markdowns = records.map((record) => ({
      MarkdownId: record.id,
      ...record.fields,
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
        error: 'Erreur lors de la récupération des démarques',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock/markdowns
 * Créer une nouvelle démarque (avec mouvement de stock automatique)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createMarkdownSchema.parse(body);

    const airtable = getAirtableClient();
    const base = airtable.base(process.env.AIRTABLE_BASE_ID!);

    // Générer numéro de démarque
    const markdownNumber = `DEM-${Date.now()}`;

    // Calculer totaux
    const totalQuantity = validatedData.lines.reduce((sum, line) => sum + line.quantity, 0);

    // Créer la démarque
    const markdownRecord = await base('StockMarkdowns').create({
      MarkdownNumber: markdownNumber,
      WarehouseId: validatedData.warehouseId,
      MarkdownDate: validatedData.markdownDate,
      TotalQuantity: totalQuantity,
      Status: 'pending',
      Notes: validatedData.notes,
      CreatedAt: new Date().toISOString(),
    });

    // Créer les lignes
    const lineRecords = await Promise.all(
      validatedData.lines.map((line) =>
        base('StockMarkdownLines').create({
          MarkdownId: markdownRecord.id,
          ProductId: line.productId,
          Quantity: line.quantity,
          Reason: line.reason,
          Notes: line.notes,
          PhotoUrl: line.photoUrl,
        })
      )
    );

    // Créer mouvement de stock automatique (sortie)
    const movement = await base('StockMovements').create({
      MovementNumber: `MVT-${Date.now()}`,
      MovementType: 'adjustment',
      SourceWarehouseId: validatedData.warehouseId,
      MovementDate: validatedData.markdownDate,
      Status: 'pending',
      Reason: 'markdown',
      ReferenceType: 'markdown',
      ReferenceId: markdownRecord.id,
      Notes: `Démarque ${markdownNumber}`,
      CreatedAt: new Date().toISOString(),
    });

    // Créer lignes de mouvement
    await Promise.all(
      validatedData.lines.map((line) =>
        base('StockMovementLines').create({
          MovementId: movement.id,
          ProductId: line.productId,
          Quantity: -line.quantity, // Négatif pour sortie
          UnitCost: 0,
        })
      )
    );

    // Valider automatiquement le mouvement pour déduire le stock
    await base('StockMovements').update(movement.id, {
      Status: 'completed',
      ValidatedAt: new Date().toISOString(),
    });

    // Mettre à jour le stock pour chaque produit
    for (const line of validatedData.lines) {
      const stockItems = await base('StockItems')
        .select({
          filterByFormula: `AND({ProductId} = '${line.productId}', {WarehouseId} = '${validatedData.warehouseId}')`,
        })
        .firstPage();

      if (stockItems.length > 0) {
        const currentStock = stockItems[0];
        const currentQuantity = (currentStock.fields.Quantity as number) || 0;
        const newQuantity = Math.max(0, currentQuantity - line.quantity);

        await base('StockItems').update(currentStock.id, {
          Quantity: newQuantity,
          LastUpdated: new Date().toISOString(),
        });
      }
    }

    // Valider la démarque
    await base('StockMarkdowns').update(markdownRecord.id, {
      Status: 'validated',
      MovementId: movement.id,
      LineIds: lineRecords.map((r) => r.id),
      ValidatedAt: new Date().toISOString(),
    });

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
          error: 'Données invalides',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Error creating markdown:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la création de la démarque',
      },
      { status: 500 }
    );
  }
}
