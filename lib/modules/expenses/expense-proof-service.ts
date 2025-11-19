/**
 * Service - Gestion des Preuves de Dépenses
 * Module Dépenses
 */

import { AirtableClient } from '@/lib/airtable/client';
import { ExpenseProof } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateExpenseProofInput {
  expenseRequestId: string;
  type: 'receipt' | 'invoice' | 'photo' | 'document' | 'other';
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  uploadedBy: string;
}

export interface UpdateExpenseProofInput {
  description?: string;
}

export class ExpenseProofService {
  /**
   * Créer une nouvelle preuve pour une demande de dépense
   */
  async create(input: CreateExpenseProofInput): Promise<ExpenseProof> {
    // Validation: vérifier que la demande existe
    const requests = await airtableClient.list('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${input.expenseRequestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande de dépense non trouvée');
    }

    const request = requests[0] as any;

    // Validation: seules les demandes en draft ou submitted peuvent recevoir des preuves
    if (!['draft', 'submitted', 'pending_approval'].includes(request.Status)) {
      throw new Error('Impossible d\'ajouter des preuves à une demande déjà traitée');
    }

    // Validation: taille de fichier (max 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (input.fileSize > maxFileSize) {
      throw new Error('La taille du fichier ne doit pas dépasser 10MB');
    }

    // Validation: types MIME autorisés
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(input.mimeType)) {
      throw new Error(
        'Type de fichier non autorisé. Formats acceptés: images (JPG, PNG, GIF, WEBP), PDF, Word, Excel'
      );
    }

    const proof: Partial<ExpenseProof> = {
      ProofId: uuidv4(),
      ExpenseRequestId: input.expenseRequestId,
      Type: input.type,
      FileName: input.fileName,
      FileUrl: input.fileUrl,
      FileSize: input.fileSize,
      MimeType: input.mimeType,
      Description: input.description,
      UploadedBy: input.uploadedBy,
      UploadedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<ExpenseProof>('ExpenseProof', proof);
    if (!created) {
      throw new Error('Failed to create expense proof - Airtable not configured');
    }
    return created;
  }

  /**
   * Récupérer une preuve par son ID
   */
  async getById(proofId: string): Promise<ExpenseProof | null> {
    const proofs = await airtableClient.list<ExpenseProof>('ExpenseProof', {
      filterByFormula: `{ProofId} = '${proofId}'`,
    });
    return proofs.length > 0 ? proofs[0] : null;
  }

  /**
   * Lister toutes les preuves d'une demande de dépense
   */
  async listByExpenseRequest(expenseRequestId: string): Promise<ExpenseProof[]> {
    return await airtableClient.list<ExpenseProof>('ExpenseProof', {
      filterByFormula: `{ExpenseRequestId} = '${expenseRequestId}'`,
      sort: [{ field: 'UploadedAt', direction: 'desc' }],
    });
  }

  /**
   * Mettre à jour une preuve (description uniquement)
   */
  async update(proofId: string, updates: UpdateExpenseProofInput): Promise<ExpenseProof> {
    const proofs = await airtableClient.list<ExpenseProof>('ExpenseProof', {
      filterByFormula: `{ProofId} = '${proofId}'`,
    });

    if (proofs.length === 0) {
      throw new Error('Preuve non trouvée');
    }

    const proof = proofs[0] as any;

    // Validation: vérifier que la demande est encore modifiable
    const requests = await airtableClient.list('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${proof.ExpenseRequestId}'`,
    });

    if (requests.length > 0) {
      const request = requests[0] as any;
      if (!['draft', 'submitted', 'pending_approval'].includes(request.Status)) {
        throw new Error('Impossible de modifier une preuve d\'une demande déjà traitée');
      }
    }

    const updateData: any = {};

    if (updates.description !== undefined) {
      updateData.Description = updates.description;
    }

    const updated = await airtableClient.update<ExpenseProof>(
      'ExpenseProof',
      proof._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update expense proof - Airtable not configured');
    }
    return updated;
  }

  /**
   * Supprimer une preuve
   */
  async delete(proofId: string): Promise<void> {
    const proofs = await airtableClient.list<ExpenseProof>('ExpenseProof', {
      filterByFormula: `{ProofId} = '${proofId}'`,
    });

    if (proofs.length === 0) {
      throw new Error('Preuve non trouvée');
    }

    const proof = proofs[0] as any;

    // Validation: vérifier que la demande est encore modifiable
    const requests = await airtableClient.list('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${proof.ExpenseRequestId}'`,
    });

    if (requests.length > 0) {
      const request = requests[0] as any;
      if (!['draft', 'submitted'].includes(request.Status)) {
        throw new Error(
          'Impossible de supprimer une preuve d\'une demande en cours d\'approbation ou déjà traitée'
        );
      }
    }

    await airtableClient.delete('ExpenseProof', proof._recordId);
  }

  /**
   * Supprimer toutes les preuves d'une demande (utilisé en cas de suppression de demande)
   */
  async deleteAllByExpenseRequest(expenseRequestId: string): Promise<void> {
    const proofs = await this.listByExpenseRequest(expenseRequestId);

    for (const proof of proofs) {
      const proofWithRecordId = proof as any;
      if (proofWithRecordId._recordId) {
        await airtableClient.delete('ExpenseProof', proofWithRecordId._recordId);
      }
    }
  }

  /**
   * Vérifier si une demande a suffisamment de preuves (selon la configuration)
   */
  async hasRequiredProofs(expenseRequestId: string, amount: number): Promise<boolean> {
    const proofs = await this.listByExpenseRequest(expenseRequestId);

    // Règle métier: au moins une preuve requise pour montants > 50,000 XOF
    const threshold = 50000;
    if (amount > threshold) {
      return proofs.length > 0;
    }

    return true; // Pas de preuve requise en dessous du seuil
  }

  /**
   * Obtenir les statistiques des preuves pour une demande
   */
  async getStatistics(
    expenseRequestId: string
  ): Promise<{
    totalProofs: number;
    totalSize: number;
    byType: Record<string, number>;
    hasInvoice: boolean;
    hasReceipt: boolean;
  }> {
    const proofs = await this.listByExpenseRequest(expenseRequestId);

    const totalProofs = proofs.length;
    const totalSize = proofs.reduce((sum, p) => sum + p.FileSize, 0);

    const byType: Record<string, number> = {};
    proofs.forEach((proof) => {
      byType[proof.Type] = (byType[proof.Type] || 0) + 1;
    });

    const hasInvoice = proofs.some((p) => p.Type === 'invoice');
    const hasReceipt = proofs.some((p) => p.Type === 'receipt');

    return {
      totalProofs,
      totalSize,
      byType,
      hasInvoice,
      hasReceipt,
    };
  }

  /**
   * Valider qu'une demande peut être soumise en termes de preuves
   */
  async validateForSubmission(
    expenseRequestId: string,
    amount: number
  ): Promise<{ valid: boolean; message?: string }> {
    const hasRequired = await this.hasRequiredProofs(expenseRequestId, amount);

    if (!hasRequired) {
      return {
        valid: false,
        message: `Une preuve est requise pour les montants supérieurs à 50,000 XOF`,
      };
    }

    const stats = await this.getStatistics(expenseRequestId);

    // Recommandation: pour les montants élevés, demander une facture
    if (amount > 500000 && !stats.hasInvoice) {
      return {
        valid: true,
        message: `Recommandation: une facture est recommandée pour ce montant`,
      };
    }

    return {
      valid: true,
    };
  }
}
