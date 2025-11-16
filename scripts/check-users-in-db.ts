#!/usr/bin/env tsx
/**
 * Script pour vérifier les utilisateurs en base de données
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

async function checkUsersInDB() {
  console.log('🔍 Vérification des utilisateurs en base de données...\n');

  const client = getPostgresClient();

  try {
    // 1. Compter le nombre d'utilisateurs
    const countResult = await client.query('SELECT COUNT(*) as count FROM users');
    const userCount = parseInt(countResult.rows[0].count);

    console.log(`📊 Nombre total d'utilisateurs: ${userCount}\n`);

    if (userCount === 0) {
      console.log('❌ Aucun utilisateur trouvé en base de données!\n');
      console.log('💡 Les utilisateurs doivent être créés. Voulez-vous que je les crée?\n');
      return;
    }

    // 2. Récupérer tous les utilisateurs avec leurs rôles
    const usersResult = await client.query(`
      SELECT
        u.user_id,
        u.email,
        u.full_name,
        u.is_active,
        r.name as role_name,
        r.role_id
      FROM users u
      LEFT JOIN roles r ON u.role_id::text = r.role_id::text
      ORDER BY u.created_at DESC
    `);

    console.log('📋 Liste des utilisateurs:\n');
    console.log('─'.repeat(100));
    console.log('Email'.padEnd(30) + 'Nom'.padEnd(25) + 'Rôle'.padEnd(20) + 'Actif');
    console.log('─'.repeat(100));

    for (const user of usersResult.rows) {
      const status = user.is_active ? '✅ Oui' : '❌ Non';
      console.log(
        (user.email || 'N/A').padEnd(30) +
        (user.full_name || 'N/A').padEnd(25) +
        (user.role_name || 'N/A').padEnd(20) +
        status
      );
    }

    console.log('─'.repeat(100));
    console.log('');

    // 3. Compter par rôle
    const roleCountResult = await client.query(`
      SELECT
        r.name as role_name,
        COUNT(u.user_id) as user_count
      FROM roles r
      LEFT JOIN users u ON u.role_id::text = r.role_id::text
      GROUP BY r.role_id, r.name
      ORDER BY user_count DESC
    `);

    console.log('📊 Répartition par rôle:\n');
    for (const row of roleCountResult.rows) {
      console.log(`   ${row.role_name.padEnd(30)} : ${row.user_count} utilisateur(s)`);
    }

    console.log('');

    // 4. Vérifier l'admin
    const adminResult = await client.query(`
      SELECT
        u.user_id,
        u.email,
        u.full_name,
        u.is_active,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id::text = r.role_id::text
      WHERE u.email = 'admin@ddm.cm'
    `);

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log('👤 Administrateur principal:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Nom: ${admin.full_name}`);
      console.log(`   Rôle: ${admin.role_name}`);
      console.log(`   Actif: ${admin.is_active ? '✅ Oui' : '❌ Non'}`);
      console.log('');
    } else {
      console.log('⚠️  Administrateur principal (admin@ddm.cm) non trouvé!\n');
    }

    // 5. Vérifier la structure de la table users
    console.log('📋 Structure de la table users:');
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    for (const col of structureResult.rows) {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

checkUsersInDB();
