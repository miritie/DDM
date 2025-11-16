# Module 7.9 - IA Prédictive & Aide à la Décision
## Spécification Technique Complète

---

## 1. Vue d'ensemble

### 1.1 Objectif du module
Le module **IA Prédictive & Aide à la Décision** analyse l'ensemble des données de l'entreprise pour suggérer automatiquement des réponses aux sollicitations (dépenses, commandes, investissements, etc.) et aider à la prise de décision stratégique et opérationnelle.

### 1.2 Priorité
**TRÈS HAUTE** - Module différenciateur, apporte une valeur ajoutée majeure par l'automatisation intelligente

### 1.3 Dépendances
- **Tous les modules** : Analyse des données de tous les modules
- **Module 7.5 - Dépenses** : Approbation automatique de dépenses
- **Module 7.1 - Stock** : Réapprovisionnement prédictif
- **Module 7.4 - Production** : Ordres de production optimisés
- **Module 7.3 - Ventes** : Prévisions de ventes
- **Module 7.8 - Clients** : Recommandations personnalisées

### 1.4 État actuel
- **Backend** : 0%
- **Frontend** : 0%
- **Documentation** : En cours

---

## 2. Architecture des données

### 2.1 Modèle de données complet

```typescript
export type DecisionType =
  | 'expense_approval'      // Approbation de dépense
  | 'purchase_order'        // Commande fournisseur
  | 'production_order'      // Ordre de production
  | 'stock_replenishment'   // Réapprovisionnement stock
  | 'price_adjustment'      // Ajustement prix
  | 'credit_approval'       // Approbation crédit client
  | 'supplier_selection'    // Sélection fournisseur
  | 'investment'            // Investissement
  | 'hiring'                // Recrutement
  | 'custom';               // Décision personnalisée

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'overridden' | 'expired';

export type RuleTriggerType =
  | 'automatic'             // Automatique systématique
  | 'threshold'             // Basé sur un seuil
  | 'scheduled'             // Planifié
  | 'event_based'           // Basé sur événement
  | 'manual';               // Manuel

export type RuleConditionOperator =
  | 'equals' | 'not_equals'
  | 'greater_than' | 'greater_than_or_equal'
  | 'less_than' | 'less_than_or_equal'
  | 'contains' | 'not_contains'
  | 'in' | 'not_in' | 'between';

export type RecommendationConfidence = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export interface DecisionRule {
  RuleId: string;
  RuleCode: string; // RULE-001
  Name: string;
  Description: string;
  DecisionType: DecisionType;

  // Déclenchement
  TriggerType: RuleTriggerType;
  IsActive: boolean;
  Priority: number;

  // Conditions
  Conditions: Array<{
    field: string;
    operator: RuleConditionOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>;

  // Action recommandée
  RecommendedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
  CustomActionData?: Record<string, any>;

  // Automatisation
  AutoExecute: boolean;
  RequiresApproval: boolean;
  ApproverRoles?: string[];

  // Seuils
  ThresholdAmount?: number;
  ThresholdQuantity?: number;
  ThresholdPercentage?: number;

  // Contexte
  ApplicableWorkspaces?: string[];
  ApplicableUsers?: string[];
  ApplicableDepartments?: string[];

  // Notification
  NotifyOnTrigger: boolean;
  NotifyUsers?: string[];
  NotifyRoles?: string[];

  // Performance
  TotalTriggered: number;
  TotalAutoExecuted: number;
  TotalApproved: number;
  TotalRejected: number;
  TotalOverridden: number;
  SuccessRate?: number;

  // Métadonnées
  Tags?: string[];
  Notes?: string;

  CreatedById: string;
  CreatedByName: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DecisionRecommendation {
  RecommendationId: string;
  DecisionType: DecisionType;

  // Contexte
  ReferenceId: string;
  ReferenceType: string;
  ReferenceNumber?: string;
  ReferenceData: Record<string, any>;

  // Règle appliquée
  RuleId?: string;
  RuleName?: string;

  // Recommandation
  RecommendedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
  Confidence: RecommendationConfidence;
  ConfidenceScore: number; // 0-100

  // Justification
  Reasoning: string;
  FactorsConsidered: Array<{
    factor: string;
    value: any;
    weight: number;
    impact: 'positive' | 'negative' | 'neutral';
  }>;

  // Prédictions
  PredictedOutcome?: {
    success_probability: number;
    estimated_roi?: number;
    estimated_cost?: number;
    estimated_revenue?: number;
    estimated_timeline?: number;
    risks?: string[];
    opportunities?: string[];
  };

  // Alternatives
  Alternatives?: Array<{
    action: string;
    description: string;
    pros: string[];
    cons: string[];
    estimated_impact: number;
  }>;

  // Statut
  Status: DecisionStatus;
  AutoExecuted: boolean;

  // Décision finale
  FinalDecision?: 'approve' | 'reject' | 'defer';
  DecidedById?: string;
  DecidedByName?: string;
  DecidedAt?: string;
  DecisionNotes?: string;

  // Override
  WasOverridden: boolean;
  OverrideReason?: string;

  // Feedback
  OutcomeActual?: 'success' | 'failure' | 'partial';
  OutcomeNotes?: string;
  LearningData?: Record<string, any>;

  ExpiresAt?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AIApprovalProfile {
  ProfileId: string;
  Name: string;
  Description?: string;

  // Utilisateur
  UserId: string;
  UserName: string;
  UserRole: string;

  // Configuration
  IsActive: boolean;
  DefaultMode: 'automatic' | 'assisted' | 'manual';

  // Règles par type
  DecisionConfigs: Array<{
    decisionType: DecisionType;
    mode: 'automatic' | 'assisted' | 'manual' | 'disabled';
    autoApproveThreshold?: number;
    requireReviewThreshold?: number;
    applicableCategories?: string[];
    allowedDays?: number[];
    allowedHoursStart?: string;
    allowedHoursEnd?: string;
    notifyOnAutoApproval: boolean;
  }>;

  // Limites
  DailyAutoApprovalLimit?: number;
  WeeklyAutoApprovalLimit?: number;
  MonthlyAutoApprovalLimit?: number;
  DailySpendingLimit?: number;
  WeeklySpendingLimit?: number;
  MonthlySpendingLimit?: number;

  // Statistiques
  TotalAutoApprovals: number;
  TotalAssistedDecisions: number;
  TotalOverrides: number;
  OverrideRate?: number;

  // Délégation
  DelegateToUserId?: string;
  DelegationStartDate?: string;
  DelegationEndDate?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

### 2.2 Tables Airtable

#### Table: DecisionRule
| Champ | Type | Description |
|-------|------|-------------|
| RuleId | Single line text (Primary) | Identifiant unique UUID |
| RuleCode | Single line text | Code règle (RULE-001) |
| Name | Single line text | Nom de la règle |
| Description | Long text | Description |
| DecisionType | Single select | Type de décision |
| TriggerType | Single select | Type déclenchement |
| IsActive | Checkbox | Règle active |
| Priority | Number | Priorité (1-100) |
| Conditions | Long text (JSON) | Conditions d'application |
| RecommendedAction | Single select | Action recommandée |
| CustomActionData | Long text (JSON) | Données action personnalisée |
| AutoExecute | Checkbox | Exécution automatique |
| RequiresApproval | Checkbox | Nécessite approbation |
| ApproverRoles | Multiple select | Rôles approbateurs |
| ThresholdAmount | Currency | Seuil montant |
| ThresholdQuantity | Number | Seuil quantité |
| ThresholdPercentage | Percent | Seuil pourcentage |
| ApplicableWorkspaces | Long text (JSON) | Workspaces applicables |
| NotifyOnTrigger | Checkbox | Notification au déclenchement |
| NotifyUsers | Long text (JSON) | Utilisateurs à notifier |
| TotalTriggered | Number | Total déclenchements |
| TotalAutoExecuted | Number | Total auto-exécutés |
| TotalApproved | Number | Total approuvés |
| TotalRejected | Number | Total rejetés |
| TotalOverridden | Number | Total overridden |
| SuccessRate | Percent | Taux de succès |
| Tags | Multiple select | Tags |
| Notes | Long text | Notes |
| CreatedById | Single line text | ID créateur |
| CreatedByName | Single line text | Nom créateur |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: DecisionRecommendation
| Champ | Type | Description |
|-------|------|-------------|
| RecommendationId | Single line text (Primary) | Identifiant unique UUID |
| DecisionType | Single select | Type de décision |
| ReferenceId | Single line text | ID référence |
| ReferenceType | Single line text | Type référence |
| ReferenceNumber | Single line text | Numéro référence |
| ReferenceData | Long text (JSON) | Données référence |
| RuleId | Single line text | ID règle appliquée |
| RuleName | Single line text | Nom règle |
| RecommendedAction | Single select | Action recommandée |
| Confidence | Single select | Niveau confiance |
| ConfidenceScore | Number | Score confiance (0-100) |
| Reasoning | Long text | Justification |
| FactorsConsidered | Long text (JSON) | Facteurs considérés |
| PredictedOutcome | Long text (JSON) | Résultat prédit |
| Alternatives | Long text (JSON) | Alternatives |
| Status | Single select | Statut |
| AutoExecuted | Checkbox | Auto-exécuté |
| FinalDecision | Single select | Décision finale |
| DecidedById | Single line text | ID décideur |
| DecidedByName | Single line text | Nom décideur |
| DecidedAt | Date | Date décision |
| DecisionNotes | Long text | Notes décision |
| WasOverridden | Checkbox | A été overridden |
| OverrideReason | Long text | Raison override |
| OutcomeActual | Single select | Résultat réel |
| OutcomeNotes | Long text | Notes résultat |
| LearningData | Long text (JSON) | Données apprentissage |
| ExpiresAt | Date | Date expiration |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: AIApprovalProfile
| Champ | Type | Description |
|-------|------|-------------|
| ProfileId | Single line text (Primary) | Identifiant unique UUID |
| Name | Single line text | Nom du profil |
| Description | Long text | Description |
| UserId | Single line text | ID utilisateur |
| UserName | Single line text | Nom utilisateur |
| UserRole | Single select | Rôle utilisateur |
| IsActive | Checkbox | Profil actif |
| DefaultMode | Single select | Mode par défaut |
| DecisionConfigs | Long text (JSON) | Configurations par type |
| DailyAutoApprovalLimit | Number | Limite quotidienne |
| WeeklyAutoApprovalLimit | Number | Limite hebdomadaire |
| MonthlyAutoApprovalLimit | Number | Limite mensuelle |
| DailySpendingLimit | Currency | Dépenses quotidiennes max |
| WeeklySpendingLimit | Currency | Dépenses hebdomadaires max |
| MonthlySpendingLimit | Currency | Dépenses mensuelles max |
| TotalAutoApprovals | Number | Total approbations auto |
| TotalAssistedDecisions | Number | Total décisions assistées |
| TotalOverrides | Number | Total overrides |
| OverrideRate | Percent | Taux override |
| DelegateToUserId | Single line text | ID délégué |
| DelegateToUserName | Single line text | Nom délégué |
| DelegationStartDate | Date | Début délégation |
| DelegationEndDate | Date | Fin délégation |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: PredictiveModel
| Champ | Type | Description |
|-------|------|-------------|
| ModelId | Single line text (Primary) | Identifiant unique UUID |
| ModelCode | Single line text | Code modèle (MODEL-001) |
| Name | Single line text | Nom |
| Description | Long text | Description |
| Type | Single select | classification, regression, forecasting |
| Domain | Single select | Domaine application |
| DecisionTypes | Multiple select | Types de décisions |
| Algorithm | Single line text | Algorithme |
| Version | Single line text | Version |
| TrainingDataset | Long text (JSON) | Dataset entraînement |
| Metrics | Long text (JSON) | Métriques performance |
| Hyperparameters | Long text (JSON) | Hyperparamètres |
| FeatureImportance | Long text (JSON) | Importance features |
| Status | Single select | Statut |
| IsActive | Checkbox | Modèle actif |
| LastTrainedAt | Date | Dernier entraînement |
| TrainingDuration | Number | Durée entraînement (sec) |
| TotalPredictions | Number | Total prédictions |
| TotalCorrect | Number | Total correctes |
| SuccessRate | Percent | Taux de succès |
| Tags | Multiple select | Tags |
| Notes | Long text | Notes |
| CreatedById | Single line text | ID créateur |
| CreatedByName | Single line text | Nom créateur |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: AIInsight
| Champ | Type | Description |
|-------|------|-------------|
| InsightId | Single line text (Primary) | Identifiant unique UUID |
| Type | Single select | trend, anomaly, opportunity, risk |
| Subject | Single line text | Sujet |
| Description | Long text | Description |
| Severity | Single select | low, medium, high, critical |
| Domain | Single select | Domaine |
| Data | Long text (JSON) | Données |
| Metrics | Long text (JSON) | Métriques |
| ChartType | Single select | Type graphique |
| ChartData | Long text (JSON) | Données graphique |
| EstimatedImpact | Long text (JSON) | Impact estimé |
| SuggestedActions | Long text (JSON) | Actions suggérées |
| Status | Single select | new, acknowledged, actioned, dismissed |
| AcknowledgedById | Single line text | ID qui a pris connaissance |
| AcknowledgedAt | Date | Date prise connaissance |
| ActionTaken | Long text | Action prise |
| ActionedAt | Date | Date action |
| ModelId | Single line text | ID modèle |
| ConfidenceScore | Number | Score confiance |
| ExpiresAt | Date | Date expiration |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: DecisionAuditLog
| Champ | Type | Description |
|-------|------|-------------|
| AuditLogId | Single line text (Primary) | Identifiant unique UUID |
| RecommendationId | Single line text | ID recommandation |
| DecisionType | Single select | Type décision |
| ReferenceId | Single line text | ID référence |
| ReferenceType | Single line text | Type référence |
| RecommendedAction | Single select | Action recommandée |
| Confidence | Single select | Confiance |
| ConfidenceScore | Number | Score confiance |
| FinalDecision | Single select | Décision finale |
| WasAutoExecuted | Checkbox | Auto-exécuté |
| WasOverridden | Checkbox | Overridden |
| DecidedById | Single line text | ID décideur |
| DecidedByName | Single line text | Nom décideur |
| DecidedByRole | Single line text | Rôle décideur |
| DecisionTime | Number | Temps décision (ms) |
| DecisionMethod | Single select | automatic, assisted, manual |
| OutcomeActual | Single select | Résultat réel |
| OutcomeEvaluatedAt | Date | Date évaluation résultat |
| EstimatedImpact | Currency | Impact estimé |
| ActualImpact | Currency | Impact réel |
| UserSatisfaction | Number | Satisfaction (1-5) |
| FeedbackComments | Long text | Commentaires feedback |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |

#### Table: AIConfiguration
| Champ | Type | Description |
|-------|------|-------------|
| ConfigId | Single line text (Primary) | Identifiant unique UUID |
| WorkspaceId | Single line text | ID workspace |
| IsAIEnabled | Checkbox | IA activée |
| EnabledModules | Long text (JSON) | Modules activés |
| MinimumConfidenceThreshold | Number | Seuil confiance min |
| DefaultAutoExecuteThreshold | Number | Seuil auto-exécution |
| EnableContinuousLearning | Checkbox | Apprentissage continu |
| LearningRate | Number | Taux apprentissage |
| RetrainingFrequency | Single select | Fréquence réentraînement |
| NotifyOnLowConfidence | Checkbox | Notifier confiance faible |
| NotifyOnOverride | Checkbox | Notifier override |
| NotifyOnAnomalies | Checkbox | Notifier anomalies |
| MaxRecommendationsPerDay | Number | Max recommandations/jour |
| MaxAutoExecutionsPerDay | Number | Max auto-exécutions/jour |
| DataRetentionDays | Number | Rétention données (jours) |
| ExternalAIProvider | Single select | Fournisseur IA externe |
| ExternalAPIKey | Single line text | Clé API externe |
| LastUpdatedById | Single line text | ID dernier modificateur |
| LastUpdatedByName | Single line text | Nom dernier modificateur |
| UpdatedAt | Last modified time | Date modification |
| CreatedAt | Created time | Date création |

---

## 3. Workflows et processus métier

### 3.1 Workflow - Approbation automatique de dépense

```
┌──────────────────┐
│  Création        │
│  ExpenseRequest  │
│  Amount: 5,000   │
└────────┬─────────┘
         │
         v
