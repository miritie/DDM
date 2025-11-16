# 📊 Module 12 - Reporting & Point Flash - Documentation Complète

## 🎯 Vue d'Ensemble

Le **Module Reporting & Point Flash** est un système complet de génération de rapports automatisés, de transmission multi-canaux (WhatsApp, Email, PDF) et de pilotage temps réel via Dashboard DG.

### Objectifs Principaux

- ✅ **Automatiser** la génération et transmission de rapports (Point Flash hebdomadaire, Dépenses quotidiennes)
- ⚡ **Flexibilité** totale: Rapports en PDF professionnel ET/OU messages WhatsApp simples
- 📱 **Mobile-First** : Dashboard DG responsive avec KPIs temps réel
- 🔄 **Point Flash automatique** : Dimanche 19h, envoi WhatsApp + PDF vers groupes configurés
- 📄 **PDF avancés** : Signatures simulées, mise en forme professionnelle, fiches de décaissement
- 🚀 **Simplicité** : Configuration intuitive, 1 click pour générer/envoyer

---

## 🏗️ Architecture Technique

### Structure des Fichiers

```
lib/modules/reports/
├── report-service.ts              # Service rapports existant (212 lignes)
├── dashboard-service.ts            # Service KPIs existant
├── export-service.ts               # Service export existant
├── pdf-generator-service.ts        # ✨ PDF avancé + signatures (700 lignes)
├── whatsapp-report-service.ts      # ✨ WhatsApp groupes (450 lignes)
└── point-flash-service.ts          # ✨ Point Flash auto (600 lignes)

app/
├── dashboard/
│   └── dg/
│       └── page.tsx                # ✨ Dashboard DG mobile-first
├── reports/
│   ├── page.tsx                    # Dashboard rapports (existant)
│   └── config/
│       └── page.tsx                # ✨ Config rapports mobile
└── analytics/
    └── page.tsx                    # Analytics (existant)

app/api/
├── dashboard/
│   └── dg/
│       └── route.ts                # ✨ API Dashboard DG
├── reports/
│   ├── config/
│   │   └── route.ts                # ✨ GET/POST config
│   └── point-flash/
│       └── generate/
│           └── route.ts            # ✨ POST génération Point Flash
└── whatsapp/
    ├── groups/
    │   └── route.ts                # ✨ GET/POST groupes WhatsApp
    └── test/
        └── route.ts                # ✨ POST test connexion
```

---

## 📊 Modèle de Données

### Configuration Rapports

```typescript
interface ReportConfig {
  pointFlash: {
    enabled: boolean;
    schedule: {
      dayOfWeek: number; // 0 = dimanche
      hour: number; // 19
      minute: number; // 0
    };
    whatsappGroups: string[]; // IDs des groupes
    includePDF: boolean; // Joindre PDF ?
    sendTextSummary: boolean; // Envoyer résumé texte ?
  };
  dailyExpenses: {
    enabled: boolean;
    schedule: { hour: number; minute: number };
    whatsappGroups: string[];
    includePDF: boolean;
  };
  dailySales: {
    enabled: boolean;
    schedule: { hour: number; minute: number };
    whatsappGroups: string[];
    includePDF: boolean;
  };
}
```

### Groupe WhatsApp

```typescript
interface WhatsAppGroup {
  groupId: string; // Ex: "120363...@g.us"
  name: string; // Nom convivial
  description?: string;
}
```

### Point Flash Data

```typescript
interface PDFPointFlash {
  week: string; // "Semaine 42 - 2025"
  period: { start: string; end: string };
  generatedAt: string;

  kpis: {
    revenue: { value: number; trend: number; target?: number };
    expenses: { value: number; trend: number; budget?: number };
    profit: { value: number; trend: number };
    cashBalance: { value: number; trend: number };
    salesCount: { value: number; trend: number };
    newCustomers: { value: number };
    productivity: { value: number; trend: number }; // CA/jour
  };

  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  topSalespersons?: Array<{ name: string; salesCount: number; revenue: number }>;

  alerts?: Array<{ type: 'success' | 'warning' | 'error'; message: string }>;
  objectives?: Array<{ label: string; achieved: number; target: number; progress: number }>;

  signature: PDFSignature; // Signature DG
}
```

