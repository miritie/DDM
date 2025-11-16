/**
 * Service - Génération PDF Avancée
 * Création de rapports PDF professionnels avec signatures simulées
 * Support de multiples formats: Décaissement, Point Flash, Rapports Analytics
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ReportExecution, Sale, Expense, Employee } from '@/types/modules';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export interface PDFSignature {
  name: string;
  role: string;
  date: string;
  simulatedSignature?: boolean; // Si true, génère une signature visuelle
}

export interface PDFDecaissement {
  decaissementId: string;
  expenseId: string;
  expenseTitle: string;
  amount: number;
  beneficiary: string;
  category: string;
  requestDate: string;
  approvalDate?: string;
  paymentDate?: string;

  // Workflow de validation
  requestedBy: PDFSignature;
  approvedBy?: PDFSignature[];
  paidBy?: PDFSignature;

  // Détails additionnels
  description?: string;
  attachments?: string[];
  notes?: string;
}

export interface PDFPointFlash {
  week: string; // Ex: "Semaine 42 - 2025"
  period: { start: string; end: string };
  generatedAt: string;

  // KPIs principaux
  kpis: {
    revenue: { value: number; trend: number; target?: number };
    expenses: { value: number; trend: number; budget?: number };
    profit: { value: number; trend: number };
    cashBalance: { value: number; trend: number };
    salesCount: { value: number; trend: number };
    newCustomers: { value: number };
    productivity: { value: number; trend: number }; // %
  };

  // Top performers
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  topSalespersons?: Array<{ name: string; salesCount: number; revenue: number }>;

  // Alertes
  alerts?: Array<{ type: 'success' | 'warning' | 'error'; message: string }>;

  // Objectifs
  objectives?: Array<{ label: string; achieved: number; target: number; progress: number }>;

  // Signature DG
  signature: PDFSignature;
}

export class PDFGeneratorService {
  private readonly primaryColor = '#2563eb'; // Blue
  private readonly secondaryColor = '#64748b'; // Gray
  private readonly successColor = '#10b981'; // Green
  private readonly dangerColor = '#ef4444'; // Red
  private readonly warningColor = '#f59e0b'; // Orange

  /**
   * Génère une fiche de décaissement PDF
   */
  async generateDecaissementPDF(data: PDFDecaissement): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPos = 15;

    // Header avec logo et titre
    this.addHeader(doc, 'FICHE DE DÉCAISSEMENT', yPos);
    yPos += 25;

    // Numéro de référence
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`N° ${data.decaissementId}`, 15, yPos);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(data.requestDate).toLocaleDateString('fr-FR')}`, 150, yPos, { align: 'right' });
    yPos += 10;

    // Informations principales (Tableau)
    doc.autoTable({
      startY: yPos,
      head: [['Information', 'Détail']],
      body: [
        ['Bénéficiaire', data.beneficiary],
        ['Catégorie', data.category],
        ['Montant', this.formatCurrency(data.amount)],
        ['Objet', data.expenseTitle],
        ...(data.description ? [['Description', data.description]] : []),
      ],
      theme: 'striped',
      headStyles: { fillColor: this.hexToRgb(this.primaryColor) },
      styles: { fontSize: 10 },
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // Description détaillée si existe
    if (data.description && data.description.length > 50) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Description détaillée:', 15, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      const splitDescription = doc.splitTextToSize(data.description, 180);
      doc.text(splitDescription, 15, yPos);
      yPos += splitDescription.length * 5 + 10;
    }

    // Section Signatures
    yPos = this.checkPageBreak(doc, yPos, 80);

    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('WORKFLOW DE VALIDATION', 20, yPos + 6);
    yPos += 15;

    // Signature demandeur
    this.addSignatureBlock(doc, data.requestedBy, 15, yPos, 'Demandeur');

    // Signatures approbateurs
    if (data.approvedBy && data.approvedBy.length > 0) {
      let xPosApprovers = 15;
      data.approvedBy.forEach((approver, index) => {
        if (index > 0 && index % 2 === 0) {
          yPos += 35;
          xPosApprovers = 15;
        }
        this.addSignatureBlock(doc, approver, xPosApprovers, yPos, `Approbateur ${index + 1}`);
        xPosApprovers += 95;
      });
      yPos += 35;
    }

    // Signature payeur si payé
    if (data.paidBy) {
      yPos = this.checkPageBreak(doc, yPos, 40);
      this.addSignatureBlock(doc, data.paidBy, 15, yPos, 'Payé par');
      yPos += 35;
    }

    // Footer
    this.addFooter(doc);

    return doc.output('blob');
  }

  /**
   * Génère un Point Flash PDF hebdomadaire
   */
  async generatePointFlashPDF(data: PDFPointFlash): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPos = 15;

    // Header
    this.addHeader(doc, 'POINT FLASH HEBDOMADAIRE', yPos);
    yPos += 20;

    // Période et date génération
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.week, 15, yPos);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Du ${new Date(data.period.start).toLocaleDateString('fr-FR')} au ${new Date(data.period.end).toLocaleDateString('fr-FR')}`,
      15,
      yPos + 5
    );
    doc.text(
      `Généré le ${new Date(data.generatedAt).toLocaleDateString('fr-FR')} à ${new Date(data.generatedAt).toLocaleTimeString('fr-FR')}`,
      150,
      yPos,
      { align: 'right' }
    );
    yPos += 15;

    // Section KPIs
    doc.setFillColor(...this.hexToRgb(this.primaryColor));
    doc.rect(15, yPos, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INDICATEURS CLÉS', 20, yPos + 6);
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    // KPIs Grid (2 colonnes)
    const kpiData = [
      ['Chiffre d\'affaires', this.formatCurrency(data.kpis.revenue.value), this.formatTrend(data.kpis.revenue.trend)],
      ['Dépenses', this.formatCurrency(data.kpis.expenses.value), this.formatTrend(data.kpis.expenses.trend)],
      ['Bénéfice net', this.formatCurrency(data.kpis.profit.value), this.formatTrend(data.kpis.profit.trend)],
      ['Trésorerie', this.formatCurrency(data.kpis.cashBalance.value), this.formatTrend(data.kpis.cashBalance.trend)],
      ['Nombre de ventes', data.kpis.salesCount.value.toString(), this.formatTrend(data.kpis.salesCount.trend)],
      ['Nouveaux clients', data.kpis.newCustomers.value.toString(), '-'],
      ['Productivité', `${data.kpis.productivity.value.toFixed(1)}%`, this.formatTrend(data.kpis.productivity.trend)],
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Indicateur', 'Valeur', 'Évolution']],
      body: kpiData,
      theme: 'striped',
      headStyles: { fillColor: this.hexToRgb(this.primaryColor) },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 60, halign: 'right' },
        2: { cellWidth: 40, halign: 'center' },
      },
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // Top Produits
    if (data.topProducts && data.topProducts.length > 0) {
      yPos = this.checkPageBreak(doc, yPos, 60);

      doc.setFillColor(...this.hexToRgb(this.successColor));
      doc.rect(15, yPos, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('TOP 5 PRODUITS', 20, yPos + 6);
      doc.setTextColor(0, 0, 0);
      yPos += 12;

      const topProductsData = data.topProducts.slice(0, 5).map((p, idx) => [
        `${idx + 1}. ${p.name}`,
        p.quantity.toString(),
        this.formatCurrency(p.revenue),
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Produit', 'Qté', 'CA']],
        body: topProductsData,
        theme: 'striped',
        headStyles: { fillColor: this.hexToRgb(this.successColor) },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 50 },
        },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Top Commerciaux (si disponible)
    if (data.topSalespersons && data.topSalespersons.length > 0) {
      yPos = this.checkPageBreak(doc, yPos, 60);

      doc.setFillColor(...this.hexToRgb(this.primaryColor));
      doc.rect(15, yPos, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('TOP COMMERCIAUX', 20, yPos + 6);
      doc.setTextColor(0, 0, 0);
      yPos += 12;

      const topSalesData = data.topSalespersons.slice(0, 5).map((s, idx) => [
        `${idx + 1}. ${s.name}`,
        s.salesCount.toString(),
        this.formatCurrency(s.revenue),
      ]);

      doc.autoTable({
        startY: yPos,
        head: [['Commercial', 'Ventes', 'CA']],
        body: topSalesData,
        theme: 'striped',
        headStyles: { fillColor: this.hexToRgb(this.primaryColor) },
        styles: { fontSize: 9 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 50 },
        },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Alertes (si existent)
    if (data.alerts && data.alerts.length > 0) {
      yPos = this.checkPageBreak(doc, yPos, 40);

      doc.setFillColor(...this.hexToRgb(this.warningColor));
      doc.rect(15, yPos, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('ALERTES & POINTS D\'ATTENTION', 20, yPos + 6);
      doc.setTextColor(0, 0, 0);
      yPos += 12;

      data.alerts.forEach((alert) => {
        const color = alert.type === 'success' ? this.successColor :
                      alert.type === 'warning' ? this.warningColor : this.dangerColor;

        doc.setFillColor(...this.hexToRgb(color));
        doc.circle(18, yPos + 2, 2, 'F');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const splitMessage = doc.splitTextToSize(alert.message, 170);
        doc.text(splitMessage, 23, yPos + 3);
        yPos += splitMessage.length * 4 + 3;
      });

      yPos += 5;
    }

    // Objectifs (si existent)
    if (data.objectives && data.objectives.length > 0) {
      yPos = this.checkPageBreak(doc, yPos, 60);

      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPos, 180, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('OBJECTIFS & PROGRESSION', 20, yPos + 6);
      yPos += 12;

      data.objectives.forEach((obj) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(obj.label, 15, yPos);

        doc.setFont('helvetica', 'normal');
        doc.text(`${obj.achieved.toFixed(0)} / ${obj.target.toFixed(0)} (${obj.progress.toFixed(1)}%)`, 150, yPos, { align: 'right' });

        // Progress bar
        yPos += 3;
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, yPos, 170, 4);

        const progressWidth = (obj.progress / 100) * 170;
        const progressColor = obj.progress >= 100 ? this.successColor :
                              obj.progress >= 75 ? this.primaryColor :
                              obj.progress >= 50 ? this.warningColor : this.dangerColor;
        doc.setFillColor(...this.hexToRgb(progressColor));
        doc.rect(15, yPos, progressWidth, 4, 'F');

        yPos += 8;
      });

      yPos += 5;
    }

    // Signature DG
    yPos = this.checkPageBreak(doc, yPos, 40);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature Direction Générale', 15, yPos);
    yPos += 5;

    this.addSignatureBlock(doc, data.signature, 15, yPos, '', 'small');

    // Footer
    this.addFooter(doc);

    return doc.output('blob');
  }

  /**
   * Génère un rapport standard PDF
   */
  async generateReportPDF(
    reportExecution: ReportExecution,
    reportName: string,
    reportType: string
  ): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPos = 15;

    // Header
    this.addHeader(doc, reportName.toUpperCase(), yPos);
    yPos += 20;

    // Métadonnées
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Type: ${reportType}`, 15, yPos);
    doc.text(`Généré le: ${new Date(reportExecution.StartedAt).toLocaleString('fr-FR')}`, 15, yPos + 4);
    doc.text(`ID: ${reportExecution.ExecutionId}`, 15, yPos + 8);
    yPos += 15;

    // Contenu (selon ResultData)
    const data = reportExecution.ResultData;

    if (data) {
      // Essayer de générer un tableau depuis les données
      try {
        if (typeof data === 'object') {
          const tableData = this.convertDataToTable(data);

          if (tableData.headers.length > 0 && tableData.rows.length > 0) {
            doc.autoTable({
              startY: yPos,
              head: [tableData.headers],
              body: tableData.rows,
              theme: 'striped',
              headStyles: { fillColor: this.hexToRgb(this.primaryColor) },
              styles: { fontSize: 8 },
            });
          }
        }
      } catch (error) {
        // Fallback: afficher JSON formaté
        doc.setFontSize(8);
        doc.setFont('courier', 'normal');
        const jsonStr = JSON.stringify(data, null, 2);
        const splitText = doc.splitTextToSize(jsonStr, 180);
        doc.text(splitText.slice(0, 100), 15, yPos); // Max 100 lignes
      }
    }

    // Footer
    this.addFooter(doc);

    return doc.output('blob');
  }

  /**
   * Ajoute un header professionnel
   */
  private addHeader(doc: jsPDF, title: string, yPos: number): void {
    // Logo/Nom entreprise (à gauche)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.hexToRgb(this.primaryColor));
    doc.text('DDM', 15, yPos);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.hexToRgb(this.secondaryColor));
    doc.text('Gestion d\'Entreprise', 15, yPos + 4);

    // Titre principal (centre)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(title, 105, yPos + 2, { align: 'center' });

    // Ligne séparatrice
    doc.setDrawColor(...this.hexToRgb(this.primaryColor));
    doc.setLineWidth(0.5);
    doc.line(15, yPos + 8, 195, yPos + 8);

    doc.setTextColor(0, 0, 0); // Reset color
  }

  /**
   * Ajoute un footer avec pagination
   */
  private addFooter(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Ligne séparatrice
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(15, 282, 195, 282);

      // Texte footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);

      doc.text('DDM - Gestion d\'Entreprise', 15, 287);
      doc.text(`Page ${i} / ${pageCount}`, 195, 287, { align: 'right' });
      doc.text(new Date().toLocaleDateString('fr-FR'), 105, 287, { align: 'center' });
    }

    doc.setTextColor(0, 0, 0); // Reset
  }

  /**
   * Ajoute un bloc de signature
   */
  private addSignatureBlock(
    doc: jsPDF,
    signature: PDFSignature,
    x: number,
    y: number,
    label?: string,
    size: 'small' | 'normal' = 'normal'
  ): void {
    const width = size === 'small' ? 60 : 85;
    const height = size === 'small' ? 25 : 30;

    // Cadre
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(x, y, width, height);

    // Label optionnel
    if (label) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(label, x + 2, y + 4);
      y += 5;
    }

    // Nom
    doc.setFontSize(size === 'small' ? 8 : 9);
    doc.setFont('helvetica', 'bold');
    doc.text(signature.name, x + 2, y + 4);

    // Rôle
    doc.setFontSize(size === 'small' ? 7 : 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(signature.role, x + 2, y + 8);

    // Signature simulée (si demandée)
    if (signature.simulatedSignature !== false) {
      doc.setFont('brush-script-mt', 'italic');
      doc.setFontSize(size === 'small' ? 12 : 16);
      doc.setTextColor(...this.hexToRgb(this.primaryColor));

      // Génère un texte "signature manuscrite"
      const signatureText = signature.name.split(' ').map(w => w[0]).join('');
      doc.text(signatureText, x + width - 15, y + 18, { align: 'right' });
    }

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(new Date(signature.date).toLocaleDateString('fr-FR'), x + 2, y + height - 3);

    doc.setTextColor(0, 0, 0); // Reset
  }

  /**
   * Vérifie si on doit ajouter une nouvelle page
   */
  private checkPageBreak(doc: jsPDF, currentY: number, requiredSpace: number): number {
    if (currentY + requiredSpace > 270) {
      doc.addPage();
      return 20; // Nouvelle position Y
    }
    return currentY;
  }

  /**
   * Formate un montant en FCFA
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Formate une tendance
   */
  private formatTrend(trend: number): string {
    if (trend === 0) return '→ 0%';
    const sign = trend > 0 ? '↗' : '↘';
    const color = trend > 0 ? 'green' : 'red';
    return `${sign} ${Math.abs(trend).toFixed(1)}%`;
  }

  /**
   * Convertit hex en RGB
   */
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  /**
   * Convertit des données objet en tableau pour autotable
   */
  private convertDataToTable(data: any): { headers: string[]; rows: any[][] } {
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map(item => headers.map(h => item[h] || '-'));
      return { headers, rows };
    }

    if (typeof data === 'object' && data !== null) {
      const headers = ['Clé', 'Valeur'];
      const rows = Object.entries(data).map(([key, value]) => [
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      ]);
      return { headers, rows };
    }

    return { headers: [], rows: [] };
  }
}
