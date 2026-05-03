'use client';

/**
 * Modal - Avant validation d'une vente sans client identifié,
 * propose d'envoyer le reçu par WhatsApp.
 */

import { useState, useEffect } from 'react';
import { X, MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsappReceiptModalProps {
  open: boolean;
  total: number;
  itemCount: number;
  onClose: () => void;
  onConfirm: (phoneOrNull: string | null) => void;
}

export function WhatsappReceiptModal({
  open,
  total,
  itemCount,
  onClose,
  onConfirm,
}: WhatsappReceiptModalProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPhone('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  function handleSendReceipt() {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) {
      setError('Numéro trop court — saisissez avec l\'indicatif pays');
      return;
    }
    onConfirm(phone.trim());
  }

  function handleSkip() {
    onConfirm(null);
  }

  function formatPrice(v: number) {
    return new Intl.NumberFormat('fr-FR').format(v) + ' XOF';
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Reçu par WhatsApp ?</h2>
              <p className="text-xs text-gray-500">
                {itemCount} article{itemCount > 1 ? 's' : ''} · {formatPrice(total)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Le client n'est pas identifié. Saisissez son numéro pour lui envoyer le reçu sur
          WhatsApp.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Téléphone du client
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendReceipt();
            }}
            placeholder="+237 6XX XX XX XX"
            className={`w-full px-3 py-2.5 border rounded-md text-base ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          <p className="text-xs text-gray-500 mt-1">
            Saisissez avec l'indicatif pays. Le client sera enregistré dans la base.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t">
          <Button
            onClick={handleSendReceipt}
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!phone.trim()}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Envoyer le reçu et encaisser
          </Button>
          <Button variant="outline" onClick={handleSkip} className="w-full">
            Continuer sans reçu
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
