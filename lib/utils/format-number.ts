/**
 * Helpers de formatage de nombres et montants.
 *
 * Intl.NumberFormat('fr-FR') produit U+202F (NNBSP, narrow no-break space)
 * comme séparateur de milliers — invisible sur certains navigateurs ou
 * polices. On normalise vers un espace classique ASCII partout, pour
 * que "121916" devienne réellement "121 916" et pas "121916".
 */

const NNBSP_NBSP = / | /g; // U+202F (NNBSP) et U+00A0 (NBSP)

/** Formate un entier (ou montant arrondi) avec séparateur de milliers. */
export function fmtInt(n: any): string {
  const v = Number(n);
  const safe = Number.isFinite(v) ? Math.round(v) : 0;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(safe)
    .replace(NNBSP_NBSP, ' ');
}

/** Formate un montant en F CFA. fallback 0 si NaN/null/undefined. */
export function fmtXOF(n: any): string {
  return `${fmtInt(n)} F CFA`;
}

/** Version courte avec suffixe " F" (pour les KPI compacts). */
export function fmtXOFShort(n: any): string {
  return `${fmtInt(n)} F`;
}

/** Formate un nombre avec décimales (ex: pourcentages, ratios). */
export function fmtDecimal(n: any, decimals = 2): string {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(safe)
    .replace(NNBSP_NBSP, ' ');
}
