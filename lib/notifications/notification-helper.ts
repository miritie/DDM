/**
 * Helper - Envoi de Notifications Simplifié
 * Module Notifications
 *
 * Ce fichier fournit des fonctions utilitaires pour envoyer facilement des notifications
 * depuis n'importe où dans l'application
 */

import { EmailService } from './email-service';
import { SMSService } from './sms-service';
import { AirtableClient } from '@/lib/airtable/client';
import { User } from '@/types/modules';

const emailService = new EmailService();
const smsService = new SMSService();
const airtableClient = new AirtableClient();

export interface NotificationRecipient {
  userId: string;
  email?: string;
  phone?: string;
  name: string;
}

/**
 * Envoie une notification de bienvenue à un nouvel utilisateur
 */
export async function sendWelcomeNotification(
  recipient: NotificationRecipient,
  workspaceId: string
) {
  const results = {
    email: null as any,
    sms: null as any,
  };

  // Email
  if (recipient.email) {
    const emailContent = emailService.getWelcomeEmail(recipient.name);
    results.email = await emailService.send({
      to: recipient.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  // SMS
  if (recipient.phone) {
    const smsMessage = smsService.getWelcomeSMS(recipient.name);
    results.sms = await smsService.send({
      to: recipient.phone,
      message: smsMessage,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  return results;
}

/**
 * Envoie une notification d'avance ou dette
 */
export async function sendAdvanceDebtNotification(
  recipient: NotificationRecipient,
  data: {
    type: 'advance' | 'debt';
    amount: number;
    reason: string;
    recordNumber: string;
  },
  workspaceId: string
) {
  const results = {
    email: null as any,
    sms: null as any,
  };

  // Email
  if (recipient.email) {
    const emailContent = emailService.getAdvanceDebtNotificationEmail({
      userName: recipient.name,
      ...data,
    });
    results.email = await emailService.send({
      to: recipient.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  // SMS
  if (recipient.phone) {
    const smsMessage = smsService.getAdvanceDebtSMS({
      userName: recipient.name,
      ...data,
    });
    results.sms = await smsService.send({
      to: recipient.phone,
      message: smsMessage,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  return results;
}

/**
 * Envoie une notification de transaction
 */
export async function sendTransactionNotification(
  recipient: NotificationRecipient,
  data: {
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    description: string;
    transactionNumber: string;
  },
  workspaceId: string
) {
  const results = {
    email: null as any,
    sms: null as any,
  };

  // Email
  if (recipient.email) {
    const emailContent = emailService.getTransactionNotificationEmail({
      userName: recipient.name,
      ...data,
    });
    results.email = await emailService.send({
      to: recipient.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  // SMS
  if (recipient.phone) {
    const smsMessage = smsService.getTransactionSMS(data);
    results.sms = await smsService.send({
      to: recipient.phone,
      message: smsMessage,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  return results;
}

/**
 * Envoie une notification de rappel d'échéance
 */
export async function sendReminderNotification(
  recipient: NotificationRecipient,
  data: {
    amount: number;
    dueDate: string;
    recordNumber: string;
  },
  workspaceId: string
) {
  const results = {
    email: null as any,
    sms: null as any,
  };

  // Email - Use advance/debt template with reminder context
  if (recipient.email) {
    const emailContent = emailService.getAdvanceDebtNotificationEmail({
      userName: recipient.name,
      type: 'debt',
      amount: data.amount,
      reason: `Échéance de paiement au ${new Intl.DateTimeFormat('fr-FR').format(new Date(data.dueDate))}`,
      recordNumber: data.recordNumber,
    });

    // Customize subject for reminder
    emailContent.subject = `Rappel d'échéance - ${data.recordNumber}`;

    results.email = await emailService.send({
      to: recipient.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  // SMS
  if (recipient.phone) {
    const smsMessage = smsService.getReminderSMS({
      userName: recipient.name,
      ...data,
    });
    results.sms = await smsService.send({
      to: recipient.phone,
      message: smsMessage,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  return results;
}

/**
 * Récupère les informations d'un utilisateur pour l'envoi de notifications
 */
export async function getUserForNotification(userId: string): Promise<NotificationRecipient | null> {
  try {
    const users = await airtableClient.list<User>('User', {
      filterByFormula: `{UserId} = '${userId}'`,
    });

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    return {
      userId: user.UserId,
      email: user.Email,
      phone: user.Phone,
      name: user.FullName || user.Email,
    };
  } catch (error) {
    console.error('Error fetching user for notification:', error);
    return null;
  }
}

/**
 * Envoie une notification personnalisée (email et/ou SMS)
 */
export async function sendCustomNotification(
  recipient: NotificationRecipient,
  notification: {
    emailSubject?: string;
    emailHtml?: string;
    emailText?: string;
    smsMessage?: string;
  },
  workspaceId: string
) {
  const results = {
    email: null as any,
    sms: null as any,
  };

  // Email
  if (recipient.email && notification.emailSubject && (notification.emailHtml || notification.emailText)) {
    results.email = await emailService.send({
      to: recipient.email,
      subject: notification.emailSubject,
      html: notification.emailHtml || `<p>${notification.emailText}</p>`,
      text: notification.emailText || notification.emailHtml?.replace(/<[^>]*>/g, ''),
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  // SMS
  if (recipient.phone && notification.smsMessage) {
    results.sms = await smsService.send({
      to: recipient.phone,
      message: notification.smsMessage,
      recipientId: recipient.userId,
      workspaceId,
    });
  }

  return results;
}
