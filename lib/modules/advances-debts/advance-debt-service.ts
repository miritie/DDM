/**
 * Service - Gestion des Avances & Dettes
 * Module 7.5
 */

import { AirtableClient } from '@/lib/airtable/client';
import {
  AdvanceDebt,
  AdvanceDebtSchedule,
  AdvanceDebtMovement,
  Account,
  AdvanceDebtType,
  AdvanceDebtStatus,
  MovementType,
} from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateAdvanceDebtInput {
  type: AdvanceDebtType;
  accountId: string;
  amount: number;
  reason: string;
  dueDate?: string;
  grantedById: string;
  workspaceId: string;
  schedules?: Array<{
    dueDate: string;
    amount: number;
  }>;
}

export interface CreateMovementInput {
  advanceDebtId: string;
  movementType: MovementType;
  amount: number;
  description?: string;
  attachmentUrl?: string;
  processedById: string;
  workspaceId: string;
}

/**
 * Service de gestion des avances et dettes
 */
export class AdvanceDebtService {
  /**
   * Liste toutes les avances/dettes
   */
  async list(workspaceId: string, filters?: {
    type?: AdvanceDebtType;
    status?: AdvanceDebtStatus;
    accountId?: string;
  }): Promise<AdvanceDebt[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.type) {
      formula += `, {Type} = '${filters.type}'`;
    }
    if (filters?.status) {
      formula += `, {Status} = '${filters.status}'`;
    }
    if (filters?.accountId) {
      formula += `, {AccountId} = '${filters.accountId}'`;
    }

