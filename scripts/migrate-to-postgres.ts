#!/usr/bin/env tsx
/**
 * Script de Migration Airtable → PostgreSQL
 *
 * Usage:
 *   npm run migrate:dry-run  # Test sans écriture
 *   npm run migrate          # Migration réelle
 *
 * Prérequis:
 *   - DATABASE_URL défini dans .env.local
 *   - AIRTABLE_API_KEY défini dans .env.local
 */

import { Pool } from 'pg';
import { AirtableClient } from '../lib/airtable/client';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100; // Nombre d'enregistrements par batch
const VERBOSE = process.argv.includes('--verbose');

// ============================================================================
// CLIENTS
// ============================================================================

const airtableClient = new AirtableClient();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20,
});

// ============================================================================
// UTILITAIRES
// ============================================================================

function log(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
  };
  const reset = '\x1b[0m';
  const prefix = {
    info: 'ℹ',
    success: '✅',
    warn: '⚠️',
    error: '❌',
  };

  console.log(`${colors[level]}${prefix[level]} ${message}${reset}`);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// ============================================================================
// MAPPING DES TABLES
// ============================================================================

const TABLE_MAPPING: Record<string, string> = {
  // Airtable → PostgreSQL
  'Workspace': 'workspaces',
  'Permission': 'permissions',
  'Role': 'roles',
  'User': 'users',
  'Product': 'products',
  'Client': 'clients',
  'Sale': 'sales',
  'SaleItem': 'sale_items',
  'SalePayment': 'sale_payments',
  'Customer': 'customers',
  'CustomerInteraction': 'customer_interactions',
  'CustomerFeedback': 'customer_feedbacks',
  'LoyaltyTransaction': 'loyalty_transactions',
  'LoyaltyReward': 'loyalty_rewards',
  'CustomerReward': 'customer_rewards',
  'LoyaltyTierConfig': 'loyalty_tier_configs',
  'CustomerSegment': 'customer_segments',
  'Warehouse': 'warehouses',
  'StockItem': 'stock_items',
  'StockMovement': 'stock_movements',
  'StockAlert': 'stock_alerts',
  'Wallet': 'wallets',
  'Transaction': 'transactions',
  'Ingredient': 'ingredients',
  'Recipe': 'recipes',
  'RecipeLine': 'recipe_lines',
  'ProductionOrder': 'production_orders',
  'IngredientConsumption': 'ingredient_consumptions',
  'ProductionBatch': 'production_batches',
  'ExpenseCategory': 'expense_categories',
  'ExpenseRequest': 'expense_requests',
  'ExpenseApprovalStep': 'expense_approval_steps',
  'Expense': 'expenses',
  'ExpenseAttachment': 'expense_attachments',
  'Account': 'accounts',
  'AdvanceDebt': 'advance_debts',
  'AdvanceDebtSchedule': 'advance_debt_schedules',
  'AdvanceDebtMovement': 'advance_debt_movements',
  'Employee': 'employees',
  'Attendance': 'attendances',
  'Leave': 'leaves',
  'Payroll': 'payrolls',
  'PayrollItem': 'payroll_items',
  'EmployeeAdvance': 'employee_advances',
  'EmployeeTarget': 'employee_targets',
  'Commission': 'commissions',
  'TransportAllowance': 'transport_allowances',
  'Partner': 'partners',
  'Deposit': 'deposits',
  'DepositLine': 'deposit_lines',
  'SalesReport': 'sales_reports',
  'SalesReportLine': 'sales_report_lines',
  'Settlement': 'settlements',
  'ConsignationReturn': 'consignation_returns',
  'ChartAccount': 'chart_accounts',
  'Journal': 'journals',
  'JournalEntry': 'journal_entries',
  'JournalEntryLine': 'journal_entry_lines',
  'FiscalYear': 'fiscal_years',
  'Report': 'reports',
  'ReportExecution': 'report_executions',
  'Notification': 'notifications',
  'AuditLog': 'audit_logs',
};

// ============================================================================
// ORDRE DE MIGRATION (Respecter les dépendances FK)
// ============================================================================

