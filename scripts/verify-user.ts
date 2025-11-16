#!/usr/bin/env tsx
/**
 * Script pour vérifier un utilisateur et son mot de passe
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

const email = 'admin@ddm.cm';
const password = 'password123';

async function verifyUser() {
  console.log('🔍 Vérification de l\'utilisateur...\n');

  const client = getPostgresClient();

  try {
    // Récupérer l'utilisateur
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé pour:', email);
      return;
    }

    const user = result.rows[0];
    console.log('✅ Utilisateur trouvé:');
    console.log('   - ID:', user.id);
    console.log('   - User ID:', user.user_id);
    console.log('   - Email:', user.email);
    console.log('   - Nom:', user.full_name);
    console.log('   - Actif:', user.is_active);
    console.log('   - Workspace ID:', user.workspace_id);
    console.log('   - Role ID:', user.role_id);
    console.log('   - Password hash exists:', !!user.password_hash);
    console.log('   - Password hash length:', user.password_hash?.length);

    // Vérifier le mot de passe
    console.log('\n🔐 Vérification du mot de passe...');
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (isValid) {
      console.log('✅ Mot de passe VALIDE!');
    } else {
      console.log('❌ Mot de passe INVALIDE!');

      // Essayer de générer un nouveau hash pour comparaison
      console.log('\n🔄 Génération d\'un nouveau hash pour test...');
      const newHash = await bcrypt.hash(password, 10);
      console.log('Nouveau hash:', newHash);

      const testValid = await bcrypt.compare(password, newHash);
      console.log('Test avec nouveau hash:', testValid ? 'OK' : 'FAIL');
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

verifyUser();