### Fiche de Décaissement

```typescript
interface PDFDecaissement {
  decaissementId: string;
  expenseId: string;
  expenseTitle: string;
  amount: number;
  beneficiary: string;
  category: string;
  requestDate: string;
  approvalDate?: string;
  paymentDate?: string;

  // Workflow de validation avec signatures
  requestedBy: PDFSignature;
  approvedBy?: PDFSignature[];
  paidBy?: PDFSignature;

  description?: string;
  attachments?: string[];
  notes?: string;
}

interface PDFSignature {
  name: string;
  role: string;
  date: string;
  simulatedSignature?: boolean; // Si true, génère signature visuelle
}
```

---

## 💻 Services Backend

### 1. PDFGeneratorService

**Fichier:** `lib/modules/reports/pdf-generator-service.ts`

#### Méthodes Principales

```typescript
class PDFGeneratorService {
  // Génère une fiche de décaissement PDF avec signatures
  async generateDecaissementPDF(data: PDFDecaissement): Promise<Blob>

  // Génère un Point Flash PDF hebdomadaire
  async generatePointFlashPDF(data: PDFPointFlash): Promise<Blob>

  // Génère un rapport standard PDF
  async generateReportPDF(
    reportExecution: ReportExecution,
    reportName: string,
    reportType: string
  ): Promise<Blob>

  // Méthodes privées de mise en forme
  private addHeader(doc: jsPDF, title: string, yPos: number): void
  private addFooter(doc: jsPDF): void
  private addSignatureBlock(
    doc: jsPDF,
    signature: PDFSignature,
    x: number,
    y: number,
    label?: string,
    size?: 'small' | 'normal'
  ): void
}
```

#### Exemple d'Utilisation - Fiche de Décaissement

```typescript
import { PDFGeneratorService } from '@/lib/modules/reports/pdf-generator-service';

const pdfGenerator = new PDFGeneratorService();

const data: PDFDecaissement = {
  decaissementId: 'DEC-2025-001',
  expenseId: 'expense_123',
  expenseTitle: 'Achat fournitures bureau',
  amount: 125000,
  beneficiary: 'SODECI',
  category: 'Fournitures',
  requestDate: '2025-01-15',
  approvalDate: '2025-01-16',
  paymentDate: '2025-01-17',

  requestedBy: {
    name: 'Jean Dupont',
    role: 'Commercial',
    date: '2025-01-15',
    simulatedSignature: true,
  },
  approvedBy: [
    {
      name: 'Marie Martin',
      role: 'Manager',
      date: '2025-01-16',
      simulatedSignature: true,
    },
  ],
  paidBy: {
    name: 'Paul Dubois',
    role: 'Caissier',
    date: '2025-01-17',
    simulatedSignature: true,
  },

  description: 'Achat de fournitures pour le bureau principal',
};

const pdfBlob = await pdfGenerator.generateDecaissementPDF(data);
// Télécharger ou uploader le PDF
```

#### Exemple d'Utilisation - Point Flash

```typescript
const pointFlashData: PDFPointFlash = {
  week: 'Semaine 3 - 2025',
  period: { start: '2025-01-13', end: '2025-01-19' },
  generatedAt: new Date().toISOString(),

  kpis: {
    revenue: { value: 8500000, trend: 12.5 },
    expenses: { value: 2300000, trend: -5.2 },
    profit: { value: 6200000, trend: 18.3 },
    cashBalance: { value: 15000000, trend: 8.1 },
    salesCount: { value: 156, trend: 9.2 },
    newCustomers: { value: 23 },
    productivity: { value: 1214285, trend: 12.5 },
  },

  topProducts: [
    { name: 'Produit A', quantity: 45, revenue: 2250000 },
    { name: 'Produit B', quantity: 38, revenue: 1900000 },
  ],

  alerts: [
    { type: 'success', message: 'Excellente performance ! CA +12.5%' },
  ],

  objectives: [
    {
      label: 'Chiffre d\'affaires hebdomadaire',
      achieved: 8500000,
      target: 10000000,
      progress: 85,
    },
  ],

  signature: {
    name: 'Direction Générale',
    role: 'DG',
    date: new Date().toISOString(),
    simulatedSignature: true,
  },
};

const pdfBlob = await pdfGenerator.generatePointFlashPDF(pointFlashData);
```

