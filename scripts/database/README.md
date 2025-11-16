# 🗄️ Migration PostgreSQL - Documentation Complète

Bienvenue ! Ce dossier contient **TOUT** ce dont vous avez besoin pour migrer votre application DDM d'Airtable vers PostgreSQL (Neon.tech).

---

## 🎯 Démarrage Ultra-Rapide (5 min)

Vous voulez juste voir si ça marche ? Suivez ces 3 étapes :

1. **Créez un compte Neon** : [neon.tech](https://neon.tech)
2. **Copiez la connection string** dans `.env.local` :
   ```env
   DATABASE_URL="postgres://..."
   ```
3. **Exécutez les scripts** dans l'éditeur SQL de Neon :
   - `schema.sql` ➜ Cliquez "Run"
   - `schema-part2.sql` ➜ Cliquez "Run"
   - `schema-part3.sql` ➜ Cliquez "Run"
   - `seed-data.sql` ➜ Cliquez "Run"

✅ **C'est tout !** Vous avez une base complète avec des données de test.

👉 **Guide détaillé :** [QUICKSTART.md](QUICKSTART.md)

---

## 📚 Documentation Disponible

| Document | Description | Quand l'utiliser ? |
|----------|-------------|-------------------|
| **[INDEX.md](INDEX.md)** | 📑 Index de toute la documentation | Point d'entrée principal |
| **[QUICKSTART.md](QUICKSTART.md)** | ⚡ Guide rapide 15 min | Je veux tester rapidement |
| **[README-MIGRATION.md](README-MIGRATION.md)** | 📖 Guide complet de migration | Je veux migrer en production |
| **[COMMANDS.md](COMMANDS.md)** | 🔧 Aide-mémoire SQL | J'ai besoin d'une commande |

---

## 📁 Fichiers SQL

### Schéma de la Base (DDL)

| Fichier | Tables | Description |
|---------|--------|-------------|
| **schema.sql** | ~20 tables | Admin, Ventes, Stock, Trésorerie |
| **schema-part2.sql** | ~25 tables | RH, Clients, Fidélité |
| **schema-part3.sql** | ~15 tables | Consignation, Comptabilité, IA |

**Total : 60 tables + vues + fonctions + triggers**

### Données de Test

| Fichier | Description |
|---------|-------------|
| **seed-data.sql** | Données réalistes pour tester l'application complète |

**Contenu :**
- 2 workspaces
- 5 utilisateurs (admin, manager, agents, magasinier)
- 12 produits (boissons, alimentaire, hygiène)
- 6 clients (individuels et entreprises)
- 5 ventes complètes avec items et paiements
- 4 wallets (caisse, banque, mobile money)
- 3 entrepôts avec stock

---

## 🔧 Script de Migration

| Fichier | Description | Usage |
|---------|-------------|-------|
| **migrate-to-postgres.ts** | Migration automatique Airtable → PostgreSQL | `npm run migrate` |

**Fonctionnalités :**
- ✅ Migration par batches (performance)
- ✅ Mode dry-run (test sans écriture)
- ✅ Gestion des erreurs
- ✅ Vérification post-migration
- ✅ Mapping automatique PascalCase → snake_case
- ✅ Respect de l'ordre des dépendances (FK)

---

## 🏗️ Architecture PostgreSQL

### Modules Implémentés

```
┌─────────────────────────────────────────────┐
│             WORKSPACES (Multi-tenant)        │
└─────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌───▼────┐ ┌─────▼─────┐
│   ADMIN      │ │ VENTES │ │   STOCK   │
│ users        │ │ sales  │ │ warehouses│
│ roles        │ │ clients│ │ movements │
│ permissions  │ │ products│ │   items   │
└──────────────┘ └────────┘ └───────────┘

┌──────────────┐ ┌────────┐ ┌───────────┐
│     RH       │ │TRÉSO   │ │ CLIENTS   │
│ employees    │ │wallets │ │ customers │
│ payrolls     │ │transac │ │ loyalty   │
│ attendances  │ │        │ │ segments  │
└──────────────┘ └────────┘ └───────────┘

┌──────────────┐ ┌────────────┐ ┌──────────┐
│ PRODUCTION   │ │ CONSIGN    │ │  COMPTA  │
│ recipes      │ │ partners   │ │ journals │
│ orders       │ │ deposits   │ │ entries  │
│ ingredients  │ │ reports    │ │ accounts │
└──────────────┘ └────────────┘ └──────────┘
```

### Features Techniques

**Intégrité :**
- ✅ Foreign Keys (contraintes référentielles)
- ✅ Check Constraints (validation données)
- ✅ Unique Constraints (pas de doublons)
- ✅ Default Values (valeurs par défaut)

**Performance :**
- ✅ 50+ Index (workspace_id, dates, codes, statuts)
- ✅ 2 Vues matérialisées (statistiques ventes, stock actuel)
- ✅ Triggers (mise à jour auto de updated_at)

**Sécurité :**
- ✅ Row Level Security (RLS) préparé
- ✅ SSL/TLS (Neon.tech)
- ✅ Audit logs

**Avancé :**
- ✅ Transactions ACID
- ✅ JOINs optimisés
- ✅ Types ENUM (évite les erreurs)
- ✅ Arrays & JSONB
- ✅ Fonctions PL/pgSQL

---

## 🚀 Cas d'Usage

### 1. Je veux juste tester PostgreSQL (DEV)

```bash
# 1. Setup Neon
# 2. Exécuter les 3 schémas + seed-data
# 3. Tester
npm install pg @types/pg
tsx test-connection.ts
```

➡️ Suivez [QUICKSTART.md](QUICKSTART.md)

---

### 2. Je veux migrer mes données Airtable (PROD)

```bash
# 1. Setup Neon
# 2. Créer le schéma (3 fichiers)
# 3. Installer dépendances
npm install pg @types/pg dotenv

# 4. Test migration
npm run migrate:dry-run

# 5. Migration réelle
npm run migrate

# 6. Vérification
npm run migrate:verbose
```

➡️ Suivez [README-MIGRATION.md](README-MIGRATION.md)

---

### 3. J'ai besoin d'aide avec SQL

➡️ Consultez [COMMANDS.md](COMMANDS.md)

**Exemples rapides :**

```sql
-- Voir toutes les tables
\dt

-- Compter les clients
SELECT COUNT(*) FROM customers;

-- Ventes du mois
SELECT * FROM sales
WHERE sale_date >= DATE_TRUNC('month', CURRENT_DATE);

-- Top 10 produits
SELECT p.name, SUM(si.quantity) as qty
FROM sale_items si
JOIN products p ON si.product_id = p.id
GROUP BY p.id, p.name
ORDER BY qty DESC
LIMIT 10;
```

---

## 🎓 Ce que vous apprendrez

En suivant cette documentation, vous maîtriserez :

### PostgreSQL
- ✅ DDL (CREATE TABLE, ALTER, INDEX)
- ✅ DML (INSERT, UPDATE, DELETE, SELECT)
- ✅ JOINs (INNER, LEFT, RIGHT)
- ✅ Aggregations (COUNT, SUM, AVG, GROUP BY)
- ✅ Transactions (BEGIN, COMMIT, ROLLBACK)
- ✅ Contraintes (FK, UNIQUE, CHECK)
- ✅ Index & Performance
- ✅ Vues matérialisées

### Migration
- ✅ Mapping Airtable → PostgreSQL
- ✅ Conversion PascalCase → snake_case
- ✅ Parser formules Airtable → SQL WHERE
- ✅ Gestion des dépendances (FK)
- ✅ Migration par batches
- ✅ Stratégies de rollback

### Node.js + PostgreSQL
- ✅ Connexion avec `pg`
- ✅ Requêtes paramétrées ($1, $2)
- ✅ Connection pooling
- ✅ Gestion d'erreurs
- ✅ Transactions programmatiques

---

## 📊 Statistiques du Projet

| Métrique | Valeur |
|----------|--------|
| **Tables** | 60 |
| **Index** | 50+ |
| **Vues matérialisées** | 2 |
| **Triggers** | 60+ (update timestamps) |
| **Fonctions** | 4 |
| **Types ENUM** | 25+ |
| **Lignes de SQL** | ~3000 |
| **Lignes de Doc** | ~2000 |

---

## ✅ Checklist Complète

### Préparation
- [ ] Compte Neon.tech créé
- [ ] Connection string récupérée
- [ ] `.env.local` configuré
- [ ] Dépendances installées (`pg`, `@types/pg`)

### Création du Schéma
- [ ] `schema.sql` exécuté
- [ ] `schema-part2.sql` exécuté
- [ ] `schema-part3.sql` exécuté
- [ ] Vérification : 60 tables créées

### Données de Test (Optionnel)
- [ ] `seed-data.sql` exécuté
- [ ] Vérification : données présentes

### Migration Airtable (Production)
- [ ] Test avec `--dry-run`
- [ ] Migration exécutée
- [ ] Vérification des comptages
- [ ] Tests end-to-end

### Adaptation du Code
- [ ] `PostgresClient` créé
- [ ] Services modifiés
- [ ] Tests unitaires
- [ ] Tests d'intégration

### Production
- [ ] Performance validée
- [ ] Backup configuré
- [ ] Monitoring actif
- [ ] Documentation à jour

---

## 🆘 Support

### Documentation
- 📘 [INDEX.md](INDEX.md) - Vue d'ensemble
- ⚡ [QUICKSTART.md](QUICKSTART.md) - Démarrage rapide
- 📖 [README-MIGRATION.md](README-MIGRATION.md) - Guide complet
- 🔧 [COMMANDS.md](COMMANDS.md) - Commandes SQL

### Ressources Externes
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Neon Docs](https://neon.tech/docs)
- [Node.js pg](https://node-postgres.com/)

### FAQ
- **Q: Combien de temps pour la migration ?**
  R: 15 min (test) à 2 jours (production complète)

- **Q: Neon est-il gratuit ?**
  R: Oui pour dev/test. $19/mois pour production.

- **Q: Puis-je revenir en arrière ?**
  R: Oui, gardez Airtable actif 1 semaine après migration.

---

## 🎉 Vous êtes prêt !

**Prochaine étape :** Choisissez votre parcours

| Objectif | Document | Temps |
|----------|----------|-------|
| 🧪 **Tester rapidement** | [QUICKSTART.md](QUICKSTART.md) | 15 min |
| 🚀 **Migrer en production** | [README-MIGRATION.md](README-MIGRATION.md) | 1-2 jours |
| 📚 **Apprendre PostgreSQL** | [COMMANDS.md](COMMANDS.md) | À votre rythme |

---

**Bonne migration ! 🚀**

Si vous avez des questions, consultez [INDEX.md](INDEX.md) pour naviguer dans la documentation.
