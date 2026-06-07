/**
 * Générateur PDF — Journal de stand journalier.
 *
 * Reprend la structure du journal papier DUNE DE MIEL :
 *   - En-tête entreprise + lieu + date
 *   - Sessions POS (ouverture/fermeture/cash)
 *   - Observation de la journée (saisie par le commercial)
 *   - Inventaire & mouvement de stock par produit
 *     (Stock matin / Reçu / Sorti / Vendu / Stock soir / Recette)
 *   - Ventes par commercial (Nom / Nb ventes / CA / Encaissé / Signature)
 *   - Versements de caisse (banque / mobile money / personne)
 *   - Total vente du jour
 *   - Signature superviseur
 *
 * Format A4 portrait — lisible imprimé OU transmissible par WhatsApp.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// jspdf-autotable v5 : on utilise l'API fonctionnelle `autoTable(doc, opts)`
// au lieu de `doc.autoTable(opts)`. Le side-effect qui attache la méthode au
// prototype est éliminé en build de production minifié → Safari iOS renvoie
// « i.autoTable is not a function ». La forme fonctionnelle est immune.
// `doc.lastAutoTable.finalY` reste assigné par autoTable lui-même.
type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export interface StandJournalSession {
  userName: string;
  startedAt: string;
  endedAt: string | null;
  closingCashExpected: number | null;
  closingCashCounted: number | null;
  closingDiscrepancy: number | null;
  notes: string | null;
}

export interface StandJournalProductLine {
  name: string;
  code: string;
  qty: number;                  // quantité vendue
  revenue: number;              // CA du produit
  openingInventory: number;     // stock au matin
  closingInventory: number;     // stock au soir (= actuel)
  transfersIn: number;          // reçus dans la journée
  transfersOut: number;         // envoyés ailleurs dans la journée
}

export interface StandJournalObservation {
  text: string;
  authorName: string | null;
  updatedAt: string | Date | null;
}

export interface StandJournalPdfData {
  outletName: string;
  outletCode: string;
  date: string;                    // 'YYYY-MM-DD'
  companyName?: string;
  companyTagline?: string;
  sessions: StandJournalSession[];
  byProduct: StandJournalProductLine[];
  bySeller: Array<{ name: string; salesCount: number; revenue: number; paid: number }>;
  deposits: Array<{ destinationType: string; label: string; total: number; count: number }>;
  payouts?: Array<{ kind: string; sellerName: string; units: number; amount: number }>;
  totals: { salesCount: number; revenue: number; paid: number; deposited: number; payouts?: number };
  observation?: StandJournalObservation | null;
  currency?: string;
}

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + currency;

const num = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

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
  const H = 297;
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

  doc.setDrawColor(102, 60, 20);
  doc.setLineWidth(0.6);
  doc.line(margin, 28, W - margin, 28);

  // === Sessions POS ===
  let y = 33;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('SESSIONS POS', margin, y);
  y += 2;

  if (data.sessions.length === 0) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('(Aucune session POS enregistrée ce jour)', margin, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Vendeur', 'Ouvert', 'Fermé', 'Cash attendu', 'Compté', 'Écart']],
      body: data.sessions.map(s => [
        s.userName,
        new Date(s.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        s.endedAt ? new Date(s.endedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—',
        s.closingCashExpected !== null ? fmt(s.closingCashExpected, currency) : '—',
        s.closingCashCounted !== null ? fmt(s.closingCashCounted, currency) : '—',
        s.closingDiscrepancy !== null
          ? (s.closingDiscrepancy > 0 ? '+' : '') + fmt(s.closingDiscrepancy, currency)
          : '—',
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255, fontSize: 7 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });
    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 6;
  }

  // === Observation du jour (saisie commercial) ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('OBSERVATION DE LA JOURNEE', margin, y);
  y += 2;
  // Cadre
  const obsText = data.observation?.text?.trim() ?? '';
  const obsAuthor = data.observation?.authorName ?? null;
  const obsHeight = obsText ? Math.max(20, Math.ceil(obsText.length / 90) * 5 + 12) : 16;
  doc.setDrawColor(180, 160, 120);
  doc.setLineWidth(0.3);
  doc.setFillColor(252, 248, 240);
  doc.rect(margin, y, innerW, obsHeight, 'FD');
  if (obsText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 30, 10);
    const wrapped = doc.splitTextToSize(obsText, innerW - 6);
    doc.text(wrapped, margin + 3, y + 5);
    if (obsAuthor) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(120, 100, 70);
      doc.text(`— ${obsAuthor}`, W - margin - 3, y + obsHeight - 3, { align: 'right' });
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(160, 140, 100);
    doc.text('(Aucune observation saisie pour ce jour)', margin + 3, y + 9);
  }
  y += obsHeight + 6;

  // === Inventaire & mouvement de stock par produit ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('INVENTAIRE & VENTES PAR PRODUIT', margin, y);
  y += 2;

  if (data.byProduct.length === 0) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('(Aucune vente ni stock à cette date)', margin, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[
        'Produit', 'Code',
        'Stock\nmatin', 'Reçus', 'Sortis', 'Vendus', 'Stock\nsoir',
        'Recette',
      ]],
      body: data.byProduct.map(p => [
        p.name, p.code,
        num(p.openingInventory),
        p.transfersIn > 0 ? num(p.transfersIn) : '—',
        p.transfersOut > 0 ? num(p.transfersOut) : '—',
        num(p.qty),
        num(p.closingInventory),
        p.revenue > 0 ? fmt(p.revenue, currency) : '—',
      ]),
      foot: [[
        '', '', '', '', '', 'TOTAL', '',
        fmt(data.byProduct.reduce((s, p) => s + p.revenue, 0), currency),
      ]],
      styles: { fontSize: 7.5, cellPadding: 1.2 },
      headStyles: {
        fillColor: [102, 60, 20], textColor: 255, fontSize: 7,
        halign: 'center', valign: 'middle',
      },
      footStyles: { fillColor: [240, 230, 210], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 18 },
        2: { halign: 'right', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 14 },
        5: { halign: 'right', cellWidth: 16, fontStyle: 'bold' },
        6: { halign: 'right', cellWidth: 16 },
        7: { halign: 'right', cellWidth: 26 },
      },
    });
    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 6;
  }

  // === Ventes par commercial ===
  if (y > H - 60) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('VENTES PAR COMMERCIAL', margin, y);
  y += 2;

  if (data.bySeller.length === 0) {
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('(Aucun commercial n\'a vendu ce jour)', margin, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Commercial', 'Nb ventes', 'CA', 'Encaissé', 'Signature']],
      body: data.bySeller.map(s => [
        s.name, String(s.salesCount),
        fmt(s.revenue, currency), fmt(s.paid, currency),
        '',
      ]),
      foot: [[
        'TOTAL',
        String(data.totals.salesCount),
        fmt(data.bySeller.reduce((acc, s) => acc + s.revenue, 0), currency),
        fmt(data.bySeller.reduce((acc, s) => acc + s.paid, 0), currency),
        '',
      ]],
      styles: { fontSize: 8, cellPadding: 1.5, minCellHeight: 10 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255 },
      footStyles: { fillColor: [240, 230, 210], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { cellWidth: 40 },
      },
    });
    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 6;
  }

  // === Dépôts caisse ===
  if (data.deposits.length > 0) {
    if (y > H - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('VERSEMENTS DE CAISSE', margin, y);
    y += 2;
    autoTable(doc, {
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
    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 6;
  }

  // === Primes versées en espèces (transport + vente) ===
  const payouts = data.payouts ?? [];
  if (payouts.length > 0) {
    if (y > H - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('PRIMES VERSÉES (ESPÈCES)', margin, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Commercial', 'Prime', 'Unités', 'Montant']],
      body: payouts.map(p => [
        p.sellerName,
        p.kind === 'transport' ? 'Transport' : 'Prime de vente',
        p.kind === 'sales_bonus' ? String(p.units) : '—',
        fmt(p.amount, currency),
      ]),
      foot: [[
        '', '', 'TOTAL PRIMES',
        fmt(data.totals.payouts ?? payouts.reduce((s2, p) => s2 + p.amount, 0), currency),
      ]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [102, 60, 20], textColor: 255 },
      footStyles: { fillColor: [240, 230, 210], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
      },
    });
    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 6;
  }

  // === Totaux récapitulatifs ===
  if (y > H - 40) { doc.addPage(); y = 20; }
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
