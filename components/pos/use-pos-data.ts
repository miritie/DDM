'use client';

/**
 * Hooks de données du POS — extraits de app/sales/quick/page.tsx.
 *
 * Chaque hook encapsule un flux de données indépendant (outlets, session,
 * catalogue, scans QR, transferts entrants) avec sa gestion d'erreur
 * réseau « best-effort » : sur mobile la connexion peut être coupée par
 * moments, on ne plante jamais l'UI pour un fetch raté.
 */

import { useCallback, useEffect, useState } from 'react';
import { captureGps } from './pos-utils';
import type { Outlet, Product, OutletPrice, PendingScan, StockInfo, StockSummaryItem } from './pos-types';

/** Outlets disponibles pour ce commercial (assignations du jour + fallback admin). */
export function usePosOutlets() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutletId, setActiveOutletId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/outlets/active')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(({ data }) => {
        setOutlets(data || []);
        // Si un seul outlet assigné, on l'active automatiquement
        if (data?.length === 1) setActiveOutletId(data[0].id);
      })
      // Mobile : la connexion locale peut être coupée par moments
      // (recompile dev / wifi). On évite que ça plante l'UI.
      .catch(() => { /* ignore */ });
  }, []);

  return { outlets, activeOutletId, setActiveOutletId };
}

/** Session POS : ouverte (ou réutilisée) à chaque changement d'outlet, avec GPS. */
export function usePosSession(activeOutletId: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openingSession, setOpeningSession] = useState(false);

  const openSession = useCallback(async (outletId: string) => {
    setOpeningSession(true);
    try {
      // Capture GPS (silencieux si refusé)
      const gps = await captureGps();
      const res = await fetch('/api/pos/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId,
          startMethod: 'explicit',
          gpsLat: gps?.lat, gpsLng: gps?.lng, gpsAccuracy: gps?.accuracy,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setSessionId(data.id);
      }
    } catch {
      // Réseau coupé : on n'a juste pas de session_id, mais la vente
      // s'ouvrira implicitement à l'encaissement.
    } finally {
      setOpeningSession(false);
    }
  }, []);

  useEffect(() => {
    if (!activeOutletId) return;
    void openSession(activeOutletId);
  }, [activeOutletId, openSession]);

  return { sessionId, openingSession };
}

/**
 * Catalogue : produits + prix outlet + stock outlet + popularité 30j.
 * Les 4 fetchs sont indépendants : on tolère qu'un seul échoue (réseau
 * mobile flaky, dev server qui recompile). Promise.allSettled évite
 * qu'un fail collectif ne plante l'UI avec un « Load failed ».
 */
export function usePosCatalog(activeOutletId: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<OutletPrice[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Map<string, StockInfo>>(new Map());
  const [popularityByProduct, setPopularityByProduct] = useState<Map<string, number>>(new Map());
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (!activeOutletId) return;
    setLoadingCatalog(true);
    try {
      const [pSettled, prSettled, stSettled, popSettled] = await Promise.allSettled([
        fetch('/api/products?isActive=true'),
        fetch(`/api/outlets/${activeOutletId}/applicable-prices`),
        fetch(`/api/stock/locations/outlet/${activeOutletId}/summary`),
        fetch(`/api/sales/popularity?outletId=${activeOutletId}&days=30`),
      ]);
      if (pSettled.status === 'fulfilled' && pSettled.value.ok) {
        try { setProducts((await pSettled.value.json()).data || []); } catch { /* json fail */ }
      }
      if (prSettled.status === 'fulfilled' && prSettled.value.ok) {
        try { setPrices((await prSettled.value.json()).data || []); } catch { /* json fail */ }
      }
      if (stSettled.status === 'fulfilled' && stSettled.value.ok) {
        try {
          const { data } = await stSettled.value.json();
          const m = new Map<string, StockInfo>();
          for (const it of (data?.items ?? []) as StockSummaryItem[]) {
            m.set(it.product.id, { qty: Number(it.quantity), min: Number(it.minimumStock) });
          }
          setStockByProduct(m);
        } catch { /* json fail */ }
      }
      if (popSettled.status === 'fulfilled' && popSettled.value.ok) {
        try {
          const { data } = await popSettled.value.json();
          const m = new Map<string, number>();
          for (const it of (data ?? []) as Array<{ productId: string; qtySold: number }>) {
            m.set(it.productId, Number(it.qtySold));
          }
          setPopularityByProduct(m);
        } catch { /* json fail */ }
      }
    } finally { setLoadingCatalog(false); }
  }, [activeOutletId]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  return { products, prices, stockByProduct, popularityByProduct, loadingCatalog, loadCatalog };
}

