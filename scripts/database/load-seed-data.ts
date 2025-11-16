#!/usr/bin/env tsx
/**
 * Script pour charger les données de test sur Neon PostgreSQL
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function loadSeedData(): Promise<void> {
  console.log('\n📄 Chargement de seed-data.sql...');

  try {
    const seedFile = path.join(__dirname, 'seed-data.sql');
    const sql = fs.readFileSync(seedFile, 'utf-8');

    // Exécuter le SQL
    await pool.query(sql);

    console.log('✅ Données de test chargées avec succès');
  } catch (error: any) {
    console.error('❌ Erreur lors du chargement des données:');
    console.error(error.message);
    throw error;
  }
}

async function verifyData(): Promise<void> {
  console.log('\n📊 Vérification des données chargées...');

  const tables = [
    'workspaces',
    'users',
    'products',
    'customers',
    'sales',
    'sale_items',
    'wallets',
    'warehouses',
    'stock_items'
  ];

  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    const count = result.rows[0].count;
    console.log(`  ${table.padEnd(20)} : ${count} enregistrement(s)`);
  }
}

async function main() {
  console.log('🚀 Chargement des données de test sur Neon...');
  console.log(`📡 Connexion à: ${DATABASE_URL!.split('@')[1].split('?')[0]}`);

  try {
    // Test de connexion
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion à la base de données réussie');

    // Charger les données
    await loadSeedData();

    // Vérification
    await verifyData();

    console.log('\n🎉 Données de test chargées avec succès!');
    console.log('\n📝 Vous pouvez maintenant tester l\'application avec PostgreSQL');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
