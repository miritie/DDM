#!/usr/bin/env tsx
/**
 * Script pour exécuter les schémas SQL sur Neon PostgreSQL
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

async function executeSQLFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Exécution de ${fileName}...`);

  try {
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Exécuter le SQL
    await pool.query(sql);

    console.log(`✅ ${fileName} exécuté avec succès`);
  } catch (error: any) {
    console.error(`❌ Erreur lors de l'exécution de ${fileName}:`);
    console.error(error.message);
    throw error;
  }
}

async function verifyTables(): Promise<void> {
  console.log('\n📊 Vérification des tables créées...');

  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);

  const tableCount = parseInt(result.rows[0].count);
  console.log(`✅ ${tableCount} tables créées`);

  if (tableCount >= 60) {
    console.log('🎉 Toutes les tables ont été créées avec succès!');
  } else {
    console.log(`⚠️  Nombre de tables attendu: 60, trouvé: ${tableCount}`);
  }
}

async function main() {
  console.log('🚀 Création du schéma PostgreSQL sur Neon...');
  console.log(`📡 Connexion à: ${DATABASE_URL.split('@')[1].split('?')[0]}`);

  try {
    // Test de connexion
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion à la base de données réussie');

    // Exécuter les schémas dans l'ordre
    const schemaDir = __dirname;

    await executeSQLFile(path.join(schemaDir, 'schema.sql'));
    await executeSQLFile(path.join(schemaDir, 'schema-part2.sql'));
    await executeSQLFile(path.join(schemaDir, 'schema-part3.sql'));

    // Vérification
    await verifyTables();

    console.log('\n🎉 Schéma créé avec succès!');
    console.log('\n📝 Prochaine étape: Exécuter seed-data.sql pour ajouter des données de test');
    console.log('   npm run db:seed');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
