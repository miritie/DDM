/**
 * Service - Envoi d'emails via SendGrid
 * Module Notifications
 */

import { Notification } from '@/types/modules';
import { AirtableClient } from '@/lib/airtable/client';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  recipientId?: string;
  workspaceId?: string;
}

/**
 * Service d'envoi d'emails via SendGrid
 */
export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@ddm-system.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'DDM System';
  }

  /**
   * Envoie un email via SendGrid
   */
  async send(input: SendEmailInput): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Si SendGrid n'est pas configuré, simuler l'envoi en développement
    if (!this.apiKey) {
      console.log('📧 [EMAIL SIMULATION]', {
        to: input.to,
        subject: input.subject,
        html: input.html.substring(0, 100) + '...',
      });

      // Enregistrer la notification en base
      if (input.recipientId && input.workspaceId) {
        await this.logNotification({
          recipientId: input.recipientId,
          subject: input.subject,
          message: input.text || input.html,
          workspaceId: input.workspaceId,
          status: 'sent',
        });
      }

      return { success: true, messageId: 'simulated-' + Date.now() };
    }

    try {
      // Appel API SendGrid
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: input.to }],
              subject: input.subject,
            },
          ],
          from: {
            email: this.fromEmail,
            name: this.fromName,
          },
          content: [
            {
              type: 'text/plain',
              value: input.text || '',
            },
            {
              type: 'text/html',
              value: input.html,
            },
          ],
        }),
      });

      const messageId = response.headers.get('X-Message-Id') || undefined;

      if (!response.ok) {
        const errorData = await response.json();
        console.error('SendGrid error:', errorData);

        // Enregistrer l'échec
        if (input.recipientId && input.workspaceId) {
          await this.logNotification({
            recipientId: input.recipientId,
            subject: input.subject,
            message: input.text || input.html,
            workspaceId: input.workspaceId,
            status: 'failed',
            errorMessage: JSON.stringify(errorData),
          });
        }

        return {
          success: false,
          error: errorData.errors?.[0]?.message || 'Erreur SendGrid',
        };
      }

      // Enregistrer le succès
      if (input.recipientId && input.workspaceId) {
        await this.logNotification({
          recipientId: input.recipientId,
          subject: input.subject,
          message: input.text || input.html,
          workspaceId: input.workspaceId,
          status: 'sent',
        });
      }

      return { success: true, messageId };
    } catch (error: any) {
      console.error('Error sending email:', error);

      // Enregistrer l'échec
      if (input.recipientId && input.workspaceId) {
        await this.logNotification({
          recipientId: input.recipientId,
          subject: input.subject,
          message: input.text || input.html,
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
    subject: string;
    message: string;
    workspaceId: string;
    status: 'pending' | 'sent' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    try {
      const notification: Partial<Notification> = {
        NotificationId: uuidv4(),
        RecipientId: input.recipientId,
        Channel: 'email',
        Subject: input.subject,
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
   * Template: Email de bienvenue
   */
  getWelcomeEmail(userName: string): { subject: string; html: string; text: string } {
    return {
      subject: 'Bienvenue sur DDM System',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .button { display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 4px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Bienvenue sur DDM System</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${userName},</h2>
                <p>Votre compte a été créé avec succès sur DDM System.</p>
                <p>Vous pouvez maintenant vous connecter et commencer à utiliser toutes les fonctionnalités de la plateforme.</p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXTAUTH_URL}/auth/login" class="button">Se connecter</a>
                </p>
              </div>
              <div class="footer">
                <p>DDM System - Système Intégré de Gestion</p>
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Bonjour ${userName},\n\nVotre compte a été créé avec succès sur DDM System.\n\nVous pouvez maintenant vous connecter à ${process.env.NEXTAUTH_URL}/auth/login`,
    };
  }

  /**
   * Template: Notification d'avance/dette
   */
  getAdvanceDebtNotificationEmail(data: {
    userName: string;
    type: 'advance' | 'debt';
    amount: number;
    reason: string;
    recordNumber: string;
  }): { subject: string; html: string; text: string } {
    const typeLabel = data.type === 'advance' ? 'Avance' : 'Dette';
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(data.amount);

    return {
      subject: `Nouvelle ${typeLabel} enregistrée - ${data.recordNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${data.type === 'advance' ? '#10B981' : '#EF4444'}; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .info-box { background: white; padding: 15px; border-left: 4px solid ${data.type === 'advance' ? '#10B981' : '#EF4444'}; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${typeLabel} - ${data.recordNumber}</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${data.userName},</h2>
                <p>Une nouvelle ${typeLabel.toLowerCase()} a été enregistrée à votre nom.</p>
                <div class="info-box">
                  <p><strong>Numéro:</strong> ${data.recordNumber}</p>
                  <p><strong>Montant:</strong> ${amount}</p>
                  <p><strong>Motif:</strong> ${data.reason}</p>
                </div>
                <p>Vous pouvez consulter les détails et gérer les paiements depuis votre espace.</p>
              </div>
              <div class="footer">
                <p>DDM System - Module Avances & Dettes</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Bonjour ${data.userName},\n\nUne nouvelle ${typeLabel.toLowerCase()} a été enregistrée:\n\nNuméro: ${data.recordNumber}\nMontant: ${amount}\nMotif: ${data.reason}`,
    };
  }

  /**
   * Template: Notification de transaction
   */
  getTransactionNotificationEmail(data: {
    userName: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description: string;
    transactionNumber: string;
  }): { subject: string; html: string; text: string } {
    const typeLabels = {
      income: 'Revenu',
      expense: 'Dépense',
      transfer: 'Transfert',
    };
    const typeLabel = typeLabels[data.type];
    const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(data.amount);

    return {
      subject: `${typeLabel} enregistré(e) - ${data.transactionNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9fafb; }
              .info-box { background: white; padding: 15px; border-left: 4px solid #3B82F6; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${typeLabel} - ${data.transactionNumber}</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${data.userName},</h2>
                <p>Une nouvelle transaction a été enregistrée.</p>
                <div class="info-box">
                  <p><strong>Type:</strong> ${typeLabel}</p>
                  <p><strong>Numéro:</strong> ${data.transactionNumber}</p>
                  <p><strong>Montant:</strong> ${amount}</p>
                  <p><strong>Description:</strong> ${data.description}</p>
                </div>
              </div>
              <div class="footer">
                <p>DDM System - Module Trésorerie</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Bonjour ${data.userName},\n\n${typeLabel} enregistré(e):\n\nNuméro: ${data.transactionNumber}\nMontant: ${amount}\nDescription: ${data.description}`,
    };
  }
}
