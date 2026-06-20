# Données réelles DDM (issues de l'OCR des groupes WhatsApp)

Pipeline d'alimentation de la base avec l'**historique réel** de Dune de Miel (2025 → aujourd'hui),
reconstitué par OCR des feuilles « JOURNAL DU STAND » et des échanges des 3 groupes WhatsApp
(Administration, Stand, Usine).

## Chaîne

1. **OCR** (fait, hors-ligne) → `docs/donnees-reelles/datasets/{stand,usine,admin}.jsonl`
   (un objet par photo, transcription fidèle ; les zips/photos bruts restent hors git).
2. **`build-real-fixtures.py`** → `scripts/data/real/*.json`
   Transforme les datasets en fixtures normalisées :
   - `products.json` — catalogue (prix unitaires **dérivés du réel** : recette ÷ unités).
   - `outlets.json` — 7 stands réels.
   - `people.json` — commerciaux (variantes OCR fusionnées) + ouvriers usine → users + employees.
   - `sales.json` — 1 vente/stand/jour, lignes par produit, primes, observation ; réconciliées au
     total caisse (résiduel/échelle ; fallback Σrecette si total absurde).
   - `stock.json` — inventaire de clôture le plus récent par stand/produit.
   - `expenses.json` + `expense-categories.json` — dépenses réelles payées (loyer, salaires,
     matières, emballage, cacao, paies/achats usine, transport), filtrées du bruit.
   - `raw-materials.json` — matières premières (dernier inventaire OCR) → table `ingredients`
     existante (kind=raw), pas de nouvelle table.
   - `production.json` — production prête à l'expédition (paquets → unités) → `stock_movements`
     (entrées produits finis dans l'entrepôt usine).
   Relancer après toute correction : `python3 scripts/data/build-real-fixtures.py`
3. **`seed-real-data.ts`** → écrit dans la base (Neon).

## Exécution du seed (à faire UNE FOIS, après déploiement)

```bash
DATABASE_URL="postgres://…neon…" npm run seed:real
```

Le seed :
- **préserve** la structure (workspace, rôles, permissions, users staff existants) ;
- **upsert** les référentiels réels (stands, produits, commerciaux/ouvriers) et **désactive**
  les référentiels de démo non réels ;
- **remplace** les transactions fictives (purge ventes/sessions/primes/observations/stock +
  dépenses/demandes de démo du workspace) puis réinjecte l'historique réel ;
- **dépenses** : chaîne `expense_categories → expense_requests(approved) → expenses(paid)`,
  portées par un user encadrant (compta/admin/pca) ;
- **matières premières** : peuple la table `ingredients` (kind=raw) avec le dernier inventaire ;
- **production** : entrepôt usine + `stock_movements` (entrées produits finis) ;
- est **idempotent** (ré-exécutable sans doublon) et **réversible** (Neon : restaurer un point
  de restauration / branche avant exécution).

Validé en local contre une base éphémère : 797 ventes · 2 285 lignes · 617 primes ·
431 observations · CA 42,6 M F · intégrité référentielle OK · journal reconstruit correctement.

> ⚠️ Données réelles (noms de personnes, financier). Les médias bruts sont gitignorés ;
> seules les données structurées sont versionnées.
