/**
 * Service - Workflow de Validation Hierarchique
 * Gestion complete des approbations multi-niveaux avec geolocalisation et tracabilite
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

// Types d'entites validables
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
  | 'approved' // Approuvee
  | 'rejected' // Rejetee
  | 'escalated' // Escaladee au niveau superieur
  | 'auto_approved'; // Auto-approuvee (regles IA)

// Niveau hierarchique
export type ValidationLevel =
  | 'level_1' // Manager direct
  | 'level_2' // Directeur departement
  | 'level_3' // Direction generale
  | 'level_owner'; // Proprietaire/PDG

export interface ValidationRequest {
  id?: string;
  ValidationRequestId: string;
  WorkspaceId: string;

  // Entite concernee
  EntityType: ValidatableEntityType;
  EntityId: string;
  EntityData: Record<string, any>; // Snapshot des donnees au moment de la demande

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

  // Validations effectuees
  Validations: Validation[];

  // Escalade
  EscalatedAt?: string;
  EscalatedReason?: string;

  // Metadonnees
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

  // Tracabilite
  IpAddress?: string;
  UserAgent?: string;
  Geolocation?: {
    Latitude: number;
    Longitude: number;
    Accuracy?: number;
    Address?: string; // Adresse geolocalisee (reverse geocoding)
  };

  // Signature (optionnel)
  SignatureData?: string; // Base64 de la signature si capturee
}

export interface ValidationThreshold {
  id?: string;
  ThresholdId: string;
  WorkspaceId: string;
  EntityType: ValidatableEntityType;
  Category?: string; // Categorie de depense, type de commande, etc.

  // Seuils (montants en FCFA)
  Level1Threshold: number; // En dessous: auto-approve ou manager
  Level2Threshold: number; // En dessous: directeur
  Level3Threshold: number; // En dessous: DG
  // Au-dessus Level3: Proprietaire

  // Configuration
  RequireAllLevels: boolean; // Si true, chaque niveau doit valider meme si seuil depasse
  AutoApproveBelow: number; // Montant en dessous duquel c'est auto-approuve

  CreatedAt: string;
  UpdatedAt: string;
}

export class ValidationWorkflowService {
  /**
   * Cree une demande de validation
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

    // Determiner le niveau requis selon les seuils
    const requiredLevel = await this.getRequiredLevel(workspaceId, entityType, amount);

    // Verifier si auto-approbation possible
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

    // Si auto-approuve, ajouter validation auto
    if (canAutoApprove) {
      validationRequest.Validations = [
        {
          ValidationId: uuidv4(),
          ValidatedBy: 'SYSTEM',
          ValidatedAt: new Date().toISOString(),
          Status: 'approved',
          Level: 'level_1',
          Comment: 'Auto-approuve selon les regles configurees',
        },
      ];
    }

    const created = await postgresClient.create<ValidationRequest>(
      'validation_requests',
      validationRequest
    );
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

    // Recuperer la demande
    const requests = await postgresClient.list<ValidationRequest>('validation_requests', {
      filterByFormula: `validation_request_id = '${validationRequestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande de validation non trouvee');
    }

    const request = requests[0];

    // Verifier que la demande est en attente
    if (request.Status !== 'pending' && request.Status !== 'escalated') {
      throw new Error('Cette demande a deja ete traitee');
    }

    // Creer la validation
    const validation: Validation = {
      ValidationId: uuidv4(),
      ValidatedBy: validatedBy,
      ValidatedAt: new Date().toISOString(),
      Status: status,
      Level: request.CurrentLevel,
      Comment: comment,
      IpAddress: ipAddress,
      UserAgent: userAgent,
      Geolocation: geolocation ? {
        Latitude: geolocation.latitude,
        Longitude: geolocation.longitude,
        Accuracy: geolocation.accuracy,
      } : undefined,
      SignatureData: signatureData,
    };

    // Ajouter geolocalisation inversee si disponible
    if (geolocation && validation.Geolocation) {
      validation.Geolocation.Address = await this.reverseGeocode(
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
      // Approuve = verifier si on doit escalader au niveau suivant
      if (this.shouldEscalate(request.CurrentLevel, request.RequiredLevel)) {
        newStatus = 'escalated';
        newLevel = this.getNextLevel(request.CurrentLevel);
      } else {
        newStatus = 'approved';
      }
    } else {
      newStatus = request.Status;
    }

    // Mettre a jour la demande
    const updated = await postgresClient.update<ValidationRequest>(
      'validation_requests',
      request.id!,
      {
        Validations: updatedValidations,
        Status: newStatus,
        CurrentLevel: newLevel,
        EscalatedAt: newStatus === 'escalated' ? new Date().toISOString() : request.EscalatedAt,
        UpdatedAt: new Date().toISOString(),
      }
    );

    // Envoyer notifications selon le statut
    await this.sendNotifications(updated, validation);

    return updated;
  }

  /**
   * Recupere les demandes en attente pour un validateur
   */
  async getPendingValidations(
    workspaceId: string,
    validatorId: string,
    validatorLevel: ValidationLevel
  ): Promise<ValidationRequest[]> {
    // Recuperer toutes les demandes en attente pour ce niveau
    const requests = await postgresClient.list<ValidationRequest>('validation_requests', {
      filterByFormula: `workspace_id = '${workspaceId}' AND (status = 'pending' OR status = 'escalated') AND current_level = '${validatorLevel}'`,
      sort: [
        { field: 'Priority', direction: 'desc' },
        { field: 'RequestedAt', direction: 'asc' },
      ],
    });

    return requests;
  }

  /**
   * Recupere l'historique des validations pour une entite
   */
  async getValidationHistory(
    entityType: ValidatableEntityType,
    entityId: string
  ): Promise<ValidationRequest[]> {
    const requests = await postgresClient.list<ValidationRequest>('validation_requests', {
      filterByFormula: `entity_type = '${entityType}' AND entity_id = '${entityId}'`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });

    return requests;
  }

  /**
   * Recupere les statistiques de validation pour un validateur
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
    const requests = await postgresClient.list<ValidationRequest>('validation_requests', {
      filterByFormula: `workspace_id = '${workspaceId}' AND created_at >= '${startDate}' AND created_at <= '${endDate}'`,
    });

    const validatorValidations = requests.flatMap((req) =>
      req.Validations.filter((v) => v.ValidatedBy === validatorId)
    );

    const totalProcessed = validatorValidations.length;
    const approved = validatorValidations.filter((v) => v.Status === 'approved').length;
    const rejected = validatorValidations.filter((v) => v.Status === 'rejected').length;

    // Calcul temps moyen de reponse
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

    // Par type d'entite
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

  // ========== Methodes privees ==========

  /**
   * Determine le niveau de validation requis selon les seuils
   */
  private async getRequiredLevel(
    workspaceId: string,
    entityType: ValidatableEntityType,
    amount?: number
  ): Promise<ValidationLevel> {
    const thresholds = await this.getThresholds(workspaceId, entityType);

    if (!amount || !thresholds) {
      return 'level_1'; // Par defaut: manager
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
   * Verifie si auto-approbation possible
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
   * Recupere les seuils configures
   */
  private async getThresholds(
    workspaceId: string,
    entityType: ValidatableEntityType
  ): Promise<ValidationThreshold | null> {
    const thresholds = await postgresClient.list<ValidationThreshold>('validation_thresholds', {
      filterByFormula: `workspace_id = '${workspaceId}' AND entity_type = '${entityType}'`,
    });

    return thresholds.length > 0 ? thresholds[0] : null;
  }

  /**
   * Determine si on doit escalader au niveau suivant
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
   * Geocodage inverse (latitude/longitude -> adresse)
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<string | undefined> {
    try {
      // Utiliser un service de geocodage inverse (ex: Nominatim, Google Maps, etc.)
      // Pour l'instant, retourner les coordonnees
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      // TODO: Integrer avec API de geocodage
      // const response = await fetch(
      //   `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      // );
      // const data = await response.json();
      // return data.display_name;
    } catch (error) {
      console.error('Erreur geocodage inverse:', error);
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
    // TODO: Implementer l'envoi de notifications
    // - Email
    // - WhatsApp
    // - Notification in-app
    // - SMS (optionnel)

    console.log('Notification a envoyer:', {
      requestId: request.ValidationRequestId,
      status: request.Status,
      validatedBy: validation.ValidatedBy,
    });
  }
}
