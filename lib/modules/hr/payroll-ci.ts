/**
 * Moteur de paie — Côte d'Ivoire (paramètres 2026)
 *
 * Sources (cf. docs/Bulletin_Paie_*.xlsx fourni comme référence) :
 *  - ITS : barème progressif mensuel de l'Ordonnance n°2023-719 du
 *    13/09/2023 (6 tranches : 0 / 16 / 21 / 24 / 28 / 32 %)
 *  - RICF : réduction d'impôt pour charges de famille, 5 500 FCFA par
 *    demi-part au-delà de la 1ère part, plafonné à 5 parts (Art. 120 CGI)
 *  - CNPS : retraite 6,3 % salarié / 7,7 % employeur (plafond 45× SMIG
 *    = 1 647 315 FCFA/mois) ; prestations familiales 5 %, maternité
 *    0,75 %, accident du travail 2-5 % selon secteur — plafond 70 000,
 *    100 % employeur (Code de Prévoyance Sociale, Art. 23)
 *  - CMU : 1 000 FCFA/personne/mois — 100 % employeur pour le salarié
 *  - FDFP : taxe d'apprentissage 0,4 % + formation continue 1,2 % de la
 *    masse salariale — 100 % employeur
 *  - Primes de transport et de panier exonérées (CNPS + ITS) jusqu'à
 *    30 000 FCFA/mois chacune ; l'excédent est imposable
 *
 * Tout est pur calcul (aucune dépendance DB) pour être testable.
 */

export const CI_PAYROLL = {
  smig: 75_000,
  cnps: {
    retirementEmployee: 0.063,
    retirementEmployer: 0.077,
    retirementCeiling: 1_647_315, // 45× SMIG / mois
    familyAllowance: 0.05,
    maternity: 0.0075,
    workAccidentDefault: 0.02, // 2 à 5 % selon le risque du secteur
    socialCeiling: 70_000, // plafond PF / maternité / AT
  },
  cmuPerBeneficiary: 1_000, // FCFA / personne / mois — part employeur
  fdfp: {
    apprenticeship: 0.004, // TAP
    continuingTraining: 0.012, // TFPC
  },
  exemptTransportMax: 30_000,
  exemptMealMax: 30_000,
  its: {
    brackets: [
      { upTo: 75_000, rate: 0 },
      { upTo: 240_000, rate: 0.16 },
      { upTo: 800_000, rate: 0.21 },
      { upTo: 2_400_000, rate: 0.24 },
      { upTo: 8_000_000, rate: 0.28 },
      { upTo: Infinity, rate: 0.32 },
    ],
    ricfPerHalfPart: 5_500,
    ricfMaxParts: 5,
  },
} as const;

export interface CIPayrollInput {
  /** Salaire de base brut du mois (journalier : taux × jours, déjà calculé) */
  baseSalary: number;
  /** Primes et indemnités IMPOSABLES (ancienneté, rendement, primes de vente…) */
  taxableBonuses?: number;
  /** Prime de transport versée sur le mois (exonérée jusqu'à 30 000) */
  transportAllowance?: number;
  /** Prime de panier / repas versée sur le mois (exonérée jusqu'à 30 000) */
  mealAllowance?: number;
  /** Autres retenues salariales (avances sur salaire, etc.) */
  otherDeductions?: number;
  /** Sommes déjà réglées en espèces dans le mois (acomptes : primes payées à la clôture de caisse) */
  cashAlreadyPaid?: number;
  /** Parts fiscales du foyer (1 par défaut — célibataire sans enfant) */
  fiscalParts?: number;
  /** Bénéficiaires CMU pris en charge (1 = le salarié) */
  cmuBeneficiaries?: number;
  /** Taux accident du travail du secteur (0.02 à 0.05) */
  workAccidentRate?: number;
}

