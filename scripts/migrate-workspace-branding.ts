#!/usr/bin/env tsx
/**
 * Ajoute les colonnes de branding sur workspaces, sans reset.
 * Idempotent — relançable autant de fois que voulu.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

const ALTERS = [
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slogan VARCHAR(255)`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS address TEXT`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo_url TEXT`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'XOF' NOT NULL`,
  `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Abidjan' NOT NULL`,
];

(async () => {
  console.log('🔧 Migration : branding workspaces');
  for (const sql of ALTERS) {
    await pool.query(sql);
    console.log(`   ✅ ${sql.split('ADD COLUMN IF NOT EXISTS')[1]?.trim().split(' ')[0] || sql}`);
  }
  // Pré-remplit le workspace Dune de Miel avec un slogan par défaut
  await pool.query(
    `UPDATE workspaces
     SET slogan = COALESCE(slogan, 'Le meilleur du miel'),
         address = COALESCE(address, 'Abidjan, Côte d''Ivoire'),
         phone = COALESCE(phone, ''),
         email = COALESCE(email, '')
     WHERE slug = 'dune-de-miel'`
  );
  console.log('   ✅ valeurs par défaut Dune de Miel');
  await pool.end();
})();