┌────────────────────────────┐
│ Déclenchement IA           │
│ Event: expense_created     │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Récupération profil IA    │
│ AIApprovalProfile du       │
│ responsable concerné       │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Vérification configuration │
│ DecisionType: expense      │
│ Mode: automatic            │
│ AutoApproveThreshold:      │
│   10,000 FCFA              │
└────────┬───────────────────┘
         │
         ├─── Amount > Threshold ──> Mode: assisted
         │                                  │
         │                                  v
         │                           Recommandation
         │                           sans auto-exécution
         │
         └─── Amount ≤ Threshold ──> Continue
                                          │
                                          v
                                   ┌──────────────┐
                                   │ Recherche    │
                                   │ DecisionRule │
                                   │ applicable   │
                                   └──────┬───────┘
                                          │
                                          v
                                   ┌──────────────┐
                                   │ Évaluation   │
                                   │ conditions:  │
                                   │ - Catégorie  │
                                   │ - Montant    │
                                   │ - Urgence    │
                                   │ - Historique │
                                   └──────┬───────┘
                                          │
                                          v
                                   ┌──────────────┐
                                   │ Analyse ML   │
                                   │ - Patterns   │
                                   │ - Historique │
                                   │ - Context    │
                                   │ Confidence:  │
                                   │   95%        │
                                   └──────┬───────┘
                                          │
                                          v
                                   ┌──────────────┐
                                   │ Création     │
                                   │ DecisionReco │
                                   │ Recommended: │
                                   │   approve    │
                                   │ Confidence:  │
                                   │   very_high  │
                                   └──────┬───────┘
                                          │
                                          v
                                   ┌──────────────┐
                                   │ AUTO-        │
                                   │ EXECUTION    │
                                   │ Approve      │
                                   │ expense      │
                                   └──────┬───────┘
                                          │
                                          v
                                   ┌──────────────┐
                                   │ Notification │
                                   │ "Dépense     │
                                   │  approuvée   │
                                   │  automatique │
                                   │  par IA"     │
                                   └──────────────┘
