'use client';

/**
 * Page - Plan Comptable OHADA
 * Liste les comptes groupés par classe, avec recherche.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, BookOpen } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChartAccount } from '@/types/modules';

const CLASS_LABELS: Record<string, string> = {
  '1': 'Classe 1 — Capitaux',
  '2': 'Classe 2 — Immobilisations',
  '3': 'Classe 3 — Stocks',
  '4': 'Classe 4 — Tiers',
  '5': 'Classe 5 — Trésorerie',
  '6': 'Classe 6 — Charges',
  '7': 'Classe 7 — Produits',
  '8': 'Classe 8 — Comptes spéciaux',
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/accounting/accounts')
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
        return r.json();
      })
      .then(({ data }) => setAccounts(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = accounts.filter(a =>
      !q ||
      a.AccountNumber.toLowerCase().includes(q) ||
      (a.Label || '').toLowerCase().includes(q)
    );
    const map = new Map<string, ChartAccount[]>();
    for (const a of filtered) {
      const cls = (a.AccountNumber || '?').charAt(0);
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(a);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.AccountNumber.localeCompare(b.AccountNumber));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [accounts, search]);

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Comptabilité
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-amber-700" /> Plan Comptable
            </h1>
            <p className="text-muted-foreground">{accounts.length} compte(s) OHADA</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un compte (n° ou libellé)…"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-72"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              Aucun compte. Utilisez « Initialiser Plan Comptable » sur la page Comptabilité.
            </CardContent>
          </Card>
        ) : (
          grouped.map(([cls, list]) => (
            <Card key={cls}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{CLASS_LABELS[cls] || `Classe ${cls}`}
                  <span className="ml-2 text-xs font-normal text-gray-400">{list.length} compte(s)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr className="border-b">
                      <th className="text-left py-2 w-28">N°</th>
                      <th className="text-left py-2">Libellé</th>
                      <th className="text-left py-2 w-32">Type</th>
                      <th className="text-center py-2 w-28">Saisie directe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(a => (
                      <tr key={a.AccountId} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-2 font-mono text-xs font-semibold">{a.AccountNumber}</td>
                        <td className="py-2">{a.Label}</td>
                        <td className="py-2 text-gray-500 capitalize">{a.AccountType}</td>
                        <td className="py-2 text-center">
                          {a.AllowDirectPosting
                            ? <span className="text-emerald-600">✓</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ProtectedPage>
  );
}
