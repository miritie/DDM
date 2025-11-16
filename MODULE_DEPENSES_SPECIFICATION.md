# Module 7.5 - Dépenses & Sollicitations - Spécification Complète

**Date**: 14 novembre 2024
**Statut**: Types TypeScript créés + Architecture définie (Backend prêt à implémenter)
**Criticité**: BLOQUANT pour gouvernance financière - EN COURS

---

## 📋 Vue d'ensemble

Le Module Dépenses & Sollicitations est critique pour la gouvernance financière. Il gère le workflow complet des demandes de dépenses, depuis la création jusqu'au paiement, avec un système d'approbation hiérarchique configurable.

### Objectifs du module

✅ **Sollicitations de dépenses** avec workflow de validation
✅ **Workflow d'approbation hiérarchique** multi-niveaux
✅ **Catégorisation** Fonctionnelles vs Structurelles
✅ **Gestion des preuves** (photos, reçus, factures)
✅ **Intégration avec la Trésorerie** pour les paiements
✅ **Seuils d'approbation configurables**
✅ **Traçabilité complète** du cycle de vie d'une dépense
✅ **Statistiques et rapports** détaillés

---

## 🏗️ Architecture - Types TypeScript (Implémentés)

### Interfaces créées dans `/types/modules.ts`

#### 1. ExpenseCategory & ExpenseSubcategory

```typescript
export type ExpenseCategory =
  | 'fonctionnelle' // Dépenses fonctionnelles (opérationnelles)
  | 'structurelle'; // Dépenses structurelles (investissements)

export type ExpenseSubcategory =
  // Fonctionnelles
  | 'salaire'
  | 'transport'
  | 'communication'
  | 'fourniture'
  | 'maintenance'
  | 'loyer'
  | 'electricite'
  | 'eau'
  | 'autres_charges'
  // Structurelles
  | 'equipement'
  | 'vehicule'
  | 'immobilier'
  | 'infrastructure'
  | 'logiciel'
  | 'formation'
  | 'autres_investissements';
```

#### 2. ExpenseRequestStatus

```typescript
export type ExpenseRequestStatus =
  | 'draft' // Brouillon
  | 'submitted' // Soumise
  | 'pending_approval' // En attente d'approbation
  | 'approved' // Approuvée
  | 'rejected' // Rejetée
  | 'paid' // Payée
  | 'cancelled'; // Annulée
```

#### 3. ExpenseProof (Preuves/Justificatifs)

```typescript
export interface ExpenseProof {
  ProofId: string;
  ExpenseRequestId: string;
  Type: 'receipt' | 'invoice' | 'photo' | 'document' | 'other';
  FileName: string;
  FileUrl: string; // URL stockage (S3, Cloudinary, etc.)
  FileSize: number; // bytes
  MimeType: string;
  Description?: string;
  UploadedAt: string;
  UploadedBy: string;
}
```

**Usage**: Chaque demande de dépense peut avoir plusieurs preuves attachées (reçus, factures, photos). Les preuves sont requises pour les montants au-dessus d'un certain seuil.

#### 4. ExpenseApproval (Approbations)

```typescript
export interface ExpenseApproval {
  ApprovalId: string;
  ExpenseRequestId: string;
  ApproverId: string;
  ApproverName: string;
  ApproverRole: string;
  Status: 'pending' | 'approved' | 'rejected';
  Decision?: 'approved' | 'rejected';
  Comments?: string;
  DecisionDate?: string;
  Level: number; // Niveau d'approbation (1, 2, 3...)
  AmountLimit?: number; // Limite du seuil pour cet approbateur
  CreatedAt: string;
}
```

**Workflow**: Une demande peut nécessiter plusieurs niveaux d'approbation selon le montant:
- Niveau 1 (< 50,000): Manager
- Niveau 2 (50,000-500,000): Directeur
- Niveau 3 (> 500,000): DG

#### 5. ExpenseRequest (Demande de dépense)