```

### 3.2 Workflow - Recommandation assistée (seuil dépassé)

```
┌──────────────────┐
│  Création        │
│  ExpenseRequest  │
│  Amount: 50,000  │
└────────┬─────────┘
         │
         v
┌────────────────────────────┐
│ Profil IA                  │
│ AutoApproveThreshold:      │
│   10,000 FCFA              │
│ RequireReviewThreshold:    │
│   40,000 FCFA              │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Amount > RequireReview     │
│ Mode: assisted             │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Analyse complète IA        │
│ - Historique similaires    │
│ - Budget disponible        │
│ - ROI estimé               │
│ - Alternatives             │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Création recommandation    │
│ Recommended: approve       │
│ Confidence: high (85%)     │
│ Reasoning:                 │
│ "Dépense cohérente avec    │
│  budget Q4, ROI estimé     │
│  120% sur 6 mois"          │
│                            │
│ FactorsConsidered:         │
│ - Budget Q4: 500,000       │
│ - Dépensé: 200,000         │
│ - ROI moyen catégorie: 110%│
│                            │
│ PredictedOutcome:          │
│ - success_probability: 85% │
│ - estimated_roi: 120%      │
│ - estimated_timeline: 180d │
│                            │
│ Alternatives:              │
│ 1. Différer au Q1 2026     │
│ 2. Réduire montant -20%    │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Notification responsable   │
│ "Nouvelle recommandation   │
│  nécessite votre avis"     │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Responsable consulte       │
│ Interface décision         │
│ - Voit recommandation IA   │
│ - Voit justification       │
│ - Voit alternatives        │
└────────┬───────────────────┘
         │
         ├─── Accepte recommandation ──> Approve
         │                                    │
         │                                    v
         │                             Update status
         │                             Log: WasOverridden=false
         │
         ├─── Rejette ────────────────> Reject
         │                                    │
         │                                    v
         │                             Override=true
         │                             OverrideReason
         │                             Log pour learning
         │
         └─── Choisit alternative ───> Custom action
                                             │
                                             v
                                       Execute alternative
                                       Log feedback
```

### 3.3 Workflow - Réapprovisionnement stock prédictif

```
┌──────────────────┐
│  Tâche cron      │
│  quotidienne     │
│  Analyse stock   │
└────────┬─────────┘
         │
         v
┌────────────────────────────┐
│ Pour chaque produit        │
│ Analyse:                   │
│ - Stock actuel             │
│ - Ventes moyennes          │
│ - Tendances saisonnières   │
│ - Délais fournisseur       │
│ - Commandes en cours       │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Modèle prédictif           │
│ PredictiveModel            │
│ Type: forecasting          │
│ Domain: inventory          │
│                            │
│ Prévision demande:         │
│ J+7: 150 unités            │
│ J+14: 320 unités           │
│ J+30: 680 unités           │
│                            │
│ Point de commande:         │
│ Stock actuel: 200          │
│ Safety stock: 100          │
│ Lead time: 7 jours         │
│ Prévision 7j: 150          │
│ → Recommande: 50 unités    │
└────────┬───────────────────┘
         │
         ├─── Stock > Point commande ──> Aucune action
         │
         └─── Stock ≤ Point commande ──> Continue
                                              │
                                              v
                                       ┌──────────────┐
                                       │ Création     │
                                       │ DecisionReco │
                                       │ Type:        │
                                       │ purchase_order│
                                       │              │
                                       │ Recommended: │
                                       │ Order 250u   │
                                       │              │
                                       │ Reasoning:   │
                                       │ "Stock crit  │
                                       │  dans 5j"    │
                                       └──────┬───────┘
                                              │
                                              v
                                       ┌──────────────┐
                                       │ Profil IA    │
                                       │ acheteur     │
                                       │ Mode: auto   │
                                       │ pour < 500u  │
                                       └──────┬───────┘
                                              │
                                              v
                                       ┌──────────────┐
                                       │ AUTO-CREATE  │
                                       │ PurchaseOrder│
                                       │ Quantity: 250│
                                       │ Supplier:    │
                                       │ (best price) │
                                       └──────┬───────┘
                                              │
                                              v
                                       ┌──────────────┐
                                       │ Notification │
                                       │ "Commande    │
                                       │  créée auto  │
                                       │  par IA"     │
                                       └──────────────┘
```

### 3.4 Workflow - Apprentissage continu

```
┌──────────────────┐
│  Décision prise  │
│  (auto ou manuel)│
└────────┬─────────┘
         │
         v
┌────────────────────────────┐
│ Création DecisionAuditLog  │
│ - Recommandation IA        │
│ - Décision finale          │
│ - Override?                │
│ - Temps de décision        │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Attente résultat           │
│ (configuré par type)       │
│                            │
│ Expense: 30 jours          │
│ Purchase: à réception      │
│ Production: à fin ordre    │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Évaluation résultat        │
│ OutcomeActual:             │
│ - success / failure        │
│                            │
│ Métriques:                 │
│ - ROI réel vs estimé       │
│ - Délai réel vs estimé     │
│ - Coût réel vs estimé      │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Mise à jour statistiques   │
│ DecisionRule:              │
│ - TotalTriggered++         │
│ - TotalApproved++ (si OK)  │
│ - SuccessRate recalculé    │
│                            │
│ PredictiveModel:           │
│ - TotalPredictions++       │
│ - TotalCorrect++ (si OK)   │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Apprentissage              │
│ Si WasOverridden:          │
│ - Analyser écart           │
│ - Ajuster poids features   │
│ - Mettre à jour règles     │
│                            │
│ Si OutcomeActual ≠ prédit: │
│ - Enregistrer cas          │
│ - Ajouter au dataset       │
│ - Marquer pour retraining  │
└────────┬───────────────────┘
         │
         v
┌────────────────────────────┐
│ Tâche hebdomadaire:        │
│ Réentraînement modèles     │
│ - Dataset enrichi          │
│ - Hyperparamètres ajustés  │
│ - Validation croisée       │
│ - Déploiement si meilleur  │
└────────────────────────────┘
```

---

## 4. Spécifications des services

### 4.1 DecisionEngineService

**Fichier** : `lib/modules/ai/decision-engine-service.ts`

**Responsabilités** :
- Moteur de décision principal
- Évaluation des règles
- Génération de recommandations
- Auto-exécution si autorisé

**Méthodes** :

```typescript
export class DecisionEngineService {
  // Analyse et recommandation pour une décision
  async analyzeAndRecommend(input: AnalyzeDecisionInput): Promise<DecisionRecommendation>
  // 1. Récupère profil IA de l'utilisateur concerné
  // 2. Vérifie mode (automatic/assisted/manual)
  // 3. Recherche règles applicables
  // 4. Évalue conditions de chaque règle
  // 5. Applique modèle ML si disponible
  // 6. Calcule score de confiance
  // 7. Génère justification
  // 8. Prédit résultat
  // 9. Propose alternatives
  // 10. Auto-exécute si autorisé et confiance suffisante

  // Évaluation d'une règle spécifique
  async evaluateRule(
    rule: DecisionRule,
    context: Record<string, any>
  ): Promise<{
    matches: boolean;
    confidence: number;
    reasoning: string;
  }>

  // Auto-exécution d'une décision
  async autoExecuteDecision(
    recommendation: DecisionRecommendation
  ): Promise<void>
  // Exécute l'action selon le type de décision
  // Ex: Approve expense, Create purchase order, etc.

  // Décision manuelle par utilisateur
  async recordDecision(input: RecordDecisionInput): Promise<DecisionRecommendation>
  // Met à jour la recommandation avec la décision finale
  // Enregistre override si différent de recommandation
  // Crée DecisionAuditLog

  // Feedback sur résultat
  async recordOutcome(
    recommendationId: string,
    outcome: 'success' | 'failure' | 'partial',
    notes?: string,
    metrics?: Record<string, number>
  ): Promise<void>
  // Enregistre le résultat réel
  // Alimente l'apprentissage continu

  // Recommandations en attente
  async getPendingRecommendations(
    userId: string,
    filters?: {
      decisionType?: DecisionType;
      minConfidence?: number;
    }
  ): Promise<DecisionRecommendation[]>

