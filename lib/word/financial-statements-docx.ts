/**
 * Générateur Word (.docx) — Dossier des états financiers annuels (SYSCOHADA).
 *
 * Même contenu que le PDF (lib/pdf/financial-statements-pdf.ts) mais au
 * format OOXML ÉDITABLE : l'expert-comptable peut retravailler chaque
 * tableau, compléter les notes annexes et finaliser la liasse avant
 * dépôt de la DSF. Généré côté client avec la bibliothèque `docx`.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, PageBreak,
  ShadingType, ImageRun,
} from 'docx';
import type { FinancialStatements, StatementLine } from '@/lib/modules/accounting/financial-statements-service';
import type { ReceiptLogo } from '@/lib/pdf/sale-receipt-pdf';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

const BROWN = '5C330A';
const BROWN_SOFT = '805A2D';
const CREAM = 'FAF5EB';
const GRAY = '6E6E6E';

// ---------------------------------------------------------------------------
// Briques

const heading = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true, color: BROWN, size: 28 })],
  });

const para = (text: string, opts: { italic?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean } = {}) =>
  new Paragraph({
    alignment: opts.align,
    spacing: { after: 120 },
    children: [new TextRun({
      text,
      italics: opts.italic,
      bold: opts.bold,
      color: opts.color ?? '333333',
      size: opts.size ?? 20,
    })],
  });

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const cell = (text: string, opts: { bold?: boolean; align?: 'left' | 'right' | 'center'; head?: boolean; shade?: boolean; width?: number } = {}) =>
  new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.head
      ? { type: ShadingType.CLEAR, fill: BROWN }
      : opts.shade
        ? { type: ShadingType.CLEAR, fill: CREAM }
        : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align === 'right' ? AlignmentType.RIGHT : opts.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text,
        bold: opts.bold || opts.head,
        color: opts.head ? 'FFFFFF' : '333333',
        size: 18,
      })],
    })],
  });

function table(headers: Array<{ label: string; align?: 'left' | 'right' | 'center'; width?: number }>, rows: Array<Array<{ text: string; bold?: boolean; align?: 'left' | 'right' | 'center' }>>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'C49A58' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'C49A58' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(h => cell(h.label, { head: true, align: h.align, width: h.width })),
      }),
      ...rows.map((r, i) =>
        new TableRow({
          children: r.map((c, j) => cell(c.text, {
            bold: c.bold,
            align: c.align ?? headers[j]?.align,
            shade: i % 2 === 1,
          })),
        })
      ),
    ],
  });
}

const statementRows = (lines: StatementLine[]) =>
  lines.map(l => [
    { text: l.label },
    { text: l.number, align: 'center' as const },
    { text: fmt(l.amount), align: 'right' as const },
  ]);

/** dataURL PNG → Uint8Array (pour ImageRun). */
function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------

