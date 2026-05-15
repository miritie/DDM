'use client';

/**
 * Composant — État absolu des wallets
 *
 * Vue "telle quelle" de la trésorerie pour le comptable : un wallet
 * par carte, avec son solde réel. Pas de filtre période ici — la
 * période sert ailleurs (ventes, encaissements). Le solde présenté
 * est l'image actuelle du compte, point.
 *
 * Cliquer sur une carte ouvre la fiche détail du wallet.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign, CreditCard, Smartphone, Wallet as WalletIcon,
  RefreshCw, ChevronRight, AlertCircle,
} from 'lucide-react';

interface Wallet {
  Id?: string;
  id?: string;
  WalletId?: string;
  Name?: string;
  name?: string;
  Type?: string;
  type?: string;
  Balance?: number;
  balance?: number;
  Currency?: string;
  IsActive?: boolean;
  is_active?: boolean;
  BankName?: string;
}

const TYPE_VISUALS: Record<string, { icon: any; bg: string; border: string; iconColor: string }> = {
  cash:         { icon: DollarSign, bg: 'bg-green-50', border: 'border-green-200', iconColor: 'text-green-600' },
  bank:         { icon: CreditCard, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-600' },
  mobile_money: { icon: Smartphone, bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-600' },
  other:        { icon: WalletIcon, bg: 'bg-gray-50', border: 'border-gray-200', iconColor: 'text-gray-600' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n));

function pickId(w: Wallet): string { return (w.WalletId || w.Id || w.id || '') as string; }
function pickName(w: Wallet): string { return (w.Name || w.name || '—') as string; }
function pickType(w: Wallet): string { return (w.Type || w.type || 'other') as string; }
function pickBalance(w: Wallet): number { return Number(w.Balance ?? w.balance ?? 0); }
function pickActive(w: Wallet): boolean { return (w.IsActive ?? w.is_active ?? true) as boolean; }

export function WalletsOverview() {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/treasury/wallets', { cache: 'no-store' });
      const j = await r.json();
      const list = (j.data || []) as Wallet[];
      setWallets(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const active = wallets.filter(pickActive);
  const total = active.reduce((s, w) => s + pickBalance(w), 0);

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-200">
      <div className="border-b border-emerald-100 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <WalletIcon className="w-6 h-6 text-emerald-700" />
          <div>
            <h2 className="font-bold text-emerald-900">État des wallets</h2>
            <p className="text-xs text-emerald-700/80">
              Solde réel de chaque compte · total {fmt(total)} XOF
            </p>
          </div>
        </div>
        <button onClick={load} className="text-emerald-700 hover:text-emerald-900">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-sm text-gray-500 text-center py-6">Chargement…</div>
        ) : active.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" /> Aucun wallet actif.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map(w => {
              const v = TYPE_VISUALS[pickType(w)] || TYPE_VISUALS.other;
              const Icon = v.icon;
              const id = pickId(w);
              return (
                <button
                  key={id}
                  onClick={() => router.push(`/treasury/wallets/${id}`)}
                  className={`text-left ${v.bg} ${v.border} border-2 rounded-xl p-4 hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${v.iconColor}`} />
                      <div>
                        <p className="font-semibold text-sm">{pickName(w)}</p>
                        <p className="text-xs text-gray-500 capitalize">{pickType(w).replace('_', ' ')}{w.BankName && ` · ${w.BankName}`}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                  <p className={`text-2xl font-bold ${pickBalance(w) < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                    {fmt(pickBalance(w))} <span className="text-sm font-normal text-gray-500">XOF</span>
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
