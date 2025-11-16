# 📘 DOCUMENTATION SYSTÈME COMPLÈTE - DDM ERP

**Version**: 2.0.0
**Date**: 15 Novembre 2024
**Plateforme**: Next.js 14+ • TypeScript • Airtable
**Type**: ERP Mobile-First pour Distribution & Production

---

## 📑 TABLE DES MATIÈRES

1. [Vue d'Ensemble](#1-vue-densemble)
2. [Architecture Technique](#2-architecture-technique)
3. [Modules Fonctionnels](#3-modules-fonctionnels)
4. [Intégrations Automatiques](#4-intégrations-automatiques)
5. [Sécurité & Gouvernance](#5-sécurité--gouvernance)
6. [Guide d'Utilisation](#6-guide-dutilisation)
7. [API Reference](#7-api-reference)
8. [Déploiement & Maintenance](#8-déploiement--maintenance)

---

# 1. VUE D'ENSEMBLE

## 1.1 Présentation

DDM ERP est une **solution de gestion complète** conçue spécifiquement pour les entreprises de distribution et production au Sénégal. Le système couvre l'ensemble de la chaîne de valeur depuis l'approvisionnement jusqu'à la vente finale, en passant par la production, le stockage, et la distribution.

### Chiffres Clés

- **15 modules métier** complets
- **49+ services backend** (33,500 lignes de code)
- **100+ endpoints API** REST
- **74 pages** d'interface utilisateur
- **26 composants** réutilisables
- **10+ intégrations** automatiques entre modules

### Cas d'Usage Principaux

1. **Distribution Multi-Canal**
   - Vente directe (stands, magasins)
   - Vente consignation (partenaires)
   - Vente B2B (grossistes)

2. **Production & Transformation**
   - Gestion recettes (formules)
   - Ordres de production
   - Traçabilité lots

3. **Gestion Commerciale**
   - CRM clients avec fidélité 5 tiers
   - Ventes rapides mobile
   - Suivi performance commerciaux

4. **Gestion Financière**
   - Trésorerie multi-comptes
   - Comptabilité OHADA
   - Contrôle dépenses avec workflow

5. **Gestion RH**
   - Pointages GPS + Photo
   - Indemnités transport automatiques
   - Paie avec commissions

---

## 1.2 Philosophie de Conception

### Mobile-First

**Toutes les interfaces sont conçues prioritairement pour mobile** avec :
- Touch targets ≥ 44px (WCAG AAA)
- Workflows ultra-rapides (< 1 minute)
- Capture photo/GPS native
- Fonctionnement hors-ligne partiel

### Automatisation

**Maximum d'automatisations pour réduire erreurs et temps** :
- Points fidélité auto lors ventes
- Mouvements stock auto
- Indemnités transport auto
- Workflow validation auto par seuils
- Intégrations comptables auto

### Traçabilité

**Traçabilité complète de bout en bout** :
- GPS + timestamps + utilisateur sur tous mouvements
- Photos obligatoires (pointages, dépenses)
- Journal d'audit inaltérable
- Signatures digitales

---

## 1.3 Technologies

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Langage**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 3.4+
- **UI Components**: Radix UI + Headless UI
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod

### Backend
- **Runtime**: Node.js 18+
- **API**: Next.js API Routes (serverless)
- **Base de données**: Airtable (cloud)
- **Authentication**: NextAuth.js
- **Fichiers**: Upload local + Airtable Attachments

### DevOps
- **Versioning**: Git
- **CI/CD**: GitHub Actions (recommandé)
- **Hosting**: Vercel (recommandé)
- **Monitoring**: Vercel Analytics

---

# 2. ARCHITECTURE TECHNIQUE

## 2.1 Structure du Projet

```
DDM/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Layout dashboard protégé
│   ├── api/                     # API Routes (100+ endpoints)
│   ├── auth/                    # Authentification
│   ├── customers/               # Module Clients
│   ├── sales/                   # Module Ventes
│   ├── stock/                   # Module Stock
│   ├── production/              # Module Production
│   ├── consignation/            # Module Consignation
│   ├── expenses/                # Module Dépenses
│   ├── hr/                      # Module RH
│   ├── treasury/                # Module Trésorerie
│   ├── accounting/              # Module Comptabilité
│   ├── advances-debts/          # Module Avances/Dettes
│   ├── rules/                   # Module Règles
│   ├── reports/                 # Module Reporting
│   ├── ai/                      # Module IA
│   └── admin/                   # Module Administration
│
├── components/                   # Composants réutilisables
│   ├── customers/               # Composants clients
│   ├── consignation/            # Composants consignation
│   ├── stock/                   # Composants stock
│   ├── production/              # Composants production
│   ├── expenses/                # Composants dépenses
│   └── ui/                      # Composants UI génériques
│
├── lib/                         # Logique métier
│   ├── modules/                 # Services métier (49 services)
│   │   ├── customers/           # 7 services
│   │   ├── consignation/        # 5 services
│   │   ├── stock/               # 4 services
│   │   ├── production/          # 3 services
│   │   ├── expenses/            # 4 services
│   │   ├── sales/               # 4 services
│   │   ├── treasury/            # 2 services
│   │   ├── hr/                  # 8 services
│   │   ├── accounting/          # 3 services
│   │   ├── governance/          # 2 services
│   │   ├── rules/               # 1 service
│   │   ├── reports/             # 6 services
│   │   ├── ai/                  # 2 services
│   │   └── admin/               # 3 services
│   │
│   ├── airtable.ts              # Client Airtable
│   ├── auth.ts                  # Configuration auth
│   └── rbac/                    # RBAC (40+ permissions)
│
├── types/                       # Types TypeScript
│   ├── modules.ts               # Types métier
│   ├── api.ts                   # Types API
│   └── rbac.ts                  # Types permissions
│
├── middleware.ts                # Middleware Next.js
├── next.config.js               # Configuration Next.js
├── tailwind.config.ts           # Configuration Tailwind
└── tsconfig.json                # Configuration TypeScript
```

---

## 2.2 Architecture en Couches

### Couche 1 : Présentation (UI)
**Pages Next.js** (`app/*/page.tsx`)
- Rendu serveur (RSC)
- Interfaces mobile-first
- Gestion états locaux

### Couche 2 : API
**API Routes** (`app/api/*/route.ts`)
- Endpoints REST
- Validation Zod
- Authentification
- Permissions RBAC
- Gestion erreurs

### Couche 3 : Services Métier
**Services** (`lib/modules/*/`)
- Logique métier
- Validation données
- Calculs automatiques
- Intégrations

### Couche 4 : Data Access
**Airtable Client** (`lib/airtable.ts`)
- CRUD Airtable
- Gestion cache
- Gestion erreurs

---

## 2.3 Patterns Architecturaux

### Pattern Service

Chaque module a ses services isolés :

```typescript
// Exemple: customer-service.ts
export class CustomerService {
  // Singleton
  private static instance: CustomerService;

  // CRUD
  async list(workspaceId: string, filters?) { }
  async getById(id: string) { }
  async create(input: CreateCustomerInput) { }
  async update(id: string, updates) { }
  async delete(id: string) { }

  // Logique métier
  async calculateTier(customerId: string) { }
  async getTopCustomers(workspaceId: string) { }
}
```

### Pattern Repository

Accès données centralisé via Airtable :

```typescript
const airtable = getAirtableClient();
const records = await airtable
  .base(workspaceId)
  .table('Customer')
  .select({
    filterByFormula: `{Status} = 'active'`,
    sort: [{ field: 'CreatedAt', direction: 'desc' }]
  })
  .all();
```

### Pattern Hook

Hooks pour intégrations inter-modules :

```typescript
// sale-loyalty-hook.ts
export async function processSaleLoyalty(
  saleId: string,
  customerId: string,
  totalAmount: number
) {
  // Attribution points fidélité
  const points = calculatePoints(totalAmount, customerTier);
  await loyaltyService.addPoints(customerId, points);

  // Vérification montée tier
  await checkTierUpgrade(customerId);
}
```

---

## 2.4 Base de Données (Airtable)

### Tables Principales (60+ tables)

#### Gestion Commerciale
- `Customer` - Clients
- `LoyaltyTransaction` - Transactions points
- `LoyaltyReward` - Catalogue récompenses
- `Sale` - Ventes
- `SaleLine` - Lignes de vente
- `Product` - Produits

#### Distribution
- `Partner` - Partenaires consignation
- `Deposit` - Dépôts
- `DepositLine` - Lignes dépôt
- `SalesReport` - Rapports ventes partenaires
- `Settlement` - Règlements

#### Stock & Production
- `StockItem` - Articles stock
- `StockMovement` - Mouvements
- `Warehouse` - Entrepôts
- `Ingredient` - Matières premières
- `Recipe` - Recettes
- `ProductionOrder` - Ordres production
- `ProductionBatch` - Lots produits

#### Finance
- `Wallet` - Comptes/Portefeuilles
- `Transaction` - Transactions
- `ExpenseRequest` - Demandes dépenses
- `ExpenseProof` - Preuves dépenses
- `Account` - Plan comptable
- `JournalEntry` - Écritures comptables

#### RH
- `Employee` - Employés
- `Attendance` - Pointages
- `Payroll` - Paies
- `Commission` - Commissions
- `TransportAllowance` - Indemnités transport
- `Leave` - Congés

#### Gouvernance
- `ValidationRequest` - Demandes validation
- `ValidationThreshold` - Seuils validation
- `Rule` - Règles métier
- `Report` - Rapports

#### Admin
- `User` - Utilisateurs
- `Role` - Rôles
- `Workspace` - Espaces de travail
- `AuditLog` - Journal audit

### Relations Clés

```
Customer (1) ─────── (N) Sale
Customer (1) ─────── (N) LoyaltyTransaction
Sale (1) ─────────── (N) SaleLine
Product (1) ─────── (N) SaleLine
Product (1) ─────── (N) StockItem
Warehouse (1) ───── (N) StockItem
Employee (1) ────── (N) Attendance
Employee (1) ────── (N) TransportAllowance
Partner (1) ─────── (N) Deposit
Deposit (1) ─────── (N) DepositLine
Recipe (1) ──────── (N) ProductionOrder
ProductionOrder (1) ─ (N) ProductionBatch
```

---

# 3. MODULES FONCTIONNELS

## 3.1 Module Clients & Fidélité

### Fonctionnalités

#### Gestion Clients
- CRUD clients (particuliers, entreprises, revendeurs)
- Génération codes automatique (CUS-0001, CUS-0002...)
- Recherche multi-critères
- Segmentation automatique
- Historique complet

#### Programme Fidélité 5 Tiers

**Bronze** 🥉
- Seuil: 0 F
- Multiplicateur: x1
- Avantages: Programme de base

**Silver** 🥈
- Seuil: 500,000 F dépensés
- Multiplicateur: x1.2
- Avantages: +20% de points

**Gold** 🥇
- Seuil: 1,000,000 F dépensés
- Multiplicateur: x1.5
- Avantages: +50% de points

**Platinum** 💎
- Seuil: 2,000,000 F dépensés
- Multiplicateur: x2
- Avantages: Double points

**Diamond** 💠
- Seuil: 5,000,000 F dépensés
- Multiplicateur: x2.5
- Avantages: 2.5x points + privilèges VIP

#### Attribution Points

**Formule**: `Points = (Montant / 1000) × Multiplicateur Tier`

**Bonus automatiques**:
- 1ère commande: +100 points
- 10 commandes: +200 points
- 25 commandes: +500 points
- 50 commandes: +1,000 points
- 100 commandes: +2,000 points
- Montée tier: +500 points

**Exemple**:
- Achat 50,000 F en Bronze → 50 points
- Achat 50,000 F en Diamond → 125 points

#### Catalogue Récompenses
- Réductions (5%, 10%, 15%)
- Produits gratuits
- Services exclusifs
- Échange points contre F CFA

### API Endpoints

```
GET    /api/customers                           # Liste clients
POST   /api/customers                           # Créer client
GET    /api/customers/[id]                      # Détail client
PATCH  /api/customers/[id]                      # Modifier client
GET    /api/customers/statistics                # KPIs
GET    /api/customers/top                       # Top clients
GET    /api/customers/at-risk                   # Clients inactifs
GET    /api/customers/loyalty/transactions      # Historique points
GET    /api/customers/loyalty/rewards           # Catalogue
POST   /api/customers/loyalty/rewards/redeem    # Échanger récompense
POST   /api/customers/loyalty/process-sale      # Hook vente
GET    /api/customers/qr-register               # QR Code inscription
POST   /api/customers/quick                     # Création rapide
```

### UI Pages

- `/customers` - Liste avec filtres (statut, tier, ville)
- `/customers/[id]` - Détail (4 onglets: Infos, Fidélité, Historique, Interactions)
- `/customers/new` - Création complète
- `/customers/quick` - Création rapide (3 champs)
- `/customers/loyalty` - Dashboard fidélité
- `/customers/qr-register` - Inscription QR Code

### Composants

```typescript
<CustomerCard />           // Carte client avec tier
<CustomerQuickSearch />    // Recherche auto-complétion
<LoyaltyBadge />          // Badge tier animé
<CustomerFormMobile />    // Formulaire tactile
```

---

## 3.2 Module Consignation & Partenaires

### Fonctionnalités

#### Gestion Partenaires
- Types: Pharmacie, Point Relais, Grossiste, Détaillant, Kiosque
- Statuts: Actif, Inactif, Suspendu, En attente
- Commission configurable (défaut 15%)
- Termes paiement (7, 15, 30, 60 jours)
- Suivi soldes dus

#### Workflow Consignation

**1. DÉPÔT**
```
Commercial prépare dépôt:
- Sélectionne partenaire
- Ajoute produits + quantités + prix
- Valide → Génère DEP-202511-0001
→ Sortie stock automatique
→ Statut: Validé
```

**2. VENTE**
```
Partenaire vend aux clients finaux
→ Rapporte ventes régulièrement
```

**3. RAPPORT DE VENTES**
```
Partenaire ou commercial crée rapport:
- Produit A: 30 unités vendues
- Produit B: 10 unités vendues
- Total ventes: 95,000 F
- Commission 15%: 14,250 F
- Net à payer: 80,750 F
→ Génération ventes automatique
→ Mise à jour dépôt (statut: Partiel)
```

**4. RÈGLEMENT**
```
Comptable crée règlement:
- Montant: 80,750 F
- Mode: Mobile Money / Virement / Espèces
→ Transaction trésorerie automatique
→ Mise à jour solde partenaire: 0 F
→ Statut: Payé
```

**5. RETOUR (optionnel)**
```
Si invendus:
- Bon état → Réintégration stock
- Endommagé → Perte enregistrée
- Expiré → Démarque
```

#### Calculs Automatiques

**Commission**:
```typescript
TotalSales = Σ (QuantitySold × UnitPrice)
Commission = TotalSales × (Rate / 100)
NetAmount = TotalSales - Commission
```

**Solde Partenaire**:
```typescript
CurrentBalance = TotalSold - TotalPaid
```

**Statut Dépôt**:
```typescript
QuantityRemaining = Deposited - Sold - Returned

if (QuantityRemaining === 0) → 'completed'
else if (Sold > 0 || Returned > 0) → 'partial'
else → 'validated'
```

### API Endpoints

```
GET    /api/consignation/partners              # Liste partenaires
POST   /api/consignation/partners              # Créer partenaire
GET    /api/consignation/partners/[id]         # Détail partenaire
PATCH  /api/consignation/partners/[id]         # Modifier partenaire

GET    /api/consignation/deposits              # Liste dépôts
POST   /api/consignation/deposits              # Créer dépôt
GET    /api/consignation/deposits/[id]         # Détail dépôt
POST   /api/consignation/deposits/[id]/validate # Valider dépôt

GET    /api/consignation/sales-reports         # Liste rapports
POST   /api/consignation/sales-reports         # Créer rapport

GET    /api/consignation/settlements           # Liste règlements
POST   /api/consignation/settlements           # Créer règlement
```

### UI Pages

- `/consignation` - Dashboard (KPIs, top partenaires, alertes soldes)
- `/consignation/partners` - Liste partenaires avec filtres
- `/consignation/partners/[id]` - Détail (4 onglets: Infos, Dépôts, Rapports, Règlements)
- `/consignation/deposits` - Liste dépôts

### Composants

```typescript
<PartnerCard />          // Carte partenaire avec KPIs
<DepositCard />          // Carte dépôt avec barres progression
<SalesReportCard />      // Rapport ventes
<SettlementCard />       // Règlement financier
```

---

## 3.3 Module Stock & Mouvements

### Fonctionnalités

#### Gestion Multi-Entrepôts
- Types: Principal, Stand, Dépôt Partenaire, Usine, Autre
- Localisation GPS
- Responsable assigné
- Capacité tracking

#### Types de Mouvements

**Entrée** (entry)
- Achat fournisseur
- Production terminée
- Retour client
- Transfert reçu

**Sortie** (exit)
- Vente
- Consignation
- Production (consommation)
- Perte/Casse

**Transfert** (transfer)
- Inter-entrepôts
- Stand → Principal
- Principal → Stand

**Ajustement** (adjustment)
- Inventaire physique
- Correction erreur

#### Alertes Intelligentes

**Rupture de stock**:
```typescript
if (Quantity === 0) → Alerte CRITIQUE
```

**Stock faible**:
```typescript
if (Quantity ≤ MinimumStock && Quantity > 0) → Alerte WARNING
```

**Sur-stock** (optionnel):
```typescript
if (Quantity > MaximumStock) → Alerte INFO
```

#### Démarques

Types:
- Perte (vol, manquant)
- Casse (endommagé)
- Péremption (expiré)
- Autre

Action: Création mouvement "adjustment" négatif

### API Endpoints

```
GET    /api/stock/items                        # Items stock
POST   /api/stock/items                        # Créer item
GET    /api/stock/items/[id]                   # Détail item
PATCH  /api/stock/items/[id]                   # Modifier item

GET    /api/stock/movements                    # Mouvements
POST   /api/stock/movements                    # Créer mouvement
GET    /api/stock/movements/[id]               # Détail mouvement

GET    /api/stock/warehouses                   # Entrepôts
POST   /api/stock/warehouses                   # Créer entrepôt

GET    /api/stock/alerts                       # Alertes stock
GET    /api/stock/markdowns                    # Démarques
POST   /api/stock/markdowns                    # Créer démarque
GET    /api/stock/statistics                   # KPIs
```

### UI Pages

- `/stock` - Dashboard visuel (grille produits avec images)
- `/stock/inventory` - Inventaire mobile (comptage rapide)
- `/stock/movements/quick` - Mouvement rapide
- `/stock/markdowns/new` - Nouvelle démarque
- `/stock/warehouses` - Gestion entrepôts

### Composants

```typescript
<ProductVisualCard />    // Carte produit avec image + badge stock
```

---

## 3.4 Module Production & Usine

### Fonctionnalités

#### Gestion Ingrédients
- CRUD matières premières
- Stock ingrédients séparé
- Coûts unitaires
- Fournisseurs
- Alertes stock minimum

#### Recettes (BOM - Bill of Materials)
- Produit fini
- Quantité sortie par batch
- Liste ingrédients + quantités
- Instructions fabrication
- Durée estimée
- Rendement attendu (%)
- Versioning (v1, v2, v3...)

**Exemple Recette**:
```
Produit: Jus d'Orange 1L
Version: 2
Output: 100 bouteilles / batch

Ingrédients:
- Orange fraîche: 50 kg
- Sucre: 5 kg
- Eau: 30 L
- Conservateur: 0.5 kg

Durée: 120 minutes
Rendement: 95%
```

#### Machine à États Production

```mermaid
draft → planned → in_progress → completed
                              ↘ cancelled
```

**Workflow**:

1. **Draft** (Brouillon)
   - Création ordre
   - Sélection recette
   - Définition quantité

2. **Planned** (Planifié)
   - Dates définies
   - Ressources assignées
   - En attente démarrage

3. **In Progress** (En cours)
   - Consommation ingrédients (tracking)
   - Création lots produits finis
   - Suivi rendement temps réel

4. **Completed** (Terminé)
   - Production terminée
   - Lots créés
   - Rendement calculé

5. **Cancelled** (Annulé)
   - Raison enregistrée
   - Pas de mouvement stock

#### Traçabilité Complète

```
Ingrédient (Stock)
  ↓ consommé via
ProductionOrder
  ↓ produit
ProductionBatch (+ n° lot)
  ↓ entrée stock via
StockMovement
  ↓ crée
StockItem (Produit Fini)
  ↓ vendu via
Sale → Client final
```

### API Endpoints

```
# Ingrédients
GET    /api/production/ingredients             # Liste
POST   /api/production/ingredients             # Créer
GET    /api/production/ingredients/[id]        # Détail
PATCH  /api/production/ingredients/[id]        # Modifier
GET    /api/production/ingredients/statistics  # KPIs

# Recettes
GET    /api/production/recipes                 # Liste
POST   /api/production/recipes                 # Créer
GET    /api/production/recipes/[id]            # Détail
PATCH  /api/production/recipes/[id]            # Modifier
GET    /api/production/recipes/[id]/cost       # Calcul coût
POST   /api/production/recipes/[id]/duplicate  # Dupliquer

# Ordres Production
GET    /api/production/orders                  # Liste
POST   /api/production/orders                  # Créer
GET    /api/production/orders/[id]             # Détail
PATCH  /api/production/orders/[id]             # Modifier
POST   /api/production/orders/[id]/start       # Démarrer
POST   /api/production/orders/[id]/consume     # Consommer ingrédient
POST   /api/production/orders/[id]/batch       # Créer lot
POST   /api/production/orders/[id]/complete    # Terminer
POST   /api/production/orders/[id]/cancel      # Annuler
GET    /api/production/orders/statistics       # KPIs
```

### UI Pages

- `/production` - Dashboard (ordres en cours, recettes actives)
- `/production/recipes` - Liste recettes avec filtres
- `/production/orders` - Liste ordres avec filtres
- `/production/orders/new` - **Wizard création 4 étapes** (< 2 min)

**Wizard Création**:
1. Sélection recette (grille visuelle)
2. Quantité + Dates (quick count + pickers)
3. Configuration (entrepôts + priorité)
4. Confirmation (résumé)

### Composants

```typescript
<RecipeCard />              // Carte recette avec image produit
<ProductionOrderCard />     // Carte ordre avec progression
```

---

## 3.5 Module Dépenses & Sollicitations

### Fonctionnalités

#### Sollicitation Ultra-Rapide (< 1 minute)

**Workflow mobile**:
```
1. Montant (boutons rapides: 1K, 2.5K, 5K, 10K, 25K, 50K)
2. Catégorie (6 boutons visuels avec icônes)
3. Photo preuve (caméra native)
4. Urgence (4 niveaux)
5. Soumettre
→ Demande créée + Photo uploadée + Soumise automatiquement
```

**Temps total**: 30-60 secondes depuis terrain

#### Workflow Approbation

**7 Statuts**:
1. **Draft**: Brouillon non soumis
2. **Submitted**: Soumise, en attente
3. **Pending Approval**: En cours validation
4. **Approved**: Approuvée, en attente paiement
5. **Rejected**: Rejetée (raison obligatoire)
6. **Paid**: Payée et clôturée
7. **Cancelled**: Annulée

**4 Niveaux Urgence**:
- **Basse**: Pas urgent
- **Normale**: Standard
- **Haute**: Important (badge orange)
- **URGENTE**: Critique (badge rouge + alerte)

**Catégories**:

*Fonctionnelles* (opérationnelles):
- Salaire
- Transport
- Communication
- Fourniture
- Maintenance

*Structurelles* (investissement):
- Loyer
- Électricité / Eau
- Équipement
- Véhicule
- Immobilier
- Infrastructure
- Logiciel
- Formation

#### Workflow Hiérarchique Multi-Niveaux

```typescript
RequiredApprovalLevels: 2    // Nécessite 2 niveaux

CurrentApprovalLevel: 0      // Initial
  ↓ Manager terrain approuve
CurrentApprovalLevel: 1
  ↓ Manager général approuve
CurrentApprovalLevel: 2 (= RequiredApprovalLevels)
→ Status: approved
```

**Chaque approbation enregistre**:
- Niveau hiérarchique
- Décision (approved/rejected)
- Commentaires
- Timestamp
- Approbateur

#### Preuves Jointes

Types supportés:
- Photo (obligatoire pour sollicitation rapide)
- Reçu
- Facture
- Contrat
- Autre

Format: Images (JPG, PNG) + PDF

### API Endpoints

```
GET    /api/expenses/requests                  # Liste demandes
POST   /api/expenses/requests                  # Créer demande
GET    /api/expenses/requests/[id]             # Détail demande
PATCH  /api/expenses/requests/[id]             # Modifier demande
POST   /api/expenses/requests/[id]/submit      # Soumettre
POST   /api/expenses/requests/[id]/approve     # Approuver/Rejeter
POST   /api/expenses/requests/[id]/pay         # Marquer payée
DELETE /api/expenses/requests/[id]             # Supprimer/Annuler
POST   /api/expenses/requests/[id]/attachments # Joindre preuve
GET    /api/expenses/statistics                # KPIs
```

### UI Pages

- `/expenses` - Dashboard (KPIs, à valider, mes demandes)
- `/expenses/requests/quick` - **Sollicitation rapide < 1 min**
- `/expenses/requests` - Liste complète avec filtres avancés
- `/expenses/requests/[id]` - Détail + modal approbation/rejet

**Filtres Avancés**:
- Recherche textuelle (n°, titre, demandeur)
- 7 statuts (multi-sélection)
- 4 urgences (multi-sélection)
- 2 catégories (fonctionnelle/structurelle)
- Plage dates

### Composants

```typescript
<ExpenseRequestCard />   // Carte avec workflow visuel (400 lignes)
```

---

## 3.6 Module Ventes

### Fonctionnalités

#### Vente Rapide Mobile
- Sélection client (recherche rapide)
- Ajout produits visuels
- Calcul auto total
- Multi-paiements
- Génération reçu/facture

#### Types Ventes
- Vente directe (cash)
- Vente crédit (échéance)
- Vente consignation (via partenaire)

#### Intégrations Automatiques

**Lors confirmation vente**:
1. **Fidélité**: Attribution points automatique
2. **Stock**: Sortie automatique produits
3. **Trésorerie**: Enregistrement recette
4. **Comptabilité**: Écriture automatique

### API Endpoints

```
GET    /api/sales                              # Liste ventes
POST   /api/sales                              # Créer vente
GET    /api/sales/[id]                         # Détail vente
PATCH  /api/sales/[id]                         # Modifier vente
POST   /api/sales/quick                        # Vente rapide
GET    /api/sales/statistics                   # KPIs

GET    /api/products                           # Produits
GET    /api/products/[id]                      # Détail produit
```

### UI Pages

- `/sales` - Liste ventes avec filtres
- `/sales/new` - Nouvelle vente complète
- `/sales/quick` - Vente rapide mobile
- `/sales/[id]` - Détail vente

---

## 3.7 Module Trésorerie

### Fonctionnalités

#### Multi-Comptes
- Caisse (espèces)
- Banque (virements)
- Mobile Money (Wave, Orange Money, etc.)
- Coffre (réserve)

#### Types Transactions
- **Recette** (income): Ventes, encaissements
- **Dépense** (expense): Achats, paiements
- **Transfert** (transfer): Inter-comptes

#### Dashboard Temps Réel
- Soldes par compte
- Flux jour/semaine/mois
- Recettes vs Dépenses
- Alertes découvert

### API Endpoints

```
GET    /api/treasury/wallets                   # Liste comptes
POST   /api/treasury/wallets                   # Créer compte
GET    /api/treasury/wallets/[id]              # Détail compte
PATCH  /api/treasury/wallets/[id]              # Modifier compte

GET    /api/treasury/transactions              # Transactions
POST   /api/treasury/transactions              # Créer transaction
GET    /api/treasury/transactions/[id]         # Détail transaction

GET    /api/treasury/statistics                # KPIs
```

### UI Pages

- `/treasury` - Dashboard multi-comptes
- `/treasury/wallets` - Liste comptes
- `/treasury/wallets/[id]` - Détail compte
- `/treasury/transactions` - Liste transactions
- `/treasury/transactions/new` - Nouvelle transaction

---

## 3.8 Module Ressources Humaines

### Fonctionnalités

#### Pointage GPS + Photo

**Check-In (Arrivée)**:
```
1. GPS activé automatiquement
2. Photo obligatoire (caméra)
3. Sélection lieu (Stand, Entrepôt, Usine, Autre)
4. Demande indemnité transport (optionnel)
5. Type déplacement (Stand, Client, Livraison, Réunion)
6. Notes (optionnel)
→ Attendance créé
→ TransportAllowance créé si demandé
```

**Check-Out (Sortie)**:
```
1. Photo sortie
2. Notes (optionnel)
→ Attendance mis à jour (CheckOut, TotalHours)
```

**Traçabilité**:
- Latitude/Longitude
- Précision GPS
- Adresse (reverse geocoding)
- Photos (arrivée + sortie)
- Timestamps précis

#### Indemnités Transport Automatiques

**Système innovant configurable**:

**Règles Flexibles**:
```typescript
TransportAllowanceRule {
  name: "Transport Standard"
  defaultAmount: 2000         // 2000 F CFA actuellement
  employeeRoles: ['sales_agent', 'delivery']
  transportTypes: ['stand_visit', 'client_visit']
  requiresApproval: false     // Auto-validé
}
```

**Calcul Auto**:
```typescript
// Lors pointage avec transport = true
1. Récupérer règle applicable
2. Montant = defaultAmount (2000 F)
3. Si distance fournie ET ratePerKm défini:
   → Montant = distance × ratePerKm
4. Si montant > maxAmountPerDay:
   → Montant = maxAmountPerDay
5. Créer TransportAllowance
   → Status: validated (si pas requiresApproval)
   → Status: pending (si requiresApproval)
```

**Workflow Mensuel**:
```
Fin du mois:
1. Manager valide transports pending
2. Comptable lance calcul paie
3. Système totalise transports validés
4. Ajout au salaire:
   BaseSalary + Commissions + Transports - Avances
5. Transports passent status: paid
```

**Évolutivité**:
- Augmenter tarif: Modifier règle (2000 → 2500)
- Tarif par type: Créer règle spécifique (Livraison = 3000)
- Calcul au km: Ajouter ratePerKm (100 F/km)
- Validation: Activer requiresApproval pour montants élevés

#### Autres Fonctionnalités RH

- Gestion employés (CRUD, contrats, statuts)
- Calcul paie automatique
- Commissions ventes
- Avances/Prêts avec remboursement
- Congés/Absences
- Objectifs et KPIs

### API Endpoints

```
GET    /api/hr/employees                       # Employés
POST   /api/hr/employees                       # Créer employé
GET    /api/hr/employees/[id]                  # Détail employé

GET    /api/hr/attendance                      # Pointages
POST   /api/hr/attendance/check-in             # Pointer arrivée
POST   /api/hr/attendance/check-out            # Pointer sortie
POST   /api/hr/attendance/[id]/photo/checkin   # Photo arrivée

GET    /api/hr/payroll                         # Paies
POST   /api/hr/payroll                         # Créer paie

GET    /api/hr/leaves                          # Congés
POST   /api/hr/leaves                          # Demande congé
```

### UI Pages

- `/hr` - Dashboard (horloge temps réel, pointage rapide, KPIs)
- `/hr/attendance/check-in` - **Pointage arrivée GPS + Photo + Transport**
- `/hr/attendance/check-out` - Pointage sortie
- `/hr/employees` - Liste employés

---

## 3.9 Module Comptabilité

### Fonctionnalités

#### Plan Comptable OHADA/SYSCOHADA
- Classes 1-8
- Comptes à 6-8 chiffres
- Comptes de bilan / gestion

#### Écritures Automatiques

**Exemple vente**:
```
Débit  411.Clients           100,000
  Crédit  707.Ventes                   100,000
```

**Exemple achat**:
```
Débit  601.Achats            50,000
  Crédit  401.Fournisseurs             50,000
```

#### Journaux
- Journal ventes
- Journal achats
- Journal banque
- Journal caisse
- Journal OD (opérations diverses)

#### Rapports
- Balance générale
- Grand livre
- Compte de résultat
- Bilan

### API Endpoints

```
GET    /api/accounting/accounts                # Plan comptable
POST   /api/accounting/accounts                # Créer compte

GET    /api/accounting/journals                # Journaux
POST   /api/accounting/journals                # Créer journal

GET    /api/accounting/entries                 # Écritures
POST   /api/accounting/entries                 # Créer écriture

GET    /api/accounting/reports/balance         # Balance
GET    /api/accounting/reports/trial-balance   # Balance générale
```

### UI Pages

- `/accounting` - Dashboard comptable

---

## 3.10 Module Avances & Dettes

### Fonctionnalités

#### Avances
- Avances employés (sur salaire)
- Avances partenaires
- Avances clients (crédit)

#### Dettes
- Dettes fournisseurs
- Dettes clients (clients nous doivent)
- Autres créances

#### Gestion
- Échéancier remboursement
- Calcul intérêts (optionnel)
- Suivi paiements
- Alertes échéances

### API Endpoints

```
GET    /api/advances-debts                     # Liste
POST   /api/advances-debts                     # Créer
GET    /api/advances-debts/[id]                # Détail
PATCH  /api/advances-debts/[id]                # Modifier
GET    /api/advances-debts/statistics          # KPIs
```

### UI Pages

- `/advances-debts` - Dashboard
- `/advances-debts/new` - Nouvelle avance/dette
- `/advances-debts/advances` - Liste avances
- `/advances-debts/debts` - Liste dettes
- `/advances-debts/accounts` - Comptes tiers
- `/advances-debts/[id]` - Détail

---

## 3.11 Module Moteur de Règles

### Fonctionnalités

#### Règles Métier Automatisées

**6 Types de Décisions**:
1. Dépenses (approuver/rejeter selon montant/catégorie)
2. Achats (validation fournisseur/montant)
3. Production (lancer ordre si stock faible)
4. Stock (réappro automatique)
5. Prix (ajustement dynamique)
6. Crédit client (accorder/refuser)

#### Structure Règle

```typescript
Rule {
  name: "Approuver dépenses < 10K"
  decisionType: "expense_approval"
  isActive: true

  // Conditions (ET/OU)
  conditions: [
    { field: "amount", operator: "less_than", value: 10000 },
    { field: "category", operator: "equals", value: "transport" }
  ]
  conditionLogic: "AND"

  // Actions
  actions: [
    {
      type: "approve_expense",
      autoExecute: true
    },
    {
      type: "notify_user",
      userId: "manager_id",
      message: "Dépense auto-approuvée"
    }
  ]
}
```

#### 15+ Templates Prêts

**Dépenses**:
- Auto-approuver dépenses < 10,000 F
- Rejeter dépenses > 100,000 F sans preuve
- Approuver transport commerciaux

**Stock**:
- Alerte si stock < minimum
- Réappro auto si rupture
- Transfert inter-entrepôts si déséquilibre

**Production**:
- Lancer production si stock produit < seuil
- Stop production si stock ingrédients insuffisant

**Prix**:
- Réduire prix si stock > maximum (écoulement)
- Augmenter prix si forte demande

**Crédit**:
- Accorder crédit si client tier ≥ Gold
- Refuser crédit si impayés > 3

#### Wizard Création 4 Étapes

1. **Type & Nom**
   - Sélection type décision
   - Nom descriptif

2. **Conditions**
   - Ajout conditions multiples
   - Choix logique (ET/OU)
   - Opérateurs variés

3. **Actions**
   - Sélection actions multiples
   - Paramètres actions
   - Auto-exécution

4. **Confirmation**
   - Résumé règle
   - Activation immédiate

### API Endpoints

```
GET    /api/rules                              # Liste règles
POST   /api/rules                              # Créer règle
GET    /api/rules/[id]                         # Détail règle
PATCH  /api/rules/[id]                         # Modifier règle
DELETE /api/rules/[id]                         # Supprimer règle

GET    /api/rules/templates                    # Templates
POST   /api/rules/execute                      # Exécuter règle
GET    /api/rules/dashboard                    # KPIs
```

### UI Pages

- `/rules` - Dashboard règles + statistiques
- Wizard création 4 étapes
- `/rules/templates` - Catalogue templates

---

## 3.12 Module Reporting & Point Flash

### Fonctionnalités

#### Point Flash Automatique

**Configuration**:
- Fréquence: Hebdomadaire (dimanche 19h)
- Destinataires: Direction Générale + Managers
- Canaux: WhatsApp + Email

**Contenu**:
```
📊 POINT FLASH HEBDOMADAIRE
Semaine du 13-19 Nov 2024

💰 VENTES
- Total: 2,450,000 F (+15% vs sem. précédente)
- Objectif: 2,000,000 F (✅ 122%)
- Meilleur vendeur: Jean Dupont (450K)

📦 STOCK
- Valeur totale: 5,200,000 F
- Alertes: 3 ruptures, 5 stocks faibles
- Mouvements: 145 entrées, 230 sorties

👥 RH
- Présents: 12/15 (80%)
- Absences: 2 congés, 1 maladie
- Transports: 85,000 F (42 jours-terrain)

💸 TRÉSORERIE
- Solde total: 1,850,000 F
- Recettes: 2,600,000 F
- Dépenses: 1,420,000 F

⚠️ ALERTES
- 2 dépenses > 50K en attente validation
- 3 clients inactifs > 90 jours
- Stock Produit A en rupture
```

#### PDF Professionnel avec Signatures

**Fiches de Décaissement**:
```
┌─────────────────────────────────────┐
│ FICHE DE DÉCAISSEMENT               │
│ N° FD-202411-0012                   │
├─────────────────────────────────────┤
│ Bénéficiaire: Jean Dupont           │
│ Montant: 25,000 F CFA               │
│ Motif: Transport Stand Marché       │
│ Date: 15 Nov 2024                   │
├─────────────────────────────────────┤
│ WORKFLOW SIGNATURES                  │
│                                      │
│ Demandeur: ___________  14/11 10:30 │
│   Jean Dupont                        │
│                                      │
│ Manager: ___________    14/11 15:20 │
│   Marie Martin                       │
│                                      │
│ DG: ___________         15/11 09:00 │
│   Paul Sow                           │
│                                      │
│ Comptable: ___________  15/11 11:30 │
│   Fatou Diop                         │
└─────────────────────────────────────┘
```

#### WhatsApp Multi-Groupes

**Configuration groupes**:
- Groupe Direction
- Groupe Managers
- Groupe Commercial
- Groupe Production

**Types messages**:
- Point Flash (texte + PDF)
- Alertes urgentes
- Rapports quotidiens
- Confirmations importantes

#### Dashboard DG Temps Réel

**KPIs**:
- Ventes jour/semaine/mois
- Trésorerie (soldes comptes)
- Stock (valeur + alertes)
- RH (présences + performances)
- Objectifs vs Réalisé

**Graphiques**:
- Évolution ventes
- Répartition par produit
- Performance commerciaux
- Flux trésorerie

### API Endpoints

```
GET    /api/reports                            # Liste rapports
GET    /api/reports/[id]                       # Détail rapport
POST   /api/reports/point-flash                # Déclencher Point Flash
GET    /api/reports/config                     # Configuration
POST   /api/reports/export                     # Export PDF

GET    /api/dashboard/dg                       # Dashboard DG
```

### UI Pages

- `/reports` - Liste rapports
- `/reports/config` - Configuration automatisations
- `/dashboard/dg` - **Dashboard DG temps réel mobile**

---

## 3.13 Module Gouvernance & Validation

### Fonctionnalités

#### Workflow Validation 4 Niveaux

**Niveaux Hiérarchiques**:
1. **Niveau 1**: Responsable direct / Chef équipe
2. **Niveau 2**: Manager / Chef département
3. **Niveau 3**: Directeur / DG
4. **Niveau 4**: Conseil administration (exceptionnel)

#### Routage Automatique par Seuils

**Configuration Seuils**:
```typescript
ValidationThreshold {
  entityType: "expense"
  category: "transport"

  // Seuils montants
  level1Max: 10000      // < 10K → Niveau 1 suffit
  level2Max: 50000      // < 50K → Niveau 2 requis
  level3Max: 200000     // < 200K → Niveau 3 requis
  level4Required: true  // > 200K → Niveau 4 requis
}
```

**Routage Auto**:
```typescript
// Dépense 8,000 F
→ RequiredApprovalLevels: 1

// Dépense 35,000 F
→ RequiredApprovalLevels: 2

// Dépense 150,000 F
→ RequiredApprovalLevels: 3

// Dépense 500,000 F
→ RequiredApprovalLevels: 4
```

#### 9 Types Entités Validables

1. **Dépenses** (ExpenseRequest)
2. **Achats** (PurchaseOrder)
3. **Production** (ProductionOrder)
4. **Ventes** (Sale - si montant élevé)
5. **Transferts Stock** (StockMovement)
6. **Règlements** (Settlement)
7. **Avances** (Advance)
8. **Congés** (Leave)
9. **Autre** (Custom)

#### Traçabilité Complète

**Chaque validation enregistre**:
- Géolocalisation (GPS)
- Adresse IP
- User-Agent (appareil)
- Timestamp précis
- Signature digitale
- Commentaires
- Pièces jointes

**Audit Trail**:
```typescript
ValidationRequest {
  requestId: "VAL-202411-0123"
  entityType: "expense"
  entityId: "EXP-202411-0045"

  // Workflow
  currentLevel: 2
  requiredLevels: 3
  status: "pending"

  // Traçabilité
  approvals: [
    {
      level: 1,
      decision: "approved",
      approverId: "user_123",
      approverName: "Jean Dupont",
      comments: "OK pour transport",
      timestamp: "2024-11-14T10:30:00Z",
      ipAddress: "192.168.1.45",
      gpsLocation: { lat: 14.7167, lng: -17.4677 },
      deviceInfo: "iPhone 14, iOS 17"
    },
    {
      level: 2,
      decision: "approved",
      approverId: "user_456",
      approverName: "Marie Martin",
      comments: "Approuvé",
      timestamp: "2024-11-14T15:20:00Z",
      ipAddress: "192.168.1.23",
      gpsLocation: { lat: 14.7200, lng: -17.4650 },
      deviceInfo: "Samsung S23, Android 14"
    }
  ]
}
```

#### Interface Mobile Validation

**File À Valider** (`/validations`):
- Liste demandes nécessitant mon approbation
- Filtres: Type, Urgence, Montant
- Actions rapides: Approuver/Rejeter
- Preview détails sans quitter liste

**Modal Validation**:
- Affichage complet demande
- Commentaire (obligatoire si rejet)
- Confirmation GPS/IP auto
- Validation 1 tap

### API Endpoints

```
GET    /api/validations/pending                # À valider
POST   /api/validations/request                # Demander validation
POST   /api/validations/[id]/approve           # Approuver
POST   /api/validations/[id]/reject            # Rejeter
GET    /api/validations/history                # Historique
GET    /api/validations/stats                  # Statistiques

GET    /api/validations/thresholds             # Seuils
POST   /api/validations/thresholds             # Config seuils
```

### UI Pages

- `/validations` - File À valider
- `/validations/history` - Historique complet
- `/settings/validation-thresholds` - Configuration seuils

---

## 3.14 Module Intelligence Artificielle

### Fonctionnalités

#### Aide à la Décision Contextuelle

**Contextes supportés**:
- Approuver/Rejeter dépense
- Accorder crédit client
- Lancer production
- Ajuster prix produit
- Recruter employé
- Investir équipement

**Exemple**:
```
Contexte: Approuver dépense 45,000 F de Jean Dupont
          pour maintenance véhicule

Analyse IA:
✅ Recommandation: APPROUVER

Raisons:
1. Montant cohérent avec tarif marché (40-50K)
2. Jean Dupont: fiable, 0 anomalie sur 50 dépenses
3. Véhicule: 35,000 km, maintenance due
4. Budget maintenance: 65% utilisé (OK)
5. Pas de dépense similaire récente

Risques:
⚠️ Fournisseur non habituel (à vérifier)

Score confiance: 87%
```

#### Prédictions Avancées

**Ventes**:
- Prévisions semaine/mois suivant
- Tendances par produit
- Saisonnalité
- Impact promotions

**Stock**:
- Risque rupture (7/14/30 jours)
- Risque sur-stock
- Stock optimal recommandé
- Timing réappro

**Clients**:
- Risque churn (perte client)
- Lifetime Value (LTV)
- Propension achat produit X
- Segmentation prédictive

**Trésorerie**:
- Prévision flux 30 jours
- Risque découvert
- Opportunités placement
- Besoins financement

**RH**:
- Risque turnover employé
- Performance prévisionnelle
- Besoins recrutement
- Optimisation planning

**Production**:
- Besoins production semaine
- Efficacité lignes
- Prévision défauts
- Optimisation recettes

#### Détection Anomalies

**Détections**:
- Dépense inhabituelle (montant/fréquence)
- Vente suspecte (remise excessive)
- Stock anormal (écart inventaire)
- Présence anormale (horaires, localisation)
- Transaction frauduleuse

**Alertes Proactives**:
- Notification temps réel
- Scoring risque
- Actions recommandées
- Escalade automatique

#### Insights Proactifs

**Types insights**:
- "Produit X se vend 3x mieux le lundi"
- "Client Y n'a pas acheté depuis 45j (habituellement 30j)"
- "Stock Produit Z sera en rupture dans 5 jours"
- "Commercial A performe -20% vs moyenne"
- "Dépenses transport ont augmenté de 35% ce mois"

### API Endpoints

```
POST   /api/ai/decision/recommend              # Aide décision
POST   /api/ai/predict/sales                   # Prédictions ventes
POST   /api/ai/predict/stock                   # Prédictions stock
POST   /api/ai/predict/churn                   # Risque churn
POST   /api/ai/detect/anomalies                # Détection anomalies
GET    /api/ai/insights                        # Insights proactifs
GET    /api/ai/dashboard                       # Dashboard IA
```

### UI Pages

- `/ai/dashboard` - Dashboard IA avec prédictions & insights

---

## 3.15 Module Administration

### Fonctionnalités

#### RBAC (Role-Based Access Control)

**40+ Permissions**:

*Clients*:
- `CUSTOMER_VIEW`
- `CUSTOMER_CREATE`
- `CUSTOMER_EDIT`
- `CUSTOMER_DELETE`
- `LOYALTY_VIEW`
- `LOYALTY_MANAGE`

*Ventes*:
- `SALE_VIEW`
- `SALE_CREATE`
- `SALE_EDIT`
- `SALE_DELETE`

*Stock*:
- `STOCK_VIEW`
- `STOCK_MOVEMENT_CREATE`
- `STOCK_ADJUSTMENT`

*Production*:
- `PRODUCTION_VIEW`
- `PRODUCTION_ORDER_CREATE`
- `PRODUCTION_ORDER_MANAGE`

*Dépenses*:
- `EXPENSE_VIEW`
- `EXPENSE_CREATE`
- `EXPENSE_APPROVE_L1`
- `EXPENSE_APPROVE_L2`
- `EXPENSE_APPROVE_L3`

*RH*:
- `HR_VIEW`
- `HR_EMPLOYEE_MANAGE`
- `HR_PAYROLL_VIEW`
- `HR_PAYROLL_MANAGE`

*Trésorerie*:
- `TREASURY_VIEW`
- `TREASURY_TRANSACTION_CREATE`
- `TREASURY_WALLET_MANAGE`

*Comptabilité*:
- `ACCOUNTING_VIEW`
- `ACCOUNTING_ENTRY_CREATE`
- `ACCOUNTING_ENTRY_VALIDATE`

*Admin*:
- `ADMIN_USER_MANAGE`
- `ADMIN_ROLE_MANAGE`
- `ADMIN_SETTINGS_MANAGE`

**Rôles Prédéfinis**:

```typescript
// Super Admin (toutes permissions)
SuperAdmin: all_permissions

// Admin (gestion complète sauf super admin)
Admin: [
  CUSTOMER_*, SALE_*, STOCK_*, PRODUCTION_*,
  EXPENSE_*, HR_*, TREASURY_*, ACCOUNTING_*,
  ADMIN_USER_MANAGE, ADMIN_ROLE_MANAGE
]

// Manager (gestion opérationnelle)
Manager: [
  CUSTOMER_VIEW, CUSTOMER_CREATE, CUSTOMER_EDIT,
  SALE_*, STOCK_*, PRODUCTION_VIEW,
  EXPENSE_VIEW, EXPENSE_CREATE, EXPENSE_APPROVE_L1,
  HR_VIEW, TREASURY_VIEW
]

// Comptable (finance)
Accountant: [
  EXPENSE_VIEW, EXPENSE_APPROVE_L3,
  TREASURY_*, ACCOUNTING_*,
  CUSTOMER_VIEW, SALE_VIEW, STOCK_VIEW
]

// Commercial (vente + clients)
SalesAgent: [
  CUSTOMER_VIEW, CUSTOMER_CREATE, CUSTOMER_EDIT,
  SALE_VIEW, SALE_CREATE,
  STOCK_VIEW, EXPENSE_VIEW, EXPENSE_CREATE,
  HR_VIEW (own data only)
]

// Utilisateur (lecture seule)
User: [
  CUSTOMER_VIEW, SALE_VIEW, STOCK_VIEW,
  HR_VIEW (own data only)
]
```

#### Multi-Tenant (Workspaces)

**Isolation complète**:
- Chaque workspace = entreprise indépendante
- Données complètement séparées
- Configuration propre
- Utilisateurs dédiés

**Fonctionnalités**:
- Création workspace
- Gestion membres
- Paramètres workspace
- Branding (logo, couleurs)

#### Audit Logs

**Traçabilité actions**:
```typescript
AuditLog {
  logId: "LOG-202411-12345"
  workspaceId: "ws_xxx"
  userId: "user_123"
  userName: "Jean Dupont"

  action: "UPDATE"
  entityType: "Customer"
  entityId: "CUS-0045"

  changes: {
    before: { Status: "active" },
    after: { Status: "inactive" }
  }

  ipAddress: "192.168.1.45"
  userAgent: "iPhone 14, iOS 17"
  gpsLocation: { lat: 14.7167, lng: -17.4677 }

  timestamp: "2024-11-14T10:30:00Z"
}
```

### API Endpoints

```
# Utilisateurs
GET    /api/admin/users                        # Liste
POST   /api/admin/users                        # Créer
GET    /api/admin/users/[id]                   # Détail
PATCH  /api/admin/users/[id]                   # Modifier
DELETE /api/admin/users/[id]                   # Supprimer

# Rôles
GET    /api/admin/roles                        # Liste
POST   /api/admin/roles                        # Créer
GET    /api/admin/roles/[id]                   # Détail
PATCH  /api/admin/roles/[id]                   # Modifier

# Workspaces
GET    /api/admin/workspaces                   # Liste
POST   /api/admin/workspaces                   # Créer
GET    /api/admin/workspaces/[id]              # Détail

# Settings
GET    /api/admin/settings                     # Paramètres
PATCH  /api/admin/settings                     # Modifier

# RBAC
GET    /api/rbac/permissions                   # Liste permissions
```

### UI Pages

- `/admin` - Dashboard admin
- `/admin/users` - Gestion utilisateurs
- `/admin/users/new` - Nouvel utilisateur
- `/admin/roles` - Gestion rôles
- `/admin/settings` - Paramètres système

---

# 4. INTÉGRATIONS AUTOMATIQUES

## 4.1 Ventes ↔ Fidélité

**Déclencheur**: Confirmation vente

**Processus**:
```typescript
1. Vente confirmée (status: completed)
2. Hook processSaleLoyalty() appelé
3. Calcul points selon tier client:
   Points = (TotalAmount / 1000) × MultiplierTier
4. Vérification bonus (1ère commande, paliers)
5. Attribution points via LoyaltyService
6. Mise à jour statistiques client
7. Vérification seuils tier
8. Montée tier automatique si seuils atteints
9. Bonus tier (+500 points)
10. Notification client (optionnel)
```

**Code**:
```typescript
// Dans sale-loyalty-hook.ts
export async function processSaleLoyalty(
  saleId: string,
  customerId: string,
  totalAmount: number
) {
  const customer = await customerService.getById(customerId);
  const tier = await tierService.getCurrentTier(customerId);

  // Calcul points
  const basePoints = totalAmount / 1000;
  const points = basePoints * tier.multiplier;

  // Bonus si 1ère commande
  const isFirstSale = customer.TotalOrders === 0;
  const bonusPoints = isFirstSale ? 100 : 0;

  // Attribution
  await loyaltyService.addPoints(
    customerId,
    points + bonusPoints,
    `Achat ${saleId}`
  );

  // Check tier upgrade
  const newTier = await checkTierUpgrade(customerId);
  if (newTier) {
    await loyaltyService.addPoints(customerId, 500, 'Montée tier');
  }
}
```

---

## 4.2 Consignation ↔ Stock

**Déclencheur**: Validation dépôt

**Processus**:
```typescript
1. Dépôt validé (POST /api/consignation/deposits/[id]/validate)
2. Pour chaque ligne dépôt:
   - Créer StockMovement (type: exit)
   - Quantité: QuantityDeposited
   - Entrepôt source: DepositWarehouseId
   - Référence: DepositNumber
   - Raison: "Dépôt consignation"
3. Mise à jour StockItems (déduction quantités)
4. Dépôt status: validated
```

**Code**:
```typescript
// Dans deposit-service.ts
async validate(depositId: string) {
  const deposit = await this.getById(depositId);

  for (const line of deposit.Lines) {
    // Sortie stock
    await stockMovementService.create({
      type: 'exit',
      productId: line.ProductId,
      quantity: line.QuantityDeposited,
      warehouseId: deposit.WarehouseId,
      reason: `Dépôt consignation ${deposit.DepositNumber}`,
      reference: deposit.DepositNumber,
    });
  }

  deposit.Status = 'validated';
  await this.update(depositId, deposit);
}
```

---

## 4.3 Consignation ↔ Ventes

**Déclencheur**: Validation rapport ventes partenaire

**Processus**:
```typescript
1. Rapport ventes validé
2. Pour chaque ligne rapport:
   - Créer Sale avec:
     - CustomerId: PartnerId
     - ProductId, Quantity, UnitPrice
     - PaymentMethod: 'consignation'
     - Reference: ReportNumber
3. Enregistrer SaleIds générés
4. Lier au rapport
5. Mise à jour dépôt (quantités vendues)
```

---

## 4.4 Consignation ↔ Trésorerie

**Déclencheur**: Règlement partenaire payé

**Processus**:
```typescript
1. Règlement créé et payé
2. Créer Transaction:
   - Type: expense
   - Amount: AmountPaid
   - WalletId: SelectedWallet
   - Description: "Règlement ${SettlementNumber} - ${PartnerName}"
   - Reference: SettlementNumber
3. Mise à jour solde partenaire (-AmountPaid)
```

---

## 4.5 Production ↔ Stock

**Déclencheur 1**: Consommation ingrédient

**Processus**:
```typescript
1. POST /api/production/orders/[id]/consume
2. Créer IngredientConsumption
3. Déduire stock ingrédient (-ActualQuantity)
4. Calculer variance (actual vs planned)
5. Alerte si variance > 10%
```

**Déclencheur 2**: Création lot produit fini

**Processus**:
```typescript
1. POST /api/production/orders/[id]/batch
2. Créer ProductionBatch
3. Créer StockMovement (type: entry):
   - ProductId: Order.ProductId
   - Quantity: QuantityGood (seulement bons)
   - WarehouseId: Order.DestinationWarehouseId
   - Reference: Order.OrderNumber
4. Mise à jour StockItem (+QuantityGood)
```

---

## 4.6 Ventes ↔ Stock

**Déclencheur**: Confirmation vente

**Processus**:
```typescript
1. Vente confirmée
2. Pour chaque SaleLine:
   - Créer StockMovement (type: exit)
   - ProductId, Quantity
   - Reference: SaleNumber
3. Mise à jour StockItems (-Quantities)
```

---

## 4.7 RH Pointage ↔ Transport

**Déclencheur**: Check-in avec demande transport

**Processus**:
```typescript
1. Pointage créé (CheckIn)
2. Si requestTransport = true:
   - Récupérer règle transport applicable
   - Calculer montant (defaultAmount ou distance × ratePerKm)
   - Créer TransportAllowance:
     - EmployeeId
     - WorkDate
     - TransportType
     - Amount
     - Status: validated (si auto) ou pending
     - AttendanceId (lien)
3. Si photo fournie, upload
```

**Code**:
```typescript
// Dans check-in page
async handleCheckIn() {
  // 1. Créer attendance
  const attendance = await fetch('/api/hr/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify({
      checkInTime, location, locationId, ...
    })
  });

  // 2. Si transport demandé
  if (requestTransport) {
    const transport = await fetch('/api/hr/transport-allowances', {
      method: 'POST',
      body: JSON.stringify({
        attendanceId: attendance.AttendanceId,
        transportType: selectedTransportType,
        workDate: today,
        locationId,
      })
    });
  }
}
```

---

## 4.8 Dépenses ↔ Workflow Validation

**Déclencheur**: Soumission demande dépense

**Processus**:
```typescript
1. Demande soumise (POST /api/expenses/requests/[id]/submit)
2. Récupérer seuils validation pour type "expense" + catégorie
3. Calculer niveaux requis selon montant:
   - < 10K → Level 1
   - < 50K → Level 2
   - < 200K → Level 3
   - ≥ 200K → Level 4
4. Créer ValidationRequest:
   - EntityType: "expense"
   - EntityId: ExpenseRequestId
   - RequiredLevels: calculé
   - CurrentLevel: 0
5. Notification approbateur niveau 1
6. Chaque approbation incrémente CurrentLevel
7. Si CurrentLevel = RequiredLevels:
   → ExpenseRequest.Status = 'approved'
```

---

## 4.9 Paie ↔ Transports

**Déclencheur**: Calcul paie mensuelle

**Processus**:
```typescript
1. Création Payroll pour mois M
2. Pour chaque employé:
   - BaseSalary
   - Calculer commissions (CommissionService)
   - Calculer transports validés non payés:
     → transportAllowanceService.calculateTotal(
         employeeId,
         startDate,
         endDate,
         status: 'validated'
       )
   - Calculer avances à déduire
   - GrossAmount = Base + Commissions + Transports
   - NetAmount = Gross - Avances - Deductions
3. Créer PayrollLine avec TotalTransports
4. Lors paiement paie:
   → Marquer TransportAllowances comme 'paid'
   → Enregistrer PayrollId
```

---

## 4.10 Comptabilité ↔ Tous Modules

**Déclencheurs multiples**:

**Vente**:
```
Débit  411.Clients           TotalAmount
  Crédit  707.Ventes                      TotalAmount
```

**Achat**:
```
Débit  601.Achats            TotalAmount
  Crédit  401.Fournisseurs               TotalAmount
```

**Dépense payée**:
```
Débit  6XX.Charge            Amount
  Crédit  512.Banque/Caisse              Amount
```

**Règlement consignation**:
```
Débit  467.Créances Partenaires  Amount
  Crédit  512.Banque                     Amount
```

**Paie**:
```
Débit  661.Salaires          NetAmount
  Crédit  512.Banque                     NetAmount
```

---

# 5. SÉCURITÉ & GOUVERNANCE

## 5.1 Authentification

### NextAuth.js

**Providers**:
- Credentials (email + password)
- OAuth (Google, Microsoft) - optionnel

**Sessions**:
- JWT (JSON Web Tokens)
- Expiration: 30 jours
- Refresh automatique

**Protection Routes**:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    return NextResponse.redirect('/auth/login');
  }

  // Vérifier permissions RBAC
  const hasPermission = checkPermission(
    token.role,
    request.nextUrl.pathname
  );

  if (!hasPermission) {
    return NextResponse.redirect('/unauthorized');
  }
}
```

---

## 5.2 Autorisations (RBAC)

### Vérification Permissions

**Côté API**:
```typescript
// app/api/customers/route.ts
export async function GET(request: Request) {
  const session = await getServerSession();

  // Vérifier permission
  if (!hasPermission(session.user.role, 'CUSTOMER_VIEW')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // Continuer...
}
```

**Côté UI**:
```typescript
// components/CustomerList.tsx
export function CustomerList() {
  const { hasPermission } = usePermissions();

  return (
    <div>
      {hasPermission('CUSTOMER_CREATE') && (
        <button>Nouveau Client</button>
      )}
      {/* ... */}
    </div>
  );
}
```

---

## 5.3 Validation Données

### Schémas Zod

**Exemple Customer**:
```typescript
const CreateCustomerSchema = z.object({
  customerType: z.enum(['individual', 'company', 'reseller']),
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^(77|78|76|70)\d{7}$/),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  workspaceId: z.string(),
});

// Validation API
export async function POST(request: Request) {
  const body = await request.json();

  // Valider
  const result = CreateCustomerSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten() },
      { status: 400 }
    );
  }

  // Créer customer
  const customer = await customerService.create(result.data);
  return NextResponse.json(customer);
}
```

---

## 5.4 Traçabilité

### GPS + Timestamps

**Capture systématique**:
```typescript
// Sur actions critiques
{
  userId: session.user.id,
  userName: session.user.name,
  timestamp: new Date().toISOString(),
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
  gpsLocation: {
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy,
  },
  action: 'CREATE',
  entityType: 'Customer',
  entityId: customer.CustomerId,
}
```

### Photos Obligatoires

**Contextes**:
- Pointages RH (arrivée + sortie)
- Sollicitations dépenses urgentes
- Livraisons
- Réceptions marchandises

**Upload**:
```typescript
// Upload local + sauvegarde URL Airtable
const formData = new FormData();
formData.append('photo', photoFile);

const response = await fetch('/api/upload/local', {
  method: 'POST',
  body: formData,
});

const { url } = await response.json();

// Enregistrer URL dans Airtable
await airtable.table('Attendance').update(attendanceId, {
  CheckInPhotoUrl: url,
});
```

### Audit Logs

**Journalisation**:
- Toutes créations/modifications/suppressions
- Changements d'état
- Validations
- Paiements
- Accès données sensibles

---

## 5.5 Gestion Erreurs

### Patterns

**API Routes**:
```typescript
export async function GET(request: Request) {
  try {
    const data = await service.getData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching data:', error);

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**UI**:
```typescript
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

async function handleSubmit() {
  setLoading(true);
  setError(null);

  try {
    await submitData();
    toast.success('Données enregistrées');
    router.push('/success');
  } catch (err) {
    setError(err.message);
    toast.error('Erreur lors de l\'enregistrement');
  } finally {
    setLoading(false);
  }
}
```

---

# 6. GUIDE D'UTILISATION

## 6.1 Premiers Pas

### Installation

```bash
# Cloner le projet
git clone https://github.com/votre-org/ddm-erp.git
cd ddm-erp

# Installer dépendances
npm install

# Configurer environnement
cp .env.example .env.local

# Variables requises dans .env.local:
NEXT_PUBLIC_AIRTABLE_API_KEY=your_key
NEXT_PUBLIC_AIRTABLE_BASE_ID=your_base_id
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000

# Lancer développement
npm run dev

# Ouvrir http://localhost:3000
```

### Configuration Initiale

**1. Créer Workspace**:
```
/admin/workspaces/new
→ Nom: "Mon Entreprise"
→ Devise: XOF (F CFA)
→ Timezone: Africa/Dakar
```

**2. Créer Utilisateurs**:
```
/admin/users/new
→ Email, Nom, Rôle
→ Envoyer invitation
```

**3. Configurer Entrepôts**:
```
/stock/warehouses/new
→ Nom: "Principal"
→ Type: main
→ Adresse, GPS
```

**4. Ajouter Produits**:
```
/products/new
→ Nom, Catégorie
→ Prix vente
→ Photo
```

**5. Configurer Règles Transport**:
```
/hr/transport/rules/new
→ Montant défaut: 2000 F
→ Rôles: sales_agent
→ Auto-validation: Oui
```

---

## 6.2 Workflows Quotidiens

### Commercial Terrain

**Matin (8h00)**:
```
1. Pointer arrivée
   → /hr/attendance/check-in
   → GPS auto
   → Photo
   → Lieu: Stand Marché
   → Demande transport: Oui
   → Type: Visite Stand
   → Valider (30 sec)

2. Consulter objectifs jour
   → Dashboard
   → Ventes à réaliser
```

**Pendant Journée**:
```
1. Nouveau client
   → /customers/quick
   → Type, Nom, Tél (3 champs)
   → Enregistrer (20 sec)

2. Vente rapide
   → /sales/quick
   → Sélectionner client
   → Ajouter produits (images)
   → Paiement
   → Imprimer reçu (1 min)

3. Solliciter dépense urgente
   → /expenses/requests/quick
   → Montant: 5000 F
   → Catégorie: Transport
   → Photo reçu
   → Urgence: Haute
   → Soumettre (40 sec)
```

**Soir (18h00)**:
```
1. Pointer sortie
   → /hr/attendance/check-out
   → Photo
   → Notes optionnelles
   → Valider (15 sec)

2. Vérifier commissions
   → Dashboard RH
   → Commissions du jour
```

---

### Manager

**Matin**:
```
1. Dashboard principal
   → Vue KPIs globaux
   → Ventes jour/semaine
   → Alertes à traiter

2. Valider dépenses
   → /expenses
   → Section "À Valider"
   → Consulter détails
   → Approuver/Rejeter (30 sec/dépense)

3. Vérifier stock
   → /stock
   → Alertes ruptures
   → Programmer réappro
```

**Pendant Journée**:
```
1. Suivre ventes temps réel
   → Dashboard ventes
   → Performance commerciaux

2. Créer ordre production
   → /production/orders/new
   → Wizard 4 étapes
   → Sélection recette
   → Quantité + dates
   → Valider (2 min)

3. Gérer partenaires
   → /consignation/partners
   → Vérifier soldes dus
   → Créer dépôts
```

---

### Comptable

**Quotidien**:
```
1. Vérifier trésorerie
   → /treasury
   → Soldes comptes
   → Rapprocher transactions

2. Approuver dépenses validées
   → /expenses/requests?status=approved
   → Vérifier preuves
   → Marquer payées

3. Règlements partenaires
   → /consignation/settlements
   → Créer règlements
   → Payer
```

**Fin de Mois**:
```
1. Valider transports RH
   → /hr/transport-allowances
   → Vérifier conformité
   → Valider par lot

2. Calculer paies
   → /hr/payroll/new
   → Sélectionner mois
   → Calcul automatique
   → Vérifier montants
   → Générer bulletins

3. Clôturer mois
   → /accounting
   → Balance
   → Compte résultat
   → Export comptable
```

---

### Direction Générale

**Dashboard Temps Réel**:
```
/dashboard/dg

KPIs:
- Ventes jour/semaine/mois vs objectifs
- Trésorerie (soldes + flux)
- Stock (valeur + alertes)
- RH (présences + performances)
- Rentabilité

Point Flash (dimanche 19h):
→ Reçu automatiquement WhatsApp + Email
→ Synthèse semaine complète
```

**Validations Stratégiques**:
```
/validations

→ Dépenses > 200K F
→ Achats équipements
→ Investissements
→ Approuver/Rejeter niveau 3
```

---

## 6.3 Cas d'Usage Avancés

### Lancement Programme Fidélité

**Objectif**: Fidéliser clients existants

**Étapes**:
```
1. Configurer tiers
   → /customers/loyalty
   → Vérifier seuils (Bronze → Diamond)
   → Ajuster si besoin

2. Créer récompenses
   → Catalogue récompenses
   → Ajouter: Réduction 10% (coût: 500 pts)
   → Ajouter: Produit gratuit (coût: 1000 pts)

3. Migrer clients existants
   → Recalculer tiers selon historique
   → Attribuer points rétroactifs (optionnel)

4. Communication
   → Informer clients du programme
   → Impression cartes fidélité
   → Formation commerciaux

5. Suivi
   → Dashboard fidélité
   → Évolution tiers
   → Taux échange récompenses
```

---

### Expansion Réseau Consignation

**Objectif**: Ajouter 10 nouveaux partenaires pharmacies

**Workflow**:
```
1. Création partenaires
   → /consignation/partners/new
   → Type: Pharmacie
   → Contact, Adresse, GPS
   → Commission: 15%
   → Règlement: 30 jours
   → Répéter x10

2. Premier dépôt
   → /consignation/deposits/new
   → Sélectionner partenaire
   → Ajouter produits + quantités
   → Valider
   → Sortie stock automatique
   → Bon livraison généré

3. Livraison
   → Commercial livre
   → Partenaire signe

4. Suivi régulier
   → Rapports ventes hebdomadaires
   → Règlements mensuels
   → Analyse performance
```

---

### Mise en Place Production

**Objectif**: Démarrer production jus d'orange

**Préparation**:
```
1. Créer ingrédients
   → /production/ingredients/new
   → Orange fraîche (kg, 500 F/kg)
   → Sucre (kg, 800 F/kg)
   → Eau (L, 50 F/L)
   → Bouteilles 1L (unité, 100 F/u)

2. Créer recette
   → /production/recipes/new
   → Nom: "Jus Orange 1L"
   → Produit fini: Jus Orange 1L
   → Output: 100 bouteilles/batch
   → Ingrédients:
     - Orange: 50 kg
     - Sucre: 5 kg
     - Eau: 30 L
     - Bouteilles: 100 u
   → Durée: 120 min
   → Instructions: "..."
   → Rendement attendu: 95%
```

**Production**:
```
1. Créer ordre
   → /production/orders/new
   → Recette: Jus Orange 1L
   → Quantité: 5 batches (= 500 bouteilles)
   → Dates: Aujourd'hui → +2 jours
   → Entrepôt source: Principal
   → Entrepôt destination: Usine
   → Priorité: Normale

2. Démarrer production
   → /production/orders/[id]
   → "Démarrer"
   → Status: in_progress

3. Consommer ingrédients
   → "Consommer ingrédient"
   → Orange: 250 kg
   → Enregistrer
   → Répéter pour autres ingrédients

4. Créer lots
   → "Créer lot"
   → Quantité produite: 480
   → Quantité défectueuse: 20
   → Quantité bonne: 460
   → N° lot: LOT-20241115-001
   → Enregistrer
   → Entrée stock automatique (460 bouteilles)

5. Terminer
   → "Terminer production"
   → Calcul rendement: 92% (460/500)
   → Status: completed
```

---

### Contrôle Dépenses Strict

**Objectif**: Réduire dépenses irrégulières

**Configuration**:
```
1. Workflow validation
   → /settings/validation-thresholds
   → Type: Dépenses
   → Seuils:
     < 5K: Auto-approuvé
     < 20K: Niveau 1 (Chef équipe)
     < 100K: Niveau 2 (Manager)
     ≥ 100K: Niveau 3 (DG)

2. Règle auto-rejet
   → /rules/new
   → Type: Dépense
   → Conditions:
     - Montant > 50K
     - ET Pas de preuve jointe
   → Action: Rejeter automatiquement
   → Message: "Preuve obligatoire > 50K"

3. Alerte dépenses inhabituelles
   → Module IA
   → Détection anomalies activée
   → Seuil alerte: +30% vs moyenne
```

**Utilisation**:
```
Commercial fait sollicitation:
→ 8K Transport (photo reçu)
→ Auto-approuvée (< 20K + preuve)

→ 45K Maintenance (pas de photo)
→ Rejetée automatiquement (règle)

→ 150K Équipement (facture jointe)
→ Validation DG requise (seuil)
→ IA recommande: Vérifier avant approuver
→ DG approuve avec commentaire
```

---

# 7. API REFERENCE

## 7.1 Authentification

### POST /api/auth/login

**Description**: Connexion utilisateur

**Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200**:
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "Jean Dupont",
    "role": "manager",
    "workspaceId": "ws_xxx"
  },
  "token": "jwt_token_here"
}
```

---

### POST /api/auth/register

**Description**: Inscription nouveau compte

**Body**:
```json
{
  "email": "new@example.com",
  "password": "password123",
  "name": "Nouveau User",
  "workspaceName": "Mon Entreprise"
}
```

**Response 201**:
```json
{
  "user": { ... },
  "workspace": { ... },
  "message": "Compte créé avec succès"
}
```

---

## 7.2 Clients

### GET /api/customers

**Description**: Liste clients avec filtres

**Query Params**:
- `status` (string): active, inactive
- `tier` (string): bronze, silver, gold, platinum, diamond
- `city` (string): Ville
- `search` (string): Recherche nom/téléphone
- `limit` (number): Nombre résultats (défaut: 50)
- `offset` (number): Pagination

**Response 200**:
```json
{
  "customers": [
    {
      "CustomerId": "cus_123",
      "CustomerCode": "CUS-0001",
      "CustomerType": "individual",
      "Name": "Jean Dupont",
      "Phone": "771234567",
      "Email": "jean@example.com",
      "Status": "active",
      "CurrentTier": "silver",
      "TotalPoints": 850,
      "TotalSpent": 650000,
      "TotalOrders": 15,
      "CreatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 125,
  "limit": 50,
  "offset": 0
}
```

---

### POST /api/customers

**Description**: Créer nouveau client

**Body**:
```json
{
  "customerType": "individual",
  "name": "Marie Diallo",
  "phone": "771234567",
  "email": "marie@example.com",
  "address": "Dakar, Sénégal",
  "city": "Dakar"
}
```

**Response 201**:
```json
{
  "customer": {
    "CustomerId": "cus_124",
    "CustomerCode": "CUS-0002",
    "Name": "Marie Diallo",
    "CurrentTier": "bronze",
    "TotalPoints": 0
  }
}
```

---

### GET /api/customers/[id]

**Description**: Détail client complet

**Response 200**:
```json
{
  "customer": {
    "CustomerId": "cus_123",
    "Name": "Jean Dupont",
    "CurrentTier": "silver",
    "TotalPoints": 850,
    "TotalSpent": 650000,
    "TotalOrders": 15,
    "LastOrderDate": "2024-11-10",
    "AverageOrderValue": 43333
  },
  "loyaltyHistory": [
    {
      "TransactionId": "loy_456",
      "Type": "earn",
      "Points": 50,
      "Description": "Achat SAL-0123",
      "Date": "2024-11-10"
    }
  ],
  "orders": [...]
}
```

---

### POST /api/customers/loyalty/process-sale

**Description**: Attribuer points pour vente (hook)

**Body**:
```json
{
  "saleId": "sale_789",
  "saleNumber": "SAL-0123",
  "customerId": "cus_123",
  "totalAmount": 50000,
  "saleDate": "2024-11-15"
}
```

**Response 200**:
```json
{
  "success": true,
  "pointsEarned": 60,
  "bonusPoints": 0,
  "totalPoints": 910,
  "tierUpgraded": false,
  "newTier": "silver"
}
```

---

## 7.3 Ventes

### POST /api/sales

**Description**: Créer vente

**Body**:
```json
{
  "customerId": "cus_123",
  "items": [
    {
      "productId": "prod_456",
      "quantity": 2,
      "unitPrice": 5000
    },
    {
      "productId": "prod_789",
      "quantity": 1,
      "unitPrice": 15000
    }
  ],
  "paymentMethod": "cash",
  "paidAmount": 25000,
  "notes": "Vente stand marché"
}
```

**Response 201**:
```json
{
  "sale": {
    "SaleId": "sale_999",
    "SaleNumber": "SAL-0124",
    "CustomerId": "cus_123",
    "TotalAmount": 25000,
    "Status": "completed",
    "CreatedAt": "2024-11-15T10:30:00Z"
  },
  "loyaltyProcessed": true,
  "pointsEarned": 30
}
```

---

## 7.4 Stock

### POST /api/stock/movements

**Description**: Créer mouvement stock

**Body**:
```json
{
  "movementType": "exit",
  "warehouseId": "wh_123",
  "lines": [
    {
      "productId": "prod_456",
      "quantity": 10,
      "reason": "Vente SAL-0124"
    }
  ],
  "reference": "SAL-0124",
  "notes": "Sortie vente"
}
```

**Response 201**:
```json
{
  "movement": {
    "MovementId": "mov_888",
    "MovementNumber": "MOV-202411-0056",
    "MovementType": "exit",
    "Status": "completed",
    "CreatedAt": "2024-11-15T10:32:00Z"
  }
}
```

---

### GET /api/stock/alerts

**Description**: Alertes stock (ruptures + stock faible)

**Response 200**:
```json
{
  "alerts": [
    {
      "type": "out_of_stock",
      "productId": "prod_456",
      "productName": "Jus Orange 1L",
      "warehouseId": "wh_123",
      "warehouseName": "Principal",
      "currentQuantity": 0,
      "minimumStock": 20,
      "severity": "critical"
    },
    {
      "type": "low_stock",
      "productId": "prod_789",
      "productName": "Jus Bissap 1L",
      "currentQuantity": 8,
      "minimumStock": 15,
      "severity": "warning"
    }
  ],
  "summary": {
    "outOfStock": 3,
    "lowStock": 5,
    "total": 8
  }
}
```

---

## 7.5 Production

### POST /api/production/orders

**Description**: Créer ordre production

**Body**:
```json
{
  "recipeId": "rec_123",
  "plannedQuantity": 500,
  "plannedStartDate": "2024-11-16",
  "plannedEndDate": "2024-11-18",
  "sourceWarehouseId": "wh_123",
  "destinationWarehouseId": "wh_456",
  "priority": "normal",
  "notes": "Production semaine 47"
}
```

**Response 201**:
```json
{
  "order": {
    "ProductionOrderId": "po_777",
    "OrderNumber": "OP-202411150001",
    "RecipeId": "rec_123",
    "Status": "draft",
    "PlannedQuantity": 500,
    "CreatedAt": "2024-11-15T11:00:00Z"
  }
}
```

---

### POST /api/production/orders/[id]/start

**Description**: Démarrer production

**Response 200**:
```json
{
  "order": {
    "ProductionOrderId": "po_777",
    "Status": "in_progress",
    "ActualStartDate": "2024-11-16T08:00:00Z"
  }
}
```

---

### POST /api/production/orders/[id]/batch

**Description**: Créer lot produit fini

**Body**:
```json
{
  "quantityProduced": 480,
  "quantityDefective": 20,
  "qualityScore": 92,
  "notes": "Batch qualité OK"
}
```

**Response 201**:
```json
{
  "batch": {
    "BatchId": "bat_555",
    "BatchNumber": "LOT-202411160001",
    "QuantityGood": 460,
    "ProductionDate": "2024-11-16"
  },
  "stockMovementCreated": true
}
```

---

## 7.6 Dépenses

### POST /api/expenses/requests

**Description**: Créer demande dépense

**Body**:
```json
{
  "title": "Transport Marché",
  "amount": 5000,
  "currency": "XOF",
  "category": "fonctionnelle",
  "subCategory": "transport",
  "urgency": "high",
  "neededByDate": "2024-11-15",
  "description": "Déplacement stand marché central",
  "beneficiaryId": "user_123"
}
```

**Response 201**:
```json
{
  "request": {
    "ExpenseRequestId": "exp_444",
    "RequestNumber": "EXP-202411-0012",
    "Status": "draft",
    "Amount": 5000,
    "CreatedAt": "2024-11-15T09:00:00Z"
  }
}
```

---

### POST /api/expenses/requests/[id]/submit

**Description**: Soumettre demande pour approbation

**Response 200**:
```json
{
  "request": {
    "ExpenseRequestId": "exp_444",
    "Status": "submitted",
    "SubmittedAt": "2024-11-15T09:05:00Z"
  },
  "validationCreated": true,
  "requiredApprovalLevels": 2
}
```

---

### POST /api/expenses/requests/[id]/approve

**Description**: Approuver ou rejeter demande

**Body**:
```json
{
  "decision": "approved",
  "comments": "OK pour transport"
}
```

**Response 200**:
```json
{
  "request": {
    "ExpenseRequestId": "exp_444",
    "Status": "pending_approval",
    "CurrentApprovalLevel": 1,
    "RequiredApprovalLevels": 2
  },
  "approval": {
    "Level": 1,
    "Decision": "approved",
    "ApprovedBy": "Manager Jean",
    "Timestamp": "2024-11-15T10:00:00Z"
  }
}
```

---

## 7.7 RH

### POST /api/hr/attendance/check-in

**Description**: Pointage arrivée

**Body**:
```json
{
  "checkInTime": "2024-11-15T08:00:00Z",
  "checkInLatitude": 14.7167,
  "checkInLongitude": -17.4677,
  "checkInAccuracy": 15,
  "checkInLocation": "Stand Marché Central, Dakar",
  "locationId": "loc_123",
  "locationName": "Stand Marché",
  "notes": "Arrivée normale"
}
```

**Response 201**:
```json
{
  "attendance": {
    "AttendanceId": "att_888",
    "EmployeeId": "emp_123",
    "CheckInTime": "2024-11-15T08:00:00Z",
    "CheckInLocation": "Stand Marché Central, Dakar",
    "Status": "checked_in"
  }
}
```

---

### POST /api/hr/transport-allowances

**Description**: Créer indemnité transport

**Body**:
```json
{
  "attendanceId": "att_888",
  "workDate": "2024-11-15",
  "transportType": "stand_visit",
  "locationId": "loc_123",
  "locationName": "Stand Marché",
  "description": "Transport stand journée"
}
```

**Response 201**:
```json
{
  "transport": {
    "TransportId": "tra_999",
    "TransportNumber": "TRA-202411-0045",
    "Amount": 2000,
    "Currency": "XOF",
    "Status": "validated",
    "AppliedRate": 2000,
    "CreatedAt": "2024-11-15T08:01:00Z"
  }
}
```

---

## 7.8 Règles

### POST /api/rules

**Description**: Créer règle métier

**Body**:
```json
{
  "name": "Auto-approuver transport < 10K",
  "decisionType": "expense_approval",
  "isActive": true,
  "conditions": [
    {
      "field": "amount",
      "operator": "less_than",
      "value": 10000
    },
    {
      "field": "subCategory",
      "operator": "equals",
      "value": "transport"
    }
  ],
  "conditionLogic": "AND",
  "actions": [
    {
      "type": "approve_expense",
      "autoExecute": true
    }
  ]
}
```

**Response 201**:
```json
{
  "rule": {
    "RuleId": "rule_777",
    "Name": "Auto-approuver transport < 10K",
    "IsActive": true,
    "ExecutionCount": 0
  }
}
```

---

### POST /api/rules/execute

**Description**: Exécuter règle manuellement

**Body**:
```json
{
  "ruleId": "rule_777",
  "entityId": "exp_444",
  "entityType": "expense"
}
```

**Response 200**:
```json
{
  "executed": true,
  "conditionsMet": true,
  "actionsExecuted": [
    {
      "type": "approve_expense",
      "result": "success"
    }
  ]
}
```

---

## 7.9 Validations

### GET /api/validations/pending

**Description**: Demandes nécessitant mon approbation

**Query Params**:
- `entityType` (string): expense, purchase, production, etc.

**Response 200**:
```json
{
  "validations": [
    {
      "ValidationId": "val_123",
      "EntityType": "expense",
      "EntityId": "exp_444",
      "EntityData": {
        "RequestNumber": "EXP-202411-0012",
        "Amount": 45000,
        "Category": "transport"
      },
      "CurrentLevel": 1,
      "RequiredLevels": 2,
      "MyLevel": 2,
      "Status": "pending",
      "CreatedAt": "2024-11-15T09:00:00Z"
    }
  ],
  "total": 5
}
```

---

### POST /api/validations/[id]/approve

**Description**: Approuver validation

**Body**:
```json
{
  "decision": "approved",
  "comments": "Approuvé par manager",
  "gpsLocation": {
    "latitude": 14.7167,
    "longitude": -17.4677
  }
}
```

**Response 200**:
```json
{
  "validation": {
    "ValidationId": "val_123",
    "Status": "approved",
    "CompletedAt": "2024-11-15T15:00:00Z"
  },
  "entityUpdated": true
}
```

---

# 8. DÉPLOIEMENT & MAINTENANCE

## 8.1 Déploiement Production

### Prérequis

- Compte Vercel (recommandé)
- Base Airtable configurée
- Domaine personnalisé (optionnel)

### Étapes Vercel

```bash
# 1. Installer Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Lier projet
vercel link

# 4. Configurer variables environnement
vercel env add NEXT_PUBLIC_AIRTABLE_API_KEY
vercel env add NEXT_PUBLIC_AIRTABLE_BASE_ID
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL

# 5. Déployer production
vercel --prod
```

### Configuration Domaine

```bash
# Vercel Dashboard
→ Settings → Domains
→ Add domain: erp.votreentreprise.com
→ Configurer DNS (A record / CNAME)
→ Certificat SSL auto
```

---

## 8.2 Monitoring

### Vercel Analytics

**Activation**:
```bash
# Vercel Dashboard
→ Analytics → Enable

# Dans next.config.js
module.exports = {
  // ...
  analytics: {
    vercel: true
  }
}
```

**Métriques**:
- Temps chargement pages
- Web Vitals (LCP, FID, CLS)
- Nombre visiteurs
- Top pages

---

### Error Tracking

**Sentry (recommandé)**:

```bash
npm install @sentry/nextjs

# Configuration
npx @sentry/wizard -i nextjs
```

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

---

## 8.3 Backups

### Airtable

**Sauvegarde manuelle**:
```
Airtable Base → ... → Duplicate base
→ Renommer: "DDM Backup YYYY-MM-DD"
```

**Sauvegarde automatique** (script):
```typescript
// scripts/backup-airtable.ts
import Airtable from 'airtable';

async function backupBase() {
  const base = new Airtable({ apiKey }).base(baseId);

  // Exporter toutes tables en JSON
  const tables = await getAllTables(base);

  for (const table of tables) {
    const records = await base(table.name).select().all();
    const data = records.map(r => r.fields);

    // Sauvegarder JSON
    fs.writeFileSync(
      `backups/${table.name}-${date}.json`,
      JSON.stringify(data, null, 2)
    );
  }
}

// Cron hebdomadaire
cron.schedule('0 2 * * 0', backupBase); // Dimanche 2h
```

---

## 8.4 Mises à Jour

### Dépendances

```bash
# Vérifier mises à jour
npm outdated

# Mettre à jour
npm update

# Mise à jour majeure (attention breaking changes)
npm install next@latest react@latest
```

### Tests Avant Déploiement

```bash
# 1. Build local
npm run build

# 2. Test build
npm start

# 3. Vérifier fonctionnalités critiques
- Login
- Création client
- Création vente
- Pointage RH
- Sollicitation dépense

# 4. Si OK, déployer
vercel --prod
```

---

## 8.5 Troubleshooting

### Erreurs Communes

**1. "Airtable API rate limit exceeded"**

```typescript
// Solution: Implémenter retry avec backoff
async function airtableRequest(fn) {
  let retries = 3;
  while (retries > 0) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429) {
        await sleep(1000 * (4 - retries));
        retries--;
      } else {
        throw error;
      }
    }
  }
}
```

**2. "NextAuth session expired"**

```typescript
// next-auth.config.ts
session: {
  maxAge: 30 * 24 * 60 * 60, // 30 jours
  updateAge: 24 * 60 * 60,   // Refresh chaque jour
}
```

**3. "Build failed - memory limit"**

```json
// vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ]
}
```

**4. "GPS not working on mobile"**

```typescript
// Vérifier HTTPS (requis pour GPS)
if (location.protocol !== 'https:') {
  console.error('GPS requires HTTPS');
}

// Vérifier permissions
navigator.permissions.query({ name: 'geolocation' })
  .then(result => {
    if (result.state === 'denied') {
      alert('Veuillez activer la géolocalisation');
    }
  });
```

---

## 8.6 Performance Optimization

### Images

```typescript
// Utiliser Next.js Image
import Image from 'next/image';

<Image
  src={product.ImageUrl}
  alt={product.Name}
  width={300}
  height={300}
  placeholder="blur"
  blurDataURL="/placeholder.jpg"
/>
```

### Lazy Loading

```typescript
// Lazy load composants lourds
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(
  () => import('@/components/HeavyChart'),
  { ssr: false, loading: () => <Spinner /> }
);
```

### Caching

```typescript
// Cache API responses
export async function GET(request: Request) {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}
```

---

## 8.7 Sécurité

### Headers Sécurité

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};
```

### Variables Sensibles

```bash
# JAMAIS commiter .env.local
echo ".env.local" >> .gitignore

# Rotation clés API régulière
# Airtable: Générer nouvelle clé tous les 6 mois
```

### Rate Limiting

```typescript
// Limiter tentatives login
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 tentatives
  message: 'Trop de tentatives, réessayez dans 15 min'
});
```

---

## 8.8 Support & Documentation

### Documentation Utilisateur

- Guide démarrage rapide (PDF)
- Tutoriels vidéo (workflows principaux)
- FAQ (questions fréquentes)
- Base de connaissances (articles détaillés)

### Support Technique

**Niveaux**:
1. **Niveau 1** - Utilisateurs finaux
   - Email: support@votreentreprise.com
   - WhatsApp: +221 XX XXX XXXX
   - Temps réponse: 4h ouvrées

2. **Niveau 2** - Administrateurs
   - Email technique: tech@votreentreprise.com
   - Temps réponse: 2h ouvrées

3. **Niveau 3** - Développeurs
   - GitHub Issues
   - Temps réponse: 24h

### Mises à Jour Documentation

```bash
# À chaque release
1. Mettre à jour CHANGELOG.md
2. Documenter nouvelles fonctionnalités
3. Mettre à jour guides utilisateur
4. Communiquer aux utilisateurs
```

---

# 📞 CONTACTS & RESSOURCES

## Équipe Technique
- **Développement**: dev@votreentreprise.com
- **Support**: support@votreentreprise.com
- **Urgences**: +221 XX XXX XXXX

## Liens Utiles
- **Documentation Next.js**: https://nextjs.org/docs
- **Documentation Airtable**: https://airtable.com/developers
- **Documentation Tailwind**: https://tailwindcss.com/docs
- **Documentation TypeScript**: https://www.typescriptlang.org/docs

## Communauté
- **GitHub**: https://github.com/votre-org/ddm-erp
- **Discord**: https://discord.gg/your-server (optionnel)

---

# 🎉 CONCLUSION

Le système DDM ERP est une **solution complète, moderne et mobile-first** qui couvre l'ensemble des besoins de gestion d'une entreprise de distribution et production au Sénégal.

**Points Forts**:
- ✅ 15 modules intégrés
- ✅ 100+ API endpoints
- ✅ Interface mobile optimisée
- ✅ Automatisations intelligentes
- ✅ Traçabilité complète
- ✅ IA intégrée
- ✅ Scalable et évolutif

**Prêt pour Production** 🚀

---

**Version**: 2.0.0
**Date**: 15 Novembre 2024
**Auteur**: Équipe DDM
**Licence**: Propriétaire
