/**
 * Système de Permissions IA
 * Contrôle d'accès aux fonctionnalités IA basé sur les rôles
 *
 * Philosophie: L'IA est une ressource coûteuse, donc accès rationnel et orienté résultat
 */

import { EmployeeRole } from '@/types/modules';

// ============================================================================
// TYPES
// ============================================================================

export type AIFeature =
  | 'sales_forecast'           // Prévisions de ventes
  | 'production_suggestions'   // Suggestions de production
  | 'stock_optimization'       // Optimisation des stocks
  | 'transfer_suggestions'     // Suggestions de transferts
  | 'price_optimization'       // Optimisation des prix
  | 'customer_insights'        // Insights clients
  | 'financial_analysis'       // Analyses financières
  | 'decision_automation'      // Automatisation des décisions
  | 'what_if_simulations'      // Simulations "et si"
  | 'full_dashboard'           // Dashboard IA complet
  | 'api_access';              // Accès API IA

export type AIAccessLevel = 'none' | 'view_only' | 'interactive' | 'full';

export interface AIPermissionSet {
  role: EmployeeRole;
  displayName: string;
  description: string;
  features: Partial<Record<AIFeature, AIAccessLevel>>;
  quotas: {
    forecastsPerDay?: number;
    suggestionsPerDay?: number;
    simulationsPerDay?: number;
    apiCallsPerDay?: number;
  };
  rationale: string; // Pourquoi ce rôle a accès à ces features
}

// ============================================================================
// CONFIGURATION DES PERMISSIONS PAR RÔLE
// ============================================================================

