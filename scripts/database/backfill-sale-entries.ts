#!/usr/bin/env tsx
/**
 * Rattrapage : génère les écritures comptables des ventes et encaissements
 * passés (journal VT : D411/C701 ; journaux CAI/BAN/MM : D5xx/C411).
 *
 * Idempotent — la génération saute les écritures déjà existantes
 * (référence = sale_number / payment_number). Relançable à volonté ;
 * exécuté automatiquement après chaque déploiement (deploy.yml).
 *
 * Usage : npm run backfill:sale-entries
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL manquant'); process.exit(1); }

import { getPostgresClient } from '../../lib/database/postgres-client';
import { JournalGenerationService } from '../../lib/modules/accounting/journal-generation-service';

const db = getPostgresClient();
const gen = new JournalGenerationService();

async function main() {
  console.log('🚀 Rattrapage des écritures comptables de ventes…');

  // 1. Ventes (hors brouillons et annulées)
  const sales = await db.query<any>(
    `SELECT id, sale_number FROM sales
     WHERE status NOT IN ('draft', 'cancelled')
     ORDER BY created_at ASC`
  );
  let saleOk = 0, saleSkip = 0, saleErr = 0;
  for (const s of sales.rows) {
    try {
      const before = await db.query(
        `SELECT 1 FROM journal_entries WHERE reference = $1 AND description LIKE 'Vente %' LIMIT 1`,
        [s.sale_number]
      );
      if (before.rows.length > 0) { saleSkip++; continue; }
      await gen.fromSale(s.id);
      saleOk++;
      console.log(`  ✅ VT  ${s.sale_number}`);
    } catch (e: any) {
      saleErr++;
      console.warn(`  ⚠️  ${s.sale_number}: ${e.message}`);
    }
  }

  // 2. Encaissements
  const payments = await db.query<any>(
    `SELECT p.id, p.payment_number FROM sale_payments p
     JOIN sales s ON s.id = p.sale_id
     WHERE s.status NOT IN ('draft', 'cancelled')
     ORDER BY p.payment_date ASC`
  );
  let payOk = 0, paySkip = 0, payErr = 0;
  for (const pmt of payments.rows) {
    try {
      const before = await db.query(
        `SELECT 1 FROM journal_entries WHERE reference = $1 LIMIT 1`,
        [pmt.payment_number]
      );
      if (before.rows.length > 0) { paySkip++; continue; }
      await gen.fromSalePayment(pmt.id);
      payOk++;
      console.log(`  ✅ ENC ${pmt.payment_number}`);
    } catch (e: any) {
      payErr++;
      console.warn(`  ⚠️  ${pmt.payment_number}: ${e.message}`);
    }
  }

  console.log(
    `\nRésumé ventes : ${saleOk} générée(s), ${saleSkip} déjà présente(s), ${saleErr} en erreur.` +
    `\nRésumé encaissements : ${payOk} généré(s), ${paySkip} déjà présent(s), ${payErr} en erreur.`
  );
  if (saleErr + payErr > 0) {
    console.log('ℹ️  Les erreurs typiques : plan comptable non initialisé (comptes 411/701/571) — corriger puis relancer.');
  }
  await db.close();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
