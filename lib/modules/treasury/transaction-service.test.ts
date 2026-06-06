/**
 * Tests du service Transactions (trésorerie) — argent réel, zéro tolérance.
 *
 * On simule pg avec un faux client à état (solde wallet en mémoire) pour
 * vérifier : atomicité (rollback), verrouillage, validation des montants,
 * et paramétrage SQL (pas d'interpolation de valeurs).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __resetDocCountersCacheForTests } from '@/lib/database/doc-counters';

const h = vi.hoisted(() => ({ db: null as any }));

vi.mock('@/lib/database/postgres-client', () => ({
  getPostgresClient: () => ({
    query: (...args: any[]) => h.db.query(...args),
    transaction: (...args: any[]) => h.db.transaction(...args),
  }),
}));

import { TransactionService } from './transaction-service';

interface FakeTxRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  source_wallet_id: string | null;
  destination_wallet_id: string | null;
}

function makeFakeDb(opts: { walletBalance?: number; txRow?: FakeTxRow } = {}) {
  const state = {
    balance: opts.walletBalance ?? 1000,
    committed: false,
    rolledBack: false,
  };
  const calls: Array<{ sql: string; params: any[] }> = [];

  const fake = {
    state,
    calls,
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.includes('to_regclass')) return { rows: [{ t: 'doc_counters' }] };
      if (sql.includes('UPDATE doc_counters')) return { rows: [{ value: 7 }] };
      if (sql.includes('FROM users')) return { rows: [{ id: 'user-uuid' }] };
      if (sql.includes('FROM wallets') && sql.includes('FOR UPDATE')) {
        return { rows: [{ id: params[0], name: 'Caisse', balance: state.balance }] };
      }
      if (sql.includes('SELECT id FROM wallets')) {
        return { rows: [{ id: params[0] }] };
      }
      if (sql.includes('UPDATE wallets')) {
        state.balance += Number(params[1]);
        return { rows: [{ balance: state.balance }] };
      }
      if (sql.includes('INSERT INTO transactions')) {
        return {
          rows: [{
            Id: 'tx-uuid',
            TransactionId: params[0],
            TransactionNumber: params[1],
            Type: params[2],
            Amount: params[4],
            Status: 'completed',
          }],
        };
      }
      if (sql.includes('FROM transactions') && sql.includes('FOR UPDATE')) {
        return { rows: opts.txRow ? [opts.txRow] : [] };
      }
      if (sql.includes('UPDATE transactions')) {
        return { rows: [{ Id: params[params.length - 1], Status: 'cancelled' }] };
      }
      if (sql.includes('FROM transactions')) return { rows: [] };
      return { rows: [] };
    },
    async transaction<T>(cb: (client: any) => Promise<T>): Promise<T> {
      const snapshot = state.balance;
      try {
        const result = await cb(fake);
        state.committed = true;
        return result;
      } catch (e) {
        state.balance = snapshot; // simule le ROLLBACK
        state.rolledBack = true;
        throw e;
      }
    },
  };
  return fake;
}

const baseInput = {
  category: 'sale' as any,
  description: 'Test',
  processedById: 'USR-001',
  workspaceId: 'ws-uuid',
};

beforeEach(() => {
  __resetDocCountersCacheForTests();
});

describe('TransactionService.createIncome', () => {
  it('insère la transaction ET crédite le wallet dans la même transaction SQL', async () => {
    h.db = makeFakeDb({ walletBalance: 100 });
    const service = new TransactionService();
    const tx = await service.createIncome({
      ...baseInput, type: 'income', amount: 50, destinationWalletId: 'wallet-uuid',
    });
    expect((tx as any).Status).toBe('completed');
    expect(h.db.state.balance).toBe(150);
    expect(h.db.state.committed).toBe(true);
    // Le wallet a bien été verrouillé avant écriture
    expect(h.db.calls.some((c: any) => c.sql.includes('FOR UPDATE') && c.sql.includes('FROM wallets'))).toBe(true);
  });

  it('refuse un montant nul, négatif ou NaN', async () => {
    h.db = makeFakeDb();
    const service = new TransactionService();
    for (const amount of [0, -50, NaN, Infinity]) {
      await expect(service.createIncome({
        ...baseInput, type: 'income', amount, destinationWalletId: 'w',
      })).rejects.toThrow('Montant invalide');
    }
    // Rien n'a été écrit
    expect(h.db.calls.some((c: any) => c.sql.includes('INSERT INTO transactions'))).toBe(false);
  });

  it('exige un wallet de destination', async () => {
    h.db = makeFakeDb();
    const service = new TransactionService();
    await expect(service.createIncome({ ...baseInput, type: 'income', amount: 10 }))
      .rejects.toThrow('Le wallet de destination est requis');
  });
});

describe('TransactionService.createExpense', () => {
  it('débite le wallet quand le solde suffit', async () => {
    h.db = makeFakeDb({ walletBalance: 100 });
    const service = new TransactionService();
    await service.createExpense({
      ...baseInput, type: 'expense', amount: 60, sourceWalletId: 'wallet-uuid',
    });
    expect(h.db.state.balance).toBe(40);
    expect(h.db.state.committed).toBe(true);
  });

  it('rejette si le solde est insuffisant — sans rien écrire (rollback)', async () => {
    h.db = makeFakeDb({ walletBalance: 30 });
    const service = new TransactionService();
    await expect(service.createExpense({
      ...baseInput, type: 'expense', amount: 60, sourceWalletId: 'wallet-uuid',
    })).rejects.toThrow('Solde insuffisant');
    expect(h.db.state.balance).toBe(30); // inchangé
    expect(h.db.calls.some((c: any) => c.sql.includes('INSERT INTO transactions'))).toBe(false);
  });
});

describe('TransactionService.createTransfer', () => {
  it('refuse un transfert vers le même wallet', async () => {
    h.db = makeFakeDb();
    const service = new TransactionService();
    await expect(service.createTransfer({
      ...baseInput, type: 'transfer', amount: 10,
      sourceWalletId: 'same-wallet', destinationWalletId: 'same-wallet',
    })).rejects.toThrow('doivent être différents');
  });
});

describe('TransactionService.cancel', () => {
  it("refuse d'annuler une transaction déjà annulée", async () => {
    h.db = makeFakeDb({
      txRow: {
        id: 'tx-1', type: 'income', status: 'cancelled', amount: 50,
        source_wallet_id: null, destination_wallet_id: 'w1',
      },
    });
    const service = new TransactionService();
    await expect(service.cancel('tx-1')).rejects.toThrow('déjà annulée');
    expect(h.db.state.rolledBack).toBe(true);
  });

  it('inverse le solde du wallet destination pour un income annulé', async () => {
    h.db = makeFakeDb({
      walletBalance: 200,
      txRow: {
        id: 'tx-1', type: 'income', status: 'completed', amount: 50,
        source_wallet_id: null, destination_wallet_id: 'w1',
      },
    });
    const service = new TransactionService();
    const result = await service.cancel('tx-1');
    expect((result as any).Status).toBe('cancelled');
    expect(h.db.state.balance).toBe(150);
    expect(h.db.state.committed).toBe(true);
  });

  it("n'inverse PAS les soldes pour une transaction restée 'pending' (jamais appliquée)", async () => {
    h.db = makeFakeDb({
      walletBalance: 200,
      txRow: {
        id: 'tx-1', type: 'income', status: 'pending', amount: 50,
        source_wallet_id: null, destination_wallet_id: 'w1',
      },
    });
    const service = new TransactionService();
    const result = await service.cancel('tx-1');
    expect((result as any).Status).toBe('cancelled');
    expect(h.db.state.balance).toBe(200); // aucun mouvement
    expect(h.db.calls.some((c: any) => c.sql.includes('UPDATE wallets'))).toBe(false);
  });

  it('échoue proprement (rollback) si la transaction est introuvable', async () => {
    h.db = makeFakeDb({ txRow: undefined });
    const service = new TransactionService();
    await expect(service.cancel('inconnu')).rejects.toThrow('Transaction non trouvée');
    expect(h.db.state.balance).toBe(1000); // aucun mouvement
  });
});

describe('TransactionService.list — SQL paramétré', () => {
  it("ne concatène jamais les valeurs de filtre dans le SQL", async () => {
    h.db = makeFakeDb();
    const service = new TransactionService();
    const malicious = `income'; DROP TABLE transactions; --`;
    await service.list('ws-uuid', { type: malicious as any, walletId: malicious });
    const listCall = h.db.calls.find((c: any) => c.sql.includes('ORDER BY processed_at'));
    expect(listCall).toBeDefined();
    expect(listCall!.sql).not.toContain('DROP TABLE');
    expect(listCall!.params).toContain(malicious);
    expect(listCall!.params[0]).toBe('ws-uuid');
  });

  it('filtre par workspace (la fuite multi-workspace est corrigée)', async () => {
    h.db = makeFakeDb();
    const service = new TransactionService();
    await service.list('ws-uuid');
    const listCall = h.db.calls.find((c: any) => c.sql.includes('FROM transactions'));
    expect(listCall!.sql).toContain('workspace_id::text = $1');
  });
});
