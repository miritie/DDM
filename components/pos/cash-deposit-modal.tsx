'use client';

/**
 * Modal — Versement de caisse depuis le POS.
 *
 * Le vendeur indique :
 *   - destination (banque / espèces remises / mobile money)
 *   - bénéficiaire (wallet pour bank/MM, texte libre pour person)
 *   - montant
 *   - référence (facultatif sauf bank/MM où c'est conseillé)
 *   - preuve image (facultatif, upload Cloudinary)
 *
 * À la confirmation, POST /api/cash-deposits débite la caisse stand
 * immédiatement (transaction côté serveur).
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Banknote, Smartphone, User as UserIcon, Camera, Check, Building2 } from 'lucide-react';

interface WalletOption {
  id: string;
  name: string;
  type: string;
}

interface CashDepositModalProps {
  outletId: string;
  outletName: string;
  cashWalletId: string;
  cashWalletName: string;
  cashWalletBalance: number;
  onClose: () => void;
  onCreated: () => void;
}

type DestType = 'bank' | 'person' | 'mobile_money';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XOF';

export function CashDepositModal({
  outletId, outletName, cashWalletId, cashWalletName, cashWalletBalance,
  onClose, onCreated,
}: CashDepositModalProps) {
  const [destType, setDestType] = useState<DestType>('bank');
  const [destWalletId, setDestWalletId] = useState('');
  const [destLabel, setDestLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/treasury/wallets?isActive=true')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setWallets((d.data || []).map((w: any) => ({
        id: w.Id ?? w.id,
        name: w.Name ?? w.name,
        type: w.Type ?? w.type,
      }))))
      .catch(() => {});
  }, []);

  // Quand on change de destType, on remet à zéro la sélection wallet/label
  // pour éviter un wallet d'un type pas adapté qui resterait sélectionné.
  useEffect(() => {
    setDestWalletId('');
    setDestLabel('');
  }, [destType]);

  const filteredWallets = wallets.filter(w =>
    destType === 'bank' ? w.type === 'bank'
    : destType === 'mobile_money' ? w.type === 'mobile_money'
    : false
  );

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/upload/cash-deposit-evidence', { method: 'POST', body: fd });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur upload');
      }
      const { url } = await r.json();
      setEvidenceUrl(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Saisissez un montant valide.');
      return;
    }
    if (amt > cashWalletBalance) {
      setError(`Solde caisse insuffisant : ${fmt(cashWalletBalance)} disponible.`);
      return;
    }
    if (destType === 'person' && !destLabel.trim()) {
      setError('Indiquez le nom du responsable destinataire.');
      return;
    }
    if ((destType === 'bank' || destType === 'mobile_money') && !destWalletId) {
      setError(destType === 'bank'
        ? 'Choisissez un compte bancaire destinataire.'
        : 'Choisissez un compte mobile money destinataire.');
      return;
    }

    setBusy(true);
    try {
      const r = await fetch('/api/cash-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId,
          walletSourceId: cashWalletId,
          destinationType: destType,
          destinationWalletId: destWalletId || undefined,
          destinationLabel: destType === 'person' ? destLabel.trim() : undefined,
          amount: amt,
          reference: reference.trim() || undefined,
          evidenceUrl: evidenceUrl ?? undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur création dépôt');
      }
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const destButtons: Array<{ id: DestType; label: string; icon: any }> = [
    { id: 'bank',         label: 'Banque',        icon: Building2 },
    { id: 'mobile_money', label: 'Mobile Money',  icon: Smartphone },
    { id: 'person',       label: 'Remise espèces', icon: UserIcon },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold">Versement de caisse</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase font-semibold text-emerald-700 tracking-wide">Solde caisse</p>
              <p className="text-sm font-medium text-emerald-900 truncate">{cashWalletName}</p>
            </div>
            <p className="text-xl font-bold text-emerald-800 shrink-0">{fmt(cashWalletBalance)}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Destination</label>
            <div className="grid grid-cols-3 gap-2">
              {destButtons.map(b => {
                const Icon = b.icon;
                const active = destType === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setDestType(b.id)}
                    className={
                      'flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border-2 transition ' +
                      (active ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-400')
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold leading-tight">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(destType === 'bank' || destType === 'mobile_money') && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                {destType === 'bank' ? 'Compte bancaire' : 'Compte mobile money'}
              </label>
              {filteredWallets.length === 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Aucun wallet {destType === 'bank' ? 'bancaire' : 'mobile money'} actif. Demandez au comptable d'en créer un dans <strong>/treasury/wallets/new</strong>.
                </p>
              ) : (
                <select
                  value={destWalletId}
                  onChange={(e) => setDestWalletId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">— Choisir —</option>
                  {filteredWallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {destType === 'person' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Bénéficiaire
              </label>
              <input
                type="text"
                value={destLabel}
                onChange={(e) => setDestLabel(e.target.value)}
                placeholder="Ex : M. Konaté, superviseur"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Montant (XOF)</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              max={cashWalletBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-right text-xl font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Référence {(destType === 'bank' || destType === 'mobile_money') && <span className="text-gray-400 normal-case font-normal">(transaction)</span>}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={destType === 'bank' ? 'N° bordereau' : destType === 'mobile_money' ? 'ID transaction' : 'Reçu n°'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Preuve image (optionnel)</label>
            {evidenceUrl ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={evidenceUrl} alt="Preuve" className="w-20 h-20 object-cover rounded border" />
                <button
                  onClick={() => setEvidenceUrl(null)}
                  className="text-xs text-red-600 underline"
                >
                  Retirer
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {uploading ? 'Upload…' : 'Photo / capture'}
              </button>
            )}
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="border-t p-3 flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={busy || uploading}
            className="flex-1 py-2.5 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Enregistrer le dépôt
          </button>
        </div>
      </div>
    </div>
  );
}