export const AI_PERMISSIONS: Record<EmployeeRole, AIPermissionSet> = {
  /**
   * ADMIN - Accès quasi-complet
   * Manage l'entreprise au quotidien
   */
  admin: {
    role: 'admin',
    displayName: 'Administrateur',
    description: 'Accès complet aux outils de pilotage et d\'analyse',
    features: {
      sales_forecast: 'full',
      production_suggestions: 'full',
      stock_optimization: 'full',
      transfer_suggestions: 'full',
      price_optimization: 'interactive',
      customer_insights: 'full',
      financial_analysis: 'full',
      decision_automation: 'interactive',
      what_if_simulations: 'full',
      full_dashboard: 'full',
      api_access: 'interactive',
    },
    quotas: {
      forecastsPerDay: 100,
      suggestionsPerDay: 50,
      simulationsPerDay: 20,
      apiCallsPerDay: 1000,
    },
    rationale: 'Admin pilote les opérations, a besoin d\'analyses approfondies',
  },

  /**
   * MANAGER - Accès aux outils de gestion
   * Gère une équipe et des opérations
   */
  manager: {
    role: 'manager',
    displayName: 'Manager',
    description: 'Outils IA pour piloter son périmètre',
    features: {
      sales_forecast: 'interactive',
      production_suggestions: 'interactive',
      stock_optimization: 'interactive',
      transfer_suggestions: 'interactive',
      price_optimization: 'view_only',
      customer_insights: 'interactive',
      financial_analysis: 'view_only',
      decision_automation: 'view_only',
      what_if_simulations: 'interactive',
      full_dashboard: 'view_only',
      api_access: 'none',
    },
    quotas: {
      forecastsPerDay: 50,
      suggestionsPerDay: 30,
      simulationsPerDay: 10,
    },
    rationale: 'Manager a besoin de prévoir et optimiser son périmètre, mais pas décisions stratégiques',
  },

  /**
   * ACCOUNTANT - Analyses financières
   * Focus finances et reporting
   */
  accountant: {
    role: 'accountant',
    displayName: 'Comptable',
    description: 'Analyses financières et prévisions budgétaires',
    features: {
      sales_forecast: 'view_only',
      production_suggestions: 'view_only',
      stock_optimization: 'view_only',
      transfer_suggestions: 'none',
      price_optimization: 'view_only',
      customer_insights: 'view_only',
      financial_analysis: 'full',
      decision_automation: 'none',
      what_if_simulations: 'interactive',
      full_dashboard: 'view_only',
      api_access: 'none',
    },
    quotas: {
      forecastsPerDay: 30,
      simulationsPerDay: 15,
    },
    rationale: 'Comptable a besoin d\'analyses financières et prévisions pour budgets',
  },

  /**
   * COMMERCIAL - Insights ventes et clients
   * Focus terrain commercial
   */
  sales_agent: {
    role: 'sales_agent',
    displayName: 'Commercial',
    description: 'Prévisions ventes et insights clients',
    features: {
      sales_forecast: 'interactive',
      production_suggestions: 'view_only',
      stock_optimization: 'view_only',
      transfer_suggestions: 'none',
      price_optimization: 'none',
      customer_insights: 'interactive',
      financial_analysis: 'none',
      decision_automation: 'none',
      what_if_simulations: 'none',
      full_dashboard: 'none',
      api_access: 'none',
    },
    quotas: {
      forecastsPerDay: 20,
      suggestionsPerDay: 10,
    },
    rationale: 'Commercial a besoin de prévoir ventes et comprendre clients, pas plus',
  },

  /**
   * PRODUCTION_MANAGER - Optimisation production
   * Focus usine et production
   */
  production: {
    role: 'production',
    displayName: 'Responsable Production',
    description: 'Optimisation de la production et des stocks',
    features: {
      sales_forecast: 'view_only',
      production_suggestions: 'full',
      stock_optimization: 'full',
      transfer_suggestions: 'interactive',
      price_optimization: 'none',
      customer_insights: 'none',
      financial_analysis: 'view_only',
      decision_automation: 'view_only',
      what_if_simulations: 'interactive',
      full_dashboard: 'none',
      api_access: 'none',
    },
    quotas: {
      forecastsPerDay: 40,
      suggestionsPerDay: 40,
      simulationsPerDay: 10,
    },
    rationale: 'Production Manager optimise fabrication et stocks, a besoin de suggestions précises',
  },

  /**
   * STOCK_MANAGER - Gestion stocks
   * Focus stocks et logistique
   */
  warehouse_keeper: {
    role: 'warehouse_keeper',
    displayName: 'Responsable Stock',
    description: 'Optimisation des stocks et transferts',
    features: {
      sales_forecast: 'view_only',
      production_suggestions: 'view_only',
      stock_optimization: 'full',
      transfer_suggestions: 'full',
      price_optimization: 'none',
      customer_insights: 'none',
      financial_analysis: 'view_only',
      decision_automation: 'none',
      what_if_simulations: 'interactive',
      full_dashboard: 'none',
      api_access: 'none',
    },
    quotas: {
      forecastsPerDay: 30,
      suggestionsPerDay: 40,
      simulationsPerDay: 10,
    },
    rationale: 'Stock Manager a besoin d\'optimiser répartition et transferts, anticiper ruptures',
  },

  /**
   * CASHIER - Accès minimal
   * Juste ce dont il a besoin au quotidien
   */
  other: {
    role: 'other',
    displayName: 'Caissier',
    description: 'Insights clients uniquement',
    features: {
      sales_forecast: 'none',
      production_suggestions: 'none',
      stock_optimization: 'none',
      transfer_suggestions: 'none',
      price_optimization: 'none',
      customer_insights: 'view_only',
      financial_analysis: 'none',
      decision_automation: 'none',
      what_if_simulations: 'none',
      full_dashboard: 'none',
      api_access: 'none',
    },
    quotas: {
      // Quotas très limités
    },
    rationale: 'Caissier a juste besoin de voir infos clients (fidélité, historique) pour ventes',
  },

  /**
   * DELIVERY_PERSON - Accès très limité
   * Juste pour optimiser tournées
   */
  delivery: {
    role: 'delivery',
    displayName: 'Livreur',
    description: 'Aucun accès IA',
    features: {
      sales_forecast: 'none',
      production_suggestions: 'none',
      stock_optimization: 'none',
      transfer_suggestions: 'none',
      price_optimization: 'none',
      customer_insights: 'none',
      financial_analysis: 'none',
      decision_automation: 'none',
      what_if_simulations: 'none',
      full_dashboard: 'none',
      api_access: 'none',
    },
    quotas: {},
    rationale: 'Livreur n\'a pas besoin d\'IA pour livraisons',
  },
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Vérifier si un rôle a accès à une feature IA
 */
export function hasAIFeatureAccess(
  role: EmployeeRole,
  feature: AIFeature,
  requiredLevel: AIAccessLevel = 'view_only'
): boolean {
  const permissions = AI_PERMISSIONS[role];
  const accessLevel = permissions.features[feature] || 'none';

  const levelHierarchy: Record<AIAccessLevel, number> = {
    none: 0,
    view_only: 1,
    interactive: 2,
    full: 3,
  };

  return levelHierarchy[accessLevel] >= levelHierarchy[requiredLevel];
}

/**
 * Obtenir le niveau d'accès d'un rôle pour une feature
 */
export function getAIFeatureAccess(
  role: EmployeeRole,
  feature: AIFeature
): AIAccessLevel {
  const permissions = AI_PERMISSIONS[role];
  return permissions.features[feature] || 'none';
}

/**
 * Vérifier si un rôle a atteint son quota pour une feature
 */
export function checkAIQuota(
  role: EmployeeRole,
  quotaType: keyof AIPermissionSet['quotas'],
  currentUsage: number
): { allowed: boolean; limit?: number; remaining?: number } {
  const permissions = AI_PERMISSIONS[role];
  const limit = permissions.quotas[quotaType];

  if (!limit) {
    // Pas de limite = illimité (owner)
    return { allowed: true };
  }

  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed: currentUsage < limit,
    limit,
    remaining,
  };
}