```typescript
export interface ExpenseRequest {
  ExpenseRequestId: string;
  RequestNumber: string; // DEP-202511-0001
  Title: string;
  Description: string;
  Category: ExpenseCategory;
  Subcategory: ExpenseSubcategory;
  Amount: number;
  Currency: string;
  Urgency: ExpenseUrgency; // 'low' | 'normal' | 'high' | 'urgent'
  Status: ExpenseRequestStatus;

  // Demandeur
  RequesterId: string;
  RequesterName: string;
  RequesterRole?: string;

  // Bénéficiaire (peut être différent du demandeur)
  BeneficiaryId?: string;
  BeneficiaryName?: string;
  BeneficiaryType?: 'employee' | 'supplier' | 'other';

  // Dates
  RequestDate: string;
  NeededByDate?: string; // Date à laquelle la dépense est nécessaire
  ApprovedDate?: string;
  PaidDate?: string;

  // Approbations
  Approvals: ExpenseApproval[];
  CurrentApprovalLevel: number;
  RequiredApprovalLevels: number;

  // Preuves
  Proofs: ExpenseProof[];

  // Paiement
  PaymentMethod?: 'cash' | 'bank_transfer' | 'mobile_money' | 'check';
  WalletId?: string; // Wallet utilisé pour le paiement
  WalletName?: string;
  TransactionId?: string; // ID de la transaction de trésorerie

  // Justifications
  Justification?: string;
  RejectionReason?: string;

  // Récurrence
  IsRecurring: boolean;
  RecurrenceFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  RecurrenceEndDate?: string;

  // Métadonnées
  Tags?: string[];
  Reference?: string; // Référence externe (bon de commande, etc.)
  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

#### 6. ExpenseCategoryConfig (Configuration des catégories)

```typescript
export interface ExpenseCategoryConfig {
  CategoryConfigId: string;
  Name: string;
  Category: ExpenseCategory;
  Subcategory: ExpenseSubcategory;
  Description?: string;

  // Seuils d'approbation
  ApprovalThresholds: Array<{
    level: number;
    minAmount: number;
    maxAmount: number;
    approverRoles: string[]; // Rôles autorisés à approuver à ce niveau
    requiresProof: boolean;
  }>;

