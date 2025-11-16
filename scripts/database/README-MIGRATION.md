# Migration Airtable → PostgreSQL (Neon.tech)

## 📋 Vue d'ensemble

Ce guide vous accompagne dans la migration complète de votre application DDM depuis **Airtable** vers **PostgreSQL** hébergé sur **Neon.tech**.

---

## 🎯 Objectifs

- ✅ Migrer le schéma complet (60 tables)
- ✅ Migrer toutes les données existantes
- ✅ Maintenir l'intégrité référentielle
- ✅ Tester l'application avec PostgreSQL
- ✅ Minimiser le temps d'arrêt

---

## 📁 Fichiers fournis

```
scripts/database/
├── schema.sql              # DDL PostgreSQL - Partie 1 (tables principales)
├── schema-part2.sql        # DDL PostgreSQL - Partie 2 (RH, Clients)
├── schema-part3.sql        # DDL PostgreSQL - Partie 3 (Consignation, Compta, IA)
├── seed-data.sql           # Données de test cohérentes
├── migrate-airtable.ts     # Script de migration Airtable → PostgreSQL
└── README-MIGRATION.md     # Ce fichier
```

---

## 🚀 Étape 1 : Créer la base sur Neon.tech

### 1.1 Créer un compte Neon

1. Allez sur [https://neon.tech](https://neon.tech)
2. Créez un compte gratuit
3. Créez un nouveau projet : `ddm-production`
4. Choisissez la région : `eu-central-1` (Europe) ou `us-east-1` (USA)

### 1.2 Récupérer la chaîne de connexion

Après création, Neon vous fournira une connection string :

```
postgres://user:password@ep-cool-name-123456.eu-central-1.aws.neon.tech/ddmdb?sslmode=require
```

### 1.3 Créer le fichier `.env.local`

Ajoutez à votre `.env.local` :

```env
# PostgreSQL (Neon.tech)
DATABASE_URL="postgres://user:password@ep-cool-name-123456.eu-central-1.aws.neon.tech/ddmdb?sslmode=require"

# Airtable (conservez pour migration)
AIRTABLE_API_KEY=your_airtable_key
AIRTABLE_BASE_ID=appLUsDt4IthIdrav
DEFAULT_WORKSPACE_ID=WS-001
```

---

## 🛠️ Étape 2 : Installer les dépendances

```bash
npm install pg @types/pg
npm install -D tsx # Pour exécuter les scripts TypeScript
```

---

## 📊 Étape 3 : Créer le schéma PostgreSQL

### Option A : Via l'interface Neon (Recommandé)

1. Connectez-vous à Neon.tech
2. Allez dans "SQL Editor"
3. Exécutez les scripts dans l'ordre :

```sql
-- 1. Exécuter schema.sql
-- Copiez-collez le contenu complet et exécutez

-- 2. Exécuter schema-part2.sql
-- Copiez-collez le contenu complet et exécutez

-- 3. Exécuter schema-part3.sql
-- Copiez-collez le contenu complet et exécutez
```

### Option B : Via psql en ligne de commande

```bash
# Installer psql si nécessaire (macOS)
brew install postgresql

# Exécuter les scripts
psql "postgres://user:password@ep-cool-name.eu-central-1.aws.neon.tech/ddmdb?sslmode=require" -f scripts/database/schema.sql
psql "postgres://user:password@..." -f scripts/database/schema-part2.sql
psql "postgres://user:password@..." -f scripts/database/schema-part3.sql
```

### Vérification

Après exécution, vérifiez que les tables sont créées :

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Vous devriez voir **60+ tables**.

---

## 🧪 Étape 4 : Tester avec des données exemple

```bash
# Insérer des données de test
psql "postgres://..." -f scripts/database/seed-data.sql
```

Les données de test incluent :
- ✅ 2 workspaces
- ✅ 5 utilisateurs
- ✅ 12 produits
- ✅ 6 clients
- ✅ 5 ventes avec items et paiements
- ✅ Stock dans 3 entrepôts
- ✅ Wallets et transactions

---

## 📦 Étape 5 : Migrer les données Airtable réelles

### 5.1 Créer le client PostgreSQL

Créez `lib/database/postgres-client.ts` :

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export interface DatabaseClient {
  query(text: string, params?: any[]): Promise<any>;
  // ... autres méthodes
}

export class PostgresClient implements DatabaseClient {
  async query(text: string, params?: any[]) {
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async list<T>(tableName: string, options: any = {}): Promise<T[]> {
    // Implémenter la logique de requête
    // Transformer filterByFormula en WHERE clause
  }

  // ... autres méthodes CRUD
}
```

### 5.2 Script de migration (Approche 1 : Simple)

Créez `scripts/migrate-simple.ts` :

```typescript
import { AirtableClient } from '../lib/airtable/client';
import { Pool } from 'pg';

const airtable = new AirtableClient();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateTable(airtableTableName: string, pgTableName: string) {
  console.log(`Migrating ${airtableTableName}...`);

  // 1. Récupérer toutes les données d'Airtable
  const records = await airtable.list(airtableTableName, {});

  console.log(`Found ${records.length} records`);

  // 2. Insérer dans PostgreSQL
  for (const record of records) {
    // Mapper les champs Airtable → PostgreSQL
    const mapped = mapFields(record, airtableTableName);

    // INSERT
    await insertRecord(pgTableName, mapped);
  }

  console.log(`✅ ${airtableTableName} migrated`);
}

function mapFields(record: any, tableName: string): any {
  // Mapper PascalCase → snake_case
  // CustomerId → customer_id
  // CreatedAt → created_at
  const mapped: any = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === '_recordId') {
      mapped.id = value; // Garder l'ID Airtable comme UUID
    } else {
      // Convertir PascalCase → snake_case
      const snakeKey = toSnakeCase(key);
      mapped[snakeKey] = value;
    }
  }

  return mapped;
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

async function insertRecord(tableName: string, data: any) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const query = `
    INSERT INTO ${tableName} (${keys.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
  `;

  await pool.query(query, values);
}