/**
 * Obtenir toutes les features accessibles pour un rôle
 */
export function getAccessibleAIFeatures(
  role: EmployeeRole,
  minLevel: AIAccessLevel = 'view_only'
): AIFeature[] {
  const permissions = AI_PERMISSIONS[role];
  const features: AIFeature[] = [];

  for (const [feature, level] of Object.entries(permissions.features)) {
    if (hasAIFeatureAccess(role, feature as AIFeature, minLevel)) {
      features.push(feature as AIFeature);
    }
  }

  return features;
}

/**
 * Obtenir un message d'erreur explicatif si accès refusé
 */
export function getAIAccessDeniedMessage(
  role: EmployeeRole,
  feature: AIFeature
): string {
  const permissions = AI_PERMISSIONS[role];
  const accessLevel = getAIFeatureAccess(role, feature);

  if (accessLevel === 'none') {
    return `🔒 Accès refusé: Cette fonctionnalité IA n'est pas disponible pour le rôle ${permissions.displayName}. ` +
           `Raison: ${permissions.rationale}`;
  }

  return `⚠️ Accès limité: Vous avez un accès ${accessLevel === 'view_only' ? 'en lecture seule' : 'limité'} à cette fonctionnalité.`;
}

/**
 * Récupérer la configuration complète de permissions pour un rôle
 */
export function getAIPermissions(role: EmployeeRole): AIPermissionSet {
  return AI_PERMISSIONS[role];
}

/**
 * Vérifier si un rôle doit voir le bouton IA sur un écran donné
 */
