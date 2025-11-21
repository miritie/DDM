/**
 * Service - Gestion des Seuils de Validation
 * Configuration et récupération des seuils pour le workflow de validation hiérarchique
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';
import { ValidatableEntityType, ValidationThreshold } from './validation-workflow-service';

const postgresClient = getPostgresClient();

export interface CreateThresholdInput {
  workspaceId: string;
  entityType: ValidatableEntityType;
  category?: string;
  level1Threshold: number;
  level2Threshold: number;
  level3Threshold: number;
  requireAllLevels?: boolean;
  autoApproveBelow?: number;
}

export interface UpdateThresholdInput {
  level1Threshold?: number;
  level2Threshold?: number;
  level3Threshold?: number;
  requireAllLevels?: boolean;
  autoApproveBelow?: number;
}

export class ValidationThresholdService {
  /**
   * Cree une configuration de seuils
   */
  async createThreshold(input: CreateThresholdInput): Promise<ValidationThreshold> {
    const {
      workspaceId,
      entityType,
      category,
      level1Threshold,
      level2Threshold,
      level3Threshold,
      requireAllLevels = false,
      autoApproveBelow = 0,
    } = input;

    // Valider la logique des seuils
    this.validateThresholds(level1Threshold, level2Threshold, level3Threshold, autoApproveBelow);

    // Verifier si une config existe deja pour ce type et categorie
    const existing = await this.getThreshold(workspaceId, entityType, category);
    if (existing) {
      throw new Error(
        `Une configuration existe deja pour ${entityType}${category ? ` (${category})` : ''}`
      );
    }

    const threshold: Partial<ValidationThreshold> = {
      ThresholdId: uuidv4(),
      WorkspaceId: workspaceId,
      EntityType: entityType,
      Category: category,
      Level1Threshold: level1Threshold,
      Level2Threshold: level2Threshold,
      Level3Threshold: level3Threshold,
      RequireAllLevels: requireAllLevels,
      AutoApproveBelow: autoApproveBelow,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<ValidationThreshold>(
      'validation_thresholds',
      threshold
    );
    return created;
  }

  /**
   * Met a jour une configuration de seuils
   */
  async updateThreshold(
    thresholdId: string,
    updates: UpdateThresholdInput
  ): Promise<ValidationThreshold> {
    // Recuperer le seuil existant
    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: `threshold_id = '${thresholdId}'`,
    });

    if (thresholds.length === 0) {
      throw new Error('Configuration de seuils non trouvee');
    }

    const existing = thresholds[0];

    // Calculer les nouvelles valeurs
    const newLevel1 = updates.level1Threshold ?? existing.Level1Threshold;
    const newLevel2 = updates.level2Threshold ?? existing.Level2Threshold;
    const newLevel3 = updates.level3Threshold ?? existing.Level3Threshold;
    const newAutoApprove = updates.autoApproveBelow ?? existing.AutoApproveBelow;

    // Valider la logique
    this.validateThresholds(newLevel1, newLevel2, newLevel3, newAutoApprove);

    // Preparer les mises a jour avec les noms de champs PascalCase
    const updateData: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };
    if (updates.level1Threshold !== undefined) updateData.Level1Threshold = updates.level1Threshold;
    if (updates.level2Threshold !== undefined) updateData.Level2Threshold = updates.level2Threshold;
    if (updates.level3Threshold !== undefined) updateData.Level3Threshold = updates.level3Threshold;
    if (updates.requireAllLevels !== undefined) updateData.RequireAllLevels = updates.requireAllLevels;
    if (updates.autoApproveBelow !== undefined) updateData.AutoApproveBelow = updates.autoApproveBelow;

    // Mettre a jour
    const recordId = existing.id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<ValidationThreshold>(
      'validation_thresholds',
      recordId,
      updateData
    );
    return updated;
  }

  /**
   * Recupere une configuration de seuils
   */
  async getThreshold(
    workspaceId: string,
    entityType: ValidatableEntityType,
    category?: string
  ): Promise<ValidationThreshold | null> {
    let filterFormula = `workspace_id = '${workspaceId}' AND entity_type = '${entityType}'`;

    if (category) {
      filterFormula += ` AND category = '${category}'`;
    } else {
      filterFormula += ` AND category IS NULL`;
    }

    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: filterFormula,
    });

    return thresholds.length > 0 ? thresholds[0] : null;
  }

  /**
   * Recupere toutes les configurations pour un workspace
   */
  async getAllThresholds(workspaceId: string): Promise<ValidationThreshold[]> {
    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: `workspace_id = '${workspaceId}'`,
      sort: [
        { field: 'EntityType', direction: 'asc' },
        { field: 'Category', direction: 'asc' },
      ],
    });

    return thresholds;
  }

  /**
   * Recupere les seuils par type d'entite (toutes categories)
   */
  async getThresholdsByEntityType(
    workspaceId: string,
    entityType: ValidatableEntityType
  ): Promise<ValidationThreshold[]> {
    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: `workspace_id = '${workspaceId}' AND entity_type = '${entityType}'`,
      sort: [{ field: 'Category', direction: 'asc' }],
    });

    return thresholds;
  }

  /**
   * Supprime une configuration de seuils
   */
  async deleteThreshold(thresholdId: string): Promise<void> {
    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: `threshold_id = '${thresholdId}'`,
    });

    if (thresholds.length === 0) {
      throw new Error('Configuration de seuils non trouvee');
    }

    const threshold = thresholds[0];
    const recordId = threshold.id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    await postgresClient.delete('validation_thresholds', recordId);
  }

  /**
   * Recupere ou cree une configuration par defaut
   */
  async getOrCreateDefaultThreshold(
    workspaceId: string,
    entityType: ValidatableEntityType
  ): Promise<ValidationThreshold> {
    // Chercher config existante
    const existing = await this.getThreshold(workspaceId, entityType);
    if (existing) {
      return existing;
    }

    // Creer config par defaut selon le type d'entite
    const defaults = this.getDefaultThresholds(entityType);

    return await this.createThreshold({
      workspaceId,
      entityType,
      ...defaults,
    });
  }

  /**
   * Clone une configuration pour une nouvelle categorie
   */
  async cloneThreshold(
    thresholdId: string,
    newCategory: string
  ): Promise<ValidationThreshold> {
    // Recuperer le seuil source
    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: `threshold_id = '${thresholdId}'`,
    });

    if (thresholds.length === 0) {
      throw new Error('Configuration de seuils source non trouvee');
    }

    const source = thresholds[0];

    // Creer nouvelle config avec les memes valeurs
    return await this.createThreshold({
      workspaceId: source.WorkspaceId,
      entityType: source.EntityType,
      category: newCategory,
      level1Threshold: source.Level1Threshold,
      level2Threshold: source.Level2Threshold,
      level3Threshold: source.Level3Threshold,
      requireAllLevels: source.RequireAllLevels,
      autoApproveBelow: source.AutoApproveBelow,
    });
  }

  /**
   * Valide la coherence des seuils
   */
  async validateWorkspaceThresholds(workspaceId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const thresholds = await this.getAllThresholds(workspaceId);
    const errors: string[] = [];

    thresholds.forEach((threshold) => {
      try {
        this.validateThresholds(
          threshold.Level1Threshold,
          threshold.Level2Threshold,
          threshold.Level3Threshold,
          threshold.AutoApproveBelow
        );
      } catch (error) {
        errors.push(
          `${threshold.EntityType}${threshold.Category ? ` (${threshold.Category})` : ''}: ${
            error instanceof Error ? error.message : 'Erreur inconnue'
          }`
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recupere les statistiques d'utilisation des seuils
   */
  async getThresholdUsageStats(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    byEntityType: Record<
      ValidatableEntityType,
      {
        autoApproved: number;
        level1: number;
        level2: number;
        level3: number;
        levelOwner: number;
      }
    >;
    totalRequests: number;
    autoApprovalRate: number;
  }> {
    // Recuperer toutes les demandes de validation dans la periode
    const requests = await postgresClient.list<any>('validation_requests', {
      filterByFormula: `workspace_id = '${workspaceId}' AND requested_at >= '${startDate}' AND requested_at <= '${endDate}'`,
    });

    const byEntityType: Record<string, any> = {};
    let totalRequests = 0;
    let autoApproved = 0;

    requests.forEach((req) => {
      totalRequests++;

      if (!byEntityType[req.entity_type]) {
        byEntityType[req.entity_type] = {
          autoApproved: 0,
          level1: 0,
          level2: 0,
          level3: 0,
          levelOwner: 0,
        };
      }

      if (req.status === 'auto_approved') {
        byEntityType[req.entity_type].autoApproved++;
        autoApproved++;
      } else {
        const level = req.required_level.replace('level_', '');
        if (level === 'owner') {
          byEntityType[req.entity_type].levelOwner++;
        } else {
          byEntityType[req.entity_type][`level${level}`]++;
        }
      }
    });

    return {
      byEntityType: byEntityType as any,
      totalRequests,
      autoApprovalRate: totalRequests > 0 ? (autoApproved / totalRequests) * 100 : 0,
    };
  }

  // ========== Methodes privees ==========

  /**
   * Valide la logique des seuils
   */
  private validateThresholds(
    level1: number,
    level2: number,
    level3: number,
    autoApprove: number
  ): void {
    // Les seuils doivent etre positifs
    if (level1 < 0 || level2 < 0 || level3 < 0 || autoApprove < 0) {
      throw new Error('Les seuils doivent etre des nombres positifs');
    }

    // Les seuils doivent etre croissants: Level1 < Level2 < Level3
    if (level1 >= level2 || level2 >= level3) {
      throw new Error(
        'Les seuils doivent etre croissants: Niveau 1 < Niveau 2 < Niveau 3'
      );
    }

    // AutoApprove doit etre inferieur a Level1
    if (autoApprove >= level1) {
      throw new Error('Le seuil d\'auto-approbation doit etre inferieur au seuil Niveau 1');
    }
  }

  /**
   * Retourne les seuils par defaut selon le type d'entite
   */
  private getDefaultThresholds(entityType: ValidatableEntityType): {
    level1Threshold: number;
    level2Threshold: number;
    level3Threshold: number;
    requireAllLevels: boolean;
    autoApproveBelow: number;
  } {
    // Seuils par defaut en FCFA selon le type d'entite
    const defaults: Record<
      ValidatableEntityType,
      {
        level1Threshold: number;
        level2Threshold: number;
        level3Threshold: number;
        requireAllLevels: boolean;
        autoApproveBelow: number;
      }
    > = {
      expense: {
        level1Threshold: 50000, // Manager: < 50k
        level2Threshold: 200000, // Directeur: < 200k
        level3Threshold: 1000000, // DG: < 1M
        requireAllLevels: false,
        autoApproveBelow: 10000, // Auto: < 10k
      },
      purchase_order: {
        level1Threshold: 100000,
        level2Threshold: 500000,
        level3Threshold: 2000000,
        requireAllLevels: false,
        autoApproveBelow: 25000,
      },
      production_order: {
        level1Threshold: 200000,
        level2Threshold: 1000000,
        level3Threshold: 5000000,
        requireAllLevels: true, // Ordres de production: tous niveaux requis
        autoApproveBelow: 0, // Pas d'auto-approbation
      },
      advance: {
        level1Threshold: 30000,
        level2Threshold: 100000,
        level3Threshold: 500000,
        requireAllLevels: false,
        autoApproveBelow: 5000,
      },
      debt: {
        level1Threshold: 50000,
        level2Threshold: 200000,
        level3Threshold: 1000000,
        requireAllLevels: false,
        autoApproveBelow: 0, // Dettes: toujours validation manuelle
      },
      leave: {
        level1Threshold: 3, // Jours de conge
        level2Threshold: 7,
        level3Threshold: 15,
        requireAllLevels: false,
        autoApproveBelow: 1, // 1 jour: auto
      },
      transfer: {
        level1Threshold: 100000,
        level2Threshold: 500000,
        level3Threshold: 2000000,
        requireAllLevels: true, // Transferts: tous niveaux requis
        autoApproveBelow: 0,
      },
      price_adjustment: {
        level1Threshold: 5, // Pourcentage d'ajustement
        level2Threshold: 15,
        level3Threshold: 30,
        requireAllLevels: false,
        autoApproveBelow: 2, // < 2%: auto
      },
      credit_approval: {
        level1Threshold: 100000,
        level2Threshold: 500000,
        level3Threshold: 2000000,
        requireAllLevels: true, // Credits: tous niveaux requis
        autoApproveBelow: 0,
      },
    };

    return defaults[entityType];
  }
}
