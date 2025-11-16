# Module 7.2 - Consignation & Partenaires - Spécification Complète

**Date**: 14 novembre 2024
**Statut**: Types TypeScript créés + Architecture définie
**Criticité**: CRITIQUE pour le modèle économique (pharmacies, points relais)

---

## 📋 Vue d'ensemble

Le Module Consignation & Partenaires est **critique pour le modèle économique** de distribution. Il gère le système de consignation où des produits sont déposés chez des partenaires (pharmacies, points de vente) qui les vendent en commission.

### Modèle économique

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│  Entreprise │ Dépôt   │  Partenaire  │  Vente  │  Client  │
│   (Nous)    │────────>│  (Pharmacie) │────────>│   Final  │
└─────────────┘         └──────────────┘         └──────────┘
       │                       │
       │  Règlement            │  Rapport
       │  (Ventes - Commission)│  de ventes
       └───────────────────────┘
```

### Objectifs du module

✅ **Gestion des partenaires** (pharmacies, points relais, revendeurs)
✅ **Contrats de dépôt** avec commission configurable
✅ **Suivi des stocks consignés** chez chaque partenaire
✅ **Rapports de vente** soumis par les partenaires
✅ **Génération automatique des ventes** depuis les rapports
✅ **Gestion des retours** (invendus, produits endommagés)
✅ **Règlements financiers** (paiement aux partenaires)
✅ **Intégration avec Stocks** (sortie/entrée automatique)
✅ **Intégration avec Trésorerie** (transactions automatiques)

---

## 🏗️ Architecture - Types TypeScript (Implémentés)

### 1. Partner (Partenaire)

```typescript
export type PartnerType = 'pharmacy' | 'relay_point' | 'wholesaler' | 'retailer' | 'other';
export type PartnerStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface Partner {
  PartnerId: string;
  PartnerCode: string; // PAR-0001
  Name: string;
  Type: PartnerType;
  Status: PartnerStatus;

  // Contact
  ContactPerson: string;
  Phone: string;
  Email?: string;
  Address?: string;
  City?: string;
  Region?: string;

  // Contrat
  ContractStartDate: string;
  ContractEndDate?: string;
  CommissionRate: number; // % sur les ventes (ex: 15%)
  PaymentTerms: number; // Jours (ex: 30, 60)

  // Financier (calculé automatiquement)
  TotalDeposited: number; // Total consigné
  TotalSold: number; // Total vendu
  TotalReturned: number; // Total retourné
  CurrentBalance: number; // Solde actuel (à payer au partenaire)
  Currency: string;

  // Métadonnées
  Notes?: string;
  Tags?: string[];

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

**Use case**: Une pharmacie `PAR-0001` "Pharmacie Centrale" avec 15% de commission, règlement à 30 jours.

### 2. Deposit (Dépôt/Consignation)

```typescript
export type DepositStatus =
  | 'pending' // En attente de validation
  | 'validated' // Validé et déposé
  | 'partial' // Partiellement vendu/retourné
  | 'completed' // Entièrement traité
  | 'cancelled'; // Annulé

export interface DepositLine {
  DepositLineId: string;
  DepositId: string;
  ProductId: string;
  ProductName?: string;
  QuantityDeposited: number;
  QuantitySold: number;
  QuantityReturned: number;
  QuantityRemaining: number;
  UnitPrice: number;
  TotalValue: number;
  Currency: string;
}

export interface Deposit {
  DepositId: string;
  DepositNumber: string; // DEP-202511-0001
  PartnerId: string;
  PartnerName: string;
  PartnerType: PartnerType;
  Status: DepositStatus;

  // Contenu
  Lines: DepositLine[];
  TotalItems: number;
  TotalValue: number;

  // Dates
  DepositDate: string;
  ExpectedReturnDate?: string;
  ActualReturnDate?: string;

  // Responsables
  PreparedById: string;
  PreparedByName: string;
  ValidatedById?: string;
  ValidatedByName?: string;
  ValidatedAt?: string;

  // Entrepôt source
  WarehouseId: string;
  WarehouseName?: string;

  // Métadonnées
  Notes?: string;
  DeliveryProof?: string; // URL bon de livraison signé

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

**Use case**: Dépôt de 100 unités de Produit A à 1,000 XOF/unité chez PAR-0001.

### 3. SalesReport (Rapport de ventes)

```typescript
export type SalesReportStatus = 'draft' | 'submitted' | 'validated' | 'processed' | 'rejected';

export interface SalesReportLine {
  ReportLineId: string;
  SalesReportId: string;
  ProductId: string;
  ProductName?: string;
  QuantitySold: number;
  UnitPrice: number;
  TotalAmount: number;
  Currency: string;
}

export interface SalesReport {
  SalesReportId: string;
  ReportNumber: string; // RAP-202511-0001
  PartnerId: string;
  PartnerName: string;
  DepositId?: string;
  DepositNumber?: string;
  Status: SalesReportStatus;

  // Période
  ReportDate: string;
  PeriodStart: string;
  PeriodEnd: string;

  // Contenu
  Lines: SalesReportLine[];
  TotalSales: number;
  PartnerCommission: number; // Montant commission
  NetAmount: number; // À payer au partenaire

  // Validation
  SubmittedById?: string;
  ValidatedById?: string;
  ValidatedAt?: string;
  RejectionReason?: string;

  // Génération de ventes
  SalesGenerated: boolean;
  GeneratedSaleIds?: string[];

  // Métadonnées
  Notes?: string;
  Attachments?: string[];

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

**Use case**: Le partenaire rapporte avoir vendu 80 unités du dépôt. Commission 15% = 12,000 XOF. Net à payer = 68,000 XOF.

### 4. Settlement (Règlement financier)

```typescript
export type SettlementStatus = 'pending' | 'partial' | 'completed' | 'cancelled';

export interface Settlement {
  SettlementId: string;
  SettlementNumber: string; // SET-202511-0001
  PartnerId: string;
  PartnerName: string;
  Status: SettlementStatus;

  // Montants
  TotalDue: number; // Total dû
  AmountPaid: number; // Déjà payé
  AmountRemaining: number; // Restant
  Currency: string;

  // Rapports inclus
  SalesReportIds: string[];

  // Paiement
  PaymentMethod?: 'cash' | 'bank_transfer' | 'mobile_money' | 'check';
  PaymentDate?: string;
  PaymentProof?: string;
  WalletId?: string;
  TransactionId?: string;

  // Responsables
  PreparedById: string;
  PaidById?: string;

  Notes?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

**Use case**: Règlement de 3 rapports pour un total de 200,000 XOF via Mobile Money.

### 5. ConsignationReturn (Retour de consignation)

```typescript
export interface ConsignationReturn {
  ReturnId: string;
  ReturnNumber: string; // RET-202511-0001
  DepositId: string;
  PartnerId: string;

  // Lignes de retour
  Lines: Array<{
    ProductId: string;
    ProductName: string;
    QuantityReturned: number;
    Condition: 'good' | 'damaged' | 'expired';
    Notes?: string;
  }>;

  // Dates
  ReturnDate: string;
  ReceivedById: string;

  // Entrepôt
  WarehouseId: string;

  Notes?: string;
  ReturnProof?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

**Use case**: Retour de 20 unités invendues, 5 en bon état, 15 endommagées.

---

## 🔄 Workflow Complet

### Cycle de vie d'une consignation

```
1. CRÉATION DÉPÔT
   ┌──────────────────┐
   │  Préparer dépôt  │ → Status: pending
   │  (choix produits)│
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Valider & Livrer │ → Status: validated
   │  (sortie stock)  │    (Mouvement stock automatique)
   └────────┬─────────┘
            │
            ▼
2. VENTES CHEZ PARTENAIRE
   ┌──────────────────┐
   │ Partenaire vend  │
   │  les produits    │
   └────────┬─────────┘
            │
            ▼
3. RAPPORT DE VENTES
   ┌──────────────────┐
   │Partenaire soumet │ → Status: submitted
   │  rapport ventes  │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  Validation      │ → Status: validated
   │  (vérification)  │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │Génération ventes │ → Status: processed
   │   automatique    │    (Créer ventes dans le système)
   └────────┬─────────┘
            │
            ▼
4. RÈGLEMENT
   ┌──────────────────┐
   │Créer règlement   │
   │(Total à payer)   │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  Payer           │ → Status: completed
   │  (via wallet)    │    (Transaction trésorerie)
   └────────┬─────────┘
            │
            ▼
5. RETOUR (optionnel)
   ┌──────────────────┐
   │Retour invendus   │
   │(entrée stock)    │
   └──────────────────┘
```

---

## 📊 Calculs Automatiques

### 1. Commission du partenaire

```typescript
TotalSales = Σ (QuantitySold × UnitPrice)
PartnerCommission = TotalSales × (CommissionRate / 100)
NetAmount = TotalSales - PartnerCommission
```

**Exemple**:
- Ventes totales: 100,000 XOF
- Taux commission: 15%
- Commission: 15,000 XOF
- Net à payer: 85,000 XOF

### 2. Solde du partenaire

```typescript
CurrentBalance = TotalSold - TotalPaid
```

**Exemple**:
- Total vendu: 500,000 XOF
- Déjà payé: 300,000 XOF
- Solde actuel: 200,000 XOF

### 3. Statut du dépôt

```typescript
QuantityRemaining = QuantityDeposited - QuantitySold - QuantityReturned

if (QuantityRemaining === 0) {
  Status = 'completed'
} else if (QuantitySold > 0 || QuantityReturned > 0) {
  Status = 'partial'
} else {
  Status = 'validated'
}
```

---

## 🔗 Intégrations Clés

### 1. Intégration avec Module Stock

#### A. Lors de la validation du dépôt

```typescript
// Service: DepositService.validate()
async validate(depositId: string, validatorId: string): Promise<Deposit> {
  const deposit = await this.getById(depositId);

  // Pour chaque ligne du dépôt
  for (const line of deposit.Lines) {
    // Créer un mouvement de sortie de stock
    await stockMovementService.create({
      type: 'exit',
      productId: line.ProductId,
      quantity: line.QuantityDeposited,
      warehouseId: deposit.WarehouseId,
      reason: `Dépôt consignation ${deposit.DepositNumber}`,
      reference: deposit.DepositNumber,
      performedBy: validatorId,
    });
  }

  // Mettre à jour le statut
  return this.updateStatus(depositId, 'validated', validatorId);
}
```

#### B. Lors du retour d'invendus

```typescript
// Service: ConsignationReturnService.process()
async process(returnId: string): Promise<ConsignationReturn> {
  const consignReturn = await this.getById(returnId);

  for (const line of consignReturn.Lines) {
    if (line.Condition === 'good') {
      // Réintégrer au stock
      await stockMovementService.create({
        type: 'entry',
        productId: line.ProductId,
        quantity: line.QuantityReturned,
        warehouseId: consignReturn.WarehouseId,
        reason: `Retour consignation ${consignReturn.ReturnNumber}`,
        reference: consignReturn.ReturnNumber,
      });
    } else {
      // Marquer comme perte (produit endommagé/expiré)
      await stockMovementService.create({
        type: 'adjustment',
        productId: line.ProductId,
        quantity: -line.QuantityReturned,
        warehouseId: consignReturn.WarehouseId,
        reason: `Perte retour ${line.Condition}`,
      });
    }
  }

  return consignReturn;
}
```

### 2. Intégration avec Module Ventes

#### Génération automatique des ventes depuis les rapports

```typescript
// Service: SalesReportService.generateSales()
async generateSales(salesReportId: string): Promise<string[]> {
  const report = await this.getById(salesReportId);

  if (report.Status !== 'validated') {
    throw new Error('Seuls les rapports validés peuvent générer des ventes');
  }

  const generatedSaleIds: string[] = [];

  // Créer une vente pour chaque ligne du rapport
  for (const line of report.Lines) {
    const sale = await saleService.create({
      customerId: report.PartnerId, // Le partenaire est le "client"
      customerName: report.PartnerName,
      items: [{
        productId: line.ProductId,
        productName: line.ProductName,
        quantity: line.QuantitySold,
        unitPrice: line.UnitPrice,
        totalPrice: line.TotalAmount,
      }],
      totalAmount: line.TotalAmount,
      paymentMethod: 'consignation', // Type spécial
      saleDate: report.ReportDate,
      reference: report.ReportNumber,
      workspaceId: report.WorkspaceId,
    });

    generatedSaleIds.push(sale.SaleId);
  }

  // Mettre à jour le dépôt avec les quantités vendues
  if (report.DepositId) {
    await depositService.updateSoldQuantities(
      report.DepositId,
      report.Lines.map(l => ({
        productId: l.ProductId,
        quantitySold: l.QuantitySold,
      }))
    );
  }

  // Marquer le rapport comme traité
  await this.updateStatus(salesReportId, 'processed', generatedSaleIds);

  return generatedSaleIds;
}
```

### 3. Intégration avec Module Trésorerie

#### Création de transaction lors du règlement

```typescript
// Service: SettlementService.pay()
async pay(settlementId: string, input: PaySettlementInput): Promise<Settlement> {
  const settlement = await this.getById(settlementId);

  // Créer la transaction de trésorerie (sortie d'argent)
  const transaction = await transactionService.create({
    type: 'expense',
    amount: input.amountPaid,
    currency: settlement.Currency,
    walletId: input.walletId,
    description: `Règlement consignation ${settlement.SettlementNumber} - ${settlement.PartnerName}`,
    reference: settlement.SettlementNumber,
    categoryId: 'consignation-settlement',
    date: new Date().toISOString(),
    workspaceId: settlement.WorkspaceId,
  });

  // Mettre à jour le règlement
  const updated = await this.update(settlementId, {
    amountPaid: settlement.AmountPaid + input.amountPaid,
    amountRemaining: settlement.AmountRemaining - input.amountPaid,
    status: settlement.AmountRemaining - input.amountPaid === 0 ? 'completed' : 'partial',
    paymentMethod: input.paymentMethod,
    paymentDate: new Date().toISOString(),
    transactionId: transaction.TransactionId,
    walletId: input.walletId,
    paidById: input.paidById,
  });

  // Mettre à jour le solde du partenaire
  await partnerService.updateBalance(settlement.PartnerId, -input.amountPaid);

  return updated;
}
```

---

## 📦 Services Backend à Implémenter

### 1. PartnerService

```typescript
class PartnerService {
  // CRUD
  async create(input: CreatePartnerInput): Promise<Partner>
  async getById(partnerId: string): Promise<Partner | null>
  async list(workspaceId: string, filters): Promise<Partner[]>
  async update(partnerId: string, updates): Promise<Partner>

  // Gestion statut
  async activate(partnerId: string): Promise<Partner>
  async suspend(partnerId: string, reason: string): Promise<Partner>

  // Financier
  async updateBalance(partnerId: string, amount: number): Promise<Partner>
  async getBalance(partnerId: string): Promise<number>

  // Statistiques
  async getStatistics(partnerId: string): Promise<PartnerStatistics>
  async getTopPartners(workspaceId: string, limit: number): Promise<Partner[]>
}
```

**Estimation**: ~300 lignes

### 2. DepositService

```typescript
class DepositService {
  // CRUD
  async create(input: CreateDepositInput): Promise<Deposit>
  async getById(depositId: string): Promise<Deposit | null>
  async list(workspaceId: string, filters): Promise<Deposit[]>
  async update(depositId: string, updates): Promise<Deposit>

  // Workflow
  async validate(depositId: string, validatorId: string): Promise<Deposit>
  async cancel(depositId: string, reason: string): Promise<Deposit>

  // Mise à jour quantités
  async updateSoldQuantities(depositId: string, sales: Array<{productId, quantitySold}>): Promise<Deposit>
  async updateReturnedQuantities(depositId: string, returns: Array<{productId, quantityReturned}>): Promise<Deposit>

  // Utilitaires
  async getActiveDeposits(partnerId: string): Promise<Deposit[]>
  async getOverdueDeposits(workspaceId: string): Promise<Deposit[]>
}
```

**Estimation**: ~400 lignes

### 3. SalesReportService

```typescript
class SalesReportService {
  // CRUD
  async create(input: CreateSalesReportInput): Promise<SalesReport>
  async getById(salesReportId: string): Promise<SalesReport | null>
  async list(workspaceId: string, filters): Promise<SalesReport[]>
  async update(salesReportId: string, updates): Promise<SalesReport>

  // Workflow
  async submit(salesReportId: string): Promise<SalesReport>
  async validate(salesReportId: string, validatorId: string): Promise<SalesReport>
  async reject(salesReportId: string, reason: string): Promise<SalesReport>

  // Génération de ventes
  async generateSales(salesReportId: string): Promise<string[]>

  // Calculs
  async calculateCommission(salesReportId: string): Promise<number>
  async getCommissionRate(partnerId: string): Promise<number>

  // Statistiques
  async getStatistics(workspaceId: string, dateRange): Promise<SalesReportStatistics>
}
```

**Estimation**: ~450 lignes

### 4. SettlementService

```typescript
class SettlementService {
  // CRUD
  async create(input: CreateSettlementInput): Promise<Settlement>
  async getById(settlementId: string): Promise<Settlement | null>
  async list(workspaceId: string, filters): Promise<Settlement[]>

  // Paiement
  async pay(settlementId: string, input: PaySettlementInput): Promise<Settlement>
  async partialPay(settlementId: string, amount: number, input): Promise<Settlement>

  // Annulation
  async cancel(settlementId: string, reason: string): Promise<Settlement>

  // Utilitaires
  async getPendingSettlements(workspaceId: string): Promise<Settlement[]>
  async getOverdueSettlements(workspaceId: string): Promise<Settlement[]>
  async calculateTotalDue(partnerId: string): Promise<number>
}
```

**Estimation**: ~350 lignes

### 5. ConsignationReturnService

```typescript
class ConsignationReturnService {
  // CRUD
  async create(input: CreateConsignationReturnInput): Promise<ConsignationReturn>
  async getById(returnId: string): Promise<ConsignationReturn | null>
  async list(workspaceId: string, filters): Promise<ConsignationReturn[]>

  // Traitement
  async process(returnId: string): Promise<ConsignationReturn>

  // Statistiques
  async getReturnRate(depositId: string): Promise<number>
  async getDamageRate(partnerId: string): Promise<number>
}
```

**Estimation**: ~250 lignes

**Total Services**: ~1750 lignes

---

## 🌐 API Routes à Créer

### Partenaires (7 routes)
- `GET /api/consignation/partners` - Liste
- `POST /api/consignation/partners` - Création
- `GET /api/consignation/partners/[id]` - Détail
- `PATCH /api/consignation/partners/[id]` - Modification
- `POST /api/consignation/partners/[id]/activate` - Activer
- `POST /api/consignation/partners/[id]/suspend` - Suspendre
- `GET /api/consignation/partners/[id]/statistics` - Statistiques

### Dépôts (8 routes)
- `GET /api/consignation/deposits` - Liste
- `POST /api/consignation/deposits` - Création
- `GET /api/consignation/deposits/[id]` - Détail
- `PATCH /api/consignation/deposits/[id]` - Modification
- `POST /api/consignation/deposits/[id]/validate` - Valider
- `POST /api/consignation/deposits/[id]/cancel` - Annuler
- `GET /api/consignation/deposits/active` - Dépôts actifs
- `GET /api/consignation/deposits/overdue` - Dépôts en retard

### Rapports de ventes (9 routes)
- `GET /api/consignation/sales-reports` - Liste
- `POST /api/consignation/sales-reports` - Création
- `GET /api/consignation/sales-reports/[id]` - Détail
- `PATCH /api/consignation/sales-reports/[id]` - Modification
- `POST /api/consignation/sales-reports/[id]/submit` - Soumettre
- `POST /api/consignation/sales-reports/[id]/validate` - Valider
- `POST /api/consignation/sales-reports/[id]/reject` - Rejeter
- `POST /api/consignation/sales-reports/[id]/generate-sales` - Générer ventes
- `GET /api/consignation/sales-reports/statistics` - Statistiques

### Règlements (7 routes)
- `GET /api/consignation/settlements` - Liste
- `POST /api/consignation/settlements` - Création
- `GET /api/consignation/settlements/[id]` - Détail
- `POST /api/consignation/settlements/[id]/pay` - Payer
- `POST /api/consignation/settlements/[id]/cancel` - Annuler
- `GET /api/consignation/settlements/pending` - En attente
- `GET /api/consignation/settlements/overdue` - En retard

### Retours (5 routes)
- `GET /api/consignation/returns` - Liste
- `POST /api/consignation/returns` - Création
- `GET /api/consignation/returns/[id]` - Détail
- `POST /api/consignation/returns/[id]/process` - Traiter
- `GET /api/consignation/returns/statistics` - Statistiques

**Total**: 36 routes API

---

## 🎨 Interfaces UI à Créer

### 1. Page Partenaires (`/consignation/partners`)
- Liste avec filtres (type, statut, région)
- KPIs: Total partenaires, Actifs, Solde total dû
- Actions: Créer, Voir détails, Suspendre

### 2. Détail Partenaire (`/consignation/partners/[id]`)
- Informations contrat
- Historique dépôts
- Rapports de ventes
- Règlements
- Solde actuel et historique
- Graphiques performance

### 3. Page Dépôts (`/consignation/deposits`)
- Liste avec statuts (validés, partiels, complétés)
- Filtres par partenaire, date, entrepôt
- KPIs: Total dépôts, Valeur totale, Taux retour
- Actions: Nouveau dépôt, Valider, Voir détails

### 4. Nouveau Dépôt (`/consignation/deposits/new`)
- Étape 1: Sélection partenaire
- Étape 2: Sélection entrepôt
- Étape 3: Ajout produits (quantités, prix)
- Étape 4: Révision et validation
- Génération bon de livraison PDF

### 5. Page Rapports de Ventes (`/consignation/sales-reports`)
- Liste avec statuts (soumis, validés, traités)
- Filtres par partenaire, période
- KPIs: Total ventes, Commissions, À payer
- Actions: Valider, Rejeter, Générer ventes

### 6. Page Règlements (`/consignation/settlements`)
- Liste des règlements (en attente, partiels, complétés)
- Filtres par partenaire, date
- KPIs: Total dû, Payé ce mois, En retard
- Actions: Créer règlement, Payer

### 7. Dashboard Consignation (`/consignation/dashboard`)
**Widgets**:
- Total partenaires actifs
- Dépôts en cours (valeur)
- Règlements en attente
- Top 5 partenaires (ventes)
- Graphique ventes par partenaire
- Graphique évolution consignations
- Alertes (retards, soldes élevés)

---

## 📊 KPIs et Métriques

### Globaux
1. **Nombre de partenaires actifs**
2. **Valeur totale des dépôts en cours**
3. **Total des ventes via consignation**
4. **Montant total dû aux partenaires**
5. **Taux de commission moyen**

### Par Partenaire
1. **Taux de vente** = QuantitySold / QuantityDeposited
2. **Taux de retour** = QuantityReturned / QuantityDeposited
3. **Délai moyen de règlement**
4. **Nombre de rapports soumis/mois**
5. **Taux de conformité** (rapports validés vs rejetés)

### Opérationnels
1. **Nombre de dépôts actifs**
2. **Nombre de règlements en attente**
3. **Montant des règlements en retard**
4. **Taux de rotation des stocks consignés**

---

## 📦 Tables Airtable Requises

### 1. Partner
- PartnerId, PartnerCode, Name, Type, Status
- ContactPerson, Phone, Email, Address, City, Region
- ContractStartDate, ContractEndDate, CommissionRate, PaymentTerms
- TotalDeposited, TotalSold, TotalReturned, CurrentBalance, Currency
- Notes, Tags, WorkspaceId, CreatedAt, UpdatedAt

### 2. Deposit
- DepositId, DepositNumber, PartnerId, PartnerName, PartnerType, Status
- TotalItems, TotalValue
- DepositDate, ExpectedReturnDate, ActualReturnDate
- PreparedById, PreparedByName, ValidatedById, ValidatedByName, ValidatedAt
- WarehouseId, WarehouseName
- Notes, DeliveryProof, WorkspaceId, CreatedAt, UpdatedAt

### 3. DepositLine
- DepositLineId, DepositId, ProductId, ProductName
- QuantityDeposited, QuantitySold, QuantityReturned, QuantityRemaining
- UnitPrice, TotalValue, Currency

### 4. SalesReport
- SalesReportId, ReportNumber, PartnerId, PartnerName, DepositId, DepositNumber, Status
- ReportDate, PeriodStart, PeriodEnd
- TotalSales, PartnerCommission, NetAmount, Currency
- SubmittedById, SubmittedAt, ValidatedById, ValidatedAt, RejectionReason
- SalesGenerated, GeneratedSaleIds
- Notes, Attachments, WorkspaceId, CreatedAt, UpdatedAt

### 5. SalesReportLine
- ReportLineId, SalesReportId, ProductId, ProductName
- QuantitySold, UnitPrice, TotalAmount, Currency

### 6. Settlement
- SettlementId, SettlementNumber, PartnerId, PartnerName, Status
- TotalDue, AmountPaid, AmountRemaining, Currency
- SalesReportIds
- PaymentMethod, PaymentDate, PaymentProof, WalletId, TransactionId
- PreparedById, PreparedByName, PaidById, PaidByName
- Notes, WorkspaceId, CreatedAt, UpdatedAt

### 7. ConsignationReturn
- ReturnId, ReturnNumber, DepositId, DepositNumber, PartnerId, PartnerName
- ReturnDate, ReceivedById, ReceivedByName
- WarehouseId, WarehouseName
- Notes, ReturnProof, WorkspaceId, CreatedAt, UpdatedAt

### 8. ConsignationReturnLine
- ProductId, ProductName, QuantityReturned, Condition, Notes

---

## 🔐 Permissions RBAC

Les permissions nécessaires (à ajouter):

```typescript
// Module 7.2 - Consignation
CONSIGNATION_VIEW: 'consignation:view',
CONSIGNATION_CREATE: 'consignation:create',
CONSIGNATION_EDIT: 'consignation:edit',
CONSIGNATION_DELETE: 'consignation:delete',
CONSIGNATION_VALIDATE: 'consignation:validate',
CONSIGNATION_PAY: 'consignation:pay',
```

### Matrice par rôle

| Rôle | VIEW | CREATE | EDIT | DELETE | VALIDATE | PAY |
|------|------|--------|------|--------|----------|-----|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Comptable | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| User | ✅ (limité) | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## ✅ Ce qui est implémenté

- ✅ **Types TypeScript complets** (235 lignes, 6 interfaces) dans `/types/modules.ts`
- ✅ **Architecture complète** définie et documentée
- ✅ **Workflows détaillés** pour chaque processus
- ✅ **Intégrations spécifiées** (Stock, Ventes, Trésorerie)
- ✅ **Calculs automatiques** documentés

---

## ⏳ Estimation d'Implémentation

| Composant | Lignes de code | Temps | Priorité |
|-----------|----------------|-------|----------|
| Types TypeScript | 235 lignes | ✅ Fait | Critique |
| PartnerService | ~300 lignes | 1.5 jours | Critique |
| DepositService | ~400 lignes | 2 jours | Critique |
| SalesReportService | ~450 lignes | 2 jours | Critique |
| SettlementService | ~350 lignes | 1.5 jours | Critique |
| ConsignationReturnService | ~250 lignes | 1 jour | Haute |
| API Routes (36) | ~1200 lignes | 3 jours | Critique |
| UI Pages (7) | ~2500 lignes | 6-8 jours | Haute |
| Tests | ~1000 lignes | 2 jours | Haute |
| **TOTAL** | **~6685 lignes** | **19-21 jours** | |

---

## 🎯 Impact sur le Modèle Économique

Ce module était identifié comme **CRITIQUE pour le modèle économique** car:

### Avant (sans Consignation):
```
❌ Impossible de travailler avec des partenaires en consignation
❌ Pas de suivi des stocks chez les tiers
❌ Pas de traçabilité des ventes partenaires
❌ Règlements manuels, risque d'erreurs
❌ Pas de commission automatique
```

### Après (avec Consignation):
```
✅ Réseau de distribution étendu (pharmacies, points relais)
✅ Suivi en temps réel des stocks consignés
✅ Génération automatique des ventes depuis les rapports
✅ Calcul automatique des commissions
✅ Règlements tracés et intégrés à la trésorerie
✅ Gestion complète des retours (bons/endommagés)
✅ KPIs pour évaluer la performance des partenaires
✅ Intégration transparente avec Stocks et Ventes
```

**Résultat**: Modèle économique **scalable** avec un réseau de distribution **géré efficacement**.

---

**Conclusion**: Le Module Consignation & Partenaires est **architecturalement complet** avec des types TypeScript robustes, des workflows détaillés et des intégrations bien définies. Ce module est essentiel pour permettre au système DDM de gérer un réseau de distribution via consignation, un modèle critique pour l'expansion géographique. 🚀
