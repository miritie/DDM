/**
 * Service - Workflow de Validation Hiérarchique
 * Gestion complète des approbations multi-niveaux avec géolocalisation et traçabilité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

// Types d'entités validables
export type ValidatableEntityType =
  | 'expense'
  | 'purchase_order'
  | 'production_order'
  | 'advance'
  | 'debt'
  | 'leave'
  | 'transfer'
  | 'price_adjustment'
  | 'credit_approval';

// Statuts de validation
export type ValidationStatus =
  | 'pending' // En attente
  | 'approved' // Approuvée
  | 'rejected' // Rejetée
  | 'escalated' // Escaladée au niveau supérieur
  | 'auto_approved'; // Auto-approuvée (règles IA)

// Niveau hiérarchique
export type ValidationLevel =
  | 'level_1' // Manager direct
  | 'level_2' // Directeur département
  | 'level_3' // Direction générale
  | 'level_owner'; // Propriétaire/PDG

export interface ValidationRequest {
  ValidationRequestId: string;
  WorkspaceId: string;

  // Entité concernée
  EntityType: ValidatableEntityType;
  EntityId: string;
  EntityData: Record<string, any>; // Snapshot des données au moment de la demande

  // Demandeur
  RequestedBy: string; // EmployeeId
  RequestedAt: string;
  RequestReason?: string;

  // Workflow
  CurrentLevel: ValidationLevel;
  RequiredLevel: ValidationLevel; // Niveau maximum requis
  Status: ValidationStatus;

  // Montant (pour seuils)
  Amount?: number;

  // Validations effectuées
  Validations: Validation[];

  // Escalade
  EscalatedAt?: string;
  EscalatedReason?: string;

  // Métadonnées
  Priority: 'low' | 'medium' | 'high' | 'urgent';
  ExpiresAt?: string; // Date limite de validation
  Tags?: string[];

  CreatedAt: string;
  UpdatedAt: string;
}

export interface Validation {
  ValidationId: string;
  ValidatedBy: string; // EmployeeId
  ValidatedAt: string;
  Status: 'approved' | 'rejected';
  Level: ValidationLevel;
  Comment?: string;

  // Traçabilité
  IpAddress?: string;
  UserAgent?: string;
  Geolocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string; // Adresse géolocalisée (reverse geocoding)
  };

  // Signature (optionnel)
  SignatureData?: string; // Base64 de la signature si capturée
}

export interface ValidationThreshold {
  ThresholdId: string;
  WorkspaceId: string;
  EntityType: ValidatableEntityType;
  Category?: string; // Catégorie de dépense, type de commande, etc.

  // Seuils (montants en FCFA)
  Level1Threshold: number; // En dessous: auto-approve ou manager
  Level2Threshold: number; // En dessous: directeur
  Level3Threshold: number; // En dessous: DG
  // Au-dessus Level3: Propriétaire

  // Configuration
  RequireAllLevels: boolean; // Si true, chaque niveau doit valider même si seuil dépassé
  AutoApproveBelow: number; // Montant en dessous duquel c'est auto-approuvé

  CreatedAt: string;
  UpdatedAt: string;
}

export class ValidationWorkflowService {
  /**
   * Crée une demande de validation
   */
  async createValidationRequest(input: {
    workspaceId: string;
    entityType: ValidatableEntityType;
    entityId: string;
    entityData: Record<string, any>;
    requestedBy: string;
    amount?: number;
    requestReason?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
  }): Promise<ValidationRequest> {
    const {
      workspaceId,
      entityType,
      entityId,
      entityData,
      requestedBy,
      amount,
      requestReason,
      priority = 'medium',
      tags = [],
    } = input;

    // Déterminer le niveau requis selon les seuils
    const requiredLevel = await this.getRequiredLevel(workspaceId, entityType, amount);

    // Vérifier si auto-approbation possible
    const canAutoApprove = await this.canAutoApprove(workspaceId, entityType, amount);

    const validationRequest: Partial<ValidationRequest> = {
      ValidationRequestId: uuidv4(),
      WorkspaceId: workspaceId,
      EntityType: entityType,
      EntityId: entityId,
      EntityData: entityData,
      RequestedBy: requestedBy,
      RequestedAt: new Date().toISOString(),
      RequestReason: requestReason,
      CurrentLevel: 'level_1',
      RequiredLevel: requiredLevel,
      Status: canAutoApprove ? 'auto_approved' : 'pending',
      Amount: amount,
      Validations: [],
      Priority: priority,
      Tags: tags,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    // Si auto-approuvé, ajouter validation auto
    if (canAutoApprove) {
      validationRequest.Validations = [
        {
          ValidationId: uuidv4(),
          ValidatedBy: 'SYSTEM',
          ValidatedAt: new Date().toISOString(),
          Status: 'approved',
          Level: 'level_1',
          Comment: 'Auto-approuvé selon les règles configurées',
        },
      ];
    }

    const created = await airtableClient.create<ValidationRequest>(
      'ValidationRequest',
      validationRequest
    );
    if (!created) {
      throw new Error('Failed to create validation request - Airtable not configured');
    }
    return created;
  }

  /**
   * Valide ou rejette une demande
   */
  async processValidation(input: {
    validationRequestId: string;
    validatedBy: string;
    status: 'approved' | 'rejected';
    comment?: string;
    geolocation?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    ipAddress?: string;
    userAgent?: string;
    signatureData?: string;
  }): Promise<ValidationRequest> {
    const {
      validationRequestId,
      validatedBy,
      status,
      comment,
      geolocation,
      ipAddress,
      userAgent,
      signatureData,
    } = input;

    // Récupérer la demande
    const requests = await airtableClient.list<ValidationRequest>('ValidationRequest', {
      filterByFormula: `{ValidationRequestId} = '${validationRequestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande de validation non trouvée');
    }

    const request = requests[0];

    // Vérifier que la demande est en attente
    if (request.Status !== 'pending' && request.Status !== 'escalated') {
      throw new Error('Cette demande a déjà été traitée');
    }

    // Créer la validation
    const validation: Validation = {
      ValidationId: uuidv4(),
      ValidatedBy: validatedBy,
      ValidatedAt: new Date().toISOString(),
      Status: status,
      Level: request.CurrentLevel,
      Comment: comment,
      IpAddress: ipAddress,
      UserAgent: userAgent,
      Geolocation: geolocation,
      SignatureData: signatureData,
    };

    // Ajouter géolocalisation inversée si disponible
    if (geolocation) {
      validation.Geolocation!.address = await this.reverseGeocode(
        geolocation.latitude,
        geolocation.longitude
      );
    }

    const updatedValidations = [...request.Validations, validation];

    let newStatus: ValidationStatus;
    let newLevel: ValidationLevel = request.CurrentLevel;

    if (status === 'rejected') {
      // Rejet = fin du workflow
      newStatus = 'rejected';
    } else if (status === 'approved') {
      // Approuvé = vérifier si on doit escalader au niveau suivant
      if (this.shouldEscalate(request.CurrentLevel, request.RequiredLevel)) {
        newStatus = 'escalated';
        newLevel = this.getNextLevel(request.CurrentLevel);
      } else {
        newStatus = 'approved';
      }
    } else {
      newStatus = request.Status;
    }

    // Mettre à jour la demande
    const updated = await airtableClient.update<ValidationRequest>(
      'ValidationRequest',
      (request as any)._recordId,
      {
        Validations: updatedValidations,
        Status: newStatus,
        CurrentLevel: newLevel,
        EscalatedAt: newStatus === 'escalated' ? new Date().toISOString() : request.EscalatedAt,
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update validation request - Airtable not configured');
    }

    // Envoyer notifications selon le statut
    await this.sendNotifications(updated, validation);

    return updated;
  }

  /**
   * Récupère les demandes en attente pour un validateur
   */
  async getPendingValidations(
    workspaceId: string,
    validatorId: string,
    validatorLevel: ValidationLevel
  ): Promise<ValidationRequest[]> {
    // Récupérer toutes les demandes en attente pour ce niveau
    const requests = await airtableClient.list<ValidationRequest>('ValidationRequest', {
      filterByFormula: `AND(
        {WorkspaceId} = '${workspaceId}',
        OR({Status} = 'pending', {Status} = 'escalated'),
        {CurrentLevel} = '${validatorLevel}'
      )`,
      sort: [
        { field: 'Priority', direction: 'desc' },
        { field: 'RequestedAt', direction: 'asc' },
      ],
    });

    return requests;
  }

  /**
   * Récupère l'historique des validations pour une entité
   */
  async getValidationHistory(
    entityType: ValidatableEntityType,
    entityId: string
  ): Promise<ValidationRequest[]> {
    const requests = await airtableClient.list<ValidationRequest>('ValidationRequest', {
      filterByFormula: `AND({EntityType} = '${entityType}', {EntityId} = '${entityId}')`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });

    return requests;
  }

  /**
   * Récupère les statistiques de validation pour un validateur
   */
  async getValidatorStats(
    workspaceId: string,
    validatorId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalProcessed: number;
    approved: number;
    rejected: number;
    avgResponseTime: number; // en heures
    byEntityType: Record<ValidatableEntityType, { approved: number; rejected: number }>;
  }> {
    const requests = await airtableClient.list<ValidationRequest>('ValidationRequest', {
      filterByFormula: `AND(
        {WorkspaceId} = '${workspaceId}',
        {CreatedAt} >= '${startDate}',
        {CreatedAt} <= '${endDate}'
      )`,
    });

    const validatorValidations = requests.flatMap((req) =>
      req.Validations.filter((v) => v.ValidatedBy === validatorId)
    );

    const totalProcessed = validatorValidations.length;
    const approved = validatorValidations.filter((v) => v.Status === 'approved').length;
    const rejected = validatorValidations.filter((v) => v.Status === 'rejected').length;

    // Calcul temps moyen de réponse
    let totalResponseTime = 0;
    validatorValidations.forEach((validation) => {
      const correspondingRequest = requests.find((r) =>
        r.Validations.some((v) => v.ValidationId === validation.ValidationId)
      );
      if (correspondingRequest) {
        const requestTime = new Date(correspondingRequest.RequestedAt).getTime();
        const validationTime = new Date(validation.ValidatedAt).getTime();
        totalResponseTime += (validationTime - requestTime) / (1000 * 60 * 60); // heures
      }
    });

    const avgResponseTime = totalProcessed > 0 ? totalResponseTime / totalProcessed : 0;

    // Par type d'entité
    const byEntityType: Record<string, { approved: number; rejected: number }> = {};
    requests.forEach((req) => {
      const validation = req.Validations.find((v) => v.ValidatedBy === validatorId);
      if (validation) {
        if (!byEntityType[req.EntityType]) {
          byEntityType[req.EntityType] = { approved: 0, rejected: 0 };
        }
        if (validation.Status === 'approved') {
          byEntityType[req.EntityType].approved++;
        } else {
          byEntityType[req.EntityType].rejected++;
        }
      }
    });

    return {
      totalProcessed,
      approved,
      rejected,
      avgResponseTime,
      byEntityType: byEntityType as any,
    };
  }

  // ========== Méthodes privées ==========

  /**
   * Détermine le niveau de validation requis selon les seuils
   */
  private async getRequiredLevel(
    workspaceId: string,
    entityType: ValidatableEntityType,
    amount?: number
  ): Promise<ValidationLevel> {
    const thresholds = await this.getThresholds(workspaceId, entityType);

    if (!amount || !thresholds) {
      return 'level_1'; // Par défaut: manager
    }

    if (amount <= thresholds.Level1Threshold) {
      return 'level_1';
    } else if (amount <= thresholds.Level2Threshold) {
      return 'level_2';
    } else if (amount <= thresholds.Level3Threshold) {
      return 'level_3';
    } else {
      return 'level_owner';
    }
  }

  /**
   * Vérifie si auto-approbation possible
   */
  private async canAutoApprove(
    workspaceId: string,
    entityType: ValidatableEntityType,
    amount?: number
  ): Promise<boolean> {
    const thresholds = await this.getThresholds(workspaceId, entityType);

    if (!amount || !thresholds || !thresholds.AutoApproveBelow) {
      return false;
    }

    return amount < thresholds.AutoApproveBelow;
  }

  /**
   * Récupère les seuils configurés
   */
  private async getThresholds(
    workspaceId: string,
    entityType: ValidatableEntityType
  ): Promise<ValidationThreshold | null> {
    const thresholds = await airtableClient.list<ValidationThreshold>('ValidationThreshold', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {EntityType} = '${entityType}')`,
    });

    return thresholds.length > 0 ? thresholds[0] : null;
  }

  /**
   * Détermine si on doit escalader au niveau suivant
   */
  private shouldEscalate(currentLevel: ValidationLevel, requiredLevel: ValidationLevel): boolean {
    const levels: ValidationLevel[] = ['level_1', 'level_2', 'level_3', 'level_owner'];
    const currentIndex = levels.indexOf(currentLevel);
    const requiredIndex = levels.indexOf(requiredLevel);

    return currentIndex < requiredIndex;
  }

  /**
   * Retourne le niveau suivant
   */
  private getNextLevel(currentLevel: ValidationLevel): ValidationLevel {
    const mapping: Record<ValidationLevel, ValidationLevel> = {
      level_1: 'level_2',
      level_2: 'level_3',
      level_3: 'level_owner',
      level_owner: 'level_owner', // Maximum
    };

    return mapping[currentLevel];
  }

  /**
   * Géocodage inverse (latitude/longitude -> adresse)
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<string | undefined> {
    try {
      // Utiliser un service de géocodage inverse (ex: Nominatim, Google Maps, etc.)
      // Pour l'instant, retourner les coordonnées
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      // TODO: Intégrer avec API de géocodage
      // const response = await fetch(
      //   `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      // );
      // const data = await response.json();
      // return data.display_name;
    } catch (error) {
      console.error('Erreur géocodage inverse:', error);
      return undefined;
    }
  }

  /**
   * Envoie les notifications selon le statut
   */
  private async sendNotifications(
    request: ValidationRequest,
    validation: Validation
  ): Promise<void> {
    // TODO: Implémenter l'envoi de notifications
    // - Email
    // - WhatsApp
    // - Notification in-app
    // - SMS (optionnel)

    console.log('Notification à envoyer:', {
      requestId: request.ValidationRequestId,
      status: request.Status,
      validatedBy: validation.ValidatedBy,
    });
  }
}
