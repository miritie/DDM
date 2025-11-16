/**
 * API Route - Envoi de Notifications
 * Module Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { EmailService } from '@/lib/notifications/email-service';
import { SMSService } from '@/lib/notifications/sms-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const emailService = new EmailService();
const smsService = new SMSService();

export interface SendNotificationRequest {
  channel: 'email' | 'sms' | 'both';
  recipientId?: string;
  to: string; // email or phone number
  subject?: string; // for email
  message: string;
  template?: 'welcome' | 'advance_debt' | 'transaction' | 'reminder';
  templateData?: any;
}

/**
 * POST /api/notifications/send
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATION_SEND);

    const workspaceId = await getCurrentWorkspaceId();
    const body: SendNotificationRequest = await request.json();

    const results: any = {
      email: null,
      sms: null,
    };

    // Validate
    if (!body.to || !body.message) {
      return NextResponse.json(
        { error: 'Les champs "to" et "message" sont requis' },
        { status: 400 }
      );
    }

    // Send Email
    if (body.channel === 'email' || body.channel === 'both') {
      if (!body.subject) {
        return NextResponse.json(
          { error: 'Le champ "subject" est requis pour les emails' },
          { status: 400 }
        );
      }

      let emailContent = {
        subject: body.subject,
        html: `<p>${body.message}</p>`,
        text: body.message,
      };

      // Use template if specified
      if (body.template && body.templateData) {
        switch (body.template) {
          case 'welcome':
            emailContent = emailService.getWelcomeEmail(body.templateData.userName);
            break;
          case 'advance_debt':
            emailContent = emailService.getAdvanceDebtNotificationEmail(body.templateData);
            break;
          case 'transaction':
            emailContent = emailService.getTransactionNotificationEmail(body.templateData);
            break;
        }
      }

      results.email = await emailService.send({
        to: body.to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        recipientId: body.recipientId,
        workspaceId,
      });
    }

    // Send SMS
    if (body.channel === 'sms' || body.channel === 'both') {
      let smsMessage = body.message;

      // Use template if specified
      if (body.template && body.templateData) {
        switch (body.template) {
          case 'welcome':
            smsMessage = smsService.getWelcomeSMS(body.templateData.userName);
            break;
          case 'advance_debt':
            smsMessage = smsService.getAdvanceDebtSMS(body.templateData);
            break;
          case 'transaction':
            smsMessage = smsService.getTransactionSMS(body.templateData);
            break;
          case 'reminder':
            smsMessage = smsService.getReminderSMS(body.templateData);
            break;
        }
      }

      results.sms = await smsService.send({
        to: body.to,
        message: smsMessage,
        recipientId: body.recipientId,
        workspaceId,
      });
    }

    // Check if any notification failed
    const hasError =
      (results.email && !results.email.success) || (results.sms && !results.sms.success);

    if (hasError) {
      return NextResponse.json(
        {
          success: false,
          results,
          error: 'Une ou plusieurs notifications ont échoué',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'envoi' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