### 2. WhatsAppReportService

**Fichier:** `lib/modules/reports/whatsapp-report-service.ts`

#### Méthodes Principales

```typescript
class WhatsAppReportService {
  // Vérifie si WhatsApp est configuré
  isConfigured(): boolean

  // Envoie un Point Flash
  async sendPointFlash(data: {
    period: string;
    kpis: { ... };
    alerts?: string[];
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[]; errors?: any[] }>

  // Envoie le résumé quotidien des dépenses
  async sendDailyExpenses(data: {
    date: string;
    totalExpenses: number;
    expensesByCategory: Array<{ category: string; amount: number }>;
    pendingExpenses: number;
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[] }>

  // Envoie le résumé quotidien des ventes
  async sendDailySales(data: {
    date: string;
    totalRevenue: number;
    salesCount: number;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[] }>

  // Envoie un rapport personnalisé
  async sendCustomReport(data: {
    title: string;
    summary: string;
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[] }>

  // Teste la connexion à un groupe
  async testConnection(groupId: string): Promise<{ success: boolean; error?: string }>
}
```

#### Formats de Messages

**Point Flash (texte):**
```
⚡ *POINT FLASH - Semaine 3 - 2025*

💰 *CHIFFRE D'AFFAIRES*
8 500 000 F CFA 📈 +12.5%

💸 *DÉPENSES*
2 300 000 F CFA 📉 -5.2%

💵 *BÉNÉFICE NET*
6 200 000 F CFA 📈 +18.3%

📊 *ACTIVITÉ*
• 156 ventes
• 23 nouveaux clients

⚠️ *ALERTES*
• Excellente performance ! CA +12.5%

_Généré automatiquement par DDM_
```

**Dépenses Quotidiennes (texte):**
```
💸 *DÉPENSES DU MERCREDI 15 JANVIER 2025*

💰 *TOTAL: 125 000 F CFA*

📋 *PAR CATÉGORIE:*
• Fournitures: 45 000 F
• Transport: 30 000 F
• Maintenance: 50 000 F

⏳ *3* dépenses en attente de validation

_Généré automatiquement par DDM_
```

### 3. PointFlashService

**Fichier:** `lib/modules/reports/point-flash-service.ts`

#### Méthodes Principales

```typescript
class PointFlashService {
  // Génère les données du Point Flash pour une période
  async generatePointFlash(
    workspaceId: string,
    startDate: string,
    endDate: string,
    weekLabel?: string
  ): Promise<PointFlashData>

  // Génère ET envoie le Point Flash automatiquement
  async generateAndSendPointFlash(
    workspaceId: string,
    config: PointFlashConfig
  ): Promise<{ success: boolean; pdfUrl?: string; sentTo?: string[] }>

  // Vérifie si on doit générer le Point Flash maintenant
  shouldGenerateNow(config: PointFlashConfig): boolean
}
```

#### Logique d'Alertes Automatiques

Le service génère automatiquement des alertes selon les seuils:

```typescript
// Alerte croissance CA
if (revenueTrend > 20) {
  alerts.push({
    type: 'success',
    message: `Excellente performance ! CA en hausse de ${revenueTrend.toFixed(1)}%`,
  });
} else if (revenueTrend < -20) {
  alerts.push({
    type: 'error',
    message: `Attention ! CA en baisse de ${Math.abs(revenueTrend).toFixed(1)}%`,
  });
}

// Alerte dépenses
if (expensesTrend > 30) {
  alerts.push({
    type: 'warning',
    message: `Dépenses en forte hausse (+${expensesTrend.toFixed(1)}%). Vérifier les postes de dépense`,
  });
}

// Alerte profitabilité
if (profit < 0) {
  alerts.push({
    type: 'error',
    message: 'Bénéfice négatif ! Actions urgentes requises',
  });
}

// Alerte trésorerie
if (cashBalance < 0) {
  alerts.push({
    type: 'error',
    message: 'Trésorerie négative ! Risque de découvert',
  });
} else if (cashBalance < 1000000) {
  alerts.push({
    type: 'warning',
    message: 'Trésorerie faible. Anticiper les besoins de cash',
  });
}
```

