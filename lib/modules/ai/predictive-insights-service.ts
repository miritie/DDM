/**
 * Service - Insights Prédictifs & Analyses IA
 * Prévisions ventes, suggestions production, optimisations stocks
 */

import { AirtableClient } from '@/lib/airtable/airtable-client';

const airtable = new AirtableClient();

// ============================================================================
// TYPES
// ============================================================================

export interface SalesForecast {
  ForecastId: string;
  ProductId?: string;
  ProductName?: string;
  LocationId?: string;
  LocationName?: string;
  Period: '7_days' | '30_days' | '90_days';

  // Prévisions
  PredictedQuantity: number;
  PredictedRevenue: number;
  ConfidenceLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  ConfidenceScore: number; // 0-100

  // Données historiques utilisées
  HistoricalDataPoints: number;
  AverageDailySales: number;
  TrendDirection: 'up' | 'down' | 'stable';
  TrendPercentage: number;

  // Facteurs
  Seasonality?: number; // -1 to 1
  GrowthRate?: number; // %
  VolatilityScore?: number; // 0-100

  // Métadonnées
  GeneratedAt: string;
  ValidUntil: string;
  WorkspaceId: string;
}

export interface ProductionSuggestion {
  SuggestionId: string;
  ProductId: string;
  ProductName: string;

  // Suggestion
  SuggestedQuantity: number;
  Priority: 'low' | 'medium' | 'high' | 'urgent';
  Reasoning: string;

  // Analyse
  CurrentStock: number;
  AverageDailySales: number;
  DaysOfStockRemaining: number;
  ForecastedDemand30Days: number;

  // Optimisation
  OptimalBatchSize: number;
  EstimatedProductionCost: number;
  EstimatedRevenue: number;
  EstimatedProfit: number;
  ROI: number;

  // Ingrédients requis
  RequiredIngredients?: Array<{
    ingredientId: string;
    ingredientName: string;
    quantityNeeded: number;
    quantityAvailable: number;
    needsToPurchase: number;
  }>;

  // Statut
  Status: 'pending' | 'accepted' | 'rejected' | 'completed';
  CreatedById?: string;
  CreatedByName?: string;

  GeneratedAt: string;
  WorkspaceId: string;
}

export interface StockTransferSuggestion {
  SuggestionId: string;
  ProductId: string;
  ProductName: string;

  // Transfert suggéré
  FromLocationId: string;
  FromLocationName: string;
  ToLocationId: string;
  ToLocationName: string;
  SuggestedQuantity: number;

  // Analyse
  FromCurrentStock: number;
  FromDaysOfStock: number;
  ToCurrentStock: number;
  ToDaysOfStock: number;

  // Justification
  Reasoning: string;
  Priority: 'low' | 'medium' | 'high' | 'urgent';
  EstimatedImpact: string;

  // Prévisions
  FromForecastedDemand: number;
  ToForecastedDemand: number;

  Status: 'pending' | 'accepted' | 'rejected' | 'completed';
  GeneratedAt: string;
  WorkspaceId: string;
}

export interface AIInsight {
  InsightId: string;
  Type: 'opportunity' | 'risk' | 'optimization' | 'alert';
  Category: 'sales' | 'stock' | 'production' | 'finance' | 'customer' | 'hr';

  Title: string;
  Description: string;
  Impact: 'low' | 'medium' | 'high' | 'critical';

  // Données
  RelatedData: Record<string, any>;
  RecommendedActions: string[];

  // Métriques
  EstimatedImpactAmount?: number;
  EstimatedImpactPercentage?: number;

  // Statut
  Status: 'new' | 'viewed' | 'actioned' | 'dismissed';
  ViewedAt?: string;
  ActionedAt?: string;