// Migration dans l'ordre des dépendances
async function main() {
  try {
    // 1. Tables sans dépendances
    await migrateTable('Workspace', 'workspaces');
    await migrateTable('Permission', 'permissions');
    await migrateTable('Role', 'roles');
    await migrateTable('User', 'users');

    // 2. Produits et clients
    await migrateTable('Product', 'products');
    await migrateTable('Customer', 'customers');
    await migrateTable('Client', 'clients');

    // 3. Stock
    await migrateTable('Warehouse', 'warehouses');
    await migrateTable('StockItem', 'stock_items');
    await migrateTable('StockMovement', 'stock_movements');

    // 4. Trésorerie
    await migrateTable('Wallet', 'wallets');
    await migrateTable('Transaction', 'transactions');

    // 5. Ventes
    await migrateTable('Sale', 'sales');
    await migrateTable('SaleItem', 'sale_items');
    await migrateTable('SalePayment', 'sale_payments');

    // ... tous les autres modules

    console.log('✅✅✅ MIGRATION COMPLETE ✅✅✅');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main();
```

### 5.3 Exécuter la migration

```bash
# Test en mode dry-run
npm run migrate:dry-run

# Migration réelle
npm run migrate
```

---

## 🔄 Étape 6 : Adapter le code applicatif

### 6.1 Créer une interface commune

```typescript
// lib/database/interface.ts
export interface DatabaseClient {
  list<T>(table: string, options: QueryOptions): Promise<T[]>;
  get<T>(table: string, id: string): Promise<T | null>;
  create<T>(table: string, data: Partial<T>): Promise<T>;
  update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
  delete(table: string, id: string): Promise<void>;
  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
}
```

### 6.2 Implémenter pour PostgreSQL

```typescript
// lib/database/postgres-client.ts
import { Pool } from 'pg';
import { DatabaseClient } from './interface';

export class PostgresClient implements DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  async list<T>(tableName: string, options: any = {}): Promise<T[]> {
    const { filterByFormula, sort, maxRecords } = options;

    // Construire la requête SQL
    let query = `SELECT * FROM ${this.getTableName(tableName)}`;
    const params: any[] = [];

    // WHERE clause (parser filterByFormula)
    if (filterByFormula) {
      const where = this.parseFilter(filterByFormula);
      query += ` WHERE ${where.clause}`;
      params.push(...where.params);
    }

    // ORDER BY
    if (sort && sort.length > 0) {
      const orderBy = sort.map((s: any) =>
        `${this.toSnakeCase(s.field)} ${s.direction || 'ASC'}`
      ).join(', ');
      query += ` ORDER BY ${orderBy}`;
    }

    // LIMIT
    if (maxRecords) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(maxRecords);
    }

    const result = await this.pool.query(query, params);
    return result.rows as T[];
  }

  async get<T>(tableName: string, id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.getTableName(tableName)} WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async create<T>(tableName: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.getTableName(tableName)} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] as T;
  }

  private getTableName(airtableName: string): string {
    const mapping: Record<string, string> = {
      'Customer': 'customers',
      'Sale': 'sales',
      'Product': 'products',
      // ... mapper toutes les tables
    };
    return mapping[airtableName] || this.toSnakeCase(airtableName) + 's';
  }

  private parseFilter(formula: string): { clause: string; params: any[] } {
    // Parser les formules Airtable → SQL WHERE
    // Exemples:
    // "{WorkspaceId} = 'WS-001'" → "workspace_id = $1"
    // "AND({Status} = 'active', {Type} = 'business')" → "status = $1 AND type = $2"

    // Implémentation simplifiée
    const params: any[] = [];
    let clause = formula;

    // Remplacer {Field} par field_name
    clause = clause.replace(/\{(\w+)\}/g, (_, field) => this.toSnakeCase(field));

    // Extraire les valeurs et remplacer par placeholders
    clause = clause.replace(/'([^']+)'/g, (match, value) => {
      params.push(value);
      return `$${params.length}`;
    });

    // Simplifier AND(...) → ... AND ...
    clause = clause.replace(/AND\((.*)\)/g, '$1').replace(/,/g, ' AND ');

    return { clause, params };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}
