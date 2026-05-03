'use client';

/**
 * Page publique - Check-in client par QR code (vue mobile).
 * Si l'appareil a déjà un cookie ddm_client_id valide, le client est reconnu
 * et confirme en un clic sans retaper ses infos.
 */

import { use, useEffect, useState } from 'react';
import { Loader2, Check, AlertCircle, UserCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
}

interface RecognizedClient {
  id: string;
  name: string;
  phone: string | null;
}

export default function CheckinPage({ params }: PageProps) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'pending' | 'completed' | 'expired' | 'unknown'>(
    'unknown'
  );
  const [recognized, setRecognized] = useState<RecognizedClient | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    void verify();
  }, [token]);

  async function verify() {
    try {
      const res = await fetch(`/api/checkin/public/${token}`);
      if (res.status === 404) {
        setStatus('unknown');
      } else {
        const data = await res.json();
        setStatus(data.status);
        if (data.recognizedClient) {
          setRecognized(data.recognizedClient);
        }
      }
    } catch {
      setStatus('unknown');
    } finally {
      setLoading(false);
    }
  }

  async function confirmRecognized() {
    setError('');
    try {
      setSubmitting(true);
      const res = await fetch(`/api/checkin/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmRecognized: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      setStatus('completed');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function notMe() {
    setRecognized(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() && !phone.trim()) {
      setError('Saisissez votre nom ou votre numéro de téléphone.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/checkin/public/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      setStatus('completed');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        {loading ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
            <p className="text-gray-600">Vérification...</p>
          </div>
        ) : status === 'unknown' || status === 'expired' ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Code QR invalide</h1>
            <p className="text-gray-600 text-sm">
              {status === 'expired'
                ? "Ce code QR a expiré. Demandez au caissier d'en générer un nouveau."
                : "Ce code QR n'est pas reconnu. Vérifiez auprès du caissier."}
            </p>
          </div>
        ) : status === 'completed' ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">C'est fait !</h1>
            <p className="text-gray-600 text-sm">
              Vos informations ont été transmises. Vous pouvez maintenant retourner à la caisse.
            </p>
          </div>
        ) : recognized && !showForm ? (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 mx-auto flex items-center justify-center mb-3">
                <UserCircle className="w-9 h-9 text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Bonjour {recognized.name} 👋</h1>
              <p className="text-sm text-gray-600 mt-1">Nous vous avons reconnu·e.</p>
              {recognized.phone && (
                <p className="text-xs text-gray-500 mt-2 font-mono">{recognized.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={confirmRecognized}
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Confirmation...' : "C'est bien moi"}
              </button>
              <button
                onClick={notMe}
                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Ce n'est pas moi
              </button>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                {error}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-100 mx-auto flex items-center justify-center mb-3">
                <span className="text-2xl">👋</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Identification rapide</h1>
              <p className="text-sm text-gray-600 mt-1">
                Saisissez votre nom et/ou votre numéro pour le caissier.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg"
                  placeholder="Votre nom (optionnel si tél.)"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg"
                  placeholder="+237 6XX XX XX XX"
                />
              </div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {submitting ? 'Envoi...' : 'Valider'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
