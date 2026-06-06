/**
 * Numérotation des documents de vente — UNIQUE source de vérité.
 *
 * Tous les chemins qui émettent un numéro de vente (SAL- via SaleService,
 * VT- via le POS quick et finalizeAsSale) ou de paiement (PAY-) passent par
 * ici : même scope doc_counters, même seed. Avant, trois copies divergentes
 * (COUNT sur sale_date vs created_at vs Date.now()) pouvaient produire des
 * numéros en doublon.
 *
 * Le seed (valeur de départ du compteur, calculée une seule fois par
 * workspace+année) est le PLUS GRAND suffixe numérique déjà émis dans
 * l'année — pas un COUNT. Les numéros legacy ont été générés avec des
 * méthodes de comptage différentes (count global de la table, timestamps
 * tronqués…) : seul le max garantit qu'aucun nouveau numéro n'entre en
 * collision avec un numéro existant, quel que soit l'historique.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { nextDocSequence } from '@/lib/database/doc-counters';

const db = getPostgresClient();

/**
 * Plus grand suffixe numérique déjà émis pour l'année donnée.
 * Couvre tous les préfixes (SAL-, VT-, PAY-…) et formats de suffixe
 * (0042 paddé, 483920 issu d'un timestamp legacy).
 */
async function maxNumberSuffix(
  table: 'sales' | 'sale_payments',
  column: 'sale_number' | 'payment_number',
  workspaceId: string,
  year: number
): Promise<number> {
  const r = await db.query<any>(
    `SELECT COALESCE(MAX(substring(${column} from '-(\\d+)$')::int), 0) AS n
     FROM ${table}
     WHERE workspace_id::text = $1
       AND ${column} LIKE '%-' || $2 || '-%'
       AND ${column} ~ '-\\d+$'`,
    [workspaceId, String(year)]
  );
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Numéro de vente. Une seule séquence par workspace+année, partagée entre
 * les préfixes SAL- (ventes classiques) et VT- (POS / commandes finalisées) :
 * deux chemins simultanés ne peuvent pas émettre le même indice.
 */
export async function generateSaleNumber(workspaceId: string, prefix: 'SAL' | 'VT' = 'SAL'): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextDocSequence(
    `sales:${workspaceId}:${year}`,
    () => maxNumberSuffix('sales', 'sale_number', workspaceId, year)
  );
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Numéro de paiement PAY-<année>-<seq>, tous chemins d'encaissement confondus. */
export async function generatePaymentNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextDocSequence(
    `sale_payments:${workspaceId}:${year}`,
    () => maxNumberSuffix('sale_payments', 'payment_number', workspaceId, year)
  );
  return `PAY-${year}-${String(sequence).padStart(4, '0')}`;
}