export async function generateFinancialStatementsDocx(
  data: FinancialStatements,
  logo?: ReceiptLogo | null
): Promise<Blob> {
  const cur = data.company.currency || 'XOF';
  const children: Array<Paragraph | Table> = [];

  // ===== Page de garde =====
  if (logo) {
    const bytes = dataUrlToBytes(logo.dataUrl);
    if (bytes) {
      const maxW = 140, maxH = 90; // points ~ docx px
      const ratio = logo.width / Math.max(1, logo.height);
      let w = maxW, h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 200 },
        children: [new ImageRun({ type: 'png', data: bytes, transformation: { width: Math.round(w), height: Math.round(h) } })],
      }));
    }
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: logo ? 0 : 2000, after: 100 },
      children: [new TextRun({ text: data.company.name.toUpperCase(), bold: true, size: 48, color: BROWN })],
    }),
  );
  if (data.company.slogan) {
    children.push(para(data.company.slogan, { italic: true, color: BROWN_SOFT, size: 24, align: AlignmentType.CENTER }));
  }
  const contact = [data.company.address, data.company.phone, data.company.email].filter(Boolean).join('  ·  ');
  if (contact) children.push(para(contact, { color: GRAY, size: 18, align: AlignmentType.CENTER }));

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 100 },
      children: [new TextRun({ text: 'ÉTATS FINANCIERS ANNUELS', bold: true, size: 40, color: '1E1E1E' })],
    }),
    para(`Exercice ${data.fiscalYear} — clos le 31 décembre ${data.fiscalYear}`, { color: BROWN_SOFT, size: 26, align: AlignmentType.CENTER, bold: true }),
    para('Référentiel : SYSCOHADA révisé (AUDCIF) — Système Normal', { color: GRAY, align: AlignmentType.CENTER }),
    para(`Devise : ${cur}`, { color: GRAY, align: AlignmentType.CENTER }),
    para('', {}),
    para('Sommaire', { bold: true, size: 22 }),
    ...[
      '1. Bilan (Actif / Passif)',
      '2. Compte de résultat',
      '3. Tableau des flux de trésorerie (simplifié)',
      '4. Balance générale',
      '5. Livre-journal',
      '6. Grand livre (synthèse par compte)',
      '7. Notes annexes (à compléter)',
    ].map(t => para(t, { size: 19 })),
    para(
      "Document préparatoire généré automatiquement à partir des écritures comptabilisées. Avant dépôt de la Déclaration Statistique et Fiscale (DSF) à la DGI (au plus tard le 30 juin), ce dossier doit être revu, complété (notes annexes, retraitements éventuels) et visé par un expert-comptable inscrit à l'Ordre ou un Centre de Gestion Agréé (CGA).",
      { italic: true, color: BROWN_SOFT, size: 17 }
    ),
    para('Édité le ' + new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }), { color: '999999', size: 16, align: AlignmentType.CENTER }),
    pageBreak(),
  );

  // ===== 1. Bilan =====
  children.push(
    heading('1. Bilan — Actif / Passif'),
    table(
      [{ label: 'ACTIF', width: 56 }, { label: 'Compte', align: 'center', width: 14 }, { label: `Montant (${cur})`, align: 'right', width: 30 }],
      [
        ...statementRows(data.bilan.actif),
        [{ text: 'TOTAL ACTIF', bold: true }, { text: '' }, { text: fmt(data.bilan.totalActif), bold: true, align: 'right' }],
      ]
    ),
    para('', {}),
    table(
      [{ label: 'PASSIF', width: 56 }, { label: 'Compte', align: 'center', width: 14 }, { label: `Montant (${cur})`, align: 'right', width: 30 }],
      [
        ...statementRows(data.bilan.passif),
        [{ text: `Résultat de l'exercice (${data.bilan.resultat >= 0 ? 'bénéfice' : 'perte'})` }, { text: '13', align: 'center' }, { text: fmt(data.bilan.resultat), align: 'right' }],
        [{ text: 'TOTAL PASSIF', bold: true }, { text: '' }, { text: fmt(data.bilan.totalPassif), bold: true, align: 'right' }],
      ]
    ),
    pageBreak(),
  );

  // ===== 2. Compte de résultat =====
  children.push(
    heading('2. Compte de résultat'),
    table(
      [{ label: 'CHARGES (classe 6)', width: 56 }, { label: 'Compte', align: 'center', width: 14 }, { label: `Montant (${cur})`, align: 'right', width: 30 }],
      [
        ...statementRows(data.resultat.charges),
        [{ text: 'TOTAL CHARGES', bold: true }, { text: '' }, { text: fmt(data.resultat.totalCharges), bold: true, align: 'right' }],
      ]
    ),
    para('', {}),
    table(
      [{ label: 'PRODUITS (classe 7)', width: 56 }, { label: 'Compte', align: 'center', width: 14 }, { label: `Montant (${cur})`, align: 'right', width: 30 }],
      [
        ...statementRows(data.resultat.produits),
        [{ text: 'TOTAL PRODUITS', bold: true }, { text: '' }, { text: fmt(data.resultat.totalProduits), bold: true, align: 'right' }],
      ]
    ),
    para(
      `${data.resultat.resultat >= 0 ? 'BÉNÉFICE' : 'PERTE'} DE L'EXERCICE : ${fmt(Math.abs(data.resultat.resultat))} ${cur}`,
      { bold: true, size: 24, color: data.resultat.resultat >= 0 ? '107A43' : 'B91C1C', align: AlignmentType.CENTER }
    ),
    pageBreak(),
  );

  // ===== 3. TFT =====
  children.push(
    heading('3. Tableau des flux de trésorerie (simplifié — méthode directe)'),
    table(
      [{ label: 'Encaissements', width: 70 }, { label: `Montant (${cur})`, align: 'right', width: 30 }],
      [
        ...data.tft.inflows.map(l => [{ text: l.category }, { text: '+' + fmt(l.amount), align: 'right' as const }]),
        [{ text: 'Total encaissements', bold: true }, { text: '+' + fmt(data.tft.totalIn), bold: true, align: 'right' }],
      ]
    ),
    para('', {}),
    table(
      [{ label: 'Décaissements', width: 70 }, { label: `Montant (${cur})`, align: 'right', width: 30 }],
      [
        ...data.tft.outflows.map(l => [{ text: l.category }, { text: '−' + fmt(l.amount), align: 'right' as const }]),
        [{ text: 'Total décaissements', bold: true }, { text: '−' + fmt(data.tft.totalOut), bold: true, align: 'right' }],
        [{ text: 'VARIATION NETTE DE TRÉSORERIE', bold: true }, { text: (data.tft.net >= 0 ? '+' : '−') + fmt(Math.abs(data.tft.net)), bold: true, align: 'right' }],
      ]
    ),
  );
  if (data.tft.wallets.length > 0) {
    children.push(
      para('', {}),
      table(
        [{ label: 'Trésorerie à la clôture (caisses actives)', width: 50 }, { label: 'Type', width: 20 }, { label: `Solde (${cur})`, align: 'right', width: 30 }],
        [
          ...data.tft.wallets.map(w => [{ text: w.name }, { text: w.type }, { text: fmt(w.balance), align: 'right' as const }]),
          [{ text: 'Total trésorerie', bold: true }, { text: '' }, { text: fmt(data.tft.wallets.reduce((s, w) => s + w.balance, 0)), bold: true, align: 'right' }],
        ]
      ),
    );
  }
  children.push(pageBreak());

  // ===== 4. Balance =====
  const totalDebit = data.trialBalance.reduce((s, r) => s + r.debit, 0);
  const totalCredit = data.trialBalance.reduce((s, r) => s + r.credit, 0);
  children.push(
    heading('4. Balance générale'),
    table(
      [
        { label: 'Compte', width: 13 },
        { label: 'Libellé', width: 41 },
        { label: `Débit (${cur})`, align: 'right', width: 16 },
        { label: `Crédit (${cur})`, align: 'right', width: 16 },
        { label: 'Solde', align: 'right', width: 14 },
      ],
      [
        ...data.trialBalance.map(r => {
          const solde = r.debit - r.credit;
          return [
            { text: r.number }, { text: r.label },
            { text: fmt(r.debit), align: 'right' as const },
            { text: fmt(r.credit), align: 'right' as const },
            { text: fmt(Math.abs(solde)) + (solde >= 0 ? ' D' : ' C'), align: 'right' as const },
          ];
        }),
        [
          { text: 'TOTAUX', bold: true }, { text: '' },
          { text: fmt(totalDebit), bold: true, align: 'right' },
          { text: fmt(totalCredit), bold: true, align: 'right' },
          { text: Math.abs(totalDebit - totalCredit) < 0.02 ? 'Équilibrée' : 'Écart !', bold: true, align: 'right' },
        ],
      ]
    ),
    pageBreak(),
  );

  // ===== 5. Livre-journal =====
  children.push(
    heading('5. Livre-journal (chronologique)'),
    table(
      [
        { label: 'Date', width: 12 },
        { label: 'N° écriture', width: 17 },
        { label: 'Jal', align: 'center', width: 7 },
        { label: 'Libellé', width: 34 },
        { label: 'Référence', width: 16 },
        { label: `Montant (${cur})`, align: 'right', width: 14 },
      ],
      data.journal.map(e => [
        { text: new Date(e.date + 'T00:00:00').toLocaleDateString('fr-FR') },
        { text: e.entryNumber },
        { text: e.journalCode, align: 'center' as const },
        { text: e.description },
        { text: e.reference || '—' },
        { text: fmt(e.amount), align: 'right' as const },
      ])
    ),
    pageBreak(),
  );

  // ===== 6. Grand livre =====
  children.push(
    heading('6. Grand livre — synthèse par compte'),
    table(
      [
        { label: 'Compte', width: 13 },
        { label: 'Libellé', width: 39 },
        { label: 'Mvts', align: 'center', width: 8 },
        { label: `Débit (${cur})`, align: 'right', width: 14 },
        { label: `Crédit (${cur})`, align: 'right', width: 14 },
        { label: 'Solde', align: 'right', width: 12 },
      ],
      data.ledger.map(r => [
        { text: r.number }, { text: r.label },
        { text: String(r.linesCount), align: 'center' as const },
        { text: fmt(r.debit), align: 'right' as const },
        { text: fmt(r.credit), align: 'right' as const },
        { text: fmt(Math.abs(r.solde)) + (r.solde >= 0 ? ' D' : ' C'), align: 'right' as const },
      ])
    ),
    pageBreak(),
  );

  // ===== 7. Notes annexes =====
  children.push(heading("7. Notes annexes (à compléter avec l'expert-comptable)"));
  const notes = [
    `Note 1 — Règles et méthodes comptables : comptabilité tenue selon le SYSCOHADA révisé (AUDCIF), devise ${cur}. [À compléter : méthodes d'évaluation des stocks, amortissements…]`,
    `Note 2 — Chiffres clés de l'exercice ${data.fiscalYear} : produits ${fmt(data.resultat.totalProduits)} ${cur} ; charges ${fmt(data.resultat.totalCharges)} ${cur} ; résultat ${fmt(data.resultat.resultat)} ${cur} ; total bilan ${fmt(data.bilan.totalActif)} ${cur}.`,
    `Note 3 — Trésorerie : variation nette ${fmt(data.tft.net)} ${cur} ; trésorerie à la clôture ${fmt(data.tft.wallets.reduce((s, w) => s + w.balance, 0))} ${cur} répartie sur ${data.tft.wallets.length} caisse(s)/compte(s).`,
    'Note 4 — Immobilisations et amortissements : [à compléter — tableau des immobilisations, dotations].',
    'Note 5 — Stocks : [à compléter — méthode de valorisation, état des stocks à la clôture].',
    'Note 6 — Créances et dettes : [à compléter — échéancier, créances douteuses].',
    "Note 7 — Capitaux propres : [à compléter — mouvements de l'exercice].",
    'Note 8 — Effectifs et masse salariale : [à compléter].',
    'Note 9 — Engagements hors bilan : [à compléter — cautions, garanties].',
    'Note 10 — Événements postérieurs à la clôture : [à compléter].',
  ];
  for (const n of notes) children.push(para(n, { size: 19 }));

  const doc = new Document({
    creator: data.company.name,
    title: `États financiers ${data.fiscalYear} — ${data.company.name}`,
    description: 'Dossier préparatoire SYSCOHADA — à faire viser par un expert-comptable / CGA',
    styles: {
      default: { document: { run: { font: 'Calibri' } } },
    },
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
}

export async function downloadFinancialStatementsDocx(
  data: FinancialStatements,
  logo?: ReceiptLogo | null
): Promise<void> {
  const blob = await generateFinancialStatementsDocx(data, logo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `etats-financiers-${data.fiscalYear}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
