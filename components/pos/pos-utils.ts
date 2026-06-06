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
 * Quatre états : non suivi (gris), rupture (rouge, désactivé), bas
 * (ambre), normal (vert, libellé masqué pour économiser une ligne).
 * Partagé entre la vue compacte (grille) et la vue liste.
 */
export function getStockMeta(stock: StockInfo | undefined): StockMeta {
  const qty = stock?.qty ?? null;
  const min = stock?.min ?? 0;
  let dotClass = 'bg-gray-300';
  let stockText = 'Stock non suivi';
  let stockTextClass = 'text-gray-500';
  let showStockText = true;
  if (qty !== null) {
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
  }
  return {
    qty,
    dotClass,
    stockText,
    stockTextClass,
    showStockText,
    disabled: qty !== null && qty <= 0,
    titleAttr: qty !== null ? stockText : 'Stock non suivi',
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