---

## 🎨 Interfaces Utilisateur

### 1. Dashboard DG (`/dashboard/dg`)

**Mobile-First - Temps Réel**

**Composants:**

1. **Header Sticky** (gradient blue→indigo→purple)
   - Titre "Dashboard DG"
   - Bouton refresh avec animation spin
   - Filtres période: Aujourd'hui | 7 jours | 30 jours
   - Dernière mise à jour affichée

2. **Alertes** (si présentes)
   - Cards colorées selon type (success=vert, warning=orange, error=rouge)
   - Icônes emoji pour impact visuel
   - Empilées en haut pour visibilité immédiate

3. **KPIs Grid** (2 colonnes)
   - 6 KPIs principaux:
     - Chiffre d'affaires (vert, DollarSign)
     - Dépenses (rouge, TrendingDown)
     - Bénéfice net (bleu, TrendingUp)
     - Trésorerie (purple, DollarSign)
     - Nombre ventes (orange, ShoppingCart)
     - Clients actifs (indigo, Users)
   - Chaque card affiche:
     - Icône colorée
     - Label
     - Valeur formatée
     - Tendance (↗/↘ avec %)

4. **Top Produits** (si données disponibles)
   - Liste des 5 meilleurs produits
   - Numéro de rang dans badge circulaire
   - Nom + quantité
   - Revenue en gras à droite

5. **Activité Récente**
   - 5 dernières activités
   - Type + description + heure relative
   - Montant si applicable

6. **Actions Rapides** (gradient purple→indigo)
   - Grid 2x2 avec 4 boutons:
     - Point Flash (Send icon)
     - Rapports (Download icon)
     - Analytics (TrendingUp icon)
     - Ventes (ShoppingCart icon)

**Design:**
- Background: gradient blue-50 → white → indigo-50
- Cards: white avec shadow-md + border-2 gray-100
- Touch targets: ≥ 44px (WCAG AAA)
- Animations: smooth transitions, spin on refresh
- Responsive: mobile-first, grids adaptatives

### 2. Configuration Rapports (`/reports/config`)

**Mobile-First - Paramétrage Complet**

**Sections:**

1. **Point Flash Hebdomadaire**
   - Toggle activation (switch iOS-style)
   - Sélecteurs jour de semaine + heure (format HH:mm)
   - Checkboxes options:
     - Inclure PDF
     - Résumé texte
   - Sélection groupes WhatsApp (checkboxes)

2. **Dépenses Quotidiennes**
   - Toggle activation
   - Sélecteur heure
   - Checkbox: Inclure PDF
   - Sélection groupes WhatsApp

3. **Ventes Quotidiennes**
   - Idem dépenses

4. **Gestion Groupes WhatsApp**
   - Formulaire ajout:
     - Input ID groupe
     - Input nom convivial
     - Bouton "+ Ajouter le groupe"
   - Liste groupes existants:
     - Nom en gras
     - ID en petit gris
     - Bouton supprimer (icône Trash)

5. **Actions**
   - Bouton "Sauvegarder la Configuration" (bleu, large)
   - Bouton "Tester WhatsApp" (outline, large)

**UX:**
- Validation en temps réel
- Messages succès/erreur en haut de page
- Loading states sur tous les boutons
- Confirmation avant suppression groupe
- Scroll smooth entre sections

---

## 🔌 API Routes

### GET `/api/dashboard/dg`

**Description:** Données temps réel pour Dashboard DG

