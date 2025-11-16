# Module 7.8 - Clients & Fidélité
## Spécification Technique Complète

---

## 1. Vue d'ensemble

### 1.1 Objectif du module
Le module **Clients & Fidélité** gère l'ensemble du cycle de vie client, de l'acquisition à la rétention, en passant par un système de fidélité sophistiqué avec points, récompenses, tiers et segmentation marketing.

### 1.2 Priorité
**HAUTE** - Module essentiel pour la relation client et l'augmentation du panier moyen

### 1.3 Dépendances
- **Module 7.3 - Ventes & Clients** : Calcul automatique des points sur ventes
- **Module 7.1 - Trésorerie** : Cashback et récompenses
- **Airtable** : Stockage et gestion des données
- **Email/SMS** : Notifications et promotions

### 1.4 État actuel
- **Backend** : 0%
- **Frontend** : 0%
- **Documentation** : En cours

---

## 2. Architecture des données

### 2.1 Modèle de données complet

```typescript
// Types de statuts et enums
export type CustomerType = 'individual' | 'business';
export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'vip';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type RewardType = 'discount' | 'free_product' | 'cashback' | 'points_multiplier' | 'special_offer';
export type RewardStatus = 'available' | 'redeemed' | 'expired' | 'cancelled';

// Interfaces principales
export interface Customer {
  CustomerId: string;
  CustomerCode: string; // CUS-0001
  Type: CustomerType;
  Status: CustomerStatus;

  // Informations individuelles
  FirstName?: string;
  LastName?: string;
  FullName: string;

  // Informations entreprise
  CompanyName?: string;
  CompanyRegistration?: string;
  TaxNumber?: string;

  // Contact
  Phone: string;
  Email?: string;
  Address?: string;
  City?: string;
  Region?: string;
  Country?: string;

  // Fidélité
  LoyaltyTier: LoyaltyTier;
  LoyaltyPoints: number;
  TotalPointsEarned: number;
  TotalPointsRedeemed: number;
  MemberSince: string;
  LastVisit?: string;

  // Statistiques
  TotalOrders: number;
  TotalSpent: number;
  AverageOrderValue: number;
  LastOrderDate?: string;
  LastOrderAmount?: number;

  // Préférences
  PreferredPaymentMethod?: string;
  PreferredLanguage?: string;
  ReceivePromotions: boolean;
  ReceiveSMS: boolean;
  ReceiveEmail: boolean;

  // Commercial
  AssignedSalesAgentId?: string;
  AssignedSalesAgentName?: string;

  // Métadonnées
  Tags?: string[];
  Notes?: string;
  PhotoUrl?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface LoyaltyTransaction {
  TransactionId: string;
  CustomerId: string;
  CustomerName: string;
  Type: 'earn' | 'redeem' | 'adjustment' | 'expiration';

  Points: number; // Positif pour earn, négatif pour redeem
  BalanceBefore: number;
  BalanceAfter: number;

  // Référence
  ReferenceId?: string;
  ReferenceType?: 'sale' | 'reward' | 'manual' | 'promotion';
  ReferenceNumber?: string;

  Description: string;
  ProcessedById?: string;
  ProcessedByName?: string;

  ExpirationDate?: string;

  WorkspaceId: string;
  CreatedAt: string;
}

export interface LoyaltyReward {
  RewardId: string;
  RewardCode: string; // REW-001
  Name: string;
  Description: string;
  Type: RewardType;
  Status: 'active' | 'inactive' | 'out_of_stock';

  // Coût en points
  PointsCost: number;

  // Valeur de la récompense
  DiscountPercentage?: number;
  DiscountAmount?: number;
  FreeProductId?: string;
  FreeProductName?: string;
  CashbackAmount?: number;
  PointsMultiplier?: number; // ex: 2x points

  // Restrictions
  MinimumTier?: LoyaltyTier;
  MinimumPurchase?: number;
  ValidFrom?: string;
  ValidUntil?: string;
  MaxRedemptionsPerCustomer?: number;
  TotalAvailable?: number;
  TotalRedeemed: number;

  // Conditions
  ApplicableProducts?: string[]; // ProductIds
  ApplicableCategories?: string[]; // CategoryIds
  ExcludedProducts?: string[];

  ImageUrl?: string;
  Terms?: string;

  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CustomerReward {
  CustomerRewardId: string;
  CustomerId: string;
  CustomerName: string;
  RewardId: string;
  RewardName: string;
  RewardType: RewardType;
  Status: RewardStatus;

  PointsSpent: number;

  // Valeur
  DiscountPercentage?: number;
  DiscountAmount?: number;
  CashbackAmount?: number;

  RedeemedAt: string;
  RedeemedById?: string;
  RedeemedByName?: string;

  // Utilisation
  UsedAt?: string;
  UsedInSaleId?: string;
  UsedInSaleNumber?: string;

  ExpiresAt?: string;
  CancelledAt?: string;
  CancellationReason?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface LoyaltyTierConfig {
  TierConfigId: string;
  Tier: LoyaltyTier;
  Name: string;
  Description?: string;

  // Conditions d'accès
  MinimumPoints?: number;
  MinimumSpent?: number;
  MinimumOrders?: number;

  // Avantages
  PointsEarnRate: number; // Pourcentage de cashback en points (ex: 5%)
  DiscountPercentage?: number; // Remise automatique (ex: 5%)
  BirthdayBonus?: number; // Points bonus anniversaire
  WelcomeBonus?: number; // Points bonus à l'obtention du tier

  // Privilèges
  FreeShipping: boolean;
  PrioritySupport: boolean;
  ExclusiveProducts: boolean;
  EarlyAccessSales: boolean;

  Color?: string; // Couleur d'affichage
  IconUrl?: string;
  BadgeUrl?: string;

  Order: number; // Ordre d'affichage (1=bronze, 5=diamond)
  IsActive: boolean;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CustomerSegment {
  SegmentId: string;
  Name: string;
  Description?: string;

  // Critères de segmentation
  Criteria: {
    minTotalSpent?: number;
    maxTotalSpent?: number;
    minOrders?: number;
    maxOrders?: number;
    minAverageOrderValue?: number;
    maxAverageOrderValue?: number;
    loyaltyTiers?: LoyaltyTier[];
    tags?: string[];
    cities?: string[];
    lastOrderDaysAgo?: number; // Ex: 30 (clients n'ayant pas commandé depuis 30j)
    memberSinceDaysAgo?: number;
  };

  // Statistiques
  CustomerCount: number;
  TotalRevenue: number;
  LastCalculatedAt?: string;

  // Métadonnées
  Color?: string;
  IsActive: boolean;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CustomerInteraction {
  InteractionId: string;
  CustomerId: string;
  CustomerName: string;
  Type: 'call' | 'email' | 'sms' | 'visit' | 'complaint' | 'feedback' | 'note';

  Subject?: string;
  Description: string;
  Sentiment?: 'positive' | 'neutral' | 'negative';

  InteractionDate: string;
  Duration?: number; // minutes

  EmployeeId?: string;
  EmployeeName?: string;

  // Suivi
  FollowUpRequired: boolean;
  FollowUpDate?: string;
  FollowUpDone: boolean;

  Attachments?: string[];
  Tags?: string[];

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface CustomerFeedback {
  FeedbackId: string;
  CustomerId: string;
  CustomerName: string;

  // Évaluation
  Rating: number; // 1-5
  ProductRating?: number;
  ServiceRating?: number;
  DeliveryRating?: number;

  // Commentaire
  Comment?: string;
  Sentiment?: 'positive' | 'neutral' | 'negative';

  // Référence
  SaleId?: string;
  SaleNumber?: string;
  ProductId?: string;
  ProductName?: string;

  // Réponse
  Response?: string;
  RespondedById?: string;
  RespondedByName?: string;
  RespondedAt?: string;

  IsPublic: boolean;
  IsVerified: boolean;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

### 2.2 Tables Airtable

#### Table: Customer
| Champ | Type | Description |
|-------|------|-------------|
| CustomerId | Single line text (Primary) | Identifiant unique UUID |
| CustomerCode | Single line text | Code client (CUS-0001) |
| Type | Single select | individual, business |
| Status | Single select | active, inactive, suspended, vip |
| FirstName | Single line text | Prénom |
| LastName | Single line text | Nom |
| FullName | Formula | Individual: `{FirstName} & " " & {LastName}`, Business: `{CompanyName}` |
| CompanyName | Single line text | Nom entreprise |
| CompanyRegistration | Single line text | Numéro d'enregistrement |
| TaxNumber | Single line text | Numéro fiscal |
| Phone | Phone number | Téléphone |
| Email | Email | Email |
| Address | Long text | Adresse |
| City | Single line text | Ville |
| Region | Single line text | Région |
| Country | Single line text | Pays |
| LoyaltyTier | Single select | bronze, silver, gold, platinum, diamond |
| LoyaltyPoints | Number | Points actuels |
| TotalPointsEarned | Number | Total points gagnés |
| TotalPointsRedeemed | Number | Total points utilisés |
| MemberSince | Date | Date d'inscription |
| LastVisit | Date | Dernière visite |
| TotalOrders | Number | Nombre commandes |
| TotalSpent | Currency | Total dépensé |
| AverageOrderValue | Currency | Panier moyen |
| LastOrderDate | Date | Date dernière commande |
| LastOrderAmount | Currency | Montant dernière commande |
| PreferredPaymentMethod | Single select | cash, mobile_money, bank_transfer, check |
| PreferredLanguage | Single select | fr, en, etc. |
| ReceivePromotions | Checkbox | Accepte promotions |
| ReceiveSMS | Checkbox | Accepte SMS |
| ReceiveEmail | Checkbox | Accepte emails |
| AssignedSalesAgentId | Single line text | ID commercial assigné |
| AssignedSalesAgentName | Single line text | Nom commercial |
| Tags | Multiple select | Tags |
| Notes | Long text | Notes |
| PhotoUrl | URL | Photo client |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: LoyaltyTransaction
| Champ | Type | Description |
|-------|------|-------------|
| TransactionId | Single line text (Primary) | Identifiant unique UUID |
| CustomerId | Single line text | ID client |
| CustomerName | Single line text | Nom client |
| Type | Single select | earn, redeem, adjustment, expiration |
| Points | Number | Points (+/-) |
| BalanceBefore | Number | Solde avant |
| BalanceAfter | Number | Solde après |
| ReferenceId | Single line text | ID référence |
| ReferenceType | Single select | sale, reward, manual, promotion |
| ReferenceNumber | Single line text | Numéro référence |
| Description | Long text | Description |
| ProcessedById | Single line text | ID processeur |
| ProcessedByName | Single line text | Nom processeur |
| ExpirationDate | Date | Date expiration |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |

#### Table: LoyaltyReward
| Champ | Type | Description |
|-------|------|-------------|
| RewardId | Single line text (Primary) | Identifiant unique UUID |
| RewardCode | Single line text | Code récompense (REW-001) |
| Name | Single line text | Nom |
| Description | Long text | Description |
| Type | Single select | discount, free_product, cashback, points_multiplier, special_offer |
| Status | Single select | active, inactive, out_of_stock |
| PointsCost | Number | Coût en points |
| DiscountPercentage | Number | Remise (%) |
| DiscountAmount | Currency | Remise fixe |
| FreeProductId | Single line text | ID produit gratuit |
| FreeProductName | Single line text | Nom produit |
| CashbackAmount | Currency | Cashback |
| PointsMultiplier | Number | Multiplicateur points |
| MinimumTier | Single select | Tier minimum |
| MinimumPurchase | Currency | Achat minimum |
| ValidFrom | Date | Début validité |
| ValidUntil | Date | Fin validité |
| MaxRedemptionsPerCustomer | Number | Max par client |
| TotalAvailable | Number | Total disponible |
| TotalRedeemed | Number | Total utilisé |
| ApplicableProducts | Long text (JSON) | Produits applicables |
| ApplicableCategories | Long text (JSON) | Catégories applicables |
| ExcludedProducts | Long text (JSON) | Produits exclus |
| ImageUrl | URL | Image |
| Terms | Long text | Conditions |
| IsActive | Checkbox | Actif |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: CustomerReward
| Champ | Type | Description |
|-------|------|-------------|
| CustomerRewardId | Single line text (Primary) | Identifiant unique UUID |
| CustomerId | Single line text | ID client |
| CustomerName | Single line text | Nom client |
| RewardId | Single line text | ID récompense |
| RewardName | Single line text | Nom récompense |
| RewardType | Single select | Type récompense |
| Status | Single select | available, redeemed, expired, cancelled |
| PointsSpent | Number | Points dépensés |
| DiscountPercentage | Number | Remise (%) |
| DiscountAmount | Currency | Remise fixe |
| CashbackAmount | Currency | Cashback |
| RedeemedAt | Date | Date récupération |
| RedeemedById | Single line text | ID récupérateur |
| RedeemedByName | Single line text | Nom récupérateur |
| UsedAt | Date | Date utilisation |
| UsedInSaleId | Single line text | ID vente |
| UsedInSaleNumber | Single line text | Numéro vente |
| ExpiresAt | Date | Date expiration |
| CancelledAt | Date | Date annulation |
| CancellationReason | Long text | Raison annulation |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: LoyaltyTierConfig
| Champ | Type | Description |
|-------|------|-------------|
| TierConfigId | Single line text (Primary) | Identifiant unique UUID |
| Tier | Single select | bronze, silver, gold, platinum, diamond |
| Name | Single line text | Nom du tier |
| Description | Long text | Description |
| MinimumPoints | Number | Points minimum |
| MinimumSpent | Currency | Dépense minimum |
| MinimumOrders | Number | Commandes minimum |
| PointsEarnRate | Number | Taux gain points (%) |
| DiscountPercentage | Number | Remise automatique (%) |
| BirthdayBonus | Number | Points anniversaire |
| WelcomeBonus | Number | Points bienvenue |
| FreeShipping | Checkbox | Livraison gratuite |
| PrioritySupport | Checkbox | Support prioritaire |
| ExclusiveProducts | Checkbox | Produits exclusifs |
| EarlyAccessSales | Checkbox | Accès anticipé promos |
| Color | Single line text | Couleur |
| IconUrl | URL | Icône |
| BadgeUrl | URL | Badge |
| Order | Number | Ordre affichage |
| IsActive | Checkbox | Actif |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: CustomerSegment
| Champ | Type | Description |
|-------|------|-------------|
| SegmentId | Single line text (Primary) | Identifiant unique UUID |
| Name | Single line text | Nom segment |
| Description | Long text | Description |
| Criteria | Long text (JSON) | Critères segmentation |
| CustomerCount | Number | Nombre clients |
| TotalRevenue | Currency | Revenu total |
| LastCalculatedAt | Date | Dernière mise à jour |
| Color | Single line text | Couleur |
| IsActive | Checkbox | Actif |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: CustomerInteraction
| Champ | Type | Description |
|-------|------|-------------|
| InteractionId | Single line text (Primary) | Identifiant unique UUID |
| CustomerId | Single line text | ID client |
| CustomerName | Single line text | Nom client |
| Type | Single select | call, email, sms, visit, complaint, feedback, note |
| Subject | Single line text | Sujet |
| Description | Long text | Description |
| Sentiment | Single select | positive, neutral, negative |
| InteractionDate | Date | Date interaction |
| Duration | Number | Durée (minutes) |
| EmployeeId | Single line text | ID employé |
| EmployeeName | Single line text | Nom employé |
| FollowUpRequired | Checkbox | Suivi requis |
| FollowUpDate | Date | Date suivi |
| FollowUpDone | Checkbox | Suivi fait |
| Attachments | Long text (JSON) | Pièces jointes |
| Tags | Multiple select | Tags |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: CustomerFeedback
| Champ | Type | Description |
|-------|------|-------------|
| FeedbackId | Single line text (Primary) | Identifiant unique UUID |
| CustomerId | Single line text | ID client |
| CustomerName | Single line text | Nom client |
| Rating | Number | Note globale (1-5) |
| ProductRating | Number | Note produit (1-5) |
| ServiceRating | Number | Note service (1-5) |
| DeliveryRating | Number | Note livraison (1-5) |
| Comment | Long text | Commentaire |
| Sentiment | Single select | positive, neutral, negative |
| SaleId | Single line text | ID vente |
| SaleNumber | Single line text | Numéro vente |
| ProductId | Single line text | ID produit |
| ProductName | Single line text | Nom produit |
| Response | Long text | Réponse |
| RespondedById | Single line text | ID répondeur |
| RespondedByName | Single line text | Nom répondeur |
| RespondedAt | Date | Date réponse |
| IsPublic | Checkbox | Public |
| IsVerified | Checkbox | Vérifié |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

---

## 3. Workflows et processus métier

### 3.1 Workflow - Inscription client et attribution tier

```
┌─────────────┐
│  Nouveau    │
│   client    │
└──────┬──────┘
       │
       v
