#!/usr/bin/env tsx
/**
 * Script pour tester l'API /api/rbac/permissions
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getUserPermissions } from '../lib/rbac/get-permissions';

async function testPermissionsAPI() {
  console.log('🧪 Test de getUserPermissions...\n');

  const adminRoleId = '770e8400-e29b-41d4-a716-446655440001';

  try {
    console.log(`📋 Récupération des permissions pour roleId: ${adminRoleId}`);

    const permissions = await getUserPermissions(adminRoleId);

    console.log(`✅ ${permissions.length} permissions récupérées\n`);

    // Vérifier les permissions critiques
    const criticalPermissions = [
      'admin:users:view',
      'admin:users:create',
      'admin:users:edit',
      'admin:roles:view',
    ];

    console.log('🔐 Vérification des permissions critiques:\n');

    for (const perm of criticalPermissions) {
      const hasIt = permissions.includes(perm as any);
      console.log(`   ${hasIt ? '✅' : '❌'} ${perm}`);
    }

    console.log('\n📊 Toutes les permissions:');
    console.log(permissions.join(', '));

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  }
}

testPermissionsAPI();