**Query Parameters:**
- `startDate` (optional): Date début (défaut: il y a 7 jours)
- `endDate` (optional): Date fin (défaut: aujourd'hui)

**Response:**
```json
{
  "success": true,
  "data": {
    "lastUpdate": "2025-01-15T14:30:00Z",
    "kpis": {
      "revenue": {
        "label": "Chiffre d'affaires",
        "value": 8500000,
        "trend": 12.5,
        "format": "currency",
        "icon": "DollarSign",
        "color": "text-green-600"
      },
      // ... autres KPIs
    },
    "alerts": [
      {
        "type": "success",
        "message": "Excellente performance ! CA +12.5%"
      }
    ],
    "topProducts": [
      {
        "name": "Produit A",
        "revenue": 2250000,
        "quantity": 45
      }
    ],
    "recentActivity": [
      {
        "type": "sale",
        "description": "Nouvelle vente enregistrée",
        "time": "Il y a 5 minutes",
        "amount": 45000
      }
    ]
  }
}
```

### POST `/api/reports/point-flash/generate`

**Description:** Génère et envoie le Point Flash

**Body:** Aucun (utilise config enregistrée)

**Response:**
```json
{
  "success": true,
  "data": {
    "pdfUrl": "https://...",
    "sentTo": ["120363...@g.us", "120364...@g.us"]
  },
  "message": "Point Flash généré et envoyé avec succès"
}
```

### GET `/api/reports/config`

**Description:** Récupère la configuration rapports

**Response:**
```json
{
  "success": true,
  "data": {
    "pointFlash": {
      "enabled": true,
      "schedule": {
        "dayOfWeek": 0,
        "hour": 19,
        "minute": 0
      },
      "whatsappGroups": ["120363...@g.us"],
      "includePDF": true,
      "sendTextSummary": true
    },
    "dailyExpenses": { ... },
    "dailySales": { ... }
  }
}
```

### POST `/api/reports/config`

**Description:** Sauvegarde la configuration

**Body:**
```json
{
  "pointFlash": { ... },
  "dailyExpenses": { ... },
  "dailySales": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration sauvegardée avec succès"
}
```

### GET `/api/whatsapp/groups`

**Description:** Liste les groupes WhatsApp configurés

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "groupId": "120363...@g.us",
      "name": "Direction Générale",
      "description": "Groupe DG principal"
    }
  ]
}
```

### POST `/api/whatsapp/groups`

**Description:** Sauvegarde les groupes WhatsApp

**Body:**
```json
{
  "groups": [
    {
      "groupId": "120363...@g.us",
      "name": "Direction Générale"
    }
  ]
}
```

### POST `/api/whatsapp/test`

**Description:** Teste la connexion à un groupe

**Body:**
```json
{
  "groupId": "120363...@g.us"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test réussi ! Message envoyé au groupe"
}
```

---

## 🎯 Cas d'Usage Concrets

### Cas 1: Point Flash Automatique Hebdomadaire

**Objectif:** Chaque dimanche à 19h, envoyer automatiquement le Point Flash

**Configuration:**

1. Aller sur `/reports/config`
2. Section "Point Flash Hebdomadaire"
   - Activer le toggle
   - Sélectionner: Dimanche, 19:00
   - Cocher "Inclure PDF" et "Résumé texte"
   - Sélectionner groupes WhatsApp (ex: "Direction Générale")
3. Sauvegarder

**Résultat:**
- Dimanche 19h: Service s'exécute automatiquement
- Génère données: CA, dépenses, profit, alertes...
- Génère PDF professionnel avec signatures
- Upload PDF (TODO: configurer bucket S3/Cloudinary)
- Envoie message texte + PDF vers groupes WhatsApp
- DG reçoit rapport complet sans action manuelle

**Impact:**
- ⏱️ Gain de temps: 30 min/semaine
- 📊 Décisions data-driven
- 🚀 Réactivité accrue aux alertes

### Cas 2: Fiche de Décaissement avec Signatures

**Objectif:** Générer un PDF de dépense validée avec workflow de signatures

**Code:**

```typescript
// Dans app/api/expenses/[id]/decaissement/route.ts

