/**
 * Service - Transmission Rapports WhatsApp
 * Envoi de rapports (messages texte ou PDF) vers groupes WhatsApp
 * Support: Point Flash, Dépenses quotidiennes, Rapports custom
 */

export interface WhatsAppGroup {
  groupId: string;
  name: string;
  phoneNumberId?: string; // Si groupe géré par API
  description?: string;
}

export interface WhatsAppReportConfig {
  reportType: 'point_flash' | 'daily_expenses' | 'daily_sales' | 'custom';
  deliveryMode: 'text' | 'pdf' | 'both';
  targetGroups: string[]; // IDs des groupes WhatsApp
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0=dimanche, 6=samedi
    time: string; // Format HH:mm
  };
  enabled: boolean;
}

export interface WhatsAppMessagePayload {
  type: 'text' | 'document';
  to: string; // Group ID ou Phone Number
  content: string; // Texte du message ou caption PDF
  documentUrl?: string; // URL du PDF si type=document
  filename?: string;
}

export class WhatsAppReportService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly phoneNumberId: string;
  private readonly businessAccountId: string;

  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.apiKey = process.env.WHATSAPP_API_KEY || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
  }

  /**
   * Vérifie si le service WhatsApp est configuré
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.phoneNumberId);
  }

  /**
   * Envoie un Point Flash quotidien/hebdomadaire
   */
  async sendPointFlash(data: {
    period: string; // Ex: "Semaine 42"
    kpis: {
      revenue: number;
      revenueTrend: number;
      expenses: number;
      expensesTrend: number;
      profit: number;
      profitTrend: number;
      salesCount: number;
      newCustomers: number;
    };
    alerts?: string[];
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[]; errors?: any[] }> {
    const message = this.formatPointFlashMessage(data.period, data.kpis, data.alerts);

    const results: { groupId: string; success: boolean; error?: any }[] = [];

    for (const groupId of data.targetGroups) {
      try {
        // Envoyer le message texte
        await this.sendTextMessage(groupId, message);

        // Si PDF fourni, l'envoyer aussi
        if (data.pdfUrl) {
          await this.sendPDFDocument(groupId, data.pdfUrl, `PointFlash_${data.period}.pdf`, 'Point Flash PDF joint');
        }

        results.push({ groupId, success: true });
      } catch (error) {
        results.push({ groupId, success: false, error });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success).map(r => ({ groupId: r.groupId, error: r.error }));

    return {
      success: successCount > 0,
      sentTo: results.filter(r => r.success).map(r => r.groupId),
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Envoie le résumé quotidien des dépenses
   */
  async sendDailyExpenses(data: {
    date: string;
    totalExpenses: number;
    expensesByCategory: Array<{ category: string; amount: number }>;
    pendingExpenses: number;
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[] }> {
    const message = this.formatDailyExpensesMessage(data);

    const sentTo: string[] = [];

    for (const groupId of data.targetGroups) {
      try {
        await this.sendTextMessage(groupId, message);

        if (data.pdfUrl) {
          await this.sendPDFDocument(
            groupId,
            data.pdfUrl,
            `Depenses_${data.date}.pdf`,
            'Fiche de dépenses quotidienne'
          );
        }

        sentTo.push(groupId);
      } catch (error) {
        console.error(`Erreur envoi vers groupe ${groupId}:`, error);
      }
    }

    return {
      success: sentTo.length > 0,
      sentTo,
    };
  }

  /**
   * Envoie le résumé quotidien des ventes
   */
  async sendDailySales(data: {
    date: string;
    totalRevenue: number;
    salesCount: number;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[] }> {
    const message = this.formatDailySalesMessage(data);

    const sentTo: string[] = [];

    for (const groupId of data.targetGroups) {
      try {
        await this.sendTextMessage(groupId, message);

        if (data.pdfUrl) {
          await this.sendPDFDocument(
            groupId,
            data.pdfUrl,
            `Ventes_${data.date}.pdf`,
            'Rapport de ventes quotidien'
          );
        }

        sentTo.push(groupId);
      } catch (error) {
        console.error(`Erreur envoi vers groupe ${groupId}:`, error);
      }
    }

    return {
      success: sentTo.length > 0,
      sentTo,
    };
  }

  /**
   * Envoie un rapport personnalisé
   */
  async sendCustomReport(data: {
    title: string;
    summary: string;
    pdfUrl?: string;
    targetGroups: string[];
  }): Promise<{ success: boolean; sentTo: string[] }> {
    const message = `📊 *${data.title}*\n\n${data.summary}\n\n_Généré automatiquement par DDM_`;

    const sentTo: string[] = [];

    for (const groupId of data.targetGroups) {
      try {
        await this.sendTextMessage(groupId, message);

        if (data.pdfUrl) {
          await this.sendPDFDocument(groupId, data.pdfUrl, `${data.title}.pdf`, data.title);
        }

        sentTo.push(groupId);
      } catch (error) {
        console.error(`Erreur envoi vers groupe ${groupId}:`, error);
      }
    }

    return {
      success: sentTo.length > 0,
      sentTo,
    };
  }

  /**
   * Formate un message Point Flash
   */
  private formatPointFlashMessage(
    period: string,
    kpis: {
      revenue: number;
      revenueTrend: number;
      expenses: number;
      expensesTrend: number;
      profit: number;
      profitTrend: number;
      salesCount: number;
      newCustomers: number;
    },
    alerts?: string[]
  ): string {
    const formatAmount = (amount: number) =>
      new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(amount);

    const formatTrend = (trend: number) => {
      if (trend === 0) return '→';
      return trend > 0 ? `📈 +${trend.toFixed(1)}%` : `📉 ${trend.toFixed(1)}%`;
    };

    let message = `⚡ *POINT FLASH - ${period}*\n\n`;

    message += `💰 *CHIFFRE D'AFFAIRES*\n`;
    message += `${formatAmount(kpis.revenue)} F CFA ${formatTrend(kpis.revenueTrend)}\n\n`;

    message += `💸 *DÉPENSES*\n`;
    message += `${formatAmount(kpis.expenses)} F CFA ${formatTrend(kpis.expensesTrend)}\n\n`;

    message += `💵 *BÉNÉFICE NET*\n`;
    message += `${formatAmount(kpis.profit)} F CFA ${formatTrend(kpis.profitTrend)}\n\n`;

    message += `📊 *ACTIVITÉ*\n`;
    message += `• ${kpis.salesCount} ventes\n`;
    message += `• ${kpis.newCustomers} nouveaux clients\n\n`;

    if (alerts && alerts.length > 0) {
      message += `⚠️ *ALERTES*\n`;
      alerts.forEach((alert) => {
        message += `• ${alert}\n`;
      });
      message += `\n`;
    }

    message += `_Généré automatiquement par DDM_`;

    return message;
  }

  /**
   * Formate un message de dépenses quotidiennes
   */
  private formatDailyExpensesMessage(data: {
    date: string;
    totalExpenses: number;
    expensesByCategory: Array<{ category: string; amount: number }>;
    pendingExpenses: number;
  }): string {
    const formatAmount = (amount: number) =>
      new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(amount);

    let message = `💸 *DÉPENSES DU ${new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}*\n\n`;

    message += `💰 *TOTAL: ${formatAmount(data.totalExpenses)} F CFA*\n\n`;

    if (data.expensesByCategory.length > 0) {
      message += `📋 *PAR CATÉGORIE:*\n`;
      data.expensesByCategory.forEach((cat) => {
        message += `• ${cat.category}: ${formatAmount(cat.amount)} F\n`;
      });
      message += `\n`;
    }

    if (data.pendingExpenses > 0) {
      message += `⏳ *${data.pendingExpenses}* dépenses en attente de validation\n\n`;
    }

    message += `_Généré automatiquement par DDM_`;

    return message;
  }

  /**
   * Formate un message de ventes quotidiennes
   */
  private formatDailySalesMessage(data: {
    date: string;
    totalRevenue: number;
    salesCount: number;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  }): string {
    const formatAmount = (amount: number) =>
      new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(amount);

    let message = `💰 *VENTES DU ${new Date(data.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}*\n\n`;

    message += `💵 *CA: ${formatAmount(data.totalRevenue)} F CFA*\n`;
    message += `📊 *${data.salesCount}* ventes réalisées\n\n`;

    if (data.topProducts.length > 0) {
      message += `🏆 *TOP PRODUITS:*\n`;
      data.topProducts.slice(0, 5).forEach((product, idx) => {
        message += `${idx + 1}. ${product.name} - ${product.quantity} unités (${formatAmount(product.revenue)} F)\n`;
      });
      message += `\n`;
    }

    message += `_Généré automatiquement par DDM_`;

    return message;
  }

  /**
   * Envoie un message texte vers un groupe WhatsApp
   */
  private async sendTextMessage(groupId: string, message: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp non configuré');
    }

    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'group', // Ou 'individual' si c'est un numéro
      to: groupId,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erreur WhatsApp: ${error}`);
    }
  }

  /**
   * Envoie un document PDF vers un groupe WhatsApp
   */
  private async sendPDFDocument(
    groupId: string,
    pdfUrl: string,
    filename: string,
    caption?: string
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp non configuré');
    }

    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'group',
      to: groupId,
      type: 'document',
      document: {
        link: pdfUrl,
        filename: filename,
        caption: caption || '',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erreur WhatsApp PDF: ${error}`);
    }
  }

  /**
   * Liste les groupes WhatsApp disponibles
   */
  async listGroups(): Promise<WhatsAppGroup[]> {
    // Note: L'API WhatsApp Business ne permet pas de lister les groupes directement
    // Cette fonctionnalité nécessiterait d'utiliser WhatsApp Business API avec webhook
    // Pour l'instant, les groupes doivent être configurés manuellement

    // TODO: Intégrer avec webhook WhatsApp pour récupérer les groupes dynamiquement
    // ou stocker les groupes dans Airtable

    return [];
  }

  /**
   * Teste l'envoi vers un groupe
   */
  async testConnection(groupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sendTextMessage(
        groupId,
        '✅ Test de connexion DDM - Le service de rapports WhatsApp fonctionne correctement!'
      );

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur inconnue',
      };
    }
  }
}
