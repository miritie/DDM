/**
 * API Route - Vente Rapide ⚡
 * POST /api/sales/quick - Créer une vente en 1 clic avec paiement automatique
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUser } from '@/lib/auth/get-session';
import { Sale, SaleItem, Product } from '@/types/modules';
import { AirtableClient } from '@/lib/airtable/client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const user = await getCurrentUser();
    const body = await request.json();

    const { clientId, items, paymentMethod = 'cash', notes } = body;

    // 1. Récupérer les produits pour calculer les prix
    const productPromises = items.map((item: any) =>
      airtableClient.list<Product>('Product', {
        filterByFormula: `{ProductId} = '${item.productId}'`,
      })
    );

    const productsResults = await Promise.all(productPromises);
    const products = productsResults.map(result => result[0]).filter(Boolean);

    // 2. Calculer les totaux
    let subtotal = 0;
    let totalDiscount = 0;

    const linesData = items.map((item: any, index: number) => {
      const product = products[index];
      if (!product) throw new Error(`Produit ${item.productId} non trouvé`);

      const unitPrice = item.unitPrice || product.UnitPrice;
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

    // 3. Générer le numéro de vente
    const year = new Date().getFullYear();
    const sales = await airtableClient.list<Sale>('Sale', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year})`,
    });

    const saleNumber = `VT-${year}-${String(sales.length + 1).padStart(4, '0')}`;
    const saleId = uuidv4();

    // 4. Créer la vente CONFIRMÉE (vente directe!)
    const sale: Partial<Sale> = {
      SaleId: saleId,
      SaleNumber: saleNumber,
      ClientId: clientId,
      TotalAmount: totalAmount,
      AmountPaid: paymentMethod === 'credit' ? 0 : totalAmount,
      Balance: paymentMethod === 'credit' ? totalAmount : 0,
      Currency: 'XOF',
      Status: 'confirmed', // ⚡ Vente confirmée instantanément
      PaymentStatus: paymentMethod === 'credit' ? 'unpaid' : 'fully_paid',
      SaleDate: new Date().toISOString().split('T')[0],
      Notes: notes,
      SalesPersonId: user.userId,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdSale = await airtableClient.create<Sale>('Sale', sale);

    // 5. Ajouter les lignes de vente
    for (const lineData of linesData) {
      const saleLine: Partial<SaleItem> = {
        SaleItemId: uuidv4(),
        SaleId: saleId,
        ProductId: lineData.product.ProductId,
        ProductName: lineData.product.Name,
        Quantity: lineData.quantity,
        UnitPrice: lineData.unitPrice,
        TotalPrice: lineData.totalPrice,
        Currency: 'XOF',
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      await airtableClient.create<SaleItem>('SaleItem', saleLine);
    }

    return NextResponse.json({ data: createdSale }, { status: 201 });
  } catch (error: any) {
    console.error('Quick sale error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
