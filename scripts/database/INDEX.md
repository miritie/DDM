# 📚 Documentation PostgreSQL - Index

Bienvenue dans la documentation complète pour la migration vers PostgreSQL !

---

## 📁 Fichiers Disponibles

### 🎯 Pour Commencer

| Fichier | Description | Temps requis |
|---------|-------------|--------------|
| **[QUICKSTART.md](QUICKSTART.md)** | Guide ultra-rapide pour démarrer en 15 min | ⏱️ 15 min |
| **[README-MIGRATION.md](README-MIGRATION.md)** | Guide complet de migration détaillé | ⏱️ 2h de lecture |

### 🗄️ Scripts SQL

| Fichier | Description | Ordre |
|---------|-------------|-------|
| **[schema.sql](schema.sql)** | DDL PostgreSQL - Partie 1 (tables principales) | 1️⃣ |
| **[schema-part2.sql](schema-part2.sql)** | DDL PostgreSQL - Partie 2 (RH, Clients, Fidélité) | 2️⃣ |
| **[schema-part3.sql](schema-part3.sql)** | DDL PostgreSQL - Partie 3 (Consignation, Compta, IA) | 3️⃣ |
| **[seed-data.sql](seed-data.sql)** | Données de test cohérentes et réalistes | 4️⃣ |

### 🔧 Scripts de Migration

| Fichier | Description | Usage |
|---------|-------------|-------|
| **[migrate-to-postgres.ts](../migrate-to-postgres.ts)** | Script automatisé de migration Airtable → PostgreSQL | `npm run migrate` |

### 📖 Références

| Fichier | Description |
|---------|-------------|
| **[COMMANDS.md](COMMANDS.md)** | Aide-mémoire : toutes les commandes PostgreSQL utiles |
| **[INDEX.md](INDEX.md)** | Ce fichier - Index de la documentation |

---

## 🚀 Scénarios d'Usage

### Scénario 1 : Je veux juste tester PostgreSQL rapidement

➡️ Suivez [QUICKSTART.md](QUICKSTART.md)

**Résumé :**
1. Créer compte Neon.tech
2. Exécuter `schema.sql`, `schema-part2.sql`, `schema-part3.sql`
3. Exécuter `seed-data.sql`
4. Tester avec les données de démo

**Temps total : 15 minutes**

---

### Scénario 2 : Je veux migrer mes données Airtable en production

➡️ Suivez [README-MIGRATION.md](README-MIGRATION.md)

**Résumé :**
1. Setup Neon.tech
2. Créer le schéma (3 fichiers SQL)
3. Configurer `.env.local`
4. Installer dépendances : `npm install pg @types/pg`
5. Test migration : `npm run migrate:dry-run`
6. Migration réelle : `npm run migrate`
7. Vérification et tests
8. Bascule production

**Temps total : 1-2 jours**

---

### Scénario 3 : Je veux comprendre comment adapter mon code

➡️ Consultez [README-MIGRATION.md](README-MIGRATION.md) section "Étape 6"

**Points clés :**
- Créer une interface `DatabaseClient`
- Implémenter `PostgresClient`
- Parser les formules Airtable → SQL WHERE
- Mapper PascalCase → snake_case
- Ajouter support des transactions

---

### Scénario 4 : J'ai besoin d'aide avec les commandes SQL

➡️ Consultez [COMMANDS.md](COMMANDS.md)

**Contenu :**
- Connexion (psql, Node.js)
- Requêtes de base (SELECT, INSERT, UPDATE, DELETE)
- Recherche & filtrage
- Statistiques & analyse
- Index & performance
- Backup & restore
- Maintenance
- Dépannage

---

## 📊 Structure de la Base de Données

### Modules Implémentés (60 tables)

| Module | Tables | Statut |
|--------|--------|--------|
| **Admin** | workspaces, users, roles, permissions | ✅ Complet |
| **Ventes** | sales, sale_items, sale_payments, products, clients | ✅ Complet |
| **Clients & Fidélité** | customers, loyalty_transactions, rewards, tiers | ✅ Complet |
| **Stock** | stock_items, stock_movements, warehouses, alerts | ✅ Complet |
| **Trésorerie** | wallets, transactions | ✅ Complet |
| **Production** | recipes, production_orders, ingredients, batches | ✅ Complet |
| **Dépenses** | expenses, expense_requests, categories, proofs | ✅ Complet |
| **Avances & Dettes** | advance_debts, movements, schedules, accounts | ✅ Complet |
| **RH** | employees, attendances, leaves, payrolls, commissions | ✅ Complet |
| **Consignation** | partners, deposits, sales_reports, settlements | ✅ Complet |
| **Comptabilité** | chart_accounts, journals, journal_entries | ✅ Complet |
| **Rapports** | reports, report_executions | ✅ Complet |
| **Notifications** | notifications, audit_logs | ✅ Complet |

---

## 🎓 Concepts Clés

### 1. Mapping Airtable → PostgreSQL

