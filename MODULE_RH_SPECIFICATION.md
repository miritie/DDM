# Module 7.7 - RH & Rémunérations
## Spécification Technique Complète

---

## 1. Vue d'ensemble

### 1.1 Objectif du module
Le module **RH & Rémunérations** gère l'ensemble du cycle de vie des employés, de leur recrutement jusqu'à leur départ, en passant par la gestion de la présence, des commissions, de la paie et des objectifs de performance.

### 1.2 Priorité
**HAUTE** - Module essentiel pour la gestion du personnel et des rémunérations

### 1.3 Dépendances
- **Module 7.1 - Trésorerie & Flux** : Paiement des salaires et avances
- **Module 7.3 - Ventes & Clients** : Calcul des commissions sur ventes
- **Airtable** : Stockage et gestion des données
- **Géolocalisation** : Vérification de présence
- **Upload de fichiers** : Photos de présence, pièces d'identité

### 1.4 État actuel
- **Backend** : 0%
- **Frontend** : 0%
- **Documentation** : En cours

---

## 2. Architecture des données

### 2.1 Modèle de données complet

```typescript
// Types de statuts et enums
export type EmployeeStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type EmployeeRole = 'admin' | 'manager' | 'sales_agent' | 'warehouse_keeper' | 'accountant' | 'delivery' | 'production' | 'other';
export type ContractType = 'permanent' | 'temporary' | 'contractor' | 'intern';
export type AttendanceStatus = 'pending' | 'validated' | 'rejected' | 'auto_validated';
export type CommissionStatus = 'pending' | 'calculated' | 'paid';
export type CommissionType = 'sales' | 'target_bonus' | 'performance_bonus' | 'manual';
export type PayrollStatus = 'draft' | 'calculated' | 'validated' | 'paid' | 'cancelled';

// Interfaces principales
export interface Employee {
  EmployeeId: string;
  EmployeeCode: string; // EMP-0001
  FirstName: string;
  LastName: string;
  FullName: string;
  Status: EmployeeStatus;

  // Contact
  Phone: string;
  Email?: string;
  Address?: string;
  City?: string;

  // Emploi
  Role: EmployeeRole;
  Department?: string;
  Position: string;
  ManagerId?: string;
  ManagerName?: string;

  // Contrat
  ContractType: ContractType;
  HireDate: string;
  ContractEndDate?: string;
  BaseSalary: number;
  Currency: string;

  // Commission
  CommissionEnabled: boolean;
  CommissionRate?: number;
  CommissionType?: 'percentage' | 'fixed_per_sale' | 'tiered';

  // Objectifs
  MonthlyTarget?: number;
  TargetBonus?: number;

  // Photo et identification
  PhotoUrl?: string;
  IdentityCardNumber?: string;

  Notes?: string;
  Tags?: string[];

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Attendance {
  AttendanceId: string;
  EmployeeId: string;
  EmployeeName: string;
  EmployeeRole: EmployeeRole;
  Status: AttendanceStatus;

  // Date et horaires
  AttendanceDate: string;
  CheckInTime: string;
  CheckOutTime?: string;
  TotalHours?: number;

  // Localisation (géolocalisation)
  CheckInLatitude?: number;
  CheckInLongitude?: number;
  CheckInLocation?: string;
  CheckOutLatitude?: number;
  CheckOutLongitude?: number;
  CheckOutLocation?: string;

  // Photos (preuve de présence)
  CheckInPhotoUrl?: string;
  CheckOutPhotoUrl?: string;

  // Lieu de travail
  LocationId?: string;
  LocationName?: string;

  // Validation
  ValidatedById?: string;
  ValidatedByName?: string;
  ValidatedAt?: string;
  RejectionReason?: string;

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Commission {
  CommissionId: string;
  EmployeeId: string;
  EmployeeName: string;
  Type: CommissionType;
  Status: CommissionStatus;

  Period: string; // YYYY-MM
  BasedOnAmount?: number;
  CommissionRate?: number;
  CalculatedAmount: number;
  Currency: string;

  ReferenceId?: string;
  ReferenceType?: 'sale' | 'target' | 'performance';
  ReferenceNumber?: string;

  PaidDate?: string;
  PayrollId?: string;

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface PayrollLine {
  PayrollLineId: string;
  PayrollId: string;
  EmployeeId: string;
  EmployeeName: string;

  BaseSalary: number;

  ExpectedDays: number;
  WorkedDays: number;
  AbsenceDays: number;

  TotalCommissions: number;
  TotalBonuses: number;

  Advances: number;
  Deductions: number;

  GrossAmount: number;
  NetAmount: number;

  Currency: string;
  Notes?: string;
}

export interface Payroll {
  PayrollId: string;
  PayrollNumber: string; // PAY-202411-0001
  Status: PayrollStatus;

  Period: string; // YYYY-MM
  PeriodStart: string;
  PeriodEnd: string;

  Lines: PayrollLine[];

  TotalEmployees: number;
  TotalGross: number;
  TotalNet: number;
  TotalCommissions: number;
  TotalBonuses: number;
  TotalAdvances: number;
  TotalDeductions: number;
  Currency: string;

  PreparedById: string;
  PreparedByName: string;
  ValidatedById?: string;
  ValidatedByName?: string;
  ValidatedAt?: string;
  PaidById?: string;
  PaidByName?: string;
  PaidAt?: string;

  PaymentMethod?: 'bank_transfer' | 'cash' | 'mobile_money' | 'check';
  WalletId?: string;
  TransactionIds?: string[];

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface EmployeeTarget {
  TargetId: string;
  EmployeeId: string;
  EmployeeName: string;

  Period: string; // YYYY-MM
  PeriodStart: string;
  PeriodEnd: string;

  SalesTarget: number;
  CurrentSales: number;
  AchievementRate: number;

  TargetBonus: number;
  BonusEarned: number;
  BonusPaid: boolean;

  IsAchieved: boolean;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface EmployeeAdvance {
  AdvanceId: string;
  AdvanceNumber: string; // ADV-202411-0001
  EmployeeId: string;
  EmployeeName: string;

  Amount: number;
  Currency: string;
  Reason?: string;

  RequestDate: string;
  ApprovedById?: string;
  ApprovedByName?: string;
  ApprovedAt?: string;

  Status: 'pending' | 'approved' | 'rejected' | 'paid' | 'deducted';

  PaymentDate?: string;
  PaymentMethod?: 'cash' | 'bank_transfer' | 'mobile_money';
  WalletId?: string;
  TransactionId?: string;

  DeductionPayrollId?: string;
  DeductionDate?: string;

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface EmployeeLeave {
  LeaveId: string;
  EmployeeId: string;
  EmployeeName: string;

  LeaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  StartDate: string;
  EndDate: string;
  TotalDays: number;

  Reason?: string;
  Status: 'pending' | 'approved' | 'rejected' | 'cancelled';

  RequestDate: string;
  ApprovedById?: string;
  ApprovedByName?: string;
  ApprovedAt?: string;
  RejectionReason?: string;

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

### 2.2 Tables Airtable

#### Table: Employee
| Champ | Type | Description |
|-------|------|-------------|
| EmployeeId | Single line text (Primary) | Identifiant unique UUID |
| EmployeeCode | Single line text | Code employé (EMP-0001) |
| FirstName | Single line text | Prénom |
| LastName | Single line text | Nom |
| FullName | Formula | `{FirstName} & " " & {LastName}` |
| Status | Single select | active, inactive, suspended, terminated |
| Phone | Phone number | Téléphone |
| Email | Email | Email |
| Address | Long text | Adresse |
| City | Single line text | Ville |
| Role | Single select | admin, manager, sales_agent, etc. |
| Department | Single line text | Département |
| Position | Single line text | Poste |
| ManagerId | Single line text | ID du manager |
| ManagerName | Single line text | Nom du manager |
| ContractType | Single select | permanent, temporary, contractor, intern |
| HireDate | Date | Date d'embauche |
| ContractEndDate | Date | Date de fin de contrat |
| BaseSalary | Currency | Salaire de base |
| Currency | Single line text | Devise |
| CommissionEnabled | Checkbox | Commission activée |
| CommissionRate | Number | Taux de commission (%) |
| CommissionType | Single select | percentage, fixed_per_sale, tiered |
| MonthlyTarget | Currency | Objectif mensuel |
| TargetBonus | Currency | Prime sur objectif |
| PhotoUrl | URL | Photo de l'employé |
| IdentityCardNumber | Single line text | Numéro CNI |
| Notes | Long text | Notes |
| Tags | Multiple select | Tags |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: Attendance
| Champ | Type | Description |
|-------|------|-------------|
| AttendanceId | Single line text (Primary) | Identifiant unique UUID |
| EmployeeId | Single line text | ID employé |
| EmployeeName | Single line text | Nom employé |
| EmployeeRole | Single select | Rôle employé |
| Status | Single select | pending, validated, rejected, auto_validated |
| AttendanceDate | Date | Date de présence |
| CheckInTime | Single line text | Heure d'arrivée |
| CheckOutTime | Single line text | Heure de départ |
| TotalHours | Number | Total heures |
| CheckInLatitude | Number | Latitude arrivée |
| CheckInLongitude | Number | Longitude arrivée |
| CheckInLocation | Single line text | Adresse arrivée |
| CheckOutLatitude | Number | Latitude départ |
| CheckOutLongitude | Number | Longitude départ |
| CheckOutLocation | Single line text | Adresse départ |
| CheckInPhotoUrl | URL | Photo arrivée |
| CheckOutPhotoUrl | URL | Photo départ |
| LocationId | Single line text | ID lieu de travail |
| LocationName | Single line text | Nom lieu |
| ValidatedById | Single line text | ID validateur |
| ValidatedByName | Single line text | Nom validateur |
| ValidatedAt | Date | Date validation |
| RejectionReason | Long text | Raison rejet |
| Notes | Long text | Notes |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: Commission
| Champ | Type | Description |
|-------|------|-------------|
| CommissionId | Single line text (Primary) | Identifiant unique UUID |
| EmployeeId | Single line text | ID employé |
| EmployeeName | Single line text | Nom employé |
| Type | Single select | sales, target_bonus, performance_bonus, manual |
| Status | Single select | pending, calculated, paid |
| Period | Single line text | Période (YYYY-MM) |
| BasedOnAmount | Currency | Montant de base |
| CommissionRate | Number | Taux (%) |
| CalculatedAmount | Currency | Montant calculé |
| Currency | Single line text | Devise |
| ReferenceId | Single line text | ID référence |
| ReferenceType | Single select | sale, target, performance |
| ReferenceNumber | Single line text | Numéro référence |
| PaidDate | Date | Date paiement |
| PayrollId | Single line text | ID paie |
| Notes | Long text | Notes |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: Payroll
| Champ | Type | Description |
|-------|------|-------------|
| PayrollId | Single line text (Primary) | Identifiant unique UUID |
| PayrollNumber | Single line text | Numéro paie (PAY-202411-0001) |
| Status | Single select | draft, calculated, validated, paid, cancelled |
| Period | Single line text | Période (YYYY-MM) |
| PeriodStart | Date | Début période |
| PeriodEnd | Date | Fin période |
| Lines | Long text (JSON) | Lignes de paie |
| TotalEmployees | Number | Total employés |
| TotalGross | Currency | Total brut |
| TotalNet | Currency | Total net |
| TotalCommissions | Currency | Total commissions |
| TotalBonuses | Currency | Total primes |
| TotalAdvances | Currency | Total avances |
| TotalDeductions | Currency | Total déductions |
| Currency | Single line text | Devise |
| PreparedById | Single line text | ID préparateur |
| PreparedByName | Single line text | Nom préparateur |
| ValidatedById | Single line text | ID validateur |
| ValidatedByName | Single line text | Nom validateur |
| ValidatedAt | Date | Date validation |
| PaidById | Single line text | ID payeur |
| PaidByName | Single line text | Nom payeur |
| PaidAt | Date | Date paiement |
| PaymentMethod | Single select | bank_transfer, cash, mobile_money, check |
| WalletId | Single line text | ID portefeuille |
| TransactionIds | Long text (JSON) | IDs transactions |
| Notes | Long text | Notes |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: EmployeeTarget
| Champ | Type | Description |
|-------|------|-------------|
| TargetId | Single line text (Primary) | Identifiant unique UUID |
| EmployeeId | Single line text | ID employé |
| EmployeeName | Single line text | Nom employé |
| Period | Single line text | Période (YYYY-MM) |
| PeriodStart | Date | Début période |
| PeriodEnd | Date | Fin période |
| SalesTarget | Currency | Objectif ventes |
| CurrentSales | Currency | Ventes actuelles |
| AchievementRate | Percent | Taux réalisation |
| TargetBonus | Currency | Prime objectif |
| BonusEarned | Currency | Prime gagnée |
| BonusPaid | Checkbox | Prime payée |
| IsAchieved | Checkbox | Objectif atteint |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: EmployeeAdvance
| Champ | Type | Description |
|-------|------|-------------|
| AdvanceId | Single line text (Primary) | Identifiant unique UUID |
| AdvanceNumber | Single line text | Numéro avance (ADV-202411-0001) |
| EmployeeId | Single line text | ID employé |
| EmployeeName | Single line text | Nom employé |
| Amount | Currency | Montant |
| Currency | Single line text | Devise |
| Reason | Long text | Raison |
| RequestDate | Date | Date demande |
| ApprovedById | Single line text | ID approbateur |
| ApprovedByName | Single line text | Nom approbateur |
| ApprovedAt | Date | Date approbation |
| Status | Single select | pending, approved, rejected, paid, deducted |
| PaymentDate | Date | Date paiement |
| PaymentMethod | Single select | cash, bank_transfer, mobile_money |
| WalletId | Single line text | ID portefeuille |
| TransactionId | Single line text | ID transaction |
| DeductionPayrollId | Single line text | ID paie déduction |
| DeductionDate | Date | Date déduction |
| Notes | Long text | Notes |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

#### Table: EmployeeLeave
| Champ | Type | Description |
|-------|------|-------------|
| LeaveId | Single line text (Primary) | Identifiant unique UUID |
| EmployeeId | Single line text | ID employé |
| EmployeeName | Single line text | Nom employé |
| LeaveType | Single select | annual, sick, maternity, paternity, unpaid, other |
| StartDate | Date | Date début |
| EndDate | Date | Date fin |
| TotalDays | Number | Total jours |
| Reason | Long text | Raison |
| Status | Single select | pending, approved, rejected, cancelled |
| RequestDate | Date | Date demande |
| ApprovedById | Single line text | ID approbateur |
| ApprovedByName | Single line text | Nom approbateur |
| ApprovedAt | Date | Date approbation |
| RejectionReason | Long text | Raison rejet |
| Notes | Long text | Notes |
| WorkspaceId | Single line text | ID workspace |
| CreatedAt | Created time | Date de création |
| UpdatedAt | Last modified time | Date de modification |

---

## 3. Workflows et processus métier

### 3.1 Workflow - Gestion de la présence

```
┌─────────────┐
│  Employé    │
│ arrive au   │
│  travail    │
└──────┬──────┘
       │
       v