┌────────────────────────┐
│ Création Customer      │
│ - LoyaltyTier: bronze  │
│ - LoyaltyPoints: 0     │
│ - MemberSince: today   │
└──────┬─────────────────┘
       │
       v
┌────────────────────────┐
│ Récupération config    │
│ LoyaltyTierConfig      │
│ Tier = bronze          │
└──────┬─────────────────┘
       │
       v
┌────────────────────────┐
│ Attribution bonus      │
│ bienvenue si configuré │
│ WelcomeBonus points    │
└──────┬─────────────────┘
       │
       v
┌────────────────────────┐
│ Création              │
│ LoyaltyTransaction    │
│ Type: earn            │
│ Description: "Bonus   │
│  bienvenue Bronze"    │
└──────┬─────────────────┘
       │
       v
┌────────────────────────┐
│ Notification client   │
│ "Bienvenue ! Vous     │
│  avez reçu X points"  │
└────────────────────────┘
```

### 3.2 Workflow - Gain de points sur vente

```
┌─────────────┐
│    Vente    │
│  finalisée  │
└──────┬──────┘
       │
       v
┌────────────────────────────┐
│ Récupération              │
│ LoyaltyTierConfig du      │
│ client                    │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Calcul points             │
│ Points = TotalSale *      │
│   PointsEarnRate / 100    │
│                           │
│ Ex: 10,000 FCFA * 5%      │
│   = 500 points            │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Création                  │
│ LoyaltyTransaction        │
│ Type: earn                │
│ ReferenceType: sale       │
│ Points: +500              │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Mise à jour Customer      │
│ LoyaltyPoints += 500      │
│ TotalPointsEarned += 500  │
│ TotalOrders += 1          │
│ TotalSpent += 10,000      │
│ LastOrderDate = today     │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Vérification upgrade tier │
│ Si conditions atteintes   │
│ → Upgrade automatique     │
└────────────────────────────┘
```

### 3.3 Workflow - Upgrade automatique de tier

```
┌─────────────────┐
│  Après vente    │
│  ou ajustement  │
└──────┬──────────┘
       │
       v