  GeneratedAt: string;
  ExpiresAt?: string;
  WorkspaceId: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class PredictiveInsightsService {

  // ==========================================================================
  // PRÉVISIONS DE VENTES
  // ==========================================================================

  /**
   * Générer prévisions de ventes pour un produit
   */
  async generateSalesForecast(
    workspaceId: string,
    productId: string,
    period: '7_days' | '30_days' | '90_days' = '30_days',
    locationId?: string
  ): Promise<SalesForecast> {
    // 1. Récupérer historique des ventes
    const historicalSales = await this.getHistoricalSales(
      workspaceId,
      productId,
      this.getPeriodDays(period) * 2, // 2x période pour analyse
      locationId
    );

    if (historicalSales.length === 0) {
      return this.generateLowConfidenceForecast(workspaceId, productId, period, locationId);
    }

    // 2. Calculer métriques
    const avgDailySales = this.calculateAverageDailySales(historicalSales);
    const trend = this.calculateTrend(historicalSales);
    const seasonality = this.detectSeasonality(historicalSales);
    const volatility = this.calculateVolatility(historicalSales);

    // 3. Appliquer prévision
    const periodDays = this.getPeriodDays(period);
    const basePrediction = avgDailySales * periodDays;

    // Ajuster avec tendance
    const trendAdjustment = basePrediction * (trend.percentage / 100);
    const seasonalAdjustment = basePrediction * (seasonality * 0.1); // 10% max impact

    const predictedQuantity = Math.round(
      basePrediction + trendAdjustment + seasonalAdjustment
    );

    // 4. Calculer confiance
    const confidenceScore = this.calculateForecastConfidence(
      historicalSales.length,
      volatility,
      trend.percentage
    );

    // 5. Récupérer prix moyen
    const avgPrice = await this.getAveragePrice(workspaceId, productId);

    const forecast: Partial<SalesForecast> = {
      ForecastId: `FOR-${Date.now()}-${productId}`,
      ProductId: productId,
      LocationId: locationId,
      Period: period,
      PredictedQuantity: Math.max(0, predictedQuantity),
      PredictedRevenue: Math.max(0, predictedQuantity * avgPrice),
      ConfidenceLevel: this.getConfidenceLevel(confidenceScore),
      ConfidenceScore: confidenceScore,
      HistoricalDataPoints: historicalSales.length,
      AverageDailySales: avgDailySales,
      TrendDirection: trend.direction,
      TrendPercentage: trend.percentage,
      Seasonality: seasonality,
      GrowthRate: trend.percentage,
      VolatilityScore: volatility,
      GeneratedAt: new Date().toISOString(),
      ValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
      WorkspaceId: workspaceId,
    };

    return forecast as SalesForecast;
  }

  /**
   * Générer prévisions pour tous les produits top
   */
  async generateTopProductsForecasts(
    workspaceId: string,
    limit: number = 10
  ): Promise<SalesForecast[]> {
    const topProducts = await this.getTopSellingProducts(workspaceId, limit);

    const forecasts: SalesForecast[] = [];

    for (const product of topProducts) {
      try {
        const forecast = await this.generateSalesForecast(
          workspaceId,
          product.ProductId,
          '30_days'
        );
        forecasts.push(forecast);
      } catch (error) {
        console.error(`Erreur prévision produit ${product.ProductId}:`, error);
      }
    }

    return forecasts;
  }

  // ==========================================================================
  // SUGGESTIONS DE PRODUCTION
  // ==========================================================================

  /**
   * Générer suggestions de production
   */
  async generateProductionSuggestions(
    workspaceId: string
  ): Promise<ProductionSuggestion[]> {
    const suggestions: ProductionSuggestion[] = [];

    // 1. Récupérer produits fabriqués
    const products = await this.getManufacturedProducts(workspaceId);

    for (const product of products) {
      // 2. Récupérer stock actuel
      const currentStock = await this.getCurrentStock(workspaceId, product.ProductId);

      // 3. Générer prévision demande 30 jours
      const forecast = await this.generateSalesForecast(
        workspaceId,
        product.ProductId,
        '30_days'
      );

      const avgDailySales = forecast.AverageDailySales;
      const daysOfStock = avgDailySales > 0 ? currentStock / avgDailySales : 999;

      // 4. Décider si production nécessaire
      if (daysOfStock < 7) { // Moins de 7 jours de stock
        const priority = this.calculateProductionPriority(daysOfStock, avgDailySales);

        // Quantité suggérée = demande prévue 30j - stock actuel
        const suggestedQuantity = Math.max(
          0,
          Math.round(forecast.PredictedQuantity - currentStock)
        );

        if (suggestedQuantity > 0) {
          const suggestion = await this.createProductionSuggestion(
            workspaceId,
            product,
            suggestedQuantity,
            currentStock,
            avgDailySales,
            daysOfStock,
            forecast.PredictedQuantity,
            priority
          );

          suggestions.push(suggestion);
        }
      }
    }

    // Trier par priorité
    return suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.Priority] - priorityOrder[a.Priority];
    });
  }

  /**
   * Créer suggestion de production détaillée
   */
  private async createProductionSuggestion(
    workspaceId: string,
    product: any,
    suggestedQuantity: number,
    currentStock: number,
    avgDailySales: number,
    daysOfStock: number,
    forecastedDemand: number,
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<ProductionSuggestion> {
    // Récupérer recette/BOM
    const ingredients = await this.getProductIngredients(workspaceId, product.ProductId);

    // Calculer besoins ingrédients
    const requiredIngredients = [];
    for (const ing of ingredients) {
      const quantityNeeded = ing.quantityPerUnit * suggestedQuantity;
      const available = await this.getCurrentStock(workspaceId, ing.ingredientId);
      const needsToPurchase = Math.max(0, quantityNeeded - available);

      requiredIngredients.push({
        ingredientId: ing.ingredientId,
        ingredientName: ing.ingredientName,
        quantityNeeded,
        quantityAvailable: available,
        needsToPurchase,
      });
    }

    // Calculer coûts et profits
    const productionCost = this.calculateProductionCost(ingredients, suggestedQuantity);
    const revenue = suggestedQuantity * (product.SalePrice || 0);
    const profit = revenue - productionCost;
    const roi = productionCost > 0 ? (profit / productionCost) * 100 : 0;

    const reasoning = this.generateProductionReasoning(
      currentStock,
      daysOfStock,
      avgDailySales,
      forecastedDemand,
      priority
    );

    const suggestion: ProductionSuggestion = {
      SuggestionId: `PROD-${Date.now()}-${product.ProductId}`,
      ProductId: product.ProductId,
      ProductName: product.Name,
      SuggestedQuantity: suggestedQuantity,
      Priority: priority,
      Reasoning: reasoning,
      CurrentStock: currentStock,
      AverageDailySales: avgDailySales,
      DaysOfStockRemaining: daysOfStock,
      ForecastedDemand30Days: forecastedDemand,
      OptimalBatchSize: Math.round(avgDailySales * 30), // 30 jours de stock
      EstimatedProductionCost: productionCost,
      EstimatedRevenue: revenue,
      EstimatedProfit: profit,
      ROI: roi,
      RequiredIngredients: requiredIngredients,
      Status: 'pending',
      GeneratedAt: new Date().toISOString(),
      WorkspaceId: workspaceId,
    };

    return suggestion;
  }

  // ==========================================================================
  // SUGGESTIONS DE TRANSFERTS STOCKS
  // ==========================================================================

  /**
   * Générer suggestions de transferts entre emplacements
   */
  async generateStockTransferSuggestions(
    workspaceId: string
  ): Promise<StockTransferSuggestion[]> {
    const suggestions: StockTransferSuggestion[] = [];

    // 1. Récupérer tous les emplacements
    const locations = await this.getLocations(workspaceId);

    if (locations.length < 2) {
      return []; // Besoin d'au moins 2 emplacements
    }

    // 2. Récupérer produits
    const products = await this.getActiveProducts(workspaceId);

    for (const product of products) {
      // 3. Pour chaque produit, analyser stocks par emplacement
      const stockByLocation: Record<string, {
        stock: number;
        avgDailySales: number;
        daysOfStock: number;
        forecast30Days: number;
      }> = {};

      for (const location of locations) {
        const stock = await this.getCurrentStockByLocation(
          workspaceId,
          product.ProductId,
          location.LocationId
        );

        const sales = await this.getHistoricalSales(
          workspaceId,
          product.ProductId,
          30,
          location.LocationId
        );

        const avgDailySales = this.calculateAverageDailySales(sales);
        const daysOfStock = avgDailySales > 0 ? stock / avgDailySales : 999;

        const forecast = await this.generateSalesForecast(
          workspaceId,
          product.ProductId,
          '30_days',
          location.LocationId
        );

        stockByLocation[location.LocationId] = {
          stock,
          avgDailySales,
          daysOfStock,
          forecast30Days: forecast.PredictedQuantity,
        };
      }

      // 4. Identifier déséquilibres
      const locationIds = Object.keys(stockByLocation);

      for (let i = 0; i < locationIds.length; i++) {
        for (let j = i + 1; j < locationIds.length; j++) {
          const fromId = locationIds[i];
          const toId = locationIds[j];

          const fromData = stockByLocation[fromId];
          const toData = stockByLocation[toId];

          // Si FROM a excès ET TO a déficit
          if (fromData.daysOfStock > 30 && toData.daysOfStock < 7) {
            const fromLocation = locations.find(l => l.LocationId === fromId);
            const toLocation = locations.find(l => l.LocationId === toId);

            if (fromLocation && toLocation) {
              // Quantité = demande prévue TO - stock actuel TO
              const suggestedQuantity = Math.min(
                Math.round(toData.forecast30Days - toData.stock),
                Math.round(fromData.stock - fromData.forecast30Days) // Max disponible FROM
              );

              if (suggestedQuantity > 0) {
                const suggestion = this.createTransferSuggestion(
                  workspaceId,
                  product,
                  fromLocation,
                  toLocation,
                  suggestedQuantity,
                  fromData,
                  toData
                );

                suggestions.push(suggestion);
              }
            }
          }
        }
      }
    }

    // Trier par priorité
    return suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.Priority] - priorityOrder[a.Priority];
    });
  }

  /**
   * Créer suggestion de transfert
   */
  private createTransferSuggestion(
    workspaceId: string,
    product: any,
    fromLocation: any,
    toLocation: any,
    suggestedQuantity: number,
    fromData: any,
    toData: any
  ): StockTransferSuggestion {
    const priority = toData.daysOfStock < 3 ? 'urgent' :
                     toData.daysOfStock < 5 ? 'high' :
                     toData.daysOfStock < 7 ? 'medium' : 'low';

    const reasoning = `${toLocation.Name} risque une rupture de stock (${toData.daysOfStock.toFixed(1)} jours restants), ` +
                      `alors que ${fromLocation.Name} a un excédent (${fromData.daysOfStock.toFixed(1)} jours).`;

    const estimatedImpact = `Évite une rupture de stock et optimise la répartition. ` +
                           `Peut générer ~${Math.round(suggestedQuantity * toData.avgDailySales * (product.SalePrice || 0))} F CFA de CA supplémentaire.`;

    return {
      SuggestionId: `TRANS-${Date.now()}-${product.ProductId}`,
      ProductId: product.ProductId,
      ProductName: product.Name,
      FromLocationId: fromLocation.LocationId,
      FromLocationName: fromLocation.Name,
      ToLocationId: toLocation.LocationId,
      ToLocationName: toLocation.Name,
      SuggestedQuantity: suggestedQuantity,
      FromCurrentStock: fromData.stock,
      FromDaysOfStock: fromData.daysOfStock,
      ToCurrentStock: toData.stock,
      ToDaysOfStock: toData.daysOfStock,
      Reasoning: reasoning,
      Priority: priority,
      EstimatedImpact: estimatedImpact,
      FromForecastedDemand: fromData.forecast30Days,
      ToForecastedDemand: toData.forecast30Days,
      Status: 'pending',
      GeneratedAt: new Date().toISOString(),
      WorkspaceId: workspaceId,
    };
  }

  // ==========================================================================
  // AI INSIGHTS GÉNÉRIQUES
  // ==========================================================================

  /**
   * Analyser un écran et générer insights contextuels
   */
  async analyzeScreen(
    workspaceId: string,
    screenType: 'sales' | 'stock' | 'production' | 'finance' | 'customer' | 'hr',
    screenData: Record<string, any>
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    switch (screenType) {
      case 'sales':
        insights.push(...await this.analyzeSalesData(workspaceId, screenData));
        break;
      case 'stock':
        insights.push(...await this.analyzeStockData(workspaceId, screenData));
        break;
      case 'production':
        insights.push(...await this.analyzeProductionData(workspaceId, screenData));
        break;
      case 'customer':
        insights.push(...await this.analyzeCustomerData(workspaceId, screenData));
        break;
      default:
        break;
    }

    return insights;
  }

  /**
   * Analyser données de ventes
   */
  private async analyzeSalesData(
    workspaceId: string,
    screenData: Record<string, any>
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // Exemple: Détection baisse de ventes
    if (screenData.salesTrend === 'down' && screenData.trendPercentage < -15) {
      insights.push({
        InsightId: `INS-${Date.now()}-sales-down`,
        Type: 'alert',
        Category: 'sales',
        Title: '⚠️ Baisse significative des ventes',
        Description: `Les ventes ont chuté de ${Math.abs(screenData.trendPercentage)}% par rapport au mois dernier.`,
        Impact: screenData.trendPercentage < -30 ? 'critical' : 'high',
        RelatedData: screenData,
        RecommendedActions: [
          'Analyser les produits les plus impactés',
          'Lancer une promotion ciblée',
          'Contacter les clients inactifs',
          'Vérifier la concurrence',
        ],
        EstimatedImpactPercentage: Math.abs(screenData.trendPercentage),
        Status: 'new',
        GeneratedAt: new Date().toISOString(),
        WorkspaceId: workspaceId,
      });
    }

    // Exemple: Opportunité de croissance
    if (screenData.salesTrend === 'up' && screenData.trendPercentage > 20) {
      insights.push({
        InsightId: `INS-${Date.now()}-sales-up`,
        Type: 'opportunity',
        Category: 'sales',
        Title: '🚀 Forte croissance des ventes',
        Description: `Les ventes ont augmenté de ${screenData.trendPercentage}% ! Profitez de cette dynamique.`,
        Impact: 'high',
        RelatedData: screenData,
        RecommendedActions: [
          'Augmenter les stocks des produits phares',
          'Planifier des productions supplémentaires',
          'Recruter si besoin pour gérer la demande',
        ],
        EstimatedImpactPercentage: screenData.trendPercentage,
        Status: 'new',
        GeneratedAt: new Date().toISOString(),
        WorkspaceId: workspaceId,
      });
    }

    return insights;
  }

  /**
   * Analyser données de stock
   */
  private async analyzeStockData(
    workspaceId: string,
    screenData: Record<string, any>
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // Exemple: Produits en rupture imminente
    if (screenData.lowStockProducts && screenData.lowStockProducts.length > 0) {
      const urgentCount = screenData.lowStockProducts.filter(
        (p: any) => p.daysOfStock < 3
      ).length;

      if (urgentCount > 0) {
        insights.push({
          InsightId: `INS-${Date.now()}-stock-low`,
          Type: 'alert',
          Category: 'stock',
          Title: `⚠️ ${urgentCount} produit(s) en rupture imminente`,
          Description: `Risque de rupture de stock dans les 3 prochains jours.`,
          Impact: 'critical',
          RelatedData: { products: screenData.lowStockProducts.slice(0, 5) },
          RecommendedActions: [
            'Lancer des ordres de production urgents',
            'Commander aux fournisseurs en express',
            'Transférer stocks d\'autres emplacements',
          ],
          Status: 'new',
          GeneratedAt: new Date().toISOString(),
          WorkspaceId: workspaceId,
        });
      }
    }

    return insights;
  }

  /**
   * Analyser données de production
   */
  private async analyzeProductionData(
    workspaceId: string,
    screenData: Record<string, any>
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // Exemple: Efficacité production
    if (screenData.productionEfficiency && screenData.productionEfficiency < 70) {
      insights.push({
        InsightId: `INS-${Date.now()}-prod-efficiency`,
        Type: 'optimization',
        Category: 'production',
        Title: '⚙️ Efficacité de production à améliorer',
        Description: `L'efficacité est de ${screenData.productionEfficiency}%. Objectif: >80%.`,
        Impact: 'medium',
        RelatedData: screenData,
        RecommendedActions: [
          'Identifier les goulots d\'étranglement',
          'Former les équipes',
          'Vérifier l\'état des équipements',
          'Optimiser les processus',
        ],
        EstimatedImpactPercentage: 80 - screenData.productionEfficiency,
        Status: 'new',
        GeneratedAt: new Date().toISOString(),
        WorkspaceId: workspaceId,
      });
    }

    return insights;
  }

  /**
   * Analyser données clients
   */
  private async analyzeCustomerData(
    workspaceId: string,
    screenData: Record<string, any>
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // Exemple: Clients à risque de churn
    if (screenData.atRiskCustomers && screenData.atRiskCustomers.length > 0) {
      insights.push({
        InsightId: `INS-${Date.now()}-customer-churn`,
        Type: 'risk',
        Category: 'customer',
        Title: `⚠️ ${screenData.atRiskCustomers.length} clients à risque`,
        Description: `Ces clients n'ont pas acheté depuis plus de 90 jours.`,
        Impact: 'high',
        RelatedData: { customers: screenData.atRiskCustomers.slice(0, 10) },
        RecommendedActions: [
          'Envoyer une promotion personnalisée',
          'Appeler les clients VIP',
          'Enquête de satisfaction',
        ],
        Status: 'new',
        GeneratedAt: new Date().toISOString(),
        WorkspaceId: workspaceId,
      });
    }

    return insights;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getHistoricalSales(
    workspaceId: string,
    productId: string,
    days: number,
    locationId?: string
  ): Promise<any[]> {
    // TODO: Implémenter récupération ventes depuis Airtable
    // Pour l'instant, retourne données simulées
    return [];
  }

  private calculateAverageDailySales(sales: any[]): number {
    if (sales.length === 0) return 0;
    const totalQty = sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    return totalQty / sales.length;
  }

  private calculateTrend(sales: any[]): { direction: 'up' | 'down' | 'stable'; percentage: number } {
    if (sales.length < 2) return { direction: 'stable', percentage: 0 };

    const mid = Math.floor(sales.length / 2);
    const firstHalf = sales.slice(0, mid);
    const secondHalf = sales.slice(mid);

    const firstAvg = this.calculateAverageDailySales(firstHalf);
    const secondAvg = this.calculateAverageDailySales(secondHalf);

    if (firstAvg === 0) return { direction: 'stable', percentage: 0 };

    const percentage = ((secondAvg - firstAvg) / firstAvg) * 100;

    return {
      direction: percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable',
      percentage,
    };
  }

  private detectSeasonality(sales: any[]): number {
    // Détection saisonnalité simplifiée
    // Retourne entre -1 (forte baisse saisonnière) et 1 (forte hausse saisonnière)
    return 0;
  }

  private calculateVolatility(sales: any[]): number {
    if (sales.length < 2) return 0;

    const avg = this.calculateAverageDailySales(sales);
    const variance = sales.reduce((sum, s) => {
      const diff = (s.quantity || 0) - avg;
      return sum + diff * diff;
    }, 0) / sales.length;

    const stdDev = Math.sqrt(variance);

    // Normaliser entre 0-100
    return Math.min(100, (stdDev / avg) * 100);
  }

  private calculateForecastConfidence(
    dataPoints: number,
    volatility: number,
    trendStrength: number
  ): number {
    let score = 50;

    // Plus de données = plus de confiance
    if (dataPoints > 90) score += 30;
    else if (dataPoints > 30) score += 20;
    else if (dataPoints > 7) score += 10;

    // Moins de volatilité = plus de confiance
    if (volatility < 20) score += 20;
    else if (volatility < 40) score += 10;
    else if (volatility > 60) score -= 10;

    // Tendance claire = plus de confiance
    if (Math.abs(trendStrength) > 20) score += 10;

    return Math.min(Math.max(score, 0), 100);
  }

  private getConfidenceLevel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 85) return 'very_high';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 30) return 'low';
    return 'very_low';
  }

  private getPeriodDays(period: '7_days' | '30_days' | '90_days'): number {
    switch (period) {
      case '7_days': return 7;
      case '30_days': return 30;
      case '90_days': return 90;
    }
  }

  private generateLowConfidenceForecast(
    workspaceId: string,
    productId: string,
    period: '7_days' | '30_days' | '90_days',
    locationId?: string
  ): SalesForecast {
    return {
      ForecastId: `FOR-${Date.now()}-${productId}`,
      ProductId: productId,
      LocationId: locationId,
      Period: period,
      PredictedQuantity: 0,
      PredictedRevenue: 0,
      ConfidenceLevel: 'very_low',
      ConfidenceScore: 10,
      HistoricalDataPoints: 0,
      AverageDailySales: 0,
      TrendDirection: 'stable',
      TrendPercentage: 0,
      VolatilityScore: 0,
      GeneratedAt: new Date().toISOString(),
      ValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      WorkspaceId: workspaceId,
    };
  }

  private async getTopSellingProducts(workspaceId: string, limit: number): Promise<any[]> {
    // TODO: Implémenter récupération depuis Airtable
    return [];
  }

  private async getManufacturedProducts(workspaceId: string): Promise<any[]> {
    // TODO: Implémenter récupération depuis Airtable
    return [];
  }

  private async getCurrentStock(workspaceId: string, productId: string): Promise<number> {
    // TODO: Implémenter récupération depuis Airtable
    return 0;
  }

  private async getCurrentStockByLocation(
    workspaceId: string,
    productId: string,
    locationId: string
  ): Promise<number> {
    // TODO: Implémenter récupération depuis Airtable
    return 0;
  }

  private async getAveragePrice(workspaceId: string, productId: string): Promise<number> {
    // TODO: Implémenter récupération depuis Airtable
    return 1000;
  }

  private calculateProductionPriority(
    daysOfStock: number,
    avgDailySales: number
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (daysOfStock < 2) return 'urgent';
    if (daysOfStock < 5) return 'high';
    if (daysOfStock < 7) return 'medium';
    return 'low';
  }

  private async getProductIngredients(workspaceId: string, productId: string): Promise<any[]> {
    // TODO: Implémenter récupération BOM depuis Airtable
    return [];
  }

  private calculateProductionCost(ingredients: any[], quantity: number): number {
    return ingredients.reduce((sum, ing) => {
      return sum + (ing.unitCost || 0) * ing.quantityPerUnit * quantity;
    }, 0);
  }

  private generateProductionReasoning(
    currentStock: number,
    daysOfStock: number,
    avgDailySales: number,
    forecastedDemand: number,
    priority: string
  ): string {
    let reasoning = `Stock actuel: ${currentStock} unités (${daysOfStock.toFixed(1)} jours). `;
    reasoning += `Ventes moyennes: ${avgDailySales.toFixed(1)} unités/jour. `;
    reasoning += `Demande prévue (30j): ${forecastedDemand} unités. `;

    if (priority === 'urgent') {
      reasoning += '⚠️ URGENT: Risque de rupture imminente.';
    } else if (priority === 'high') {
      reasoning += '⚡ Priorité haute: Stock faible.';
    } else {
      reasoning += 'Réapprovisionnement recommandé.';
    }

    return reasoning;
  }

  private async getLocations(workspaceId: string): Promise<any[]> {
    // TODO: Implémenter récupération depuis Airtable
    return [];
  }

  private async getActiveProducts(workspaceId: string): Promise<any[]> {
    // TODO: Implémenter récupération depuis Airtable
    return [];
  }
}

export const predictiveInsightsService = new PredictiveInsightsService();