    return await airtableClient.list<AdvanceDebt>('AdvanceDebt', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Récupère une avance/dette par ID
   */
  async getById(advanceDebtId: string): Promise<AdvanceDebt | null> {
    const results = await airtableClient.list<AdvanceDebt>('AdvanceDebt', {
      filterByFormula: `{AdvanceDebtId} = '${advanceDebtId}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée une nouvelle avance ou dette
   */
  async create(input: CreateAdvanceDebtInput): Promise<AdvanceDebt> {
    const advanceDebtId = uuidv4();
    const recordNumber = await this.generateRecordNumber(input.workspaceId, input.type);

    const advanceDebt: Partial<AdvanceDebt> = {
      AdvanceDebtId: advanceDebtId,
      RecordNumber: recordNumber,
      Type: input.type,
      AccountId: input.accountId,
      Amount: input.amount,
      Balance: input.amount,
      Reason: input.reason,
      DueDate: input.dueDate,
      Status: 'active',
      GrantedById: input.grantedById,
      GrantedAt: new Date().toISOString(),
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<AdvanceDebt>('AdvanceDebt', advanceDebt);
    if (!created) {
      throw new Error('Failed to create advance debt - Airtable not configured');
    }

    // Créer les échéanciers si fournis
    if (input.schedules && input.schedules.length > 0) {
      for (const schedule of input.schedules) {
        await this.createSchedule({
          advanceDebtId,
          dueDate: schedule.dueDate,
          amount: schedule.amount,
        });
      }
    }

    return created;
  }

  /**
   * Met à jour une avance/dette
   */
  async update(
    advanceDebtId: string,
    updates: Partial<AdvanceDebt>
  ): Promise<AdvanceDebt> {
    const advanceDebt = await this.getById(advanceDebtId);
    if (!advanceDebt) {
      throw new Error('Avance/Dette non trouvée');
    }

    // Récupérer le _recordId Airtable
    const records = await airtableClient.list<AdvanceDebt>('AdvanceDebt', {
      filterByFormula: `{AdvanceDebtId} = '${advanceDebtId}'`,
    });

    if (records.length === 0) {
      throw new Error('Avance/Dette non trouvée');
    }

    const recordId = (records[0] as any)._recordId;

    const updated = await airtableClient.update<AdvanceDebt>('AdvanceDebt', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to update advance debt - Airtable not configured');
    }

    return updated;
  }

  /**
   * Enregistre un paiement
   */
  async recordPayment(input: CreateMovementInput): Promise<AdvanceDebtMovement> {
    const advanceDebt = await this.getById(input.advanceDebtId);
    if (!advanceDebt) {
      throw new Error('Avance/Dette non trouvée');
    }

    // Créer le mouvement
    const movement = await this.createMovement(input);

    // Mettre à jour le solde
    const newBalance = advanceDebt.Balance - input.amount;
    const newStatus: AdvanceDebtStatus =
      newBalance <= 0 ? 'fully_paid' : newBalance < advanceDebt.Amount ? 'partially_paid' : 'active';

    await this.update(input.advanceDebtId, {
      Balance: Math.max(0, newBalance),
      Status: newStatus,
    });

    return movement;
  }

  /**
   * Enregistre une justification
   */
  async recordJustification(input: CreateMovementInput): Promise<AdvanceDebtMovement> {
    input.movementType = 'justification';
    return await this.recordPayment(input);
  }

  /**
   * Annule une avance/dette
   */
  async cancel(advanceDebtId: string): Promise<AdvanceDebt> {
    return await this.update(advanceDebtId, {
      Status: 'cancelled',
    });
  }

  /**
   * Récupère les mouvements d'une avance/dette
   */
  async getMovements(advanceDebtId: string): Promise<AdvanceDebtMovement[]> {
    return await airtableClient.list<AdvanceDebtMovement>('AdvanceDebtMovement', {
      filterByFormula: `{AdvanceDebtId} = '${advanceDebtId}'`,
      sort: [{ field: 'ProcessedAt', direction: 'desc' }],
    });
  }

  /**
   * Récupère les échéanciers d'une avance/dette
   */
  async getSchedules(advanceDebtId: string): Promise<AdvanceDebtSchedule[]> {
    return await airtableClient.list<AdvanceDebtSchedule>('AdvanceDebtSchedule', {
      filterByFormula: `{AdvanceDebtId} = '${advanceDebtId}'`,
      sort: [{ field: 'DueDate', direction: 'asc' }],
    });
  }

  /**
   * Crée un échéancier
   */
  async createSchedule(input: {
    advanceDebtId: string;
    dueDate: string;
    amount: number;
  }): Promise<AdvanceDebtSchedule> {
    const schedule: Partial<AdvanceDebtSchedule> = {
      ScheduleId: uuidv4(),
      AdvanceDebtId: input.advanceDebtId,
      DueDate: input.dueDate,
      Amount: input.amount,
      IsPaid: false,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<AdvanceDebtSchedule>('AdvanceDebtSchedule', schedule);

    if (!created) {
      throw new Error('Failed to create advance debt schedule - Airtable not configured');
    }

    return created;
  }

  /**
   * Marque un échéancier comme payé
   */
  async markSchedulePaid(scheduleId: string, paidAmount: number): Promise<AdvanceDebtSchedule> {
    const schedules = await airtableClient.list<AdvanceDebtSchedule>('AdvanceDebtSchedule', {
      filterByFormula: `{ScheduleId} = '${scheduleId}'`,
    });

    if (schedules.length === 0) {
      throw new Error('Échéancier non trouvé');
    }

    const recordId = (schedules[0] as any)._recordId;

    const updated = await airtableClient.update<AdvanceDebtSchedule>('AdvanceDebtSchedule', recordId, {
      IsPaid: true,
      PaidAt: new Date().toISOString(),
      PaidAmount: paidAmount,
      UpdatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to mark schedule as paid - Airtable not configured');
    }

    return updated;
  }

  /**
   * Crée un mouvement
   */
  private async createMovement(input: CreateMovementInput): Promise<AdvanceDebtMovement> {
    const movement: Partial<AdvanceDebtMovement> = {
      MovementId: uuidv4(),
      AdvanceDebtId: input.advanceDebtId,
      MovementType: input.movementType,
      Amount: input.amount,
      Description: input.description,
      AttachmentUrl: input.attachmentUrl,
      ProcessedById: input.processedById,
      ProcessedAt: new Date().toISOString(),
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<AdvanceDebtMovement>('AdvanceDebtMovement', movement);

    if (!created) {
      throw new Error('Failed to create advance debt movement - Airtable not configured');
    }

    return created;
  }

  /**
   * Génère un numéro d'enregistrement unique
   */
  private async generateRecordNumber(workspaceId: string, type: AdvanceDebtType): Promise<string> {
    const prefix = type === 'advance' ? 'AVN' : 'DET';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const existingRecords = await airtableClient.list<AdvanceDebt>('AdvanceDebt', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Type} = '${type}')`,
    });

    const sequence = String(existingRecords.length + 1).padStart(4, '0');
    return `${prefix}-${year}${month}-${sequence}`;
  }

  /**
   * Statistiques des avances/dettes
   */
  async getStatistics(workspaceId: string): Promise<{
    totalAdvances: number;
    totalDebts: number;
    activeAdvances: number;
    activeDebts: number;
    totalAdvanceAmount: number;
    totalDebtAmount: number;
    totalAdvanceBalance: number;
    totalDebtBalance: number;
  }> {
    const allRecords = await this.list(workspaceId);

    const advances = allRecords.filter((r) => r.Type === 'advance');
    const debts = allRecords.filter((r) => r.Type === 'debt');

    return {
      totalAdvances: advances.length,
      totalDebts: debts.length,
      activeAdvances: advances.filter((a) => a.Status === 'active' || a.Status === 'partially_paid').length,
      activeDebts: debts.filter((d) => d.Status === 'active' || d.Status === 'partially_paid').length,
      totalAdvanceAmount: advances.reduce((sum, a) => sum + a.Amount, 0),
      totalDebtAmount: debts.reduce((sum, d) => sum + d.Amount, 0),
      totalAdvanceBalance: advances.reduce((sum, a) => sum + a.Balance, 0),
      totalDebtBalance: debts.reduce((sum, d) => sum + d.Balance, 0),
    };
  }
}
