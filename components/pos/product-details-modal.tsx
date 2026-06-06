'use client';

/**
 * Modal — Fiche détaillée d'un produit (plein écran POS).
 *
 * Sert d'aide-mémoire au vendeur : caractéristiques, bienfaits,
 * indications, composition, images additionnelles. Bouton d'ajout
 * au panier en bottom bar sticky pour rester dans le flux de vente
 * sans devoir fermer la fiche.
 *
 * Sections (description, benefits, usage_notes, composition) masquées
 * si vides — pas de placeholder « — » qui pollue.
 */

import { useEffect, useState } from 'react';
import { Loader2, X, Plus, ChevronLeft, ChevronRight, Package } from 'lucide-react';

interface ProductDetailsModalProps {
  productId: string;
  outletPrice: number;
  stockQty: number | null;
  stockMin: number;
  cartQty: number;
  onClose: () => void;
  onAddToCart: () => void;
  onDecrement?: () => void;
}

interface DetailsResponse {
  id: string;
  Name: string;
  Code: string;
  Category?: string | null;
  Unit?: string | null;
  ImageUrl?: string | null;
  Description?: string | null;
  Benefits?: string | null;
  UsageNotes?: string | null;
  Composition?: string | null;
  AdditionalImages: Array<{ id: string; url: string; position: number }>;
}

const fmtPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF';

export function ProductDetailsModal({
  productId, outletPrice, stockQty, stockMin, cartQty, onClose, onAddToCart, onDecrement,
}: ProductDetailsModalProps) {
  const [details, setDetails] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/products/' + encodeURIComponent(productId))
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Erreur chargement fiche')))
      .then(({ data }) => { if (!cancelled) setDetails(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);

  // Liste complète des images : principale + additionnelles.
  const allImages: string[] = details
    ? [details.ImageUrl, ...details.AdditionalImages.map(i => i.url)].filter((u): u is string => !!u)
    : [];

  // Stock visual. Règle métier : tout stock est suivi — une info absente
  // (null) vaut ZÉRO → rupture, vente impossible.
  const effectiveQty = stockQty ?? 0;
  let stockBadge: string;
  let stockLabel: string;
  let disabled = false;
  if (effectiveQty <= 0) {
    stockBadge = 'bg-red-100 text-red-700';
    stockLabel = 'Rupture';
    disabled = true;
  } else if (effectiveQty <= stockMin) {
    stockBadge = 'bg-amber-100 text-amber-800';
    stockLabel = 'Stock bas : ' + new Intl.NumberFormat('fr-FR').format(effectiveQty);
  } else {
    stockBadge = 'bg-emerald-100 text-emerald-800';
    stockLabel = new Intl.NumberFormat('fr-FR').format(effectiveQty) + ' en stock';
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold text-gray-500">Fiche produit</h2>
        <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto pb-24">
        {loading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></div>
        ) : error ? (
          <div className="mx-4 my-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : details ? (
          <>
            {/* Carrousel images */}
            <div className="relative bg-gray-50">
              {allImages.length > 0 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={allImages[imgIdx]}
                    alt={details.Name + ' (image ' + (imgIdx + 1) + ')'}
                    className="w-full max-h-[60vh] object-contain bg-white"
                  />
                  {allImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setImgIdx(i => (i - 1 + allImages.length) % allImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                        aria-label="Image précédente"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setImgIdx(i => (i + 1) % allImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                        aria-label="Image suivante"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5">
                        {allImages.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setImgIdx(i)}
                            className={'w-2 h-2 rounded-full ' + (i === imgIdx ? 'bg-blue-600' : 'bg-white/70 border border-gray-400')}
                            aria-label={'Image ' + (i + 1)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="aspect-square flex items-center justify-center">
                  <Package className="w-20 h-20 text-gray-300" />
                </div>
              )}
            </div>

            {/* Header : nom + catégorie + prix + stock */}
            <div className="px-4 pt-4 pb-3 border-b">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{details.Name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {details.Code}
                {details.Category && ' · ' + details.Category}
                {details.Unit && ' · ' + details.Unit}
              </p>
              <div className="flex items-baseline justify-between gap-3 mt-3">
                <span className="text-3xl font-bold text-blue-600">{fmtPrice(outletPrice)}</span>
                <span className={'text-xs font-semibold px-2 py-1 rounded-full ' + stockBadge}>
                  {stockLabel}
                </span>
              </div>
            </div>

            {/* Sections — masquées si vides */}
            <Section title="Description" content={details.Description} />
            <Section title="Bienfaits" content={details.Benefits} />
            <Section title="Indications" content={details.UsageNotes} />
            <Section title="Composition" content={details.Composition} />

            {/* Cas où aucune info éditoriale */}
            {!details.Description && !details.Benefits && !details.UsageNotes && !details.Composition && (
              <div className="mx-4 my-6 text-sm text-gray-500 italic text-center py-6 border border-dashed border-gray-300 rounded-lg">
                Aucune description renseignée pour ce produit.<br />
                L'admin peut compléter la fiche depuis Produits &gt; Édition.
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Bottom bar sticky : ajout/décrément panier */}
      <div className="border-t bg-white px-3 py-3 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {cartQty > 0 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onDecrement}
              className="px-3 py-3 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1.5 font-semibold"
              aria-label="Retirer un"
            >
              <X className="w-5 h-5" />
              <span>Retirer</span>
            </button>
            <button
              onClick={onAddToCart}
              disabled={disabled}
              className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-semibold text-base disabled:opacity-50 disabled:bg-gray-400 inline-flex items-center justify-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Encore un ({cartQty} dans le panier)
            </button>
          </div>
        ) : (
          <button
            onClick={onAddToCart}
            disabled={disabled}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-base disabled:opacity-50 disabled:bg-gray-400 inline-flex items-center justify-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Ajouter au panier
          </button>
        )}
      </div>
    </div>
  );
}

/** Section pliable. Pour rester simple, on rend toujours ouverte ;
 *  un toggle pourra être ajouté si besoin. */
function Section({ title, content }: { title: string; content?: string | null }) {
  if (!content || !content.trim()) return null;
  return (
    <div className="px-4 py-3 border-b">
      <h3 className="text-[11px] uppercase font-bold text-gray-500 tracking-wide mb-1.5">{title}</h3>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{content}</p>
    </div>
  );
}
