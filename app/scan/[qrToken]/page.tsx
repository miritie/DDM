'use client';

/**
 * Page publique mobile-first : un client scanne le QR du stand.
 * Lui demande nom + téléphone (l'un ou l'autre suffit) puis push dans la file
 * d'attribution de l'outlet. Le commercial verra son scan côté POS.
 */

import { useEffect, useState, use } from 'react';
import { CheckCircle2, Loader2, MapPin, AlertCircle } from 'lucide-react';

interface OutletInfo {
  id: string;
  Name: string;
  Code: string;
  City?: string;
}

export default function ScanPage({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = use(params);

  const [outlet, setOutlet] = useState<OutletInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/scan/outlet/${qrToken}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'QR invalide');
        const { data } = await r.json();
        if (!cancelled) setOutlet(data);
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [qrToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !phone.trim()) {
      setSubmitError('Renseignez au moins un nom ou un téléphone');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/scan/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrToken,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur lors de l\'envoi');
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError || !outlet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-md p-6 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">QR invalide</h1>
          <p className="text-sm text-gray-600">{loadError || 'Le code scanné ne correspond à aucun point de vente actif.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-50 p-6">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">C'est noté !</h1>
          <p className="text-sm text-gray-600 mb-1">
            Votre identification a été transmise au stand
          </p>
          <p className="font-semibold text-gray-900">{outlet.Name}</p>
          <p className="text-xs text-gray-500 mt-4">
            Présentez-vous au comptoir, le commercial finalise votre vente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="bg-white rounded-2xl shadow-md p-6 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-full bg-blue-100 items-center justify-center mb-3">
            <MapPin className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{outlet.Name}</h1>
          {outlet.City && <p className="text-sm text-gray-500">{outlet.City}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Identifiez-vous pour que le vendeur retrouve votre achat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Votre nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Téléphone</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="6XX XX XX XX"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {submitError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Valider mon identification'}
          </button>

          <p className="text-xs text-gray-400 text-center pt-2">
            Vos infos ne sont visibles que par le vendeur du stand.
          </p>
        </form>
      </div>
    </div>
  );
}
