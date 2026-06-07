/**
 * Bulletin de paie PDF — modèle conforme Côte d'Ivoire
 *
 * Structure calquée sur le bulletin de référence fourni (feuille
 * « Bulletin de paie » du xlsx) :
 *   1. Employeur / Salarié · période
 *   2. Éléments de rémunération (base, primes exonérées / imposables)
 *   3. Retenues salariales (CNPS 6,3 %, ITS barème + RICF)
 *   4. Charges patronales détaillées (CNPS, CMU, FDFP)
 *   5. Acomptes espèces (primes déjà versées) → NET À PAYER
 *   6. Mentions légales (Code de Prévoyance Sociale, Ord. 2023-719, CGI)
 *
 * Généré côté client (jsPDF), partageable et téléchargeable comme le
 * reçu de vente.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export interface PayslipPdfData {
  companyName?: string;
  companyTagline?: string;
  companyAddress?: string;
  // Bulletin (champs PascalCase renvoyés par /api/hr/payroll/[id])
  payroll: {
    PayrollNumber: string;
    Period: string; // YYYY-MM
    EmployeeName?: string;
    Position?: string | null;
    ContractType?: string | null;
    CnpsNumber?: string | null;
    CnpsSubject?: boolean;
    HireDate?: string | null;
    Department?: string | null;
    DaysWorked?: number | null;
    FiscalParts?: number | null;
    BaseSalary: number;
    Allowances: number;
    Bonuses: number;
    SalesBonus?: number;
    TransportAllowance?: number;
    MealAllowance?: number;
    GrossTaxable?: number | null;
    GrossTotal?: number | null;
    CnpsEmployee?: number;
    ItsAmount?: number;
    Ricf?: number;
    Deductions: number;
    AdvanceDeduction: number; // acomptes espèces (primes déjà versées)
    NetSalary: number; // net à payer
    EmployerCharges?: any; // JSONB du moteur CI
    EmployerTotal?: number;
    Status: string;
    PaymentDate?: string | null;
  };
}

const CONTRACT_LABELS: Record<string, string> = {
  permanent: 'CDI',
  temporary: 'CDD / Journalier',
  contractor: 'Prestataire',
  intern: 'Stagiaire',
};

// jsPDF (helvetica/WinAnsi) ne connaît pas l'espace fine insécable
// (U+202F) qu'insère Intl fr-FR → elle s'affichait en « / ». On force
// l'espace simple comme séparateur de milliers.
const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0))
    .replace(/[\u202F\u00A0]/g, ' ');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const periodLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
};

export function generatePayslipPdf(data: PayslipPdfData): Blob {
  const p = data.payroll;
  const subject = p.CnpsSubject !== false; // salarié déclaré (assujetti CNPS)
  const companyName = data.companyName ?? 'DUNE DE MIEL';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;
  const innerW = W - margin * 2;
  let y = 16;

  const brown: [number, number, number] = [102, 60, 20];
  const cream: [number, number, number] = [240, 230, 210];

  // ===== En-tête sobre =====
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BULLETIN DE PAIE', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`${companyName} — ${periodLabel(p.Period)}`, W - margin, y, { align: 'right' });
  doc.setDrawColor(...brown);
  doc.setLineWidth(0.6);
  doc.line(margin, y + 3, W - margin, y + 3);
  y += 9;

  // ===== Employeur / Salarié =====
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['EMPLOYEUR', 'SALARIÉ']],
    body: [[
      `${companyName}\n${data.companyTagline ?? ''}\n${data.companyAddress ?? 'Abidjan, Côte d\'Ivoire'}`,
      `${p.EmployeeName ?? '—'}\n${p.Position ?? '—'}${p.Department ? ' · ' + p.Department : ''}\n` +
      `Contrat : ${CONTRACT_LABELS[p.ContractType ?? ''] ?? p.ContractType ?? '—'}` +
      `${p.HireDate ? ' · Entrée : ' + new Date(p.HireDate).toLocaleDateString('fr-FR') : ''}\n` +
      `N° CNPS : ${p.CnpsSubject === false ? 'N/A (non assujetti)' : (p.CnpsNumber ?? 'À renseigner')}` +
      `${p.CnpsSubject === false ? '' : ' · Parts fiscales : ' + (p.FiscalParts ?? 1)}`,
    ]],
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: [235, 235, 235] as any, textColor: 40, fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: innerW / 2 }, 1: { cellWidth: innerW / 2 } },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 3;

  // Période / numéro
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Bulletin n° ${p.PayrollNumber} · Période : ${periodLabel(p.Period)}` +
    (p.DaysWorked ? ` · Jours travaillés : ${p.DaysWorked}` : '') +
    (p.PaymentDate ? ` · Payé le ${new Date(p.PaymentDate).toLocaleDateString('fr-FR')}` : ''),
    margin, y + 2
  );
  y += 6;

  // ===== 1. Rémunération =====
  const transport = Number(p.TransportAllowance) || 0;
  const meal = Number(p.MealAllowance) || 0;
  const salesBonus = Number(p.SalesBonus) || 0;
  const otherTaxable = (Number(p.Allowances) || 0) + (Number(p.Bonuses) || 0);
  const grossTotal = Number(p.GrossTotal) || (Number(p.BaseSalary) + otherTaxable + salesBonus + transport + meal);
  const grossTaxable = Number(p.GrossTaxable) || grossTotal;

  const remunRows: any[][] = [
    ['Salaire de base' + (p.DaysWorked && p.ContractType === 'temporary' ? ` (${p.DaysWorked} jours)` : ''), fmt(p.BaseSalary)],
  ];
  if (salesBonus > 0) remunRows.push(['Primes de vente (imposables)', fmt(salesBonus)]);
  if (otherTaxable > 0) remunRows.push(['Primes et indemnités diverses (imposables)', fmt(otherTaxable)]);
  if (transport > 0) remunRows.push([`Prime de transport${transport <= 30000 ? ' (exonérée)' : ' (exonérée à 30 000)'}`, fmt(transport)]);
  if (meal > 0) remunRows.push(["Prime de panier / repas (exonérée jusqu'à 30 000)", fmt(meal)]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['1. ÉLÉMENTS DE RÉMUNÉRATION', 'Gains']],
    body: remunRows,
    foot: [
      ['SALAIRE BRUT TOTAL', fmt(grossTotal)],
      subject
        ? ['dont brut imposable (assiette CNPS / ITS)', fmt(grossTaxable)]
        : ['Assiette CNPS / ITS', 'N/A — non assujetti'],
    ],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [235, 235, 235] as any, textColor: 40 },
    footStyles: { fillColor: [248, 245, 240] as any, textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 4;

  // ===== 2. Retenues salariales =====
  const cnps = Number(p.CnpsEmployee) || 0;
  const its = Number(p.ItsAmount) || 0;
  const ricf = Number(p.Ricf) || 0;
  const retRows: any[][] = subject ? [
    ['CNPS — Retraite (part salarié 6,3 %)', fmt(grossTaxable), '6,3 %', fmt(cnps)],
    ['ITS — Impôt sur Traitements et Salaires (Ord. 2023-719)', fmt(grossTaxable), 'Barème', fmt(its)],
  ] : [
    ['Salarié non assujetti à la CNPS — aucune retenue légale', '', '', 'N/A'],
  ];
  if (subject && ricf > 0) retRows.push(['dont RICF déduite (charges de famille)', '', '', '- ' + fmt(ricf)]);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['2. RETENUES SALARIALES', 'Base', 'Taux', 'Retenue']],
    body: retRows,
    foot: [['TOTAL RETENUES SALARIALES', '', '', subject ? fmt(cnps + its) : 'N/A']],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [235, 235, 235] as any, textColor: 40 },
    footStyles: { fillColor: [248, 245, 240] as any, textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right', cellWidth: 32 } },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 4;

  // ===== 3. Charges patronales =====
  const ec = p.EmployerCharges || {};
  const employerRows: any[][] = !subject ? [
    ['Salarié non assujetti — aucune charge patronale (CNPS, CMU, FDFP)', 'N/A'],
  ] : [
    ['CNPS — Retraite (7,7 %)', fmt(ec.cnpsRetirement)],
    ['CNPS — Prestations Familiales (5 %, plafond 70 000)', fmt(ec.familyAllowance)],
    ['CNPS — Assurance Maternité (0,75 %)', fmt(ec.maternity)],
    ['CNPS — Accident du Travail', fmt(ec.workAccident)],
    ['CMU — Couverture Maladie Universelle', fmt(ec.cmu)],
    ['FDFP — Taxe d\'Apprentissage (0,4 %)', fmt(ec.fdfpApprenticeship)],
    ['FDFP — Formation Professionnelle Continue (1,2 %)', fmt(ec.fdfpContinuingTraining)],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['3. CHARGES PATRONALES (dettes sociales de l\'employeur)', 'Montant']],
    body: employerRows,
    foot: [['TOTAL CHARGES PATRONALES', subject ? fmt(p.EmployerTotal ?? ec.total) : 'N/A']],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [235, 235, 235] as any, textColor: 40 },
    footStyles: { fillColor: [245, 245, 245] as any, textColor: 0, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', cellWidth: 36 } },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 4;

  // ===== 4. Net à payer =====
  const advances = Number(p.AdvanceDeduction) || 0;
  const otherDeductions = Number(p.Deductions) || 0;
  const netRows: any[][] = [];
  netRows.push(['Net salarial (brut total - retenues)', fmt(grossTotal - cnps - its)]);
  if (advances > 0) netRows.push(['Acomptes espèces déjà versés (primes à la clôture de caisse)', '- ' + fmt(advances)]);
  if (otherDeductions > 0) netRows.push(['Autres retenues (avances sur salaire…)', '- ' + fmt(otherDeductions)]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: netRows,
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
  });
  y = (doc as DocWithAutoTable).lastAutoTable.finalY + 2;

  doc.setFillColor(...cream);
  doc.setDrawColor(...brown);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, innerW, 13, 'FD');
  doc.setTextColor(...brown);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('NET À PAYER AU SALARIÉ', margin + 4, y + 8.5);
  doc.setFontSize(13);
  doc.text(fmt(p.NetSalary) + ' FCFA', W - margin - 4, y + 8.7, { align: 'right' });
  y += 19;

  // ===== Mentions légales =====
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const legal = [
    '• Cotisations CNPS calculées conformément au Code de Prévoyance Sociale (Art. 23) : retraite 6,3 % salarié / 7,7 % employeur (plafond 45× SMIG), PF 5 %, maternité 0,75 %, AT 2-5 % (plafond 70 000).',
    '• ITS selon le barème progressif mensuel de l\'Ordonnance n°2023-719 du 13/09/2023, avec RICF par demi-part au-delà de la 1ère part (Art. 119 bis et 120 CGI).',
    '• Taxes FDFP (TAP 0,4 % + FPC 1,2 %) et CMU salarié à la charge exclusive de l\'employeur.',
    '• Primes de transport et de panier exonérées de CNPS et d\'ITS dans la limite de 30 000 FCFA/mois chacune.',
    '• Bulletin à conserver sans limitation de durée (employeur : 5 ans minimum). Contestations : Art. L.31-1 et suivants du Code du Travail ivoirien.',
  ];
  for (const line of legal) {
    const wrapped = doc.splitTextToSize(line, innerW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 2.8 + 0.8;
  }
  y += 6;

  // Signatures
  if (y > 270) { doc.addPage(); y = 24; }
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text('Signature & cachet Employeur', margin + 8, y);
  doc.text('Signature du Salarié', W - margin - 45, y);
  doc.setDrawColor(150, 150, 150);
  doc.line(margin + 4, y + 14, margin + 60, y + 14);
  doc.line(W - margin - 60, y + 14, W - margin - 4, y + 14);

  return doc.output('blob');
}

export async function sharePayslipPdf(data: PayslipPdfData): Promise<{ shared: boolean }> {
  const blob = generatePayslipPdf(data);
  const fileName = `Bulletin_${data.payroll.PayrollNumber}.pdf`;
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return { shared: true };
    } catch { /* annulé → téléchargement */ }
  }
  downloadPayslipPdf(data, blob);
  return { shared: false };
}

export function downloadPayslipPdf(data: PayslipPdfData, blob?: Blob): void {
  const b = blob ?? generatePayslipPdf(data);
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bulletin_${data.payroll.PayrollNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