┌────────────────────────────┐
│ Récupération tous les     │
│ LoyaltyTierConfig actifs  │
│ triés par Order DESC      │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Pour chaque tier          │
│ (du + haut au + bas):     │
│ Vérifier conditions       │
│ - MinimumPoints ≤ points  │
│ - MinimumSpent ≤ spent    │
│ - MinimumOrders ≤ orders  │
└──────┬─────────────────────┘
       │
       ├─── Conditions OK ──> Tier trouvé
       │                           │
       │                           v
       │                    ┌──────────────┐
       │                    │ Si nouveau   │
       │                    │ tier > ancien│
       │                    └──────┬───────┘
       │                           │
       │                           v
       │                    ┌──────────────┐
       │                    │ Update       │
       │                    │ Customer     │
       │                    │ LoyaltyTier  │
       │                    └──────┬───────┘
       │                           │
       │                           v
       │                    ┌──────────────┐
       │                    │ Attribution  │
       │                    │ WelcomeBonus │
       │                    │ du nouveau   │
       │                    │ tier         │
       │                    └──────┬───────┘
       │                           │
       │                           v
       │                    ┌──────────────┐
       │                    │ Notification │
       │                    │ "Félicitations│
       │                    │ tier Gold !"│
       │                    └──────────────┘
       │
       └─── Conditions NON ──> Tier suivant
```

### 3.4 Workflow - Échange de points contre récompense

```
┌─────────────┐
│   Client    │
│   choisit   │
│ récompense  │
└──────┬──────┘
       │
       v
┌────────────────────────────┐
│ Vérifications             │
│ 1. Reward.IsActive = true │
│ 2. Points ≥ PointsCost    │
│ 3. Tier ≥ MinimumTier     │
│ 4. Dans période validité  │
│ 5. < MaxRedemptions       │
└──────┬─────────────────────┘
       │
       ├─── Échec ──> Erreur
       │
       └─── OK ──> Continue
                       │
                       v
                ┌──────────────────┐
                │ Création         │
                │ CustomerReward   │
                │ Status: available│
                │ PointsSpent: X   │
                └──────┬───────────┘
                       │
                       v
                ┌──────────────────┐
                │ Création         │
                │ LoyaltyTransaction│
                │ Type: redeem     │
                │ Points: -X       │
                └──────┬───────────┘
                       │
                       v
                ┌──────────────────┐
                │ Mise à jour      │
                │ Customer         │
                │ LoyaltyPoints -= X│
                │ TotalPointsRedeemed│
                │   += X           │
                └──────┬───────────┘
                       │
                       v
                ┌──────────────────┐
                │ Mise à jour      │
                │ LoyaltyReward    │
                │ TotalRedeemed++  │
                └──────┬───────────┘
                       │
                       v
                ┌──────────────────┐
                │ Notification     │
                │ "Récompense      │
                │  disponible !"   │
                └──────────────────┘
```

### 3.5 Workflow - Utilisation récompense en vente

```
┌─────────────┐
│  Création   │
│   vente     │
└──────┬──────┘
       │
       v
┌────────────────────────────┐
│ Client a-t-il récompenses │
│ disponibles ?             │
└──────┬─────────────────────┘
       │
       ├─── NON ──> Vente normale
       │
       └─── OUI ──> Affichage récompenses
                          │
                          v
                   ┌──────────────┐
                   │ Client       │
                   │ sélectionne  │
                   │ récompense   │
                   └──────┬───────┘
                          │
                          v
                   ┌──────────────┐
                   │ Application  │
                   │ récompense:  │
                   │ - Discount   │
                   │ - Cashback   │
                   │ - Produit    │
                   │   gratuit    │
                   └──────┬───────┘
                          │
                          v
                   ┌──────────────┐
                   │ Mise à jour  │
                   │ CustomerReward│
                   │ Status: redeemed│
                   │ UsedInSaleId │
                   └──────┬───────┘
                          │
                          v
                   ┌──────────────┐
                   │ Finalisation │
                   │ vente avec   │
                   │ remise       │
                   └──────────────┘
```

### 3.6 Workflow - Segmentation automatique

```
┌─────────────┐
│   Tâche     │
│   cron      │
│ quotidienne │
└──────┬──────┘
       │
       v
┌────────────────────────────┐
│ Pour chaque               │
│ CustomerSegment actif     │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Construction filtre       │
│ Airtable basé sur         │
│ Criteria:                 │
│ - minTotalSpent           │
│ - maxTotalSpent           │
│ - minOrders               │
│ - loyaltyTiers            │
│ - lastOrderDaysAgo        │
│ etc.                      │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Requête Airtable          │
│ avec filtre complexe      │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Mise à jour               │
│ CustomerSegment:          │
│ - CustomerCount           │
│ - TotalRevenue            │
│ - LastCalculatedAt        │
└────────────────────────────┘
```

---

## 4. Spécifications des services

### 4.1 CustomerService

**Fichier** : `lib/modules/customers/customer-service.ts`

**Responsabilités** :
- Gestion CRUD des clients
- Calcul statistiques et upgrade tier
- Gestion des préférences
- Attribution commercial

**Méthodes** :

```typescript
export class CustomerService {
  // Génération du code client
  async generateCustomerCode(workspaceId: string): Promise<string>
  // Format: CUS-0001, CUS-0002...

  // Création client
  async create(input: CreateCustomerInput): Promise<Customer>
  // Attribution automatique tier bronze + welcome bonus

  // Lecture
  async getById(customerId: string): Promise<Customer | null>
  async getByCode(code: string, workspaceId: string): Promise<Customer | null>
  async getByPhone(phone: string, workspaceId: string): Promise<Customer | null>

  // Liste avec filtres
  async list(
    workspaceId: string,
    filters?: {
      status?: CustomerStatus;
      type?: CustomerType;
      loyaltyTier?: LoyaltyTier;
      city?: string;
      assignedSalesAgentId?: string;
      tags?: string[];
    }
  ): Promise<Customer[]>

  // Mise à jour
  async update(
    customerId: string,
    updates: Partial<Customer>
  ): Promise<Customer>

  // Mise à jour après vente
  async updateAfterSale(
    customerId: string,
    saleAmount: number,
    saleId: string
  ): Promise<Customer>
  // Met à jour TotalOrders, TotalSpent, AverageOrderValue, LastOrderDate

  // Vérification et upgrade tier
  async checkAndUpgradeTier(customerId: string): Promise<Customer>
  // Appelé après chaque vente ou ajustement points

  // Changement de statut
  async activate(customerId: string): Promise<Customer>
  async deactivate(customerId: string): Promise<Customer>
  async suspend(customerId: string): Promise<Customer>
  async promoteToVIP(customerId: string): Promise<Customer>

  // Attribution commercial
  async assignSalesAgent(
    customerId: string,
    salesAgentId: string
  ): Promise<Customer>

  // Recherche
  async search(
    workspaceId: string,
    query: string
  ): Promise<Customer[]>
  // Recherche par nom, code, téléphone, email

  // Statistiques
  async getStatistics(workspaceId: string): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    vipCustomers: number;
    byTier: Record<LoyaltyTier, number>;
    byType: Record<CustomerType, number>;
    averageOrderValue: number;
    totalRevenue: number;
    retentionRate: number; // % clients ayant commandé dans les 90 derniers jours
  }>

  // Clients à risque (n'ont pas commandé depuis X jours)
  async getAtRiskCustomers(
    workspaceId: string,
    daysThreshold: number = 90
  ): Promise<Customer[]>

  // Top clients
  async getTopCustomers(
    workspaceId: string,
    limit: number = 10
  ): Promise<Customer[]>
}
```

**Inputs** :

```typescript
export interface CreateCustomerInput {
  type: CustomerType;
  // Individual
  firstName?: string;
  lastName?: string;
  // Business
  companyName?: string;
  companyRegistration?: string;
  taxNumber?: string;
  // Contact
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  // Préférences
  preferredPaymentMethod?: string;
  preferredLanguage?: string;
  receivePromotions?: boolean;
  receiveSMS?: boolean;
  receiveEmail?: boolean;
  // Commercial
  assignedSalesAgentId?: string;
  // Métadonnées
  tags?: string[];
  notes?: string;
  photoUrl?: string;
  workspaceId: string;
}
```

### 4.2 LoyaltyService

**Fichier** : `lib/modules/customers/loyalty-service.ts`

**Responsabilités** :
- Gestion des transactions de points
- Calcul automatique points sur ventes
- Gestion expiration points
- Historique fidélité

**Méthodes** :

```typescript
export class LoyaltyService {
  // Gain de points (appelé automatiquement après vente)
  async earnPoints(input: EarnPointsInput): Promise<LoyaltyTransaction>
  // 1. Récupère tier client
  // 2. Calcule points = amount * earnRate
  // 3. Crée transaction
  // 4. Met à jour Customer
  // 5. Vérifie upgrade tier

  // Déduction de points (rédemption récompense)
  async redeemPoints(input: RedeemPointsInput): Promise<LoyaltyTransaction>

  // Ajustement manuel
  async adjustPoints(input: AdjustPointsInput): Promise<LoyaltyTransaction>

  // Expiration de points
  async expirePoints(
    customerId: string,
    points: number,
    reason: string
  ): Promise<LoyaltyTransaction>