**Noms de tables :**
```
Airtable (PascalCase)  →  PostgreSQL (snake_case pluriel)
Customer               →  customers
SaleItem               →  sale_items
LoyaltyTransaction     →  loyalty_transactions
```

**Noms de colonnes :**
```
Airtable (PascalCase)  →  PostgreSQL (snake_case)
CustomerId             →  customer_id
FullName               →  full_name
TotalAmount            →  total_amount
CreatedAt              →  created_at
```

### 2. Formules Airtable → SQL WHERE

**Exemples :**

```javascript
// Airtable
filterByFormula: `{WorkspaceId} = '${workspaceId}'`

// PostgreSQL
WHERE workspace_id = $1
```

```javascript
// Airtable
filterByFormula: `AND({Status} = 'active', {Type} = 'business')`

// PostgreSQL
WHERE status = $1 AND type = $2
```

```javascript
// Airtable
filterByFormula: `YEAR({CreatedAt}) = 2024`

// PostgreSQL
WHERE EXTRACT(YEAR FROM created_at) = 2024
```

### 3. Relations & Foreign Keys

Contrairement à Airtable, PostgreSQL applique l'intégrité référentielle :

```sql
-- La vente DOIT référencer un client existant
ALTER TABLE sales
  ADD CONSTRAINT fk_sales_customer
  FOREIGN KEY (client_id)
  REFERENCES customers(id)
  ON DELETE SET NULL;
```

### 4. Transactions ACID

PostgreSQL supporte les transactions (Airtable non) :

```typescript
await pool.query('BEGIN');
try {
  await pool.query('INSERT INTO sales ...');
  await pool.query('INSERT INTO sale_items ...');
  await pool.query('COMMIT');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
}
```

---

## 🔗 Ressources Externes

### Documentation Officielle

- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [Neon Documentation](https://neon.tech/docs)
- [Node.js pg Library](https://node-postgres.com/)

### Tutoriels

- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [SQL Cheat Sheet](https://www.sqltutorial.org/sql-cheat-sheet/)

### Outils

- [pgAdmin](https://www.pgadmin.org/) - Client graphique PostgreSQL
- [Postico](https://eggerapps.at/postico/) - Client macOS (payant)
- [TablePlus](https://tableplus.com/) - Client multi-plateforme
- [DBeaver](https://dbeaver.io/) - Client gratuit open-source

---

## 💡 Conseils & Best Practices

### ✅ À Faire

- ✅ Toujours tester avec `--dry-run` avant migration
- ✅ Faire un backup Airtable avant migration
- ✅ Utiliser des transactions pour opérations multi-tables
- ✅ Créer des index sur les colonnes fréquemment filtrées
- ✅ Utiliser des vues matérialisées pour rapports complexes
- ✅ Activer Row Level Security pour multi-tenancy
- ✅ Monitorer les performances avec `EXPLAIN ANALYZE`

### ❌ À Éviter

- ❌ Supprimer les données Airtable immédiatement après migration
- ❌ Oublier de mapper workspace_id dans toutes les requêtes
- ❌ Faire des requêtes N+1 (utiliser JOINs)
- ❌ Stocker des mots de passe en clair
- ❌ Oublier de gérer les erreurs de contraintes FK
- ❌ Utiliser `SELECT *` en production (lister les colonnes)

---

## 🆘 Support

### En cas de problème

1. **Vérifiez [COMMANDS.md](COMMANDS.md)** section Dépannage
2. **Consultez [README-MIGRATION.md](README-MIGRATION.md)** section Rollback
3. **Vérifiez les logs Neon.tech**
4. **Testez la connexion** : `psql "$DATABASE_URL" -c "SELECT NOW()"`

### FAQ Rapide

**Q: Combien coûte Neon.tech ?**
R: Gratuit pour dev/test (3 projets, 3GB). Pro à $19/mois pour production.

**Q: Puis-je migrer progressivement ?**
R: Oui ! Utilisez le pattern Dual-Write (voir README-MIGRATION.md).

**Q: Que faire en cas d'échec ?**
R: Rollback immédiat vers Airtable. Analysez les logs, corrigez, re-testez.

**Q: Les données de test sont-elles réalistes ?**
R: Oui ! seed-data.sql contient des données cohérentes pour tester toute l'app.

---

## 🗺️ Feuille de Route

### Phase 1 : Setup ✅
- [x] Schéma PostgreSQL complet
- [x] Données de test
- [x] Documentation

### Phase 2 : Migration (Vous êtes ici) 🎯
- [ ] Tester le schéma sur Neon
- [ ] Insérer données de test
- [ ] Adapter le code (PostgresClient)
- [ ] Migration Airtable → PostgreSQL

### Phase 3 : Production 🚀
- [ ] Tests end-to-end
- [ ] Performance tuning
- [ ] Monitoring
- [ ] Bascule production
- [ ] Support & maintenance

---

## 📞 Contact & Contribution

Ce projet est en évolution constante. N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Partager vos retours d'expérience

---

**Prêt à démarrer ?** 👉 Commencez par [QUICKSTART.md](QUICKSTART.md) ! 🚀
