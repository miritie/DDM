/**
 * Générateur PDF — reçu de vente A6 (format portable, optimisé partage mobile).
 *
 * Le PDF reprend les informations du SaleReceiptModal en format imprimable
 * professionnel : en-tête entreprise + lieu, n° de vente, articles, totaux,
 * mode de paiement, mention client si présent, pied de page de remerciement.
 *
 * Format A6 (10,5 × 14,8 cm) — assez compact pour s'imprimer en tickets ou
 * être lu confortablement sur un écran mobile à 100%. Plus petit que A4
 * gaspille moins de papier si imprimé.
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface SaleReceiptPdfData {
  saleNumber: string;
  date: string;                  // ISO
  outletName: string;
  sellerName: string;
  companyName?: string;          // « DUNE DE MIEL » par défaut
  companyTagline?: string;       // « Le meilleur du miel » par défaut
  clientLabel: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentMethodLabel: string;
  currency?: string;             // 'XOF' par défaut
}

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + currency;

/**
 * Génère un Blob PDF prêt à download ou partager via Web Share API.
 */
export function generateSaleReceiptPdf(data: SaleReceiptPdfData): Blob {
  const currency = data.currency ?? 'XOF';
  const companyName = data.companyName ?? 'DUNE DE MIEL';
  const tagline = data.companyTagline ?? 'Le meilleur du miel';

  // A6 portrait : 105 × 148 mm. Marges 6 mm de chaque côté.
  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
  const W = 105;
  const margin = 6;
  const innerW = W - 2 * margin;

  // === En-tête entreprise ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(60, 30, 0); // brun chaud
  doc.text(companyName, W / 2, 10, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 90, 50);
  doc.text(tagline, W / 2, 14, { align: 'center' });

  // Trait
  doc.setDrawColor(180, 150, 100);
  doc.setLineWidth(0.3);
  doc.line(margin, 17, W - margin, 17);

  // === Titre + n° vente ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('REÇU DE VENTE', W / 2, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('N° ' + data.saleNumber, W / 2, 26, { align: 'center' });

  // === Méta ===
  let y = 31;
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  const dateStr = new Date(data.date).toLocaleString('fr-FR', {
    dateStyle: 'short', timeStyle: 'short',
  });
  doc.text('Stand : ' + data.outletName, margin, y);
  doc.text(dateStr, W - margin, y, { align: 'right' });
  y += 4;
  doc.text('Vendeur : ' + data.sellerName, margin, y);
  y += 4;
  if (data.clientLabel) {
    doc.setTextColor(60, 80, 160);
    doc.text('Client : ' + data.clientLabel, margin, y);
    doc.setTextColor(80, 80, 80);
    y += 4;
  }

  // === Tableau articles ===
  doc.autoTable({
    startY: y + 1,
    margin: { left: margin, right: margin },
    head: [['Article', 'Qté', 'P.U.', 'Total']],
    body: data.items.map(it => [
      it.name,
      String(Math.round(it.quantity)),
      fmt(it.unitPrice, currency),
      fmt(it.quantity * it.unitPrice, currency),
    ]),
    styles: { fontSize: 7, cellPadding: 1.2 },
    headStyles: {
      fillColor: [102, 60, 20],
      textColor: 255,
      fontSize: 7,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 9, halign: 'center' },
      2: { cellWidth: 19, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
    },
  });

  // === Totaux ===
  let yt = doc.lastAutoTable.finalY + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const labelX = margin;
  const valueX = W - margin;

  doc.text('Total', labelX, yt);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(data.totalAmount, currency), valueX, yt, { align: 'right' });
  yt += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 110, 60);
  doc.text('Encaissé (' + data.paymentMethodLabel + ')', labelX, yt);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(data.amountPaid, currency), valueX, yt, { align: 'right' });
  yt += 5;

  if (data.balance > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 100, 0);
    doc.text('Reste à recouvrer', labelX, yt);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(data.balance, currency), valueX, yt, { align: 'right' });
    yt += 5;
  }

  // === Pied de page ===
  doc.setDrawColor(180, 150, 100);
  doc.line(margin, yt + 1, W - margin, yt + 1);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 90, 50);
  doc.text('Merci de votre achat !', W / 2, yt + 5, { align: 'center' });

  // Petit footer technique
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(160, 160, 160);
  const generated = 'Généré le ' + new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  doc.text(generated, W / 2, 145, { align: 'center' });

  return doc.output('blob');
}

/**
 * Tente le partage natif (Web Share API niveau 2 — partage fichier).
 * Sinon, télécharge le PDF et retourne false pour que l'appelant
 * affiche un fallback (par ex. ouvrir WhatsApp Web).
 */
export async function shareSaleReceiptPdf(
  data: SaleReceiptPdfData,
  blob?: Blob,
): Promise<{ shared: boolean; downloaded: boolean }> {
  const pdf = blob ?? generateSaleReceiptPdf(data);
  const filename = `recu-${data.saleNumber}.pdf`;
  const file = new File([pdf], filename, { type: 'application/pdf' });

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (nav?.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'Reçu de vente ' + data.saleNumber,
        text: 'Voici votre reçu de vente.',
      });
      return { shared: true, downloaded: false };
    } catch {
      // L'utilisateur a annulé — on tombe sur le download
    }
  }
  // Fallback : download
  downloadSaleReceiptPdf(data, pdf);
  return { shared: false, downloaded: true };
}

export function downloadSaleReceiptPdf(data: SaleReceiptPdfData, blob?: Blob): void {
  const pdf = blob ?? generateSaleReceiptPdf(data);
  const url = URL.createObjectURL(pdf);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recu-${data.saleNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libère l'URL après un court délai (le download a démarré)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