  // Configuration
  RequiresProof: boolean;
  AllowRecurring: boolean;
  DefaultUrgency: ExpenseUrgency;
  MaxAmount?: number; // Montant maximum autorisé

  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

---

## 🔄 Workflow Complet des Dépenses

### Machine à états

```
                    ┌──────────┐
                    │  DRAFT   │
                    └─────┬────┘
                          │ submit()
                          ▼
                   ┌─────────────┐
                   │  SUBMITTED  │
                   └──────┬──────┘
                          │ approve() level 1
                          ▼
              ┌───────────────────────┐
              │  PENDING_APPROVAL     │
              └───────┬───────────────┘
                      │ approve() level 2, 3...
                      ▼
        ┌────────────────────────────────┐
        │         APPROVED                │
        └────────────┬───────────────────┘
                     │ pay()
                     ▼
             ┌──────────────┐
             │     PAID      │
             └───────────────┘

       À tout moment (sauf paid):
       reject() → REJECTED
       cancel() → CANCELLED
```

### Transitions autorisées

```typescript
draft → submitted | cancelled
submitted → pending_approval | rejected | cancelled
pending_approval → approved | rejected | cancelled
approved → paid
paid → [fin - immuable]
rejected → [fin - peut être recréée en draft]
cancelled → [fin]
```

---

## 🎯 Fonctionnalités Clés

### 1. Création et Soumission

**Acteurs**: Tous les employés
**Flux**:
1. Créer une demande en mode `draft`
2. Ajouter des détails (titre, description, montant, catégorie)
3. Attacher des preuves si nécessaire
4. Soumettre pour approbation

**Validations**:
- Montant > 0
- Catégorie valide
- Au moins une preuve si montant > 50,000
- Justification obligatoire selon la catégorie

### 2. Workflow d'Approbation Multi-Niveaux

**Basé sur des seuils configurables**:

| Montant (XOF) | Niveau | Approbateur | Délai suggéré |
|---------------|--------|-------------|---------------|
| 0 - 50,000 | 1 | Manager direct | 24h |
| 50,001 - 500,000 | 2 | Directeur | 48h |
| 500,001+ | 3 | DG | 72h |

**Fonctionnalités**:
- Validation séquentielle (niveau par niveau)
- Notification automatique au prochain approbateur
- Commentaires obligatoires en cas de rejet
- Historique complet des approbations

### 3. Gestion des Preuves

**Types de preuves supportées**:
- 📄 Factures (PDF, images)
- 🧾 Reçus (photos, scans)
- 📸 Photos (produits, événements)
- 📎 Documents divers

**Fonctionnalités**:
- Upload multiple
- Prévisualisation
- Métadonnées (taille, type, date)
- Suppression (uniquement en draft)

### 4. Catégorisation

#### Dépenses Fonctionnelles (Opérationnelles)
- Salaires et charges sociales
- Transport et déplacements
- Communication (téléphone, internet)
- Fournitures de bureau
- Maintenance et réparations
- Loyer et charges locatives
- Électricité, eau, services publics
- Autres charges courantes

#### Dépenses Structurelles (Investissements)
- Équipements (machines, outils)
- Véhicules
- Immobilier
- Infrastructure (bâtiments, installations)
- Logiciels et licences
- Formation et développement
- Autres investissements

### 5. Intégration avec la Trésorerie

**Lorsqu'une dépense approuvée est payée**:

```typescript
// 1. Marquer la demande comme payée
await expenseRequestService.pay(requestId, {
  walletId: 'wallet-123',
  walletName: 'Caisse Principale',
  paymentMethod: 'cash',
  paidById: 'user-456',
  paidByName: 'Comptable',
});

// 2. Créer automatiquement une transaction de trésorerie
await transactionService.create({
  type: 'expense',
  amount: request.Amount,
  currency: request.Currency,
  walletId: request.WalletId,
  description: `Paiement ${request.RequestNumber}: ${request.Title}`,
  reference: request.RequestNumber,
  categoryId: request.CategoryId,
  date: new Date().toISOString(),
  workspaceId: request.WorkspaceId,
});

// 3. Le wallet est automatiquement débité
```

**Traçabilité**:
- Chaque paiement crée une transaction de trésorerie
- Lien bidirectionnel: ExpenseRequest ↔ Transaction
- Réconciliation automatique possible

### 6. Dépenses Récurrentes

**Use cases**:
- Salaires mensuels
- Loyers
- Abonnements (électricité, internet)
- Charges fixes

**Fonctionnement**:
```typescript
{
  IsRecurring: true,
  RecurrenceFrequency: 'monthly',
  RecurrenceEndDate: '2025-12-31'
}
```

Le système peut générer automatiquement les demandes récurrentes.

---

## 📊 Statistiques et Rapports

### Métriques calculées automatiquement

```typescript
{
  totalRequests: number,
  byStatus: {
    draft: number,
    submitted: number,
    pending_approval: number,
    approved: number,
    rejected: number,
    paid: number,
    cancelled: number
  },
  byCategory: {
    fonctionnelle: number,
    structurelle: number
  },
  totalAmount: number,
  totalApproved: number,
  totalPaid: number,
  averageAmount: number,
  averageApprovalTime: number // en heures
}
```

### Rapports disponibles

1. **Rapport par catégorie**: Répartition fonctionnelles vs structurelles
2. **Rapport par période**: Évolution mensuelle/trimestrielle
3. **Rapport par bénéficiaire**: Top dépenses par personne/fournisseur
4. **Rapport de conformité**: Temps d'approbation, taux de rejet
5. **Budget vs Réalisé**: Suivi budgétaire par catégorie

---

## 🔐 Permissions RBAC

Les permissions suivantes existent déjà dans le système:

```typescript
EXPENSE_VIEW: 'expense:view',
EXPENSE_CREATE: 'expense:create',
EXPENSE_EDIT: 'expense:edit',
EXPENSE_DELETE: 'expense:delete',
EXPENSE_APPROVE: 'expense:approve',
EXPENSE_PAY: 'expense:pay',
```

### Matrice de permissions par rôle

| Rôle | VIEW | CREATE | EDIT | DELETE | APPROVE | PAY |
|------|------|--------|------|--------|---------|-----|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manager** | ✅ | ✅ | ✅ | ❌ | ✅ (niveau 1) | ❌ |
| **Comptable** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **User** | ✅ (ses demandes) | ✅ | ✅ (draft) | ❌ | ❌ | ❌ |

---

## 📦 Tables Airtable Requises

### 1. ExpenseRequest

**Champs principaux**:
- ExpenseRequestId (UUID)
- RequestNumber (DEP-YYYYMM-0001)
- Title, Description
- Category, Subcategory
- Amount, Currency
- Status, Urgency
- RequesterId, RequesterName, RequesterRole
- BeneficiaryId, BeneficiaryName, BeneficiaryType
- RequestDate, NeededByDate, ApprovedDate, PaidDate
- CurrentApprovalLevel, RequiredApprovalLevels
- WalletId, WalletName, PaymentMethod, TransactionId
- Justification, RejectionReason
- IsRecurring, RecurrenceFrequency, RecurrenceEndDate
- Tags (JSON array), Reference, Notes
- WorkspaceId, CreatedAt, UpdatedAt

### 2. ExpenseApproval

**Champs**:
- ApprovalId (UUID)
- ExpenseRequestId (lien vers ExpenseRequest)
- ApproverId, ApproverName, ApproverRole
- Status ('pending' | 'approved' | 'rejected')
- Decision, Comments
- DecisionDate, Level, AmountLimit
- CreatedAt

### 3. ExpenseProof

**Champs**:
- ProofId (UUID)
- ExpenseRequestId (lien vers ExpenseRequest)
- Type ('receipt' | 'invoice' | 'photo' | 'document' | 'other')
- FileName, FileUrl, FileSize, MimeType
- Description
- UploadedAt, UploadedBy

### 4. ExpenseCategoryConfig

**Champs**:
- CategoryConfigId (UUID)
- Name, Category, Subcategory, Description
- ApprovalThresholds (JSON array)
- RequiresProof, AllowRecurring
- DefaultUrgency, MaxAmount
- IsActive, WorkspaceId
- CreatedAt, UpdatedAt

---

## 🚀 Services Backend à Implémenter

### 1. ExpenseRequestService

**Méthodes clés**:
```typescript
class ExpenseRequestService {
  // CRUD de base
  async create(input: CreateExpenseRequestInput): Promise<ExpenseRequest>
  async getById(expenseRequestId: string): Promise<ExpenseRequest | null>
  async list(workspaceId: string, filters): Promise<ExpenseRequest[]>
  async update(expenseRequestId: string, updates): Promise<ExpenseRequest>

  // Workflow
  async submit(expenseRequestId: string, input): Promise<ExpenseRequest>
  async approve(expenseRequestId: string, input): Promise<ExpenseRequest>
  async reject(expenseRequestId: string, input): Promise<ExpenseRequest>
  async cancel(expenseRequestId: string, reason): Promise<ExpenseRequest>

  // Paiement
  async pay(expenseRequestId: string, input): Promise<ExpenseRequest>

  // Preuves
  async addProof(expenseRequestId: string, proof): Promise<ExpenseProof>
  async deleteProof(proofId: string): Promise<void>

  // Utilitaires
  async getPendingApprovals(workspaceId, userId, userRole): Promise<ExpenseRequest[]>
  async getStatistics(workspaceId, dateRange): Promise<Statistics>
}
```

**Complexité estimée**: ~600 lignes

### 2. ExpenseCategoryConfigService

**Méthodes clés**:
```typescript
class ExpenseCategoryConfigService {
  async list(workspaceId: string): Promise<ExpenseCategoryConfig[]>
  async getById(categoryConfigId: string): Promise<ExpenseCategoryConfig | null>
  async create(input): Promise<ExpenseCategoryConfig>
  async update(categoryConfigId: string, updates): Promise<ExpenseCategoryConfig>
  async delete(categoryConfigId: string): Promise<void>

  // Utilitaires
  async getApprovalThresholds(category, subcategory, amount): Promise<ApprovalThreshold[]>
}
```

**Complexité estimée**: ~200 lignes

---

## 🌐 API Routes à Créer

### Demandes de dépenses

**Routes principales**:
- `GET /api/expenses/requests` - Liste avec filtres
- `POST /api/expenses/requests` - Création
- `GET /api/expenses/requests/[id]` - Détail
- `PATCH /api/expenses/requests/[id]` - Modification
- `POST /api/expenses/requests/[id]/submit` - Soumettre
- `POST /api/expenses/requests/[id]/approve` - Approuver
- `POST /api/expenses/requests/[id]/reject` - Rejeter
- `POST /api/expenses/requests/[id]/pay` - Payer
- `POST /api/expenses/requests/[id]/cancel` - Annuler
- `GET /api/expenses/requests/pending-approvals` - Mes approbations en attente
- `GET /api/expenses/requests/statistics` - Statistiques

**Routes preuves**:
- `POST /api/expenses/requests/[id]/proofs` - Ajouter une preuve
- `DELETE /api/expenses/proofs/[proofId]` - Supprimer une preuve

### Configuration des catégories

**Routes**:
- `GET /api/expenses/categories` - Liste
- `POST /api/expenses/categories` - Création
- `GET /api/expenses/categories/[id]` - Détail
- `PATCH /api/expenses/categories/[id]` - Modification
- `DELETE /api/expenses/categories/[id]` - Suppression

**Total**: ~15 routes API

---

## 🎨 Interfaces UI à Créer

### 1. Page Liste des Demandes (`/expenses/requests`)

**Fonctionnalités**:
- Tableau avec filtres (statut, catégorie, période, montant)
- Badges de statut colorés
- Indicateurs d'urgence
- Actions rapides (voir, approuver, rejeter)
- Recherche par numéro ou titre
- Export Excel/PDF

### 2. Page Détail d'une Demande (`/expenses/requests/[id]`)

**Sections**:
- Informations générales (titre, montant, catégorie)
- Demandeur et bénéficiaire
- Timeline d'approbation (avec avatars)
- Preuves attachées (avec aperçu)
- Actions disponibles (selon rôle et statut)
- Historique des modifications

### 3. Formulaire de Nouvelle Demande (`/expenses/requests/new`)

**Étapes**:
1. Informations de base
2. Détails et justification
3. Preuves (upload)
4. Révision et soumission

### 4. Page Mes Approbations (`/expenses/approvals`)

**Vue centralisée** des demandes en attente d'approbation:
- Filtrée par niveau d'approbation de l'utilisateur
- Tri par urgence et date
- Actions rapides (approuver/rejeter avec commentaire)
- Notifications en temps réel

### 5. Dashboard Dépenses (`/expenses/dashboard`)

**Widgets**:
- Total dépenses par période
- Graphique fonctionnelles vs structurelles
- Temps moyen d'approbation
- Top catégories
- Alertes (demandes urgentes, retards)
- Budget vs Réalisé

---

## 🔗 Intégrations

### 1. Module Trésorerie

**Flux de paiement**:
```
ExpenseRequest (approved) → pay() → Transaction (expense) → Wallet (débit)
```

**Code d'intégration**:
```typescript
// Dans ExpenseRequestService.pay()
import { TransactionService } from '../treasury/transaction-service';

const transactionService = new TransactionService();

async pay(expenseRequestId: string, input: PayExpenseRequestInput): Promise<ExpenseRequest> {
  // ... validation ...

  // Créer la transaction de trésorerie
  const transaction = await transactionService.create({
    type: 'expense',
    amount: request.Amount,
    currency: request.Currency,
    walletId: input.walletId,
    description: `Paiement ${request.RequestNumber}: ${request.Title}`,
    reference: request.RequestNumber,
    categoryId: request.Subcategory,
    date: new Date().toISOString(),
    workspaceId: request.WorkspaceId,
  });

  // Mettre à jour la demande avec le lien vers la transaction
  const updated = await airtableClient.update<ExpenseRequest>('ExpenseRequest', recordId, {
    Status: 'paid',
    TransactionId: transaction.TransactionId,
    WalletId: input.walletId,
    WalletName: input.walletName,
    PaymentMethod: input.paymentMethod,
    PaidDate: new Date().toISOString(),
  });

  return updated;
}
```

### 2. Module Notifications

**Notifications automatiques**:
- Demande soumise → Notifier le 1er approbateur
- Demande approuvée niveau N → Notifier le N+1 approbateur
- Demande approuvée finale → Notifier le comptable pour paiement
- Demande rejetée → Notifier le demandeur
- Demande payée → Notifier le demandeur et le bénéficiaire

**Canaux**:
- Email (toujours)
- SMS (si urgence = 'urgent')
- WhatsApp (optionnel, si configuré)
- Push notifications (PWA)

### 3. Module Comptabilité

**Lien avec les écritures comptables**:
- Chaque ExpenseRequest payée → Journal de dépenses
- Catégorisation automatique selon Plan Comptable
- Réconciliation bancaire facilitée via TransactionId

---

## 📈 Indicateurs de Performance (KPIs)

### Opérationnels

1. **Temps moyen d'approbation**: < 48h pour 90% des demandes
2. **Taux de rejet**: < 10%
3. **Taux de conformité** (preuves jointes): > 95%
4. **Délai de paiement** (après approbation): < 72h

### Financiers

1. **Total dépenses fonctionnelles** par mois
2. **Total dépenses structurelles** par mois
3. **Écart budget vs réalisé** par catégorie
4. **Top 10 postes de dépenses**

### Gouvernance

1. **% demandes avec justification**
2. **% demandes avec preuves complètes**
3. **Nombre de niveaux d'approbation moyens**
4. **Audit trail complet** (100% des demandes)

---

## ✅ Ce qui est implémenté

- ✅ **Types TypeScript complets** (4 interfaces + 3 types) dans `/types/modules.ts`
- ✅ **Architecture définie** et documentée
- ✅ **Workflow d'approbation** spécifié
- ✅ **Intégrations** planifiées (Trésorerie, Notifications)
- ✅ **Permissions RBAC** déjà existantes

---

## ⏳ Prochaines étapes d'implémentation

### Phase 1: Services Backend (3-4 jours)
1. Créer `ExpenseRequestService` (~600 lignes)
2. Créer `ExpenseCategoryConfigService` (~200 lignes)
3. Tests unitaires des workflows

### Phase 2: API Routes (2 jours)
1. Routes demandes de dépenses (11 routes)
2. Routes configuration catégories (5 routes)
3. Tests d'intégration

### Phase 3: Intégration Trésorerie (1 jour)
1. Lien ExpenseRequest → Transaction
2. Paiement automatique avec débit wallet
3. Tests du flux complet

### Phase 4: UI Frontend (5-7 jours)
1. Page liste des demandes
2. Formulaire création/édition
3. Page détail avec timeline
4. Page mes approbations
5. Dashboard dépenses

### Phase 5: Notifications (2 jours)
1. Email automatiques
2. SMS pour urgences
3. Push notifications

---

## 🎯 Impact sur la Gouvernance

Ce module était identifié comme **BLOQUANT pour la gouvernance** car:

### Avant (sans Dépenses & Sollicitations):
```
❌ Aucune traçabilité des dépenses
❌ Pas de workflow de validation formel
❌ Impossible de réconcilier trésorerie vs dépenses réelles
❌ Risques de fraude élevés
❌ Pas de contrôle budgétaire
```

### Après (avec Dépenses & Sollicitations):
```
✅ Traçabilité complète: qui demande, qui approuve, qui paie
✅ Workflow configurable avec seuils d'approbation
✅ Réconciliation automatique: ExpenseRequest ↔ Transaction ↔ Wallet
✅ Audit trail complet avec preuves obligatoires
✅ Contrôle budgétaire par catégorie
✅ Alertes et notifications automatiques
✅ Séparation des responsabilités (Demande ≠ Approbation ≠ Paiement)
```

**Résultat**: Gouvernance financière renforcée avec **contrôles et contrepoids** (checks and balances).

---

## 📊 Estimation Globale

| Composant | Lignes de code | Temps | Priorité |
|-----------|----------------|-------|----------|
| Types TypeScript | 156 lignes | ✅ Fait | Critique |
| ExpenseRequestService | ~600 lignes | 2 jours | Critique |
| ExpenseCategoryConfigService | ~200 lignes | 1 jour | Haute |
| API Routes (15) | ~500 lignes | 2 jours | Critique |
| Intégration Trésorerie | ~150 lignes | 1 jour | Critique |
| UI Pages (5) | ~2000 lignes | 5-7 jours | Haute |
| Tests | ~800 lignes | 2 jours | Haute |
| **TOTAL** | **~4400 lignes** | **13-15 jours** | |

---

## 🔥 Points Critiques

### Sécurité

1. **Séparation des privilèges**: Demandeur ≠ Approbateur ≠ Payeur
2. **Validation des montants**: Seuils stricts, pas de contournement
3. **Audit trail immuable**: Toutes les actions tracées
4. **Upload sécurisé**: Validation type MIME, taille max, scan antivirus

### Performance

1. **Pagination**: Liste des demandes (limite 50 par page)
2. **Cache**: Configuration des catégories (rarement modifiée)
3. **Indexation**: RequestNumber, Status, RequesterId, RequestDate
4. **Lazy loading**: Preuves chargées à la demande

### UX

1. **Indicateurs visuels**: Statuts colorés, icônes d'urgence
2. **Actions rapides**: Boutons contextuels selon statut
3. **Formulaire guidé**: Étapes claires, validation en temps réel
4. **Notifications**: Informer proactivement les parties prenantes

---

**Conclusion**: Le Module Dépenses & Sollicitations est **architecturellement complet** avec des types TypeScript robustes et une spécification détaillée. L'implémentation backend peut commencer immédiatement en suivant cette documentation. Ce module est essentiel pour débloquer la gouvernance financière du système DDM. 🚀
