'use client';

/**
 * Page - Grand Livre
 * Synthèse par compte (débit, crédit, solde, mouvements) avec drill-down :
 * clic sur un compte → mouvements détaillés (date, écriture, journal,
 * libellé, débit/crédit, solde progressif).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, BookOpenCheck, ChevronRight, X } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

interface LedgerAccount { number: string; label: string; debit: number; credit: number; solde: number; linesCount: number }
interface LedgerLine { entryNumber: string; date: string; journalCode: string; label: string; reference: string | null; debit: number; credit: number }

function AccountDetailModal({ fiscalYear, account, label, onClose }: {
  fiscalYear: number; account: string; label: string; onClose: () => void;
}) {
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/accounting/reports/general-ledger?fiscalYear=${fiscalYear}&account=${encodeURIComponent(account)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
        return r.json();
      })
      .then(({ data }) => setLines(data.lines || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fiscalYear, account]);

  let running = 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold font-mono">{account}</h2>
            <p className="text-xs text-gray-500">{label} — exercice {fiscalYear}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-700" /></div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          ) : lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Aucun mouvement sur ce compte pour l'exercice.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">Date</th>
                  <th className="text-left py-2 pr-2">Écriture</th>
                  <th className="text-left py-2 pr-2">Libellé</th>
                  <th className="text-right py-2 px-2">Débit</th>
                  <th className="text-right py-2 px-2">Crédit</th>
                  <th className="text-right py-2 pl-2">Solde</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  running += (l.debit || 0) - (l.credit || 0);
                  return (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(l.date + 'T00:00:00').toLocaleDateString('fr-FR')}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs">{l.entryNumber}</td>
                      <td className="py-1.5 pr-2 max-w-[220px] truncate" title={l.label}>{l.label}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{l.debit ? fmt(l.debit) : ''}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{l.credit ? fmt(l.credit) : ''}</td>
                      <td className={'py-1.5 pl-2 text-right tabular-nums font-semibold ' + (running >= 0 ? 'text-gray-900' : 'text-red-600')}>
                        {fmt(Math.abs(running))} {running >= 0 ? 'D' : 'C'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

export default function GeneralLedgerPage() {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAccount, setOpenAccount] = useState<LedgerAccount | null>(null);

  const load = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/accounting/reports/general-ledger?fiscalYear=${year}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
      const { data } = await r.json();
      setAccounts(data.accounts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(fiscalYear); }, [fiscalYear, load]);

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Comptabilité
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpenCheck className="w-7 h-7 text-amber-700" /> Grand Livre
            </h1>
            <p className="text-muted-foreground">Mouvements par compte — cliquez sur un compte pour le détail</p>
          </div>
          <label className="text-sm text-gray-600 inline-flex items-center gap-2">
            Exercice
            <select value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              Aucune écriture comptabilisée sur l'exercice {fiscalYear}.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-2 w-24">Compte</th>
                    <th className="text-left py-2">Libellé</th>
                    <th className="text-center py-2 w-24">Mouvements</th>
                    <th className="text-right py-2 w-32">Débit</th>
                    <th className="text-right py-2 w-32">Crédit</th>
                    <th className="text-right py-2 w-32">Solde</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.number} onClick={() => setOpenAccount(a)}
                      className="border-b last:border-b-0 hover:bg-amber-50 cursor-pointer"
                      title={`Voir les mouvements du compte ${a.number}`}>
                      <td className="py-2 font-mono text-xs font-semibold">{a.number}</td>
                      <td className="py-2">{a.label}</td>
                      <td className="py-2 text-center text-xs text-gray-500">{a.linesCount}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(a.debit)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(a.credit)}</td>
                      <td className={'py-2 text-right tabular-nums font-semibold ' + (a.solde >= 0 ? 'text-gray-900' : 'text-red-600')}>
                        {fmt(Math.abs(a.solde))} {a.solde >= 0 ? 'D' : 'C'}
                      </td>
                      <td className="py-2 text-gray-400"><ChevronRight className="w-4 h-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {openAccount && (
          <AccountDetailModal
            fiscalYear={fiscalYear}
            account={openAccount.number}
            label={openAccount.label}
            onClose={() => setOpenAccount(null)}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
