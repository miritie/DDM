#!/usr/bin/env tsx
/**
 * Garantit que CHAQUE point de vente actif possède sa caisse cash dédiée.
 *
 * Depuis que tout encaissement exige un wallet (et que le journal de
 * caisse / Z-out raisonnent par stand), un stand sans caisse ne peut
 * plus vendre en espèces. Ce script, idempotent et relançable :
 *
 *   0. Ajoute la colonne wallets.outlet_id (lien explicite stand ↔ caisse,
 *      remplace la convention fragile « le nom contient le nom du stand »)
 *   1. Pour chaque outlet actif sans caisse liée :
 *        a. ADOPTE un wallet cash actif existant dont le nom matche le
 *           nom du stand (convention V1) → pose outlet_id dessus
 *        b. sinon CRÉE « Caisse <Nom du stand> » (type cash, solde 0)
 *   2. Mappe chart_account_id → compte 571 (Caisse) si présent au plan,
 *      pour que les écritures comptables d'encaissement soient correctes.
 *
 * Exécuté automatiquement après chaque déploiement (deploy.yml).
 * Usage manuel : npm run setup:outlet-wallets
 */
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL) { console.error('❌ DATABASE_URL manquant'); process.exit(1); }

const useSsl = DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('neon.tech');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: useSsl ? { rejectUnauthorized: false } : undefined });

async function main() {
  console.log('🚀 Caisse par stand — vérification/configuration…');

  // 0. Lien explicite stand ↔ caisse (idempotent)
  await pool.query(
    `ALTER TABLE wallets ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wallets_outlet_id ON wallets(outlet_id) WHERE outlet_id IS NOT NULL`
  );

  const outlets = await pool.query(
    `SELECT o.id, o.code, o.name, o.workspace_id
     FROM outlets o WHERE o.is_active = true
     ORDER BY o.name`
  );

  let linked = 0, adopted = 0, created = 0, mapped = 0;

  for (const o of outlets.rows) {
    // Compte 571 (Caisse) du workspace, pour le mapping comptable
    const acc = await pool.query(
      `SELECT id FROM chart_accounts
       WHERE workspace_id = $1 AND account_number LIKE '571%'
       ORDER BY account_number LIMIT 1`,
      [o.workspace_id]
    );
    const cashAccountId = acc.rows[0]?.id ?? null;

    // Déjà une caisse liée ?
    const existing = await pool.query(
      `SELECT id, name, chart_account_id FROM wallets
       WHERE outlet_id = $1 AND type = 'cash' AND is_active = true LIMIT 1`,
      [o.id]
    );
    let wallet = existing.rows[0];

    if (!wallet) {
      // a. Adoption par convention de nom (V1)
      const match = await pool.query(
        `SELECT id, name, chart_account_id FROM wallets
         WHERE workspace_id = $1 AND type = 'cash' AND is_active = true
           AND outlet_id IS NULL AND name ILIKE $2
         ORDER BY name LIMIT 1`,
        [o.workspace_id, '%' + o.name + '%']
      );
      wallet = match.rows[0];
      if (wallet) {
        await pool.query(`UPDATE wallets SET outlet_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [o.id, wallet.id]);
        adopted++;
        console.log(`  🔗 ADOPTÉ  « ${wallet.name} » → ${o.name}`);
      }
    } else {
      linked++;
    }

    if (!wallet) {
      // b. Création de la caisse du stand
      const name = `Caisse ${o.name}`;
      const code = `CASH-${(o.code || o.name).toString().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20)}`;
      const ins = await pool.query(
        `INSERT INTO wallets
           (wallet_id, name, code, type, currency, balance, initial_balance,
            status, is_active, workspace_id, outlet_id, chart_account_id, description)
         VALUES ($1, $2, $3, 'cash', 'XOF', 0, 0, 'active', true, $4, $5, $6,
                 'Caisse espèces du stand — créée automatiquement')
         RETURNING id, name`,
        [randomUUID(), name, code, o.workspace_id, o.id, cashAccountId]
      );
      wallet = ins.rows[0];
      created++;
      console.log(`  ✅ CRÉÉ    « ${wallet.name} » (${code})${cashAccountId ? ' — compte 571 mappé' : ''}`);
      continue;
    }

    // 2. Mapping comptable si manquant
    if (wallet && !wallet.chart_account_id && cashAccountId) {
      await pool.query(`UPDATE wallets SET chart_account_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [cashAccountId, wallet.id]);
      mapped++;
      console.log(`  🧮 MAPPÉ   « ${wallet.name} » → compte 571`);
    }
  }

  console.log(
    `\nRésumé : ${outlets.rows.length} stand(s) actif(s) — ` +
    `${linked} déjà lié(s), ${adopted} adopté(s), ${created} créé(s), ${mapped} mapping(s) comptable(s) ajouté(s).`
  );
  await pool.end();
}

main().catch(e => { console.error('❌', e); process.exit(1); });
