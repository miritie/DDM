/**
 * Types partagés du POS (page vente rapide + composants).
 * Extraits de app/sales/quick/page.tsx lors du découpage du composant.
 */

export interface Outlet {
  id: string;
  Code: string;
  Name: string;
  City?: string;
  AllowsCredit?: boolean;
  source?: 'assignment' | 'fallback';
}

export interface Product {
  Id?: string;
  id?: string;
  ProductId: string;
  Code: string;
  Name: string;
  Category?: string;
  ImageUrl?: string;
}

export interface OutletPrice {
  Id?: string;
  ProductId: string;
  UnitPrice: number;
}

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

export interface PendingScan {
  id: string;
  ClientId?: string;
  ClientName?: string;
  ClientPhone?: string;
  ScannedAt: string;
}

export interface ManualClient {
  id: string;
  name: string;
  phone: string | null;
}

export interface StockSummaryItem {
  quantity: number;
  minimumStock: number;
  product: { id: string };
}

/** Produit vendable : produit du catalogue + prix outlet résolu. */
export type SellableProduct = Product & {
  _id: string;
  outletPrice: number;
  hasPrice: boolean;
};

export interface StockInfo {
  qty: number;
  min: number;
}
