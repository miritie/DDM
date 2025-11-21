/**
 * API Route - Vente Rapide
 * POST /api/sales/quick - Creer une vente en 1 clic avec paiement automatique
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUser } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const user = await getCurrentUser();
    const body = await request.json();

    const { clientId, items, paymentMethod = 'cash', notes } = body;

    // 1. Recuperer les produits pour calculer les prix
    const products: any[] = [];
    for (const item of items) {
      const productResults = await postgresClient.query(
        `SELECT * FROM products WHERE product_id = $1`,
        [item.productId]
      );
      if (productResults.rows.length > 0) {
        products.push(productResults.rows[0]);
      } else {
        products.push(null);
      }
    }

    // 2. Calculer les totaux
    let subtotal = 0;
    let totalDiscount = 0;

    const linesData = items.map((item: any, index: number) => {
      const product = products[index];
      if (!product) throw new Error(`Produit ${item.productId} non trouve`);

      const unitPrice = item.unitPrice || product.unit_price;
      const lineTotal = unitPrice * item.quantity;
      const lineDiscount = item.discount || 0;
      const lineTotalWithDiscount = lineTotal - lineDiscount;

      subtotal += lineTotal;
      totalDiscount += lineDiscount;

      return {
        product,
        quantity: item.quantity,
        unitPrice,
        discount: lineDiscount,
        totalPrice: lineTotalWithDiscount,
      };
    });

    const totalAmount = subtotal - totalDiscount;

    // 3. Generer le numero de vente
    const year = new Date().getFullYear();
    const sales = await postgresClient.query(
      `SELECT COUNT(*) as count FROM sales WHERE workspace_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
      [workspaceId, year]
    );

    const saleCount = parseInt(sales.rows[0]?.count || '0', 10);
    const saleNumber = `VT-${year}-${String(saleCount + 1).padStart(4, '0')}`;
    const saleId = uuidv4();

    // 4. Creer la vente CONFIRMEE (vente directe!)
    const now = new Date().toISOString();
    const saleDate = new Date().toISOString().split('T')[0];

    const createdSales = await postgresClient.query(
      `INSERT INTO sales (sale_id, sale_number, client_id, total_amount, amount_paid, balance, currency, status, payment_status, sale_date, notes, sales_person_id, workspace_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        saleId,
        saleNumber,
        clientId,
        totalAmount,
        paymentMethod === 'credit' ? 0 : totalAmount,
        paymentMethod === 'credit' ? totalAmount : 0,
        'XOF',
        'confirmed', // Vente confirmee instantanement
        paymentMethod === 'credit' ? 'unpaid' : 'fully_paid',
        saleDate,
        notes,
        user.userId,
        workspaceId,
        now,
        now,
      ]
    );

    const createdSale = createdSales.rows[0];

    // 5. Ajouter les lignes de vente
    for (const lineData of linesData) {
      const saleItemId = uuidv4();
      await postgresClient.query(
        `INSERT INTO sale_items (sale_item_id, sale_id, product_id, product_name, quantity, unit_price, total_price, currency, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          saleItemId,
          saleId,
          lineData.product.product_id,
          lineData.product.name,
          lineData.quantity,
          lineData.unitPrice,
          lineData.totalPrice,
          'XOF',
          now,
          now,
        ]
      );
    }

    // Format response
    const formattedSale = {
      SaleId: createdSale.sale_id,
      SaleNumber: createdSale.sale_number,
      ClientId: createdSale.client_id,
      TotalAmount: createdSale.total_amount,
      AmountPaid: createdSale.amount_paid,
      Balance: createdSale.balance,
      Currency: createdSale.currency,
      Status: createdSale.status,
      PaymentStatus: createdSale.payment_status,
      SaleDate: createdSale.sale_date,
      Notes: createdSale.notes,
      SalesPersonId: createdSale.sales_person_id,
      WorkspaceId: createdSale.workspace_id,
      CreatedAt: createdSale.created_at,
      UpdatedAt: createdSale.updated_at,
    };

    return NextResponse.json({ data: formattedSale }, { status: 201 });
  } catch (error: any) {
    console.error('Quick sale error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
