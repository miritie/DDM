/**
 * Générateur PDF — reçu de vente A6 (format portable, optimisé partage mobile).
 *
 * Le PDF reprend les informations du SaleReceiptModal en format imprimable
 * professionnel : logo + identité entreprise, bandeau titre, carte méta
 * (stand / vendeur / client / date), tableau articles, totaux, mention
 * crédit éventuelle, pied de page de remerciement + contacts.
 *
 * Format A6 (10,5 × 14,8 cm) — assez compact pour s'imprimer en tickets ou
 * être lu confortablement sur un écran mobile à 100%.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// jspdf-autotable v5 : API fonctionnelle pour survivre au minify de prod
// (cf. lib/pdf/stand-journal-pdf.ts pour le détail du bug Safari iOS).
type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

/** Logo prêt à embarquer (dataURL + dimensions naturelles, voir loadReceiptLogo). */
export interface ReceiptLogo {
  dataUrl: string;
  width: number;
  height: number;
}

export interface SaleReceiptPdfData {
  saleNumber: string;
  date: string;                  // ISO
  outletName: string;
  sellerName: string;
  companyName?: string;          // « DUNE DE MIEL » par défaut
  companyTagline?: string;       // « Le meilleur du miel » par défaut
  companyAddress?: string | null;
  companyPhone?: string | null;
  logo?: ReceiptLogo | null;     // pré-chargé via loadReceiptLogo()
  clientLabel: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentMethodLabel: string;
  currency?: string;             // 'XOF' par défaut
}

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[\u202F\u00A0]/g, ' ') + ' ' + currency;

// Palette du reçu — cohérente avec l'identité « miel » de l'app.
const BROWN: [number, number, number] = [92, 51, 10];     // brun profond
const BROWN_SOFT: [number, number, number] = [128, 90, 45];
const GOLD: [number, number, number] = [196, 154, 88];
const CREAM: [number, number, number] = [250, 245, 235];
const GREEN: [number, number, number] = [16, 122, 67];
const AMBER: [number, number, number] = [178, 108, 0];
const GRAY: [number, number, number] = [110, 110, 110];

/**
 * Charge le logo (URL Cloudinary/locale) en dataURL PNG redimensionné,
 * prêt pour doc.addImage(). Retourne null en cas d'échec (CORS, 404,
 * offline) — le reçu se génère alors sans logo, jamais d'erreur bloquante.
 */
export async function loadReceiptLogo(url?: string | null): Promise<ReceiptLogo | null> {
  if (!url || typeof window === 'undefined') return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo load failed'));
      img.src = url;
    });
    // Downscale à 256 px max : suffisant pour ~25 mm imprimés, garde le
    // PDF léger pour le partage WhatsApp.
    const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/**
 * Génère un Blob PDF prêt à download ou partager via Web Share API.
 */
export function generateSaleReceiptPdf(data: SaleReceiptPdfData): Blob {
  const currency = data.currency ?? 'XOF';
  const companyName = data.companyName ?? 'DUNE DE MIEL';
  const tagline = data.companyTagline ?? 'Le meilleur du miel';

  // A6 portrait : 105 × 148 mm. Marges 7 mm.
  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
  const W = 105;
  const H = 148;
  const margin = 7;
  const innerW = W - 2 * margin;

  // === En-tête : logo + identité ===
  let y = 8;
  if (data.logo) {
    // Logo centré, contraint à 22 mm de large / 13 mm de haut (ratio gardé)
    const maxW = 22;
    const maxH = 13;
    const ratio = data.logo.width / Math.max(1, data.logo.height);
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(data.logo.dataUrl, 'PNG', (W - w) / 2, y, w, h);
    y += h + 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...BROWN);
  doc.text(companyName, W / 2, y + 3, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...BROWN_SOFT);
  doc.text(tagline, W / 2, y, { align: 'center' });
  y += 3.5;

  const contactBits = [data.companyAddress, data.companyPhone].filter(Boolean) as string[];
  if (contactBits.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRAY);
    doc.text(contactBits.join('  ·  '), W / 2, y, { align: 'center' });
    y += 3;
  }

  // Filet décoratif double (épais doré + fin)
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.7);
  doc.line(margin, y + 1, W - margin, y + 1);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 2.2, W - margin, y + 2.2);
  y += 5.5;

  // === Bandeau titre ===
  doc.setFillColor(...BROWN);
  doc.roundedRect(margin, y, innerW, 10.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('REÇU DE VENTE', W / 2, y + 4.6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(245, 232, 210);
  doc.text('N° ' + data.saleNumber, W / 2, y + 8.6, { align: 'center' });
  y += 14;

  // === Carte méta (stand / vendeur / client / date) ===
  const metaLines = 2 + (data.clientLabel ? 1 : 0);
  const metaH = metaLines * 4.4 + 3.2;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin, y, innerW, metaH, 1.5, 1.5, 'FD');

  const dateStr = new Date(data.date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  let my = y + 4.4;
  const metaLabel = (label: string, value: string, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...BROWN_SOFT);
    doc.text(label, margin + 2.5, yy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 45, 45);
    doc.text(value, margin + 19, yy);
  };
  metaLabel('Stand', data.outletName, my);
  // Date/heure à droite de la 1re ligne
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text(dateStr, W - margin - 2.5, my, { align: 'right' });
  my += 4.4;
  metaLabel('Vendeur', data.sellerName, my);
  my += 4.4;
  if (data.clientLabel) {
    metaLabel('Client', data.clientLabel, my);
  }
  y += metaH + 3.5;

  // === Tableau articles ===
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Article', 'Qté', 'P.U.', 'Total']],
    body: data.items.map(it => [
      it.name,
      String(Math.round(it.quantity)),
      fmt(it.unitPrice, currency),
      fmt(it.quantity * it.unitPrice, currency),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [40, 40, 40] },
    headStyles: {
      fillColor: BROWN,
      textColor: 255,
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 1.8,
    },
    alternateRowStyles: { fillColor: CREAM },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 9, halign: 'center' },
      2: { cellWidth: 19, halign: 'right' },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
  });

  // === Totaux ===
  let yt = (doc as DocWithAutoTable).lastAutoTable.finalY + 4;
  // Garde-fou : si le tableau approche le bas de page, continue sur une 2e page
  if (yt > H - 34) {
    doc.addPage();
    yt = 12;
  }

  const labelX = margin + 1;
  const valueX = W - margin - 1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...BROWN);
  doc.text('TOTAL', labelX, yt);
  doc.text(fmt(data.totalAmount, currency), valueX, yt, { align: 'right' });
  yt += 2.2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.2);
  doc.line(margin, yt, W - margin, yt);
  yt += 4.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text('Encaissé · ' + data.paymentMethodLabel, labelX, yt);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(data.amountPaid, currency), valueX, yt, { align: 'right' });
  yt += 5;

  if (data.balance > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...AMBER);
    doc.text('Reste à recouvrer', labelX, yt);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(data.balance, currency), valueX, yt, { align: 'right' });
    yt += 5;
  }

  // === Pied de page ===
  // Remerciement juste sous les totaux…
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...BROWN_SOFT);
  doc.text('Merci de votre achat !', W / 2, yt + 4, { align: 'center' });

  // …et bloc technique ancré en bas de la dernière page.
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(margin, H - 9, W - margin, H - 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(170, 170, 170);
  const generated =
    companyName + ' — reçu généré le ' +
    new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  doc.text(generated, W / 2, H - 5.5, { align: 'center' });

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
