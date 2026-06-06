'use client';

/**
 * Modal — Reçu de vente affiché juste après un encaissement réussi.
 *
 * Plein écran sur mobile, modal centré sur desktop. Objectif :
 *   - confirmer visuellement que la vente est bien enregistrée
 *   - récapituler ce qui vient d'être vendu (le vendeur peut vérifier
 *     avec le client avant de le voir partir)
 *   - permettre de partager le reçu (WhatsApp, SMS) via Web Share API
 *   - inciter à enchaîner sur la prochaine vente avec un bouton focus
 */

import { useEffect, useState } from 'react';
import { Check, X, Share2, Plus, Receipt, Wallet, Clock, AlertTriangle, FileDown, Loader2 } from 'lucide-react';
import {
  generateSaleReceiptPdf,
  shareSaleReceiptPdf,
  downloadSaleReceiptPdf,
  loadReceiptLogo,
  type SaleReceiptPdfData,
  type ReceiptLogo,
} from '@/lib/pdf/sale-receipt-pdf';

export interface SaleReceiptData {
  saleNumber: string;
  date: string;                  // ISO ou string lisible
  outletName: string;
  sellerName: string;
  clientLabel: string | null;    // null = vente anonyme
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentMethodLabel: string;    // « Espèces », « Carte / TPE », « Mobile Money », « Crédit »
  // Identité visuelle (depuis /api/workspace/branding) — optionnelle,
  // le PDF retombe sur « DUNE DE MIEL » sans elle.
  companyName?: string;
  companyTagline?: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  logoUrl?: string | null;
}

interface SaleReceiptModalProps {
  data: SaleReceiptData;
  onClose: () => void;
  onNewSale: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XOF';

export function SaleReceiptModal({ data, onClose, onNewSale }: SaleReceiptModalProps) {
  const [pdfBusy, setPdfBusy] = useState<'share' | 'download' | null>(null);
  const [pdfMessage, setPdfMessage] = useState<string | null>(null);
  const [logo, setLogo] = useState<ReceiptLogo | null>(null);

  // Pré-charge le logo dès l'ouverture pour qu'il soit prêt au moment où
  // le vendeur tape « Partager » (échec silencieux = PDF sans logo).
  useEffect(() => {
    let cancelled = false;
    void loadReceiptLogo(data.logoUrl).then(l => { if (!cancelled && l) setLogo(l); });
    return () => { cancelled = true; };
  }, [data.logoUrl]);

  useEffect(() => {
    // Vibration tactile mobile pour confirmer le succès (silencieux si
    // non supporté ou non activé par l'utilisateur).
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      (navigator as any).vibrate(80);
    }
  }, []);

  const hasCredit = data.balance > 0;

  const pdfData: SaleReceiptPdfData = {
    saleNumber: data.saleNumber,
    date: data.date,
    outletName: data.outletName,
    sellerName: data.sellerName,
    companyName: data.companyName,
    companyTagline: data.companyTagline,
    companyAddress: data.companyAddress,
    companyPhone: data.companyPhone,
    logo,
    clientLabel: data.clientLabel,
    items: data.items,
    totalAmount: data.totalAmount,
    amountPaid: data.amountPaid,
    balance: data.balance,
    paymentMethodLabel: data.paymentMethodLabel,
  };

  async function handleShare() {
    setPdfBusy('share');
    setPdfMessage(null);
    try {
      const blob = generateSaleReceiptPdf(pdfData);
      const res = await shareSaleReceiptPdf(pdfData, blob);
      if (res.shared) {
        setPdfMessage('Reçu partagé ✓');
      } else if (res.downloaded) {
        setPdfMessage('PDF téléchargé — joins-le à ton message WhatsApp.');
      }
    } catch (e: any) {
      setPdfMessage('Erreur : ' + e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  function handleDownload() {
    setPdfBusy('download');
    setPdfMessage(null);
    try {
      downloadSaleReceiptPdf(pdfData);
      setPdfMessage('PDF téléchargé ✓');
    } catch (e: any) {
      setPdfMessage('Erreur : ' + e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Bandeau succès animé */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white px-6 pt-8 pb-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-3 animate-[pulse_1s_ease-in-out_1]">
          <Check className="w-12 h-12" strokeWidth={3} />
        </div>
        <h1 className="text-2xl font-bold">Vente encaissée</h1>
        <p className="text-emerald-50 text-sm mt-1">N° {data.saleNumber}</p>
      </div>

      {/* Corps : reçu lisible */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Méta */}
        <div className="text-center text-xs text-gray-500">
          <p>{data.outletName} — {new Date(data.date).toLocaleString('fr-FR')}</p>
          <p>Vendeur : {data.sellerName}</p>
          {data.clientLabel && <p className="mt-1 text-indigo-700 font-medium">Client : {data.clientLabel}</p>}
        </div>

        {/* Articles */}
        <div className="bg-gray-50 rounded-xl p-3 border">
          <h2 className="text-xs uppercase font-semibold text-gray-500 tracking-wide mb-2 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Articles ({data.items.length})
          </h2>
          <div className="space-y-1.5">
            {data.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{it.name}</p>
                  <p className="text-xs text-gray-500">{fmt(it.unitPrice)} × {it.quantity}</p>
                </div>
                <p className="font-semibold shrink-0">{fmt(it.quantity * it.unitPrice)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totaux */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-xl font-bold">{fmt(data.totalAmount)}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-sm text-emerald-800 inline-flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              Encaissé · <strong>{data.paymentMethodLabel}</strong>
            </span>
            <span className="text-base font-bold text-emerald-800">{fmt(data.amountPaid)}</span>
          </div>
          {hasCredit && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-sm text-amber-800 inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Reste à recouvrer
              </span>
              <span className="text-base font-bold text-amber-800">{fmt(data.balance)}</span>
            </div>
          )}
        </div>

        {hasCredit && !data.clientLabel && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Vente à crédit sans client identifié — pense à enregistrer le client pour le recouvrement.</span>
          </div>
        )}
      </div>

      {/* Actions bas */}
      <div className="border-t bg-white p-3 space-y-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {pdfMessage && (
          <div className="text-xs text-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
            {pdfMessage}
          </div>
        )}
        <button
          onClick={onNewSale}
          className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle vente
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleShare}
            disabled={!!pdfBusy}
            className="py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            title="Partager le reçu PDF (WhatsApp, SMS…)"
          >
            {pdfBusy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span>Partager</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={!!pdfBusy}
            className="py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            title="Télécharger le PDF"
          >
            {pdfBusy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            <span>PDF</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Fermer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
