/**
 * Script d'initialisation des utilisateurs de test
 * Crée les utilisateurs admin, commercial et production dans PostgreSQL
 */

import { getPostgresClient } from '../lib/database/postgres-client';
import bcrypt from 'bcryptjs';

const postgresClient = getPostgresClient();

interface UserData {
  Email: string;
  FullName: string;
  DisplayName: string;
  PasswordHash: string;
  RoleId: string;
  WorkspaceId: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

async function initUsers() {
  console.log('🚀 Initialisation des utilisateurs de test...\n');

  // Hash des mots de passe
  const adminPassword = await bcrypt.hash('admin123', 10);
  const commercialPassword = await bcrypt.hash('commercial123', 10);
  const productionPassword = await bcrypt.hash('production123', 10);

  const users: Partial<UserData>[] = [
    {
      Email: 'admin@ddm.com',
      FullName: 'Administrateur DDM',
      DisplayName: 'Admin',
      PasswordHash: adminPassword,
      RoleId: 'role_admin',
      WorkspaceId: 'workspace_default',
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    },
    {
      Email: 'commercial@ddm.com',
      FullName: 'Responsable Commercial',
      DisplayName: 'Commercial',
      PasswordHash: commercialPassword,
      RoleId: 'role_commercial',
      WorkspaceId: 'workspace_default',
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    },
    {
      Email: 'production@ddm.com',
      FullName: 'Responsable Production',
      DisplayName: 'Production',
      PasswordHash: productionPassword,
      RoleId: 'role_production',
      WorkspaceId: 'workspace_default',
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    },
  ];

  try {
    // Vérifier si les utilisateurs existent déjà
    for (const userData of users) {
      const existing = await postgresClient.list<UserData>('users', {
        filterByFormula: `email = '${userData.Email}'`,
      });

      if (existing.length > 0) {
        console.log(`✅ ${userData.Email} existe déjà`);
        continue;
      }

      // Créer l'utilisateur
      await postgresClient.create<UserData>('users', userData);
      console.log(`✨ ${userData.Email} créé avec succès`);
    }

    console.log('\n🎉 Initialisation terminée !');
    console.log('\n📝 Identifiants de connexion :');
    console.log('  - Admin: admin@ddm.com / admin123');
    console.log('  - Commercial: commercial@ddm.com / commercial123');
    console.log('  - Production: production@ddm.com / production123');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  }
}

initUsers();
