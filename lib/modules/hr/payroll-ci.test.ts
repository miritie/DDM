/**
 * Tests du moteur de paie CI — validés contre le bulletin de référence
 * docs/Bulletin_Paie_KOUAME_KM_Elfried_TRAI_Services-4.xlsx :
 * brut imposable 365 887 → CNPS sal. 23 050,881 · ITS 52 836,27 ·
 * net à payer 349 999,849 · charges patronales 40 452,491.
 */
import { describe, it, expect } from 'vitest';
import { computeCIPayroll, computeITS, computeFiscalParts, CI_PAYROLL } from './payroll-ci';

describe('computeFiscalParts — quotient familial CI (Art. 119 bis CGI)', () => {
  it('célibataire sans enfant : 1 part', () => {
    expect(computeFiscalParts('celibataire', 0)).toBe(1);
  });
  it('marié sans enfant : 2 parts', () => {
    expect(computeFiscalParts('marie', 0)).toBe(2);
  });
  it('marié avec 2 enfants : 3 parts', () => {
    expect(computeFiscalParts('marie', 2)).toBe(3);
  });
  it('célibataire avec 1 enfant : 1,5 + 0,5 = 2 parts', () => {
    expect(computeFiscalParts('celibataire', 1)).toBe(2);
  });
  it('veuf avec 3 enfants : 2 + 1,5 = 3,5 parts', () => {
    expect(computeFiscalParts('veuf', 3)).toBe(3.5);
  });
  it('plafond à 5 parts (marié, 8 enfants)', () => {
    expect(computeFiscalParts('marie', 8)).toBe(5);
  });
  it('défaut prudent : statut inconnu = célibataire', () => {
    expect(computeFiscalParts(null, 0)).toBe(1);
  });
});

describe('computeITS — barème Ord. 2023-719', () => {
  it('est nul jusqu\'à 75 000', () => {
    expect(computeITS(75_000).net).toBe(0);
  });

  it('reproduit l\'ITS du bulletin de référence (365 887 → 52 836,27)', () => {
    const its = computeITS(365_887, 1);
    // (240000-75000)×16% + (365887-240000)×21% = 26 400 + 26 436,27
    expect(its.gross).toBeCloseTo(52_836.27, 2);
    expect(its.ricf).toBe(0); // 1 part → pas de RICF
    expect(its.net).toBeCloseTo(52_836.27, 2);
  });

  it('applique la RICF par demi-part au-delà de la 1ère part', () => {
    const its = computeITS(365_887, 2.5); // 2,5 parts → 3 demi-parts → 16 500
    expect(its.ricf).toBe(16_500);
    expect(its.net).toBeCloseTo(52_836.27 - 16_500, 2);
  });

  it('plafonne la RICF à 5 parts', () => {
    expect(computeITS(1_000_000, 8).ricf).toBe(computeITS(1_000_000, 5).ricf);
  });
});

describe('computeCIPayroll — bulletin de référence complet', () => {
  const ref = computeCIPayroll({
    baseSalary: 365_887,
    transportAllowance: 30_000,
    mealAllowance: 30_000,
    fiscalParts: 1,
    cmuBeneficiaries: 1,
    workAccidentRate: 0.02,
  });

  it('bruts imposable et total', () => {
    expect(ref.grossTaxable).toBe(365_887);
    expect(ref.grossTotal).toBe(425_887);
  });

  it('retenues salariales (CNPS 6,3 % + ITS)', () => {
    expect(ref.employee.cnpsRetirement).toBeCloseTo(23_050.88, 2);
    expect(ref.employee.its).toBeCloseTo(52_836.27, 2);
    expect(ref.employee.total).toBeCloseTo(75_887.15, 2);
  });

  it('charges patronales détaillées (total 40 452,49)', () => {
    expect(ref.employer.cnpsRetirement).toBeCloseTo(28_173.30, 2);
    expect(ref.employer.familyAllowance).toBe(3_500); // plafond 70 000 × 5 %
    expect(ref.employer.maternity).toBe(525);
    expect(ref.employer.workAccident).toBe(1_400);
    expect(ref.employer.cmu).toBe(1_000);
    expect(ref.employer.fdfpApprenticeship).toBeCloseTo(1_463.55, 2);
    expect(ref.employer.fdfpContinuingTraining).toBeCloseTo(4_390.64, 2);
    expect(ref.employer.total).toBeCloseTo(40_452.49, 2);
  });

  it('net à payer du bulletin (349 999,85)', () => {
    expect(ref.netSalary).toBeCloseTo(349_999.85, 2);
    expect(ref.netToPay).toBeCloseTo(349_999.85, 2);
  });
});

describe('cas métier DDM', () => {
  it('plafonne la CNPS retraite à 45× SMIG', () => {
    const high = computeCIPayroll({ baseSalary: 3_000_000 });
    expect(high.employee.cnpsRetirement).toBeCloseTo(CI_PAYROLL.cnps.retirementCeiling * 0.063, 1);
    expect(high.employer.cnpsRetirement).toBeCloseTo(CI_PAYROLL.cnps.retirementCeiling * 0.077, 1);
  });

  it('transport au-delà de 30 000 : l\'excédent devient imposable', () => {
    const p = computeCIPayroll({ baseSalary: 100_000, transportAllowance: 50_000 });
    expect(p.exemptTransport).toBe(30_000);
    expect(p.taxableTransportExcess).toBe(20_000);
    expect(p.grossTaxable).toBe(120_000);
    expect(p.grossTotal).toBe(150_000);
  });

  it('commercial : primes espèces déjà versées déduites du net à payer', () => {
    // Carine : base 150 000, primes de vente 24 000 (imposables),
    // transport 22 jours × 2 500 = 55 000 (30 000 exonérés + 25 000 imposables),
    // le tout déjà payé en espèces à la clôture de caisse (79 000)
    const p = computeCIPayroll({
      baseSalary: 150_000,
      taxableBonuses: 24_000,
      transportAllowance: 55_000,
      cashAlreadyPaid: 79_000,
    });
    expect(p.grossTotal).toBe(229_000);
    expect(p.netToPay).toBeCloseTo(p.netSalary - 79_000, 2);
    expect(p.netToPay).toBeGreaterThan(0);
  });

  it('salarié NON assujetti CNPS : aucune charge légale, net = brut', () => {
    const p = computeCIPayroll({
      baseSalary: 150_000,
      taxableBonuses: 24_000,
      transportAllowance: 55_000,
      cashAlreadyPaid: 79_000,
      subjectToLegalCharges: false,
    });
    expect(p.employee.cnpsRetirement).toBe(0);
    expect(p.employee.its).toBe(0);
    expect(p.employer.total).toBe(0);
    expect(p.netSalary).toBe(p.grossTotal);
    expect(p.netToPay).toBe(p.grossTotal - 79_000);
  });

  it('journalier sous le SMIG mensuel : ni ITS ni RICF négative', () => {
    const p = computeCIPayroll({ baseSalary: 5_000 * 12 }); // 12 jours à 5 000
    expect(p.employee.its).toBe(0);
    expect(p.netToPay).toBeGreaterThan(0);
  });
});