┌─────────────────────────┐
│ Check-in mobile app     │
│ - Photo selfie          │
│ - Géolocalisation       │
│ - Heure d'arrivée       │
└──────┬──────────────────┘
       │
       v
┌─────────────────────────┐
│ Validation automatique  │
│ - Distance < 100m ?     │
│ - Photo claire ?        │
│ - Horaires OK ?         │
└──────┬──────────────────┘
       │
       ├─── OUI ──> Status: auto_validated
       │
       └─── NON ──> Status: pending
                          │
                          v
                   ┌──────────────┐
                   │ Validation   │
                   │  manuelle    │
                   │  (Manager)   │
                   └──────┬───────┘
                          │
                          ├─── Approuvé ──> Status: validated
                          │
                          └─── Rejeté ──> Status: rejected
```

**Transitions autorisées** :
- `pending` → `validated` (validation manager)
- `pending` → `rejected` (rejet manager)
- Check-in → `auto_validated` (si critères OK)

### 3.2 Workflow - Calcul des commissions

```
┌─────────────┐
│   Vente     │
│  finalisée  │
└──────┬──────┘
       │
       v
┌──────────────────────────┐
│ Déclenchement automatique│
│ Calcul commission        │
│ - Employee.CommissionRate│
│ - Sale.TotalAmount       │
└──────┬───────────────────┘
       │
       v