  // Statistiques
  async getStatistics(
    workspaceId: string,
    period?: { start: string; end: string }
  ): Promise<{
    totalRecommendations: number;
    totalAutoExecuted: number;
    totalOverridden: number;
    averageConfidence: number;
    successRate: number;
    byDecisionType: Record<DecisionType, {
      total: number;
      autoExecuted: number;
      overridden: number;
      successRate: number;
    }>;
  }>
}
```

**Inputs** :

```typescript
export interface AnalyzeDecisionInput {
  decisionType: DecisionType;
  referenceId: string;
  referenceType: string;
  referenceNumber?: string;
  referenceData: Record<string, any>;
  userId?: string; // Utilisateur concerné pour récupérer son profil
  workspaceId: string;
}

export interface RecordDecisionInput {
  recommendationId: string;
  decision: 'approve' | 'reject' | 'defer';
  decidedById: string;
  notes?: string;
}
```

### 4.2 RuleEngineService

**Fichier** : `lib/modules/ai/rule-engine-service.ts`

**Responsabilités** :
- Gestion des règles de décision
- Évaluation des conditions
- Priorisation des règles

**Méthodes** :

```typescript
export class RuleEngineService {
  // Génération code règle
  async generateRuleCode(workspaceId: string): Promise<string>
  // Format: RULE-001, RULE-002...

  // Création règle
  async create(input: CreateRuleInput): Promise<DecisionRule>

  // Lecture
  async getById(ruleId: string): Promise<DecisionRule | null>
  async getByCode(code: string, workspaceId: string): Promise<DecisionRule | null>

  // Liste avec filtres
  async list(
    workspaceId: string,
    filters?: {
      decisionType?: DecisionType;
      isActive?: boolean;
      triggerType?: RuleTriggerType;
    }
  ): Promise<DecisionRule[]>

  // Mise à jour
  async update(
    ruleId: string,
    updates: Partial<DecisionRule>
  ): Promise<DecisionRule>

  // Activation/Désactivation
  async activate(ruleId: string): Promise<DecisionRule>
  async deactivate(ruleId: string): Promise<DecisionRule>

  // Recherche règles applicables
  async findApplicableRules(
    decisionType: DecisionType,
    context: Record<string, any>,
    workspaceId: string
  ): Promise<DecisionRule[]>
  // Retourne règles actives applicables, triées par priorité DESC

  // Évaluation des conditions d'une règle
  async evaluateConditions(
    conditions: DecisionRule['Conditions'],
    context: Record<string, any>
  ): Promise<boolean>

  // Test d'une règle
  async testRule(
    ruleId: string,
    testContext: Record<string, any>
  ): Promise<{
    matches: boolean;
    details: string;
  }>

  // Statistiques d'une règle
  async getRuleStatistics(ruleId: string): Promise<{
    totalTriggered: number;
    totalAutoExecuted: number;
    totalApproved: number;
    totalRejected: number;
    totalOverridden: number;
    successRate: number;
    avgConfidence: number;
  }>

  // Duplication de règle
  async duplicate(ruleId: string, newName: string): Promise<DecisionRule>
}
```

**Inputs** :

```typescript
export interface CreateRuleInput {
  name: string;
  description: string;
  decisionType: DecisionType;
  triggerType: RuleTriggerType;
  conditions: DecisionRule['Conditions'];
  recommendedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
  customActionData?: Record<string, any>;
  autoExecute: boolean;
  requiresApproval?: boolean;
  approverRoles?: string[];
  thresholdAmount?: number;
  notifyOnTrigger?: boolean;
  notifyUsers?: string[];
  priority?: number;
  workspaceId: string;
  createdById: string;
}
```

### 4.3 ApprovalProfileService

**Fichier** : `lib/modules/ai/approval-profile-service.ts`

**Responsabilités** :
- Gestion des profils d'approbation IA
- Configuration personnalisée par utilisateur
- Gestion des délégations

**Méthodes** :

```typescript
export class ApprovalProfileService {
  // Création profil
  async create(input: CreateProfileInput): Promise<AIApprovalProfile>

  // Lecture
  async getById(profileId: string): Promise<AIApprovalProfile | null>
  async getByUserId(userId: string): Promise<AIApprovalProfile | null>

  // Liste
  async list(workspaceId: string): Promise<AIApprovalProfile[]>

  // Mise à jour
  async update(
    profileId: string,
    updates: Partial<AIApprovalProfile>
  ): Promise<AIApprovalProfile>

  // Configuration d'un type de décision
  async updateDecisionConfig(
    profileId: string,
    decisionType: DecisionType,
    config: AIApprovalProfile['DecisionConfigs'][0]
  ): Promise<AIApprovalProfile>

  // Activation/Désactivation
  async activate(profileId: string): Promise<AIApprovalProfile>
  async deactivate(profileId: string): Promise<AIApprovalProfile>

  // Délégation
  async setDelegation(
    profileId: string,
    delegateUserId: string,
    startDate: string,
    endDate: string
  ): Promise<AIApprovalProfile>
  async removeDelegation(profileId: string): Promise<AIApprovalProfile>

  // Récupération profil effectif (avec délégation)
  async getEffectiveProfile(userId: string): Promise<AIApprovalProfile | null>
  // Retourne profil du délégué si délégation active

  // Vérification autorisation auto-approbation
  async canAutoApprove(
    userId: string,
    decisionType: DecisionType,
    amount?: number
  ): Promise<{
    canAutoApprove: boolean;
    reason?: string;
    mode: 'automatic' | 'assisted' | 'manual';
  }>

  // Vérification limites
  async checkLimits(
    userId: string,
    decisionType: DecisionType,
    amount?: number
  ): Promise<{
    withinLimits: boolean;
    limitsReached: string[];
    currentUsage: {
      dailyApprovals: number;
      weeklyApprovals: number;
      monthlyApprovals: number;
      dailySpending: number;
      weeklySpending: number;
      monthlySpending: number;
    };
  }>

