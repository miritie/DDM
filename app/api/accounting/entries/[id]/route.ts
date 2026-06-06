/**
 * GET /api/accounting/entries/[id] — détail complet d'une écriture.
 *
 * Retourne :
 *   - l'écriture (avec code/libellé du journal, auteur de la
 *     comptabilisation/validation)
 *   - ses lignes débit/crédit (avec numéro + libellé de compte)
 *   - l'opération métier SOURCE retrouvée via la référence :
 *       · dépense (expenses.expense_id)  → sollicitée par qui/quand,
 *         étapes de validation (qui, décision, quand), payée par qui/
 *         quand/comment, catégorie, bénéficiaire
 *       · vente (sales.sale_number)      → quand, vendeur, client, stand,
 *         articles, paiements
 *
 * Accepte l'ID métier (JE-…), le numéro (BAN-2026-0001) ou l'UUID PK.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError, NotFoundError } from '@/lib/http/api-error';

const db = getPostgresClient();

/** Trace « dépense » : sollicitation → validations → paiement. */
async function loadExpenseSource(reference: string, workspaceId: string) {
  const r = await db.query(
    `SELECT e.expense_id, e.title, e.description, e.amount::float AS amount,
            e.status, e.payment_date, e.payment_method,
            cat.label AS category_label,
            payer.full_name  AS paid_by,
            benef.full_name  AS beneficiary,
            er.request_number, er.submitted_at,
            req.full_name    AS requested_by
     FROM expenses e
     LEFT JOIN expense_categories cat ON cat.id = e.category_id
     LEFT JOIN users payer ON payer.id = e.payer_id
     LEFT JOIN users benef ON benef.id = e.beneficiary_id
     LEFT JOIN expense_requests er ON er.id = e.expense_request_id
     LEFT JOIN users req ON req.id = er.requester_id
     WHERE e.expense_id = $1 AND e.workspace_id::text = $2
     LIMIT 1`,
    [reference, workspaceId]
  );
  if (r.rows.length === 0) return null;
  const e = r.rows[0];

  // Étapes de validation de la sollicitation (qui a validé, quand)
  const steps = await db.query(
    `SELECT s.step_order, s.status, s.comments, s.processed_at,
            u.full_name AS approver
     FROM expense_approval_steps s
     LEFT JOIN users u ON u.id = s.approver_id
     LEFT JOIN expense_requests er ON er.id = s.expense_request_id
     LEFT JOIN expenses e ON e.expense_request_id = er.id
     WHERE e.expense_id = $1
     ORDER BY s.step_order ASC`,
    [reference]
  );

  return {
    type: 'expense' as const,
    expenseId: e.expense_id,
    title: e.title,
    description: e.description,
    amount: e.amount,
    status: e.status,
    category: e.category_label,
    requestNumber: e.request_number,
    requestedBy: e.requested_by,
    submittedAt: e.submitted_at,
    approvals: steps.rows.map((s: any) => ({
      order: s.step_order,
      approver: s.approver,
      status: s.status,
      comments: s.comments,
      processedAt: s.processed_at,
    })),
    paidBy: e.paid_by,
    paymentDate: e.payment_date,
    paymentMethod: e.payment_method,
    beneficiary: e.beneficiary,
  };
}

