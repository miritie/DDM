'use client';

/**
 * Page comptable — Validation des versements de caisse.
 *
 * Liste filtrable (statut) des cash_deposits enregistrés par les vendeurs.
 * Le comptable peut valider (RAS) ou rejeter (re-crédite la caisse stand).
 *
 * Accessible aux utilisateurs ayant cash:deposit:create (lecture) ;
 * les actions Valider/Rejeter exigent cash:deposit:validate (côté API).
 */

import { useCallback, useEffect, useState } from 'react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Banknote, Loader2, RefreshCw, Check, X, AlertTriangle, Clock,
  Building2, Smartphone, User as UserIcon, ImageIcon,
} from 'lucide-react';

interface Deposit {
  id: string;
  DepositId: string;
  OutletName?: string;
  WalletSourceName?: string;
  DestinationType: 'bank' | 'mobile_money' | 'person';
  DestinationWalletName: string | null;
  DestinationLabel: string | null;
  Amount: number;
  Reference: string | null;
  EvidenceUrl: string | null;
  Notes: string | null;
  Status: 'pending' | 'validated' | 'rejected';
  DepositedByName?: string;
  DepositedAt: string;
  ValidatedByName?: string | null;
  ValidatedAt: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XOF';

export default function CashDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'validated' | 'rejected'>('pending');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      qs.set('limit', '200');
      const r = await fetch('/api/cash-deposits?' + qs.toString());
      if (!r.ok) throw new Error('Impossible de charger les dépôts');
      const { data } = await r.json();
      setDeposits(data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: 'validate' | 'reject') {
    setActingId(id);
    try {
      const r = await fetch('/api/cash-deposits/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur');
      }
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  const totals = deposits.reduce(
    (acc, d) => {
      acc.count++;
      acc.total += Number(d.Amount);
      if (d.Status === 'pending') acc.pending += Number(d.Amount);
      return acc;
    },
    { count: 0, total: 0, pending: 0 }
  );

  return (
    <ProtectedPage permission={PERMISSIONS.CASH_DEPOSIT_CREATE}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Banknote className="w-8 h-8 text-emerald-600" />
              Versements de caisse
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Les dépôts enregistrés par les vendeurs depuis le POS.
              Le wallet caisse est déjà débité à la création — la validation est
              une confirmation comptable, le rejet re-crédite la caisse.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={'w-4 h-4 mr-1 ' + (loading ? 'animate-spin' : '')} />
            Rafraîchir
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4">
            <p className="text-[11px] uppercase font-semibold text-gray-500">Dépôts affichés</p>
            <p className="text-2xl font-bold">{totals.count}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-[11px] uppercase font-semibold text-gray-500">Total</p>
            <p className="text-2xl font-bold">{fmt(totals.total)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-[11px] uppercase font-semibold text-amber-700">À valider</p>
            <p className="text-2xl font-bold text-amber-700">{fmt(totals.pending)}</p>
          </CardContent></Card>
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'pending', 'validated', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={'px-3 py-1.5 rounded-md text-sm font-medium transition ' + (
                statusFilter === s
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {s === 'all' ? 'Tous' : s === 'pending' ? 'En attente' : s === 'validated' ? 'Validés' : 'Rejetés'}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liste</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && deposits.length === 0 ? (
              <div className="text-center py-12"><Loader2 className="w-6 h-6 mx-auto animate-spin text-emerald-600" /></div>
            ) : deposits.length === 0 ? (
              <p className="text-center py-12 text-sm text-gray-500 italic">Aucun dépôt à afficher.</p>
            ) : (
              <div className="divide-y">
                {deposits.map(d => (
                  <DepositRow
                    key={d.id}
                    deposit={d}
                    busy={actingId === d.id}
                    onValidate={() => act(d.id, 'validate')}
                    onReject={() => act(d.id, 'reject')}
                    onPreview={(url) => setPreviewUrl(url)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {previewUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              className="absolute top-4 right-4 text-white p-2"
              onClick={() => setPreviewUrl(null)}
              aria-label="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preuve dépôt" className="max-h-[90vh] max-w-full object-contain" />
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

function DepositRow({ deposit, busy, onValidate, onReject, onPreview }: {
  deposit: Deposit;
  busy: boolean;
  onValidate: () => void;
  onReject: () => void;
  onPreview: (url: string) => void;
}) {
  const DestIcon = deposit.DestinationType === 'bank' ? Building2
    : deposit.DestinationType === 'mobile_money' ? Smartphone
    : UserIcon;
  const destLabel = deposit.DestinationWalletName ?? deposit.DestinationLabel ?? '—';

  const statusConfig = {
    pending:   { Icon: Clock,         color: 'bg-amber-100 text-amber-800',     label: 'En attente' },
    validated: { Icon: Check,         color: 'bg-emerald-100 text-emerald-800', label: 'Validé' },
    rejected:  { Icon: AlertTriangle, color: 'bg-red-100 text-red-700',         label: 'Rejeté' },
  }[deposit.Status];

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
      <DestIcon className="w-5 h-5 text-gray-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{destLabel}</p>
          <span className={'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ' + statusConfig.color}>
            <statusConfig.Icon className="w-3 h-3" />
            {statusConfig.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">
          {deposit.OutletName ?? '—'} · {deposit.WalletSourceName ?? '—'} → {destLabel}
          {deposit.Reference && ' · ref ' + deposit.Reference}
        </p>
        <p className="text-[11px] text-gray-400">
          {new Date(deposit.DepositedAt).toLocaleString('fr-FR')} par {deposit.DepositedByName ?? '—'}
          {deposit.ValidatedAt && deposit.ValidatedByName && (
            <> · {deposit.Status === 'validated' ? 'validé' : 'rejeté'} par {deposit.ValidatedByName}</>
          )}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-base font-bold">{fmt(deposit.Amount)}</p>
        {deposit.EvidenceUrl && (
          <button
            onClick={() => onPreview(deposit.EvidenceUrl!)}
            className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <ImageIcon className="w-3 h-3" /> Voir preuve
          </button>
        )}
      </div>

      {deposit.Status === 'pending' && (
        <div className="flex flex-col gap-1 shrink-0">
          <Button size="sm" onClick={onValidate} disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span className="ml-1">Valider</span>
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={busy}
            className="text-red-600 border-red-300 hover:bg-red-50">
            <X className="w-3.5 h-3.5" />
            <span className="ml-1">Rejeter</span>
          </Button>
        </div>
      )}
    </div>
  );
}
