/**
 * Utilitaires purs du POS — extraits de app/sales/quick/page.tsx.
 */

import type { StockInfo } from './pos-types';

export function formatPrice(v: number) {
  return new Intl.NumberFormat('fr-FR').format(v) + ' XOF';
}

export interface StockMeta {
  qty: number | null;
  dotClass: string;
  stockText: string;
  stockTextClass: string;
  showStockText: boolean;
  disabled: boolean;
  titleAttr: string;
}

/**
 * Calcule la présentation visuelle du stock à partir des données brutes.
 * Règle métier : TOUT stock est suivi — une information de stock absente
 * ou non définie vaut ZÉRO (rupture, vente impossible). Trois états :
 * rupture (rouge, désactivé), bas (ambre), normal (vert, libellé masqué).
 * Partagé entre la vue compacte (grille) et la vue liste.
 */
export function getStockMeta(stock: StockInfo | undefined): StockMeta {
  const qty = stock?.qty ?? 0;
  const min = stock?.min ?? 0;
  let dotClass: string;
  let stockText: string;
  let stockTextClass: string;
  let showStockText = true;
  if (qty <= 0) {
    dotClass = 'bg-red-500';
    stockText = 'Rupture';
    stockTextClass = 'text-red-700 font-semibold';
  } else if (qty <= min) {
    dotClass = 'bg-amber-500';
    stockText = 'Bas : ' + new Intl.NumberFormat('fr-FR').format(qty);
    stockTextClass = 'text-amber-700 font-semibold';
  } else {
    dotClass = 'bg-emerald-500';
    stockText = new Intl.NumberFormat('fr-FR').format(qty) + ' en stock';
    stockTextClass = 'text-emerald-700';
    showStockText = false;
  }
  return {
    qty,
    dotClass,
    stockText,
    stockTextClass,
    showStockText,
    disabled: qty <= 0,
    titleAttr: stockText,
  };
}

/** Capture GPS silencieuse (null si refusé / non supporté / timeout). */
export async function captureGps(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
