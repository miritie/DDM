#!/usr/bin/env tsx
/**
 * Script pour vérifier que l'admin a accès à TOUS les écrans admin
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getUserPermissions } from '../lib/rbac/get-permissions';
import { PERMISSIONS } from '../lib/rbac/permissions';

interface ScreenCheck {
  screen: string;
  url: string;
  requiredPermission: string;
  hasAccess: boolean;
}

async function verifyAllAdminScreens() {
  console.log('🔍 Vérification de tous les écrans accessibles par l\'admin...\n');

  const adminRoleId = '770e8400-e29b-41d4-a716-446655440001';

  try {
    // Récupérer toutes les permissions de l'admin
    const adminPermissions = await getUserPermissions(adminRoleId);

    console.log(`✅ Admin a ${adminPermissions.length} permissions\n`);

    // Liste de tous les écrans avec leurs permissions requises
    const screens: ScreenCheck[] = [
      // Admin Screens
      {
        screen: 'Gestion des Utilisateurs',
        url: '/admin/users',
        requiredPermission: PERMISSIONS.ADMIN_USERS_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Gestion des Rôles',
        url: '/admin/roles',
        requiredPermission: PERMISSIONS.ADMIN_ROLES_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Paramètres Système',
        url: '/admin/settings',
        requiredPermission: PERMISSIONS.ADMIN_SETTINGS_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Journal d\'Audit',
        url: '/admin/audit',
        requiredPermission: PERMISSIONS.ADMIN_AUDIT_VIEW,
        hasAccess: false,
      },

      // Operational Screens
      {
        screen: 'Ventes',
        url: '/sales',
        requiredPermission: PERMISSIONS.SALES_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Stock',
        url: '/stock',
        requiredPermission: PERMISSIONS.STOCK_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Trésorerie',
        url: '/treasury',
        requiredPermission: PERMISSIONS.TREASURY_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Production',
        url: '/production',
        requiredPermission: PERMISSIONS.PRODUCTION_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Dépenses',
        url: '/expenses',
        requiredPermission: PERMISSIONS.EXPENSE_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Consignations',
        url: '/consignment',
        requiredPermission: PERMISSIONS.CONSIGNMENT_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Avances',
        url: '/advances',
        requiredPermission: PERMISSIONS.ADVANCE_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Ressources Humaines',
        url: '/hr',
        requiredPermission: PERMISSIONS.HR_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Clients',
        url: '/customers',
        requiredPermission: PERMISSIONS.CUSTOMER_VIEW,
        hasAccess: false,
      },
      {
        screen: 'Rapports',
        url: '/reports',
        requiredPermission: PERMISSIONS.REPORTS_VIEW,
        hasAccess: false,
      },
      {
        screen: 'IA & Décisions',
        url: '/ai/decisions',
        requiredPermission: PERMISSIONS.AI_DECISION_VIEW,
        hasAccess: false,
      },
    ];

    // Vérifier chaque écran
    for (const screen of screens) {
      screen.hasAccess = adminPermissions.includes(screen.requiredPermission as any);
    }

    // Afficher les résultats
    console.log('📋 Accès aux écrans:\n');

    let accessibleCount = 0;
    let deniedCount = 0;

    for (const screen of screens) {
      const icon = screen.hasAccess ? '✅' : '❌';
      const status = screen.hasAccess ? 'ACCESSIBLE' : 'REFUSÉ';

      console.log(`${icon} ${screen.screen.padEnd(30)} ${screen.url.padEnd(20)} → ${status}`);

      if (screen.hasAccess) {
        accessibleCount++;
      } else {
        deniedCount++;
        console.log(`   ⚠️  Permission manquante: ${screen.requiredPermission}`);
      }
    }

    console.log('');
    console.log('─'.repeat(80));
    console.log(`✅ Écrans accessibles: ${accessibleCount}/${screens.length}`);
    console.log(`❌ Écrans refusés: ${deniedCount}/${screens.length}`);
    console.log('─'.repeat(80));

    if (deniedCount === 0) {
      console.log('\n🎉 L\'administrateur a accès à TOUS les écrans!');
    } else {
      console.log('\n⚠️  Certains écrans ne sont pas accessibles. Vérifiez les permissions manquantes ci-dessus.');
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  }
}

verifyAllAdminScreens();
