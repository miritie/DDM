#!/usr/bin/env tsx
/**
 * Script pour insérer toutes les permissions dans PostgreSQL
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getPostgresClient } from '../lib/database/postgres-client';
import { PERMISSIONS } from '../lib/rbac/permissions';

const PERMISSION_DEFINITIONS = [
  // Module 7.1 - Ventes
  { code: PERMISSIONS.SALES_VIEW, name: 'Voir les ventes', module: 'sales' },
  { code: PERMISSIONS.SALES_CREATE, name: 'Créer des ventes', module: 'sales' },
  { code: PERMISSIONS.SALES_EDIT, name: 'Modifier les ventes', module: 'sales' },
  { code: PERMISSIONS.SALES_DELETE, name: 'Supprimer les ventes', module: 'sales' },

  // Module 7.2 - Stocks
  { code: PERMISSIONS.STOCK_VIEW, name: 'Voir le stock', module: 'stock' },
  { code: PERMISSIONS.STOCK_CREATE, name: 'Créer des produits', module: 'stock' },
  { code: PERMISSIONS.STOCK_EDIT, name: 'Modifier le stock', module: 'stock' },
  { code: PERMISSIONS.STOCK_DELETE, name: 'Supprimer des produits', module: 'stock' },
  { code: PERMISSIONS.STOCK_TRANSFER, name: 'Transférer du stock', module: 'stock' },

  // Module 7.3 - Trésorerie
  { code: PERMISSIONS.TREASURY_VIEW, name: 'Voir la trésorerie', module: 'treasury' },
  { code: PERMISSIONS.TREASURY_CREATE, name: 'Créer des transactions', module: 'treasury' },
  { code: PERMISSIONS.TREASURY_EDIT, name: 'Modifier la trésorerie', module: 'treasury' },
  { code: PERMISSIONS.TREASURY_DELETE, name: 'Supprimer des transactions', module: 'treasury' },
  { code: PERMISSIONS.TREASURY_APPROVE, name: 'Approuver des transactions', module: 'treasury' },

  // Module 7.4 - Production & Usine
  { code: PERMISSIONS.PRODUCTION_VIEW, name: 'Voir la production', module: 'production' },
  { code: PERMISSIONS.PRODUCTION_EDIT, name: 'Modifier la production', module: 'production' },
  { code: PERMISSIONS.PRODUCTION_CREATE, name: 'Créer des ordres de production', module: 'production' },
  { code: PERMISSIONS.PRODUCTION_DELETE, name: 'Supprimer la production', module: 'production' },
  { code: PERMISSIONS.PRODUCTION_START, name: 'Démarrer la production', module: 'production' },
  { code: PERMISSIONS.PRODUCTION_COMPLETE, name: 'Terminer la production', module: 'production' },

  // Module 7.5 - Dépenses
  { code: PERMISSIONS.EXPENSE_VIEW, name: 'Voir les dépenses', module: 'expense' },
  { code: PERMISSIONS.EXPENSE_CREATE, name: 'Créer des dépenses', module: 'expense' },
  { code: PERMISSIONS.EXPENSE_EDIT, name: 'Modifier les dépenses', module: 'expense' },
  { code: PERMISSIONS.EXPENSE_DELETE, name: 'Supprimer les dépenses', module: 'expense' },
  { code: PERMISSIONS.EXPENSE_APPROVE, name: 'Approuver les dépenses', module: 'expense' },
  { code: PERMISSIONS.EXPENSE_PAY, name: 'Payer les dépenses', module: 'expense' },

  // Module 7.2 - Consignation & Partenaires
  { code: PERMISSIONS.CONSIGNMENT_VIEW, name: 'Voir les consignations', module: 'consignment' },
  { code: PERMISSIONS.CONSIGNMENT_CREATE, name: 'Créer des consignations', module: 'consignment' },
  { code: PERMISSIONS.CONSIGNMENT_EDIT, name: 'Modifier les consignations', module: 'consignment' },
  { code: PERMISSIONS.CONSIGNMENT_DELETE, name: 'Supprimer les consignations', module: 'consignment' },
  { code: PERMISSIONS.CONSIGNMENT_VALIDATE, name: 'Valider les consignations', module: 'consignment' },
  { code: PERMISSIONS.CONSIGNMENT_SETTLE, name: 'Régler les consignations', module: 'consignment' },
  { code: PERMISSIONS.PARTNER_VIEW, name: 'Voir les partenaires', module: 'consignment' },
  { code: PERMISSIONS.PARTNER_CREATE, name: 'Créer des partenaires', module: 'consignment' },
  { code: PERMISSIONS.PARTNER_EDIT, name: 'Modifier les partenaires', module: 'consignment' },
  { code: PERMISSIONS.PARTNER_DELETE, name: 'Supprimer les partenaires', module: 'consignment' },

  // Module 7.6 - Avances & Dettes
  { code: PERMISSIONS.ADVANCE_VIEW, name: 'Voir les avances', module: 'advance' },
  { code: PERMISSIONS.ADVANCE_CREATE, name: 'Créer des avances', module: 'advance' },
  { code: PERMISSIONS.ADVANCE_EDIT, name: 'Modifier les avances', module: 'advance' },
  { code: PERMISSIONS.ADVANCE_DELETE, name: 'Supprimer les avances', module: 'advance' },
  { code: PERMISSIONS.ADVANCE_APPROVE, name: 'Approuver les avances', module: 'advance' },
  { code: PERMISSIONS.DEBT_VIEW, name: 'Voir les dettes', module: 'debt' },
  { code: PERMISSIONS.DEBT_CREATE, name: 'Créer des dettes', module: 'debt' },
  { code: PERMISSIONS.DEBT_EDIT, name: 'Modifier les dettes', module: 'debt' },
  { code: PERMISSIONS.DEBT_DELETE, name: 'Supprimer les dettes', module: 'debt' },

  // Module 7.7 - Ressources Humaines
  { code: PERMISSIONS.HR_VIEW, name: 'Voir les RH', module: 'hr' },
  { code: PERMISSIONS.HR_CREATE, name: 'Créer des employés', module: 'hr' },
  { code: PERMISSIONS.HR_EDIT, name: 'Modifier les employés', module: 'hr' },
  { code: PERMISSIONS.HR_UPDATE, name: 'Mettre à jour les RH', module: 'hr' },
  { code: PERMISSIONS.HR_DELETE, name: 'Supprimer des employés', module: 'hr' },
  { code: PERMISSIONS.HR_APPROVE, name: 'Approuver les RH', module: 'hr' },
  { code: PERMISSIONS.HR_PAYROLL, name: 'Gérer la paie', module: 'hr' },
  { code: PERMISSIONS.HR_COMMISSION, name: 'Gérer les commissions', module: 'hr' },
  { code: PERMISSIONS.HR_ADVANCE, name: 'Gérer les avances salariales', module: 'hr' },

  // Module 7.8 - Clients & Fidélité
  { code: PERMISSIONS.CUSTOMER_VIEW, name: 'Voir les clients', module: 'customer' },
  { code: PERMISSIONS.CUSTOMER_CREATE, name: 'Créer des clients', module: 'customer' },
  { code: PERMISSIONS.CUSTOMER_EDIT, name: 'Modifier les clients', module: 'customer' },
  { code: PERMISSIONS.CUSTOMER_DELETE, name: 'Supprimer les clients', module: 'customer' },
  { code: PERMISSIONS.LOYALTY_VIEW, name: 'Voir la fidélité', module: 'loyalty' },
  { code: PERMISSIONS.LOYALTY_MANAGE, name: 'Gérer la fidélité', module: 'loyalty' },
  { code: PERMISSIONS.LOYALTY_REDEEM, name: 'Échanger des points', module: 'loyalty' },

  // Module 7.9 - IA Prédictive & Aide à la Décision
  { code: PERMISSIONS.AI_DECISION_VIEW, name: "Voir les décisions IA", module: 'ai' },
  { code: PERMISSIONS.AI_DECISION_REQUEST, name: "Demander une décision IA", module: 'ai' },
  { code: PERMISSIONS.AI_DECISION_APPLY, name: "Appliquer une décision IA", module: 'ai' },
  { code: PERMISSIONS.AI_DECISION_OVERRIDE, name: "Remplacer une décision IA", module: 'ai' },
  { code: PERMISSIONS.AI_RULE_VIEW, name: "Voir les règles IA", module: 'ai' },
  { code: PERMISSIONS.AI_RULE_CREATE, name: "Créer des règles IA", module: 'ai' },
  { code: PERMISSIONS.AI_RULE_EDIT, name: "Modifier les règles IA", module: 'ai' },
  { code: PERMISSIONS.AI_RULE_DELETE, name: "Supprimer les règles IA", module: 'ai' },

  // Module Administration
  { code: PERMISSIONS.ADMIN_USERS_VIEW, name: 'Voir les utilisateurs', module: 'admin' },
  { code: PERMISSIONS.ADMIN_USERS_CREATE, name: 'Créer des utilisateurs', module: 'admin' },
  { code: PERMISSIONS.ADMIN_USERS_EDIT, name: 'Modifier les utilisateurs', module: 'admin' },
  { code: PERMISSIONS.ADMIN_USERS_DELETE, name: 'Supprimer les utilisateurs', module: 'admin' },
  { code: PERMISSIONS.ADMIN_ROLES_VIEW, name: 'Voir les rôles', module: 'admin' },
  { code: PERMISSIONS.ADMIN_ROLES_CREATE, name: 'Créer des rôles', module: 'admin' },
  { code: PERMISSIONS.ADMIN_ROLES_EDIT, name: 'Modifier les rôles', module: 'admin' },
  { code: PERMISSIONS.ADMIN_ROLES_DELETE, name: 'Supprimer les rôles', module: 'admin' },
  { code: PERMISSIONS.ADMIN_SETTINGS_VIEW, name: 'Voir les paramètres', module: 'admin' },
  { code: PERMISSIONS.ADMIN_SETTINGS_EDIT, name: 'Modifier les paramètres', module: 'admin' },
  { code: PERMISSIONS.ADMIN_AUDIT_VIEW, name: "Voir l'audit", module: 'admin' },

  // Rapports
  { code: PERMISSIONS.REPORTS_VIEW, name: 'Voir les rapports', module: 'reports' },
  { code: PERMISSIONS.REPORTS_EXPORT, name: 'Exporter les rapports', module: 'reports' },

  // Notifications
  { code: PERMISSIONS.NOTIFICATION_VIEW, name: 'Voir les notifications', module: 'notification' },
  { code: PERMISSIONS.NOTIFICATION_SEND, name: 'Envoyer des notifications', module: 'notification' },
];

async function seedPermissions() {
  console.log('🌱 Seed des permissions dans PostgreSQL...\n');

  const client = getPostgresClient();

  try {
    let insertedCount = 0;
    let existingCount = 0;

    console.log(`📋 ${PERMISSION_DEFINITIONS.length} permissions à insérer\n`);

    for (const perm of PERMISSION_DEFINITIONS) {
      try {
        const result = await client.query(
          `INSERT INTO permissions (permission_id, code, name, module, description)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (code) DO NOTHING
           RETURNING id`,
          [perm.code, perm.code, perm.name, perm.module, perm.name]
        );

        if (result.rows.length > 0) {
          insertedCount++;
          process.stdout.write('.');
        } else {
          existingCount++;
          process.stdout.write('-');
        }
      } catch (error: any) {
        console.error(`\n❌ Erreur pour ${perm.code}:`, error.message);
      }
    }

    console.log('\n');
    console.log(`✅ ${insertedCount} permissions insérées`);
    console.log(`⏭️  ${existingCount} permissions déjà existantes`);
    console.log('');

    // Vérification finale
    const countResult = await client.query('SELECT COUNT(*) as count FROM permissions');
    console.log(`📊 Total permissions en base: ${countResult.rows[0].count}`);

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await client.close();
  }
}

seedPermissions();
