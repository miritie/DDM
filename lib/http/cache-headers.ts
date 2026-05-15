/**
 * Helpers de cache HTTP pour les routes API.
 *
 * Contexte DDM : connexions 3G/4G instables, écrans qui re-chargent souvent
 * les mêmes données de référence (catégories, comptes comptables, rôles,
 * wallets, ingrédients…). Sans cache HTTP, chaque navigation refait l'aller-
 * retour réseau ; avec, le navigateur sert depuis sa mémoire instantanément.
 *
 * Convention :
 *   - `private` : ne pas mettre en cache sur les proxies/CDN (les données
 *     sont scopées par workspace et user via la session)
 *   - `max-age` court (60-300s) : on tolère une donnée vieille de quelques
 *     secondes mais on évite qu'elle traîne après un changement (la
 *     stale-while-revalidate fait que la donnée est servie immédiatement
 *     pendant que le navigateur va revalider en arrière-plan).
 */

import { NextResponse } from 'next/server';

export type CachePreset =
  | 'reference'     // Données quasi-statiques (catégories, comptes, types). 5 min cache + 5 min SWR.
  | 'shortLived'    // Données qui changent dans la journée (wallets, ingredients). 60s + 5 min SWR.
  | 'volatile'      // Données qui changent à chaque action (transactions, queues). 10s + 30s SWR.
  | 'never';        // Pas de cache (paiements en cours, créations, etc.)

const PRESETS: Record<CachePreset, string> = {
  reference:  'private, max-age=300, stale-while-revalidate=300',
  shortLived: 'private, max-age=60,  stale-while-revalidate=300',
  volatile:   'private, max-age=10,  stale-while-revalidate=30',
  never:      'no-store',
};

/**
 * Renvoie une NextResponse JSON avec l'en-tête Cache-Control approprié.
 * Utiliser depuis une route GET :
 *
 *   return cachedJson(data, 'reference');
 */
export function cachedJson<T>(data: T, preset: CachePreset = 'shortLived'): NextResponse {
  return NextResponse.json({ data }, {
    headers: { 'Cache-Control': PRESETS[preset] },
  });
}
