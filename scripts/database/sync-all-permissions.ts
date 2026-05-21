#!/usr/bin/env tsx
/**
 * Synchronise en DB toutes les permissions déclarées dans
 * `lib/rbac/permissions.ts`. Idempotent.
 *
 * Pourquoi
 *   La table `permissions` est la source des permissions visibles dans
 *   l'UI Admin > Rôles. Quand on ajoute une nouvelle constante dans
 *   PERMISSIONS sans script de migration dédié, elle n'apparaît jamais
 *   dans l'interface et reste un fantôme : aucun rôle ne peut l'avoir,
 *   les pages qui l'exigent renvoient toujours « Accès refusé ».
 *
 *   Ce script lit directement l'export TypeScript, insère ce qui manque,
 *   et **réactive** les permissions qui auraient été désactivées. Il ne
 *   supprime jamais une permission existante (un autre rôle ou un
 *   anciens code pourrait encore s'y référer).
 *
 * Usage : tsx scripts/database/sync-all-permissions.ts
 */
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PERMISSIONS } from '../../lib/rbac/permissions';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

/** Devine un nom lisible et un module à partir du code 'foo:bar_baz'. */
function describe(code: string): { name: string; module: string } {
  const [moduleRaw, actionRaw] = code.split(':');
  const module = moduleRaw || 'general';
  const action = (actionRaw || '').replace(/_/g, ' ');
  // Capitalise pour donner un libellé lisible : "ingredient inventory" → "Inventory ingredient"
  const name = action
    ? `${action.charAt(0).toUpperCase()}${action.slice(1)} (${module})`
    : code;
  return { name, module };
}

async function main() {
  const codes = Object.values(PERMISSIONS) as string[];
  console.log(`🚀 Sync de ${codes.length} permissions déclarées en code…`);

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // Snapshot avant
    const before = await pool.query(`SELECT code, is_active FROM permissions`);
    const existing = new Map(before.rows.map((r: any) => [r.code, r.is_active]));

    let inserted = 0;
    let reactivated = 0;
    let kept = 0;

    for (const code of codes) {
      const { name, module } = describe(code);
      const had = existing.has(code);
      const wasActive = existing.get(code) === true;

      if (!had) {
        await pool.query(
          `INSERT INTO permissions (permission_id, code, name, module, description, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (code) DO NOTHING`,
          [code, code, name, module, name]
        );
        console.log(`✅ INSERT  ${code.padEnd(36)} (${module})`);
        inserted++;
      } else if (!wasActive) {
        await pool.query(`UPDATE permissions SET is_active = true WHERE code = $1`, [code]);
        console.log(`♻️  REACTIVATE ${code}`);
        reactivated++;
      } else {
        kept++;
      }
    }

    // Permissions présentes en DB mais plus déclarées en code — on les
    // signale uniquement (jamais de DELETE auto : un rôle pourrait s'y
    // référer ou un code legacy pourrait revenir).
    const codesSet = new Set(codes);
    const orphans = before.rows
      .filter((r: any) => !codesSet.has(r.code))
      .map((r: any) => r.code);
    if (orphans.length > 0) {
      console.log('\n⚠️  Permissions en DB sans constante en code (non touchées) :');
      orphans.forEach((c: string) => console.log(`   • ${c}`));
    }

    console.log(
      `\nRésumé : ${inserted} insérée(s), ${reactivated} réactivée(s), ` +
      `${kept} déjà à jour, ${orphans.length} orpheline(s).`
    );

    // Total visible dans l'UI
    const totalActiveR = await pool.query(`SELECT COUNT(*)::int AS n FROM permissions WHERE is_active = true`);
    console.log(`📊 ${totalActiveR.rows[0].n} permissions actives en DB, visibles côté Admin > Rôles.`);
  } catch (e: any) {
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
