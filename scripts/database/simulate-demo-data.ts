#!/usr/bin/env tsx
/**
 * SIMULATION — Jeu de données cohérent (démo / recette)
 *
 * ⚠️  DESTRUCTIF : purge toutes les données OPÉRATIONNELLES (ventes,
 *     dépenses, trésorerie, écritures, production) puis simule l'activité
 *     de janvier 2020 à aujourd'hui. Les référentiels (produits, stands,
 *     utilisateurs, plan comptable, catégories) sont conservés/complétés.
 *     JAMAIS exécuté automatiquement — lancement manuel uniquement :
 *
 *         npm run simulate:demo -- --yes
 *
 *     Également disponible en ligne via /admin/simulate (API par étapes).
 *     Toute la logique vit dans lib/demo/simulation-service.ts.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL manquant'); process.exit(1); }
if (!process.argv.includes('--yes')) {
  console.error('⚠️  Script DESTRUCTIF (purge ventes/dépenses/trésorerie/écritures).');
  console.error('    Relancer avec :  npm run simulate:demo -- --yes');
  process.exit(1);
}

async function main() {
  // Import après dotenv pour que DATABASE_URL soit disponible
  const { simulatePrepare, simulateYearStep, simulateFinalize } = await import('../../lib/demo/simulation-service');

  console.log('🎬 Simulation du jeu de données — janvier 2020 → aujourd\'hui\n');

  console.log('🧹 Purge des données opérationnelles + référentiels…');
  const prep = await simulatePrepare();
  for (const w of prep.warnings) console.warn(`   ⚠️ ${w}`);
  console.log(`   ✅ ${prep.outlets} stand(s), ${prep.products} produit(s) — années : ${prep.years.join(', ')}`);

  for (const year of prep.years) {
    const res = await simulateYearStep(year);
    console.log(`   📈 ${year} : ${res.sales} ventes · CA ${new Intl.NumberFormat('fr-FR').format(res.ca)} XOF · ${res.entries} écritures · ${res.expenses} dépenses`);
  }

  console.log('📦 Stocks finaux (entrepôt + stands)…');
  const fin = await simulateFinalize();

  console.log('\n══════════════ RÉSUMÉ ══════════════');
  for (const s of fin.summary) {
    console.log(`  CA ${s.year} : ${new Intl.NumberFormat('fr-FR').format(s.ca)} XOF (${s.sales} ventes)`);
  }
  console.log(`  Écritures : ${fin.entries} · Transactions : ${fin.transactions} · Stocks : ${fin.stockItems} lignes`);
  console.log('═════════════════════════════════════');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