const MIGRATION_ORDER = [
  // 1. Tables sans dépendances
  'Workspace',
  'Permission',

  // 2. Users et rôles
  'Role',
  'User',

  // 3. Catalogues
  'Product',
  'Client',
  'Customer',
  'ExpenseCategory',
  'Ingredient',

  // 4. Opérationnels
  'Warehouse',
  'Employee',
  'Wallet',
  'Recipe',
  'Partner',
  'ChartAccount',
  'Journal',
  'Account',
  'LoyaltyReward',
  'LoyaltyTierConfig',
  'CustomerSegment',

  // 5. Transactions et mouvements
  'StockItem',
  'Sale',
  'SaleItem',
  'SalePayment',
  'Transaction',
  'StockMovement',
  'StockAlert',
  'ProductionOrder',
  'RecipeLine',
  'IngredientConsumption',
  'ProductionBatch',
  'ExpenseRequest',
  'ExpenseApprovalStep',
  'Expense',
  'ExpenseAttachment',
  'AdvanceDebt',
  'AdvanceDebtSchedule',
  'AdvanceDebtMovement',
  'Attendance',
  'Leave',
  'Payroll',
  'PayrollItem',
  'EmployeeAdvance',
  'EmployeeTarget',
  'Commission',
  'TransportAllowance',
  'CustomerInteraction',
  'CustomerFeedback',
  'LoyaltyTransaction',
  'CustomerReward',
  'Deposit',
  'DepositLine',
  'SalesReport',
  'SalesReportLine',
  'Settlement',
  'ConsignationReturn',
  'JournalEntry',
  'JournalEntryLine',
  'FiscalYear',
  'Report',
  'ReportExecution',
  'Notification',
  'AuditLog',
];

// ============================================================================
// MAPPING DES CHAMPS
// ============================================================================

function mapRecord(record: any, airtableTableName: string): any {
  const mapped: any = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === '_recordId') {
      // Utiliser l'ID Airtable comme UUID PostgreSQL
      mapped.id = value;
      continue;
    }

    // Convertir PascalCase → snake_case
    const snakeKey = toSnakeCase(key);

    // Convertir les valeurs si nécessaire
    mapped[snakeKey] = mapValue(value, snakeKey);
  }

  return mapped;
}

function mapValue(value: any, fieldName: string): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Arrays (tags, etc.)
  if (Array.isArray(value)) {
    return value;
  }

  // Dates ISO → PostgreSQL timestamp
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return value; // PostgreSQL accepte ISO strings
  }

  // Booleans
  if (typeof value === 'boolean') {
    return value;
  }

  // Numbers
  if (typeof value === 'number') {
    return value;
  }

  // Strings
  return value;
}

// ============================================================================
// MIGRATION D'UNE TABLE
// ============================================================================

async function migrateTable(airtableTableName: string): Promise<void> {
  const pgTableName = TABLE_MAPPING[airtableTableName];

  if (!pgTableName) {
    log(`Table mapping not found for ${airtableTableName}`, 'warn');
    return;
  }

  log(`\n${'='.repeat(60)}`);
  log(`Migrating: ${airtableTableName} → ${pgTableName}`, 'info');
  log('='.repeat(60));

  try {
    // 1. Récupérer les données d'Airtable
    log(`Fetching records from Airtable...`, 'info');
    const records = await airtableClient.list(airtableTableName, {});
    log(`Found ${records.length} records`, 'success');

    if (records.length === 0) {
      log('No records to migrate', 'warn');
      return;
    }

    // 2. Afficher un exemple
    if (VERBOSE && records.length > 0) {
      console.log('\nSample record (Airtable):');
      console.log(JSON.stringify(records[0], null, 2));

      const mapped = mapRecord(records[0], airtableTableName);
      console.log('\nSample record (PostgreSQL):');
      console.log(JSON.stringify(mapped, null, 2));
    }

    // 3. Migrer par batches
    let migrated = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)}...`, 'info');

      for (const record of batch) {
        try {
          const mapped = mapRecord(record, airtableTableName);

          if (!DRY_RUN) {
            await insertRecord(pgTableName, mapped);
          }

          migrated++;

          if (VERBOSE) {
            process.stdout.write(`\r  ${migrated}/${records.length} migrated`);
          }
        } catch (error: any) {
          errors++;
          log(`Error migrating record: ${error.message}`, 'error');

          if (VERBOSE) {
            console.error(record);
            console.error(error);
          }
        }
      }
    }

    if (VERBOSE) {
      console.log('\n');
    }

    // 4. Résumé
    log(`\nResults:`, 'info');
    log(`  ✅ Migrated: ${migrated}`, 'success');
    if (errors > 0) {
      log(`  ❌ Errors: ${errors}`, 'error');
    }

  } catch (error: any) {
    log(`Failed to migrate ${airtableTableName}: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================================
