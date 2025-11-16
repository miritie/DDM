# 📝 Commandes PostgreSQL - Aide-Mémoire

Toutes les commandes utiles pour gérer votre base PostgreSQL.

---

## 🔌 Connexion

### Via psql

```bash
# Connexion directe
psql "$DATABASE_URL"

# Exécuter un script
psql "$DATABASE_URL" -f mon-script.sql

# Exécuter une commande
psql "$DATABASE_URL" -c "SELECT * FROM users LIMIT 5;"

# Mode interactif
export PGHOST=ep-xxx.eu-central-1.aws.neon.tech
export PGDATABASE=ddmdb
export PGUSER=your_user
export PGPASSWORD=your_password
psql
```

### Via Node.js

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const result = await pool.query('SELECT NOW()');
console.log(result.rows);

await pool.end();
```

---

## 🗂️ Gestion du Schéma

### Créer le schéma complet

```bash
# Ordre important !
psql "$DATABASE_URL" -f scripts/database/schema.sql
psql "$DATABASE_URL" -f scripts/database/schema-part2.sql
psql "$DATABASE_URL" -f scripts/database/schema-part3.sql
```

### Lister les tables

```sql
-- Toutes les tables
\dt

-- Avec détails
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Compter les tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
```

### Voir la structure d'une table

```sql
-- Via psql
\d customers

-- Via SQL
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
```

### Supprimer toutes les tables

```sql
-- ATTENTION : Destructif !
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

---

## 📊 Requêtes de Données

### Compter les enregistrements

```sql
-- Une table
SELECT COUNT(*) FROM customers;

-- Toutes les tables principales
SELECT
  'workspaces' as table, COUNT(*) as count FROM workspaces
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'customers', COUNT(*) FROM customers
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'sales', COUNT(*) FROM sales
  UNION ALL SELECT 'stock_items', COUNT(*) FROM stock_items
  UNION ALL SELECT 'wallets', COUNT(*) FROM wallets
ORDER BY table;
```

### Requêtes de base

```sql
-- SELECT simple
SELECT * FROM customers WHERE status = 'active';

-- JOIN
SELECT
  s.sale_number,
  c.full_name as customer_name,
  s.total_amount,
  s.payment_status
FROM sales s
LEFT JOIN customers c ON s.client_id = c.id
WHERE s.workspace_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY s.sale_date DESC
LIMIT 10;

-- Agrégations
SELECT
  DATE_TRUNC('month', sale_date) as month,
  COUNT(*) as total_sales,
  SUM(total_amount) as revenue,
  AVG(total_amount) as avg_sale
FROM sales
WHERE status != 'cancelled'
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY month DESC;

-- Sous-requêtes
SELECT
  p.name,
  p.unit_price,
  (SELECT SUM(quantity) FROM sale_items WHERE product_id = p.id) as total_sold
FROM products p
ORDER BY total_sold DESC NULLS LAST
LIMIT 10;
```

---

## ✏️ Insertion & Modification

### Insérer des données

```sql
-- INSERT simple
INSERT INTO customers (
  id, customer_id, customer_code, full_name, phone, type,
  status, loyalty_tier, member_since, workspace_id
) VALUES (
  uuid_generate_v4(),
  'CUS-TEST-001',
  'TEST-001',
  'Test Customer',
  '+237600000000',
  'individual',
  'active',
  'bronze',
  CURRENT_DATE,
  '550e8400-e29b-41d4-a716-446655440001'
);

-- INSERT avec retour
INSERT INTO products (
  id, product_id, name, code, unit_price, currency, workspace_id
) VALUES (
  uuid_generate_v4(),
  'PRD-TEST-001',
  'Produit Test',
  'TEST-001',
  1000,
  'XOF',
  '550e8400-e29b-41d4-a716-446655440001'
)
RETURNING *;

-- INSERT multiple
INSERT INTO products (id, product_id, name, code, unit_price, workspace_id)
VALUES
  (uuid_generate_v4(), 'PRD-001', 'Produit 1', 'P001', 100, 'WS-001'),
  (uuid_generate_v4(), 'PRD-002', 'Produit 2', 'P002', 200, 'WS-001'),
  (uuid_generate_v4(), 'PRD-003', 'Produit 3', 'P003', 300, 'WS-001');
```

### Mettre à jour

