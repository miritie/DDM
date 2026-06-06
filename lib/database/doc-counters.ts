/**
 * Compteurs de numérotation de documents — atomiques et thread-safe.
 *
 * Remplace le pattern « SELECT COUNT(*) puis +1 » qui produit des numéros
 * en doublon sous concurrence (deux requêtes simultanées lisent le même
 * count). Ici l'incrément est un UPDATE atomique sur une ligne de la table
 * `doc_counters` : Postgres sérialise les écrivains via le verrou de ligne.
 *
 * Migration : `npm run migrate:doc-counters` (scripts/database/migration-doc-counters.sql).
 * Tant que la table n'existe pas (prod pas encore migrée), on retombe sur
 * le comportement legacy (seed() + 1) pour ne rien casser — même fenêtre de
 * course qu'avant, pas pire.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';

/** Interface minimale commune à PostgresClient et PoolClient. */
export interface Queryable {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}

// La table ne peut pas « dé-exister » : une fois vue, on ne re-vérifie plus.
let counterTableKnown = false;

async function counterTableExists(db: Queryable): Promise<boolean> {
  if (counterTableKnown) return true;
  // to_regclass ne lève pas d'erreur si la table manque (contrairement à un
  // SELECT direct qui avorterait une transaction englobante en 42P01).
  const r = await db.query(`SELECT to_regclass('public.doc_counters') AS t`);
  counterTableKnown = Boolean(r.rows[0]?.t);
  return counterTableKnown;
}

/** Visible pour les tests uniquement. */
export function __resetDocCountersCacheForTests() {
  counterTableKnown = false;
}

/**
 * Retourne le prochain numéro de séquence pour un scope donné, de façon
 * atomique.
 *
 * @param scope  Clé du compteur, ex. `transactions:<workspaceUuid>:income`
 *               ou `sales:<workspaceUuid>:2026`. Une clé = une séquence.
 * @param seed   Valeur de départ si le compteur n'existe pas encore :
 *               doit retourner le nombre de documents DÉJÀ émis pour ce
 *               scope (généralement un COUNT(*)), afin que la numérotation
 *               continue sans trou ni collision avec l'existant.
 * @param client Optionnel : client de transaction (PoolClient) pour que
 *               l'incrément participe à la transaction englobante et soit
 *               annulé en cas de rollback.
 */
export async function nextDocSequence(
  scope: string,
  seed: () => Promise<number>,
  client?: Queryable
): Promise<number> {
  const db: Queryable = client ?? getPostgresClient();

  if (!(await counterTableExists(db))) {
    // Fallback legacy avant migration : COUNT + 1 (fenêtre de course
    // identique à l'ancien comportement).
    return (await seed()) + 1;
  }

  // 1) Incrément atomique si le compteur existe déjà (verrou de ligne).
  const upd = await db.query(
    `UPDATE doc_counters
     SET value = value + 1, updated_at = CURRENT_TIMESTAMP
     WHERE scope = $1
     RETURNING value`,
    [scope]
  );
  if (upd.rows.length > 0) return Number(upd.rows[0].value);

  // 2) Compteur absent : on l'amorce depuis l'existant. ON CONFLICT couvre
  //    la course entre deux amorçages simultanés (le perdant incrémente).
  const seedValue = await seed();
  const ins = await db.query(
    `INSERT INTO doc_counters (scope, value)
     VALUES ($1, $2 + 1)
     ON CONFLICT (scope) DO UPDATE
       SET value = doc_counters.value + 1, updated_at = CURRENT_TIMESTAMP
     RETURNING value`,
    [scope, seedValue]
  );
  return Number(ins.rows[0].value);
}