import { PDFGeneratorService } from '@/lib/modules/reports/pdf-generator-service';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const expenseId = params.id;

  // Récupérer la dépense + validations
  const expense = await getExpense(expenseId);
  const validations = await getValidations(expenseId);

  const data: PDFDecaissement = {
    decaissementId: `DEC-${new Date().getFullYear()}-${expense.ExpenseId.slice(-4)}`,
    expenseId: expense.ExpenseId,
    expenseTitle: expense.Title,
    amount: expense.Amount,
    beneficiary: expense.Beneficiary,
    category: expense.Category.Label,
    requestDate: expense.CreatedAt,

    requestedBy: {
      name: expense.RequestedBy.FullName,
      role: expense.RequestedBy.Position,
      date: expense.CreatedAt,
      simulatedSignature: true,
    },

    approvedBy: validations.map(v => ({
      name: v.ApprovedBy.FullName,
      role: v.ApprovedBy.Position,
      date: v.ApprovedAt,
      simulatedSignature: true,
    })),

    paidBy: expense.PaidBy ? {
      name: expense.PaidBy.FullName,
      role: expense.PaidBy.Position,
      date: expense.PaidDate,
      simulatedSignature: true,
    } : undefined,

    description: expense.Description,
  };

  const pdfGenerator = new PDFGeneratorService();
  const pdfBlob = await pdfGenerator.generateDecaissementPDF(data);

  // Retourner le PDF
  return new NextResponse(pdfBlob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Decaissement_${data.decaissementId}.pdf"`,
    },
  });
}
```

**Résultat:**
- PDF professionnel A4
- Header avec logo DDM
- Tableau infos principales
- Section signatures avec:
  - Demandeur
  - Approbateurs (plusieurs si nécessaire)
  - Payeur
- Signatures simulées visuelles (initiales stylisées)
- Footer avec pagination
- Prêt pour archivage/comptabilité

### Cas 3: Transmission Quotidienne Dépenses WhatsApp

**Objectif:** Chaque jour à 18h, envoyer résumé dépenses

**Configuration:**

1. `/reports/config`
2. Section "Dépenses Quotidiennes"
   - Activer
   - Heure: 18:00
   - Cocher "Inclure PDF"
   - Sélectionner groupe "Comptabilité"
3. Sauvegarder

**Backend (Cron Job):**

```typescript
// Script à exécuter quotidiennement à 18h (via cron ou Vercel Cron)

import { WhatsAppReportService } from '@/lib/modules/reports/whatsapp-report-service';
import { DashboardService } from '@/lib/modules/reports/dashboard-service';

const whatsappService = new WhatsAppReportService();
const dashboardService = new DashboardService();

async function sendDailyExpenses() {
  const today = new Date().toISOString().split('T')[0];

  // Récupérer dépenses du jour
  const expenses = await getExpensesForDate(today);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.Amount, 0);

  const expensesByCategory = aggregateByCategory(expenses);

  const pendingExpenses = expenses.filter(e => e.Status === 'pending').length;

  // Optionnel: générer PDF
  const pdfUrl = await generateExpensesPDF(expenses);

  // Envoyer via WhatsApp
  await whatsappService.sendDailyExpenses({
    date: today,
    totalExpenses,
    expensesByCategory,
    pendingExpenses,
    pdfUrl,
    targetGroups: ['group_comptabilite'],
  });
}
```

**Message WhatsApp reçu:**
```
💸 *DÉPENSES DU MERCREDI 15 JANVIER 2025*

💰 *TOTAL: 125 000 F CFA*

📋 *PAR CATÉGORIE:*
• Fournitures: 45 000 F
• Transport: 30 000 F
• Maintenance: 50 000 F

⏳ *3* dépenses en attente de validation

_Généré automatiquement par DDM_

[PDF joint: Depenses_2025-01-15.pdf]
```

### Cas 4: Dashboard DG Mobile - Pilotage Temps Réel

**Objectif:** Consulter KPIs en temps réel sur mobile

**Usage:**

1. Ouvrir `/dashboard/dg` sur mobile
2. Visualiser immédiatement:
   - Alertes en rouge si problème
   - 6 KPIs avec tendances
   - Top produits
   - Activité récente
3. Changer période (Aujourd'hui | 7j | 30j) d'un tap
4. Rafraîchir d'un tap (bouton refresh)
5. Actions rapides:
   - Générer Point Flash en 1 tap
   - Accéder rapports
   - Voir analytics détaillées

**Impact:**
- 📱 Pilotage mobile 24/7
- ⚡ Décisions rapides
- 👀 Visibilité totale

---

## 🚀 Déploiement

### Variables d'Environnement

```bash
# WhatsApp Business API (Meta)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_API_KEY=your_api_key
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id

