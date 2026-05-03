/**
 * Service - Factures mensuelles outlets
 *
 * Le flux est unidirectionnel : on PAIE toujours l'outlet (loyer / hosting fee).
 * Une facture reçue → entrée dans `outlet_invoices`. Quand elle est payée, on bascule
 * en dépense (`expense_id`).
 *
 * Permet aussi un calcul "auto-financement" : ventes_outlet vs frais_outlet sur une période.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { OutletInvoice, OutletInvoiceStatus } from '@/types/modules';

const db = getPostgresClient();

export interface CreateInvoiceInput {
  workspaceId: string;
  outletId: string;
  invoiceNumber: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  currency?: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  attachmentUrl?: string;
}

export class OutletInvoiceService {
  async list(workspaceId: string, filters: { outletId?: string; status?: OutletInvoiceStatus; year?: number; month?: number } = {}): Promise<OutletInvoice[]> {
    const params: any[] = [workspaceId];
    let sql = `SELECT * FROM outlet_invoices WHERE workspace_id = $1`;
    if (filters.outletId) { params.push(filters.outletId); sql += ` AND outlet_id = $${params.length}`; }
    if (filters.status)   { params.push(filters.status);   sql += ` AND status = $${params.length}`; }
    if (filters.year)     { params.push(filters.year);     sql += ` AND period_year = $${params.length}`; }
    if (filters.month)    { params.push(filters.month);    sql += ` AND period_month = $${params.length}`; }
    sql += ` ORDER BY period_year DESC, period_month DESC, due_date DESC`;
    const r = await db.query(sql, params);
    return r.rows.map(mapRow);
  }

  async getById(id: string): Promise<OutletInvoice | null> {
    const r = await db.query(`SELECT * FROM outlet_invoices WHERE id = $1`, [id]);
    return r.rows.length > 0 ? mapRow(r.rows[0]) : null;
  }

  async create(input: CreateInvoiceInput): Promise<OutletInvoice> {
    const r = await db.query(
      `INSERT INTO outlet_invoices
        (outlet_id, invoice_number, period_year, period_month,
         amount, currency, issue_date, due_date,
         notes, attachment_url, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        input.outletId, input.invoiceNumber, input.periodYear, input.periodMonth,
        input.amount, input.currency ?? 'XOF', input.issueDate, input.dueDate,
        input.notes ?? null, input.attachmentUrl ?? null, input.workspaceId,
      ]
    );
    return mapRow(r.rows[0]);
  }

  /** Marque la facture payée et lie éventuellement à une dépense. */
  async markPaid(id: string, paidAmount: number, expenseId?: string): Promise<OutletInvoice> {
    const r = await db.query(
      `UPDATE outlet_invoices
       SET status = 'paid',
           paid_at = CURRENT_TIMESTAMP,
           paid_amount = $2,
           expense_id = COALESCE($3, expense_id)
       WHERE id = $1
       RETURNING *`,
      [id, paidAmount, expenseId ?? null]
    );
    if (r.rows.length === 0) throw new Error('Facture introuvable');
    return mapRow(r.rows[0]);
  }

  async cancel(id: string): Promise<OutletInvoice> {
    const r = await db.query(
      `UPDATE outlet_invoices SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (r.rows.length === 0) throw new Error('Facture introuvable');
    return mapRow(r.rows[0]);
  }

  /** Recalcule les statuts overdue (à appeler périodiquement, e.g. cron quotidien). */
  async refreshOverdue(workspaceId: string): Promise<number> {
    const r = await db.query(
      `UPDATE outlet_invoices
       SET status = 'overdue'
       WHERE workspace_id = $1
         AND status = 'pending'
         AND due_date < CURRENT_DATE`,
      [workspaceId]
    );
    return r.rowCount ?? 0;
  }

  /**
   * Bilan auto-financement : pour un outlet sur une plage,
   * compare ventes (encaissées) et factures (montant dû).
   */
  async getSelfFinancingReport(outletId: string, range: { from: string; to: string }): Promise<{
    salesTotal: number;
    invoicesTotal: number;
    invoicesPaid: number;
    net: number;
    isSelfFinanced: boolean;
  }> {
    const sales = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM sales
       WHERE outlet_id = $1
         AND sale_date >= $2 AND sale_date <= $3
         AND status != 'cancelled'`,
      [outletId, range.from, range.to]
    );
    const invoices = await db.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS total,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END), 0) AS paid
       FROM outlet_invoices
       WHERE outlet_id = $1
         AND issue_date >= $2 AND issue_date <= $3
         AND status != 'cancelled'`,
      [outletId, range.from, range.to]
    );
    const salesTotal = Number(sales.rows[0].total);
    const invoicesTotal = Number(invoices.rows[0].total);
    const invoicesPaid = Number(invoices.rows[0].paid);
    return {
      salesTotal,
      invoicesTotal,
      invoicesPaid,
      net: salesTotal - invoicesTotal,
      isSelfFinanced: salesTotal >= invoicesTotal,
    };
  }
}

function mapRow(r: any): OutletInvoice {
  return {
    id: r.id,
    OutletId: r.outlet_id,
    InvoiceNumber: r.invoice_number,
    PeriodYear: r.period_year,
    PeriodMonth: r.period_month,
    Amount: Number(r.amount),
    Currency: r.currency,
    IssueDate: r.issue_date?.toISOString?.()?.slice(0, 10) ?? r.issue_date,
    DueDate: r.due_date?.toISOString?.()?.slice(0, 10) ?? r.due_date,
    Status: r.status,
    PaidAt: r.paid_at ? (r.paid_at.toISOString?.() ?? r.paid_at) : undefined,
    PaidAmount: Number(r.paid_amount),
    ExpenseId: r.expense_id ?? undefined,
    Notes: r.notes ?? undefined,
    AttachmentUrl: r.attachment_url ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}