// INSERTION DANS POSTGRESQL
// ============================================================================

async function insertRecord(tableName: string, data: any): Promise<void> {
  const keys = Object.keys(data).filter(k => data[k] !== undefined);
  const values = keys.map(k => data[k]);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');

  const query = `
    INSERT INTO ${tableName} (${columns})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET
      ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
  `;

  await pool.query(query, values);
}

// ============================================================================
// VÉRIFICATIONS
// ============================================================================

async function checkConnection(): Promise<void> {
  log('Checking database connection...', 'info');

  try {
    const result = await pool.query('SELECT NOW()');
    log(`Connected to PostgreSQL: ${result.rows[0].now}`, 'success');
  } catch (error: any) {
    log(`Failed to connect: ${error.message}`, 'error');
    throw error;
  }
}

async function checkAirtable(): Promise<void> {
  log('Checking Airtable connection...', 'info');

  try {
    const workspaces = await airtableClient.list('Workspace', { maxRecords: 1 });
    log(`Connected to Airtable: ${workspaces.length} workspace(s) found`, 'success');
  } catch (error: any) {
    log(`Failed to connect: ${error.message}`, 'error');
    throw error;
  }
}

async function verifyMigration(): Promise<void> {
  log('\n' + '='.repeat(60));
  log('VERIFICATION', 'info');
  log('='.repeat(60) + '\n');

  for (const airtableTable of MIGRATION_ORDER) {
    const pgTable = TABLE_MAPPING[airtableTable];
    if (!pgTable) continue;

    try {
      // Compter les enregistrements
      const airtableCount = await airtableClient.count(airtableTable);
      const pgResult = await pool.query(`SELECT COUNT(*) FROM ${pgTable}`);
      const pgCount = parseInt(pgResult.rows[0].count, 10);

      const status = airtableCount === pgCount ? '✅' : '⚠️';
      log(`${status} ${airtableTable}: Airtable=${airtableCount}, PostgreSQL=${pgCount}`, airtableCount === pgCount ? 'success' : 'warn');
    } catch (error: any) {
      log(`❌ ${airtableTable}: ${error.message}`, 'error');
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    console.log('\n' + '█'.repeat(60));
    log('  MIGRATION AIRTABLE → POSTGRESQL', 'info');
    console.log('█'.repeat(60) + '\n');

    if (DRY_RUN) {
      log('🔍 DRY RUN MODE - No data will be written', 'warn');
    } else {
      log('🚀 PRODUCTION MODE - Data will be written to PostgreSQL', 'warn');
    }

    // 1. Vérifications
    await checkConnection();
    await checkAirtable();

    // 2. Confirmation
    if (!DRY_RUN) {
      log('\n⚠️  WARNING: This will write data to PostgreSQL!', 'warn');
      log('Press Ctrl+C to cancel, or wait 5 seconds to continue...', 'warn');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 3. Migration
    log('\n' + '='.repeat(60));
    log('STARTING MIGRATION', 'info');
    log('='.repeat(60));

    const startTime = Date.now();

    for (const tableName of MIGRATION_ORDER) {
      await migrateTable(tableName);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('\n' + '='.repeat(60));
    log('MIGRATION COMPLETED', 'success');
    log('='.repeat(60));
    log(`Duration: ${duration}s`, 'info');

    // 4. Vérification
    if (!DRY_RUN) {
      await verifyMigration();
    }

    log('\n✅ All done!', 'success');

  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter
main();
