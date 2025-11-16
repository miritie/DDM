#!/usr/bin/env tsx
/**
 * Script pour fixer les role_id des utilisateurs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

async function fixUserRoles() {
  console.log('🔧 Correction des rôles utilisateurs...\n');

  const client = getPostgresClient();

  try {
    // 1. Vérifier la structure des tables
    console.log('📋 Structure de la colonne role_id dans users:');
    const usersStructure = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role_id'
    `);
    console.log(`   ${usersStructure.rows[0].column_name}: ${usersStructure.rows[0].data_type}`);

    console.log('\n📋 Structure de la colonne role_id dans roles:');
    const rolesStructure = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'roles' AND column_name = 'role_id'
    `);
    console.log(`   ${rolesStructure.rows[0].column_name}: ${rolesStructure.rows[0].data_type}`);
    console.log('');

    // 2. Lister les rôles disponibles
    console.log('📋 Rôles disponibles:\n');
    const rolesResult = await client.query('SELECT role_id, name FROM roles');

    for (const role of rolesResult.rows) {
      console.log(`   ${role.role_id} → ${role.name}`);
    }
    console.log('');

    // 3. Vérifier les utilisateurs et leurs role_id actuels
    console.log('📋 Utilisateurs et leurs role_id:\n');
    const usersResult = await client.query('SELECT user_id, email, role_id FROM users');

    for (const user of usersResult.rows) {
      console.log(`   ${user.email.padEnd(30)} → role_id: ${user.role_id}`);
    }
    console.log('');

    // 4. Fixer les role_id
    console.log('🔧 Mise à jour des role_id...\n');

    // Récupérer le role_id de l'admin
    const adminRoleResult = await client.query(
      "SELECT role_id FROM roles WHERE name = 'Administrateur' LIMIT 1"
    );

    if (adminRoleResult.rows.length === 0) {
      console.log('❌ Rôle Administrateur non trouvé!');
      return;
    }

    const adminRoleId = adminRoleResult.rows[0].role_id;
    console.log(`✅ Rôle Administrateur trouvé: ${adminRoleId}\n`);

    // Mettre à jour admin@ddm.cm
    await client.query(
      `UPDATE users SET role_id = $1 WHERE email = 'admin@ddm.cm'`,
      [adminRoleId]
    );
    console.log('✅ admin@ddm.cm → Administrateur');

    // Récupérer le role_id commercial
    const salesRoleResult = await client.query(
      "SELECT role_id FROM roles WHERE name = 'Agent Commercial' LIMIT 1"
    );

    if (salesRoleResult.rows.length > 0) {
      const salesRoleId = salesRoleResult.rows[0].role_id;
      console.log(`✅ Rôle Commercial trouvé: ${salesRoleId}`);

      // Assigner les autres utilisateurs au rôle commercial
      const otherUsers = ['jean.tala@ddm.cm', 'sylvie.mbarga@ddm.cm', 'roger.fotso@ddm.cm', 'paul.nguesso@ddm.cm'];

      for (const email of otherUsers) {
        await client.query(
          `UPDATE users SET role_id = $1 WHERE email = $2`,
          [salesRoleId, email]
        );
        console.log(`✅ ${email} → Agent Commercial`);
      }
    }

    console.log('');

    // 5. Vérification finale
    console.log('🔍 Vérification finale:\n');
    const finalCheck = await client.query(`
      SELECT
        u.email,
        u.full_name,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id::text = r.role_id::text
      ORDER BY u.email
    `);

    console.log('─'.repeat(80));
    console.log('Email'.padEnd(30) + 'Nom'.padEnd(25) + 'Rôle');
    console.log('─'.repeat(80));

    for (const user of finalCheck.rows) {
      console.log(
        (user.email || 'N/A').padEnd(30) +
        (user.full_name || 'N/A').padEnd(25) +
        (user.role_name || '❌ AUCUN')
      );
    }

    console.log('─'.repeat(80));

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

fixUserRoles();
