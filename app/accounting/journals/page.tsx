'use client';

/**
 * Page - Journaux Comptables
 * Liste les journaux (ventes, achats, banque, caisse, OD, paie).
 * Chaque ligne est cliquable → écritures du journal.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, BookMarked, ChevronRight } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import type { Journal, JournalEntry } from '@/types/modules';

const TYPE_LABELS: Record<string, string> = {
  sales: 'Ventes',
  purchases: 'Achats',
  bank: 'Banque',
  cash: 'Caisse',
  operations: 'Opérations diverses',
  payroll: 'Paie',
};

export default function JournalsPage() {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [countByJournal, setCountByJournal] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/accounting/journals'),
      fetch('/api/accounting/entries'),
    ])
      .then(async ([jRes, eRes]) => {
        if (jRes.status !== 'fulfilled' || !jRes.value.ok) {
          const body = jRes.status === 'fulfilled' ? await jRes.value.json().catch(() => ({})) : {};
          throw new Error((body as any).error || 'Erreur de chargement');
        }
        setJournals((await jRes.value.json()).data || []);
        if (eRes.status === 'fulfilled' && eRes.value.ok) {
          const entries: JournalEntry[] = (await eRes.value.json()).data || [];
          const m = new Map<string, number>();
          for (const e of entries) m.set(e.JournalId, (m.get(e.JournalId) || 0) + 1);
          setCountByJournal(m);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openJournal = (j: Journal) =>
    router.push(`/accounting/entries?journalId=${encodeURIComponent(j.JournalId)}&journal=${encodeURIComponent(j.Code + ' — ' + j.Label)}`);

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div>
          <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Comptabilité
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookMarked className="w-7 h-7 text-amber-700" /> Journaux
          </h1>
          <p className="text-muted-foreground">
            {journals.length} journal(aux) configuré(s) — cliquez sur un journal pour voir ses écritures
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : journals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              Aucun journal. Utilisez « Initialiser Journaux » sur la page Comptabilité.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-2 w-20">Code</th>
                    <th className="text-left py-2">Libellé</th>
                    <th className="text-left py-2 w-44">Type</th>
                    <th className="text-right py-2 w-24">Écritures</th>
                    <th className="text-center py-2 w-24">Actif</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {journals.map(j => (
                    <tr
                      key={j.JournalId}
                      onClick={() => openJournal(j)}
                      className="border-b last:border-b-0 hover:bg-amber-50 cursor-pointer"
                      title={`Voir les écritures du journal ${j.Code}`}
                    >
                      <td className="py-2.5 font-mono text-xs font-bold">{j.Code}</td>
                      <td className="py-2.5">{j.Label}</td>
                      <td className="py-2.5 text-gray-500">{TYPE_LABELS[j.JournalType] || j.JournalType}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {countByJournal.get(j.JournalId)
                          ? <span className="font-semibold">{countByJournal.get(j.JournalId)}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="py-2.5 text-center">
                        {j.IsActive
                          ? <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Actif</span>
                          : <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">Inactif</span>}
                      </td>
                      <td className="py-2.5 text-gray-400"><ChevronRight className="w-4 h-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedPage>
  );
}