export interface CIPayrollResult {
  grossTaxable: number; // assiette CNPS retraite + ITS
  grossTotal: number; // brut total versé (avec primes exonérées)
  exemptTransport: number;
  exemptMeal: number;
  taxableTransportExcess: number;
  employee: {
    cnpsRetirement: number;
    itsGross: number;
    ricf: number;
    its: number;
    otherDeductions: number;
    cashAlreadyPaid: number;
    total: number; // total des retenues salariales (hors acomptes)
  };
  employer: {
    cnpsRetirement: number;
    familyAllowance: number;
    maternity: number;
    workAccident: number;
    cmu: number;
    fdfpApprenticeship: number;
    fdfpContinuingTraining: number;
    total: number;
  };
  netSalary: number; // net fiscal (brut total − retenues salariales)
  netToPay: number; // net à verser (net − acomptes espèces − autres retenues)
  employerCost: number; // brut total + charges patronales
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export type MaritalStatus = 'celibataire' | 'marie' | 'divorce' | 'veuf';

/**
 * Parts fiscales du foyer (Art. 119 bis CGI — quotient familial) :
 *   - célibataire / divorcé / veuf SANS enfant à charge : 1 part
 *   - marié sans enfant : 2 parts
 *   - célibataire ou divorcé AVEC enfants : 1,5 part de base
 *   - marié ou veuf avec enfants : 2 parts de base
 *   - + 0,5 part par enfant à charge — plafond global 5 parts
 */
export function computeFiscalParts(maritalStatus: MaritalStatus | string | null | undefined, childrenCount = 0): number {
  const children = Math.max(0, Math.floor(childrenCount || 0));
  const status = (maritalStatus || 'celibataire') as MaritalStatus;
  let base: number;
  if (status === 'marie') base = 2;
  else if (children > 0) base = status === 'veuf' ? 2 : 1.5;
  else base = 1;
  return Math.min(base + 0.5 * children, CI_PAYROLL.its.ricfMaxParts);
}

/** ITS mensuel par tranches progressives sur le brut imposable. */
export function computeITS(grossTaxable: number, fiscalParts = 1): { gross: number; ricf: number; net: number } {
  let remaining = grossTaxable;
  let previous = 0;
  let tax = 0;
  for (const { upTo, rate } of CI_PAYROLL.its.brackets) {
    const slice = Math.min(remaining, upTo - previous);
    if (slice <= 0) break;
    tax += slice * rate;
    remaining -= slice;
    previous = upTo;
  }
  // RICF : par demi-part au-delà de la 1ère part, plafonné à 5 parts
  const parts = Math.min(Math.max(fiscalParts, 1), CI_PAYROLL.its.ricfMaxParts);
  const halfParts = Math.round((parts - 1) * 2);
  const ricf = halfParts * CI_PAYROLL.its.ricfPerHalfPart;
  return { gross: r2(tax), ricf: r2(Math.min(ricf, tax)), net: r2(Math.max(0, tax - ricf)) };
}

export function computeCIPayroll(input: CIPayrollInput): CIPayrollResult {
  const baseSalary = input.baseSalary || 0;
  const taxableBonuses = input.taxableBonuses || 0;
  const transport = input.transportAllowance || 0;
  const meal = input.mealAllowance || 0;
  const fiscalParts = input.fiscalParts || 1;
  const cmuBeneficiaries = input.cmuBeneficiaries ?? 1;
  const atRate = input.workAccidentRate ?? CI_PAYROLL.cnps.workAccidentDefault;

  const exemptTransport = Math.min(transport, CI_PAYROLL.exemptTransportMax);
  const taxableTransportExcess = Math.max(0, transport - CI_PAYROLL.exemptTransportMax);
  const exemptMeal = Math.min(meal, CI_PAYROLL.exemptMealMax);
  const taxableMealExcess = Math.max(0, meal - CI_PAYROLL.exemptMealMax);

  const grossTaxable = r2(baseSalary + taxableBonuses + taxableTransportExcess + taxableMealExcess);
  const grossTotal = r2(grossTaxable + exemptTransport + exemptMeal);

  // ----- Retenues salariales -----
  const cnpsBase = Math.min(grossTaxable, CI_PAYROLL.cnps.retirementCeiling);
  const cnpsEmployee = r2(cnpsBase * CI_PAYROLL.cnps.retirementEmployee);
  const its = computeITS(grossTaxable, fiscalParts);
  const otherDeductions = input.otherDeductions || 0;
  const cashAlreadyPaid = input.cashAlreadyPaid || 0;
  const employeeTotal = r2(cnpsEmployee + its.net);

  // ----- Charges patronales -----
  const socialBase = Math.min(grossTaxable, CI_PAYROLL.cnps.socialCeiling);
  const employer = {
    cnpsRetirement: r2(cnpsBase * CI_PAYROLL.cnps.retirementEmployer),
    familyAllowance: r2(socialBase * CI_PAYROLL.cnps.familyAllowance),
    maternity: r2(socialBase * CI_PAYROLL.cnps.maternity),
    workAccident: r2(socialBase * atRate),
    cmu: r2(cmuBeneficiaries * CI_PAYROLL.cmuPerBeneficiary),
    fdfpApprenticeship: r2(grossTaxable * CI_PAYROLL.fdfp.apprenticeship),
    fdfpContinuingTraining: r2(grossTaxable * CI_PAYROLL.fdfp.continuingTraining),
    total: 0,
  };
  employer.total = r2(
    employer.cnpsRetirement + employer.familyAllowance + employer.maternity +
    employer.workAccident + employer.cmu + employer.fdfpApprenticeship + employer.fdfpContinuingTraining
  );

  const netSalary = r2(grossTotal - employeeTotal);
  const netToPay = r2(Math.max(0, netSalary - otherDeductions - cashAlreadyPaid));

  return {
    grossTaxable,
    grossTotal,
    exemptTransport,
    exemptMeal,
    taxableTransportExcess,
    employee: {
      cnpsRetirement: cnpsEmployee,
      itsGross: its.gross,
      ricf: its.ricf,
      its: its.net,
      otherDeductions,
      cashAlreadyPaid,
      total: employeeTotal,
    },
    employer,
    netSalary,
    netToPay,
    employerCost: r2(grossTotal + employer.total),
  };
}
