/**
 * RBAC - Permission Constants & Utilities
 */

// Liste complète des permissions du système
export const PERMISSIONS = {
  // Module 7.1 - Ventes
  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_EDIT: 'sales:edit',
  SALES_DELETE: 'sales:delete',

  // Module 7.2 - Stocks
  STOCK_VIEW: 'stock:view',
  STOCK_CREATE: 'stock:create',
  STOCK_EDIT: 'stock:edit',
  STOCK_DELETE: 'stock:delete',
  STOCK_TRANSFER: 'stock:transfer',

  // Module 7.3 - Trésorerie
  TREASURY_VIEW: 'treasury:view',
  TREASURY_CREATE: 'treasury:create',
  TREASURY_EDIT: 'treasury:edit',
  TREASURY_DELETE: 'treasury:delete',
  TREASURY_APPROVE: 'treasury:approve',
  PAYMENT_METHOD_VIEW: 'payment_method:view',
  PAYMENT_METHOD_EDIT: 'payment_method:edit',

  // Module 7.4 - Production & Usine
  PRODUCTION_VIEW: 'production:view',
  PRODUCTION_EDIT: 'production:edit',
  PRODUCTION_CREATE: 'production:create',
  PRODUCTION_DELETE: 'production:delete',
  PRODUCTION_START: 'production:start',
  PRODUCTION_COMPLETE: 'production:complete',
  PRODUCTION_SUBMIT: 'production:submit',           // Soumettre un OP au validateur (manager_production)
  PRODUCTION_APPROVE: 'production:approve',         // Approuver un OP soumis (admin)
  PRODUCTION_VIEW_COST: 'production:view_cost',     // Voir le coût détaillé d'un OP (admin/pca/compta)

  // Module 7.4 bis - Matières premières & recettes (formules secrètes)
  INGREDIENT_VIEW: 'ingredient:view',               // Voir la liste des MP (qty, unité, fournisseur)
  INGREDIENT_EDIT: 'ingredient:edit',               // Créer/modifier la FICHE d'une MP : nom, fournisseur,
                                                    // prix de référence (admin + pca uniquement — métier).
  INGREDIENT_INVENTORY: 'ingredient:inventory',     // Comptage physique + ajustement de stock (admin +
                                                    // manager_compta_stocks + manager_production).
                                                    // Séparé de ingredient:edit pour que les opérationnels
                                                    // terrain puissent inventorier sans pouvoir éditer la fiche.
  RECIPE_VIEW: 'recipe:view',                       // Voir liste recettes (sans % ni marge)
  RECIPE_EDIT: 'recipe:edit',                       // Créer/modifier recette (admin + pca uniquement)
  RECIPE_VIEW_FORMULA: 'recipe:view_formula',       // Voir % d'ingrédients, marges, coûts (admin + pca SECRET)

  // Module 7.5 bis - Achats matières premières (greffé sur expense_requests)
  PURCHASE_REQUEST_VIEW: 'purchase_request:view',
  PURCHASE_REQUEST_CREATE: 'purchase_request:create',     // manager_production + manager_compta_stocks
  PURCHASE_REQUEST_APPROVE: 'purchase_request:approve',   // admin
  PURCHASE_REQUEST_RECEIVE: 'purchase_request:receive',   // manager_production + manager_compta_stocks

  // Module 7.5 - Dépenses
  EXPENSE_VIEW: 'expense:view',
  EXPENSE_CREATE: 'expense:create',
  EXPENSE_EDIT: 'expense:edit',
  EXPENSE_DELETE: 'expense:delete',
  EXPENSE_APPROVE: 'expense:approve',
  EXPENSE_PAY: 'expense:pay',

  // Module 7.2 - Consignation & Partenaires
  CONSIGNMENT_VIEW: 'consignment:view',
  CONSIGNMENT_CREATE: 'consignment:create',
  CONSIGNMENT_EDIT: 'consignment:edit',
  CONSIGNMENT_DELETE: 'consignment:delete',
  CONSIGNMENT_VALIDATE: 'consignment:validate',
  CONSIGNMENT_SETTLE: 'consignment:settle',
  PARTNER_VIEW: 'partner:view',
  PARTNER_CREATE: 'partner:create',
  PARTNER_EDIT: 'partner:edit',
  PARTNER_DELETE: 'partner:delete',

  // Module 7.6 - Avances & Dettes
  ADVANCE_VIEW: 'advance:view',
  ADVANCE_CREATE: 'advance:create',
  ADVANCE_EDIT: 'advance:edit',
  ADVANCE_DELETE: 'advance:delete',
  ADVANCE_APPROVE: 'advance:approve',
  DEBT_VIEW: 'debt:view',
  DEBT_CREATE: 'debt:create',
  DEBT_EDIT: 'debt:edit',
  DEBT_DELETE: 'debt:delete',

  // Module 7.7 - Ressources Humaines
  HR_VIEW: 'hr:view',
  HR_CREATE: 'hr:create',
  HR_EDIT: 'hr:edit',
  HR_UPDATE: 'hr:update',
  HR_DELETE: 'hr:delete',
  HR_APPROVE: 'hr:approve',
  HR_PAYROLL: 'hr:payroll',
  HR_COMMISSION: 'hr:commission',
  HR_ADVANCE: 'hr:advance',

  // Module 7.8 - Clients & Fidélité
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',
  LOYALTY_VIEW: 'loyalty:view',
  LOYALTY_MANAGE: 'loyalty:manage',
  LOYALTY_REDEEM: 'loyalty:redeem',

  // Clients B2B grossistes (commandes négociées)
  CLIENT_VIEW: 'client:view',
  CLIENT_CREATE: 'client:create',
  CLIENT_EDIT: 'client:edit',

  // Approvisionnements stands (commandes internes manager commercial)
  REPLENISHMENT_VIEW: 'replenishment:view',
  REPLENISHMENT_CREATE: 'replenishment:create',
  REPLENISHMENT_APPROVE: 'replenishment:approve',
  REPLENISHMENT_DISTRIBUTE: 'replenishment:distribute',

  // Module 7.9 - IA Prédictive & Aide à la Décision
  AI_DECISION_VIEW: 'ai:decision:view',
  AI_DECISION_REQUEST: 'ai:decision:request',
  AI_DECISION_APPLY: 'ai:decision:apply',
  AI_DECISION_OVERRIDE: 'ai:decision:override',
  AI_RULE_VIEW: 'ai:rule:view',
  AI_RULE_CREATE: 'ai:rule:create',
  AI_RULE_EDIT: 'ai:rule:edit',
  AI_RULE_DELETE: 'ai:rule:delete',

  // Module Administration
  ADMIN_USERS_VIEW: 'admin:users:view',
  ADMIN_USERS_CREATE: 'admin:users:create',
  ADMIN_USERS_EDIT: 'admin:users:edit',
  ADMIN_USERS_DELETE: 'admin:users:delete',
  ADMIN_ROLES_VIEW: 'admin:roles:view',
  ADMIN_ROLES_CREATE: 'admin:roles:create',
  ADMIN_ROLES_EDIT: 'admin:roles:edit',
  ADMIN_ROLES_DELETE: 'admin:roles:delete',
  ADMIN_SETTINGS_VIEW: 'admin:settings:view',
  ADMIN_SETTINGS_EDIT: 'admin:settings:edit',
  ADMIN_AUDIT_VIEW: 'admin:audit:view',

  // Rapports
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  // Notifications
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_SEND: 'notification:send',

  // Module 7.10 - Points de vente (Outlets)
  OUTLET_VIEW: 'outlet:view',
  OUTLET_CREATE: 'outlet:create',
  OUTLET_EDIT: 'outlet:edit',
  OUTLET_DELETE: 'outlet:delete',
  OUTLET_ASSIGN: 'outlet:assign',          // Manager : planning hebdo + overrides
  OUTLET_INVOICE_VIEW: 'outlet:invoice:view',
  OUTLET_INVOICE_MANAGE: 'outlet:invoice:manage',
  OUTLET_PRICE_MANAGE: 'outlet:price:manage',
  OUTLET_PAYMENT_METHODS_MANAGE: 'outlet:payment_methods:manage', // Admin / mgr commercial / comptable
  POS_SESSION_OPEN: 'pos:session:open',     // Commercial peut ouvrir/fermer sa session
  CASH_DEPOSIT_CREATE: 'cash:deposit:create',     // Vendeur + mgr + comptable : verser la caisse
  CASH_DEPOSIT_VALIDATE: 'cash:deposit:validate', // Comptable + admin : valider/rejeter
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Rôles prédéfinis avec leurs permissions
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  role_admin: [
    // Accès complet à tout
    ...Object.values(PERMISSIONS),
  ],

  role_manager: [
    // Ventes
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_CREATE,
    PERMISSIONS.SALES_EDIT,
    // Stocks
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.STOCK_CREATE,
    PERMISSIONS.STOCK_EDIT,
    PERMISSIONS.STOCK_TRANSFER,
    // Trésorerie
    PERMISSIONS.TREASURY_VIEW,
    PERMISSIONS.TREASURY_CREATE,
    PERMISSIONS.PAYMENT_METHOD_VIEW,
    // Production
    PERMISSIONS.PRODUCTION_VIEW,
    PERMISSIONS.PRODUCTION_EDIT,
    PERMISSIONS.PRODUCTION_CREATE,
    PERMISSIONS.PRODUCTION_START,
    PERMISSIONS.PRODUCTION_COMPLETE,
    // Dépenses
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_EDIT,
    PERMISSIONS.EXPENSE_APPROVE,
    PERMISSIONS.EXPENSE_PAY,
    // Consignation
    PERMISSIONS.CONSIGNMENT_VIEW,
    PERMISSIONS.CONSIGNMENT_CREATE,
    PERMISSIONS.CONSIGNMENT_EDIT,
    PERMISSIONS.CONSIGNMENT_VALIDATE,
    PERMISSIONS.CONSIGNMENT_SETTLE,
    PERMISSIONS.PARTNER_VIEW,
    PERMISSIONS.PARTNER_CREATE,
    PERMISSIONS.PARTNER_EDIT,
    // Avances & Dettes
    PERMISSIONS.ADVANCE_VIEW,
    PERMISSIONS.ADVANCE_CREATE,
    PERMISSIONS.ADVANCE_APPROVE,
    PERMISSIONS.DEBT_VIEW,
    PERMISSIONS.DEBT_CREATE,
    // RH
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.HR_PAYROLL,
    PERMISSIONS.HR_COMMISSION,
    PERMISSIONS.HR_ADVANCE,
    // Clients
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.LOYALTY_VIEW,
    PERMISSIONS.LOYALTY_MANAGE,
    PERMISSIONS.LOYALTY_REDEEM,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.REPLENISHMENT_VIEW,
    PERMISSIONS.REPLENISHMENT_CREATE,
    PERMISSIONS.REPLENISHMENT_DISTRIBUTE,
    // IA
    PERMISSIONS.AI_DECISION_VIEW,
    PERMISSIONS.AI_DECISION_REQUEST,
    PERMISSIONS.AI_DECISION_APPLY,
    PERMISSIONS.AI_RULE_VIEW,
    // Rapports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    // Notifications
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.NOTIFICATION_SEND,
  ],

  role_accountant: [
    // Ventes (lecture)
    PERMISSIONS.SALES_VIEW,
    // Stocks (lecture)
    PERMISSIONS.STOCK_VIEW,
    // Trésorerie
    PERMISSIONS.TREASURY_VIEW,
    PERMISSIONS.TREASURY_CREATE,
    PERMISSIONS.TREASURY_EDIT,
    PERMISSIONS.TREASURY_APPROVE,
    PERMISSIONS.PAYMENT_METHOD_VIEW,
    PERMISSIONS.PAYMENT_METHOD_EDIT,
    // Dépenses
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_EDIT,
    PERMISSIONS.EXPENSE_PAY,
    // Consignation
    PERMISSIONS.CONSIGNMENT_VIEW,
    PERMISSIONS.CONSIGNMENT_SETTLE,
    PERMISSIONS.PARTNER_VIEW,
    // Avances & Dettes
    PERMISSIONS.ADVANCE_VIEW,
    PERMISSIONS.ADVANCE_CREATE,
    PERMISSIONS.DEBT_VIEW,
    PERMISSIONS.DEBT_CREATE,
    // RH
    PERMISSIONS.HR_VIEW,
    PERMISSIONS.HR_PAYROLL,
    // Clients
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.LOYALTY_VIEW,
    PERMISSIONS.CLIENT_VIEW,
    // IA
    PERMISSIONS.AI_DECISION_VIEW,
    // Rapports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    // Notifications
    PERMISSIONS.NOTIFICATION_VIEW,
  ],

  role_user: [
    // Lecture uniquement sur la plupart des modules
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.STOCK_VIEW,
    PERMISSIONS.PRODUCTION_VIEW, // Peut consulter la production
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.EXPENSE_CREATE, // Peut créer des demandes de dépenses
    PERMISSIONS.CONSIGNMENT_VIEW,
    PERMISSIONS.ADVANCE_VIEW,
    PERMISSIONS.DEBT_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.LOYALTY_VIEW,
    PERMISSIONS.AI_DECISION_VIEW,
    PERMISSIONS.AI_DECISION_REQUEST,
    PERMISSIONS.REPORTS_VIEW,
  ],
};

/**
 * Vérifie si une permission est incluse dans une liste
 */
export function hasPermission(
  userPermissions: string[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Vérifie si l'utilisateur a toutes les permissions requises
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((p) => userPermissions.includes(p));
}

/**
 * Vérifie si l'utilisateur a au moins une des permissions requises
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some((p) => userPermissions.includes(p));
}