```

### 6.3 Utiliser dans les services

```typescript
// lib/modules/customers/customer-service.ts
import { PostgresClient } from '@/lib/database/postgres-client';

const dbClient = new PostgresClient();

export class CustomerService {
  async list(workspaceId: string) {
    return await dbClient.list<Customer>('Customer', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`
    });
  }

  async create(input: CreateCustomerInput) {
    // Validation...

    const customer = await dbClient.create<Customer>('Customer', {
      customer_id: uuidv4(),
      customer_code: await this.generateCode(),
      ...input,
      workspace_id: input.workspaceId
    });

    return customer;
  }
}
```

---

## ✅ Étape 7 : Tests

### 7.1 Tests unitaires

```typescript
// __tests__/database/postgres-client.test.ts
import { PostgresClient } from '@/lib/database/postgres-client';

describe('PostgresClient', () => {
  let client: PostgresClient;

  beforeAll(() => {
    client = new PostgresClient();
  });

  it('should list customers', async () => {
    const customers = await client.list('Customer', {
      filterByFormula: `{WorkspaceId} = 'WS-001'`
    });

    expect(customers).toBeInstanceOf(Array);
  });

  it('should create a customer', async () => {
    const customer = await client.create('Customer', {
      customer_code: 'TEST-001',
      full_name: 'Test Customer',
      phone: '+237600000000',
      workspace_id: 'WS-001'
    });

    expect(customer).toHaveProperty('id');
  });
});
```

### 7.2 Tests end-to-end

Testez toutes les fonctionnalités critiques de l'application :

- ✅ Création de vente
- ✅ Paiement
- ✅ Mouvement de stock
- ✅ Rapports

---

## 🔀 Étape 8 : Migration progressive (Alternative)

Pour minimiser les risques, migrez module par module :

### Semaine 1 : Module Admin
- Workspaces
- Users
- Roles

### Semaine 2 : Module Ventes
- Products
- Clients
- Sales

### Semaine 3 : Module Stock
- Warehouses
- StockItems
- StockMovements

etc...

**Dual-Write Pattern:**

```typescript
export class DualWriteClient {
  private airtable = new AirtableClient();
  private postgres = new PostgresClient();

  async create<T>(table: string, data: Partial<T>): Promise<T> {
    // Écrire dans les deux
    const [pgResult] = await Promise.all([
      this.postgres.create(table, data),
      this.airtable.create(table, data)
    ]);

    return pgResult; // Utiliser PostgreSQL comme source de vérité
  }

  async list<T>(table: string, options: any): Promise<T[]> {
    // Lire uniquement depuis PostgreSQL
    return this.postgres.list(table, options);
  }
}
```

---

## 📊 Étape 9 : Monitoring & Performance

### 9.1 Activer le monitoring Neon

Dans votre dashboard Neon.tech :
- Activez les métriques de performance
- Configurez les alertes (connexions, latence)

### 9.2 Indexer correctement

Les index sont déjà créés dans le schéma, mais vérifiez :

```sql
-- Voir tous les index
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Analyser les requêtes lentes
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 9.3 Optimiser les requêtes

```sql
-- Expliquer une requête
EXPLAIN ANALYZE
SELECT * FROM sales
WHERE workspace_id = 'WS-001'
  AND sale_date >= '2024-01-01';
```

---

## 🎉 Étape 10 : Mise en production

### 10.1 Checklist finale

- [ ] Toutes les données migrées
- [ ] Tests end-to-end passent
- [ ] Performance acceptable (< 200ms pour queries simples)
- [ ] Backup configuré sur Neon
- [ ] Variables d'environnement production configurées
- [ ] Monitoring actif

### 10.2 Plan de bascule

1. **Maintenance programmée** (ex: Dimanche 2h-6h)
2. **Backup final Airtable**
3. **Migration finale** (delta depuis dernière migration)
4. **Bascule DNS/ENV** vers PostgreSQL
5. **Tests smoke**
6. **Monitoring 24h**
7. **Conserver Airtable en lecture seule 1 semaine** (rollback)

---

## 🚨 Rollback

En cas de problème :

```bash
# 1. Restaurer les variables d'environnement
DATABASE_URL="" # Vider
# Garder AIRTABLE_API_KEY actif

# 2. Redéployer l'application
git revert <commit-migration>
npm run build
npm run deploy

# 3. Analyser les logs
# 4. Corriger les problèmes
# 5. Re-tenter la migration
```

---

## 📚 Ressources

- [Documentation Neon.tech](https://neon.tech/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Migration Best Practices](https://neon.tech/docs/import/migrate-from-other-platforms)

---

## ❓ FAQ

**Q: Puis-je utiliser Prisma au lieu de queries SQL directes ?**
R: Oui ! Créez un `schema.prisma` et générez le client Prisma.

**Q: Combien de temps prend la migration ?**
R: Environ 2-4 heures pour 10 000 enregistrements.

**Q: Neon gratuit suffit-il ?**
R: Oui pour dev/test. Production nécessite plan Pro ($19/mois).

**Q: Comment gérer les formules Airtable complexes ?**
R: Parser manuel ou recréer la logique en SQL/TypeScript.

---

## ✅ Conclusion

Vous avez maintenant tous les outils pour migrer avec succès vers PostgreSQL !

**Prochaine étape:** Exécutez `schema.sql` sur Neon.tech 🚀