```sql
-- UPDATE simple
UPDATE customers
SET status = 'vip', loyalty_tier = 'gold'
WHERE customer_id = 'CUS-001';

-- UPDATE avec WHERE complexe
UPDATE stock_items
SET quantity = quantity - 10
WHERE product_id = (SELECT id FROM products WHERE code = 'PRD-001')
  AND warehouse_id = (SELECT id FROM warehouses WHERE code = 'WH-001');

-- UPDATE avec JOIN (PostgreSQL)
UPDATE sales s
SET client_name = c.full_name
FROM customers c
WHERE s.client_id = c.id
  AND s.client_name IS NULL;
```

### Supprimer

```sql
-- DELETE simple
DELETE FROM customers WHERE customer_id = 'CUS-TEST-001';

-- DELETE avec sous-requête
DELETE FROM sale_items
WHERE sale_id IN (
  SELECT id FROM sales WHERE status = 'cancelled'
);

-- TRUNCATE (plus rapide pour vider une table)
TRUNCATE TABLE notifications CASCADE;
```

---

## 🔍 Recherche & Filtrage

### Recherche texte

```sql
-- LIKE (insensible à la casse avec ILIKE)
SELECT * FROM customers
WHERE full_name ILIKE '%diallo%';

-- Recherche multiple
SELECT * FROM products
WHERE name ILIKE '%coca%'
   OR description ILIKE '%coca%'
   OR code ILIKE '%coca%';

-- Recherche full-text (après activation pg_trgm)
SELECT * FROM customers
WHERE full_name % 'amadou'; -- Similarité
```

### Filtres avancés

```sql
-- IN
SELECT * FROM sales
WHERE payment_status IN ('unpaid', 'partially_paid');

-- BETWEEN
SELECT * FROM sales
WHERE sale_date BETWEEN '2024-11-01' AND '2024-11-30';

-- NULL checks
SELECT * FROM customers
WHERE email IS NOT NULL;

-- Array contains
SELECT * FROM roles
WHERE 'SALES_CREATE' = ANY(permission_ids);

-- JSONB queries
SELECT * FROM customer_segments
WHERE criteria->>'minTotalSpent' > '10000';
```

---

## 📈 Statistiques & Analyse

### Compter par groupe

```sql
-- Clients par tier
SELECT loyalty_tier, COUNT(*) as count
FROM customers
GROUP BY loyalty_tier
ORDER BY count DESC;

-- Ventes par mois
SELECT
  DATE_TRUNC('month', sale_date) as month,
  COUNT(*) as nb_sales,
  SUM(total_amount) as revenue
FROM sales
WHERE status != 'cancelled'
GROUP BY month
ORDER BY month DESC;

-- Top 10 produits
SELECT
  p.name,
  COUNT(si.id) as nb_ventes,
  SUM(si.quantity) as qty_totale,
  SUM(si.total_price) as revenue
FROM products p
JOIN sale_items si ON p.id = si.product_id
GROUP BY p.id, p.name
ORDER BY revenue DESC
LIMIT 10;
```

### Vues matérialisées

```sql
-- Rafraîchir les vues
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_statistics;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_stock;

-- Voir le contenu
SELECT * FROM mv_sales_statistics
WHERE workspace_id = '550e8400-e29b-41d4-a716-446655440001'
ORDER BY month DESC;

SELECT * FROM mv_current_stock
WHERE stock_status IN ('low_stock', 'out_of_stock');
```

---

## 🎯 Index & Performance

### Lister les index

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Analyser une requête

```sql
-- Plan d'exécution
EXPLAIN SELECT * FROM sales
WHERE workspace_id = '550e8400-e29b-41d4-a716-446655440001';

-- Plan avec timing réel
EXPLAIN ANALYZE SELECT * FROM sales
WHERE workspace_id = '550e8400-e29b-41d4-a716-446655440001';

-- Trouver les requêtes lentes (nécessite pg_stat_statements)
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Créer des index

```sql
-- Index simple
CREATE INDEX idx_sales_date ON sales(sale_date);

-- Index composite
CREATE INDEX idx_sales_workspace_date ON sales(workspace_id, sale_date);

-- Index partiel
CREATE INDEX idx_active_customers ON customers(workspace_id)
WHERE status = 'active';

