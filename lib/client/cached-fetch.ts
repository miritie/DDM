'use client';

/**
 * Cache mémoire client pour les fetch de données de référence.
 *
 * Objectif : éviter de refetcher 10 fois par navigation les listes qui ne
 * bougent pas (catégories de dépense, types, plan comptable, rôles, etc.).
 * Le cache HTTP côté navigateur fait déjà 80% du job — celui-ci sert pour
 * les requêtes simultanées sur la même URL pendant le mount de plusieurs
 * composants frères (sinon chacun fait son fetch, le cache HTTP ne dédupe
 * pas les requêtes in-flight).
 *
 * Implémentation volontairement minimale (pas de dépendance SWR / React
 * Query) : Map + TTL + dedup des requêtes in-flight.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000;  // 5 minutes

/**
 * Fetch JSON avec cache mémoire + dédup des requêtes en vol.
 *
 *   const { data } = await cachedFetch('/api/expenses/categories?accessibleFor=me');
 *
 * - Si une réponse récente est en cache (< ttl) : retournée immédiatement.
 * - Si une requête est déjà en vol pour cette URL : on rejoint sa Promise.
 * - Sinon : on lance le fetch et on le met en cache.
 *
 * Pour invalider après une mutation : `invalidateCache('/api/.../some')`
 * (ou wildcard via préfixe : `invalidateCache.prefix('/api/expenses/')`).
 */
export async function cachedFetch<T = any>(
  url: string,
  options: { ttl?: number; init?: RequestInit } = {}
): Promise<T> {
  const now = Date.now();
  const ttl = options.ttl ?? DEFAULT_TTL_MS;

  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = inflight.get(url);
  if (pending) return pending;

  const promise = fetch(url, options.init).then(async (r) => {
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body?.error || `HTTP ${r.status}`);
    }
    const json = await r.json();
    cache.set(url, { data: json, expiresAt: Date.now() + ttl });
    inflight.delete(url);
    return json;
  }).catch((err) => {
    inflight.delete(url);
    throw err;
  });

  inflight.set(url, promise);
  return promise;
}

/** Invalide une URL précise. */
export function invalidateCache(url: string): void {
  cache.delete(url);
}

/** Invalide toutes les URLs qui commencent par un préfixe (utile après mutation). */
invalidateCache.prefix = (prefix: string): void => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
};

/** Vide tout le cache (déconnexion, switch workspace…). */
invalidateCache.all = (): void => {
  cache.clear();
  inflight.clear();
};
