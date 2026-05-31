'use client';

/**
 * Modal — création rapide d'un client (nom + téléphone) pendant la vente.
 *
 * Appelle POST /api/clients/quick qui dédoublonne par téléphone : si le
 * numéro existe déjà, le client existant est renvoyé tel quel.
 */

import { useState } from 'react';
import { Loader2, X, UserPlus, Check } from 'lucide-react';

/**
 * ClientService expose les champs en lowercase (cf. SELECT_FIELDS dans
 * lib/modules/sales/client-service.ts) — exception à la convention
 * PascalCase générale du projet.
 */
interface QuickClientCreated {
  id: string;
  clientId: string;
  name: string | null;
  phone: string | null;
}

interface NewClientModalProps {
  onClose: () => void;
  onCreated: (client: { id: string; name: string; phone: string | null }) => void;
}

export function NewClientModal({ onClose, onCreated }: NewClientModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() && !phone.trim()) {
      setError('Renseigne au moins le nom ou le téléphone.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clients/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, phone: phone.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur création client');
      }
      const { data } = (await res.json()) as { data: QuickClientCreated };
      onCreated({ id: data.id, name: data.name ?? '', phone: data.phone ?? null });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold">Nouveau client</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Nom</span>
            <input
              type="text" autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submit(); }}
              placeholder="Ex : Aïssata Diallo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Téléphone</span>
            <input
              type="tel" inputMode="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submit(); }}
              placeholder="+225 07 …"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si ce numéro existe déjà, le client existant est sélectionné.
            </p>
          </label>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose} disabled={busy}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={submit} disabled={busy}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
