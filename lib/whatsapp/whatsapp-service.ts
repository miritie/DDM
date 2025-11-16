/**
 * Service - WhatsApp Business API
 * Gestion des messages automatiques pour les clients
 */

export interface WhatsAppMessage {
  phone: string;
  message: string;
  mediaUrl?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  phoneNumberId: string;
  businessAccountId: string;
}

export class WhatsAppService {
  private config: WhatsAppConfig;

  constructor() {
    // Configuration depuis les variables d'environnement
    this.config = {
      apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
      apiKey: process.env.WHATSAPP_API_KEY || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    };
  }

  // ============================================================================
  // Messages de Bienvenue
  // ============================================================================

  /**
   * Envoyer un message de bienvenue à un nouveau client
   */
  async sendWelcomeMessage(
    phone: string,
    customerName?: string,
    bonusPoints?: number
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const message = this.buildWelcomeMessage(customerName, bonusPoints);

      const result = await this.sendTextMessage(formattedPhone, message);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Erreur envoi message bienvenue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Construire le message de bienvenue
   */
  private buildWelcomeMessage(customerName?: string, bonusPoints?: number): string {
    const greeting = customerName ? `Bonjour ${customerName}` : 'Bonjour';
    const points = bonusPoints || 500;

    return `${greeting} ! 🎉

Bienvenue chez DDM ! Nous sommes ravis de vous compter parmi nos clients.

🎁 **Cadeau de bienvenue**
Vous venez de recevoir **${points} points** sur votre compte fidélité !

💎 **Vos avantages**
• Cumulez des points à chaque achat
• Profitez de réductions exclusives
• Recevez nos offres spéciales en avant-première

📱 Pour consulter vos points et profiter de vos avantages, contactez-nous à tout moment.

À très bientôt ! 🙏`;
  }

  // ============================================================================
  // Messages Transactionnels
  // ============================================================================

  /**
   * Envoyer une facture par WhatsApp
   */
  async sendInvoice(
    phone: string,
    customerName: string,
    invoiceNumber: string,
    amount: number,
    itemsSummary: string,
    invoicePdfUrl?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const message = `Bonjour ${customerName},

Merci pour votre achat ! 🛍️

📄 **Facture N° ${invoiceNumber}**
💰 Montant: ${this.formatAmount(amount)} F CFA

${itemsSummary}

${invoicePdfUrl ? '📥 Votre facture détaillée est disponible ci-dessous.' : ''}

Merci de votre confiance ! 🙏`;

      const result = await this.sendTextMessage(formattedPhone, message);

      // Si PDF disponible, l'envoyer aussi
      if (invoicePdfUrl) {
        await this.sendDocument(formattedPhone, invoicePdfUrl, `Facture_${invoiceNumber}.pdf`);
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Erreur envoi facture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Confirmer un paiement reçu
   */
  async sendPaymentConfirmation(
    phone: string,
    customerName: string,
    amount: number,
    paymentMethod: string,
    newBalance?: number
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const message = `Bonjour ${customerName},

✅ **Paiement confirmé**

Nous avons bien reçu votre paiement de **${this.formatAmount(amount)} F CFA** par ${paymentMethod}.

${newBalance !== undefined ? `💳 Nouveau solde: ${this.formatAmount(newBalance)} F CFA` : ''}

Merci ! 🙏`;

      const result = await this.sendTextMessage(formattedPhone, message);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Erreur envoi confirmation paiement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  // ============================================================================
  // Messages Promotionnels
  // ============================================================================

  /**
   * Envoyer une promotion personnalisée
   */
  async sendPromotion(
    phone: string,
    customerName: string,
    promoTitle: string,
    promoDescription: string,
    validUntil?: string,
    imageUrl?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const message = `Bonjour ${customerName} ! 🎁

**${promoTitle}**

${promoDescription}

${validUntil ? `⏰ Valable jusqu'au ${validUntil}` : ''}

Ne manquez pas cette opportunité ! 🚀`;

      let result;
      if (imageUrl) {
        result = await this.sendImage(formattedPhone, imageUrl, message);
      } else {
        result = await this.sendTextMessage(formattedPhone, message);
      }

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Erreur envoi promotion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Notifier des points de fidélité gagnés
   */
  async sendLoyaltyUpdate(
    phone: string,
    customerName: string,
    pointsEarned: number,
    totalPoints: number,
    tier?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const tierEmoji = this.getTierEmoji(tier);

      const message = `Bravo ${customerName} ! 🎉

Vous venez de gagner **+${pointsEarned} points** !

💎 Total: **${totalPoints} points**
${tier ? `${tierEmoji} Niveau: **${tier.toUpperCase()}**` : ''}

Continuez à cumuler des points pour débloquer encore plus d'avantages ! 🚀`;

      const result = await this.sendTextMessage(formattedPhone, message);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Erreur envoi mise à jour fidélité:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  // ============================================================================
  // API Calls (WhatsApp Business API)
  // ============================================================================

  /**
   * Envoyer un message texte simple
   */
  private async sendTextMessage(
    phone: string,
    message: string
  ): Promise<{ success: boolean; messageId: string }> {
    const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.messages?.[0]?.id || '',
    };
  }

  /**
   * Envoyer une image avec caption
   */
  private async sendImage(
    phone: string,
    imageUrl: string,
    caption?: string
  ): Promise<{ success: boolean; messageId: string }> {
    const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.messages?.[0]?.id || '',
    };
  }

  /**
   * Envoyer un document (PDF, etc.)
   */
  private async sendDocument(
    phone: string,
    documentUrl: string,
    filename: string
  ): Promise<{ success: boolean; messageId: string }> {
    const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.messages?.[0]?.id || '',
    };
  }

  /**
   * Envoyer un template message (pré-approuvé par Meta)
   */
  private async sendTemplate(
    phone: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ): Promise<{ success: boolean; messageId: string }> {
    const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: components,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.messages?.[0]?.id || '',
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Formater un numéro de téléphone pour WhatsApp
   * Format requis: pas de + ni d'espaces, juste les chiffres
   * Ex: 225XXXXXXXXXX
   */
  private formatPhoneNumber(phone: string): string {
    // Retirer tous les caractères non numériques
    let cleaned = phone.replace(/\D/g, '');

    // Si commence par +, le retirer
    if (phone.startsWith('+')) {
      cleaned = phone.substring(1).replace(/\D/g, '');
    }

    // Si ne commence pas par 225 (Côte d'Ivoire), l'ajouter
    if (!cleaned.startsWith('225')) {
      cleaned = '225' + cleaned;
    }

    return cleaned;
  }

  /**
   * Formater un montant
   */
  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount);
  }

  /**
   * Obtenir l'emoji du tier de fidélité
   */
  private getTierEmoji(tier?: string): string {
    const emojis: Record<string, string> = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '💍',
    };

    return tier ? emojis[tier.toLowerCase()] || '⭐' : '⭐';
  }

  /**
   * Vérifier si l'API est configurée
   */
  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.phoneNumberId &&
      this.config.businessAccountId
    );
  }

  /**
   * Envoyer un message de test
   */
  async sendTestMessage(phone: string): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      const message = `🧪 **Message de test DDM**

Ceci est un message de test pour vérifier la configuration WhatsApp.

✅ Configuration OK
📱 WhatsApp Business API opérationnel

Date: ${new Date().toLocaleString('fr-FR')}`;

      await this.sendTextMessage(formattedPhone, message);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}

export const whatsappService = new WhatsAppService();
