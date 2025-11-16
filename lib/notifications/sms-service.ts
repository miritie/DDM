/**
 * Service - Envoi de SMS via Twilio
 * Module Notifications
 */

import { Notification } from '@/types/modules';
import { AirtableClient } from '@/lib/airtable/client';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface SendSMSInput {
  to: string;
  message: string;
  recipientId?: string;
  workspaceId?: string;
}

/**
 * Service d'envoi de SMS via Twilio
 */
export class SMSService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  /**
   * Envoie un SMS via Twilio
   */
  async send(input: SendSMSInput): Promise<{ success: boolean; sid?: string; error?: string }> {
    // Si Twilio n'est pas configuré, simuler l'envoi en développement
    if (!this.accountSid || !this.authToken) {
      console.log('📱 [SMS SIMULATION]', {
        to: input.to,
        message: input.message,
      });

      // Enregistrer la notification en base
      if (input.recipientId && input.workspaceId) {
        await this.logNotification({
          recipientId: input.recipientId,
          message: input.message,
          workspaceId: input.workspaceId,
          status: 'sent',
        });
      }

      return { success: true, sid: 'simulated-' + Date.now() };
    }

    try {
      // Construire les paramètres pour l'API Twilio
      const params = new URLSearchParams({
        To: input.to,
        From: this.fromNumber,
        Body: input.message,
      });

      // Créer les credentials en base64 pour l'authentification Basic
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      // Appel API Twilio
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Twilio error:', data);

        // Enregistrer l'échec
        if (input.recipientId && input.workspaceId) {
          await this.logNotification({
            recipientId: input.recipientId,
            message: input.message,
            workspaceId: input.workspaceId,
            status: 'failed',
            errorMessage: data.message || JSON.stringify(data),
          });
        }

        return {
          success: false,
          error: data.message || 'Erreur Twilio',
        };
      }

      // Enregistrer le succès
      if (input.recipientId && input.workspaceId) {
        await this.logNotification({
          recipientId: input.recipientId,
          message: input.message,
          workspaceId: input.workspaceId,
          status: 'sent',
        });
      }

      return { success: true, sid: data.sid };
    } catch (error: any) {
      console.error('Error sending SMS:', error);

      // Enregistrer l'échec
      if (input.recipientId && input.workspaceId) {
        await this.logNotification({
          recipientId: input.recipientId,
          message: input.message,
          workspaceId: input.workspaceId,
          status: 'failed',
          errorMessage: error.message,
        });
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Enregistre une notification en base de données
   */
  private async logNotification(input: {
    recipientId: string;
    message: string;
    workspaceId: string;
    status: 'pending' | 'sent' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    try {
      const notification: Partial<Notification> = {
        NotificationId: uuidv4(),
        RecipientId: input.recipientId,
        Channel: 'sms',
        Message: input.message,
        Status: input.status,
        SentAt: input.status === 'sent' ? new Date().toISOString() : undefined,
        ErrorMessage: input.errorMessage,
        WorkspaceId: input.workspaceId,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      await airtableClient.create<Notification>('Notification', notification);
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Template: SMS Avance/Dette
   */
  getAdvanceDebtSMS(data: {
    userName: string;
    type: 'advance' | 'debt';
    amount: number;
    recordNumber: string;
  }): string {
    const typeLabel = data.type === 'advance' ? 'Avance' : 'Dette';
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(data.amount);

    return `DDM System: ${typeLabel} ${data.recordNumber} enregistree. Montant: ${amount}. Consultez votre espace pour plus de details.`;
  }

  /**
   * Template: SMS Transaction
   */
  getTransactionSMS(data: {
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    transactionNumber: string;
  }): string {
    const typeLabels = {
      income: 'Revenu',
      expense: 'Depense',
      transfer: 'Transfert',
    };
    const typeLabel = typeLabels[data.type];
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(data.amount);

    return `DDM System: ${typeLabel} ${data.transactionNumber} enregistre. Montant: ${amount}.`;
  }

  /**
   * Template: SMS de bienvenue
   */
  getWelcomeSMS(userName: string): string {
    return `Bienvenue ${userName} sur DDM System! Votre compte a ete cree avec succes. Connectez-vous pour commencer.`;
  }

  /**
   * Template: SMS rappel échéance
   */
  getReminderSMS(data: {
    userName: string;
    amount: number;
    dueDate: string;
    recordNumber: string;
  }): string {
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(data.amount);
    const date = new Intl.DateTimeFormat('fr-FR').format(new Date(data.dueDate));

    return `DDM System: Rappel echeance ${data.recordNumber}. Montant: ${amount}. Date: ${date}. Veuillez effectuer le paiement.`;
  }
}
