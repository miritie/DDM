'use client';

/**
 * Modal - Affiche un QR code pour identifier le client. Poll la session.
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, X, Check } from 'lucide-react';
import QRCode from 'qrcode';

interface QrCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onIdentified: (info: { clientId: string | null; name: string | null; phone: string | null }) => void;
  /**
   * Si true, le QR occupe tout l'écran en très grand (mode "à présenter au client").
   * Sinon : modal centrée 256px (mode discret).
   */
  fullscreen?: boolean;
}

interface SessionData {
  token: string;
  path: string;
  expiresAt: string;
}

export function QrCustomerModal({ open, onClose, onIdentified, fullscreen = false }: QrCustomerModalProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setSession(null);
      setQrDataUrl('');
      setError('');
      return;
    }
    void start();
    return () => stopPolling();
  }, [open]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function start() {
    try {
      setError('');
      setWaiting(true);
      const res = await fetch('/api/checkin/sessions', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Impossible de générer le QR');
      }
      const { data } = await res.json();
      setSession(data);

      const fullUrl = `${window.location.origin}${data.path}`;
      const dataUrl = await QRCode.toDataURL(fullUrl, {
        width: fullscreen ? 768 : 256,
        margin: 1,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);

      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/checkin/sessions/${data.token}`);
          if (!r.ok) return;
          const payload = await r.json();
          const s = payload.data;
          if (s.status === 'completed') {
            stopPolling();
            onIdentified({
              clientId: s.clientId,
              name: s.clientName,
              phone: s.clientPhone,
            });
            onClose();
          } else if (s.status === 'expired') {
            stopPolling();
            setError('Le QR code a expiré. Fermez et regénérez-en un nouveau.');
          }
        } catch (e) {
          /* ignore poll errors */
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWaiting(false);
    }
  }

  if (!open) return null;

  // Mode plein écran : QR énorme, peu de chrome — destiné à être présenté
  // au client en levant la tablette/le téléphone.
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-2xl font-bold">Scannez pour vous identifier</h2>
            <p className="text-sm text-gray-600">Pointez l'appareil photo de votre téléphone sur le QR.</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" /> Fermer
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {waiting && !qrDataUrl ? (
            <Loader2 className="w-16 h-16 animate-spin text-blue-600" />
          ) : qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR de check-in" className="w-[min(70vh,70vw)] h-[min(70vh,70vw)]" />
              <div className="mt-6 flex items-center gap-2 text-base text-blue-700 bg-blue-50 px-4 py-2.5 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin" />
                En attente de la réponse du client…
              </div>
            </>
          ) : null}

          {error && (
            <div className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center max-w-md">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mode modal (discret)
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Identification par QR</h2>
            <p className="text-sm text-gray-600">
              Faites scanner ce QR au client avec son téléphone.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center py-4">
          {waiting && !qrDataUrl ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
          ) : qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR de check-in" className="w-64 h-64" />
              <p className="text-xs text-gray-500 mt-3 break-all text-center">
                {session?.path}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                En attente de la réponse du client...
              </div>
            </>
          ) : null}

          {error && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