┌──────────────────────────┐
│ Création Commission      │
│ Status: pending          │
│ Type: sales              │
└──────┬───────────────────┘
       │
       v
┌──────────────────────────┐
│ Fin du mois              │
│ Calcul paie              │
└──────┬───────────────────┘
       │
       v
┌──────────────────────────┐
│ Commission intégrée      │
│ Status: calculated       │
│ PayrollId renseigné      │
└──────┬───────────────────┘
       │
       v
┌──────────────────────────┐
│ Paiement paie            │
│ Commission → paid        │
└──────────────────────────┘
```

**Transitions autorisées** :
- `pending` → `calculated` (intégration à la paie)
- `calculated` → `paid` (paiement de la paie)

### 3.3 Workflow - Génération de la paie

```
┌─────────────┐
│  Fin du     │
│    mois     │
└──────┬──────┘
       │
       v
┌────────────────────────────┐
│ Préparation paie           │
│ - Sélection période        │
│ - Sélection employés       │
│ Status: draft              │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Calcul automatique         │
│ Pour chaque employé:       │
│ 1. Jours travaillés        │
│ 2. Salaire proportionnel   │
│ 3. + Commissions           │
│ 4. + Primes                │
│ 5. - Avances               │
│ 6. - Déductions            │
│ = Net à payer              │
│ Status: calculated         │
└──────┬─────────────────────┘
       │
       v
┌────────────────────────────┐
│ Validation RH/Finance      │
│ - Vérification montants    │
│ - Corrections manuelles    │
└──────┬─────────────────────┘
       │
       ├─── Validé ──> Status: validated
       │                      │
       │                      v
       │               ┌──────────────┐
       │               │  Paiement    │
       │               │  effectué    │
       │               │ Status: paid │
       │               └──────────────┘
       │
       └─── Corrections ──> Retour à calculated
```

**Transitions autorisées** :
- `draft` → `calculated` (calcul automatique)
- `calculated` → `validated` (validation)
- `validated` → `paid` (paiement)
- `calculated` → `draft` (corrections)
- `validated` → `calculated` (corrections)
- Tout statut → `cancelled` (annulation)

### 3.4 Workflow - Avances sur salaire

```
┌─────────────┐
│  Employé    │
│  demande    │
│  avance     │
└──────┬──────┘
       │
       v
┌────────────────────────┐
│ Création EmployeeAdvance│
│ Status: pending        │
└──────┬─────────────────┘
       │
       v
┌────────────────────────┐
│ Approbation Manager    │
└──────┬─────────────────┘
       │
       ├─── Approuvé ──> Status: approved
       │                       │
       │                       v
       │                ┌──────────────┐
       │                │  Paiement    │
       │                │ Status: paid │
       │                └──────┬───────┘
       │                       │
       │                       v
       │                ┌──────────────┐
       │                │ Fin du mois  │
       │                │ Déduction    │
       │                │ sur paie     │
       │                │ Status:      │
       │                │ deducted     │
       │                └──────────────┘
       │
       └─── Rejeté ──> Status: rejected
```

**Transitions autorisées** :
- `pending` → `approved` (approbation)
- `pending` → `rejected` (rejet)
- `approved` → `paid` (paiement)
- `paid` → `deducted` (déduction en paie)

---

## 4. Spécifications des services

### 4.1 EmployeeService

**Fichier** : `lib/modules/hr/employee-service.ts`

**Responsabilités** :
- Gestion CRUD des employés
- Génération des codes employés
- Gestion des statuts
- Statistiques employés

**Méthodes** :

```typescript
export class EmployeeService {
  // Génération du code employé
  async generateEmployeeCode(workspaceId: string): Promise<string>
  // Format: EMP-0001, EMP-0002...

  // Création employé
  async create(input: CreateEmployeeInput): Promise<Employee>

  // Lecture
  async getById(employeeId: string): Promise<Employee | null>
  async getByCode(code: string, workspaceId: string): Promise<Employee | null>

  // Liste avec filtres
  async list(
    workspaceId: string,
    filters?: {
      status?: EmployeeStatus;
      role?: EmployeeRole;
      managerId?: string;
      department?: string;
    }
  ): Promise<Employee[]>

  // Mise à jour
  async update(
    employeeId: string,
    updates: Partial<Employee>
  ): Promise<Employee>

  // Changement de statut
  async activate(employeeId: string): Promise<Employee>
  async suspend(employeeId: string): Promise<Employee>
  async terminate(employeeId: string, terminationDate: string): Promise<Employee>

  // Gestion hiérarchique
  async assignManager(employeeId: string, managerId: string): Promise<Employee>
  async getSubordinates(managerId: string): Promise<Employee[]>

  // Statistiques
  async getStatistics(workspaceId: string): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    byRole: Record<EmployeeRole, number>;
    byDepartment: Record<string, number>;
    byContractType: Record<ContractType, number>;
    averageSalary: number;
    totalPayrollCost: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  role: EmployeeRole;
  department?: string;
  position: string;
  managerId?: string;
  contractType: ContractType;
  hireDate: string;
  contractEndDate?: string;
  baseSalary: number;
  currency: string;
  commissionEnabled?: boolean;
  commissionRate?: number;
  commissionType?: 'percentage' | 'fixed_per_sale' | 'tiered';
  monthlyTarget?: number;
  targetBonus?: number;
  photoUrl?: string;
  identityCardNumber?: string;
  workspaceId: string;
}
```

### 4.2 AttendanceService

**Fichier** : `lib/modules/hr/attendance-service.ts`

**Responsabilités** :
- Gestion de la présence
- Check-in/Check-out avec géolocalisation
- Validation automatique et manuelle
- Calcul des heures travaillées

**Méthodes** :

```typescript
export class AttendanceService {
  // Check-in
  async checkIn(input: CheckInInput): Promise<Attendance>

  // Check-out
  async checkOut(
    attendanceId: string,
    checkOutData: {
      checkOutTime: string;
      latitude?: number;
      longitude?: number;
      photoUrl?: string;
    }
  ): Promise<Attendance>

  // Validation automatique
  async autoValidate(attendanceId: string): Promise<Attendance>
  // Critères: distance < 100m, photo OK, horaires OK

  // Validation manuelle
  async validate(attendanceId: string, validatorId: string): Promise<Attendance>
  async reject(
    attendanceId: string,
    validatorId: string,
    reason: string
  ): Promise<Attendance>