  // Récupération historique
  async getTransactions(
    customerId: string,
    filters?: {
      type?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<LoyaltyTransaction[]>

  // Solde actuel
  async getBalance(customerId: string): Promise<number>
  // Retourne Customer.LoyaltyPoints

  // Points expirant bientôt
  async getExpiringPoints(
    customerId: string,
    withinDays: number = 30
  ): Promise<{
    totalExpiring: number;
    transactions: LoyaltyTransaction[];
  }>

  // Traitement expiration automatique
  async processExpirations(workspaceId: string): Promise<void>
  // Tâche cron quotidienne
  // Expire les points dont ExpirationDate < today

  // Statistiques
  async getStatistics(
    workspaceId: string,
    period?: { start: string; end: string }
  ): Promise<{
    totalPointsIssued: number;
    totalPointsRedeemed: number;
    totalPointsExpired: number;
    activePoints: number;
    averagePointsPerCustomer: number;
    redemptionRate: number; // % points utilisés vs gagnés
  }>
}
```

**Inputs** :

```typescript
export interface EarnPointsInput {
  customerId: string;
  points: number;
  referenceId: string;
  referenceType: 'sale' | 'promotion' | 'manual';
  referenceNumber?: string;
  description: string;
  expirationDate?: string;
  workspaceId: string;
}

export interface RedeemPointsInput {
  customerId: string;
  points: number;
  referenceId: string;
  referenceType: 'reward';
  description: string;
  workspaceId: string;
}

export interface AdjustPointsInput {
  customerId: string;
  points: number; // +/-
  reason: string;
  processedById: string;
  workspaceId: string;
}
```

### 4.3 RewardService

**Fichier** : `lib/modules/customers/reward-service.ts`

**Responsabilités** :
- Gestion du catalogue de récompenses
- Échange points contre récompenses
- Validation et application récompenses
- Gestion expiration récompenses

**Méthodes** :

```typescript
export class RewardService {
  // Génération code récompense
  async generateRewardCode(workspaceId: string): Promise<string>
  // Format: REW-001, REW-002...

  // Création récompense
  async create(input: CreateRewardInput): Promise<LoyaltyReward>

  // Lecture
  async getById(rewardId: string): Promise<LoyaltyReward | null>
  async getByCode(
    code: string,
    workspaceId: string
  ): Promise<LoyaltyReward | null>

  // Liste avec filtres
  async list(
    workspaceId: string,
    filters?: {
      type?: RewardType;
      status?: string;
      isActive?: boolean;
      availableForTier?: LoyaltyTier;
    }
  ): Promise<LoyaltyReward[]>

  // Récompenses disponibles pour un client
  async getAvailableForCustomer(customerId: string): Promise<LoyaltyReward[]>
  // Filtre par:
  // - Points suffisants
  // - Tier minimum
  // - Période validité
  // - Pas dépassé MaxRedemptions

  // Mise à jour
  async update(
    rewardId: string,
    updates: Partial<LoyaltyReward>
  ): Promise<LoyaltyReward>

  // Activation/Désactivation
  async activate(rewardId: string): Promise<LoyaltyReward>
  async deactivate(rewardId: string): Promise<LoyaltyReward>

  // Échange de points
  async redeemReward(input: RedeemRewardInput): Promise<CustomerReward>
  // 1. Vérifications
  // 2. Création CustomerReward
  // 3. Déduction points via LoyaltyService
  // 4. Mise à jour TotalRedeemed

  // Application récompense dans une vente
  async applyToSale(
    customerRewardId: string,
    saleId: string
  ): Promise<CustomerReward>
  // Met à jour Status: redeemed, UsedAt, UsedInSaleId

  // Annulation récompense
  async cancelCustomerReward(
    customerRewardId: string,
    reason: string
  ): Promise<CustomerReward>
  // Remboursement points

  // Récompenses d'un client
  async getCustomerRewards(
    customerId: string,
    status?: RewardStatus
  ): Promise<CustomerReward[]>

  // Traitement expirations
  async processExpirations(workspaceId: string): Promise<void>
  // Tâche cron quotidienne
  // Expire CustomerRewards dont ExpiresAt < today

  // Statistiques
  async getStatistics(workspaceId: string): Promise<{
    totalRewards: number;
    activeRewards: number;
    totalRedemptions: number;
    byType: Record<RewardType, number>;
    mostPopular: LoyaltyReward[];
  }>
}
```

**Inputs** :

```typescript
export interface CreateRewardInput {
  name: string;
  description: string;
  type: RewardType;
  pointsCost: number;
  discountPercentage?: number;
  discountAmount?: number;
  freeProductId?: string;
  cashbackAmount?: number;
  pointsMultiplier?: number;
  minimumTier?: LoyaltyTier;
  minimumPurchase?: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptionsPerCustomer?: number;
  totalAvailable?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  excludedProducts?: string[];
  imageUrl?: string;
  terms?: string;
  workspaceId: string;
}

export interface RedeemRewardInput {
  customerId: string;
  rewardId: string;
  redeemedById?: string;
  workspaceId: string;
}
```

### 4.4 TierService

**Fichier** : `lib/modules/customers/tier-service.ts`

**Responsabilités** :
- Configuration des tiers de fidélité
- Gestion des avantages par tier
- Calcul automatique du tier approprié

**Méthodes** :

```typescript
export class TierService {
  // Création configuration tier
  async create(input: CreateTierConfigInput): Promise<LoyaltyTierConfig>

  // Lecture
  async getById(tierConfigId: string): Promise<LoyaltyTierConfig | null>
  async getByTier(
    tier: LoyaltyTier,
    workspaceId: string
  ): Promise<LoyaltyTierConfig | null>

  // Liste tous les tiers
  async list(
    workspaceId: string,
    activeOnly: boolean = true
  ): Promise<LoyaltyTierConfig[]>
  // Triés par Order ASC

  // Mise à jour
  async update(
    tierConfigId: string,
    updates: Partial<LoyaltyTierConfig>
  ): Promise<LoyaltyTierConfig>

  // Détermination du tier pour un client
  async determineTier(customer: Customer): Promise<LoyaltyTier>
  // Parcourt tous les tiers du + haut au + bas
  // Retourne le premier dont conditions sont satisfaites

  // Avantages d'un tier
  async getTierBenefits(tier: LoyaltyTier, workspaceId: string): Promise<{
    pointsEarnRate: number;
    discountPercentage: number;
    freeShipping: boolean;
    prioritySupport: boolean;
    exclusiveProducts: boolean;
    earlyAccessSales: boolean;
  }>

  // Progression vers tier supérieur
  async getProgressToNextTier(customerId: string): Promise<{
    currentTier: LoyaltyTier;
    nextTier: LoyaltyTier | null;
    progress: {
      points: { current: number; required: number; percentage: number };
      spent: { current: number; required: number; percentage: number };
      orders: { current: number; required: number; percentage: number };
    };
  } | null>
}
```

**Inputs** :

```typescript
export interface CreateTierConfigInput {
  tier: LoyaltyTier;
  name: string;
  description?: string;
  minimumPoints?: number;
  minimumSpent?: number;
  minimumOrders?: number;
  pointsEarnRate: number;
  discountPercentage?: number;
  birthdayBonus?: number;
  welcomeBonus?: number;
  freeShipping?: boolean;
  prioritySupport?: boolean;
  exclusiveProducts?: boolean;
  earlyAccessSales?: boolean;
  color?: string;
  iconUrl?: string;
  badgeUrl?: string;
  order: number;
  workspaceId: string;
}
```

### 4.5 SegmentService

**Fichier** : `lib/modules/customers/segment-service.ts`

**Responsabilités** :
- Création et gestion des segments
- Calcul automatique de l'appartenance
- Statistiques par segment
- Ciblage marketing

**Méthodes** :

```typescript
export class SegmentService {
  // Création segment
  async create(input: CreateSegmentInput): Promise<CustomerSegment>

  // Lecture
  async getById(segmentId: string): Promise<CustomerSegment | null>

  // Liste
  async list(
    workspaceId: string,
    activeOnly: boolean = true
  ): Promise<CustomerSegment[]>

  // Mise à jour
  async update(
    segmentId: string,
    updates: Partial<CustomerSegment>
  ): Promise<CustomerSegment>

  // Calcul des clients dans un segment
  async calculateSegment(segmentId: string): Promise<CustomerSegment>
  // Construit filtre Airtable basé sur Criteria
  // Met à jour CustomerCount et TotalRevenue

  // Clients d'un segment
  async getCustomersInSegment(segmentId: string): Promise<Customer[]>

  // Recalcul automatique de tous les segments
  async recalculateAll(workspaceId: string): Promise<void>
  // Tâche cron quotidienne

  // Segments d'un client
  async getCustomerSegments(customerId: string): Promise<CustomerSegment[]>

  // Statistiques
  async getStatistics(workspaceId: string): Promise<{
    totalSegments: number;
    largestSegment: CustomerSegment;
    highestRevenueSegment: CustomerSegment;
  }>
}
```

**Inputs** :

```typescript
export interface CreateSegmentInput {
  name: string;
  description?: string;
  criteria: {
    minTotalSpent?: number;
    maxTotalSpent?: number;
    minOrders?: number;
    maxOrders?: number;
    minAverageOrderValue?: number;
    maxAverageOrderValue?: number;
    loyaltyTiers?: LoyaltyTier[];
    tags?: string[];
    cities?: string[];
    lastOrderDaysAgo?: number;
    memberSinceDaysAgo?: number;
  };
  color?: string;
  workspaceId: string;
}
```

### 4.6 InteractionService

**Fichier** : `lib/modules/customers/interaction-service.ts`

**Responsabilités** :
- Historique des interactions client
- Gestion des suivis
- Analyse de sentiment
- CRM de base

**Méthodes** :

```typescript
export class InteractionService {
  // Création interaction
  async create(input: CreateInteractionInput): Promise<CustomerInteraction>

  // Lecture
  async getById(interactionId: string): Promise<CustomerInteraction | null>

  // Liste interactions d'un client
  async getByCustomer(
    customerId: string,
    filters?: {
      type?: string;
      sentiment?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<CustomerInteraction[]>

  // Liste toutes interactions
  async list(
    workspaceId: string,
    filters?: {
      customerId?: string;
      type?: string;
      sentiment?: string;
      followUpRequired?: boolean;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<CustomerInteraction[]>

  // Mise à jour
  async update(
    interactionId: string,
    updates: Partial<CustomerInteraction>
  ): Promise<CustomerInteraction>

  // Marquer suivi comme fait
  async completeFollowUp(interactionId: string): Promise<CustomerInteraction>

  // Interactions nécessitant un suivi
  async getPendingFollowUps(
    workspaceId: string,
    employeeId?: string
  ): Promise<CustomerInteraction[]>

  // Statistiques
  async getStatistics(
    workspaceId: string,
    period?: { start: string; end: string }
  ): Promise<{
    totalInteractions: number;
    byType: Record<string, number>;
    bySentiment: Record<string, number>;
    pendingFollowUps: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateInteractionInput {
  customerId: string;
  type: 'call' | 'email' | 'sms' | 'visit' | 'complaint' | 'feedback' | 'note';
  subject?: string;
  description: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  interactionDate: string;
  duration?: number;
  employeeId?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  attachments?: string[];
  tags?: string[];
  workspaceId: string;
}
```

### 4.7 FeedbackService

**Fichier** : `lib/modules/customers/feedback-service.ts`

**Responsabilités** :
- Collecte et gestion des avis clients
- Analyse de satisfaction
- Réponses aux feedbacks
- Indicateurs NPS

**Méthodes** :

```typescript
export class FeedbackService {
  // Création feedback
  async create(input: CreateFeedbackInput): Promise<CustomerFeedback>

  // Lecture
  async getById(feedbackId: string): Promise<CustomerFeedback | null>

  // Liste feedbacks d'un client
  async getByCustomer(customerId: string): Promise<CustomerFeedback[]>

  // Liste feedbacks d'un produit
  async getByProduct(productId: string): Promise<CustomerFeedback[]>

  // Liste tous feedbacks
  async list(
    workspaceId: string,
    filters?: {
      customerId?: string;
      productId?: string;
      saleId?: string;
      rating?: number;
      sentiment?: string;
      isPublic?: boolean;
      hasResponse?: boolean;
    }
  ): Promise<CustomerFeedback[]>

  // Répondre à un feedback
  async respond(
    feedbackId: string,
    responderId: string,
    response: string
  ): Promise<CustomerFeedback>

  // Publier/Dépublier
  async publish(feedbackId: string): Promise<CustomerFeedback>
  async unpublish(feedbackId: string): Promise<CustomerFeedback>

  // Vérifier
  async verify(feedbackId: string): Promise<CustomerFeedback>

  // Note moyenne produit
  async getProductAverageRating(productId: string): Promise<number>

  // Statistiques
  async getStatistics(
    workspaceId: string,
    period?: { start: string; end: string }
  ): Promise<{
    totalFeedbacks: number;
    averageRating: number;
    averageProductRating: number;
    averageServiceRating: number;
    averageDeliveryRating: number;
    bySentiment: Record<string, number>;
    byRating: Record<number, number>;
    responseRate: number; // % feedbacks avec réponse
    nps: number; // Net Promoter Score
  }>

  // NPS (Net Promoter Score)
  async calculateNPS(workspaceId: string): Promise<{
    nps: number;
    promoters: number; // Rating 5
    passives: number; // Rating 4
    detractors: number; // Rating 1-3
  }>
}
```

**Inputs** :

```typescript
export interface CreateFeedbackInput {
  customerId: string;
  rating: number; // 1-5
  productRating?: number;
  serviceRating?: number;
  deliveryRating?: number;
  comment?: string;
  saleId?: string;
  productId?: string;
  workspaceId: string;
}
```

---

## 5. Intégrations avec autres modules

### 5.1 Intégration avec Module Ventes (7.3)

**Événements déclencheurs** :

#### 5.1.1 Finalisation vente → Gain de points fidélité

```typescript
// Dans SaleService.finalize()
const sale = await this.finalize(saleId);

if (sale.CustomerId) {
  // Attribution points fidélité
  await loyaltyService.earnPoints({
    customerId: sale.CustomerId,
    points: 0, // Calculé automatiquement dans earnPoints
    referenceId: sale.SaleId,
    referenceType: 'sale',
    referenceNumber: sale.SaleNumber,
    description: `Points sur vente ${sale.SaleNumber}`,
    workspaceId: sale.WorkspaceId,
  });

  // Mise à jour statistiques client
  await customerService.updateAfterSale(
    sale.CustomerId,
    sale.TotalAmount,
    sale.SaleId
  );
}
```

#### 5.1.2 Application d'une récompense en vente

```typescript
// Dans SaleService.create() ou avant finalisation
if (input.customerRewardId) {
  const customerReward = await rewardService.getById(input.customerRewardId);

  if (customerReward) {
    // Appliquer la remise
    if (customerReward.DiscountPercentage) {
      totalAmount *= (1 - customerReward.DiscountPercentage / 100);
    }
    if (customerReward.DiscountAmount) {
      totalAmount -= customerReward.DiscountAmount;
    }

    // Marquer récompense comme utilisée
    await rewardService.applyToSale(input.customerRewardId, sale.SaleId);
  }
}
```

#### 5.1.3 Demande de feedback après vente

```typescript
// Tâche cron ou webhook
// 2-3 jours après livraison
const completedSales = await saleService.getRecentlyCompleted(workspaceId, 3);

for (const sale of completedSales) {
  if (sale.CustomerId) {
    // Envoi email/SMS demandant feedback
    await emailService.sendFeedbackRequest({
      customerId: sale.CustomerId,
      saleId: sale.SaleId,
      feedbackUrl: `${baseUrl}/feedback/${sale.SaleId}`,
    });
  }
}
```

### 5.2 Intégration avec Module Trésorerie (7.1)

**Événements déclencheurs** :

#### 5.2.1 Cashback sur récompense

```typescript
// Lorsqu'une récompense cashback est utilisée
if (customerReward.RewardType === 'cashback' && customerReward.CashbackAmount) {
  await treasuryService.createTransaction({
    type: 'expense',
    category: 'loyalty_cashback',
    amount: customerReward.CashbackAmount,
    currency: workspace.Currency,
    walletId: defaultWalletId,
    description: `Cashback fidélité - ${customerReward.CustomerName}`,
    referenceId: customerReward.CustomerRewardId,
    referenceType: 'loyalty_cashback',
    workspaceId: workspace.WorkspaceId,
  });
}
```

### 5.3 Tâches automatisées (Cron)

#### 5.3.1 Expiration points quotidienne

```typescript
// lib/cron/loyalty-expiration.ts
// Exécution: Tous les jours à 1h00

export async function processLoyaltyExpirations(workspaceId: string) {
  await loyaltyService.processExpirations(workspaceId);
  console.log('Points fidélité expirés traités');
}
```

#### 5.3.2 Expiration récompenses quotidienne

```typescript
// Exécution: Tous les jours à 1h30

export async function processRewardExpirations(workspaceId: string) {
  await rewardService.processExpirations(workspaceId);
  console.log('Récompenses expirées traitées');
}
```

#### 5.3.3 Recalcul segments quotidien

```typescript
// Exécution: Tous les jours à 2h00

export async function recalculateSegments(workspaceId: string) {
  await segmentService.recalculateAll(workspaceId);
  console.log('Segments clients recalculés');
}
```

#### 5.3.4 Relance clients inactifs (hebdomadaire)

```typescript
// Exécution: Tous les lundis à 9h00

export async function reengageInactiveCustomers(workspaceId: string) {
  const atRiskCustomers = await customerService.getAtRiskCustomers(workspaceId, 60);

  for (const customer of atRiskCustomers) {
    if (customer.ReceiveEmail || customer.ReceiveSMS) {
      // Envoi promotion spéciale
      await marketingService.sendReengagementCampaign({
        customerId: customer.CustomerId,
        offerType: 'special_discount',
      });
    }
  }

  console.log(`${atRiskCustomers.length} clients relancés`);
}
```

---

## 6. Routes API

### 6.1 Customers

#### GET /api/modules/customers
Liste des clients avec filtres
```typescript
Query params:
- status?: CustomerStatus
- type?: CustomerType
- loyaltyTier?: LoyaltyTier
- city?: string
- assignedSalesAgentId?: string
- search?: string

Response: Customer[]
```

#### GET /api/modules/customers/[id]
Détails d'un client
```typescript
Response: Customer
```

#### POST /api/modules/customers
Création d'un client
```typescript
Body: CreateCustomerInput
Response: Customer
```

#### PATCH /api/modules/customers/[id]
Mise à jour d'un client
```typescript
Body: Partial<Customer>
Response: Customer
```

#### POST /api/modules/customers/[id]/activate
Activation
```typescript
Response: Customer
```

#### POST /api/modules/customers/[id]/deactivate
Désactivation
```typescript
Response: Customer
```

#### POST /api/modules/customers/[id]/suspend
Suspension
```typescript
Response: Customer
```

#### POST /api/modules/customers/[id]/promote-vip
Promotion VIP
```typescript
Response: Customer
```

#### GET /api/modules/customers/[id]/loyalty
Informations fidélité complètes
```typescript
Response: {
  customer: Customer;
  currentTier: LoyaltyTierConfig;
  progressToNext: ProgressInfo;
  recentTransactions: LoyaltyTransaction[];
  availableRewards: LoyaltyReward[];
  activeCustomerRewards: CustomerReward[];
}
```

#### GET /api/modules/customers/stats
Statistiques clients
```typescript
Response: CustomerStatistics
```

#### GET /api/modules/customers/at-risk
Clients à risque
```typescript
Query params:
- daysThreshold?: number (default: 90)

Response: Customer[]
```

#### GET /api/modules/customers/top
Top clients
```typescript
Query params:
- limit?: number (default: 10)

Response: Customer[]
```

### 6.2 Loyalty Transactions

#### GET /api/modules/customers/loyalty/transactions
Liste des transactions fidélité
```typescript
Query params:
- customerId?: string
- type?: string
- startDate?: string
- endDate?: string

Response: LoyaltyTransaction[]
```

#### POST /api/modules/customers/loyalty/earn
Attribution de points
```typescript
Body: EarnPointsInput
Response: LoyaltyTransaction
```

#### POST /api/modules/customers/loyalty/adjust
Ajustement manuel de points
```typescript
Body: AdjustPointsInput
Response: LoyaltyTransaction
```

#### GET /api/modules/customers/loyalty/stats
Statistiques fidélité
```typescript
Query params:
- startDate?: string
- endDate?: string

Response: LoyaltyStatistics
```

### 6.3 Rewards

#### GET /api/modules/customers/rewards
Catalogue de récompenses
```typescript
Query params:
- type?: RewardType
- status?: string
- isActive?: boolean
- availableForCustomer?: string (CustomerId)

Response: LoyaltyReward[]
```

#### GET /api/modules/customers/rewards/[id]
Détails d'une récompense
```typescript
Response: LoyaltyReward
```

#### POST /api/modules/customers/rewards
Création d'une récompense
```typescript
Body: CreateRewardInput
Response: LoyaltyReward
```

#### PATCH /api/modules/customers/rewards/[id]
Mise à jour d'une récompense
```typescript
Body: Partial<LoyaltyReward>
Response: LoyaltyReward
```

#### POST /api/modules/customers/rewards/[id]/activate
Activation
```typescript
Response: LoyaltyReward
```

#### POST /api/modules/customers/rewards/[id]/deactivate
Désactivation
```typescript
Response: LoyaltyReward
```

#### POST /api/modules/customers/rewards/redeem
Échange de points
```typescript
Body: RedeemRewardInput
Response: CustomerReward
```

#### GET /api/modules/customers/rewards/customer/[customerId]
Récompenses d'un client
```typescript
Query params:
- status?: RewardStatus

Response: CustomerReward[]
```

#### POST /api/modules/customers/rewards/customer/[id]/apply
Application dans une vente
```typescript
Body: { saleId: string }
Response: CustomerReward
```

#### POST /api/modules/customers/rewards/customer/[id]/cancel
Annulation
```typescript
Body: { reason: string }
Response: CustomerReward
```

#### GET /api/modules/customers/rewards/stats
Statistiques récompenses
```typescript
Response: RewardStatistics
```

### 6.4 Loyalty Tiers

#### GET /api/modules/customers/tiers
Liste des tiers
```typescript
Query params:
- activeOnly?: boolean

Response: LoyaltyTierConfig[]
```

#### GET /api/modules/customers/tiers/[id]
Détails d'un tier
```typescript
Response: LoyaltyTierConfig
```

#### POST /api/modules/customers/tiers
Création d'un tier
```typescript
Body: CreateTierConfigInput
Response: LoyaltyTierConfig
```

#### PATCH /api/modules/customers/tiers/[id]
Mise à jour d'un tier
```typescript
Body: Partial<LoyaltyTierConfig>
Response: LoyaltyTierConfig
```

#### GET /api/modules/customers/tiers/customer/[customerId]/progress
Progression vers tier supérieur
```typescript
Response: ProgressInfo
```

### 6.5 Customer Segments

#### GET /api/modules/customers/segments
Liste des segments
```typescript
Query params:
- activeOnly?: boolean

Response: CustomerSegment[]
```

#### GET /api/modules/customers/segments/[id]
Détails d'un segment
```typescript
Response: CustomerSegment
```

#### POST /api/modules/customers/segments
Création d'un segment
```typescript
Body: CreateSegmentInput
Response: CustomerSegment
```

#### PATCH /api/modules/customers/segments/[id]
Mise à jour d'un segment
```typescript
Body: Partial<CustomerSegment>
Response: CustomerSegment
```

#### POST /api/modules/customers/segments/[id]/calculate
Recalcul du segment
```typescript
Response: CustomerSegment
```

#### GET /api/modules/customers/segments/[id]/customers
Clients du segment
```typescript
Response: Customer[]
```

#### POST /api/modules/customers/segments/recalculate-all
Recalcul de tous les segments
```typescript
Response: { message: string; count: number }
```

### 6.6 Customer Interactions

#### GET /api/modules/customers/interactions
Liste des interactions
```typescript
Query params:
- customerId?: string
- type?: string
- sentiment?: string
- followUpRequired?: boolean
- startDate?: string
- endDate?: string

Response: CustomerInteraction[]
```

#### GET /api/modules/customers/interactions/[id]
Détails d'une interaction
```typescript
Response: CustomerInteraction
```

#### POST /api/modules/customers/interactions
Création d'une interaction
```typescript
Body: CreateInteractionInput
Response: CustomerInteraction
```

#### PATCH /api/modules/customers/interactions/[id]
Mise à jour d'une interaction
```typescript
Body: Partial<CustomerInteraction>
Response: CustomerInteraction
```

#### POST /api/modules/customers/interactions/[id]/complete-followup
Marquer suivi comme fait
```typescript
Response: CustomerInteraction
```

#### GET /api/modules/customers/interactions/pending-followups
Suivis en attente
```typescript
Query params:
- employeeId?: string

Response: CustomerInteraction[]
```

#### GET /api/modules/customers/interactions/stats
Statistiques interactions
```typescript
Query params:
- startDate?: string
- endDate?: string

Response: InteractionStatistics
```

### 6.7 Customer Feedback

#### GET /api/modules/customers/feedback
Liste des feedbacks
```typescript
Query params:
- customerId?: string
- productId?: string
- saleId?: string
- rating?: number
- sentiment?: string
- isPublic?: boolean

Response: CustomerFeedback[]
```

#### GET /api/modules/customers/feedback/[id]
Détails d'un feedback
```typescript
Response: CustomerFeedback
```

#### POST /api/modules/customers/feedback
Création d'un feedback
```typescript
Body: CreateFeedbackInput
Response: CustomerFeedback
```

#### POST /api/modules/customers/feedback/[id]/respond
Répondre à un feedback
```typescript
Body: {
  responderId: string;
  response: string;
}
Response: CustomerFeedback
```

#### POST /api/modules/customers/feedback/[id]/publish
Publier
```typescript
Response: CustomerFeedback
```

#### POST /api/modules/customers/feedback/[id]/unpublish
Dépublier
```typescript
Response: CustomerFeedback
```

#### POST /api/modules/customers/feedback/[id]/verify
Vérifier
```typescript
Response: CustomerFeedback
```

#### GET /api/modules/customers/feedback/product/[productId]/rating
Note moyenne d'un produit
```typescript
Response: {
  averageRating: number;
  totalFeedbacks: number;
}
```

#### GET /api/modules/customers/feedback/stats
Statistiques feedbacks
```typescript
Query params:
- startDate?: string
- endDate?: string

Response: FeedbackStatistics
```

#### GET /api/modules/customers/feedback/nps
Net Promoter Score
```typescript
Response: NPSData
```

---

## 7. Permissions RBAC

### 7.1 Définition des permissions

**Fichier** : `lib/rbac/permissions.ts`

```typescript
// Module Clients & Fidélité
customer: {
  // Clients
  'customer:view': 'Voir les clients',
  'customer:create': 'Créer un client',
  'customer:edit': 'Modifier un client',
  'customer:delete': 'Supprimer un client',
  'customer:manage_status': 'Gérer statut client',
  'customer:view_stats': 'Voir statistiques clients',

  // Fidélité
  'loyalty:view': 'Voir points fidélité',
  'loyalty:adjust': 'Ajuster points manuellement',
  'loyalty:view_transactions': 'Voir historique points',

  // Récompenses
  'reward:view': 'Voir catalogue récompenses',
  'reward:create': 'Créer une récompense',
  'reward:edit': 'Modifier une récompense',
  'reward:delete': 'Supprimer une récompense',
  'reward:redeem': 'Échanger des points',

  // Tiers
  'tier:view': 'Voir configuration tiers',
  'tier:manage': 'Gérer configuration tiers',

  // Segments
  'segment:view': 'Voir segments',
  'segment:create': 'Créer un segment',
  'segment:edit': 'Modifier un segment',
  'segment:delete': 'Supprimer un segment',

  // Interactions
  'interaction:view': 'Voir interactions',
  'interaction:create': 'Créer une interaction',
  'interaction:edit': 'Modifier une interaction',

  // Feedback
  'feedback:view': 'Voir les avis',
  'feedback:respond': 'Répondre aux avis',
  'feedback:moderate': 'Modérer les avis',
}
```

### 7.2 Matrice de permissions par rôle

| Permission | Admin | Manager | Sales Agent | Accountant | Other |
|-----------|-------|---------|-------------|------------|-------|
| customer:view | ✅ | ✅ | ✅ (assignés) | ✅ | ❌ |
| customer:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| customer:edit | ✅ | ✅ | ✅ (assignés) | ❌ | ❌ |
| customer:delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| customer:manage_status | ✅ | ✅ | ❌ | ❌ | ❌ |
| customer:view_stats | ✅ | ✅ | ✅ | ✅ | ❌ |
| loyalty:view | ✅ | ✅ | ✅ | ✅ | ❌ |
| loyalty:adjust | ✅ | ✅ | ❌ | ❌ | ❌ |
| loyalty:view_transactions | ✅ | ✅ | ✅ | ✅ | ❌ |
| reward:view | ✅ | ✅ | ✅ | ❌ | ❌ |
| reward:create | ✅ | ✅ | ❌ | ❌ | ❌ |
| reward:edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| reward:delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| reward:redeem | ✅ | ✅ | ✅ | ❌ | ❌ |
| tier:view | ✅ | ✅ | ✅ | ❌ | ❌ |
| tier:manage | ✅ | ❌ | ❌ | ❌ | ❌ |
| segment:view | ✅ | ✅ | ✅ | ❌ | ❌ |
| segment:create | ✅ | ✅ | ❌ | ❌ | ❌ |
| segment:edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| segment:delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| interaction:view | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| interaction:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| interaction:edit | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| feedback:view | ✅ | ✅ | ✅ | ❌ | ❌ |
| feedback:respond | ✅ | ✅ | ❌ | ❌ | ❌ |
| feedback:moderate | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 8. Interface utilisateur

### 8.1 Pages principales

#### 8.1.1 Liste des clients
**Route** : `/customers`

**Fonctionnalités** :
- Table avec colonnes: Code, Nom, Type, Téléphone, Ville, Tier, Points, Total dépensé, Dernière commande, Statut
- Filtres: Statut, Type, Tier, Ville, Commercial assigné
- Recherche par nom, code, téléphone, email
- Actions: Voir détails, Modifier, Activer/Désactiver
- Bouton "Ajouter un client"
- Indicateurs: Total clients, Clients actifs, VIP, Clients à risque

#### 8.1.2 Détails client
**Route** : `/customers/[id]`

**Sections** :
- **En-tête** : Photo, Nom, Code, Badge tier, Points
- **Informations personnelles** : Contact, Adresse
- **Fidélité** :
  - Badge tier actuel avec couleur
  - Solde points
  - Barre progression vers tier supérieur
  - Historique transactions points
  - Récompenses disponibles
  - Récompenses actives
- **Statistiques** :
  - Graphique évolution dépenses
  - Total commandes
  - Panier moyen
  - Dernière visite
- **Historique commandes** : Liste des ventes
- **Interactions** : Timeline des interactions
- **Avis** : Feedbacks du client
- **Préférences** : Mode paiement préféré, Opt-in marketing

**Actions** :
- Modifier informations
- Ajuster points manuellement
- Assigner commercial
- Créer interaction
- Promouvoir VIP

#### 8.1.3 Catalogue de récompenses
**Route** : `/customers/rewards`

**Fonctionnalités** :
- Grille ou liste de récompenses avec images
- Filtres: Type, Statut, Tier minimum
- Cartes récompense affichant:
  - Nom et description
  - Coût en points
  - Valeur (remise, cashback, etc.)
  - Conditions
  - Nombre échangées / disponibles
- Actions: Voir détails, Modifier, Activer/Désactiver
- Bouton "Créer une récompense"

#### 8.1.4 Configuration tiers fidélité
**Route** : `/customers/tiers`

**Fonctionnalités** :
- Liste des 5 tiers avec badges et couleurs
- Pour chaque tier:
  - Nom et description
  - Conditions d'accès (points, dépenses, commandes)
  - Taux gain points (%)
  - Remise automatique
  - Privilèges (livraison gratuite, support prioritaire, etc.)
  - Nombre de clients dans ce tier
- Actions: Modifier configuration

#### 8.1.5 Segmentation clients
**Route** : `/customers/segments`

**Fonctionnalités** :
- Liste des segments avec couleurs
- Pour chaque segment:
  - Nom et description
  - Critères
  - Nombre de clients
  - Revenu total
  - Dernière mise à jour
- Actions: Voir clients du segment, Modifier, Recalculer, Supprimer
- Bouton "Créer un segment"

#### 8.1.6 Interactions CRM
**Route** : `/customers/interactions`

**Fonctionnalités** :
- Timeline ou liste des interactions
- Filtres: Client, Type, Sentiment, Employé, Suivi requis
- Cartes interaction affichant:
  - Client
  - Type et sujet
  - Description
  - Date et employé
  - Badge sentiment (positif/neutre/négatif)
  - Statut suivi
- Actions: Voir détails, Modifier, Marquer suivi fait
- Bouton "Créer une interaction"
- Alerte: Nombre de suivis en attente

#### 8.1.7 Avis clients
**Route** : `/customers/feedback`

**Fonctionnalités** :
- Liste des avis avec étoiles
- Filtres: Client, Produit, Note, Sentiment, Public/Privé
- Cartes feedback affichant:
  - Client et photo
  - Note globale (étoiles)
  - Notes détaillées (produit, service, livraison)
  - Commentaire
  - Vente/Produit concerné
  - Réponse si existante
- Actions: Répondre, Publier/Dépublier, Vérifier
- **Statistiques** :
  - Note moyenne globale
  - Répartition par note (graphique)
  - NPS (Net Promoter Score)
  - Taux de réponse

#### 8.1.8 Tableau de bord fidélité
**Route** : `/customers/dashboard`

**Widgets** :
- **Statistiques clés** :
  - Total clients
  - Clients actifs
  - Clients à risque
  - Taux rétention
- **Répartition par tier** : Graphique donut
- **Évolution points** : Graphique ligne (gagnés vs utilisés)
- **Top clients** : Liste des 10 meilleurs clients
- **Récompenses populaires** : Top 5 récompenses échangées
- **Avis récents** : 5 derniers feedbacks
- **NPS** : Indicateur avec évolution

### 8.2 Composants réutilisables

```typescript
// components/customers/CustomerCard.tsx
// Carte client avec photo, nom, tier badge

// components/customers/TierBadge.tsx
// Badge tier avec couleur et icône

// components/customers/PointsBalance.tsx
// Affichage solde points avec animation

// components/customers/ProgressToNextTier.tsx
// Barre progression vers tier supérieur

// components/customers/RewardCard.tsx
// Carte récompense avec image et détails

// components/customers/CustomerRewardsList.tsx
// Liste des récompenses d'un client

// components/customers/InteractionTimeline.tsx
// Timeline des interactions

// components/customers/FeedbackCard.tsx
// Carte avis avec étoiles et commentaire

// components/customers/SegmentBadge.tsx
// Badge segment avec couleur

// components/customers/NPSGauge.tsx
// Jauge NPS avec code couleur
```

---

## 9. Estimation de développement

### 9.1 Complexité par composant

| Composant | Complexité | Lignes estimées | Temps estimé |
|-----------|------------|-----------------|--------------|
| **Types TypeScript** | Faible | 320 | ✅ Fait |
| **CustomerService** | Moyenne | 450 | 2.5 jours |
| **LoyaltyService** | Haute | 400 | 3 jours |
| **RewardService** | Haute | 500 | 3 jours |
| **TierService** | Moyenne | 300 | 2 jours |
| **SegmentService** | Haute | 350 | 2.5 jours |
| **InteractionService** | Faible | 250 | 1.5 jours |
| **FeedbackService** | Moyenne | 300 | 2 jours |
| **Routes API (x65)** | Haute | 1300 | 4 jours |
| **Permissions RBAC** | Faible | 150 | 0.5 jour |
| **UI - Pages (x8)** | Très haute | 2200 | 6 jours |
| **UI - Composants** | Haute | 1000 | 3 jours |
| **Intégrations** | Moyenne | 500 | 2 jours |
| **Tâches cron** | Moyenne | 300 | 1.5 jours |
| **Tests** | Haute | 1200 | 4 jours |
| **Documentation** | Faible | - | ✅ Fait |

**Total lignes** : ~9520 lignes
**Total temps** : **38 jours** (développement complet)

### 9.2 Phases de développement recommandées

#### Phase 1 - Base clients (6 jours)
- CustomerService
- Routes API clients
- UI liste et détails clients
- Tests

#### Phase 2 - Système de fidélité (8 jours)
- LoyaltyService
- TierService
- Routes API fidélité et tiers
- UI tiers et transactions points
- Intégration avec ventes (gain points automatique)
- Tests

#### Phase 3 - Récompenses (6 jours)
- RewardService
- Routes API récompenses
- UI catalogue et échange
- Application récompenses en vente
- Tests

#### Phase 4 - Segmentation (4 jours)
- SegmentService
- Routes API segments
- UI segmentation
- Tâche cron recalcul
- Tests

#### Phase 5 - CRM et feedbacks (5 jours)
- InteractionService
- FeedbackService
- Routes API
- UI interactions et avis
- Tests

#### Phase 6 - Intégrations et finalisation (5 jours)
- Intégrations complètes (Ventes, Trésorerie)
- Tâches cron (expirations, relances)
- Dashboard fidélité
- Tests d'intégration
- Documentation API

#### Phase 7 - Marketing automation (4 jours)
- Campagnes par segment
- Relances automatiques
- Emails/SMS fidélité
- Tests

---

## 10. Cas d'usage détaillés

### 10.1 Cas d'usage : Inscription et attribution tier

**Acteur** : Commercial

**Scénario** :
1. Commercial crée un nouveau client
   ```
   Nom: Marie Kouassi
   Téléphone: +225 07 12 34 56 78
   Email: marie.k@example.com
   ```
2. Système génère code: `CUS-0042`
3. Attribution automatique tier Bronze
4. Récupération config LoyaltyTierConfig (Bronze)
   - WelcomeBonus: 100 points
5. Création LoyaltyTransaction
   ```
   Type: earn
   Points: +100
   Description: "Bonus bienvenue tier Bronze"
   ```
6. Mise à jour Customer
   ```
   LoyaltyPoints: 100
   TotalPointsEarned: 100
   MemberSince: 2025-11-14
   ```
7. Notification SMS/Email: "Bienvenue ! Vous avez reçu 100 points"

### 10.2 Cas d'usage : Achat et gain de points automatique

**Acteur** : Client, Commercial

**Scénario** :
1. Client Marie effectue un achat de 50,000 FCFA
2. Commercial finalise la vente
3. **Déclenchement automatique** dans `SaleService.finalize()`:
   ```typescript
   await loyaltyService.earnPoints({
     customerId: sale.CustomerId,
     referenceId: sale.SaleId,
     referenceType: 'sale',
     referenceNumber: sale.SaleNumber,
     description: `Points sur vente ${sale.SaleNumber}`,
   });
   ```
4. LoyaltyService récupère tier client: Bronze
   - PointsEarnRate: 5%
5. Calcul points: 50,000 * 5% = 2,500 points
6. Création LoyaltyTransaction
   ```
   Type: earn
   Points: +2,500
   BalanceBefore: 100
   BalanceAfter: 2,600
   ```
7. Mise à jour Customer
   ```
   LoyaltyPoints: 2,600
   TotalPointsEarned: 2,600
   TotalOrders: 1
   TotalSpent: 50,000
   LastOrderDate: 2025-11-14
   ```
8. Vérification upgrade tier
   - Tier Silver: MinimumSpent = 100,000 → NON
   - Reste Bronze
9. Notification: "Vous avez gagné 2,500 points !"

### 10.3 Cas d'usage : Upgrade automatique de tier

**Acteur** : Client, Système

**Scénario** :
1. Client Marie effectue un 3e achat de 60,000 FCFA
2. Total dépensé cumul: 150,000 FCFA
3. Après gain points, système appelle `checkAndUpgradeTier()`
4. Vérification tiers du + haut au + bas:
   - **Gold**: MinimumSpent = 500,000 → NON
   - **Silver**: MinimumSpent = 100,000 → OUI ✅
5. Tier actuel (Bronze) < Tier éligible (Silver)
6. **Upgrade !**
   - Update Customer.LoyaltyTier = 'silver'
7. Récupération config Silver
   - WelcomeBonus: 500 points
8. Attribution bonus
   ```
   LoyaltyPoints: 10,100 → 10,600
   ```
9. Notification push/email/SMS:
   ```
   Félicitations ! Vous êtes passé au tier Silver !
   Vous bénéficiez maintenant de:
   - 7% de points sur vos achats
   - Livraison gratuite
   - Support prioritaire
   + 500 points bonus !
   ```

### 10.4 Cas d'usage : Échange de points contre récompense

**Acteur** : Client

**Scénario** :
1. Client consulte catalogue récompenses
2. Sélectionne "Remise de 10% sur prochaine commande"
   ```
   PointsCost: 1,000 points
   DiscountPercentage: 10%
   MinimumTier: Bronze
   ValidUntil: 2025-12-31
   ```
3. Clique "Échanger mes points"
4. **Vérifications** :
   - Points client (10,600) ≥ PointsCost (1,000) ✅
   - Tier (Silver) ≥ MinimumTier (Bronze) ✅
   - Date actuelle < ValidUntil ✅
   - MaxRedemptions non dépassé ✅
5. Création CustomerReward
   ```
   Status: available
   PointsSpent: 1,000
   DiscountPercentage: 10%
   ExpiresAt: 2025-12-31
   ```
6. Déduction points via LoyaltyService
   ```
   Type: redeem
   Points: -1,000
   BalanceBefore: 10,600
   BalanceAfter: 9,600
   ```
7. Mise à jour Customer
   ```
   LoyaltyPoints: 9,600
   TotalPointsRedeemed: 1,000
   ```
8. Mise à jour LoyaltyReward
   ```
   TotalRedeemed: 42 → 43
   ```
9. Notification: "Récompense disponible ! Utilisez-la lors de votre prochain achat"

### 10.5 Cas d'usage : Utilisation récompense en vente

**Acteur** : Client, Commercial

**Scénario** :
1. Client revient avec récompense active
2. Commercial crée nouvelle vente: 80,000 FCFA
3. Système détecte CustomerReward disponible
4. Affichage popup: "Le client a une remise de 10% disponible"
5. Commercial applique la récompense
6. Calcul:
   ```
   Total original: 80,000 FCFA
   Remise 10%: -8,000 FCFA
   Total final: 72,000 FCFA
   ```
7. Mise à jour CustomerReward
   ```
   Status: available → redeemed
   UsedAt: 2025-11-20
   UsedInSaleId: SAL-2025-0156
   ```
8. Finalisation vente à 72,000 FCFA
9. Gain de points sur montant final (72,000 * 7% = 5,040 points)

### 10.6 Cas d'usage : Segmentation et campagne marketing

**Acteur** : Responsable marketing, Système

**Scénario** :
1. **Création segment "Clients inactifs"** :
   ```
   Criteria:
     lastOrderDaysAgo: 60
     minTotalSpent: 50,000
   ```
2. Tâche cron quotidienne recalcule le segment
3. Filtre Airtable:
   ```
   AND(
     {LastOrderDate} < TODAY() - 60,
     {TotalSpent} >= 50000
   )
   ```
4. Résultat: 87 clients
5. Mise à jour CustomerSegment
   ```
   CustomerCount: 87
   TotalRevenue: 6,540,000
   LastCalculatedAt: 2025-11-14
   ```
6. **Lancement campagne** :
   - Responsable marketing crée promotion spéciale
   - Envoi email/SMS aux 87 clients
   - Offre: "20% de réduction + 500 points bonus"
7. **Suivi résultats** :
   - Taux ouverture
   - Taux conversion
   - Revenu généré

---

## 11. Points d'attention et bonnes pratiques

### 11.1 Sécurité et conformité

1. **Données personnelles** :
   - Consentement RGPD pour marketing
   - Chiffrement des données sensibles
   - Respect du droit à l'oubli
   - Export de données sur demande

2. **Anti-fraude** :
   - Limiter les ajustements manuels de points
   - Logs de toutes les opérations fidélité
   - Alertes sur comportements anormaux
   - Validation humaine pour gros montants

3. **Expiration** :
   - Points expirent après 12 mois par défaut
   - Notification 30 jours avant expiration
   - Récompenses expirent selon configuration
   - Pas d'expiration pour tiers VIP (optionnel)

### 11.2 Performance

1. **Calculs** :
   - Cache du tier actuel dans Customer
   - Éviter recalculs inutiles
   - Index sur (CustomerId, CreatedAt) pour transactions
   - Pagination des listes

2. **Segmentation** :
   - Calcul asynchrone en arrière-plan
   - Cache des résultats
   - Recalcul quotidien seulement
   - Limiter complexité des critères

3. **Notifications** :
   - Queue asynchrone
   - Batching pour campagnes
   - Rate limiting

### 11.3 UX/UI

1. **Gamification** :
   - Animations gain de points
   - Badges visuels pour tiers
   - Barres de progression
   - Notifications engageantes

2. **Transparence** :
   - Historique complet visible
   - Calcul points expliqué
   - Conditions récompenses claires
   - Progression tier affichée

3. **Accessibilité** :
   - Interface mobile optimisée
   - Support multi-langues
   - Notifications SMS pour non-connectés

### 11.4 Business

1. **Équilibre économique** :
   - Ratio points/devise bien calibré
   - Valeur récompenses attractive mais viable
   - Suivre coût programme fidélité
   - ROI sur rétention vs acquisition

2. **Engagement** :
   - Relances clients inactifs
   - Campagnes anniversaire
   - Offres exclusives par tier
   - Programme parrainage (évolution future)

3. **Analyse** :
   - Taux rétention par tier
   - Fréquence d'achat
   - Panier moyen par segment
   - ROI par campagne

---

## 12. Évolutions futures

### 12.1 Court terme (3-6 mois)

1. **Programme parrainage** :
   - Points bonus parrain + filleul
   - Tracking références
   - Récompenses paliers

2. **Application mobile client** :
   - Consultation solde points
   - Catalogue récompenses
   - Historique achats
   - Notifications push

3. **Gamification avancée** :
   - Défis mensuels
   - Badges achievements
   - Classements

### 12.2 Moyen terme (6-12 mois)

1. **IA et personnalisation** :
   - Recommandations produits
   - Prédiction churn
   - Segmentation prédictive
   - Offres personnalisées

2. **Intégration partenaires** :
   - Points multi-enseignes
   - Récompenses partenaires
   - Marketplaces

3. **Social CRM** :
   - Intégration réseaux sociaux
   - Avis publics partagés
   - Influenceurs identifiés

### 12.3 Long terme (12+ mois)

1. **Blockchain fidélité** :
   - Points tokenisés
   - Échange inter-enseignes
   - Traçabilité totale

2. **Metaverse & NFT** :
   - Récompenses NFT
   - Expériences virtuelles
   - Produits exclusifs digitaux

---

## 13. Conclusion

Le module **Clients & Fidélité** est un module stratégique pour maximiser la valeur vie client (CLV) et la rétention.

✅ **8 interfaces TypeScript** définies
✅ **7 services backend** spécifiés (~3050 lignes)
✅ **65 routes API** documentées
✅ **8 pages UI** conçues
✅ **3 intégrations** avec autres modules
✅ **Workflows automatisés** (points, upgrade tier, expirations)
✅ **Gamification** et engagement client
✅ **CRM de base** inclus

**Impact business attendu** :
- **+30% rétention client** grâce au programme fidélité
- **+20% panier moyen** via récompenses incitatives
- **+40% données client** collectées
- **Réduction coût acquisition** grâce à la rétention

**Prochaines étapes** :
1. Validation architecture avec parties prenantes
2. Définition KPIs et objectifs chiffrés
3. Développement par phases (38 jours estimés)
4. Tests A/B sur taux points et récompenses
5. Formation équipes commerciales
6. Lancement progressif avec early adopters

**Priorité de développement** : Haute
**Complexité** : Très élevée
**ROI attendu** : Très élevé (rétention > acquisition)

---

**Document créé le** : 14 novembre 2025
**Version** : 1.0
**Auteur** : Équipe DDM
