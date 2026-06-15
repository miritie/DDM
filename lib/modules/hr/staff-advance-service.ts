/**
 * Service - Avances au personnel (dette interne)
 *
 * Réalité PME : on avance de l'argent à un employé, récupéré sur son
 * prochain salaire. Système LEAN et fonctionnel (table
 * employee_advances_simple), distinct du service legacy
 * employee-advance-service (478 lignes, non câblé, filtres cassés).
 *
 * Octroi = versement immédiat :
 *   - débit de la caisse/banque choisie (transaction de trésorerie)
 *   - écriture D 425 Avances au personnel / C 5xx (outbox, durable)
 *   - statut 'open', recovered = 0
 * Récupération : automatique au moment de générer le bulletin du mois
 *   (cf. payroll-service.create) → réduit le net, crédite 425.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';
import { ensurePayrollTable } from './payroll-service';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { AccountingOutboxService } from '@/lib/modules/accounting/accounting-outbox-service';

const db = getPostgresClient();
const transactions = new TransactionService();
const outbox = new AccountingOutboxService();

export class StaffAdvanceService {
  /** Octroie et verse une avance immédiatement depuis une caisse/banque. */
  async grant(input: {
    workspaceId: string; employeeId: string; amount: number;
    walletId: string; reason?: string; grantedById: string;
  }): Promise<any> {
    await ensurePayrollTable();
    if (!(input.amount > 0)) throw new Error('Montant invalide');

    const empR = await db.query(
      `SELECT id, full_name FROM employees
       WHERE workspace_id = $1 AND (id::text = $2 OR employee_id = $2) LIMIT 1`,
      [input.workspaceId, input.employeeId]
    );
    if (!empR.rows[0]) throw new Error('Employé introuvable');
    const employee = empR.rows[0];

    const seqR = await db.query(
      `SELECT COUNT(*)::int + 1 AS n FROM employee_advances_simple
       WHERE workspace_id = $1 AND to_char(granted_at, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')`,
      [input.workspaceId]
    );
    const period = new Date().toISOString().slice(0, 7).replace('-', '');
    const advanceNumber = `AVA-${period}-${String(seqR.rows[0].n).padStart(3, '0')}`;

    // Débit caisse + insertion avance, atomiques.
    const advanceId = await db.transaction(async (client) => {
      const tx = await transactions.createExpense({
        type: 'expense', category: 'advance', amount: input.amount,
        sourceWalletId: input.walletId,
        description: `Avance au personnel ${advanceNumber} — ${employee.full_name}`,
        reference: advanceNumber, processedById: input.grantedById, workspaceId: input.workspaceId,
      });
      const userR = await client.query(`SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`, [input.grantedById]);
      const grantedByUuid = userR.rows[0]?.id ?? null;
      const wR = await client.query(`SELECT id FROM wallets WHERE id::text = $1 OR wallet_id = $1 LIMIT 1`, [input.walletId]);
      const walletUuid = wR.rows[0]?.id ?? null;
      const ins = await client.query(
        `INSERT INTO employee_advances_simple
           (advance_number, employee_id, amount, reason, wallet_id, transaction_id, granted_by_id, workspace_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [advanceNumber, employee.id, input.amount, input.reason ?? null, walletUuid, (tx as any).id ?? null, grantedByUuid, input.workspaceId]
      );
      return ins.rows[0].id;
    });

    // Écriture D 425 / C 5xx — durable via outbox, best-effort.
    await outbox.enqueue({ workspaceId: input.workspaceId, sourceType: 'advance_grant', sourceId: advanceId, reference: advanceNumber });
    await outbox.process({ workspaceId: input.workspaceId, sourceIds: [advanceId] }).catch(() => {});

    return this.getById(advanceId);
  }

  async getById(id: string): Promise<any> {
    const r = await db.query(
      `SELECT a.id, a.advance_number AS "AdvanceNumber", a.amount::float AS "Amount",
              a.recovered::float AS "Recovered", (a.amount - a.recovered)::float AS "Outstanding",
              a.status AS "Status", a.reason AS "Reason", a.granted_at AS "GrantedAt",
              e.full_name AS "EmployeeName", e.employee_id AS "EmployeeCode", a.employee_id AS "EmployeeUuid"
       FROM employee_advances_simple a JOIN employees e ON e.id = a.employee_id
       WHERE a.id::text = $1 LIMIT 1`, [id]);
    return r.rows[0] ?? null;
  }

  async list(workspaceId: string, opts: { status?: string } = {}): Promise<any[]> {
    await ensurePayrollTable();
    const params: any[] = [workspaceId];
    let where = `a.workspace_id = $1`;
    if (opts.status) { params.push(opts.status); where += ` AND a.status = $${params.length}`; }
    const r = await db.query(
      `SELECT a.id, a.advance_number AS "AdvanceNumber", a.amount::float AS "Amount",
              a.recovered::float AS "Recovered", (a.amount - a.recovered)::float AS "Outstanding",
              a.status AS "Status", a.reason AS "Reason", a.granted_at AS "GrantedAt",
              e.full_name AS "EmployeeName"
       FROM employee_advances_simple a JOIN employees e ON e.id = a.employee_id
       WHERE ${where} ORDER BY a.granted_at DESC LIMIT 500`, params);
    return r.rows;
  }

  /** Encours total des avances d'un employé (à récupérer). */
  async outstandingForEmployee(workspaceId: string, employeeUuid: string): Promise<number> {
    const r = await db.query(
      `SELECT COALESCE(SUM(amount - recovered), 0)::float AS total
       FROM employee_advances_simple
       WHERE workspace_id = $1 AND employee_id = $2 AND status = 'open'`,
      [workspaceId, employeeUuid]
    );
    return Math.round(Number(r.rows[0].total) || 0);
  }

  /**
   * Impute une récupération sur les avances ouvertes d'un employé (FIFO),
   * dans la limite du montant fourni. Appelé par la génération de paie.
   * Retourne le montant réellement récupéré.
   */
  async applyRecovery(workspaceId: string, employeeUuid: string, amount: number): Promise<number> {
    if (!(amount > 0)) return 0;
    let remaining = Math.round(amount);
    const open = (await db.query(
      `SELECT id, (amount - recovered)::float AS outstanding
       FROM employee_advances_simple
       WHERE workspace_id = $1 AND employee_id = $2 AND status = 'open'
       ORDER BY granted_at ASC`,
      [workspaceId, employeeUuid]
    )).rows;
    let recovered = 0;
    for (const a of open) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Math.round(Number(a.outstanding)));
      if (take <= 0) continue;
      await db.query(
        `UPDATE employee_advances_simple
         SET recovered = recovered + $2,
             status = CASE WHEN recovered + $2 >= amount - 0.01 THEN 'recovered' ELSE 'open' END
         WHERE id = $1`,
        [a.id, take]
      );
      remaining -= take;
      recovered += take;
    }
    return recovered;
  }
}
