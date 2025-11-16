#!/usr/bin/env tsx
/**
 * Script pour réinitialiser le mot de passe admin
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

const email = 'admin@ddm.cm';
const newPassword = 'password123';

async function resetPassword() {
  console.log('🔄 Réinitialisation du mot de passe...\n');

  const client = getPostgresClient();

  try {
    // Générer le nouveau hash
    console.log('🔐 Génération du hash bcrypt...');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log('✅ Hash généré:', passwordHash);

    // Mettre à jour le mot de passe
    console.log('\n📝 Mise à jour dans la base de données...');
    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, full_name',
      [passwordHash, email]
    );

    if (result.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }

    console.log('✅ Mot de passe mis à jour pour:', result.rows[0].full_name);
    console.log('   Email:', result.rows[0].email);
    console.log('   Nouveau mot de passe:', newPassword);

    // Vérifier que ça fonctionne
    console.log('\n🧪 Vérification...');
    const verifyResult = await client.query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email]
    );

    const isValid = await bcrypt.compare(newPassword, verifyResult.rows[0].password_hash);

    if (isValid) {
      console.log('✅ Vérification réussie! Le mot de passe fonctionne.\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('  Vous pouvez maintenant vous connecter avec:');
      console.log(`  Email: ${email}`);
      console.log(`  Mot de passe: ${newPassword}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('❌ La vérification a échoué');
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.close();
  }
}

resetPassword();
