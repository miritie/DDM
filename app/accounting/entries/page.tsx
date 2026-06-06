'use client';

/**
 * Page - Écritures Comptables
 *
 * - Filtres : recherche (n°, libellé, référence), statut, période (du/au)
 * - Filtre par journal via ?journalId=… (lien depuis la page Journaux)
 * - Clic sur une écriture → détail complet : lignes débit/crédit par
 *   compte + opération métier source (dépense : sollicitée/validée/payée
 *   par qui ; vente : quand, vendeur, client, stand, articles, paiements)
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Loader2, FileText, X, Search, ChevronRight,
  ShoppingCart, ClipboardCheck,
} from 'lucide-react';
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

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ---------------------------------------------------------------------------
// Détail d'une écriture (modal)

interface EntryDetail {
  entry: {
    EntryId: string; EntryNumber: string; EntryDate: string; Description: string;
    Reference?: string; Status: string; PostedAt?: string; ValidatedAt?: string;
    FiscalYear: number; FiscalPeriod: number; CreatedAt: string;
    JournalCode?: string; JournalLabel?: string; PostedBy?: string; ValidatedBy?: string;
  };
  lines: Array<{
    LineNumber: number; Label: string; DebitAmount: number; CreditAmount: number;
    AccountNumber?: string; AccountLabel?: string;
  }>;
  source:
    | null
    | {
        type: 'expense'; expenseId: string; title: string; description?: string;
        amount: number; status: string; category?: string;
        requestNumber?: string; requestedBy?: string; submittedAt?: string;
        approvals: Array<{ order: number; approver?: string; status: string; comments?: string; processedAt?: string }>;
        paidBy?: string; paymentDate?: string; paymentMethod?: string; beneficiary?: string;
      }
    | {
        type: 'sale'; saleNumber: string; date: string; seller?: string;
        client?: string; outlet?: string; totalAmount: number; amountPaid: number;
        balance: number; status: string; paymentStatus: string;
        items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
        payments: Array<{ number: string; amount: number; date?: string; method?: string; wallet?: string; receivedBy?: string }>;
      };
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function EntryDetailModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/accounting/entries/${encodeURIComponent(entryId)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
        return r.json();
      })
      .then(({ data }) => setDetail(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [entryId]);

  const totals = (detail?.lines || []).reduce(
    (acc, l) => ({ debit: acc.debit + (l.DebitAmount || 0), credit: acc.credit + (l.CreditAmount || 0) }),
    { debit: 0, credit: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold font-mono">{detail?.entry.EntryNumber || entryId}</h2>
            {detail?.entry.JournalLabel && (
              <p className="text-xs text-gray-500">
                Journal {detail.entry.JournalCode} — {detail.entry.JournalLabel}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-700" /></div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          ) : detail && (
            <>
              {/* Méta écriture */}
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                <DetailRow label="Date" value={fmtDate(detail.entry.EntryDate)} />
                <DetailRow label="Période" value={`${detail.entry.FiscalPeriod}/${detail.entry.FiscalYear}`} />
                <DetailRow label="Libellé" value={detail.entry.Description} />
                <DetailRow label="Référence" value={detail.entry.Reference} />
                <DetailRow
                  label="Statut"
                  value={STATUS_BADGES[detail.entry.Status]?.label || detail.entry.Status}
                />
                {detail.entry.PostedBy && (
                  <DetailRow label="Comptabilisée par" value={`${detail.entry.PostedBy} · ${fmtDateTime(detail.entry.PostedAt)}`} />
                )}
                {detail.entry.ValidatedBy && (
                  <DetailRow label="Validée par" value={`${detail.entry.ValidatedBy} · ${fmtDateTime(detail.entry.ValidatedAt)}`} />
                )}
              </div>

              {/* Lignes débit / crédit */}
              <div>
                <h3 className="text-xs uppercase font-semibold text-gray-500 tracking-wide mb-2">
                  Lignes d'écriture
                </h3>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 w-24">Compte</th>
                      <th className="text-left px-3 py-2">Libellé</th>
                      <th className="text-right px-3 py-2 w-28">Débit</th>
                      <th className="text-right px-3 py-2 w-28">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map(l => (
                      <tr key={l.LineNumber} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-mono text-xs font-semibold" title={l.AccountLabel}>
                          {l.AccountNumber || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {l.Label}
                          {l.AccountLabel && <span className="block text-xs text-gray-400">{l.AccountLabel}</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.DebitAmount ? fmt(l.DebitAmount) : ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.CreditAmount ? fmt(l.CreditAmount) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-3 py-2" colSpan={2}>Totaux</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.debit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(totals.credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Opération source */}
              {detail.source?.type === 'expense' && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4" />
                    Dépense {detail.source.expenseId} — {detail.source.title}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    <DetailRow label="Catégorie" value={detail.source.category} />
                    <DetailRow label="Montant" value={fmt(detail.source.amount) + ' XOF'} />
                    <DetailRow
                      label="Sollicitée par"
                      value={detail.source.requestedBy
                        ? `${detail.source.requestedBy}${detail.source.submittedAt ? ' · ' + fmtDateTime(detail.source.submittedAt) : ''}`
                        : undefined}
                    />
                    <DetailRow label="Bénéficiaire" value={detail.source.beneficiary} />
                    <DetailRow
                      label="Payée par"
                      value={detail.source.paidBy
                        ? `${detail.source.paidBy}${detail.source.paymentDate ? ' · ' + fmtDateTime(detail.source.paymentDate) : ''}`
                        : undefined}
                    />
                    <DetailRow label="Moyen de paiement" value={detail.source.paymentMethod} />
                  </div>
                  {detail.source.approvals.length > 0 && (
                    <div>
                      <p className="text-xs uppercase font-semibold text-amber-800 mb-1">Validations</p>
                      <ul className="space-y-1">
                        {detail.source.approvals.map(a => (
                          <li key={a.order} className="text-sm flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                              {a.order}
                            </span>
                            <span className="font-medium">{a.approver || '—'}</span>
                            <span className={
                              a.status === 'approved' ? 'text-emerald-700' :
                              a.status === 'rejected' ? 'text-red-700' : 'text-gray-500'
                            }>
                              {a.status === 'approved' ? 'validée' : a.status === 'rejected' ? 'rejetée' : a.status}
                            </span>
                            {a.processedAt && <span className="text-xs text-gray-500">· {fmtDateTime(a.processedAt)}</span>}
                            {a.comments && <span className="text-xs text-gray-500 italic truncate">« {a.comments} »</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {detail.source?.type === 'sale' && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4" />
                    Vente {detail.source.saleNumber}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    <DetailRow label="Quand" value={fmtDateTime(detail.source.date)} />
                    <DetailRow label="Vendeur" value={detail.source.seller} />
                    <DetailRow label="Client" value={detail.source.client || 'Vente anonyme'} />
                    <DetailRow label="Stand" value={detail.source.outlet} />
                    <DetailRow label="Total" value={fmt(detail.source.totalAmount) + ' XOF'} />
                    <DetailRow
                      label="Encaissé / Reste"
                      value={`${fmt(detail.source.amountPaid)} / ${fmt(detail.source.balance)} XOF`}
                    />
                  </div>
                  {detail.source.items.length > 0 && (
                    <div>
                      <p className="text-xs uppercase font-semibold text-emerald-800 mb-1">Articles</p>
                      <ul className="text-sm space-y-0.5">
                        {detail.source.items.map((it, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span>{it.product_name} <span className="text-gray-500">× {fmt(it.quantity)}</span></span>
                            <span className="tabular-nums">{fmt(it.total_price)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detail.source.payments.length > 0 && (
                    <div>
                      <p className="text-xs uppercase font-semibold text-emerald-800 mb-1">Paiements</p>
                      <ul className="text-sm space-y-0.5">
                        {detail.source.payments.map((p, i) => (
                          <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono text-xs">{p.number}</span>
                            <span className="font-semibold tabular-nums">{fmt(p.amount)} XOF</span>
                            {p.method && <span className="text-gray-600">· {p.method}</span>}
                            {p.wallet && <span className="text-gray-500 text-xs">({p.wallet})</span>}
                            {p.receivedBy && <span className="text-gray-500 text-xs">reçu par {p.receivedBy}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {detail.entry.Reference && !detail.source && (
                <p className="text-xs text-gray-500 italic">
                  Référence « {detail.entry.Reference} » — opération source non retrouvée
                  (ni dépense, ni vente correspondante).
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liste

function EntriesContent() {
  const searchParams = useSearchParams();
  const journalId = searchParams.get('journalId');
  const journalLabel = searchParams.get('journal');

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres locaux
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Détail ouvert
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (status && e.Status !== status) return false;
      const day = e.EntryDate ? new Date(e.EntryDate).toISOString().slice(0, 10) : '';
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (q) {
        const hay = `${e.EntryNumber} ${e.Description} ${e.Reference || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, status, dateFrom, dateTo]);

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
        <p className="text-muted-foreground">
          {filtered.length} / {entries.length} écriture(s) — cliquez sur une écriture pour le détail complet
        </p>
      </div>

      {journalId && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <span>Journal : <strong>{journalLabel || journalId}</strong></span>
          <Link href="/accounting/entries" className="text-amber-700 hover:text-amber-900" title="Retirer le filtre">
            <X className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Filtres */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="N°, libellé ou référence…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <label className="text-xs text-gray-600">
            Statut
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="block mt-1 border border-gray-300 rounded-md px-2 py-2 text-sm"
            >
              <option value="">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="posted">Comptabilisée</option>
              <option value="validated">Validée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Du
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="block mt-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-gray-600">
            Au
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="block mt-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
          </label>
          {(search || status || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            >
              Réinitialiser
            </button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
      ) : error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            {entries.length === 0
              ? <>Aucune écriture pour l'instant. Les écritures sont générées par les
                  opérations métier (paiements de dépenses, ventes…) ou saisies par le comptable.</>
              : <>Aucune écriture ne correspond aux filtres.</>}
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
                  <th className="text-right py-2">Montant</th>
                  <th className="text-center py-2">Période</th>
                  <th className="text-center py-2">Statut</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const badge = STATUS_BADGES[e.Status] || STATUS_BADGES.draft;
                  return (
                    <tr
                      key={e.EntryId}
                      onClick={() => setOpenEntryId(e.EntryId)}
                      className="border-b last:border-b-0 hover:bg-amber-50 cursor-pointer"
                      title="Voir le détail de l'écriture"
                    >
                      <td className="py-2.5 font-mono text-xs font-semibold">{e.EntryNumber}</td>
                      <td className="py-2.5 whitespace-nowrap">{fmtDate(e.EntryDate)}</td>
                      <td className="py-2.5 max-w-[280px] truncate" title={e.Description}>{e.Description}</td>
                      <td className="py-2.5 text-gray-500 text-xs">{e.Reference || '—'}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                        {fmt(Number((e as any).Amount || 0))}
                      </td>
                      <td className="py-2.5 text-center text-xs text-gray-500">
                        {e.FiscalPeriod}/{e.FiscalYear}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-400"><ChevronRight className="w-4 h-4" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {openEntryId && (
        <EntryDetailModal entryId={openEntryId} onClose={() => setOpenEntryId(null)} />
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
