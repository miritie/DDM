#!/usr/bin/env tsx
/**
 * Ajoute la colonne `is_production_source` à la table `warehouses`.
 *
 * Pourquoi
 *   Un transfert de stock initié depuis l'interface Production ne peut
 *   pas avoir n'importe quel entrepôt comme source : seuls les entrepôts
 *   physiquement adossés à l'unité de production (l'usine) sont
 *   légitimes. On marque ces entrepôts par un booléen porté sur la
 *   table `warehouses`, modifiable depuis l'admin entrepôts.
 *
 *   À l'exécution initiale, marque automatiquement WH-001 comme source
 *   de production (c'est l'entrepôt « Usine » de Bouaflé, identifié au
 *   moment de l'audit). Aucune autre modification automatique.
 *
 * Idempotent — réexécutable sans danger.
 */
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // 1. Ajout de la colonne (no-op si déjà présente)
    await pool.query(`
      ALTER TABLE warehouses
      ADD COLUMN IF NOT EXISTS is_production_source boolean NOT NULL DEFAULT false
    `);
    console.log('✅ Colonne is_production_source garantie sur warehouses');

    // 2. Auto-flag de WH-001 (Usine) — seulement s'il existe et n'a
    // jamais été marqué (on n'écrase pas un éventuel false explicite).
    const r = await pool.query(`
      UPDATE warehouses
         SET is_production_source = true, updated_at = now()
       WHERE code = 'WH-001' AND is_production_source = false
       RETURNING code, name
    `);
    if (r.rowCount && r.rowCount > 0) {
      console.log(`✅ WH-001 (${r.rows[0].name}) marqué comme source de production`);
    } else {
      console.log('↪️  WH-001 déjà marqué ou inexistant — aucun changement');
    }

    // 3. Récap
    const all = await pool.query(`
      SELECT code, name, is_production_source AS prod, is_active AS active
      FROM warehouses
      ORDER BY code
    `);
    console.log('\nÉtat des entrepôts :');
    console.table(all.rows);
  } catch (e: any) {
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