/** Trace « vente » : quand, vendeur, client, stand, articles, paiements. */
async function loadSaleSource(reference: string, workspaceId: string) {
  const r = await db.query(
    `SELECT s.id, s.sale_number, s.sale_date, s.created_at,
            s.total_amount::float AS total_amount,
            s.amount_paid::float  AS amount_paid,
            s.balance::float      AS balance,
            s.status, s.payment_status,
            seller.full_name AS seller,
            COALESCE(c.name, s.client_name) AS client,
            o.name AS outlet
     FROM sales s
     LEFT JOIN users seller ON seller.id = s.sales_person_id
     LEFT JOIN clients c ON c.id = s.client_id
     LEFT JOIN outlets o ON o.id = s.outlet_id
     WHERE s.sale_number = $1 AND s.workspace_id::text = $2
     LIMIT 1`,
    [reference, workspaceId]
  );
  if (r.rows.length === 0) return null;
  const s = r.rows[0];

  const [items, payments] = await Promise.all([
    db.query(
      `SELECT product_name, quantity::float AS quantity,
              unit_price::float AS unit_price, total_price::float AS total_price
       FROM sale_items WHERE sale_id = $1 ORDER BY product_name`,
      [s.id]
    ),
    db.query(
      `SELECT p.payment_number, p.amount::float AS amount, p.payment_date,
              pm.label AS method, w.name AS wallet, u.full_name AS received_by
       FROM sale_payments p
       LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
       LEFT JOIN wallets w ON w.id = p.wallet_id
       LEFT JOIN users u ON u.id = p.received_by_id
       WHERE p.sale_id = $1 ORDER BY p.payment_date`,
      [s.id]
    ),
  ]);

  return {
    type: 'sale' as const,
    saleNumber: s.sale_number,
    date: s.created_at ?? s.sale_date,
    seller: s.seller,
    client: s.client,
    outlet: s.outlet,
    totalAmount: s.total_amount,
    amountPaid: s.amount_paid,
    balance: s.balance,
    status: s.status,
    paymentStatus: s.payment_status,
    items: items.rows,
    payments: payments.rows.map((p: any) => ({
      number: p.payment_number,
      amount: p.amount,
      date: p.payment_date,
      method: p.method,
      wallet: p.wallet,
      receivedBy: p.received_by,
    })),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;

    const entryRes = await db.query(
      `SELECT e.id,
              e.entry_id      AS "EntryId",
              e.entry_number  AS "EntryNumber",
              e.entry_date    AS "EntryDate",
              e.description   AS "Description",
              e.reference     AS "Reference",
              e.status        AS "Status",
              e.posted_at     AS "PostedAt",
              e.validated_at  AS "ValidatedAt",
              e.fiscal_year   AS "FiscalYear",
              e.fiscal_period AS "FiscalPeriod",
              e.created_at    AS "CreatedAt",
              j.code          AS "JournalCode",
              j.label         AS "JournalLabel",
              poster.full_name    AS "PostedBy",
              validator.full_name AS "ValidatedBy"
       FROM journal_entries e
       LEFT JOIN journals j ON j.id = e.journal_id
       LEFT JOIN users poster ON poster.id = e.posted_by_id
       LEFT JOIN users validator ON validator.id = e.validated_by_id
       WHERE (e.entry_id = $1 OR e.entry_number = $1 OR e.id::text = $1)
         AND e.workspace_id::text = $2
       LIMIT 1`,
      [id, workspaceId]
    );
    if (entryRes.rows.length === 0) {
      throw new NotFoundError('Écriture non trouvée');
    }
    const entry = entryRes.rows[0];

    const linesRes = await db.query(
      `SELECT l.line_number   AS "LineNumber",
              l.label         AS "Label",
              l.debit_amount::float  AS "DebitAmount",
              l.credit_amount::float AS "CreditAmount",
              ca.account_number AS "AccountNumber",
              ca.label          AS "AccountLabel"
       FROM journal_entry_lines l
       LEFT JOIN chart_accounts ca ON ca.id = l.account_id
       WHERE l.entry_id = $1
       ORDER BY l.line_number ASC`,
      [entry.id]
    );

    // Opération source via la référence : on tente dépense puis vente —
    // les préfixes ont varié dans l'historique (DEP-, EXP-, VT-, SAL-),
    // le lookup réel est plus fiable qu'un test de préfixe.
    let source = null;
    if (entry.Reference) {
      source =
        (await loadExpenseSource(entry.Reference, workspaceId)) ??
        (await loadSaleSource(entry.Reference, workspaceId));
    }

    const { id: _pk, ...entryPublic } = entry;
    return NextResponse.json({
      data: { entry: entryPublic, lines: linesRes.rows, source },
    });
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement de l'écriture");
  }
}
