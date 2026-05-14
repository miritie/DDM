#!/usr/bin/env tsx
/**
 * Migration 2a — Moyens de paiement en table activable (additive)
 *
 * Crée la table `payment_methods`, la peuple à partir de l'enum existant,
 * et ajoute des colonnes FK nullables `payment_method_id` en parallèle des
 * colonnes `payment_method` actuelles. ZÉRO impact code applicatif.
 *
 * Idempotent : peut être ré-exécuté sans effet de bord.
 *
 * Usage :
 *   tsx scripts/database/apply-migration-2a.ts            # exécute
 *   tsx scripts/database/apply-migration-2a.ts --dry-run  # affiche le SQL sans rien faire
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const MIGRATION_FILE = path.join(__dirname, 'migration-2a-payment-methods.sql');

async function main() {
  console.log('🚀 Migration 2a — Moyens de paiement (table activable)');
  console.log(`📡 Cible : ${DATABASE_URL!.split('@')[1].split('?')[0]}`);
  console.log(DRY_RUN ? '🔍 Mode DRY-RUN (aucune modification)' : '✍️  Mode WRITE (modifications appliquées)');

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');

  if (DRY_RUN) {
    console.log('\n--- SQL qui serait exécuté ---\n');
    console.log(sql);
    console.log('\n--- Fin du SQL ---');
    return;
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion établie');

    console.log('\n📄 Application de migration-2a-payment-methods.sql ...');
    await pool.query(sql);
    console.log('✅ Migration appliquée');

    // Vérifications
    console.log('\n📊 Vérifications post-migration :');

    const tbl = await pool.query(`
      SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'payment_methods'
    `);
    console.log(`  • table payment_methods : ${tbl.rows[0].n === 1 ? '✅' : '❌'}`);

    const rows = await pool.query('SELECT COUNT(*)::int AS n FROM payment_methods');
    console.log(`  • lignes seed : ${rows.rows[0].n}`);

    const cols = await pool.query(`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name IN ('payment_method_id', 'preferred_payment_method_id')
      ORDER BY table_name
    `);
    console.log(`  • colonnes FK ajoutées dans : ${cols.rows.map(r => r.table_name).join(', ') || '(aucune)'}`);

    console.log('\n🎉 Migration 2a terminée. Aucun code applicatif modifié.');
    console.log('   Prochaine étape (2b) : services + UI admin + lectures duales.');
  } catch (error: any) {
    console.error('\n❌ Erreur :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
