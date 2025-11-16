# 🚀 Démarrage Rapide - Migration PostgreSQL

Guide ultra-simplifié pour migrer vers PostgreSQL en 15 minutes.

---

## ⚡ Étapes Rapides

### 1️⃣ Créer la base Neon (2 min)

1. Allez sur [neon.tech](https://neon.tech) → Créer un compte
2. Créez un projet : `ddm-production`
3. Copiez la connection string

### 2️⃣ Configuration (1 min)

Ajoutez dans `.env.local` :

```env
DATABASE_URL="postgres://user:password@ep-xxx.eu-central-1.aws.neon.tech/ddmdb?sslmode=require"
```

### 3️⃣ Installer les dépendances (1 min)

```bash
npm install pg @types/pg dotenv
```

### 4️⃣ Créer le schéma (5 min)

**Option A - Via Neon SQL Editor (Recommandé):**

1. Connectez-vous à Neon.tech
2. Allez dans "SQL Editor"
3. Exécutez dans l'ordre :
   - Copiez [schema.sql](schema.sql) → Exécutez
   - Copiez [schema-part2.sql](schema-part2.sql) → Exécutez
   - Copiez [schema-part3.sql](schema-part3.sql) → Exécutez

**Option B - Via ligne de commande:**

```bash
# Installer psql si nécessaire
brew install postgresql

# Exécuter les scripts
psql "$DATABASE_URL" -f scripts/database/schema.sql
psql "$DATABASE_URL" -f scripts/database/schema-part2.sql
psql "$DATABASE_URL" -f scripts/database/schema-part3.sql
```

### 5️⃣ Ajouter des données de test (2 min)

```bash
psql "$DATABASE_URL" -f scripts/database/seed-data.sql
```

### 6️⃣ Tester la connexion (1 min)

Créez `test-db.ts` :

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  const result = await pool.query('SELECT COUNT(*) FROM workspaces');
  console.log('Workspaces:', result.rows[0].count);
  await pool.end();
}

test();
```

Exécutez :

```bash
tsx test-db.ts
# Devrait afficher: Workspaces: 2
```

---

## ✅ Vérification

Connectez-vous à Neon SQL Editor et exécutez :

```sql
-- Voir toutes les tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Vérifier les données
SELECT * FROM workspaces;
SELECT * FROM users;
SELECT * FROM products LIMIT 5;
SELECT * FROM sales;
```

---

## 🎯 Prochaines Étapes

### Option 1 : Utiliser les données de test

Vous pouvez maintenant développer avec les données de test :

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Exemple : Récupérer les produits
async function getProducts() {
  const result = await pool.query('SELECT * FROM products WHERE is_active = true');
  return result.rows;
}
```

### Option 2 : Migrer vos données Airtable réelles

```bash
# Test sans écriture
npm run migrate:dry-run

# Migration réelle
npm run migrate

# Migration avec logs détaillés
npm run migrate:verbose
```

---

## 🛠️ Commandes Utiles

```bash
# Voir les tables
psql "$DATABASE_URL" -c "\dt"

# Compter les enregistrements
psql "$DATABASE_URL" -c "SELECT
  'workspaces' as table, COUNT(*) FROM workspaces
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'sales', COUNT(*) FROM sales;"

# Supprimer toutes les données (ATTENTION!)
psql "$DATABASE_URL" -c "TRUNCATE TABLE
  sales, sale_items, sale_payments,
  customers, products,
  stock_items, stock_movements
  CASCADE;"

# Réinitialiser complètement
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# Puis ré-exécuter schema.sql, schema-part2.sql, schema-part3.sql
```

---

## 🐛 Dépannage

### Erreur "relation does not exist"

→ Le schéma n'a pas été créé. Ré-exécutez les 3 fichiers schema.

### Erreur "permission denied"

→ Vérifiez votre DATABASE_URL et que vous avez les droits.

### Erreur "too many connections"

→ Fermez les connexions ouvertes :

```typescript
await pool.end();
```

### Schéma créé mais tables vides

→ Exécutez `seed-data.sql`

---

## 📊 Données de Test Incluses

Après `seed-data.sql`, vous aurez :

| Table | Enregistrements |
|-------|----------------|
| Workspaces | 2 |
| Users | 5 |
| Products | 12 |
| Customers | 6 |
| Clients | 0 |
| Sales | 5 |
| Sale Items | 13 |
| Wallets | 4 |
| Warehouses | 3 |
| Stock Items | 8 |

**Utilisateurs de test:**
- admin@ddm.cm (Admin)
- paul.nguesso@ddm.cm (Manager)
- sylvie.mbarga@ddm.cm (Agent Commercial)
- roger.fotso@ddm.cm (Agent Commercial)
- jean.tala@ddm.cm (Magasinier)

Mot de passe : `password123`

---

## 🎉 C'est tout !

Vous êtes prêt à développer avec PostgreSQL !

**Besoin d'aide ?** Consultez [README-MIGRATION.md](README-MIGRATION.md) pour le guide complet.
