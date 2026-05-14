#!/usr/bin/env tsx
/**
 * Réconcilie customer_orders.amount_paid / balance à partir des paiements réels.
 *
 * Cause : un bug dans CustomerOrderService.create() comptait l'avance deux fois
 * (INSERT met amount_paid=advance, puis recordPayment ajoute encore advance).
 * Corrigé le 2026-05-14 — ce script réconcilie les enregistrements antérieurs.
 *
 * Pour chaque commande non-terminée :
 *   - somme les paiements réels depuis customer_order_payments
 *   - compare avec customer_orders.amount_paid
 *   - si écart, met à jour amount_paid + balance
 *
 * Mode dry-run par défaut. Passer --apply pour écrire.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

const APPLY = process.argv.includes('--apply');

async function main() {
  const orders = await pool.query(
    `SELECT id, order_number, status, total_amount, amount_paid, balance
     FROM customer_orders
     WHERE status NOT IN ('cancelled', 'completed')
     ORDER BY created_at`
  );

  let drift = 0;
  for (const o of orders.rows) {
    const p = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS s
       FROM customer_order_payments WHERE customer_order_id = $1`,
      [o.id]
    );
    const realPaid = Number(p.rows[0].s);
    const recordedPaid = Number(o.amount_paid);
    const total = Number(o.total_amount);

    if (Math.abs(realPaid - recordedPaid) < 0.001) {
      console.log(`✓ ${o.order_number} OK (paid=${realPaid}/${total})`);
      continue;
    }

    drift++;
    const newBalance = total - realPaid;
    console.log(
      `⚠ ${o.order_number} : amount_paid recorded=${recordedPaid} → real=${realPaid} | balance recorded=${o.balance} → ${newBalance}`
    );

    if (APPLY) {
      await pool.query(
        `UPDATE customer_orders
         SET amount_paid = $2, balance = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [o.id, realPaid, newBalance]
      );
      console.log(`  ↳ ✅ corrigé`);
    }
  }

  console.log(`\n${drift} commande(s) avec écart. ${APPLY ? 'Appliqué.' : 'Mode dry-run — passer --apply pour écrire.'}`);
  await pool.end();
}

main().catch((e) => {
  console.error('Erreur :', e);
  process.exit(1);
});