  // Lecture
  async getById(attendanceId: string): Promise<Attendance | null>
  async getByEmployeeAndDate(
    employeeId: string,
    date: string
  ): Promise<Attendance | null>

  // Liste avec filtres
  async list(
    workspaceId: string,
    filters?: {
      employeeId?: string;
      status?: AttendanceStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Attendance[]>

  // Calcul des heures
  async calculateWorkedDays(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    expectedDays: number;
    workedDays: number;
    absenceDays: number;
    totalHours: number;
  }>

  // Rapport de présence
  async getAttendanceReport(
    workspaceId: string,
    period: { start: string; end: string }
  ): Promise<{
    byEmployee: Array<{
      employeeId: string;
      employeeName: string;
      expectedDays: number;
      workedDays: number;
      absenceDays: number;
      attendanceRate: number;
    }>;
    overall: {
      totalExpected: number;
      totalWorked: number;
      totalAbsences: number;
      overallRate: number;
    };
  }>
}
```

**Inputs** :

```typescript
export interface CheckInInput {
  employeeId: string;
  checkInTime: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  locationId?: string;
  workspaceId: string;
}
```

### 4.3 CommissionService

**Fichier** : `lib/modules/hr/commission-service.ts`

**Responsabilités** :
- Calcul automatique des commissions sur ventes
- Calcul des primes sur objectifs
- Gestion du statut des commissions
- Intégration avec la paie

**Méthodes** :

```typescript
export class CommissionService {
  // Calcul commission sur vente
  async calculateSalesCommission(
    saleId: string,
    employeeId: string
  ): Promise<Commission>
  // Appelé automatiquement à la création d'une vente

  // Calcul prime sur objectif
  async calculateTargetBonus(
    employeeId: string,
    period: string
  ): Promise<Commission | null>
  // Appelé en fin de mois si objectif atteint

  // Création manuelle
  async createManual(input: CreateManualCommissionInput): Promise<Commission>

  // Lecture
  async getById(commissionId: string): Promise<Commission | null>

  // Liste avec filtres
  async list(
    workspaceId: string,
    filters?: {
      employeeId?: string;
      type?: CommissionType;
      status?: CommissionStatus;
      period?: string;
    }
  ): Promise<Commission[]>

  // Changement de statut
  async markAsCalculated(
    commissionId: string,
    payrollId: string
  ): Promise<Commission>
  async markAsPaid(commissionId: string): Promise<Commission>

  // Récupération pour paie
  async getPendingForEmployee(
    employeeId: string,
    period: string
  ): Promise<Commission[]>

  // Statistiques
  async getCommissionStats(
    workspaceId: string,
    period?: string
  ): Promise<{
    totalCommissions: number;
    byEmployee: Record<string, number>;
    byType: Record<CommissionType, number>;
    averageCommission: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateManualCommissionInput {
  employeeId: string;
  type: CommissionType;
  period: string;
  amount: number;
  currency: string;
  reason: string;
  workspaceId: string;
}
```

### 4.4 PayrollService

**Fichier** : `lib/modules/hr/payroll-service.ts`

**Responsabilités** :
- Génération automatique de la paie
- Calcul des salaires et éléments variables
- Validation et paiement
- Intégration avec Trésorerie

**Méthodes** :

```typescript
export class PayrollService {
  // Génération du numéro de paie
  async generatePayrollNumber(workspaceId: string): Promise<string>
  // Format: PAY-202411-0001

  // Création et calcul automatique
  async createAndCalculate(input: CreatePayrollInput): Promise<Payroll>
  // Pour chaque employé actif:
  // 1. Calcul jours travaillés (AttendanceService)
  // 2. Salaire proportionnel
  // 3. + Commissions (CommissionService)
  // 4. + Primes (EmployeeTarget)
  // 5. - Avances non déduites (EmployeeAdvance)
  // 6. - Déductions
  // = Net à payer

  // Lecture
  async getById(payrollId: string): Promise<Payroll | null>
  async getByNumber(
    payrollNumber: string,
    workspaceId: string
  ): Promise<Payroll | null>

  // Liste
  async list(
    workspaceId: string,
    filters?: {
      status?: PayrollStatus;
      period?: string;
    }
  ): Promise<Payroll[]>

  // Recalcul
  async recalculate(payrollId: string): Promise<Payroll>

  // Modification manuelle d'une ligne
  async updateLine(
    payrollId: string,
    employeeId: string,
    updates: Partial<PayrollLine>
  ): Promise<Payroll>

  // Validation
  async validate(payrollId: string, validatorId: string): Promise<Payroll>

  // Paiement
  async pay(input: PayPayrollInput): Promise<Payroll>
  // 1. Mise à jour status → paid
  // 2. Création transactions trésorerie pour chaque employé
  // 3. Mise à jour commissions → paid
  // 4. Mise à jour avances → deducted

  // Annulation
  async cancel(payrollId: string): Promise<Payroll>

  // Bulletins de paie
  async getEmployeePayslip(
    payrollId: string,
    employeeId: string
  ): Promise<PayrollLine | null>

  // Statistiques
  async getPayrollStats(workspaceId: string): Promise<{
    currentMonthCost: number;
    averageMonthlyPayroll: number;
    byDepartment: Record<string, number>;
    commissionsRatio: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreatePayrollInput {
  period: string; // YYYY-MM
  workspaceId: string;
  preparedById: string;
  includeInactive?: boolean;
}

export interface PayPayrollInput {
  payrollId: string;
  payerId: string;
  paymentMethod: 'bank_transfer' | 'cash' | 'mobile_money' | 'check';
  walletId?: string;
}
```

### 4.5 EmployeeTargetService

**Fichier** : `lib/modules/hr/employee-target-service.ts`

**Responsabilités** :
- Définition des objectifs mensuels
- Suivi de la réalisation
- Calcul automatique des primes

**Méthodes** :

```typescript
export class EmployeeTargetService {
  // Création objectif
  async create(input: CreateTargetInput): Promise<EmployeeTarget>

  // Lecture
  async getById(targetId: string): Promise<EmployeeTarget | null>
  async getByEmployeeAndPeriod(
    employeeId: string,
    period: string
  ): Promise<EmployeeTarget | null>

  // Liste
  async list(
    workspaceId: string,
    filters?: {
      employeeId?: string;
      period?: string;
      isAchieved?: boolean;
    }
  ): Promise<EmployeeTarget[]>

  // Mise à jour progression
  async updateProgress(
    employeeId: string,
    period: string
  ): Promise<EmployeeTarget>
  // Appelé après chaque vente
  // Calcule CurrentSales et AchievementRate

  // Vérification atteinte objectif
  async checkAchievement(targetId: string): Promise<EmployeeTarget>
  // Si AchievementRate >= 100%, crée Commission bonus

  // Traitement fin de période
  async processPeriodEnd(period: string, workspaceId: string): Promise<void>
  // Pour chaque target de la période:
  // - Vérifier atteinte
  // - Créer commissions bonus si nécessaire

  // Statistiques
  async getTargetStats(
    workspaceId: string,
    period?: string
  ): Promise<{
    totalTargets: number;
    achievedTargets: number;
    achievementRate: number;
    totalBonusesPaid: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateTargetInput {
  employeeId: string;
  period: string; // YYYY-MM
  salesTarget: number;
  targetBonus: number;
  workspaceId: string;
}
```

### 4.6 EmployeeAdvanceService

**Fichier** : `lib/modules/hr/employee-advance-service.ts`

**Responsabilités** :
- Gestion des demandes d'avances
- Approbation
- Paiement et déduction

**Méthodes** :

```typescript
export class EmployeeAdvanceService {
  // Génération numéro
  async generateAdvanceNumber(workspaceId: string): Promise<string>
  // Format: ADV-202411-0001

  // Création
  async create(input: CreateAdvanceInput): Promise<EmployeeAdvance>

  // Lecture
  async getById(advanceId: string): Promise<EmployeeAdvance | null>

  // Liste
  async list(
    workspaceId: string,
    filters?: {
      employeeId?: string;
      status?: string;
    }
  ): Promise<EmployeeAdvance[]>

  // Approbation
  async approve(advanceId: string, approverId: string): Promise<EmployeeAdvance>
  async reject(
    advanceId: string,
    approverId: string,
    reason: string
  ): Promise<EmployeeAdvance>

  // Paiement
  async pay(input: PayAdvanceInput): Promise<EmployeeAdvance>
  // Crée transaction trésorerie

  // Déduction en paie
  async deduct(
    advanceId: string,
    payrollId: string
  ): Promise<EmployeeAdvance>

  // Récupération pour paie
  async getPendingForEmployee(employeeId: string): Promise<EmployeeAdvance[]>
  // Avances status: paid (non encore déduites)

  // Statistiques
  async getAdvanceStats(workspaceId: string): Promise<{
    totalAdvances: number;
    pendingAmount: number;
    paidAmount: number;
    deductedAmount: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateAdvanceInput {
  employeeId: string;
  amount: number;
  currency: string;
  reason?: string;
  workspaceId: string;
}

export interface PayAdvanceInput {
  advanceId: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'mobile_money';
  walletId?: string;
}
```

### 4.7 EmployeeLeaveService

**Fichier** : `lib/modules/hr/employee-leave-service.ts`

**Responsabilités** :
- Gestion des congés
- Approbation
- Impact sur présence et paie

**Méthodes** :

```typescript
export class EmployeeLeaveService {
  // Création
  async create(input: CreateLeaveInput): Promise<EmployeeLeave>

  // Lecture
  async getById(leaveId: string): Promise<EmployeeLeave | null>

  // Liste
  async list(
    workspaceId: string,
    filters?: {
      employeeId?: string;
      leaveType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<EmployeeLeave[]>

  // Approbation
  async approve(leaveId: string, approverId: string): Promise<EmployeeLeave>
  async reject(
    leaveId: string,
    approverId: string,
    reason: string
  ): Promise<EmployeeLeave>

  // Annulation
  async cancel(leaveId: string): Promise<EmployeeLeave>

  // Vérification disponibilité
  async checkAvailability(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<boolean>

  // Calcul jours de congés
  async calculateLeaveDays(
    employeeId: string,
    year: number
  ): Promise<{
    totalEntitled: number;
    totalTaken: number;
    totalPending: number;
    remaining: number;
  }>

  // Statistiques
  async getLeaveStats(workspaceId: string): Promise<{
    byType: Record<string, number>;
    averageLeaveDays: number;
    pendingRequests: number;
  }>
}
```

**Inputs** :

```typescript
export interface CreateLeaveInput {
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  startDate: string;
  endDate: string;
  reason?: string;
  workspaceId: string;
}
```

---

## 5. Intégrations avec autres modules

### 5.1 Intégration avec Module Trésorerie (7.1)

**Événements déclencheurs** :

#### 5.1.1 Paiement de la paie
```typescript
// Dans PayrollService.pay()
const payroll = await this.getById(input.payrollId);

for (const line of payroll.Lines) {
  // Créer une transaction pour chaque employé
  await treasuryService.createTransaction({
    type: 'expense',
    category: 'payroll',
    amount: line.NetAmount,
    currency: line.Currency,
    walletId: input.walletId,
    description: `Salaire ${payroll.Period} - ${line.EmployeeName}`,
    referenceId: line.EmployeeId,
    referenceType: 'payroll',
    workspaceId: payroll.WorkspaceId,
  });
}
```

#### 5.1.2 Paiement d'une avance
```typescript
// Dans EmployeeAdvanceService.pay()
await treasuryService.createTransaction({
  type: 'expense',
  category: 'advance',
  amount: advance.Amount,
  currency: advance.Currency,
  walletId: input.walletId,
  description: `Avance sur salaire - ${advance.EmployeeName}`,
  referenceId: advance.AdvanceId,
  referenceType: 'employee_advance',
  workspaceId: advance.WorkspaceId,
});
```

### 5.2 Intégration avec Module Ventes (7.3)

**Événements déclencheurs** :

#### 5.2.1 Création d'une vente → Calcul commission
```typescript
// Dans SaleService.create() ou finalize()
const sale = await this.create(input);

// Si le vendeur a des commissions activées
const employee = await employeeService.getById(sale.SalesAgentId);
if (employee.CommissionEnabled) {
  await commissionService.calculateSalesCommission(sale.SaleId, employee.EmployeeId);
}
```

#### 5.2.2 Mise à jour objectif employé
```typescript
// Dans SaleService.finalize()
const sale = await this.finalize(saleId);

// Mettre à jour la progression de l'objectif
await employeeTargetService.updateProgress(
  sale.SalesAgentId,
  getCurrentPeriod() // Format YYYY-MM
);
```

### 5.3 Webhook automatique fin de mois

**Tâche cron** : Exécution le dernier jour du mois à 23h00

```typescript
// lib/cron/monthly-hr-tasks.ts
export async function runMonthlyHRTasks(workspaceId: string) {
  const period = getCurrentPeriod(); // Format YYYY-MM

  // 1. Vérifier atteinte des objectifs et créer bonus
  await employeeTargetService.processPeriodEnd(period, workspaceId);

  // 2. Créer automatiquement la paie du mois
  const payroll = await payrollService.createAndCalculate({
    period,
    workspaceId,
    preparedById: 'system',
  });

  console.log(`Paie ${period} créée: ${payroll.PayrollNumber}`);
  console.log(`Total employés: ${payroll.TotalEmployees}`);
  console.log(`Total net: ${payroll.TotalNet} ${payroll.Currency}`);
}
```

---

## 6. Routes API

### 6.1 Employees

#### GET /api/modules/hr/employees
Liste des employés avec filtres
```typescript
Query params:
- status?: EmployeeStatus
- role?: EmployeeRole
- managerId?: string
- department?: string

Response: Employee[]
```

#### GET /api/modules/hr/employees/[id]
Détails d'un employé
```typescript
Response: Employee
```

#### POST /api/modules/hr/employees
Création d'un employé
```typescript
Body: CreateEmployeeInput
Response: Employee
```

#### PATCH /api/modules/hr/employees/[id]
Mise à jour d'un employé
```typescript
Body: Partial<Employee>
Response: Employee
```

#### POST /api/modules/hr/employees/[id]/activate
Activation
```typescript
Response: Employee
```

#### POST /api/modules/hr/employees/[id]/suspend
Suspension
```typescript
Response: Employee
```

#### POST /api/modules/hr/employees/[id]/terminate
Fin de contrat
```typescript
Body: { terminationDate: string }
Response: Employee
```

#### GET /api/modules/hr/employees/[id]/subordinates
Liste des subordonnés
```typescript
Response: Employee[]
```

#### GET /api/modules/hr/employees/stats
Statistiques employés
```typescript
Response: EmployeeStatistics
```

### 6.2 Attendance

#### GET /api/modules/hr/attendance
Liste des présences avec filtres
```typescript
Query params:
- employeeId?: string
- status?: AttendanceStatus
- startDate?: string
- endDate?: string

Response: Attendance[]
```

#### GET /api/modules/hr/attendance/[id]
Détails d'une présence
```typescript
Response: Attendance
```

#### POST /api/modules/hr/attendance/check-in
Check-in
```typescript
Body: CheckInInput
Response: Attendance
```

#### POST /api/modules/hr/attendance/[id]/check-out
Check-out
```typescript
Body: {
  checkOutTime: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
}
Response: Attendance
```

#### POST /api/modules/hr/attendance/[id]/validate
Validation manuelle
```typescript
Body: { validatorId: string }
Response: Attendance
```

#### POST /api/modules/hr/attendance/[id]/reject
Rejet
```typescript
Body: {
  validatorId: string;
  reason: string;
}
Response: Attendance
```

#### GET /api/modules/hr/attendance/employee/[employeeId]/worked-days
Calcul jours travaillés
```typescript
Query params:
- startDate: string
- endDate: string

Response: {
  expectedDays: number;
  workedDays: number;
  absenceDays: number;
  totalHours: number;
}
```

#### GET /api/modules/hr/attendance/report
Rapport de présence
```typescript
Query params:
- startDate: string
- endDate: string

Response: AttendanceReport
```

### 6.3 Commissions

#### GET /api/modules/hr/commissions
Liste des commissions
```typescript
Query params:
- employeeId?: string
- type?: CommissionType
- status?: CommissionStatus
- period?: string

Response: Commission[]
```

#### GET /api/modules/hr/commissions/[id]
Détails d'une commission
```typescript
Response: Commission
```

#### POST /api/modules/hr/commissions/manual
Création manuelle
```typescript
Body: CreateManualCommissionInput
Response: Commission
```

#### GET /api/modules/hr/commissions/employee/[employeeId]/pending
Commissions en attente pour un employé
```typescript
Query params:
- period: string

Response: Commission[]
```

#### GET /api/modules/hr/commissions/stats
Statistiques commissions
```typescript
Query params:
- period?: string

Response: CommissionStatistics
```

### 6.4 Payroll

#### GET /api/modules/hr/payroll
Liste des paies
```typescript
Query params:
- status?: PayrollStatus
- period?: string

Response: Payroll[]
```

#### GET /api/modules/hr/payroll/[id]
Détails d'une paie
```typescript
Response: Payroll
```

#### POST /api/modules/hr/payroll
Création et calcul
```typescript
Body: CreatePayrollInput
Response: Payroll
```

#### POST /api/modules/hr/payroll/[id]/recalculate
Recalcul
```typescript
Response: Payroll
```

#### PATCH /api/modules/hr/payroll/[id]/lines/[employeeId]
Modification ligne
```typescript
Body: Partial<PayrollLine>
Response: Payroll
```

#### POST /api/modules/hr/payroll/[id]/validate
Validation
```typescript
Body: { validatorId: string }
Response: Payroll
```

#### POST /api/modules/hr/payroll/[id]/pay
Paiement
```typescript
Body: PayPayrollInput
Response: Payroll
```

#### POST /api/modules/hr/payroll/[id]/cancel
Annulation
```typescript
Response: Payroll
```

#### GET /api/modules/hr/payroll/[id]/payslip/[employeeId]
Bulletin de paie
```typescript
Response: PayrollLine
```

#### GET /api/modules/hr/payroll/stats
Statistiques paie
```typescript
Response: PayrollStatistics
```

### 6.5 Employee Targets

#### GET /api/modules/hr/targets
Liste des objectifs
```typescript
Query params:
- employeeId?: string
- period?: string
- isAchieved?: boolean

Response: EmployeeTarget[]
```

#### GET /api/modules/hr/targets/[id]
Détails d'un objectif
```typescript
Response: EmployeeTarget
```

#### POST /api/modules/hr/targets
Création
```typescript
Body: CreateTargetInput
Response: EmployeeTarget
```

#### POST /api/modules/hr/targets/employee/[employeeId]/update-progress
Mise à jour progression
```typescript
Query params:
- period: string

Response: EmployeeTarget
```

#### GET /api/modules/hr/targets/stats
Statistiques objectifs
```typescript
Query params:
- period?: string

Response: TargetStatistics
```

### 6.6 Employee Advances

#### GET /api/modules/hr/advances
Liste des avances
```typescript
Query params:
- employeeId?: string
- status?: string

Response: EmployeeAdvance[]
```

#### GET /api/modules/hr/advances/[id]
Détails d'une avance
```typescript
Response: EmployeeAdvance
```

#### POST /api/modules/hr/advances
Création
```typescript
Body: CreateAdvanceInput
Response: EmployeeAdvance
```

#### POST /api/modules/hr/advances/[id]/approve
Approbation
```typescript
Body: { approverId: string }
Response: EmployeeAdvance
```

#### POST /api/modules/hr/advances/[id]/reject
Rejet
```typescript
Body: {
  approverId: string;
  reason: string;
}
Response: EmployeeAdvance
```

#### POST /api/modules/hr/advances/[id]/pay
Paiement
```typescript
Body: PayAdvanceInput
Response: EmployeeAdvance
```

#### GET /api/modules/hr/advances/employee/[employeeId]/pending
Avances en attente de déduction
```typescript
Response: EmployeeAdvance[]
```

#### GET /api/modules/hr/advances/stats
Statistiques avances
```typescript
Response: AdvanceStatistics
```

### 6.7 Employee Leaves

#### GET /api/modules/hr/leaves
Liste des congés
```typescript
Query params:
- employeeId?: string
- leaveType?: string
- status?: string
- startDate?: string
- endDate?: string

Response: EmployeeLeave[]
```

#### GET /api/modules/hr/leaves/[id]
Détails d'un congé
```typescript
Response: EmployeeLeave
```

#### POST /api/modules/hr/leaves
Création
```typescript
Body: CreateLeaveInput
Response: EmployeeLeave
```

#### POST /api/modules/hr/leaves/[id]/approve
Approbation
```typescript
Body: { approverId: string }
Response: EmployeeLeave
```

#### POST /api/modules/hr/leaves/[id]/reject
Rejet
```typescript
Body: {
  approverId: string;
  reason: string;
}
Response: EmployeeLeave
```

#### POST /api/modules/hr/leaves/[id]/cancel
Annulation
```typescript
Response: EmployeeLeave
```

#### GET /api/modules/hr/leaves/employee/[employeeId]/balance
Solde de congés
```typescript
Query params:
- year: number

Response: {
  totalEntitled: number;
  totalTaken: number;
  totalPending: number;
  remaining: number;
}
```

#### GET /api/modules/hr/leaves/stats
Statistiques congés
```typescript
Response: LeaveStatistics
```

---

## 7. Permissions RBAC

### 7.1 Définition des permissions

**Fichier** : `lib/rbac/permissions.ts`

```typescript
// Module RH
hr: {
  // Employés
  'employee:view': 'Voir les employés',
  'employee:create': 'Créer un employé',
  'employee:edit': 'Modifier un employé',
  'employee:delete': 'Supprimer un employé',
  'employee:activate': 'Activer/désactiver un employé',
  'employee:manage_salary': 'Gérer les salaires',

  // Présence
  'attendance:view': 'Voir les présences',
  'attendance:checkin': 'Pointer (check-in/out)',
  'attendance:validate': 'Valider les présences',

  // Commissions
  'commission:view': 'Voir les commissions',
  'commission:create': 'Créer une commission manuelle',

  // Paie
  'payroll:view': 'Voir les paies',
  'payroll:create': 'Créer une paie',
  'payroll:validate': 'Valider une paie',
  'payroll:pay': 'Payer une paie',

  // Objectifs
  'target:view': 'Voir les objectifs',
  'target:create': 'Créer des objectifs',
  'target:edit': 'Modifier des objectifs',

  // Avances
  'advance:view': 'Voir les avances',
  'advance:request': 'Demander une avance',
  'advance:approve': 'Approuver les avances',
  'advance:pay': 'Payer les avances',

  // Congés
  'leave:view': 'Voir les congés',
  'leave:request': 'Demander un congé',
  'leave:approve': 'Approuver les congés',
}
```

### 7.2 Matrice de permissions par rôle

| Permission | Admin | Manager | Sales Agent | Accountant | Other |
|-----------|-------|---------|-------------|------------|-------|
| employee:view | ✅ | ✅ (équipe) | ❌ | ✅ | ❌ |
| employee:create | ✅ | ✅ | ❌ | ❌ | ❌ |
| employee:edit | ✅ | ✅ (équipe) | ❌ | ❌ | ❌ |
| employee:delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| employee:activate | ✅ | ❌ | ❌ | ❌ | ❌ |
| employee:manage_salary | ✅ | ❌ | ❌ | ✅ | ❌ |
| attendance:view | ✅ | ✅ (équipe) | ✅ (self) | ✅ | ✅ (self) |
| attendance:checkin | ✅ | ✅ | ✅ | ✅ | ✅ |
| attendance:validate | ✅ | ✅ (équipe) | ❌ | ❌ | ❌ |
| commission:view | ✅ | ✅ (équipe) | ✅ (self) | ✅ | ❌ |
| commission:create | ✅ | ✅ | ❌ | ❌ | ❌ |
| payroll:view | ✅ | ✅ (équipe) | ✅ (self) | ✅ | ✅ (self) |
| payroll:create | ✅ | ❌ | ❌ | ✅ | ❌ |
| payroll:validate | ✅ | ❌ | ❌ | ✅ | ❌ |
| payroll:pay | ✅ | ❌ | ❌ | ✅ | ❌ |
| target:view | ✅ | ✅ (équipe) | ✅ (self) | ❌ | ❌ |
| target:create | ✅ | ✅ (équipe) | ❌ | ❌ | ❌ |
| target:edit | ✅ | ✅ (équipe) | ❌ | ❌ | ❌ |
| advance:view | ✅ | ✅ (équipe) | ✅ (self) | ✅ | ✅ (self) |
| advance:request | ✅ | ✅ | ✅ | ✅ | ✅ |
| advance:approve | ✅ | ✅ (équipe) | ❌ | ✅ | ❌ |
| advance:pay | ✅ | ❌ | ❌ | ✅ | ❌ |
| leave:view | ✅ | ✅ (équipe) | ✅ (self) | ❌ | ✅ (self) |
| leave:request | ✅ | ✅ | ✅ | ✅ | ✅ |
| leave:approve | ✅ | ✅ (équipe) | ❌ | ❌ | ❌ |

---

## 8. Interface utilisateur

### 8.1 Pages principales

#### 8.1.1 Liste des employés
**Route** : `/hr/employees`

**Fonctionnalités** :
- Table avec colonnes: Code, Nom complet, Rôle, Département, Statut, Salaire
- Filtres: Statut, Rôle, Département
- Recherche par nom
- Actions: Voir détails, Modifier, Activer/Désactiver
- Bouton "Ajouter un employé"
- Indicateurs: Total employés actifs, Masse salariale totale

#### 8.1.2 Détails employé
**Route** : `/hr/employees/[id]`

**Sections** :
- **Informations personnelles** : Photo, Nom, Contact, Adresse
- **Emploi** : Rôle, Département, Poste, Manager
- **Contrat** : Type, Dates, Salaire
- **Commissions** : Configuration, Historique
- **Objectifs** : Objectif actuel, Progression, Historique
- **Présences** : Statistiques, Liste des 30 derniers jours
- **Avances** : Liste des avances
- **Congés** : Solde, Liste des congés
- **Paies** : Historique des bulletins

**Actions** :
- Modifier informations
- Définir objectif
- Accorder avance
- Voir détails paie

#### 8.1.3 Gestion de la présence
**Route** : `/hr/attendance`

**Fonctionnalités** :
- **Vue calendrier** : Présences du mois
- **Vue liste** : Table avec colonnes: Employé, Date, Arrivée, Départ, Heures, Statut
- Filtres: Employé, Statut, Période
- Actions: Valider, Rejeter
- **Carte du jour** : Employés présents vs absents
- **Rapport mensuel** : Taux de présence par employé

#### 8.1.4 Commissions
**Route** : `/hr/commissions`

**Fonctionnalités** :
- Table: Employé, Type, Période, Montant, Statut
- Filtres: Employé, Type, Statut, Période
- Total commissions par période
- Graphique: Évolution des commissions
- Action: Créer commission manuelle

#### 8.1.5 Paies
**Route** : `/hr/payroll`

**Fonctionnalités** :
- Table: Numéro, Période, Total employés, Total net, Statut
- Bouton "Créer nouvelle paie"
- Actions: Voir détails, Valider, Payer, Annuler

#### 8.1.6 Détails paie
**Route** : `/hr/payroll/[id]`

**Sections** :
- **En-tête** : Période, Statut, Totaux
- **Tableau lignes** : Employé, Salaire base, Jours, Commissions, Primes, Avances, Net
- **Boutons d'action** : Recalculer, Valider, Payer
- **Historique** : Modifications, Validations

**Fonctionnalités** :
- Modification manuelle des lignes
- Téléchargement bulletins de paie (PDF)
- Envoi par email aux employés

#### 8.1.7 Objectifs
**Route** : `/hr/targets`

**Fonctionnalités** :
- Table: Employé, Période, Objectif, Réalisé, Taux, Prime, Atteint
- Filtres: Employé, Période, Atteint
- Graphiques: Taux de réalisation par employé
- Action: Définir nouveaux objectifs

#### 8.1.8 Avances
**Route** : `/hr/advances`

**Fonctionnalités** :
- Table: Numéro, Employé, Montant, Date, Statut
- Filtres: Employé, Statut
- Actions: Approuver, Rejeter, Payer
- Bouton "Demander une avance"
- Total avances en attente de déduction

#### 8.1.9 Congés
**Route** : `/hr/leaves`

**Fonctionnalités** :
- Calendrier des congés
- Table: Employé, Type, Période, Jours, Statut
- Filtres: Employé, Type, Statut
- Actions: Approuver, Rejeter, Annuler
- Bouton "Demander un congé"
- Vue du solde de congés par employé

### 8.2 Composants réutilisables

```typescript
// components/hr/EmployeeCard.tsx
// Carte résumé employé avec photo, nom, rôle

// components/hr/AttendanceCalendar.tsx
// Calendrier de présence

// components/hr/CommissionBadge.tsx
// Badge statut commission

// components/hr/PayrollLineForm.tsx
// Formulaire modification ligne paie

// components/hr/TargetProgress.tsx
// Barre de progression objectif

// components/hr/LeaveTimeline.tsx
// Timeline des congés
```

---

## 9. Estimation de développement

### 9.1 Complexité par composant

| Composant | Complexité | Lignes estimées | Temps estimé |
|-----------|------------|-----------------|--------------|
| **Types TypeScript** | Faible | 280 | ✅ Fait |
| **EmployeeService** | Moyenne | 350 | 2 jours |
| **AttendanceService** | Haute | 450 | 3 jours |
| **CommissionService** | Haute | 400 | 3 jours |
| **PayrollService** | Très haute | 600 | 4 jours |
| **EmployeeTargetService** | Moyenne | 300 | 2 jours |
| **EmployeeAdvanceService** | Moyenne | 300 | 2 jours |
| **EmployeeLeaveService** | Faible | 250 | 1.5 jours |
| **Routes API (x50)** | Moyenne | 1000 | 3 jours |
| **Permissions RBAC** | Faible | 100 | 0.5 jour |
| **UI - Pages (x9)** | Haute | 2000 | 5 jours |
| **UI - Composants** | Moyenne | 800 | 2 jours |
| **Intégrations** | Moyenne | 400 | 2 jours |
| **Tests** | Moyenne | 1000 | 3 jours |
| **Documentation** | Faible | - | ✅ Fait |

**Total lignes** : ~8230 lignes
**Total temps** : **33.5 jours** (développement complet)

### 9.2 Phases de développement recommandées

#### Phase 1 - Base RH (8 jours)
- EmployeeService
- Routes API employés
- UI liste et détails employés
- Tests

#### Phase 2 - Présence (5 jours)
- AttendanceService
- Routes API présence
- UI check-in/out, validation
- Intégration géolocalisation et photos
- Tests

#### Phase 3 - Commissions (5 jours)
- CommissionService
- EmployeeTargetService
- Routes API
- UI commissions et objectifs
- Intégration avec ventes
- Tests

#### Phase 4 - Paie (7 jours)
- PayrollService
- Routes API paie
- UI création et gestion paie
- Génération bulletins PDF
- Tests

#### Phase 5 - Avances et congés (4 jours)
- EmployeeAdvanceService
- EmployeeLeaveService
- Routes API
- UI avances et congés
- Tests

#### Phase 6 - Intégrations et finalisation (4.5 jours)
- Intégration Trésorerie
- Tâche cron fin de mois
- Tests d'intégration
- Documentation API

---

## 10. Cas d'usage détaillés

### 10.1 Cas d'usage : Pointage employé avec géolocalisation

**Acteur** : Employé

**Scénario** :
1. Employé arrive au lieu de travail
2. Ouvre l'application mobile
3. Clique sur "Pointer arrivée"
4. Application capture:
   - Heure actuelle
   - Géolocalisation (latitude, longitude)
   - Photo selfie
5. Envoi au serveur
6. Validation automatique:
   - Distance par rapport au lieu < 100m → ✅
   - Photo détecte un visage → ✅
   - Horaire dans plage normale → ✅
   - **Résultat** : Status `auto_validated`
7. Notification: "Présence enregistrée"

**Cas particulier** :
- Si distance > 100m → Status `pending`, notification manager
- Si photo floue → Status `pending`, notification manager

### 10.2 Cas d'usage : Calcul automatique de la paie

**Acteur** : Système (cron)

**Scénario** :
1. **30 novembre 23h00** : Déclenchement automatique
2. Pour chaque employé actif:
   ```
   Période: 2024-11
   Jours attendus: 30
   Jours travaillés: 28 (depuis Attendance)
   Salaire base: 500,000 FCFA
   Salaire proportionnel: 500,000 * (28/30) = 466,667 FCFA
   Commissions: 50,000 FCFA (depuis Commission)
   Prime objectif: 25,000 FCFA (objectif atteint)
   Avances: -30,000 FCFA (avance ADV-202411-0005)
   Total brut: 541,667 FCFA
   Total net: 511,667 FCFA
   ```
3. Création PayrollLine pour chaque employé
4. Création Payroll avec status `calculated`
5. Notification RH/Finance: "Paie novembre prête pour validation"

### 10.3 Cas d'usage : Demande et traitement d'avance

**Acteur** : Employé, Manager, Comptable

**Scénario** :

1. **Employé** : Demande avance
   ```
   Montant: 50,000 FCFA
   Raison: "Frais médicaux urgents"
   ```
   → Status: `pending`

2. **Manager** : Reçoit notification
   - Consulte historique avances employé
   - Vérifie salaire disponible
   - **Approuve** → Status: `approved`

3. **Comptable** : Reçoit notification
   - Sélectionne mode de paiement: Mobile Money
   - Sélectionne portefeuille
   - **Paie** → Status: `paid`
   - Transaction créée dans Trésorerie

4. **Fin du mois** : Calcul paie
   - Avance automatiquement déduite
   - Status avance: `deducted`

### 10.4 Cas d'usage : Atteinte d'objectif et prime

**Acteur** : Commercial, Système

**Scénario** :

1. **Début du mois** : Manager définit objectif
   ```
   Employé: Jean Dupont
   Période: 2024-11
   Objectif ventes: 5,000,000 FCFA
   Prime: 100,000 FCFA
   ```

2. **Durant le mois** : À chaque vente
   ```
   Vente 1: 500,000 FCFA
   → Objectif mis à jour: 500,000 / 5,000,000 = 10%

   Vente 2: 800,000 FCFA
   → Objectif: 1,300,000 / 5,000,000 = 26%

   ...

   Vente 15: 600,000 FCFA
   → Objectif: 5,100,000 / 5,000,000 = 102% ✅
   ```

3. **Atteinte 100%** :
   - Système crée automatiquement Commission
     ```
     Type: target_bonus
     Montant: 100,000 FCFA
     Status: pending
     ```
   - Notification employé: "Félicitations ! Objectif atteint"

4. **Fin du mois** : Paie
   - Prime intégrée automatiquement
   - Commission status → `calculated` puis `paid`

---

## 11. Points d'attention et bonnes pratiques

### 11.1 Sécurité

1. **Données personnelles** :
   - Chiffrement des numéros d'identité
   - Accès restreint aux salaires (RBAC)
   - Logs d'accès aux données sensibles

2. **Géolocalisation** :
   - Consentement explicite de l'employé
   - Stockage uniquement pour présence
   - Pas de tracking en continu

3. **Photos** :
   - Stockage sécurisé (URLs signées)
   - Compression automatique
   - Suppression après 90 jours

### 11.2 Performance

1. **Calcul de paie** :
   - Exécution asynchrone (job queue)
   - Timeout généreux (10 minutes)
   - Reprise en cas d'erreur

2. **Présence** :
   - Index sur (EmployeeId, AttendanceDate)
   - Cache des calculs de jours travaillés
   - Pagination des listes

3. **Commissions** :
   - Calcul en arrière-plan
   - Éviter recalculs inutiles
   - Index sur (EmployeeId, Period, Status)

### 11.3 Conformité légale

1. **Code du travail** :
   - Respect des heures légales
   - Calcul des heures supplémentaires
   - Jours de congés légaux

2. **Protection des données** :
   - Consentement RGPD
   - Droit à l'oubli
   - Portabilité des données

3. **Comptabilité** :
   - Bulletins de paie conformes
   - Archivage 10 ans
   - Export comptable

### 11.4 UX/UI

1. **Mobile-first pour présence** :
   - Interface tactile optimisée
   - Capture photo facile
   - Fonctionnement offline

2. **Tableaux de bord** :
   - Indicateurs clés visibles
   - Graphiques de tendance
   - Alertes visuelles

3. **Notifications** :
   - Rappels de pointage
   - Alertes validation en attente
   - Confirmation de paie

---

## 12. Conclusion

Le module **RH & Rémunérations** est un module complet et critique pour la gestion du personnel. Il couvre:

✅ **8 interfaces TypeScript** définies
✅ **7 services backend** spécifiés
✅ **50 routes API** documentées
✅ **9 pages UI** conçues
✅ **3 intégrations** avec autres modules
✅ **Workflows automatisés** (paie, commissions, objectifs)
✅ **Sécurité et conformité** pris en compte

**Prochaines étapes** :
1. Validation de l'architecture avec les parties prenantes
2. Développement par phases (33.5 jours estimés)
3. Tests unitaires et d'intégration
4. Déploiement progressif
5. Formation des utilisateurs

**Priorité de développement** : Haute
**Complexité** : Très élevée
**Impact business** : Critique - gestion du personnel et coûts associés

---

**Document créé le** : 14 novembre 2025
**Version** : 1.0
**Auteur** : Équipe DDM
