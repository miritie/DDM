#!/usr/bin/env tsx
/**
 * Script de test pour le PostgresClient
 * Démontre l'utilisation du client et teste la connexion
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// IMPORTANT: Charger dotenv AVANT d'importer le client
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';

// Obtenir l'instance après le chargement de dotenv
const postgresClient = getPostgresClient();

async function testConnection() {
  console.log('🔌 Test de connexion à PostgreSQL...\n');

  try {
    const result = await postgresClient.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ Connexion réussie!');
    console.log(`⏰ Heure serveur: ${result.rows[0].current_time}`);
    console.log(`📊 Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}\n`);
  } catch (error: any) {
    console.error('❌ Erreur de connexion:', error.message);
    throw error;
  }
}

async function testWorkspaces() {
  console.log('🏢 Test: Récupération des workspaces...');

  try {
    const workspaces = await postgresClient.list('workspaces', {
      fields: ['id', 'workspace_id', 'name', 'slug', 'is_active'],
      sort: [{ field: 'name', direction: 'asc' }]
    });

    console.log(`✅ ${workspaces.length} workspace(s) trouvé(s):`);
    workspaces.forEach((ws: any) => {
      console.log(`   - ${ws.name} (${ws.workspace_id}) - ${ws.is_active ? '✅ Actif' : '❌ Inactif'}`);
    });
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testUsers() {
  console.log('👥 Test: Récupération des utilisateurs...');

  try {
    const users = await postgresClient.list('users', {
      fields: ['id', 'email', 'full_name', 'role_id', 'is_active'],
      sort: [{ field: 'full_name', direction: 'asc' }]
    });

    console.log(`✅ ${users.length} utilisateur(s) trouvé(s):`);
    users.forEach((user: any) => {
      console.log(`   - ${user.full_name} (${user.email}) - Role ID: ${user.role_id}`);
    });
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testProducts() {
  console.log('📦 Test: Récupération des produits...');

  try {
    const products = await postgresClient.list('products', {
      fields: ['id', 'name', 'code', 'unit_price', 'currency', 'category', 'is_active'],
      sort: [{ field: 'category', direction: 'asc' }, { field: 'name', direction: 'asc' }],
      maxRecords: 10
    });

    console.log(`✅ ${products.length} produit(s) trouvé(s):`);
    products.forEach((product: any) => {
      const price = new Intl.NumberFormat('fr-FR').format(product.unit_price);
      console.log(`   - ${product.name} (${product.code}) - ${price} ${product.currency} - ${product.category}`);
    });
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testCustomers() {
  console.log('👤 Test: Récupération des clients...');

  try {
    const customers = await postgresClient.list('customers', {
      fields: ['id', 'full_name', 'phone', 'type', 'loyalty_tier', 'loyalty_points'],
      sort: [{ field: 'full_name', direction: 'asc' }]
    });

    console.log(`✅ ${customers.length} client(s) trouvé(s):`);
    customers.forEach((customer: any) => {
      console.log(`   - ${customer.full_name} (${customer.phone}) - ${customer.type} - ${customer.loyalty_tier} (${customer.loyalty_points} pts)`);
    });
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testFilterByFormula() {
  console.log('🔍 Test: Filtrage avec filterByFormula...');

  try {
    // Test avec un workspace spécifique
    const products = await postgresClient.list('products', {
      filterByFormula: `{WorkspaceId} = '550e8400-e29b-41d4-a716-446655440001'`,
      fields: ['id', 'name', 'code', 'is_active']
    });

    console.log(`✅ ${products.length} produit(s) pour le workspace 550e8400-e29b-41d4-a716-446655440001`);
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testCount() {
  console.log('🔢 Test: Comptage d\'enregistrements...');

  try {
    const tables = ['workspaces', 'users', 'products', 'customers', 'sales', 'wallets', 'warehouses', 'stock_items'];

    for (const table of tables) {
      const count = await postgresClient.count(table);
      console.log(`   ${table.padEnd(20)} : ${count}`);
    }
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testGet() {
  console.log('🎯 Test: Récupération d\'un enregistrement par ID...');

  try {
    // Récupérer le premier workspace
    const workspaces = await postgresClient.list('workspaces', { maxRecords: 1 });
    if (workspaces.length === 0) {
      console.log('⚠️  Aucun workspace trouvé pour le test');
      return;
    }

    const workspaceId = (workspaces[0] as any).id;
    const workspace = await postgresClient.get('workspaces', workspaceId);

    if (workspace) {
      console.log('✅ Workspace récupéré:');
      console.log(`   - ID: ${(workspace as any).id}`);
      console.log(`   - Nom: ${(workspace as any).name}`);
      console.log(`   - Slug: ${(workspace as any).slug}`);
    } else {
      console.log('❌ Workspace non trouvé');
    }
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function testTransaction() {
  console.log('💳 Test: Transaction PostgreSQL...');

  try {
    // Test de transaction simple avec SELECT
    const result = await postgresClient.transaction(async (client) => {
      const ws = await client.query('SELECT COUNT(*) as count FROM workspaces');
      const users = await client.query('SELECT COUNT(*) as count FROM users');
      const products = await client.query('SELECT COUNT(*) as count FROM products');

      return {
        workspaces: ws.rows[0].count,
        users: users.rows[0].count,
        products: products.rows[0].count
      };
    });

    console.log('✅ Transaction réussie!');
    console.log(`   - Workspaces: ${result.workspaces}`);
    console.log(`   - Users: ${result.users}`);
    console.log(`   - Products: ${result.products}`);
    console.log();
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   TEST DU CLIENT POSTGRESQL - DDM SYSTEM              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    await testConnection();
    await testWorkspaces();
    await testUsers();
    await testProducts();
    await testCustomers();
    await testFilterByFormula();
    await testCount();
    await testGet();
    await testTransaction();

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   ✅ TOUS LES TESTS ONT RÉUSSI!                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
  } catch (error: any) {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   ❌ ERREUR LORS DES TESTS                            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.error(error);
    process.exit(1);
  } finally {
    await postgresClient.close();
  }
}

main();
