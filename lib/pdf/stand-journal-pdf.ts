/**
 * Générateur PDF — Journal de stand journalier.
 *
 * Reprend la structure du journal papier DUNE DE MIEL :
 *   - En-tête entreprise + lieu + date
 *   - Observation de la journée (= closing notes des sessions)
 *   - Tableau produits vendus (Produit / Qté / Recette)
 *   - Tableau ventes par commercial (Nom / Nb ventes / CA / Encaissé)
 *   - Tableau dépôts du jour (Destination / Total / Nb)
 *   - Totaux : CA, encaissé, déposé, cash en fin de session (si Z-out)
 *   - Signature
 *
 * Format A4 portrait — lisible imprimé OU transmissible par WhatsApp.
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface StandJournalSession {
  userName: string;
  startedAt: string;
  endedAt: string | null;
  closingCashExpected: number | null;
  closingCashCounted: number | null;
  closingDiscrepancy: number | null;
  notes: string | null;
}

export interface StandJournalPdfData {
  outletName: string;
  outletCode: string;
  date: string;                    // 'YYYY-MM-DD'
  companyName?: string;
  companyTagline?: string;
  sessions: StandJournalSession[];
  byProduct: Array<{ name: string; code: string; qty: number; revenue: number }>;
  bySeller: Array<{ name: string; salesCount: number; revenue: number; paid: number }>;
  deposits: Array<{ destinationType: string; label: string; total: number; count: number }>;
  totals: { salesCount: number; revenue: number; paid: number; deposited: number };
  currency?: string;
}

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + currency;

const DEST_LABELS: Record<string, string> = {
  bank: 'Banque',
  mobile_money: 'Mobile Money',
  person: 'Remise espèces',
};

export function generateStandJournalPdf(data: StandJournalPdfData): Blob {
  const currency = data.currency ?? 'XOF';
  const companyName = data.companyName ?? 'DUNE DE MIEL';
  const tagline = data.companyTagline ?? 'Le meilleur du miel';

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210;
  const margin = 14;
  const innerW = W - 2 * margin;

  // === En-tête entreprise ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(60, 30, 0);
  doc.text(companyName, margin, 18);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120, 90, 50);
  doc.text(tagline, margin, 23);

  // Cadre date + stand à droite
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const dateStr = new Date(data.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  doc.text(`JOURNAL DU ${dateStr.toUpperCase()}`, W - margin, 18, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(data.outletName.toUpperCase(), W - margin, 24, { align: 'right' });

  // Trait
  doc.setDrawColor(102, 60, 20);
  doc.setLineWidth(0.6);
  doc.line(margin, 28, W - margin, 28);

  // === Sessions + observations ===
  let y = 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('OUVERTURE / FERMETURE / OBSERVATION', margin, y);
  y += 4;

  if (data.sessions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('(Aucune session POS enregistrée ce jour)', margin, y);
    y += 4;
  } else {
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Vendeur', 'Ouvert', 'Fermé', 'Cash attendu', 'Compté', 'Écart', 'Observation']],
      body: data.sessions.map(s => [
        s.userName,
        new Date(s.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        s.endedAt ? new Date(s.endedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
        s.closingCashExpected !== null ? fmt(s.closingCashExpected, currency) : '—',
        s.closingCashCounted !== null ? fmt(s.closingCashCounted, currency) : '—',
        s.closingDiscrepancy !== null
          ? (s.closingDiscrepancy > 0 ? '+' : '') + fmt(s.closingDiscrepancy, currency)
          : '—',
        s.notes ?? '',
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255, fontSize: 7 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // === Tableau produits ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('VENTES PAR PRODUIT', margin, y);
  y += 2;

  if (data.byProduct.length === 0) {
    y += 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('(Aucune vente ce jour)', margin, y);
    y += 6;
  } else {
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Produit', 'Code', 'Qté vendue', 'Recette']],
      body: data.byProduct.map(p => [
        p.name, p.code, String(Math.round(p.qty)), fmt(p.revenue, currency),
      ]),
      foot: [[
        '', '', 'TOTAL',
        fmt(data.byProduct.reduce((s, p) => s + p.revenue, 0), currency),
      ]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255 },
      footStyles: { fillColor: [240, 230, 210], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // === Tableau commerciaux ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('VENTES PAR COMMERCIAL', margin, y);
  y += 2;

  if (data.bySeller.length === 0) {
    y += 6;
  } else {
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Commercial', 'Nb ventes', 'CA', 'Encaissé', 'Signature']],
      body: data.bySeller.map(s => [
        s.name, String(s.salesCount),
        fmt(s.revenue, currency), fmt(s.paid, currency),
        '', // signature manuelle
      ]),
      styles: { fontSize: 8, cellPadding: 1.5, minCellHeight: 10 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { cellWidth: 40 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // === Dépôts caisse ===
  if (data.deposits.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('VERSEMENTS DE CAISSE', margin, y);
    y += 2;
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Destination', 'Type', 'Nb', 'Total']],
      body: data.deposits.map(d => [
        d.label, DEST_LABELS[d.destinationType] ?? d.destinationType,
        String(d.count), fmt(d.total, currency),
      ]),
      foot: [[
        '', '', 'TOTAL DÉPOSÉ',
        fmt(data.totals.deposited, currency),
      ]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255 },
      footStyles: { fillColor: [240, 230, 210], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // === Totaux récapitulatifs ===
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFillColor(102, 60, 20);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, innerW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL VENTE DU JOUR', margin + 4, y + 7);
  doc.setFontSize(14);
  doc.text(fmt(data.totals.revenue, currency), W - margin - 4, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${data.totals.salesCount} vente(s) · encaissé ${fmt(data.totals.paid, currency)} · déposé ${fmt(data.totals.deposited, currency)}`,
    margin + 4, y + 13
  );
  y += 24;

  // === Signature superviseur ===
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SIGNATURE DU SUPERVISEUR DU STAND', margin, y);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 14, margin + 80, y + 14);

  // === Footer technique ===
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Généré automatiquement le ${new Date().toLocaleString('fr-FR')} · ${companyName}`,
    W / 2, 290, { align: 'center' }
  );

  return doc.output('blob');
}

export async function shareStandJournalPdf(data: StandJournalPdfData): Promise<{ shared: boolean }> {
  const blob = generateStandJournalPdf(data);
  const filename = `journal-${data.outletCode}-${data.date}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (nav?.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return { shared: true };
    } catch { /* user cancelled */ }
  }
  downloadStandJournalPdf(data, blob);
  return { shared: false };
}

export function downloadStandJournalPdf(data: StandJournalPdfData, blob?: Blob): void {
  const pdf = blob ?? generateStandJournalPdf(data);
  const url = URL.createObjectURL(pdf);
  const a = document.createElement('a');
  a.href = url;
  a.download = `journal-${data.outletCode}-${data.date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
