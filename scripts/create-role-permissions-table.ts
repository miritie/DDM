#!/usr/bin/env tsx
/**
 * Script pour créer la table role_permissions et assigner toutes les permissions à l'admin
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

async function createRolePermissionsTable() {
  console.log('🔧 Création de la table role_permissions...\n');

  const client = getPostgresClient();

  try {
    // 1. Créer la table role_permissions
    console.log('📝 Création de la table role_permissions...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, permission_id)
      )
    `);
    console.log('✅ Table role_permissions créée');
    console.log('');

    // 2. Récupérer le rôle Admin
    const adminRoleResult = await client.query(
      "SELECT id, name FROM roles WHERE name = 'Administrateur' LIMIT 1"
    );

    if (adminRoleResult.rows.length === 0) {
      console.log('❌ Rôle Administrateur non trouvé!');
      return;
    }

    const adminRole = adminRoleResult.rows[0];
    console.log(`✅ Rôle Admin trouvé: ${adminRole.id}`);
    console.log('');

    // 3. Récupérer toutes les permissions
    const permissionsResult = await client.query(
      'SELECT id, code, name FROM permissions ORDER BY code'
    );

    console.log(`📋 ${permissionsResult.rows.length} permissions trouvées`);
    console.log('');

    // 4. Assigner toutes les permissions au rôle Admin
    console.log('🔗 Attribution des permissions au rôle Admin...');

    let assignedCount = 0;
    let skippedCount = 0;

    for (const permission of permissionsResult.rows) {
      try {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [adminRole.id, permission.id]
        );
        assignedCount++;
        process.stdout.write('.');
      } catch (error) {
        skippedCount++;
      }
    }

    console.log('');
    console.log('');
    console.log(`✅ ${assignedCount} permissions assignées`);
    if (skippedCount > 0) {
      console.log(`⏭️  ${skippedCount} permissions déjà assignées (skip)`);
    }
    console.log('');

    // 5. Vérification finale
    const verifyResult = await client.query(
      `SELECT COUNT(*) as count
       FROM role_permissions
       WHERE role_id = $1`,
      [adminRole.id]
    );

    console.log('🔍 Vérification finale:');
    console.log(`   Total permissions pour Admin: ${verifyResult.rows[0].count}`);
    console.log('');

    if (parseInt(verifyResult.rows[0].count) >= 100) {
      console.log('✅ L\'administrateur a toutes les permissions!');
    } else {
      console.log('⚠️  Attention: nombre de permissions faible');
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

createRolePermissionsTable();