# Upload PDF (optionnel - Cloudinary, S3, etc.)
CLOUDINARY_URL=cloudinary://...
# OU
AWS_S3_BUCKET=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Tables Airtable Requises

1. **ReportConfig** (nouvelle)
   - ConfigId (primary key)
   - WorkspaceId
   - PointFlashEnabled (checkbox)
   - PointFlashSchedule (JSON: { dayOfWeek, hour, minute })
   - PointFlashGroups (multiple select ou JSON)
   - DailyExpensesEnabled (checkbox)
   - DailyExpensesSchedule (JSON)
   - etc.

2. **WhatsAppGroup** (nouvelle)
   - GroupId (primary key)
   - WorkspaceId
   - Name
   - Description
   - CreatedAt

3. **ReportExecution** (existante - à compléter)
   - Ajouter: PDFUrl, WhatsAppSentTo (JSON)

### Installation Dépendances NPM

```bash
npm install jspdf jspdf-autotable
```

### Checklist de Déploiement

- [ ] Créer tables Airtable (ReportConfig, WhatsAppGroup)
- [ ] Configurer WhatsApp Business API (Meta Business Manager)
- [ ] Obtenir Phone Number ID et API Key
- [ ] Configurer variables d'environnement
- [ ] Installer jspdf et jspdf-autotable
- [ ] Configurer service upload PDF (Cloudinary ou S3)
- [ ] Tester génération PDF en local
- [ ] Tester envoi WhatsApp vers groupe test
- [ ] Configurer Cron Jobs (Vercel Cron ou externe)
  - Point Flash: Dimanche 19h
  - Dépenses quotidiennes: Tous les jours 18h
  - Ventes quotidiennes: Tous les jours 20h
- [ ] Former utilisateurs sur `/reports/config`
- [ ] Créer groupes WhatsApp et récupérer IDs
- [ ] Documenter procédure récupération Group ID WhatsApp

---

## 📚 Guide Utilisateur

### Pour la Direction Générale

**Dashboard Temps Réel:**

1. Ouvrir `/dashboard/dg` sur navigateur ou mobile
2. Visualiser KPIs en un coup d'œil
3. Cliquer sur "Point Flash" pour générer manuellement
4. Utiliser filtres période pour analyser tendances

**Point Flash Hebdomadaire:**

- Reçu automatiquement chaque dimanche 19h sur WhatsApp
- Format: Message texte résumé + PDF joint
- Contient:
  - KPIs principaux (CA, dépenses, profit, trésorerie)
  - Tendances vs semaine précédente
  - Top 5 produits et commerciaux
  - Alertes automatiques (rouge=urgent, orange=attention)
  - Objectifs et progression

**Actions:**
- Consulter PDF pour détails complets
- Partager dans groupe si nécessaire
- Prendre décisions basées sur alertes

### Pour la Comptabilité

**Dépenses Quotidiennes:**

- Reçues automatiquement chaque jour 18h sur WhatsApp
- Format: Message texte + optionnel PDF
- Contient:
  - Total dépenses du jour
  - Répartition par catégorie
  - Nombre de dépenses en attente

**Fiches de Décaissement:**

- Générées sur demande depuis interface dépenses
- Format: PDF A4 professionnel
- Contient workflow complet avec signatures
- Prêt pour archivage

### Pour l'Administrateur

**Configuration Rapports:**

1. Ouvrir `/reports/config`

2. **Ajouter groupes WhatsApp:**
   - Créer groupe WhatsApp
   - Récupérer Group ID (format: 120363...@g.us)
   - Ajouter dans section "Groupes WhatsApp"

3. **Configurer Point Flash:**
   - Activer toggle
   - Choisir jour et heure
   - Sélectionner groupes destinataires
   - Options: PDF + texte recommandé

4. **Tester:**
   - Cliquer "Tester WhatsApp"
   - Vérifier réception dans groupe

5. **Sauvegarder:**
   - Cliquer "Sauvegarder la Configuration"
   - Confirmer message succès

---

## 🔧 Maintenance

### Récupérer Group ID WhatsApp

