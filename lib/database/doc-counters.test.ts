import { describe, it, expect, beforeEach } from 'vitest';
import { nextDocSequence, __resetDocCountersCacheForTests, Queryable } from './doc-counters';

/** Faux client pg : route les requêtes par fragment de SQL. */
function makeFakeDb(opts: { tableExists: boolean; counterValue?: number }) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const db: Queryable & { calls: typeof calls } = {
    calls,
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.includes('to_regclass')) {
        return { rows: [{ t: opts.tableExists ? 'doc_counters' : null }] };
      }
      if (sql.includes('UPDATE doc_counters')) {
        return { rows: opts.counterValue !== undefined ? [{ value: opts.counterValue }] : [] };
      }
      if (sql.includes('INSERT INTO doc_counters')) {
        // seed + 1, comme le ferait Postgres
        return { rows: [{ value: Number(params[1]) + 1 }] };
      }
      return { rows: [] };
    },
  };
  return db;
}

beforeEach(() => {
  __resetDocCountersCacheForTests();
});

describe('nextDocSequence', () => {
  it('retombe sur seed+1 si la table doc_counters est absente (prod pas migrée)', async () => {
    const db = makeFakeDb({ tableExists: false });
    const n = await nextDocSequence('sales:ws1:2026', async () => 41, db);
    expect(n).toBe(42);
    // Aucune écriture tentée sur une table absente
    expect(db.calls.some(c => c.sql.includes('UPDATE doc_counters'))).toBe(false);
    expect(db.calls.some(c => c.sql.includes('INSERT INTO doc_counters'))).toBe(false);
  });

  it('incrémente atomiquement quand le compteur existe', async () => {
    const db = makeFakeDb({ tableExists: true, counterValue: 105 });
    const n = await nextDocSequence('transactions:ws1:income', async () => {
      throw new Error('seed ne doit pas être appelé quand le compteur existe');
    }, db);
    expect(n).toBe(105);
  });

  it("amorce le compteur depuis l'existant quand il est absent", async () => {
    const db = makeFakeDb({ tableExists: true }); // UPDATE → 0 ligne
    const n = await nextDocSequence('sales:ws1:2026', async () => 12, db);
    expect(n).toBe(13);
    const ins = db.calls.find(c => c.sql.includes('INSERT INTO doc_counters'));
    expect(ins?.params).toEqual(['sales:ws1:2026', 12]);
  });

  it('ne re-vérifie pas l\'existence de la table une fois confirmée (cache)', async () => {
    const db = makeFakeDb({ tableExists: true, counterValue: 1 });
    await nextDocSequence('s', async () => 0, db);
    await nextDocSequence('s', async () => 0, db);
    const regclassCalls = db.calls.filter(c => c.sql.includes('to_regclass'));
    expect(regclassCalls.length).toBe(1);
  });

  it('passe le scope en paramètre lié (jamais interpolé dans le SQL)', async () => {
    const db = makeFakeDb({ tableExists: true, counterValue: 1 });
    const malicious = `x'; DROP TABLE doc_counters; --`;
    await nextDocSequence(malicious, async () => 0, db);
    const upd = db.calls.find(c => c.sql.includes('UPDATE doc_counters'));
    expect(upd?.sql).not.toContain(malicious);
    expect(upd?.params).toContain(malicious);
  });
});
