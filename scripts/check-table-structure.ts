#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

async function checkTableStructure() {
  const client = getPostgresClient();

  try {
    console.log('📊 Structure de la table permissions:\n');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'permissions'
      ORDER BY ordinal_position
    `);

    console.table(result.rows);

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.close();
  }
}

checkTableStructure();