  // Statistiques
  async getStatistics(profileId: string): Promise<{
    totalAutoApprovals: number;
    totalAssistedDecisions: number;
    totalOverrides: number;
    overrideRate: number;
    averageDecisionTime: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateProfileInput {
  userId: string;
  name: string;
  description?: string;
  defaultMode: 'automatic' | 'assisted' | 'manual';
  decisionConfigs: AIApprovalProfile['DecisionConfigs'];
  dailyAutoApprovalLimit?: number;
  weeklyAutoApprovalLimit?: number;
  monthlyAutoApprovalLimit?: number;
  dailySpendingLimit?: number;
  weeklySpendingLimit?: number;
  monthlySpendingLimit?: number;
  workspaceId: string;
}
```

### 4.4 PredictiveModelService

**Fichier** : `lib/modules/ai/predictive-model-service.ts`

**Responsabilités** :
- Gestion des modèles prédictifs
- Entraînement et réentraînement
- Prédictions

**Méthodes** :

```typescript
export class PredictiveModelService {
  // Génération code modèle
  async generateModelCode(workspaceId: string): Promise<string>

  // Création modèle
  async create(input: CreateModelInput): Promise<PredictiveModel>

  // Lecture
  async getById(modelId: string): Promise<PredictiveModel | null>

  // Liste
  async list(
    workspaceId: string,
    filters?: {
      domain?: string;
      type?: string;
      isActive?: boolean;
    }
  ): Promise<PredictiveModel[]>

  // Entraînement
  async train(modelId: string): Promise<PredictiveModel>
  // Lance entraînement asynchrone

  // Prédiction
  async predict(
    modelId: string,
    features: Record<string, any>
  ): Promise<{
    prediction: any;
    confidence: number;
    explanation?: Record<string, number>;
  }>

  // Évaluation
  async evaluate(modelId: string): Promise<{
    metrics: PredictiveModel['Metrics'];
    testResults: Array<{
      input: Record<string, any>;
      predicted: any;
      actual: any;
      correct: boolean;
    }>;
  }>

  // Mise à jour statut
  async updateStatus(
    modelId: string,
    status: PredictiveModel['Status']
  ): Promise<PredictiveModel>

  // Statistiques
  async getStatistics(modelId: string): Promise<{
    totalPredictions: number;
    successRate: number;
    avgConfidence: number;
    recentPredictions: Array<{
      timestamp: string;
      confidence: number;
      correct?: boolean;
    }>;
  }>
}
```

### 4.5 InsightService

**Fichier** : `lib/modules/ai/insight-service.ts`

**Responsabilités** :
- Génération d'insights automatiques
- Détection d'anomalies
- Identification d'opportunités
- Alertes sur risques

**Méthodes** :

```typescript
export class InsightService {
  // Génération d'insights
  async generateInsights(workspaceId: string): Promise<AIInsight[]>
  // Tâche cron quotidienne
  // Analyse toutes les données
  // Génère insights: trends, anomalies, opportunities, risks

  // Création manuelle
  async create(input: CreateInsightInput): Promise<AIInsight>

  // Lecture
  async getById(insightId: string): Promise<AIInsight | null>

  // Liste
  async list(
    workspaceId: string,
    filters?: {
      type?: string;
      severity?: string;
      status?: string;
      domain?: string;
    }
  ): Promise<AIInsight[]>

  // Insights non lus
  async getNew(workspaceId: string): Promise<AIInsight[]>

  // Prise de connaissance
  async acknowledge(
    insightId: string,
    userId: string
  ): Promise<AIInsight>

  // Enregistrer action prise
  async recordAction(
    insightId: string,
    action: string
  ): Promise<AIInsight>

  // Rejeter insight
  async dismiss(insightId: string): Promise<AIInsight>

  // Détection d'anomalies
  async detectAnomalies(
    domain: string,
    data: Record<string, any>[]
  ): Promise<AIInsight[]>

  // Analyse de tendances
  async analyzeTrends(
    domain: string,
    metric: string,
    period: { start: string; end: string }
  ): Promise<AIInsight>

  // Identification d'opportunités
  async identifyOpportunities(workspaceId: string): Promise<AIInsight[]>

  // Évaluation des risques
  async assessRisks(workspaceId: string): Promise<AIInsight[]>
}
```

### 4.6 LearningService

**Fichier** : `lib/modules/ai/learning-service.ts`

**Responsabilités** :
- Apprentissage continu
- Analyse des feedbacks
- Ajustement des modèles
- Optimisation des règles

**Méthodes** :

```typescript
export class LearningService {
  // Apprentissage à partir d'un feedback
  async learnFromFeedback(
    recommendationId: string,
    outcome: 'success' | 'failure' | 'partial',
    metrics?: Record<string, number>
  ): Promise<void>
  // Analyse l'écart entre prédit et réel
  // Ajuste poids des features
  // Met à jour règles si nécessaire

  // Analyse des overrides
  async analyzeOverrides(
    workspaceId: string,
    period: { start: string; end: string }
  ): Promise<{
    totalOverrides: number;
    overrideRate: number;
    commonReasons: Array<{
      reason: string;
      count: number;
    }>;
    suggestedRuleAdjustments: Array<{
      ruleId: string;
      ruleName: string;
      adjustment: string;
    }>;
  }>

  // Optimisation automatique des règles
  async optimizeRules(workspaceId: string): Promise<{
    rulesOptimized: number;
    improvements: Array<{
      ruleId: string;
      before: number;
      after: number;
    }>;
  }>

  // Réentraînement des modèles
  async retrainModels(workspaceId: string): Promise<void>
  // Tâche hebdomadaire/mensuelle
  // Réentraîne tous les modèles actifs

  // Analyse de performance
  async analyzePerformance(
    workspaceId: string,
    period: { start: string; end: string }
  ): Promise<{
    overallAccuracy: number;
    byDecisionType: Record<DecisionType, {
      accuracy: number;
      confidence: number;
      overrideRate: number;
    }>;
    trends: Array<{
      week: string;
      accuracy: number;
    }>;
  }>
}
```

---

## 5. Intégrations avec autres modules

### 5.1 Intégration Module Dépenses (7.5)

```typescript
// Dans ExpenseRequestService.create()
const request = await this.create(input);

// Déclenchement analyse IA
await decisionEngineService.analyzeAndRecommend({
  decisionType: 'expense_approval',
  referenceId: request.ExpenseRequestId,
  referenceType: 'ExpenseRequest',
  referenceNumber: request.RequestNumber,
  referenceData: request,
  userId: request.RequesterId, // Pour récupérer profil IA
  workspaceId: request.WorkspaceId,
});
```

### 5.2 Intégration Module Stock (7.1)

```typescript
// Tâche cron quotidienne
export async function predictiveStockReplenishment(workspaceId: string) {
  const products = await productService.list(workspaceId);

  for (const product of products) {
    const forecast = await predictiveModelService.predict(
      'stock-forecast-model-id',
      {
        productId: product.ProductId,
        currentStock: product.QuantityInStock,
        avgDailySales: product.AvgDailySales,
        seasonality: getSeasonalityFactor(),
        leadTime: product.LeadTime,
      }
    );

    if (forecast.prediction.shouldReorder) {
      await decisionEngineService.analyzeAndRecommend({
        decisionType: 'stock_replenishment',
        referenceId: product.ProductId,
        referenceType: 'Product',
        referenceData: {
          product,
          forecast,
          recommendedQuantity: forecast.prediction.quantity,
        },
        workspaceId,
      });
    }
  }
}
```

### 5.3 Intégration Module Production (7.4)

```typescript
// Dans ProductionOrderService
async suggestProductionOrder(productId: string): Promise<DecisionRecommendation> {
  const product = await productService.getById(productId);
  const salesForecast = await predictiveModelService.predict(
    'sales-forecast-model-id',
    { productId, period: 'next_30_days' }
  );

  return await decisionEngineService.analyzeAndRecommend({
    decisionType: 'production_order',
    referenceId: productId,
    referenceType: 'Product',
    referenceData: {
      product,
      forecastedDemand: salesForecast.prediction,
      currentStock: product.QuantityInStock,
      rawMaterialsAvailable: await checkRawMaterials(productId),
    },
    workspaceId: product.WorkspaceId,
  });
}
```

### 5.4 Tâche cron - Génération insights quotidiens

```typescript
// Exécution: Tous les jours à 6h00
export async function generateDailyInsights(workspaceId: string) {
  const insights = await insightService.generateInsights(workspaceId);

  console.log(`${insights.length} insights générés`);

  // Notification pour insights critiques
  const criticalInsights = insights.filter(i => i.Severity === 'critical');
  if (criticalInsights.length > 0) {
    await notificationService.send({
      to: 'admin_users',
      subject: `${criticalInsights.length} insights critiques`,
      body: criticalInsights.map(i => i.Subject).join('\n'),
    });
  }
}
```

---

## 6. Routes API

### 6.1 Decision Engine

#### POST /api/modules/ai/decisions/analyze
Analyse et recommandation
```typescript
Body: AnalyzeDecisionInput
Response: DecisionRecommendation
```

#### GET /api/modules/ai/decisions/pending
Recommandations en attente
```typescript
Query params:
- userId?: string
- decisionType?: DecisionType
- minConfidence?: number

Response: DecisionRecommendation[]
```

#### POST /api/modules/ai/decisions/[id]/decide
Enregistrer décision
```typescript
Body: RecordDecisionInput
Response: DecisionRecommendation
```

#### POST /api/modules/ai/decisions/[id]/outcome
Enregistrer résultat
```typescript
Body: {
  outcome: 'success' | 'failure' | 'partial';
  notes?: string;
  metrics?: Record<string, number>;
}
Response: { success: boolean }
```

#### GET /api/modules/ai/decisions/stats
Statistiques
```typescript
Query params:
- startDate?: string
- endDate?: string

Response: DecisionStatistics
```

### 6.2 Rules

#### GET /api/modules/ai/rules
Liste des règles
```typescript
Query params:
- decisionType?: DecisionType
- isActive?: boolean
- triggerType?: RuleTriggerType

Response: DecisionRule[]
```

#### GET /api/modules/ai/rules/[id]
Détails règle
```typescript
Response: DecisionRule
```

#### POST /api/modules/ai/rules
Création règle
```typescript
Body: CreateRuleInput
Response: DecisionRule
```

#### PATCH /api/modules/ai/rules/[id]
Mise à jour règle
```typescript
Body: Partial<DecisionRule>
Response: DecisionRule
```

#### POST /api/modules/ai/rules/[id]/activate
Activation
```typescript
Response: DecisionRule
```

#### POST /api/modules/ai/rules/[id]/deactivate
Désactivation
```typescript
Response: DecisionRule
```

#### POST /api/modules/ai/rules/[id]/test
Test règle
```typescript
Body: { testContext: Record<string, any> }
Response: { matches: boolean; details: string }
```

#### POST /api/modules/ai/rules/[id]/duplicate
Duplication
```typescript
Body: { newName: string }
Response: DecisionRule
```

#### GET /api/modules/ai/rules/[id]/stats
Statistiques règle
```typescript
Response: RuleStatistics
```

### 6.3 Approval Profiles

#### GET /api/modules/ai/profiles
Liste profils
```typescript
Response: AIApprovalProfile[]
```

#### GET /api/modules/ai/profiles/[id]
Détails profil
```typescript
Response: AIApprovalProfile
```

#### GET /api/modules/ai/profiles/user/[userId]
Profil par utilisateur
```typescript
Response: AIApprovalProfile
```

#### POST /api/modules/ai/profiles
Création profil
```typescript
Body: CreateProfileInput
Response: AIApprovalProfile
```

#### PATCH /api/modules/ai/profiles/[id]
Mise à jour profil
```typescript
Body: Partial<AIApprovalProfile>
Response: AIApprovalProfile
```

#### POST /api/modules/ai/profiles/[id]/decision-config
Mise à jour config décision
```typescript
Body: {
  decisionType: DecisionType;
  config: DecisionConfig;
}
Response: AIApprovalProfile
```

#### POST /api/modules/ai/profiles/[id]/delegate
Définir délégation
```typescript
Body: {
  delegateUserId: string;
  startDate: string;
  endDate: string;
}
Response: AIApprovalProfile
```

#### DELETE /api/modules/ai/profiles/[id]/delegate
Retirer délégation
```typescript
Response: AIApprovalProfile
```

#### GET /api/modules/ai/profiles/[id]/can-auto-approve
Vérifier autorisation
```typescript
Query params:
- decisionType: DecisionType
- amount?: number

Response: {
  canAutoApprove: boolean;
  reason?: string;
  mode: string;
}
```

#### GET /api/modules/ai/profiles/[id]/limits
Vérifier limites
```typescript
Query params:
- decisionType: DecisionType
- amount?: number

Response: LimitsCheckResult
```

### 6.4 Models

#### GET /api/modules/ai/models
Liste modèles
```typescript
Query params:
- domain?: string
- type?: string
- isActive?: boolean

Response: PredictiveModel[]
```

#### GET /api/modules/ai/models/[id]
Détails modèle
```typescript
Response: PredictiveModel
```

#### POST /api/modules/ai/models
Création modèle
```typescript
Body: CreateModelInput
Response: PredictiveModel
```

#### POST /api/modules/ai/models/[id]/train
Lancer entraînement
```typescript
Response: { status: 'training_started' }
```

#### POST /api/modules/ai/models/[id]/predict
Prédiction
```typescript
Body: { features: Record<string, any> }
Response: {
  prediction: any;
  confidence: number;
  explanation?: Record<string, number>;
}
```

#### GET /api/modules/ai/models/[id]/evaluate
Évaluation
```typescript
Response: EvaluationResult
```

#### GET /api/modules/ai/models/[id]/stats
Statistiques
```typescript
Response: ModelStatistics
```

### 6.5 Insights

#### GET /api/modules/ai/insights
Liste insights
```typescript
Query params:
- type?: string
- severity?: string
- status?: string
- domain?: string

Response: AIInsight[]
```

#### GET /api/modules/ai/insights/new
Insights non lus
```typescript
Response: AIInsight[]
```

#### GET /api/modules/ai/insights/[id]
Détails insight
```typescript
Response: AIInsight
```

#### POST /api/modules/ai/insights/generate
Générer insights
```typescript
Response: AIInsight[]
```

#### POST /api/modules/ai/insights/[id]/acknowledge
Prendre connaissance
```typescript
Body: { userId: string }
Response: AIInsight
```

#### POST /api/modules/ai/insights/[id]/action
Enregistrer action
```typescript
Body: { action: string }
Response: AIInsight
```

#### POST /api/modules/ai/insights/[id]/dismiss
Rejeter
```typescript
Response: AIInsight
```

### 6.6 Learning

#### POST /api/modules/ai/learning/analyze-overrides
Analyser overrides
```typescript
Body: {
  startDate: string;
  endDate: string;
}
Response: OverrideAnalysis
```

#### POST /api/modules/ai/learning/optimize-rules
Optimiser règles
```typescript
Response: OptimizationResult
```

#### POST /api/modules/ai/learning/retrain-models
Réentraîner modèles
```typescript
Response: { status: 'retraining_started' }
```

#### GET /api/modules/ai/learning/performance
Analyse performance
```typescript
Query params:
- startDate: string
- endDate: string

Response: PerformanceAnalysis
```

### 6.7 Configuration

#### GET /api/modules/ai/config
Configuration IA
```typescript
Response: AIConfiguration
```

#### PATCH /api/modules/ai/config
Mise à jour configuration
```typescript
Body: Partial<AIConfiguration>
Response: AIConfiguration
```

---

## 7. Permissions RBAC

### 7.1 Définition des permissions

```typescript
// Module IA Prédictive
ai: {
  // Général
  'ai:view': 'Voir les fonctionnalités IA',
  'ai:configure': 'Configurer l\'IA',

  // Décisions
  'ai:decision:view': 'Voir les recommandations IA',
  'ai:decision:override': 'Override recommandations IA',
  'ai:decision:feedback': 'Donner feedback sur décisions',

  // Règles
  'ai:rule:view': 'Voir les règles',
  'ai:rule:create': 'Créer des règles',
  'ai:rule:edit': 'Modifier des règles',
  'ai:rule:delete': 'Supprimer des règles',

  // Profils
  'ai:profile:view': 'Voir les profils IA',
  'ai:profile:create': 'Créer des profils',
  'ai:profile:edit': 'Modifier des profils',
  'ai:profile:delete': 'Supprimer des profils',

  // Modèles
  'ai:model:view': 'Voir les modèles',
  'ai:model:train': 'Entraîner des modèles',
  'ai:model:deploy': 'Déployer des modèles',

  // Insights
  'ai:insight:view': 'Voir les insights',
  'ai:insight:action': 'Agir sur insights',

  // Apprentissage
  'ai:learning:analyze': 'Analyser apprentissage',
  'ai:learning:optimize': 'Optimiser modèles/règles',
}
```

### 7.2 Matrice de permissions

| Permission | Admin | Manager | User | Accountant |
|-----------|-------|---------|------|------------|
| ai:view | ✅ | ✅ | ✅ | ✅ |
| ai:configure | ✅ | ❌ | ❌ | ❌ |
| ai:decision:view | ✅ | ✅ | ✅ (own) | ✅ |
| ai:decision:override | ✅ | ✅ | ❌ | ✅ |
| ai:decision:feedback | ✅ | ✅ | ✅ | ✅ |
| ai:rule:view | ✅ | ✅ | ❌ | ✅ |
| ai:rule:create | ✅ | ✅ | ❌ | ❌ |
| ai:rule:edit | ✅ | ✅ | ❌ | ❌ |
| ai:rule:delete | ✅ | ❌ | ❌ | ❌ |
| ai:profile:view | ✅ | ✅ (own) | ✅ (own) | ✅ (own) |
| ai:profile:edit | ✅ | ✅ (own) | ✅ (own) | ✅ (own) |
| ai:model:view | ✅ | ✅ | ❌ | ✅ |
| ai:model:train | ✅ | ❌ | ❌ | ❌ |
| ai:insight:view | ✅ | ✅ | ✅ | ✅ |
| ai:insight:action | ✅ | ✅ | ❌ | ✅ |
| ai:learning:optimize | ✅ | ❌ | ❌ | ❌ |

---

## 8. Interface utilisateur

### 8.1 Pages principales

#### 8.1.1 Dashboard IA
**Route** : `/ai/dashboard`

**Widgets** :
- **Statistiques clés** :
  - Total recommandations (30 jours)
  - Taux auto-exécution
  - Taux override
  - Précision moyenne
- **Graphique évolution** : Recommandations par jour
- **Top règles** : Plus utilisées
- **Insights récents** : 5 derniers insights
- **Recommandations en attente** : Liste

#### 8.1.2 Recommandations en attente
**Route** : `/ai/recommendations`

**Fonctionnalités** :
- Liste des recommandations nécessitant action
- Filtres: Type, Confiance, Date
- Cartes affichant:
  - Type de décision
  - Référence (Dépense, Commande, etc.)
  - Recommandation IA
  - Score de confiance avec jauge
  - Justification détaillée
  - Facteurs considérés (liste avec poids)
  - Prédictions (ROI, coût, timeline)
  - Alternatives
- Actions: Approuver, Rejeter, Voir détails

#### 8.1.3 Détails recommandation
**Route** : `/ai/recommendations/[id]`

**Sections** :
- **En-tête** :
  - Type et référence
  - Badge confiance
  - Statut
- **Recommandation IA** :
  - Action suggérée
  - Justification complète
- **Analyse détaillée** :
  - Tableau facteurs avec poids et impact
  - Graphiques visualisation
- **Prédictions** :
  - Probabilité succès
  - ROI estimé
  - Coût estimé
  - Timeline
  - Risques identifiés
  - Opportunités
- **Alternatives** :
  - Liste alternatives avec pros/cons
- **Historique** :
  - Décisions similaires passées
  - Résultats obtenus
- **Actions** :
  - Approuver (avec note)
  - Rejeter (avec raison)
  - Différer

#### 8.1.4 Gestion des règles
**Route** : `/ai/rules`

**Fonctionnalités** :
- Liste des règles avec:
  - Nom et code
  - Type de décision
  - Priorité
  - Statut (actif/inactif)
  - Performance (taux succès)
  - Total déclenchements
- Actions: Modifier, Activer/Désactiver, Dupliquer, Tester, Statistiques
- Bouton "Créer une règle"

#### 8.1.5 Création/Édition règle
**Route** : `/ai/rules/new` ou `/ai/rules/[id]/edit`

**Formulaire** :
- **Informations générales** :
  - Nom
  - Description
  - Type de décision
  - Type de déclenchement
  - Priorité
- **Conditions** :
  - Builder de conditions visuelles
  - Champ, Opérateur, Valeur
  - AND/OR entre conditions
- **Action recommandée** :
  - Approve/Reject/Escalate/Defer
  - Données personnalisées si custom
- **Automatisation** :
  - Auto-exécuter (checkbox)
  - Nécessite approbation (checkbox)
  - Rôles approbateurs
- **Seuils** :
  - Montant
  - Quantité
  - Pourcentage
- **Notifications** :
  - Notifier au déclenchement
  - Utilisateurs/Rôles à notifier
- **Boutons** : Sauvegarder, Tester, Annuler

#### 8.1.6 Mon profil IA
**Route** : `/ai/profile`

**Sections** :
- **Configuration globale** :
  - Profil actif (toggle)
  - Mode par défaut (Automatique/Assisté/Manuel)
- **Configuration par type de décision** :
  - Tableau avec types
  - Pour chaque type:
    - Mode (dropdown)
    - Seuil auto-approbation
    - Seuil revue nécessaire
    - Catégories applicables
    - Horaires autorisés
    - Notifications
- **Limites** :
  - Quotidiennes
  - Hebdomadaires
  - Mensuelles
  - Limites approbations
  - Limites dépenses
- **Délégation** :
  - Déléguer à (utilisateur)
  - Période (dates)
- **Statistiques personnelles** :
  - Total approbations auto
  - Total décisions assistées
  - Taux override
- **Bouton** : Sauvegarder

#### 8.1.7 Insights IA
**Route** : `/ai/insights`

**Fonctionnalités** :
- Grille d'insights avec badges:
  - Type (trend, anomaly, opportunity, risk)
  - Sévérité (couleur)
- Filtres: Type, Sévérité, Statut, Domaine
- Cartes insight affichant:
  - Sujet
  - Description
  - Impact estimé
  - Actions suggérées
  - Graphique si applicable
- Actions: Voir détails, Prendre connaissance, Agir, Rejeter

#### 8.1.8 Détails insight
**Route** : `/ai/insights/[id]`

**Sections** :
- **En-tête** :
  - Type et sévérité
  - Sujet
  - Date génération
  - Score confiance
- **Description détaillée**
- **Données et métriques** :
  - Tableaux
  - Graphiques interactifs
- **Impact estimé** :
  - Financier
  - Opérationnel
  - Stratégique
- **Actions suggérées** :
  - Liste avec priorité
  - Effort estimé
  - Bénéfice attendu
- **Actions** :
  - Prendre connaissance
  - Enregistrer action prise
  - Rejeter

#### 8.1.9 Configuration IA
**Route** : `/ai/settings`

**Formulaire** :
- **Activation** :
  - IA activée (toggle principal)
  - Modules activés (checkboxes)
- **Seuils** :
  - Confiance minimum
  - Auto-exécution par défaut
- **Apprentissage** :
  - Apprentissage continu (toggle)
  - Taux apprentissage
  - Fréquence réentraînement
- **Notifications** :
  - Notifier confiance faible
  - Notifier override
  - Notifier anomalies
- **Limites globales** :
  - Max recommandations/jour
  - Max auto-exécutions/jour
- **Données** :
  - Rétention (jours)
- **IA externe** :
  - Provider (dropdown)
  - Clé API
- **Bouton** : Sauvegarder

### 8.2 Composants réutilisables

```typescript
// components/ai/ConfidenceBadge.tsx
// Badge score confiance avec couleur

// components/ai/DecisionCard.tsx
// Carte recommandation avec actions

// components/ai/FactorsList.tsx
// Liste facteurs avec poids et impact

// components/ai/PredictionsPanel.tsx
// Panel prédictions (ROI, risques, etc.)

// components/ai/AlternativesList.tsx
// Liste alternatives avec pros/cons

// components/ai/RuleBuilder.tsx
// Builder visuel de conditions

// components/ai/InsightCard.tsx
// Carte insight avec badge type/sévérité

// components/ai/PerformanceChart.tsx
// Graphique performance IA
```

---

## 9. Estimation de développement

### 9.1 Complexité par composant

| Composant | Complexité | Lignes estimées | Temps estimé |
|-----------|------------|-----------------|--------------|
| **Types TypeScript** | Moyenne | 450 | ✅ Fait |
| **DecisionEngineService** | Très haute | 800 | 5 jours |
| **RuleEngineService** | Haute | 600 | 4 jours |
| **ApprovalProfileService** | Moyenne | 400 | 3 jours |
| **PredictiveModelService** | Très haute | 700 | 5 jours |
| **InsightService** | Haute | 500 | 4 jours |
| **LearningService** | Très haute | 600 | 5 jours |
| **Routes API (x60)** | Haute | 1200 | 4 jours |
| **Permissions RBAC** | Faible | 100 | 0.5 jour |
| **UI - Pages (x9)** | Très haute | 2500 | 7 jours |
| **UI - Composants** | Haute | 1200 | 4 jours |
| **Intégrations** | Haute | 800 | 4 jours |
| **ML/Algorithmes** | Très haute | 1500 | 8 jours |
| **Tests** | Très haute | 1500 | 6 jours |
| **Documentation** | Faible | - | ✅ Fait |

**Total lignes** : ~12850 lignes
**Total temps** : **59.5 jours** (développement complet)

### 9.2 Phases de développement

#### Phase 1 - Infrastructure (10 jours)
- RuleEngineService
- ApprovalProfileService
- Routes API de base
- UI profils et règles
- Tests

#### Phase 2 - Moteur de décision (10 jours)
- DecisionEngineService
- Évaluation règles
- Génération recommandations
- UI recommandations
- Tests

#### Phase 3 - Auto-exécution (8 jours)
- Intégrations modules (Dépenses, Stock, etc.)
- Vérifications et validations
- Logging et audit
- Tests intégration

#### Phase 4 - ML & Prédictions (12 jours)
- PredictiveModelService
- Algorithmes ML
- Entraînement et évaluation
- UI modèles
- Tests

#### Phase 5 - Insights (8 jours)
- InsightService
- Détection anomalies
- Analyse tendances
- UI insights
- Tests

#### Phase 6 - Apprentissage continu (8 jours)
- LearningService
- Feedback loop
- Optimisation automatique
- Réentraînement
- Tests

#### Phase 7 - Finalisation (3.5 jours)
- Configuration globale
- Documentation API
- Tests end-to-end
- Optimisations performance

---

## 10. Cas d'usage détaillés

### 10.1 Cas d'usage : Auto-approbation dépense récurrente

**Acteur** : Employé, IA

**Scénario** :
1. Employé crée demande de dépense
   ```
   Type: Fournitures bureau
   Montant: 5,000 FCFA
   Catégorie: Fonctionnelle > Fourniture
   Urgence: Normal
   ```

2. IA récupère profil du responsable hiérarchique
   ```
   Mode: automatic
   AutoApproveThreshold: 10,000 FCFA
   Catégories applicables: ["fourniture", "maintenance"]
   Horaires: Lun-Ven 8h-18h
   ```

3. Vérifications
   - Montant (5,000) < Seuil (10,000) ✅
   - Catégorie applicable ✅
   - Heure actuelle (14h30) dans plage ✅
   - Limite quotidienne non atteinte ✅

4. Recherche règles applicables
   ```
   Règle RULE-015 trouvée:
   Name: "Auto-approve fournitures < 10K"
   Conditions:
   - category = 'fourniture' AND
   - amount <= 10000 AND
   - supplier IN [liste fournisseurs approuvés]
   RecommendedAction: approve
   AutoExecute: true
   ```

5. Évaluation règle
   - Toutes conditions satisfaites
   - Confiance: 95% (very_high)

6. Analyse historique ML
   ```
   Dépenses similaires passées: 47
   Approuvées: 46
   Rejetées: 1 (montant trop élevé)
   Taux succès: 97.8%
   ```

7. Création recommandation
   ```
   RecommendedAction: approve
   Confidence: very_high (95%)
   Reasoning:
   "Dépense récurrente de fournitures,
    montant conforme au budget,
    fournisseur approuvé,
    historique excellent (97.8% succès)"
   ```

8. **AUTO-EXECUTION**
   - Expense.Status = 'approved'
   - Notification employé: "Dépense approuvée automatiquement par IA"
   - Notification responsable: "IA a approuvé dépense #EXP-2025-0142"
   - Log audit créé

### 10.2 Cas d'usage : Recommandation assistée investissement

**Acteur** : Directeur, IA

**Scénario** :
1. Création demande investissement
   ```
   Type: Investissement
   Objet: Nouveau véhicule livraison
   Montant: 15,000,000 FCFA
   ROI estimé: 18 mois
   ```

2. Profil IA directeur
   ```
   Mode: assisted (pour investissements)
   RequireReviewThreshold: 5,000,000 FCFA
   ```

3. Montant > Seuil → Mode assisté

4. Analyse IA complète
   ```
   Facteurs considérés:
   - Budget investissements annuel: 50M
   - Déjà dépensé: 28M
   - Reste disponible: 22M ✅

   - Besoin livraisons: +35% vs an dernier
   - Coûts sous-traitance actuels: 800K/mois
   - Économies estimées: 600K/mois
   - Payback period: 25 mois

   - État flotte actuelle: Vétuste (moy 8 ans)
   - Coûts maintenance actuels: 450K/mois
   - Économies maintenance: 300K/mois
   ```

5. Modèle prédictif
   ```
   PredictiveModel: "investment-roi-model"
   Prédiction:
   - Success probability: 78%
   - Estimated ROI: 140% (3 ans)
   - Timeline: 20-24 mois
   - Risks:
     * Augmentation coût carburant
     * Maintenance imprévue
   - Opportunities:
     * Expansion nouvelle zone
     * Meilleure image marque
   ```

6. Alternatives générées
   ```
   Alternative 1: Leasing au lieu d'achat
   Pros: Pas de capital immobilisé, Flexibilité
   Cons: Coût total supérieur long terme
   Impact estimé: -5% ROI mais -70% risque

   Alternative 2: Véhicule d'occasion
   Pros: -40% coût initial
   Cons: Maintenance élevée, Durée vie courte
   Impact estimé: -25% ROI

   Alternative 3: Différer au Q2
   Pros: Budget Q2 plus disponible
   Cons: Coûts sous-traitance additionnels
   Impact estimé: -8% ROI global
   ```

7. Recommandation IA
   ```
   RecommendedAction: approve
   Confidence: high (78%)
   Reasoning:
   "Investissement stratégique justifié par:
    - Croissance activité soutenue (+35%)
    - ROI attractif (140% sur 3 ans)
    - Budget disponible suffisant (22M restants)
    - Économies opérationnelles substantielles

    Attention aux risques identifiés.
    Considérer alternative leasing pour
    réduire risque financier."
   ```

8. Notification directeur
   "Nouvelle recommandation IA pour investissement
    nécessite votre décision"

9. Directeur consulte interface
   - Voit analyse complète
   - Étudie alternatives
   - Lit justification IA

10. **Décision** : Approuve avec modification
    - Choisit alternative 1 (Leasing)
    - Note: "Préfère leasing pour flexibilité"
    - Status: approved
    - WasOverridden: true (action différente)

11. Feedback pour apprentissage
    - IA enregistre préférence pour leasing
    - Ajustera futures recommandations

### 10.3 Cas d'usage : Détection anomalie et alerte

**Acteur** : IA, Responsable financier

**Scénario** :
1. **Tâche cron quotidienne** : Génération insights

2. IA analyse dépenses du jour
   ```
   Dépenses enregistrées: 47
   Montant total: 2,340,000 FCFA
   ```

3. **Détection anomalie**
   ```
   Pattern habituel:
   - Moyenne quotidienne: 800,000 FCFA
   - Écart-type: 150,000 FCFA

   Aujourd'hui: 2,340,000 FCFA
   Écart: +192% (+10.2 σ)

   ANOMALIE DÉTECTÉE
   ```

4. Analyse détaillée
   ```
   Responsable anomalie:
   - 3 dépenses inhabituelles:
     * EXP-2025-0156: 800K (Réparation urgente)
     * EXP-2025-0159: 600K (Équipement)
     * EXP-2025-0162: 500K (Formation)

   Toutes approuvées automatiquement
   par règles différentes

   Corrélation:
   - Même jour
   - Même département (Production)
   ```

5. Création AIInsight
   ```
   Type: anomaly
   Severity: high
   Subject: "Pic inhabituel dépenses Production"
   Description:
   "Détection 3 dépenses importantes
    simultanées département Production,
    totalisant 1.9M FCFA soit 240% au-dessus
    de la normale quotidienne.

    Bien que chaque dépense ait été
    approuvée individuellement par IA,
    leur cumul présente un risque de
    dépassement budgétaire mensuel."

   EstimatedImpact:
     financial: -1,900,000
     operational: "Risque budget mensuel"

   SuggestedActions:
   1. Vérifier justification cumul
   2. Réviser budget Production
   3. Ajuster règles pour alerter cumul
   ```

6. **Notification immédiate**
   - Email/SMS responsable financier
   - Push notification dashboard
   - Badge "1 insight critique"

7. Responsable consulte insight
   - Voit graphique pic dépenses
   - Voit détail 3 dépenses
   - Comprend situation

8. **Action prise**
   - Contacte chef Production
   - Confirme dépenses légitimes (panne machine)
   - Décide: "Action validée, ajuster budget"
   - Enregistre action dans insight

9. **Amélioration IA**
   - Crée nouvelle règle:
     "Alerter si cumul dépenses dept > 1.5M/jour"
   - Ajuste modèle détection anomalies

---

## 11. Points d'attention et bonnes pratiques

### 11.1 Éthique et gouvernance IA

1. **Transparence** :
   - Toujours expliquer pourquoi IA recommande une action
   - Montrer facteurs et poids
   - Donner accès aux règles

2. **Contrôle humain** :
   - Option toujours disponible d'override
   - Décisions critiques nécessitent validation
   - Audit trail complet

3. **Biais** :
   - Surveiller biais dans recommandations
   - Diversifier données d'entraînement
   - Réévaluer régulièrement équité

4. **Responsabilité** :
   - L'IA assiste, l'humain décide
   - Logger toutes décisions
   - Clarifier responsabilités

### 11.2 Performance et scalabilité

1. **Temps de réponse** :
   - Recommandations < 2 secondes
   - Cache des règles actives
   - Index sur champs critiques

2. **Charge ML** :
   - Modèles optimisés (< 100ms prédiction)
   - Pré-calcul features
   - Batch processing pour insights

3. **Données** :
   - Archivage ancien historique
   - Agrégation pour statistiques
   - Nettoyage données qualité

### 11.3 Sécurité

1. **Données sensibles** :
   - Chiffrement des recommandations
   - Accès RBAC strict
   - Logs d'accès

2. **API externes** :
   - Clés API sécurisées (env vars)
   - Rate limiting
   - Validation inputs

3. **Auto-exécution** :
   - Limites strictes
   - Double vérification montants élevés
   - Circuit breaker si trop d'erreurs

### 11.4 Apprentissage continu

1. **Feedback loop** :
   - Encourager feedback utilisateurs
   - Suivre satisfaction
   - Itérer rapidement

2. **Monitoring** :
   - Dashboard performance IA
   - Alertes dégradation précision
   - A/B testing nouvelles règles

3. **Réentraînement** :
   - Hebdomadaire pour modèles critiques
   - Validation avant déploiement
   - Rollback si dégradation

---

## 12. Évolutions futures

### 12.1 Court terme (3-6 mois)

1. **NLP pour analyse documents** :
   - Extraction auto données factures
   - Analyse contrats fournisseurs
   - Résumé automatique rapports

2. **Vision par ordinateur** :
   - Vérification qualité produits (photos)
   - Reconnaissance logos marques
   - Contrôle conformité emballages

3. **Chatbot IA** :
   - Assistant virtuel pour employés
   - Réponses questions courantes
   - Aide création demandes

### 12.2 Moyen terme (6-12 mois)

1. **Optimisation supply chain** :
   - Routage livraisons optimal
   - Prédiction ruptures stock
   - Négociation prix auto avec fournisseurs

2. **Pricing dynamique** :
   - Ajustement prix temps réel
   - Selon demande, stock, concurrence
   - Maximisation marge

3. **Détection fraude** :
   - Patterns suspects dépenses
   - Anomalies fournisseurs
   - Alertes temps réel

### 12.3 Long terme (12+ mois)

1. **IA générative** :
   - Génération rapports automatique
   - Création contenus marketing
   - Simulation scénarios business

2. **Agents autonomes** :
   - Agents IA spécialisés par domaine
   - Coordination multi-agents
   - Négociation automatique

3. **Métaverse B2B** :
   - Showroom virtuel produits
   - Réunions immersives
   - Formation VR

---

## 13. Conclusion

Le module **IA Prédictive & Aide à la Décision** est un module innovant qui transforme la gestion de l'entreprise.

✅ **9 interfaces TypeScript** définies
✅ **7 services backend** spécifiés (~5600 lignes)
✅ **60 routes API** documentées
✅ **9 pages UI** conçues
✅ **Système de règles flexible** et configurable
✅ **Profils personnalisés** par utilisateur
✅ **Apprentissage continu** intégré
✅ **Auto-exécution sécurisée** avec limites

**Impact business attendu** :
- **-60% temps décisions** grâce à automatisation
- **+35% précision** vs décisions manuelles
- **-40% coûts opérationnels** via optimisations
- **ROI 250%** sur 18 mois

**Différenciateurs clés** :
- Flexibilité totale (règles personnalisables)
- Apprentissage continu (s'améliore avec usage)
- Transparence (justifications claires)
- Contrôle humain (override toujours possible)

**Prochaines étapes** :
1. Validation architecture avec direction
2. POC sur module Dépenses (4 semaines)
3. Collecte données historiques (6 mois min)
4. Entraînement modèles initiaux
5. Déploiement progressif
6. Monitoring et optimisation continue

**Priorité de développement** : Très haute
**Complexité** : Très élevée
**Valeur ajoutée** : Exceptionnelle - Différenciation majeure

---

**Document créé le** : 14 novembre 2025
**Version** : 1.0
**Auteur** : Équipe DDM