export function shouldShowAIButton(
  role: EmployeeRole,
  screenType: 'sales' | 'stock' | 'production' | 'finance' | 'customer' | 'hr'
): boolean {
  const relevantFeatures: Record<typeof screenType, AIFeature[]> = {
    sales: ['sales_forecast', 'customer_insights'],
    stock: ['stock_optimization', 'transfer_suggestions'],
    production: ['production_suggestions', 'stock_optimization'],
    finance: ['financial_analysis', 'sales_forecast'],
    customer: ['customer_insights'],
    hr: ['financial_analysis'],
  };

  const features = relevantFeatures[screenType] || [];

  // Afficher bouton si au moins 1 feature accessible
  return features.some(feature => hasAIFeatureAccess(role, feature, 'view_only'));
}

/**
 * Obtenir les insights IA disponibles pour un rôle sur un écran
 */
export function getAvailableInsightsForScreen(
  role: EmployeeRole,
  screenType: 'sales' | 'stock' | 'production' | 'finance' | 'customer' | 'hr'
): {
  canViewForecasts: boolean;
  canViewSuggestions: boolean;
  canInteract: boolean;
  canSimulate: boolean;
} {
  const insightMapping: Record<typeof screenType, AIFeature> = {
    sales: 'sales_forecast',
    stock: 'stock_optimization',
    production: 'production_suggestions',
    finance: 'financial_analysis',
    customer: 'customer_insights',
    hr: 'financial_analysis',
  };

  const mainFeature = insightMapping[screenType];
  const accessLevel = getAIFeatureAccess(role, mainFeature);

  return {
    canViewForecasts: ['view_only', 'interactive', 'full'].includes(accessLevel),
    canViewSuggestions: ['view_only', 'interactive', 'full'].includes(accessLevel),
    canInteract: ['interactive', 'full'].includes(accessLevel),
    canSimulate: hasAIFeatureAccess(role, 'what_if_simulations', 'interactive'),
  };
}

// ============================================================================
// TRACKING D'UTILISATION (pour quotas)
// ============================================================================

interface AIUsageRecord {
  userId: string;
  role: EmployeeRole;
  feature: AIFeature;
  date: string; // YYYY-MM-DD
  count: number;
}

// TODO: Implémenter stockage dans Airtable
const usageCache = new Map<string, number>();

/**
 * Enregistrer une utilisation IA
 */
export function trackAIUsage(
  userId: string,
  role: EmployeeRole,
  feature: AIFeature
): void {
  const today = new Date().toISOString().split('T')[0];
  const key = `${userId}-${feature}-${today}`;

  const current = usageCache.get(key) || 0;
  usageCache.set(key, current + 1);

  // TODO: Persister dans Airtable
}

/**
 * Récupérer l'utilisation actuelle
 */
export function getAIUsage(
  userId: string,
  feature: AIFeature,
  date?: string
): number {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const key = `${userId}-${feature}-${targetDate}`;

  return usageCache.get(key) || 0;
}

/**
 * Vérifier et tracker une utilisation IA
 */
export function checkAndTrackAIUsage(
  userId: string,
  role: EmployeeRole,
  feature: AIFeature,
  quotaType: keyof AIPermissionSet['quotas']
): { allowed: boolean; message?: string } {
  // 1. Vérifier accès feature
  if (!hasAIFeatureAccess(role, feature)) {
    return {
      allowed: false,
      message: getAIAccessDeniedMessage(role, feature),
    };
  }

  // 2. Vérifier quota
  const currentUsage = getAIUsage(userId, feature);
  const quotaCheck = checkAIQuota(role, quotaType, currentUsage);

  if (!quotaCheck.allowed) {
    return {
      allowed: false,
      message: `⚠️ Quota journalier atteint: ${quotaCheck.limit}/${quotaCheck.limit} ${quotaType}. Réessayez demain.`,
    };
  }

  // 3. Tracker utilisation
  trackAIUsage(userId, role, feature);

  return {
    allowed: true,
    message: quotaCheck.remaining !== undefined
      ? `✅ Requête acceptée. Restant aujourd'hui: ${quotaCheck.remaining}/${quotaCheck.limit}`
      : '✅ Requête acceptée',
  };
}
