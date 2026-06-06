'use client';

/**
 * Panneau panier du POS — réutilisé en panel droite (desktop) ET drawer
 * bas (mobile). Extrait de app/sales/quick/page.tsx.
 *
 * Le bandeau client est l'opportunité de capturer l'identité au moment de
 * l'encaissement : un client qui paye est déjà engagé, c'est le bon moment
 * pour lui demander son numéro ou de scanner. Si pas de client, on met
 * donc 2 gros CTA visuels en évidence.
 */

import { Users, UserPlus, QrCode, Smartphone, X, Plus, Minus, Check, Loader2 } from 'lucide-react';
import { formatPrice } from './pos-utils';
import type { CartItem } from './pos-types';

export function CartPanel({
  cart, subtotal, submitting,
  activeClientLabel, scansCount,
  onClearClient, onNewClient, onShowQr, onShowScans,
  onChangeQty, onCheckout,
}: {
  cart: CartItem[];
  subtotal: number;
  submitting: boolean;
  activeClientLabel: string | null;
  scansCount: number;
  onClearClient: () => void;
  onNewClient: () => void;
  onShowQr: () => void;
  onShowScans: () => void;
  onChangeQty: (productId: string, delta: number) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b bg-indigo-50/40">
        <p className="text-[10px] uppercase font-semibold text-indigo-700 mb-2 tracking-wide">Client</p>
        {activeClientLabel ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white border border-indigo-200">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-indigo-900 truncate">{activeClientLabel}</p>
              <p className="text-[11px] text-indigo-600">Rattaché à cette vente</p>
            </div>
            <button onClick={onClearClient} className="text-gray-400 hover:text-red-600 p-1" aria-label="Retirer client">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-2.5">
              <span className="italic text-gray-500">Vente anonyme</span> — vite, identifier le client ?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onNewClient}
                className="inline-flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 border-indigo-300 bg-white text-indigo-700 font-semibold hover:bg-indigo-50 active:scale-95 transition"
              >
                <UserPlus className="w-6 h-6" />
                <span className="text-sm">Nouveau client</span>
              </button>
              <button
                onClick={onShowQr}
                className="inline-flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 border-blue-300 bg-white text-blue-700 font-semibold hover:bg-blue-50 active:scale-95 transition"
              >
                <QrCode className="w-6 h-6" />
                <span className="text-sm">Scanner QR</span>
              </button>
            </div>
            {scansCount > 0 && (
              <button
                onClick={onShowScans}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100"
              >
                <Smartphone className="w-4 h-4" />
                {scansCount} scan{scansCount > 1 ? 's' : ''} client{scansCount > 1 ? 's' : ''} en attente — toucher pour choisir
              </button>
            )}
          </>
        )}
      </div>

      {/* Liste articles */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {cart.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-10">Touchez un produit pour l'ajouter</p>
        ) : (
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item.productId} className="flex items-center gap-2 p-2 rounded border bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{formatPrice(item.unitPrice)} × {item.quantity}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onChangeQty(item.productId, -1)} className="w-8 h-8 rounded border bg-white hover:bg-gray-100 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => onChangeQty(item.productId, 1)} className="w-8 h-8 rounded border bg-white hover:bg-gray-100 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total + bouton */}
      <div className="border-t bg-white p-3">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-2xl font-bold">{formatPrice(subtotal)}</span>
        </div>
        {/* Bouton principal d'encaissement — emerald pour la sémantique
            positive « argent qui rentre ». Cohérent avec le Confirmer du
            CheckoutModal et la palette caisse. */}
        <button
          onClick={onCheckout}
          disabled={cart.length === 0 || submitting}
          className="w-full py-4 rounded-xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 active:scale-[0.98] transition disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-5 h-5 animate-spin" />Encaissement…</>
            : <><Check className="w-5 h-5" />Encaisser</>}
        </button>
      </div>
    </div>
  );
}
