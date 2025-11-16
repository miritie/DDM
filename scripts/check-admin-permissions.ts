#!/usr/bin/env tsx
/**
 * Script pour vérifier les permissions de l'administrateur
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

async function checkAdminPermissions() {
  console.log('🔍 Vérification des permissions administrateur...\n');

  const client = getPostgresClient();

  try {
    // 1. Récupérer l'utilisateur admin
    const userResult = await client.query(
      'SELECT user_id, email, full_name, role_id FROM users WHERE email = $1',
      ['admin@ddm.cm']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Utilisateur admin non trouvé!');
      return;
    }

    const admin = userResult.rows[0];
    console.log('✅ Utilisateur trouvé:');
    console.log('   - Email:', admin.email);
    console.log('   - Nom:', admin.full_name);
    console.log('   - Role ID:', admin.role_id);
    console.log('');

    // 2. Récupérer le rôle
    const roleResult = await client.query(
      'SELECT id, name, description FROM roles WHERE id = $1',
      [admin.role_id]
    );

    if (roleResult.rows.length === 0) {
      console.log('❌ Rôle non trouvé!');
      return;
    }

    const role = roleResult.rows[0];
    console.log('✅ Rôle trouvé:');
    console.log('   - Name:', role.name);
    console.log('   - Description:', role.description);
    console.log('');

    // 3. Récupérer les permissions du rôle
    const permissionsResult = await client.query(
      `SELECT p.code, p.name, p.description, p.module
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.code`,
      [admin.role_id]
    );

    console.log(`✅ Permissions trouvées: ${permissionsResult.rows.length}`);
    console.log('');

    if (permissionsResult.rows.length === 0) {
      console.log('❌ PROBLÈME: Aucune permission assignée au rôle admin!');
      console.log('');
      console.log('📝 Solution: Exécuter le script seed-permissions.ts pour assigner les permissions');
      return;
    }

    // Grouper par module
    const byModule: Record<string, any[]> = {};
    permissionsResult.rows.forEach(row => {
      if (!byModule[row.module]) {
        byModule[row.module] = [];
      }
      byModule[row.module].push(row);
    });

    console.log('📋 Permissions par module:');
    console.log('');

    Object.keys(byModule).sort().forEach(module => {
      console.log(`   ${module}:`);
      byModule[module].forEach(perm => {
        console.log(`      - ${perm.code}`);
      });
      console.log('');
    });

    // 4. Vérifier les permissions critiques
    const criticalPermissions = [
      'admin:users:view',
      'admin:users:create',
      'admin:users:edit',
      'admin:roles:view',
    ];

    const assignedCodes = permissionsResult.rows.map(row => row.code);

    console.log('🔐 Vérification permissions critiques:');
    criticalPermissions.forEach(perm => {
      if (assignedCodes.includes(perm)) {
        console.log(`   ✅ ${perm}`);
      } else {
        console.log(`   ❌ ${perm} - MANQUANTE!`);
      }
    });

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

checkAdminPermissions();
