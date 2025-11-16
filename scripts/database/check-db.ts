#!/usr/bin/env tsx
/**
 * Script pour vérifier l'état de la base de données Neon
 */

import { Pool } from 'pg';
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

async function checkDatabase(): Promise<void> {
  console.log('🔍 Vérification de la base de données...\n');

  // Lister toutes les tables
  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log(`📊 Tables existantes (${tablesResult.rows.length}):`);
  tablesResult.rows.forEach(row => {
    console.log(`  - ${row.table_name}`);
  });

  // Compter les enregistrements dans les principales tables
  console.log('\n📈 Nombre d\'enregistrements:');
  const countTables = [
    'workspaces', 'users', 'products', 'customers', 'sales',
    'sale_items', 'wallets', 'warehouses', 'stock_items'
  ];

  for (const table of countTables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.rows[0].count;
      console.log(`  ${table.padEnd(20)} : ${count}`);
    } catch (error: any) {
      console.log(`  ${table.padEnd(20)} : Table non trouvée`);
    }
  }
}

async function main() {
  console.log('🚀 État de la base de données Neon PostgreSQL\n');
  console.log(`📡 Connexion: ${DATABASE_URL.split('@')[1].split('?')[0]}\n`);

  try {
    // Test de connexion
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Connexion réussie à ${result.rows[0].now}\n`);

    await checkDatabase();

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
