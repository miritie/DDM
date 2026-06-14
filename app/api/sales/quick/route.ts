/**
 * API Route - Vente Rapide (POS)
 * POST /api/sales/quick
 *
 * Body :
 *   - outletId (required) : sur quel point de vente
 *   - items : [{ productId, quantity }]  ← unitPrice est ignoré, résolu via outlet_prices
 *   - clientId? : si client identifié
 *   - scanId? : id d'un pending_client_scan à consommer
 *   - paymentMethod (default 'cash')
 *   - loyaltyRuleId?, discountAmount?
 *   - gpsLat?, gpsLng?, gpsAccuracy? : pour pointage GPS de la session POS
 *
 * Comportement :
 *   - Garantit une session POS (implicite ou réutilise l'active)
 *   - Résout chaque prix via OutletService (refus si non listé pour cet outlet)
 *   - Décrémente le stock outlet
 *   - Marque le scan consommé si fourni
 *   - Crée la vente CONFIRMEE avec son journal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUser } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';
import { StockService } from '@/lib/modules/stock/stock-service';
import { ScanQueueService } from '@/lib/modules/outlets/scan-queue-service';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { AccountingOutboxService, ensureOutboxTable } from '@/lib/modules/accounting/accounting-outbox-service';
import { assertPositiveFinishedProductQuantity } from '@/lib/schemas/quantity';
import { generateSaleNumber, generatePaymentNumber } from '@/lib/modules/sales/document-numbers';
import { handleApiError, ConflictError } from '@/lib/http/api-error';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();
const outletService = new OutletService();
const posSessionService = new PosSessionService();
const stockService = new StockService();
const scanQueue = new ScanQueueService();
const paymentMethodService = new PaymentMethodService();
const transactionService = new TransactionService();
const outbox = new AccountingOutboxService();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const user = await getCurrentUser();
    const body = await request.json();

    const {
      outletId,
      items,
      clientId = null,
      scanId = null,
      paymentMethod = 'cash',
      walletId = null,             // wallet utilisé pour le paiement (null si crédit)
      amountPaid = null,           // montant encaissé maintenant (null = total ; 0 = crédit)
      notes,
      loyaltyRuleId = null,
      discountAmount = 0,
      gpsLat,
      gpsLng,
      gpsAccuracy,
    } = body;

    // ===== Validation =====
    if (!outletId) {
      return NextResponse.json({ error: 'outletId requis' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Au moins un article est requis' }, { status: 400 });
    }
    const outlet = await outletService.getById(outletId);
    if (!outlet || !outlet.IsActive) {
      return NextResponse.json({ error: 'Point de vente introuvable ou inactif' }, { status: 404 });
    }

    // ===== Vendeur (UUID) =====
    const sellerRes = await db.query(`SELECT id FROM users WHERE user_id = $1 LIMIT 1`, [user.userId]);
    if (sellerRes.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur connecté introuvable' }, { status: 404 });
    }
    const sellerUuid = sellerRes.rows[0].id;

    // ===== Session POS (réutilise l'active ou crée implicite) =====
    let session = await posSessionService.getActiveSession(outletId, sellerUuid);
    if (!session) {
      session = await posSessionService.open({
        workspaceId, outletId, userId: sellerUuid,
        startMethod: 'implicit', gpsLat, gpsLng, gpsAccuracy,
      });
    }

    // ===== Résolution prix outlet pour chaque ligne =====
    const today = new Date().toISOString().slice(0, 10);
    const lines: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }> = [];
    let subtotal = 0;

    for (const item of items) {
      // Quantité : entier strictement positif (sinon une quantité négative
      // réduirait le total ET augmenterait le stock au décrément).
      assertPositiveFinishedProductQuantity(item.quantity, `Quantité pour ${item.productId}`);

      // id::text pour éviter que pg infère $1 comme uuid (à cause du
      // id = $1) puis échoue sur product_id = $1::uuid (product_id est
      // varchar) : « operator does not exist: character varying = uuid ».
      const prodRes = await db.query(
        `SELECT id, name, code FROM products WHERE id::text = $1 OR product_id = $1 LIMIT 1`,
        [item.productId]
      );
      if (prodRes.rows.length === 0) {
        return NextResponse.json({ error: `Produit ${item.productId} introuvable` }, { status: 404 });
      }
      const product = prodRes.rows[0];

      const price = await outletService.resolvePrice(product.id, outletId, today);
      if (!price) {
        return NextResponse.json({
          error: `Aucun prix défini pour "${product.name}" sur le point de vente "${outlet.Name}"`
        }, { status: 422 });
      }

      const unitPrice = Number(price.UnitPrice);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      lines.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: lineTotal,
      });
    }

    const loyaltyDiscount = Math.max(0, Number(discountAmount) || 0);
    const totalAmount = Math.max(0, subtotal - loyaltyDiscount);

    // ===== Numéro de vente =====
    // Helper partagé : séquence atomique unique par workspace+année pour
    // SAL- et VT- (seed = max des suffixes existants, anti-collision).
    const saleNumber = await generateSaleNumber(workspaceId, 'VT');
    const saleUuid = uuidv4();

    // ===== Calcul du paiement immédiat =====
    // - amountPaid = null  → on paie le total (sauf si paymentMethod='credit')
    // - paymentMethod='credit' + amountPaid=null → 0 payé
    // - sinon respecter la valeur fournie (clamp [0, totalAmount])
    let paidNow: number;
    if (amountPaid === null || amountPaid === undefined) {
      paidNow = paymentMethod === 'credit' ? 0 : totalAmount;
    } else {
      const requested = Number(amountPaid);
      if (!Number.isFinite(requested)) {
        return NextResponse.json({ error: 'Montant encaissé invalide' }, { status: 400 });
      }
      paidNow = Math.max(0, Math.min(requested, totalAmount));
    }
    const balance = totalAmount - paidNow;
    const paymentStatus =
      balance === 0 ? 'fully_paid' :
      paidNow > 0   ? 'partially_paid' :
                      'unpaid';

    // ===== Résolutions AVANT toute écriture =====
    // (l'ancien code insérait la vente PUIS validait le moyen de paiement :
    // un moyen invalide laissait une vente orpheline sans lignes ni paiement)
    let walletUuid: string | null = null;
    let paymentMethodId: string | null = null;
    let paymentNumber: string | null = null;
    if (paidNow > 0) {
      // Règle métier : AUCUN encaissement sans caisse. Tout argent qui
      // rentre doit être rattaché à un wallet (trésorerie + écritures
      // comptables) — sinon écart de caisse invisible.
      if (!walletId) {
        return NextResponse.json(
          { error: 'Aucune caisse sélectionnée pour cet encaissement. Configurez une caisse (wallet) pour ce point de vente avant de vendre.' },
          { status: 400 }
        );
      }
      // Résout walletId : accepte UUID ou slug `wallet_id` VARCHAR.
      const wr = await db.query(
        `SELECT id FROM wallets WHERE id::text = $1 OR wallet_id = $1 LIMIT 1`,
        [walletId]
      );
      walletUuid = wr.rows[0]?.id ?? null;
      if (!walletUuid) {
        return NextResponse.json(
          { error: `Caisse introuvable : ${walletId}. Vérifiez la configuration des caisses.` },
          { status: 400 }
        );
      }

      // Mode crédit = vente à crédit, pas un moyen de paiement : on ne trace
      // pas dans sale_payments. Quand `paidNow > 0` ET paymentMethod === 'credit'
      // ça signifie un acompte → on doit choisir un vrai moyen (cash par défaut).
      const methodCode = paymentMethod === 'credit' ? 'cash' : paymentMethod;
      const pm = await paymentMethodService.getByCode(workspaceId, methodCode);
      if (!pm?.Id) {
        return NextResponse.json(
          { error: `Moyen de paiement "${methodCode}" introuvable ou inactif.` },
          { status: 400 }
        );
      }
      paymentMethodId = pm.Id;
      // Séquence PAY- partagée avec les autres chemins d'encaissement
      // (l'ancien suffixe Date.now() pouvait collisionner dans la même ms).
      paymentNumber = await generatePaymentNumber(workspaceId);
    }

    // Table outbox garantie AVANT la transaction (l'enqueue se fait dedans).
    await ensureOutboxTable();

    // ===== Écritures atomiques : vente + paiement + crédit caisse + lignes =====
    // Tout réussit ou rien n'est écrit — plus de vente partielle en DB.
    // Casts explicites : pg ne peut pas inférer le type des paramètres
    // null (client_id, notes, loyalty_rule_id) sans cast, ce qui faisait
    // remonter « could not determine data type of parameter $5 » en
    // vente anonyme.
    const sale = await db.transaction(async (client) => {
      const saleRes = await client.query(
        `INSERT INTO sales
          (sale_id, sale_number, client_id, total_amount, amount_paid, balance,
           currency, status, payment_status, sale_date, notes,
           sales_person_id, outlet_id, pos_session_id, workspace_id,
           loyalty_rule_id, discount_amount)
         VALUES ($1, $2, $3::uuid, $4, $5, $6,
                 $7, $8, $9, CURRENT_DATE, $10::text,
                 $11::uuid, $12::uuid, $13::uuid, $14::uuid,
                 $15::uuid, $16)
         RETURNING *`,
        [
          saleUuid, saleNumber, clientId, totalAmount,
          paidNow, balance,
          'XOF', 'confirmed', paymentStatus,
          notes ?? null, sellerUuid, outletId, session.id, workspaceId,
          loyaltyRuleId, loyaltyDiscount,
        ]
      );
      const createdSale = saleRes.rows[0];

      // Trace le paiement dans sale_payments si quelque chose a été encaissé
      if (paidNow > 0) {
        const payIns = await client.query(
          `INSERT INTO sale_payments
            (payment_id, sale_id, payment_number, amount, payment_method_id, payment_date,
             wallet_id, received_by_id, workspace_id, notes)
           VALUES ($1, $2::uuid, $3, $4, $5::uuid, CURRENT_TIMESTAMP,
                   $6::uuid, $7::uuid, $8::uuid, $9::text)
           RETURNING id`,
          [
            uuidv4(), createdSale.id, paymentNumber, paidNow, paymentMethodId,
            walletUuid, sellerUuid, workspaceId,
            paymentMethod === 'credit' && paidNow > 0 ? 'Acompte sur vente à crédit' : null,
          ]
        );
        createdSale._payment_row_id = payIns.rows[0]?.id ?? null;

        // ===== Crédit de caisse ATOMIQUE (dans la même transaction) =====
        // Un encaissement enregistré mouvemente TOUJOURS le tiroir, sinon
        // tout est annulé (rollback). Fini la divergence silencieuse entre
        // sale_payments et le solde du wallet.
        await transactionService.createIncomeInClient(client, {
          type: 'income',
          category: 'sale',
          amount: paidNow,
          destinationWalletId: walletUuid!,
          description: `Encaissement vente ${saleNumber} — ${paymentNumber}`,
          reference: saleNumber,
          processedById: sellerUuid,
          workspaceId,
        });
      }

      for (const line of lines) {
        await client.query(
          `INSERT INTO sale_items
            (sale_item_id, sale_id, product_id, product_name,
             quantity, unit_price, total_price, currency)
           VALUES ($1, $2::uuid, $3::uuid, $4,
                   $5, $6, $7, 'XOF')`,
          [uuidv4(), createdSale.id, line.productId, line.productName,
           line.quantity, line.unitPrice, line.totalPrice]
        );

        // ===== Décrément stock BLOQUANT (dans la transaction) =====
        // Règle métier : TOUT stock est suivi. Une information de stock
        // absente ou non définie vaut ZÉRO → vente refusée. Si la quantité
        // est insuffisante, la vente ENTIÈRE est refusée (rollback : ni
        // vente, ni paiement, ni lignes). L'UPDATE conditionnel est
        // atomique : deux caisses simultanées ne peuvent pas vendre la
        // même dernière unité.
        const st = await client.query(
          `UPDATE stock_items
           SET quantity = quantity - $3,
               total_value = (quantity - $3) * unit_cost,
               updated_at = CURRENT_TIMESTAMP
           WHERE product_id = $1 AND outlet_id = $2 AND quantity >= $3
           RETURNING quantity::float AS quantity`,
          [line.productId, outletId, line.quantity]
        );
        if (st.rows.length === 0) {
          const existing = await client.query(
            `SELECT quantity::float AS quantity FROM stock_items
             WHERE product_id = $1 AND outlet_id = $2 LIMIT 1`,
            [line.productId, outletId]
          );
          // Pas de ligne stock = 0 disponible (tout stock est suivi).
          const dispo = existing.rows.length > 0 ? Number(existing.rows[0].quantity) : 0;
          throw new ConflictError(
            `Stock insuffisant pour ${line.productName} : ${dispo} disponible(s), ${line.quantity} demandé(s). Vente annulée.`
          );
        }
      }

      // ===== Outbox comptable : intentions d'écriture DURABLES =====
      // Inscrites dans la MÊME transaction → si la vente est validée, les
      // écritures à produire sont garanties (jamais perdues), même si la
      // génération immédiate échoue (plan comptable absent…).
      await outbox.enqueueInClient(client, {
        workspaceId, sourceType: 'sale', sourceId: createdSale.id, reference: saleNumber,
      });
      if (createdSale._payment_row_id) {
        await outbox.enqueueInClient(client, {
          workspaceId, sourceType: 'sale_payment', sourceId: createdSale._payment_row_id, reference: paymentNumber,
        });
      }

      return createdSale;
    });

    // ===== Génération comptable immédiate (best-effort, MAIS tracée) =====
    // Le crédit de caisse est désormais fait DANS la transaction ci-dessus
    // (atomique). Ici on tente seulement de produire les écritures que
    // l'outbox a inscrites de façon durable : succès → statut 'done',
    // échec → reste 'pending' et régularisable plus tard. La vente n'est
    // jamais bloquée ; aucune écriture n'est jamais perdue.
    try {
      const sourceIds = [sale.id, sale._payment_row_id].filter(Boolean) as string[];
      await outbox.process({ workspaceId, sourceIds });
    } catch (e: any) {
      console.warn(`[compta] outbox vente ${sale.sale_number}: ${e.message}`);
    }

    // Alertes stock bas (best-effort, après commit — le décrément lui-même
    // est désormais fait DANS la transaction de vente, en bloquant).
    for (const line of lines) {
      try {
        const item = await stockService.getByProductAndOutlet(line.productId, outletId);
        if (item) await stockService.checkAndCreateAlert(item);
      } catch (e: any) {
        console.warn(`[stock-alerte] ${line.productName}: ${e.message}`);
      }
    }

    // ===== Consomme le scan client si fourni =====
    if (scanId) {
      try {
        await scanQueue.consume(scanId, sale.id);
      } catch (e: any) {
        console.warn(`[scan] consume ${scanId}: ${e.message}`);
      }
    }

    return NextResponse.json({
      data: {
        SaleId: sale.sale_id,
        SaleNumber: sale.sale_number,
        ClientId: sale.client_id,
        TotalAmount: Number(sale.total_amount),
        AmountPaid: Number(sale.amount_paid),
        Balance: Number(sale.balance),
        Currency: sale.currency,
        Status: sale.status,
        PaymentStatus: sale.payment_status,
        SaleDate: sale.sale_date,
        Notes: sale.notes,
        OutletId: sale.outlet_id,
        PosSessionId: sale.pos_session_id,
        SalesPersonId: sale.sales_person_id,
        WorkspaceId: sale.workspace_id,
        DiscountAmount: Number(sale.discount_amount),
        CreatedAt: sale.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de l'encaissement");
  }
}
