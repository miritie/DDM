'use client';

/**
 * Page — Inventaire trésorerie (cash count par wallet)
 *
 * Le comptable (ou admin) saisit le montant physique réellement présent
 * dans chaque wallet (caisse, banque, mobile money). L'écart est calculé
 * et appliqué via une transaction de type adjustment, traçant le mouvement
 * dans le grand livre.
 *
 * Pas de filtre période ici — on compte ce qui EST, point.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Wallet as WalletIcon, Save, History, Loader2, AlertTriangle,
  Check, RotateCw, DollarSign, CreditCard, Smartphone,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';

interface Wallet {
  Id?: string;
  id?: string;
  WalletId?: string;
  Name?: string;
  name?: string;
  Type?: string;
  type?: string;
  Balance?: number;
  IsActive?: boolean;
  BankName?: string;
}

interface AdjustmentTx {
  Id?: string;
  id?: string;
  TransactionNumber?: string;
  transaction_number?: string;
  Type?: string;
  type?: string;
  Amount?: number;
  amount?: number;
  Description?: string;
  description?: string;
  ProcessedAt?: string;
  processed_at?: string;
  SourceWalletId?: string;
  DestinationWalletId?: string;
}

const TYPE_VISUALS: Record<string, { icon: any; bg: string; border: string; iconColor: string }> = {
  cash:         { icon: DollarSign, bg: 'bg-green-50', border: 'border-green-200', iconColor: 'text-green-600' },
  bank:         { icon: CreditCard, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-600' },
  mobile_money: { icon: Smartphone, bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-600' },
  other:        { icon: WalletIcon, bg: 'bg-gray-50', border: 'border-gray-200', iconColor: 'text-gray-600' },
};

const fmt = (n: number | string) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n));

function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function pickId(w: Wallet): string { return (w.WalletId || w.Id || w.id || '') as string; }
function pickName(w: Wallet): string { return (w.Name || w.name || '—') as string; }
function pickType(w: Wallet): string { return (w.Type || w.type || 'other') as string; }
function pickBalance(w: Wallet): number { return Number(w.Balance ?? 0); }

export default function WalletInventoryPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.EXPENSE_PAY}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentTx[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [wR, tR] = await Promise.all([
        fetch('/api/treasury/wallets?isActive=true').then(r => r.json()),
        fetch('/api/treasury/transactions?category=adjustment').then(r => r.json()),
      ]);
      setWallets(wR.data || []);
      setAdjustments(tR.data || []);
      setCounts({});
      setReasons({});
      setSavedIds(new Set());
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function submitAdjustment(w: Wallet) {
    const id = pickId(w);
    const raw = counts[id];
    if (raw === undefined || raw === '') return;
    const counted = Number(raw);
    if (Number.isNaN(counted) || counted < 0) {
      setError(`Montant invalide pour ${pickName(w)}`);
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const r = await fetch('/api/treasury/wallets/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: id,
          countedBalance: counted,
          reason: reasons[id] || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSavedIds(curr => new Set([...curr, id]));
      // Reload pour solde mis à jour
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <WalletIcon className="w-7 h-7" /> Inventaire trésorerie
            </h1>
            <Button onClick={load} variant="outline" className="bg-white/20 border-white/40 text-white hover:bg-white/30">
              <RotateCw className="w-4 h-4 mr-1" /> Rafraîchir
            </Button>
          </div>
          <p className="text-sm opacity-90 mt-1">
            Saisis le solde réellement constaté (cash physique, relevé bancaire, app mobile). L'écart est ajusté par une transaction et tracé.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-3">
            {wallets.map(w => {
              const id = pickId(w);
              const v = TYPE_VISUALS[pickType(w)] || TYPE_VISUALS.other;
              const Icon = v.icon;
              const theoretical = pickBalance(w);
              const countedRaw = counts[id];
              const counted = countedRaw === undefined || countedRaw === '' ? null : Number(countedRaw);
              const delta = counted === null ? null : +(counted - theoretical).toFixed(2);
              const saved = savedIds.has(id);
              const isSaving = savingId === id;
              return (
                <div key={id} className={`${v.bg} ${v.border} border-2 rounded-2xl p-4`}>
                  <div className="flex items-start gap-3 mb-3">
                    <Icon className={`w-6 h-6 ${v.iconColor} flex-none`} />
                    <div className="flex-1">
                      <p className="font-bold">{pickName(w)}</p>
                      <p className="text-xs text-gray-600 capitalize">{pickType(w).replace('_', ' ')}{w.BankName && ` · ${w.BankName}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-gray-500">Solde théorique</p>
                      <p className="font-bold text-lg">{fmt(theoretical)} <span className="text-xs font-normal">XOF</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5 sm:col-span-3">
                      <label className="text-[10px] uppercase text-gray-500 block">Compté (XOF)</label>
                      <input
                        type="number" min={0} step={1}
                        value={countedRaw ?? ''}
                        onChange={(e) => setCounts(c => ({ ...c, [id]: e.target.value }))}
                        className="w-full h-10 px-2 border-2 border-white rounded-lg text-sm text-right font-semibold"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <label className="text-[10px] uppercase text-gray-500 block">Écart</label>
                      <div className={`h-10 flex items-center justify-end px-2 font-bold ${
                        delta === null ? 'text-gray-300' :
                        delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-500'
                      }`}>
                        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta)} XOF`}
                      </div>
                    </div>
                    <div className="col-span-12 sm:col-span-5">
                      <label className="text-[10px] uppercase text-gray-500 block">Raison (optionnel)</label>
                      <input
                        type="text"
                        placeholder="ex: arrondis, écart caisse 30/04…"
                        value={reasons[id] ?? ''}
                        onChange={(e) => setReasons(r => ({ ...r, [id]: e.target.value }))}
                        className="w-full h-10 px-2 border-2 border-white rounded-lg text-sm"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex items-end justify-end">
                      <Button
                        onClick={() => submitAdjustment(w)}
                        disabled={isSaving || countedRaw === undefined || countedRaw === '' || delta === 0}
                        className={saved ? 'bg-green-600 hover:bg-green-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                        title={delta === 0 ? 'Pas d\'écart à appliquer' : 'Appliquer l\'ajustement'}
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Historique des ajustements */}
        <div className="bg-white rounded-2xl shadow-xl">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="w-full px-4 py-3 border-b flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-600" />
              <span className="font-bold">Historique des ajustements ({adjustments.length})</span>
            </div>
            <span className="text-xs text-gray-500">{showHistory ? 'Masquer' : 'Afficher'}</span>
          </button>
          {showHistory && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">N° transaction</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-right p-2">Montant</th>
                    <th className="text-left p-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map(t => {
                    const id = (t.Id || t.id || '') as string;
                    const num = t.TransactionNumber || t.transaction_number || '—';
                    const typ = t.Type || t.type;
                    const amount = Number(t.Amount ?? t.amount ?? 0);
                    const desc = t.Description || t.description || '';
                    const at = t.ProcessedAt || t.processed_at || '';
                    return (
                      <tr key={id} className="border-b border-gray-50">
                        <td className="p-2 text-xs text-gray-500">{at ? fmtDateTime(at) : '—'}</td>
                        <td className="p-2 text-xs font-mono">{num}</td>
                        <td className={`p-2 text-xs font-semibold ${typ === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                          {typ === 'income' ? '+ Surplus' : '− Manque'}
                        </td>
                        <td className="p-2 text-right font-bold">{fmt(amount)} XOF</td>
                        <td className="p-2 text-xs text-gray-600 truncate max-w-md" title={desc}>{desc}</td>
                      </tr>
                    );
                  })}
                  {adjustments.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-4">Aucun ajustement enregistré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
