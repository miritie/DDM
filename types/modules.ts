/**
 * Types pour les modules DDM
 */

// ============================================================================
// Module Transversal - Workspaces & Users
// ============================================================================

export interface Workspace {
  WorkspaceId: string;
  Name: string;
  Slug: string;
  Description?: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface User {
  UserId: string;
  Email: string;
  PasswordHash?: string;
  FullName: string;
  DisplayName: string;
  AvatarUrl?: string;
  Phone?: string;
  WorkspaceId: string;
  RoleId: string;
  IsActive: boolean;
  LastLoginAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Role {
  RoleId: string;
  Name: string;
  Description?: string;
  PermissionIds: string[];
  WorkspaceId: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Permission {
  PermissionId: string;
  Name: string;
  Code: string;
  Description?: string;
  Module: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

// ============================================================================
// Module 7.1 - Ventes & Encaissements
// ============================================================================

export interface Product {
  ProductId: string;
  Name: string;
  Code: string;
  Description?: string;
  UnitPrice: number;
  Currency: string;
  Category?: string;
  Unit?: string; // kg, piece, liter, etc.
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface Client {
  ClientId: string;
  Name: string;
  Code: string;
  Email?: string;
  Phone?: string;
  Address?: string;
  CompanyName?: string;
  TaxId?: string;
  CreditLimit?: number;
  CurrentBalance: number;
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type SaleStatus = 'draft' | 'confirmed' | 'partially_paid' | 'fully_paid' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'fully_paid' | 'overdue';

export interface Sale {
  SaleId: string;
  SaleNumber: string;
  ClientId?: string;
  ClientName?: string;
  TotalAmount: number;
  AmountPaid: number;
  Balance: number;
  Currency: string;
  Status: SaleStatus;
  PaymentStatus: PaymentStatus;
  SaleDate: string;
  DueDate?: string;
  Notes?: string;
  SalesPersonId: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface SaleItem {
  SaleItemId: string;
  SaleId: string;
  ProductId?: string;
  ProductName: string;
  Description?: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  Currency: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type PaymentMethodType =
  | 'cash'
  | 'bank_transfer'
  | 'mobile_money'
  | 'check'
  | 'card'
  | 'other';

export interface SalePayment {
  PaymentId: string;
  SaleId: string;
  PaymentNumber: string;
  Amount: number;
  PaymentMethod: PaymentMethodType;
  PaymentDate: string;
  WalletId?: string;
  Reference?: string;
  Notes?: string;
  ReceivedById: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface SalesStatistics {
  totalSales: number;
  totalRevenue: number;
  totalPaid: number;
  totalUnpaid: number;
  averageSaleAmount: number;
  salesCount: number;
  paidSalesCount: number;
  unpaidSalesCount: number;
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  topClients: Array<{
    clientName: string;
    salesCount: number;
    totalRevenue: number;
  }>;
}

// ============================================================================
// Module 7.2 - Stocks & Mouvements
// ============================================================================

export interface Warehouse {
  WarehouseId: string;
  Name: string;
  Code: string;
  Location?: string;
  Address?: string;
  ManagerId?: string;
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface StockItem {
  StockItemId: string;
  ProductId: string;
  WarehouseId: string;
  Quantity: number;
  MinimumStock: number;
  MaximumStock?: number;
  UnitCost: number;
  TotalValue: number;
  LastRestockDate?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type StockMovementType =
  | 'entry'           // Entrée en stock (achat, production)
  | 'exit'            // Sortie de stock (vente, utilisation)
  | 'transfer'        // Transfert entre entrepôts
  | 'adjustment'      // Ajustement (inventaire, correction)
  | 'return';         // Retour (client, fournisseur)

export type StockMovementStatus = 'pending' | 'validated' | 'cancelled';

export interface StockMovement {
  MovementId: string;
  MovementNumber: string;
  Type: StockMovementType;
  ProductId: string;
  SourceWarehouseId?: string;
  DestinationWarehouseId?: string;
  Quantity: number;
  UnitCost?: number;
  TotalCost?: number;
  Reason?: string;
  Status: StockMovementStatus;
  Reference?: string;
  AttachmentUrl?: string;
  ProcessedById: string;
  ProcessedAt: string;
  ValidatedById?: string;
  ValidatedAt?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface StockAlert {
  AlertId: string;
  StockItemId: string;
  ProductId: string;
  WarehouseId: string;
  AlertType: 'low_stock' | 'out_of_stock' | 'overstock';
  CurrentQuantity: number;
  ThresholdQuantity: number;
  IsResolved: boolean;
  ResolvedAt?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface StockStatistics {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  warehousesCount: number;
  movementsCount: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalValue: number;
    warehouses: number;
  }>;
  warehouseStats: Array<{
    warehouseId: string;
    warehouseName: string;
    itemsCount: number;
    totalValue: number;
  }>;
  movementsByType: Array<{
    type: StockMovementType;
    count: number;
    totalQuantity: number;
  }>;
}

export interface StockInventoryReport {
  reportId: string;
  reportDate: string;
  warehouseId?: string;
  items: Array<{
    productId: string;
    productName: string;
    systemQuantity: number;
    physicalQuantity: number;
    difference: number;
    unitCost: number;
    valueDifference: number;
  }>;
  totalDifference: number;
  totalValueDifference: number;
  generatedById: string;
  WorkspaceId: string;
  CreatedAt: string;
}

// ============================================================================
// Module 7.4 - Dépenses & Sollicitations
// ============================================================================

export interface ExpenseCategory {
  ExpenseCategoryId: string;
  Label: string;
  Code: string;
  Description?: string;
  RequiresPreApproval: boolean;
  Icon?: string;
  Color?: string;
  WorkspaceId: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected';

export interface ExpenseApprovalStep {
  ApprovalStepId: string;
  ExpenseRequestId: string;
  ApproverId: string;
  StepOrder: number;
  Status: ApprovalStepStatus;
  Comments?: string;
  ProcessedAt?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type ExpenseStatus =
  | 'pending'
  | 'approved'
  | 'paid'
  | 'rejected'
  | 'cancelled';

export interface Expense {
  ExpenseId: string;
  ExpenseNumber: string;
  ExpenseRequestId: string;
  Title: string;
  Description?: string;
  Amount: number;
  CategoryId: string;
  PayerId: string;
  BeneficiaryId?: string;
  Status: ExpenseStatus;
  PaymentDate?: string;
  PaymentMethod?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ExpenseAttachment {
  AttachmentId: string;
  ExpenseId: string;
  FileName: string;
  FileUrl: string;
  FileSize: number;
  MimeType: string;
  UploadedById: string;
  UploadedAt: string;
}

// ============================================================================
// Module 7.5 - Avances & Dettes
// ============================================================================

export interface Account {
  AccountId: string;
  AccountType: 'agent' | 'supplier' | 'client' | 'other';
  Name: string;
  Code: string;
  Email?: string;
  Phone?: string;
  Address?: string;
  WorkspaceId: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export type AdvanceDebtType = 'advance' | 'debt';
export type AdvanceDebtStatus = 'active' | 'partially_paid' | 'fully_paid' | 'cancelled';

export interface AdvanceDebt {
  AdvanceDebtId: string;
  RecordNumber: string;
  Type: AdvanceDebtType;
  AccountId: string;
  Amount: number;
  Balance: number;
  Reason: string;
  DueDate?: string;
  Status: AdvanceDebtStatus;
  GrantedById?: string;
  GrantedAt?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AdvanceDebtSchedule {
  ScheduleId: string;
  AdvanceDebtId: string;
  DueDate: string;
  Amount: number;
  IsPaid: boolean;
  PaidAt?: string;
  PaidAmount?: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export type MovementType = 'payment' | 'justification' | 'adjustment';

export interface AdvanceDebtMovement {
  MovementId: string;
  AdvanceDebtId: string;
  MovementType: MovementType;
  Amount: number;
  Description?: string;
  AttachmentUrl?: string;
  ProcessedById: string;
  ProcessedAt: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

// ============================================================================
// Module 7.3 - Trésorerie Multi-wallet
// ============================================================================

export type WalletType = 'cash' | 'bank' | 'mobile_money' | 'other';
export type WalletStatus = 'active' | 'inactive' | 'closed';

export interface Wallet {
  WalletId: string;
  Name: string;
  Code: string;
  Type: WalletType;
  Currency: string;
  Balance: number;
  InitialBalance: number;
  BankName?: string;
  AccountNumber?: string;
  Description?: string;
  Status: WalletStatus;
  WorkspaceId: string;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';
export type TransactionCategory =
  | 'sale'
  | 'purchase'
  | 'salary'
  | 'advance'
  | 'debt_payment'
  | 'expense'
  | 'transfer'
  | 'adjustment'
  | 'other';

export interface Transaction {
  TransactionId: string;
  TransactionNumber: string;
  Type: TransactionType;
  Category: TransactionCategory;
  Amount: number;
  SourceWalletId?: string;
  DestinationWalletId?: string;
  Description: string;
  Reference?: string;
  AttachmentUrl?: string;
  Status: TransactionStatus;
  ProcessedById: string;
  ProcessedAt: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface WalletBalance {
  WalletId: string;
  WalletName: string;
  Balance: number;
  Currency: string;
}

export interface TreasuryStatistics {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalTransfers: number;
  walletsCount: number;
  transactionsCount: number;
  walletBalances: WalletBalance[];
}

// ============================================================================
// Module 7.6 - Ressources Humaines
// ============================================================================

export type OldAttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'remote';

export type LeaveType =
  | 'annual'        // Congé annuel
  | 'sick'          // Congé maladie
  | 'maternity'     // Congé maternité
  | 'paternity'     // Congé paternité
  | 'unpaid'        // Congé sans solde
  | 'other';        // Autre

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Leave {
  LeaveId: string;
  LeaveNumber: string;
  EmployeeId: string;
  Type: LeaveType;
  StartDate: string;
  EndDate: string;
  DaysCount: number;
  Reason?: string;
  Status: LeaveStatus;
  RequestedAt: string;
  ReviewedById?: string;
  ReviewedAt?: string;
  ReviewNotes?: string;
  AttachmentUrl?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface LeaveBalance {
  EmployeeId: string;
  LeaveType: LeaveType;
  TotalDays: number;
  UsedDays: number;
  RemainingDays: number;
  Year: number;
}

export interface HRStatistics {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  totalPayroll: number;
  averageSalary: number;
  departmentDistribution: Array<{
    department: string;
    count: number;
  }>;
  contractTypeDistribution: Array<{
    type: string;
    count: number;
  }>;
  attendanceRate: number;
  pendingLeaves: number;
  upcomingLeaves: Array<{
    employeeId: string;
    employeeName: string;
    startDate: string;
    endDate: string;
    type: LeaveType;
  }>;
}

// ============================================================================
// Notifications & Audit
// ============================================================================

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Notification {
  NotificationId: string;
  RecipientId: string;
  Channel: NotificationChannel;
  Subject?: string;
  Message: string;
  Status: NotificationStatus;
  SentAt?: string;
  ErrorMessage?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AuditLog {
  AuditLogId: string;
  UserId: string;
  Action: string;
  EntityType: string;
  EntityId: string;
  Changes?: Record<string, any>;
  IpAddress?: string;
  UserAgent?: string;
  WorkspaceId: string;
  CreatedAt: string;
}

// ============================================================================
// Module 7.8 - Comptabilité
// ============================================================================

export type AccountType =
  | 'asset'       // Actif
  | 'liability'   // Passif
  | 'equity'      // Capitaux propres
  | 'revenue'     // Produits
  | 'expense';    // Charges

export type AccountClass =
  | 'class_1'  // Comptes de capitaux
  | 'class_2'  // Comptes d'immobilisations
  | 'class_3'  // Comptes de stocks
  | 'class_4'  // Comptes de tiers
  | 'class_5'  // Comptes financiers
  | 'class_6'  // Comptes de charges
  | 'class_7'  // Comptes de produits
  | 'class_8'  // Comptes spéciaux
  | 'class_9'; // Comptes analytiques

export interface ChartAccount {
  AccountId: string;
  AccountNumber: string;  // Ex: 411000, 607000
  Label: string;
  AccountType: AccountType;
  AccountClass: AccountClass;
  ParentAccountId?: string;
  Description?: string;
  IsActive: boolean;
  AllowDirectPosting: boolean;  // Autorise saisie directe
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type JournalType =
  | 'sales'       // Journal des ventes
  | 'purchases'   // Journal des achats
  | 'bank'        // Journal de banque
  | 'cash'        // Journal de caisse
  | 'operations'  // Journal des opérations diverses
  | 'payroll';    // Journal de paie

export interface Journal {
  JournalId: string;
  Code: string;  // VT, AC, BQ, CA, OD, PAI
  Label: string;
  JournalType: JournalType;
  Description?: string;
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type EntryStatus = 'draft' | 'posted' | 'validated' | 'cancelled';

export interface JournalEntry {
  EntryId: string;
  EntryNumber: string;  // Ex: VT-2025-0001
  JournalId: string;
  EntryDate: string;
  Description: string;
  Reference?: string;  // Référence document source
  Status: EntryStatus;
  PostedAt?: string;
  PostedById?: string;
  ValidatedAt?: string;
  ValidatedById?: string;
  FiscalYear: number;
  FiscalPeriod: number;  // 1-12
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface JournalEntryLine {
  LineId: string;
  EntryId: string;
  LineNumber: number;
  AccountId: string;
  Label: string;
  DebitAmount: number;
  CreditAmount: number;
  AnalyticalCode?: string;
  CostCenter?: string;
  Reference?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface FiscalYear {
  FiscalYearId: string;
  Year: number;
  StartDate: string;
  EndDate: string;
  IsClosed: boolean;
  ClosedAt?: string;
  ClosedById?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AccountBalance {
  AccountId: string;
  AccountNumber: string;
  AccountLabel: string;
  FiscalYear: number;
  FiscalPeriod: number;
  OpeningDebit: number;
  OpeningCredit: number;
  PeriodDebit: number;
  PeriodCredit: number;
  ClosingDebit: number;
  ClosingCredit: number;
  Balance: number;  // Solde (débiteur > 0, créditeur < 0)
}

export interface TrialBalance {
  AccountNumber: string;
  AccountLabel: string;
  OpeningDebit: number;
  OpeningCredit: number;
  PeriodDebit: number;
  PeriodCredit: number;
  ClosingDebit: number;
  ClosingCredit: number;
}

export interface GeneralLedger {
  AccountNumber: string;
  AccountLabel: string;
  Entries: Array<{
    date: string;
    entryNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  TotalDebit: number;
  TotalCredit: number;
  Balance: number;
}

export interface BalanceSheet {
  fiscalYear: number;
  period: number;
  assets: {
    fixedAssets: number;      // Immobilisations
    currentAssets: number;    // Actif circulant
    inventory: number;        // Stocks
    receivables: number;      // Créances
    cash: number;            // Trésorerie
    total: number;
  };
  liabilities: {
    equity: number;          // Capitaux propres
    longTermDebt: number;    // Dettes à long terme
    currentDebt: number;     // Dettes à court terme
    payables: number;        // Dettes fournisseurs
    total: number;
  };
}

export interface IncomeStatement {
  fiscalYear: number;
  period: number;
  revenue: {
    salesRevenue: number;     // Ventes
    otherRevenue: number;     // Autres produits
    total: number;
  };
  expenses: {
    costOfSales: number;      // Coût des ventes
    operatingExpenses: number; // Charges d'exploitation
    salaries: number;         // Salaires
    depreciation: number;     // Amortissements
    financialExpenses: number; // Charges financières
    otherExpenses: number;    // Autres charges
    total: number;
  };
  grossProfit: number;        // Marge brute
  operatingProfit: number;    // Résultat d'exploitation
  netProfit: number;          // Résultat net
}

// ============================================================================
// Module 7.7 - Rapports & Analytics
// ============================================================================

export type ReportType =
  | 'sales'           // Rapport des ventes
  | 'expenses'        // Rapport des dépenses
  | 'inventory'       // Rapport d'inventaire
  | 'cashflow'        // Rapport de trésorerie
  | 'hr'              // Rapport RH
  | 'accounting'      // Rapport comptable
  | 'custom';         // Rapport personnalisé

export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface Report {
  ReportId: string;
  ReportName: string;
  Description?: string;
  ReportType: ReportType;
  Parameters: Record<string, any>;
  Schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
  };
  Recipients?: string[];
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ReportExecution {
  ExecutionId: string;
  ReportId: string;
  Status: 'pending' | 'running' | 'completed' | 'failed';
  StartedAt: string;
  CompletedAt?: string;
  TriggeredById: string;
  ResultData?: any;
  ErrorMessage?: string;
  CreatedAt: string;
}

export interface DashboardKPI {
  kpiId: string;
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  format: 'currency' | 'number' | 'percentage';
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }>;
}

export interface SalesReport {
  period: { start: string; end: string };
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  topClients: Array<{
    clientId: string;
    clientName: string;
    totalSpent: number;
    orderCount: number;
  }>;
  salesByDay: ChartData;
  salesByCategory: ChartData;
}

export interface ExpenseReport {
  period: { start: string; end: string };
  totalExpenses: number;
  paidExpenses: number;
  pendingExpenses: number;
  expensesByCategory: ChartData;
  expensesByMonth: ChartData;
  topExpenses: Array<{
    expenseId: string;
    title: string;
    amount: number;
    date: string;
  }>;
}

export interface CashflowReport {
  period: { start: string; end: string };
  openingBalance: number;
  closingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  netCashflow: number;
  inflowsByCategory: ChartData;
  outflowsByCategory: ChartData;
  cashflowByMonth: ChartData;
}

export interface InventoryReport {
  period: { start: string; end: string };
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  valueByWarehouse: ChartData;
  topMovingItems: Array<{
    itemId: string;
    itemName: string;
    quantityMoved: number;
    currentStock: number;
  }>;
}

export interface HRReport {
  period: { start: string; end: string };
  totalEmployees: number;
  activeEmployees: number;
  totalPayroll: number;
  averageSalary: number;
  attendanceRate: number;
  leavesTaken: number;
  employeesByDepartment: ChartData;
  payrollByMonth: ChartData;
}

export interface GlobalDashboard {
  period: { start: string; end: string };
  kpis: {
    revenue: DashboardKPI;
    expenses: DashboardKPI;
    profit: DashboardKPI;
    cashBalance: DashboardKPI;
    sales: DashboardKPI;
    customers: DashboardKPI;
    inventory: DashboardKPI;
    employees: DashboardKPI;
  };
  charts: {
    revenueVsExpenses: ChartData;
    salesTrend: ChartData;
    cashflowTrend: ChartData;
    topProducts: ChartData;
    expensesByCategory: ChartData;
  };
}

// ============================================================================
// Module 7.4 - Production & Usine
// ============================================================================

/**
 * Ingrédient / Matière Première
 * Éléments de base utilisés dans les recettes de production
 */
export interface Ingredient {
  IngredientId: string;
  Name: string;
  Code: string;
  Description?: string;
  Unit: string; // kg, L, piece, etc.
  UnitCost: number; // Coût unitaire
  Currency: string;
  MinimumStock: number; // Stock minimum à maintenir
  CurrentStock: number; // Stock actuel
  Supplier?: string; // Fournisseur principal
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Ligne de recette (BOM - Bill of Materials)
 * Définit la quantité d'ingrédient nécessaire pour une recette
 */
export interface RecipeLine {
  RecipeLineId: string;
  RecipeId: string;
  IngredientId: string;
  IngredientName?: string;
  Quantity: number; // Quantité nécessaire
  Unit: string; // Unité de mesure
  Loss?: number; // Perte estimée en %
  Notes?: string;
}

/**
 * Recette de Production (BOM)
 * Définit comment fabriquer un produit fini à partir d'ingrédients
 */
export interface Recipe {
  RecipeId: string;
  RecipeNumber: string; // REC-202511-0001
  Name: string;
  ProductId: string; // Produit fini résultant
  ProductName?: string;
  Version: number; // Versioning des recettes
  OutputQuantity: number; // Quantité produite par batch
  OutputUnit: string; // Unité de production (kg, L, pieces)
  EstimatedDuration: number; // Durée estimée en minutes
  Lines: RecipeLine[]; // Ingrédients nécessaires
  Instructions?: string; // Instructions de fabrication
  YieldRate: number; // Rendement attendu en % (ex: 95%)
  IsActive: boolean;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Statuts d'un ordre de production
 */
export type ProductionOrderStatus =
  | 'draft'        // Brouillon
  | 'planned'      // Planifié
  | 'in_progress'  // En cours
  | 'completed'    // Terminé
  | 'cancelled';   // Annulé

/**
 * Ligne de consommation d'ingrédient
 * Enregistre les ingrédients réellement consommés lors de la production
 */
export interface IngredientConsumption {
  ConsumptionId: string;
  ProductionOrderId: string;
  IngredientId: string;
  IngredientName?: string;
  PlannedQuantity: number; // Quantité prévue (selon recette)
  ActualQuantity: number; // Quantité réellement consommée
  Unit: string;
  UnitCost: number;
  TotalCost: number;
  Variance: number; // Écart entre prévu et réel (%)
  ConsumedAt: string;
}

/**
 * Lot de Production
 * Représente un batch produit avec traçabilité complète
 */
export interface ProductionBatch {
  BatchId: string;
  BatchNumber: string; // LOT-202511-0001
  ProductionOrderId: string;
  ProductId: string;
  ProductName?: string;
  QuantityProduced: number; // Quantité produite
  QuantityDefective: number; // Quantité défectueuse
  QuantityGood: number; // Quantité bonne (= produite - défectueuse)
  Unit: string;
  QualityScore?: number; // Score qualité (0-100)
  ExpiryDate?: string; // Date de péremption si applicable
  ProductionDate: string;
  Notes?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Ordre de Production
 * Planifie et suit la fabrication de produits finis
 */
export interface ProductionOrder {
  ProductionOrderId: string;
  OrderNumber: string; // OP-202511-0001
  RecipeId: string;
  RecipeName?: string;
  ProductId: string;
  ProductName?: string;
  Status: ProductionOrderStatus;
  PlannedQuantity: number; // Quantité à produire
  ProducedQuantity: number; // Quantité produite
  Unit: string;
  PlannedStartDate: string;
  PlannedEndDate: string;
  ActualStartDate?: string;
  ActualEndDate?: string;
  Priority: 'low' | 'normal' | 'high' | 'urgent';
  AssignedToId?: string; // Chef Usine assigné
  AssignedToName?: string;
  SourceWarehouseId?: string; // Entrepôt source des matières premières
  DestinationWarehouseId?: string; // Entrepôt de destination des produits finis
  IngredientConsumptions: IngredientConsumption[]; // Consommations réelles
  Batches: ProductionBatch[]; // Lots produits
  TotalCost: number; // Coût total de production
  YieldRate: number; // Rendement réel en %
  Notes?: string;
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

// ============================================================================
// Module 7.5 - Dépenses & Sollicitations
// ============================================================================

export type ExpenseType =
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

export type ExpenseRequestStatus =
  | 'draft' // Brouillon
  | 'submitted' // Soumise
  | 'pending_approval' // En attente d'approbation
  | 'approved' // Approuvée
  | 'rejected' // Rejetée
  | 'paid' // Payée
  | 'cancelled'; // Annulée

export type ExpenseUrgency = 'low' | 'normal' | 'high' | 'urgent';

export interface ExpenseProof {
  ProofId: string;
  ExpenseRequestId: string;
  Type: 'receipt' | 'invoice' | 'photo' | 'document' | 'other';
  FileName: string;
  FileUrl: string;
  FileSize: number; // bytes
  MimeType: string;
  Description?: string;
  UploadedAt: string;
  UploadedBy: string;
}

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

export interface ExpenseRequest {
  ExpenseRequestId: string;
  RequestNumber: string; // DEP-202511-0001
  Title: string;
  Description: string;
  Category: ExpenseType;
  Subcategory: ExpenseSubcategory;
  Amount: number;
  Currency: string;
  Urgency: ExpenseUrgency;
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

export interface ExpenseCategoryConfig {
  CategoryConfigId: string;
  Name: string;
  Category: ExpenseType;
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

// ============================================================================
// Module 7.2 - Consignation & Partenaires
// ============================================================================

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
  CommissionRate: number; // % sur les ventes
  PaymentTerms: number; // Jours (ex: 30, 60)

  // Financier
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

export type DepositStatus =
  | 'pending' // En attente de validation
  | 'validated' // Validé et déposé
  | 'partial' // Partiellement vendu/retourné
  | 'completed' // Entièrement traité (vendu ou retourné)
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
  UnitPrice: number; // Prix de vente unitaire
  TotalValue: number; // Valeur totale de la ligne
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
  TotalItems: number; // Nombre total d'articles déposés
  TotalValue: number; // Valeur totale du dépôt

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
  DeliveryProof?: string; // URL du bon de livraison signé

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

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
  DepositId?: string; // Lié à un dépôt spécifique ou ventes libres
  DepositNumber?: string;
  Status: SalesReportStatus;

  // Période du rapport
  ReportDate: string;
  PeriodStart: string;
  PeriodEnd: string;

  // Contenu
  Lines: SalesReportLine[];
  TotalSales: number;
  PartnerCommission: number; // Montant de la commission
  NetAmount: number; // Montant net à payer au partenaire (ventes - commission)
  Currency: string;

  // Soumission et validation
  SubmittedById?: string;
  SubmittedByName?: string;
  SubmittedAt?: string;
  ValidatedById?: string;
  ValidatedByName?: string;
  ValidatedAt?: string;
  RejectionReason?: string;

  // Génération de ventes
  SalesGenerated: boolean; // Si les ventes ont été créées automatiquement
  GeneratedSaleIds?: string[]; // IDs des ventes générées

  // Métadonnées
  Notes?: string;
  Attachments?: string[]; // URLs des pièces jointes (photos, reçus)

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export type SettlementStatus = 'pending' | 'partial' | 'completed' | 'cancelled';

export interface Settlement {
  SettlementId: string;
  SettlementNumber: string; // SET-202511-0001
  PartnerId: string;
  PartnerName: string;
  Status: SettlementStatus;

  // Montants
  TotalDue: number; // Montant total dû au partenaire
  AmountPaid: number; // Montant déjà payé
  AmountRemaining: number; // Montant restant à payer
  Currency: string;

  // Rapports inclus dans ce règlement
  SalesReportIds: string[];

  // Paiement
  PaymentMethod?: 'cash' | 'bank_transfer' | 'mobile_money' | 'check';
  PaymentDate?: string;
  PaymentProof?: string; // URL du justificatif de paiement
  WalletId?: string; // Wallet utilisé pour le paiement
  TransactionId?: string; // ID de la transaction de trésorerie

  // Responsables
  PreparedById: string;
  PreparedByName: string;
  PaidById?: string;
  PaidByName?: string;

  // Métadonnées
  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ConsignationReturn {
  ReturnId: string;
  ReturnNumber: string; // RET-202511-0001
  DepositId: string;
  DepositNumber: string;
  PartnerId: string;
  PartnerName: string;

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
  ReceivedByName: string;

  // Entrepôt de réception
  WarehouseId: string;
  WarehouseName?: string;

  // Métadonnées
  Notes?: string;
  ReturnProof?: string; // URL du bon de retour signé

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

// ============================================================================
// Module 7.7 - RH & Rémunérations
// ============================================================================

export type EmployeeStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type EmployeeRole = 'admin' | 'manager' | 'sales_agent' | 'warehouse_keeper' | 'accountant' | 'delivery' | 'production' | 'other';
export type ContractType = 'permanent' | 'temporary' | 'contractor' | 'intern';

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

export type AttendanceStatus = 'pending' | 'validated' | 'rejected' | 'auto_validated';

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

export type CommissionStatus = 'pending' | 'calculated' | 'paid';
export type CommissionType = 'sales' | 'target_bonus' | 'performance_bonus' | 'manual';

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

export type PayrollStatus = 'draft' | 'calculated' | 'validated' | 'paid' | 'cancelled';

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

export type TransportAllowanceStatus = 'pending' | 'validated' | 'paid' | 'rejected';
export type TransportType = 'stand_visit' | 'client_visit' | 'delivery' | 'meeting' | 'other';

export interface TransportAllowance {
  TransportId: string;
  TransportNumber: string; // TRA-202411-0001
  EmployeeId: string;
  EmployeeName: string;
  EmployeeRole: EmployeeRole;
  Status: TransportAllowanceStatus;

  // Date et détails
  WorkDate: string;
  TransportType: TransportType;
  Description?: string;

  // Montant
  Amount: number;
  Currency: string;
  DefaultRate: number; // Taux par défaut (ex: 2000 F/jour)
  AppliedRate: number; // Taux appliqué (peut être différent)

  // Localisation
  LocationId?: string;
  LocationName?: string;
  AttendanceId?: string; // Lien avec la présence

  // Photos preuves
  ProofPhotoUrl?: string;

  // Distance (optionnel pour calcul futur)
  DistanceKm?: number;
  RatePerKm?: number;

  // Validation
  ValidatedById?: string;
  ValidatedByName?: string;
  ValidatedAt?: string;
  RejectionReason?: string;

  // Paiement
  PaidDate?: string;
  PayrollId?: string;
  TransactionId?: string;

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TransportAllowanceRule {
  RuleId: string;
  Name: string;
  IsActive: boolean;

  // Conditions d'application
  EmployeeRoles?: EmployeeRole[]; // Rôles concernés (sales_agent, etc.)
  TransportTypes?: TransportType[]; // Types de déplacements

  // Montants
  DefaultAmount: number;
  Currency: string;

  // Conditions spéciales
  MinDistanceKm?: number;
  RatePerKm?: number;
  MaxAmountPerDay?: number;
  RequiresApproval: boolean;

  // Dates de validité
  ValidFrom?: string;
  ValidUntil?: string;

  Notes?: string;

  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

// ============================================================================
// Module 7.8 - Clients & Fidélité
// ============================================================================

export type CustomerType = 'individual' | 'business';
export type CustomerStatus = 'active' | 'inactive' | 'suspended' | 'vip';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type RewardType = 'discount' | 'free_product' | 'cashback' | 'points_multiplier' | 'special_offer';
export type RewardStatus = 'available' | 'redeemed' | 'expired' | 'cancelled';

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

// ============================================================================
// Module 7.9 - IA Prédictive & Aide à la Décision
// ============================================================================

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
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'between';

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
  Priority: number; // Plus élevé = plus prioritaire
  
  // Conditions
  Conditions: Array<{
    field: string;           // Ex: "amount", "categoryId", "productId"
    operator: RuleConditionOperator;
    value: any;
    logicalOperator?: 'AND' | 'OR'; // Pour combiner avec condition suivante
  }>;
  
  // Action recommandée
  RecommendedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
  CustomActionData?: Record<string, any>;
  
  // Automatisation
  AutoExecute: boolean;      // Exécuter automatiquement sans validation humaine
  RequiresApproval: boolean; // Nécessite approbation d'un humain
  ApproverRoles?: string[];  // Rôles pouvant approuver
  
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
  
  // Historique et performance
  TotalTriggered: number;
  TotalAutoExecuted: number;
  TotalApproved: number;
  TotalRejected: number;
  TotalOverridden: number;
  SuccessRate?: number; // % de décisions correctes
  
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
  
  // Contexte de la décision
  ReferenceId: string;        // ID de l'entité concernée
  ReferenceType: string;       // Type d'entité
  ReferenceNumber?: string;
  ReferenceData: Record<string, any>; // Données complètes pour analyse
  
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
  
  // Données prédictives
  PredictedOutcome?: {
    success_probability: number;
    estimated_roi?: number;
    estimated_cost?: number;
    estimated_revenue?: number;
    estimated_timeline?: number; // jours
    risks?: string[];
    opportunities?: string[];
  };
  
  // Alternatives suggérées
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
  
  // Override (si décision différente de la recommandation)
  WasOverridden: boolean;
  OverrideReason?: string;
  
  // Feedback pour apprentissage
  OutcomeActual?: 'success' | 'failure' | 'partial';
  OutcomeNotes?: string;
  LearningData?: Record<string, any>;
  
  // Expiration
  ExpiresAt?: string;
  
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface PredictiveModel {
  ModelId: string;
  ModelCode: string; // MODEL-001
  Name: string;
  Description: string;
  Type: 'classification' | 'regression' | 'forecasting' | 'clustering' | 'recommendation';
  
  // Domaine d'application
  Domain: 'sales' | 'inventory' | 'finance' | 'hr' | 'production' | 'customer' | 'general';
  DecisionTypes: DecisionType[];
  
  // Algorithme
  Algorithm: string; // Ex: "random_forest", "linear_regression", "neural_network"
  Version: string;
  
  // Données d'entraînement
  TrainingDataset: {
    source: string;
    features: string[];
    targetVariable: string;
    recordCount: number;
    dateRange: { start: string; end: string };
  };
  
  // Performance
  Metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    mae?: number;  // Mean Absolute Error
    rmse?: number; // Root Mean Square Error
    r2_score?: number;
  };
  
  // Configuration
  Hyperparameters?: Record<string, any>;
  FeatureImportance?: Record<string, number>;
  
  // Statut
  Status: 'training' | 'active' | 'deprecated' | 'failed';
  IsActive: boolean;
  LastTrainedAt?: string;
  TrainingDuration?: number; // secondes
  
  // Usage
  TotalPredictions: number;
  TotalCorrect?: number;
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

export interface AIInsight {
  InsightId: string;
  Type: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'recommendation' | 'forecast';
  
  // Sujet
  Subject: string;
  Description: string;
  Severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Domaine
  Domain: 'sales' | 'inventory' | 'finance' | 'hr' | 'production' | 'customer' | 'general';
  
  // Données
  Data: Record<string, any>;
  Metrics?: Record<string, number>;
  
  // Visualisation
  ChartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
  ChartData?: any;
  
  // Impact
  EstimatedImpact?: {
    financial?: number;
    operational?: string;
    strategic?: string;
  };
  
  // Actions suggérées
  SuggestedActions?: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    estimatedEffort: string;
    expectedBenefit: string;
  }>;
  
  // Statut
  Status: 'new' | 'acknowledged' | 'actioned' | 'dismissed';
  AcknowledgedById?: string;
  AcknowledgedByName?: string;
  AcknowledgedAt?: string;
  
  ActionTaken?: string;
  ActionedAt?: string;
  
  // Métadonnées
  ModelId?: string;
  ConfidenceScore: number;
  
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
  
  // Configuration globale
  IsActive: boolean;
  DefaultMode: 'automatic' | 'assisted' | 'manual'; // assisted = recommandation sans auto-exécution
  
  // Règles par type de décision
  DecisionConfigs: Array<{
    decisionType: DecisionType;
    mode: 'automatic' | 'assisted' | 'manual' | 'disabled';
    
    // Seuils
    autoApproveThreshold?: number;    // Montant/quantité pour approbation auto
    requireReviewThreshold?: number;  // Au-delà, nécessite revue même si auto
    
    // Contexte
    applicableCategories?: string[];
    applicableSuppliers?: string[];
    applicableProducts?: string[];
    applicableDepartments?: string[];
    
    // Horaires (pour décisions automatiques)
    allowedDays?: number[];           // 0=Dimanche, 1=Lundi, etc.
    allowedHoursStart?: string;       // "08:00"
    allowedHoursEnd?: string;         // "18:00"
    
    // Notification
    notifyOnAutoApproval: boolean;
    notifyOnRejection: boolean;
    notifyDaily: boolean;             // Résumé quotidien
  }>;
  
  // Limites
  DailyAutoApprovalLimit?: number;   // Nombre max d'approbations auto/jour
  WeeklyAutoApprovalLimit?: number;
  MonthlyAutoApprovalLimit?: number;
  
  DailySpendingLimit?: number;       // Montant max dépenses auto/jour
  WeeklySpendingLimit?: number;
  MonthlySpendingLimit?: number;
  
  // Statistiques d'usage
  TotalAutoApprovals: number;
  TotalAssistedDecisions: number;
  TotalOverrides: number;
  OverrideRate?: number;
  
  // Délégation
  DelegateToUserId?: string;         // Délégation temporaire
  DelegateToUserName?: string;
  DelegationStartDate?: string;
  DelegationEndDate?: string;
  
  // Métadonnées
  Tags?: string[];
  Notes?: string;
  
  WorkspaceId: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface DecisionAuditLog {
  AuditLogId: string;
  
  // Décision
  RecommendationId: string;
  DecisionType: DecisionType;
  ReferenceId: string;
  ReferenceType: string;
  
  // Recommandation IA
  RecommendedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
  Confidence: RecommendationConfidence;
  ConfidenceScore: number;
  
  // Décision finale
  FinalDecision: 'approve' | 'reject' | 'defer';
  WasAutoExecuted: boolean;
  WasOverridden: boolean;
  
  // Acteur
  DecidedById?: string;
  DecidedByName?: string;
  DecidedByRole?: string;
  
  // Temps
  DecisionTime: number; // millisecondes depuis création recommandation
  DecisionMethod: 'automatic' | 'assisted' | 'manual';
  
  // Résultat
  OutcomeActual?: 'success' | 'failure' | 'partial';
  OutcomeEvaluatedAt?: string;
  
  // Impact financier
  EstimatedImpact?: number;
  ActualImpact?: number;
  
  // Feedback
  UserSatisfaction?: number; // 1-5
  FeedbackComments?: string;
  
  WorkspaceId: string;
  CreatedAt: string;
}

export interface AIConfiguration {
  ConfigId: string;
  WorkspaceId: string;
  
  // Activation globale
  IsAIEnabled: boolean;
  
  // Modules activés
  EnabledModules: {
    decisionSupport: boolean;
    predictiveAnalytics: boolean;
    insights: boolean;
    forecasting: boolean;
    anomalyDetection: boolean;
  };
  
  // Paramètres généraux
  MinimumConfidenceThreshold: number; // 0-100, seuil min pour recommandation
  DefaultAutoExecuteThreshold: number; // 0-100, seuil pour auto-exécution
  
  // Apprentissage
  EnableContinuousLearning: boolean;
  LearningRate: number;
  RetrainingFrequency: 'daily' | 'weekly' | 'monthly';
  
  // Notifications
  NotifyOnLowConfidence: boolean;
  NotifyOnOverride: boolean;
  NotifyOnAnomalies: boolean;
  
  // Limites
  MaxRecommendationsPerDay?: number;
  MaxAutoExecutionsPerDay?: number;
  
  // Données
  DataRetentionDays: number;
  
  // API et intégrations
  ExternalAIProvider?: 'openai' | 'anthropic' | 'custom';
  ExternalAPIKey?: string;
  
  // Métadonnées
  LastUpdatedById: string;
  LastUpdatedByName: string;
  UpdatedAt: string;
  CreatedAt: string;
}