-- Index sur JSONB
CREATE INDEX idx_segments_criteria ON customer_segments USING GIN (criteria);
```

---

## 🔐 Sécurité & Permissions

### Row Level Security

```sql
-- Activer RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Créer une politique (exemple)
CREATE POLICY customers_workspace_isolation ON customers
  FOR ALL
  USING (workspace_id = current_setting('app.current_workspace')::uuid);

-- Voir les politiques
\d+ customers
```

### Utilisateurs et rôles

```sql
-- Créer un utilisateur (lecture seule)
CREATE USER readonly_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE ddmdb TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- Lister les utilisateurs
\du
```

---

## 🧹 Maintenance

### Vacuum & Analyze

```sql
-- Analyser (met à jour les statistiques)
ANALYZE;
ANALYZE customers;

-- Vacuum (récupère l'espace)
VACUUM;
VACUUM FULL customers; -- Plus agressif, bloque la table

-- Auto-analyze (voir l'activité)
SELECT * FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

### Taille des tables

```sql
-- Taille de toutes les tables
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;

-- Taille d'une table spécifique
SELECT pg_size_pretty(pg_total_relation_size('sales'));

-- Taille de la base complète
SELECT pg_size_pretty(pg_database_size(current_database()));
```

---

## 💾 Backup & Restore

### Export (dump)

```bash
# Dump complet
pg_dump "$DATABASE_URL" > backup.sql

# Dump avec compression
pg_dump "$DATABASE_URL" | gzip > backup.sql.gz

# Dump une seule table
pg_dump "$DATABASE_URL" -t customers > customers_backup.sql

# Dump seulement les données
pg_dump "$DATABASE_URL" --data-only > data_only.sql

# Dump seulement le schéma
pg_dump "$DATABASE_URL" --schema-only > schema_only.sql
```

### Import (restore)

```bash
# Restore complet
psql "$DATABASE_URL" < backup.sql

# Restore avec compression
gunzip -c backup.sql.gz | psql "$DATABASE_URL"

# Restore une table
psql "$DATABASE_URL" < customers_backup.sql
```

---

## 🧪 Tests & Développement

### Transactions manuelles

```sql
-- Commencer une transaction
BEGIN;

-- Faire des modifications
UPDATE customers SET loyalty_points = loyalty_points + 100
WHERE customer_id = 'CUS-001';

-- Vérifier
SELECT * FROM customers WHERE customer_id = 'CUS-001';

-- Annuler si problème
ROLLBACK;

-- Ou valider si OK
COMMIT;
```

### Données de test

```sql
-- Générer des données factices
INSERT INTO customers (id, customer_id, customer_code, full_name, phone, type, workspace_id)
SELECT
  uuid_generate_v4(),
  'CUS-GEN-' || generate_series,
  'GEN-' || LPAD(generate_series::text, 4, '0'),
  'Client Test ' || generate_series,
  '+237690' || LPAD((RANDOM() * 999999)::int::text, 6, '0'),
  'individual',
  '550e8400-e29b-41d4-a716-446655440001'
FROM generate_series(1, 100);
```

---

## 📱 Monitoring (Neon.tech)

### Métriques importantes

```sql
-- Connexions actives
SELECT count(*) FROM pg_stat_activity;

-- Connexions par database
SELECT datname, count(*)
FROM pg_stat_activity
GROUP BY datname;

-- Requêtes en cours
SELECT pid, usename, state, query
FROM pg_stat_activity
WHERE state != 'idle';

-- Locks
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## 🆘 Dépannage

### Table ou colonne inexistante

```sql
-- Lister toutes les colonnes d'une table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers';
```

### Contrainte violée

```sql
-- Voir les contraintes
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'customers';

-- Désactiver temporairement (DANGEREUX)
ALTER TABLE customers DISABLE TRIGGER ALL;
-- ... faire les modifications
ALTER TABLE customers ENABLE TRIGGER ALL;
```

### Deadlock

```sql
-- Voir les locks
SELECT * FROM pg_locks;

-- Tuer une requête bloquante
SELECT pg_cancel_backend(pid);
SELECT pg_terminate_backend(pid);
```

---

## 🎓 Ressources

- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Neon Docs](https://neon.tech/docs)
- [psql Commands Cheatsheet](https://www.postgresql.org/docs/current/app-psql.html)

---

Gardez ce fichier sous la main comme référence rapide ! 🚀
