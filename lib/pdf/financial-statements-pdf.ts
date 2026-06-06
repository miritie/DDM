/**
 * Générateur PDF — Dossier des états financiers annuels (SYSCOHADA, A4).
 *
 * Contenu :
 *   1. Page de garde (logo, identité, exercice, mentions)
 *   2. Bilan (Actif / Passif)
 *   3. Compte de résultat (charges / produits / résultat)
 *   4. Tableau des flux de trésorerie simplifié + soldes des caisses
 *   5. Balance générale
 *   6. Livre-journal (chronologique)
 *   7. Grand livre synthétique (par compte)
 *   8. Notes annexes — squelette pré-rempli des chiffres clés, sections à
 *      compléter avec l'expert-comptable avant dépôt de la DSF à la DGI.
 *
 * Document PRÉPARATOIRE : il rassemble proprement toute la matière
 * comptable de l'exercice ; le visa d'un expert-comptable / CGA reste
 * requis pour le dépôt officiel.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FinancialStatements } from '@/lib/modules/accounting/financial-statements-service';
import type { ReceiptLogo } from '@/lib/pdf/sale-receipt-pdf';

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

const BROWN: [number, number, number] = [92, 51, 10];
const BROWN_SOFT: [number, number, number] = [128, 90, 45];
const GOLD: [number, number, number] = [196, 154, 88];
const CREAM: [number, number, number] = [250, 245, 235];
const GRAY: [number, number, number] = [110, 110, 110];

const W = 210;
const H = 297;
const M = 14;

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

export function generateFinancialStatementsPdf(
  data: FinancialStatements,
  logo?: ReceiptLogo | null
): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const cur = data.company.currency || 'XOF';

  // ======================= 1. Page de garde =======================
  let y = 50;
  if (logo) {
    const maxW = 38, maxH = 24;
    const ratio = logo.width / Math.max(1, logo.height);
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(logo.dataUrl, 'PNG', (W - w) / 2, y, w, h);
    y += h + 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BROWN);
  doc.text(data.company.name.toUpperCase(), W / 2, y, { align: 'center' });
  y += 8;
  if (data.company.slogan) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(...BROWN_SOFT);
    doc.text(data.company.slogan, W / 2, y, { align: 'center' });
    y += 7;
  }
  const contact = [data.company.address, data.company.phone, data.company.email].filter(Boolean).join('  ·  ');
  if (contact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(contact, W / 2, y, { align: 'center' });
    y += 7;
  }

  y += 14;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(M + 20, y, W - M - 20, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text('ÉTATS FINANCIERS ANNUELS', W / 2, y, { align: 'center' });
  y += 9;
  doc.setFontSize(13);
  doc.setTextColor(...BROWN_SOFT);
  doc.text(`Exercice ${data.fiscalYear} — clos le 31 décembre ${data.fiscalYear}`, W / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text('Référentiel : SYSCOHADA révisé (AUDCIF) — Système Normal', W / 2, y, { align: 'center' });
  y += 6;
  doc.text(`Devise : ${cur}`, W / 2, y, { align: 'center' });

  // Sommaire
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Sommaire', M + 20, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  const toc = [
    '1. Bilan (Actif / Passif)',
    '2. Compte de résultat',
    '3. Tableau des flux de trésorerie (simplifié)',
    '4. Balance générale',
    '5. Livre-journal',
    '6. Grand livre (synthèse par compte)',
    '7. Notes annexes (à compléter)',
  ];
  for (const line of toc) { doc.text(line, M + 24, y); y += 5.5; }

  // Encadré mention légale
  y += 8;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, W - 2 * M, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...BROWN_SOFT);
  doc.text(
    doc.splitTextToSize(
      'Document préparatoire généré automatiquement à partir des écritures comptabilisées. ' +
      'Avant dépôt de la Déclaration Statistique et Fiscale (DSF) à la DGI (au plus tard le 30 juin), ' +
      'ce dossier doit être revu, complété (notes annexes, retraitements éventuels) et visé par un ' +
      'expert-comptable inscrit à l\'Ordre ou un Centre de Gestion Agréé (CGA).',
      W - 2 * M - 8
    ),
    M + 4, y + 6
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Édité le ' + new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }),
    W / 2, H - 16, { align: 'center' }
  );

  // ======================= Helpers de sections =======================
  const sectionHeader = (title: string) => {
    doc.addPage();
    doc.setFillColor(...BROWN);
    doc.roundedRect(M, 12, W - 2 * M, 11, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(title, W / 2, 19.4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${data.company.name} — Exercice ${data.fiscalYear}`, W - M, 9, { align: 'right' });
    return 28;
  };

  const tableDefaults = {
    margin: { left: M, right: M },
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [40, 40, 40] as [number, number, number] },
    headStyles: { fillColor: BROWN, textColor: 255 as any, fontSize: 8 },
    alternateRowStyles: { fillColor: CREAM },
  };
  const lastY = () => (doc as DocWithAutoTable).lastAutoTable.finalY;

  // ======================= 2. Bilan =======================
  let sy = sectionHeader('1. BILAN — ACTIF / PASSIF');
  autoTable(doc, {
    ...tableDefaults,
    startY: sy,
    head: [['ACTIF', 'Compte', `Montant (${cur})`]],
    body: [
      ...data.bilan.actif.map(l => [l.label, l.number, fmt(l.amount)]),
      [{ content: 'TOTAL ACTIF', styles: { fontStyle: 'bold' } }, '', { content: fmt(data.bilan.totalActif), styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: { 1: { cellWidth: 24, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' } },
  });
  autoTable(doc, {
    ...tableDefaults,
    startY: lastY() + 6,
    head: [['PASSIF', 'Compte', `Montant (${cur})`]],
    body: [
      ...data.bilan.passif.map(l => [l.label, l.number, fmt(l.amount)]),
      [`Résultat de l'exercice (${data.bilan.resultat >= 0 ? 'bénéfice' : 'perte'})`, '13', fmt(data.bilan.resultat)],
      [{ content: 'TOTAL PASSIF', styles: { fontStyle: 'bold' } }, '', { content: fmt(data.bilan.totalPassif), styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: { 1: { cellWidth: 24, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' } },
  });

  // ======================= 3. Compte de résultat =======================
  sy = sectionHeader('2. COMPTE DE RÉSULTAT');
  autoTable(doc, {
    ...tableDefaults,
    startY: sy,
    head: [['CHARGES (classe 6)', 'Compte', `Montant (${cur})`]],
    body: [
      ...data.resultat.charges.map(l => [l.label, l.number, fmt(l.amount)]),
      [{ content: 'TOTAL CHARGES', styles: { fontStyle: 'bold' } }, '', { content: fmt(data.resultat.totalCharges), styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: { 1: { cellWidth: 24, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' } },
  });
  autoTable(doc, {
    ...tableDefaults,
    startY: lastY() + 6,
    head: [['PRODUITS (classe 7)', 'Compte', `Montant (${cur})`]],
    body: [
      ...data.resultat.produits.map(l => [l.label, l.number, fmt(l.amount)]),
      [{ content: 'TOTAL PRODUITS', styles: { fontStyle: 'bold' } }, '', { content: fmt(data.resultat.totalProduits), styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: { 1: { cellWidth: 24, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' } },
  });
  {
    const ry = lastY() + 8;
    const positive = data.resultat.resultat >= 0;
    doc.setFillColor(positive ? 232 : 254, positive ? 247 : 232, positive ? 238 : 232);
    doc.roundedRect(M, ry, W - 2 * M, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(positive ? 5 : 185, positive ? 122 : 28, positive ? 62 : 28);
    doc.text(
      `${positive ? 'BÉNÉFICE' : 'PERTE'} DE L'EXERCICE : ${fmt(Math.abs(data.resultat.resultat))} ${cur}`,
      W / 2, ry + 7.8, { align: 'center' }
    );
  }

  // ======================= 4. TFT =======================
  sy = sectionHeader('3. TABLEAU DES FLUX DE TRÉSORERIE (SIMPLIFIÉ — MÉTHODE DIRECTE)');
  autoTable(doc, {
    ...tableDefaults,
    startY: sy,
    head: [['Encaissements', `Montant (${cur})`]],
    body: [
      ...data.tft.inflows.map(l => [l.category, '+' + fmt(l.amount)]),
      [{ content: 'Total encaissements', styles: { fontStyle: 'bold' } }, { content: '+' + fmt(data.tft.totalIn), styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: { 1: { cellWidth: 42, halign: 'right' } },
  });
  autoTable(doc, {
    ...tableDefaults,
    startY: lastY() + 5,
    head: [['Décaissements', `Montant (${cur})`]],
    body: [
      ...data.tft.outflows.map(l => [l.category, '−' + fmt(l.amount)]),
      [{ content: 'Total décaissements', styles: { fontStyle: 'bold' } }, { content: '−' + fmt(data.tft.totalOut), styles: { fontStyle: 'bold' } }],
      [{ content: 'VARIATION NETTE DE TRÉSORERIE', styles: { fontStyle: 'bold' } },
       { content: (data.tft.net >= 0 ? '+' : '−') + fmt(Math.abs(data.tft.net)), styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: { 1: { cellWidth: 42, halign: 'right' } },
  });
  if (data.tft.wallets.length > 0) {
    autoTable(doc, {
      ...tableDefaults,
      startY: lastY() + 5,
      head: [['Trésorerie à la clôture (caisses actives)', 'Type', `Solde (${cur})`]],
      body: [
        ...data.tft.wallets.map(w => [w.name, w.type, fmt(w.balance)]),
        [{ content: 'Total trésorerie', styles: { fontStyle: 'bold' } }, '',
         { content: fmt(data.tft.wallets.reduce((s, w) => s + w.balance, 0)), styles: { fontStyle: 'bold' } }],
      ] as any,
      columnStyles: { 1: { cellWidth: 30 }, 2: { cellWidth: 36, halign: 'right' } },
    });
  }

  // ======================= 5. Balance générale =======================
  sy = sectionHeader('4. BALANCE GÉNÉRALE');
  const totalDebit = data.trialBalance.reduce((s, r) => s + r.debit, 0);
  const totalCredit = data.trialBalance.reduce((s, r) => s + r.credit, 0);
  autoTable(doc, {
    ...tableDefaults,
    startY: sy,
    head: [['Compte', 'Libellé', `Débit (${cur})`, `Crédit (${cur})`, 'Solde']],
    body: [
      ...data.trialBalance.map(r => {
        const solde = r.debit - r.credit;
        return [r.number, r.label, fmt(r.debit), fmt(r.credit),
          fmt(Math.abs(solde)) + (solde >= 0 ? ' D' : ' C')];
      }),
      [{ content: 'TOTAUX', colSpan: 2, styles: { fontStyle: 'bold' } } as any,
       { content: fmt(totalDebit), styles: { fontStyle: 'bold' } },
       { content: fmt(totalCredit), styles: { fontStyle: 'bold' } },
       { content: Math.abs(totalDebit - totalCredit) < 0.02 ? 'Équilibrée' : '⚠ Écart', styles: { fontStyle: 'bold' } }],
    ] as any,
    columnStyles: {
      0: { cellWidth: 20 },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
    },
  });

  // ======================= 6. Livre-journal =======================
  sy = sectionHeader('5. LIVRE-JOURNAL (CHRONOLOGIQUE)');
  autoTable(doc, {
    ...tableDefaults,
    startY: sy,
    head: [['Date', 'N° écriture', 'Jal', 'Libellé', 'Référence', `Montant (${cur})`]],
    body: data.journal.map(e => [
      new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR'),
      e.entryNumber,
      e.journalCode,
      e.description.length > 52 ? e.description.slice(0, 51) + '…' : e.description,
      e.reference || '—',
      fmt(e.amount),
    ]),
    columnStyles: {
      0: { cellWidth: 19 },
      1: { cellWidth: 27 },
      2: { cellWidth: 11, halign: 'center' },
      4: { cellWidth: 28 },
      5: { cellWidth: 24, halign: 'right' },
    },
  });

  // ======================= 7. Grand livre =======================
  sy = sectionHeader('6. GRAND LIVRE — SYNTHÈSE PAR COMPTE');
  autoTable(doc, {
    ...tableDefaults,
    startY: sy,
    head: [['Compte', 'Libellé', 'Mouvements', `Débit (${cur})`, `Crédit (${cur})`, 'Solde']],
    body: data.ledger.map(r => [
      r.number, r.label, String(r.linesCount), fmt(r.debit), fmt(r.credit),
      fmt(Math.abs(r.solde)) + (r.solde >= 0 ? ' D' : ' C'),
    ]),
    columnStyles: {
      0: { cellWidth: 20 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
    },
  });

  // ======================= 8. Notes annexes =======================
  sy = sectionHeader('7. NOTES ANNEXES (À COMPLÉTER AVEC L\'EXPERT-COMPTABLE)');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const notes = [
    `Note 1 — Règles et méthodes comptables : comptabilité tenue selon le SYSCOHADA révisé (AUDCIF), devise ${cur}. [À compléter : méthodes d'évaluation des stocks, amortissements…]`,
    `Note 2 — Chiffres clés de l'exercice ${data.fiscalYear} : produits ${fmt(data.resultat.totalProduits)} ${cur} ; charges ${fmt(data.resultat.totalCharges)} ${cur} ; résultat ${fmt(data.resultat.resultat)} ${cur} ; total bilan ${fmt(data.bilan.totalActif)} ${cur}.`,
    `Note 3 — Trésorerie : variation nette ${fmt(data.tft.net)} ${cur} ; trésorerie à la clôture ${fmt(data.tft.wallets.reduce((s, w) => s + w.balance, 0))} ${cur} répartie sur ${data.tft.wallets.length} caisse(s)/compte(s).`,
    'Note 4 — Immobilisations et amortissements : [à compléter — tableau des immobilisations, dotations].',
    'Note 5 — Stocks : [à compléter — méthode de valorisation, état des stocks à la clôture].',
    'Note 6 — Créances et dettes : [à compléter — échéancier, créances douteuses].',
    'Note 7 — Capitaux propres : [à compléter — mouvements de l\'exercice].',
    'Note 8 — Effectifs et masse salariale : [à compléter].',
    'Note 9 — Engagements hors bilan : [à compléter — cautions, garanties].',
    'Note 10 — Événements postérieurs à la clôture : [à compléter].',
  ];
  let ny = sy + 2;
  for (const n of notes) {
    const linesArr = doc.splitTextToSize(n, W - 2 * M);
    if (ny + linesArr.length * 4.6 > H - 18) { doc.addPage(); ny = 18; }
    doc.text(linesArr, M, ny);
    ny += linesArr.length * 4.6 + 3;
  }

  // ======================= Pagination =======================
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${i} / ${pages}`, W / 2, H - 7, { align: 'center' });
    doc.text(`États financiers ${data.fiscalYear} — document préparatoire, à faire viser par un expert-comptable / CGA`, M, H - 7);
  }

  return doc.output('blob');
}

export function downloadFinancialStatementsPdf(data: FinancialStatements, logo?: ReceiptLogo | null): void {
  const blob = generateFinancialStatementsPdf(data, logo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `etats-financiers-${data.fiscalYear}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
