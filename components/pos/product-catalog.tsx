'use client';

/**
 * Catalogue produits du POS — vues compacte (grille avec images) et liste.
 * Composant de présentation pur, extrait de app/sales/quick/page.tsx.
 */

import { Loader2, Package, Plus, Info } from 'lucide-react';
import { formatPrice, getStockMeta } from './pos-utils';
import type { SellableProduct, CartItem, StockInfo } from './pos-types';

export function ProductCatalog({
  products, stockByProduct, cart, viewMode, loading,
  onAdd, onDecrement, onShowDetails,
}: {
  products: SellableProduct[];
  stockByProduct: Map<string, StockInfo>;
  cart: CartItem[];
  viewMode: 'compact' | 'list';
  loading: boolean;
  onAdd: (p: SellableProduct) => void;
  onDecrement: (productId: string) => void;
  onShowDetails: (productId: string) => void;
}) {
  if (loading) {
    return <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></div>;
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border">
        <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
        <p className="text-gray-500">Aucun produit avec un prix défini sur ce point de vente.</p>
        <p className="text-xs text-gray-400 mt-2">L'admin doit configurer les prix dans /admin/outlets.</p>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-1.5">
        {products.map(p => {
          const meta = getStockMeta(stockByProduct.get(p._id));
          const inCart = cart.find(c => c.productId === p._id);
          return (
            <button
              key={p._id}
              onClick={() => !meta.disabled && onAdd(p)}
              disabled={meta.disabled}
              title={meta.titleAttr}
              className={
                'text-left bg-white border rounded-lg overflow-hidden transition ' +
                (meta.disabled
                  ? 'opacity-60 cursor-not-allowed border-gray-200'
                  : 'border-gray-200 active:scale-95 hover:border-blue-500 hover:shadow-md')
              }
            >
              <div className="aspect-square bg-gray-50 relative">
                {p.ImageUrl
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-300" /></div>}
                {inCart && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onDecrement(p._id); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onDecrement(p._id); } }}
                    title="Toucher pour retirer 1"
                    className="absolute top-1 right-1 min-w-[24px] h-6 px-1.5 rounded-full bg-blue-600 hover:bg-red-600 active:bg-red-700 text-white text-[10px] font-bold flex items-center justify-center shadow border border-white cursor-pointer transition-colors"
                  >
                    ×{inCart.quantity}
                  </span>
                )}
                {/* Icône ℹ — ouvre la fiche produit. Placée en coin
                    HAUT-gauche (opposé au compteur ×N en haut-droit) pour
                    ne pas chevaucher le libellé du produit qui suit l'image. */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onShowDetails(p._id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onShowDetails(p._id); } }}
                  title="Voir la fiche produit"
                  aria-label="Voir la fiche"
                  className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white text-gray-600 hover:text-blue-600 flex items-center justify-center shadow border border-gray-200 cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="px-1.5 py-1">
                <p className="text-[11px] font-semibold line-clamp-1 leading-tight">{p.Name}</p>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-xs font-bold text-blue-600 leading-none">{formatPrice(p.outletPrice)}</span>
                  <span className={'w-2 h-2 rounded-full shrink-0 ' + meta.dotClass} />
                </div>
                {meta.showStockText && (
                  <p className={'text-[9px] leading-tight truncate mt-0.5 ' + meta.stockTextClass}>
                    {meta.stockText}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {products.map(p => {
        const meta = getStockMeta(stockByProduct.get(p._id));
        const inCart = cart.find(c => c.productId === p._id);
        return (
          <button
            key={p._id}
            onClick={() => !meta.disabled && onAdd(p)}
            disabled={meta.disabled}
            title={meta.titleAttr}
            className={
              'w-full flex items-center gap-2 p-1.5 bg-white border rounded-lg transition ' +
              (meta.disabled
                ? 'opacity-60 cursor-not-allowed border-gray-200'
                : 'border-gray-200 active:bg-gray-50 hover:border-blue-500')
            }
          >
            <div className="relative w-10 h-10 shrink-0 rounded bg-gray-50 overflow-hidden flex items-center justify-center">
              {p.ImageUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                : <Package className="w-4 h-4 text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onShowDetails(p._id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onShowDetails(p._id); } }}
                title="Voir la fiche produit"
                className="inline-flex items-center gap-1 text-xs font-semibold leading-tight text-blue-700 hover:underline cursor-pointer"
              >
                <span className="line-clamp-1">{p.Name}</span>
                <Info className="w-3 h-3 shrink-0 opacity-60" />
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={'w-1.5 h-1.5 rounded-full shrink-0 ' + meta.dotClass} />
                <span className={'text-[10px] leading-tight truncate ' + meta.stockTextClass}>
                  {meta.stockText}
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-blue-600 shrink-0">{formatPrice(p.outletPrice)}</span>
            {inCart ? (
              <span className="min-w-[24px] h-6 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                ×{inCart.quantity}
              </span>
            ) : (
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
