'use client';

/**
 * Page - Écritures Comptables
 * Liste les écritures avec statut, exercice et période.
 * Filtrable par journal : /accounting/entries?journalId=…&journal=Libellé
 * (lien depuis la page Journaux).
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, FileText, X } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import type { JournalEntry } from '@/types/modules';

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  posted: { label: 'Comptabilisée', cls: 'bg-blue-50 text-blue-700' },
  validated: { label: 'Validée', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Annulée', cls: 'bg-red-50 text-red-700' },
};

function EntriesContent() {
  const searchParams = useSearchParams();
  const journalId = searchParams.get('journalId');
  const journalLabel = searchParams.get('journal');

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = journalId ? `?journalId=${encodeURIComponent(journalId)}` : '';
    fetch(`/api/accounting/entries${qs}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
        return r.json();
      })
      .then(({ data }) => setEntries(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [journalId]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <Link
          href={journalId ? '/accounting/journals' : '/accounting'}
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1"
        >
          <ArrowLeft className="w-4 h-4" /> {journalId ? 'Journaux' : 'Comptabilité'}
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="w-7 h-7 text-amber-700" /> Écritures Comptables
        </h1>
        <p className="text-muted-foreground">{entries.length} écriture(s) enregistrée(s)</p>
      </div>

      {journalId && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <span>Journal : <strong>{journalLabel || journalId}</strong></span>
          <Link href="/accounting/entries" className="text-amber-700 hover:text-amber-900" title="Retirer le filtre">
            <X className="w-4 h-4" />
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
      ) : error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            {journalId
              ? <>Aucune écriture dans ce journal pour l'instant.</>
              : <>Aucune écriture pour l'instant. Les écritures sont générées par les
                  opérations métier (paiements de dépenses, ventes…) ou saisies par
                  le comptable.</>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr className="border-b">
                  <th className="text-left py-2">N°</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Libellé</th>
                  <th className="text-left py-2">Référence</th>
                  <th className="text-center py-2">Période</th>
                  <th className="text-center py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const badge = STATUS_BADGES[e.Status] || STATUS_BADGES.draft;
                  return (
                    <tr key={e.EntryId} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-2.5 font-mono text-xs font-semibold">{e.EntryNumber}</td>
                      <td className="py-2.5 whitespace-nowrap">
                        {new Date(e.EntryDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-2.5 max-w-[280px] truncate" title={e.Description}>{e.Description}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{e.Reference || '—'}</td>
                      <td className="py-2.5 text-center text-xs text-gray-500">
                        {e.FiscalPeriod}/{e.FiscalYear}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function JournalEntriesPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      {/* useSearchParams exige une frontière Suspense (Next.js App Router) */}
      <Suspense fallback={<div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>}>
        <EntriesContent />
      </Suspense>
    </ProtectedPage>
  );
}