**Méthode 1: Via WhatsApp Business API**

```bash
curl -X GET "https://graph.facebook.com/v18.0/{phone_number_id}/groups" \
  -H "Authorization: Bearer {api_key}"
```

**Méthode 2: Via Webhook**

1. Configurer webhook dans Meta Business Manager
2. Envoyer message depuis groupe vers votre numéro business
3. Récupérer Group ID dans payload webhook

**Méthode 3: Manuelle (temporaire)**

1. Utiliser WhatsApp Web
2. Ouvrir groupe
3. URL contient Group ID: `https://web.whatsapp.com/send?phone=...`

### Monitoring

**Vérifier envois quotidiens:**

```sql
-- Logs d'envois WhatsApp (à créer dans Airtable)
SELECT * FROM WhatsAppLogs
WHERE SentAt >= DATEADD(NOW(), -1, 'day')
ORDER BY SentAt DESC
```

**Taux de succès:**

- Tracker dans table WhatsAppLogs: { ReportType, SentAt, Success, Error }
- Dashboard monitoring: % succès par type de rapport
- Alertes si taux < 95%

### Troubleshooting

**Problème: WhatsApp ne fonctionne pas**

1. Vérifier variables d'environnement
2. Tester connexion: `/api/whatsapp/test`
3. Vérifier quotas Meta API
4. Vérifier Group ID correct

**Problème: PDF ne se génère pas**

1. Vérifier jspdf installé: `npm list jspdf`
2. Vérifier données complètes (pas de null)
3. Tester génération locale

**Problème: Point Flash ne s'envoie pas automatiquement**

1. Vérifier Cron Job configuré
2. Vérifier heure/jour correct dans config
3. Vérifier logs serveur
4. Tester manuellement: POST `/api/reports/point-flash/generate`

---

## 📈 Roadmap Future

### Phase 2 (Court Terme)

- [ ] **Upload PDF automatique** (Cloudinary/S3)
- [ ] **Email** en complément WhatsApp
- [ ] **Rapports personnalisés** via UI (wizard création)
- [ ] **Graphiques dans PDF** (charts intégrés)
- [ ] **Archivage automatique** des PDFs (1 an)

### Phase 3 (Moyen Terme)

- [ ] **Dashboard DG graphiques interactifs** (Recharts)
- [ ] **Notifications push** (web push + mobile)
- [ ] **Rapports comparatifs** (année N vs N-1)
- [ ] **Export Excel** avancé (formules, graphiques)
- [ ] **Webhooks** pour intégrations externes

### Phase 4 (Long Terme)

- [ ] **BI intégré** (tableau de bord personnalisable)
- [ ] **ML prédictions** dans Point Flash
- [ ] **Rapports vocaux** (synthèse audio via WhatsApp)
- [ ] **Multi-workspace** avec consolidation groupe
- [ ] **API publique** pour partenaires

---

## ✅ Résumé Exécutif

Le **Module Reporting & Point Flash** transforme la gestion de l'information en:

✅ **Automatisant** la génération et transmission de rapports (Point Flash, Dépenses, Ventes)
✅ **Flexibilisant** les canaux: PDF professionnel ET/OU messages WhatsApp simples
✅ **Mobilisant** le pilotage via Dashboard DG temps réel mobile-first
✅ **Professionnalisant** avec PDF signatures simulées et mise en forme soignée
✅ **Simplifiant** avec configuration intuitive en 1 click

**Impact Business:**
- ⏱️ Gain de temps: 2h/semaine (automatisation Point Flash + rapports)
- 📊 Décisions data-driven: KPIs temps réel toujours accessibles
- 🚀 Réactivité: Alertes automatiques permettent actions rapides
- 💰 ROI: Retour sur investissement < 2 semaines

**Prochaines Étapes:**
1. Déployer le module en production
2. Configurer WhatsApp Business API
3. Créer groupes WhatsApp et récupérer IDs
4. Configurer Point Flash (dimanche 19h)
5. Tester pendant 1 semaine
6. Former DG et comptabilité
7. Mesurer adoption et satisfaction

---

**Version:** 1.0
**Dernière mise à jour:** 2025-01-15
**Auteur:** DDM Development Team