/** File de scans clients QR du stand (poll toutes les 10s). */
export function useScanQueue(activeOutletId: string | null) {
  const [scans, setScans] = useState<PendingScan[]>([]);

  const loadScans = useCallback(async () => {
    if (!activeOutletId) return;
    try {
      const r = await fetch(`/api/scan/queue/${activeOutletId}`);
      if (r.ok) setScans((await r.json()).data || []);
    } catch { /* réseau flaky, on retentera au prochain poll */ }
  }, [activeOutletId]);

  useEffect(() => {
    if (!activeOutletId) return;
    void loadScans();
    const t = setInterval(loadScans, 10000);
    return () => clearInterval(t);
  }, [activeOutletId, loadScans]);

  return { scans, loadScans };
}

/**
 * Compteur de lignes de transfert pending sur cet outlet : alimente le
 * badge du bouton « Réceptions ». Poll modéré (30s) : alerte le vendeur
 * d'une réception fraîchement émise par le manager de production sans
 * qu'il ait à changer d'outlet.
 */
export function useIncomingTransfersCount(activeOutletId: string | null) {
  const [incomingCount, setIncomingCount] = useState(0);

  const loadIncomingCount = useCallback(async () => {
    if (!activeOutletId) return;
    try {
      const r = await fetch('/api/stock/transfers/incoming');
      if (!r.ok) return;
      const { data } = await r.json();
      const n = (data || []).reduce((sum: number, t: any) =>
        sum + (t.lines || []).filter((l: any) =>
          l.leg_status === 'pending' && l.destination_outlet_id === activeOutletId
        ).length,
        0
      );
      setIncomingCount(n);
    } catch { /* ignore */ }
  }, [activeOutletId]);

  useEffect(() => {
    if (!activeOutletId) return;
    void loadIncomingCount();
    const t = setInterval(loadIncomingCount, 30000);
    return () => clearInterval(t);
  }, [activeOutletId, loadIncomingCount]);

  return { incomingCount, loadIncomingCount };
}

/** Identité visuelle du workspace (logo, slogan, contacts) — pour les reçus. */
export interface WorkspaceBranding {
  name: string;
  slogan: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  currency: string;
}

export function useWorkspaceBranding() {
  const [branding, setBranding] = useState<WorkspaceBranding | null>(null);

  useEffect(() => {
    fetch('/api/workspace/branding')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setBranding(d.data); })
      .catch(() => { /* le reçu se génère avec les valeurs par défaut */ });
  }, []);

  return branding;
}

/**
 * Vue catalogue : compact (grille avec images, ~9 par écran) ou list
 * (1 ligne par produit, ~15-20 par écran). Persisté en localStorage.
 */
export function usePosViewMode() {
  const [viewMode, setViewMode] = useState<'compact' | 'list'>('compact');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('posViewMode') : null;
    if (saved === 'list' || saved === 'compact') setViewMode(saved);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === 'compact' ? 'list' : 'compact';
      try { localStorage.setItem('posViewMode', next); } catch { /* private mode */ }
      return next;
    });
  }, []);

  return { viewMode, toggleViewMode };
}
