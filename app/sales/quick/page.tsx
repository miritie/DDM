'use client';

/**
 * Page POS - Vente rapide multi-outlets
 *
 * Flux :
 *  1. Sélection de l'outlet (parmi ceux assignés au commercial aujourd'hui)
 *  2. Capture GPS + ouverture (ou réutilisation) de la session POS
 *  3. Catalogue limité aux produits ayant un prix défini sur ce point de vente
 *  4. Panneau "Clients en attente" alimenté par les scans QR du stand
 *  5. Encaissement : crée la vente avec outlet_id + pos_session_id, consomme le scan
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Search, Package, ShoppingCart, Plus, Minus, X, Check, Loader2,
  MapPin, Users, ClipboardList, RefreshCw, Truck, QrCode, UserPlus,
  BarChart3, PackageCheck, MoreVertical, ChevronUp, Smartphone,
  List, LayoutGrid, Info, Wallet, ArrowRightLeft,
} from 'lucide-react';
import { ReceiveStockModal } from '@/components/pos/receive-stock-modal';
import { CheckoutModal, type CheckoutResult } from '@/components/pos/checkout-modal';
import { NewClientModal } from '@/components/pos/new-client-modal';
import { SessionJournalModal } from '@/components/pos/session-journal-modal';
import { IncomingTransfersModal } from '@/components/pos/incoming-transfers-modal';
import { QrCustomerModal } from '@/components/sales/qr-customer-modal';
import { ProductDetailsModal } from '@/components/pos/product-details-modal';
import { CashRegisterModal } from '@/components/pos/cash-register-modal';
import { SendStockModal } from '@/components/pos/send-stock-modal';

interface Outlet { id: string; Code: string; Name: string; City?: string; AllowsCredit?: boolean; source?: 'assignment' | 'fallback' }
interface Product { Id?: string; id?: string; ProductId: string; Code: string; Name: string; Category?: string; ImageUrl?: string }
interface OutletPrice { Id?: string; ProductId: string; UnitPrice: number }
interface CartItem { productId: string; name: string; unitPrice: number; quantity: number; imageUrl?: string }
interface PendingScan { id: string; ClientId?: string; ClientName?: string; ClientPhone?: string; ScannedAt: string }
interface ManualClient { id: string; name: string; phone: string | null }
interface StockSummaryItem { quantity: number; minimumStock: number; product: { id: string } }

export default function QuickSalePage() {
  const router = useRouter();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutletId, setActiveOutletId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openingSession, setOpeningSession] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<OutletPrice[]>([]);
  const [scans, setScans] = useState<PendingScan[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedScan, setSelectedScan] = useState<PendingScan | null>(null);
  // Client identifié hors scan QR (création directe ou QR plein écran consommé).
  // Utilisé si selectedScan est null lors du checkout.
  const [manualClient, setManualClient] = useState<ManualClient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showIncoming, setShowIncoming] = useState(false);
  // UI mobile : drawer panier + menu kebab + liste scans (séparée du panier
  // pour rester rapide d'accès sans masquer le catalogue).
  const [showCart, setShowCart] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showScansList, setShowScansList] = useState(false);

  // Fiche produit détaillée (modal plein écran), accessible par icône ℹ
  // sur la grille compact ou tap sur nom en vue liste.
  const [detailsProductId, setDetailsProductId] = useState<string | null>(null);

  // Modals stock + caisse accessibles par les icônes du bandeau header.
  const [showCashRegister, setShowCashRegister] = useState(false);
  const [showSendStock, setShowSendStock] = useState(false);

  // Recherche live de client existant dans la base.
  // L'input du bandeau client interroge /api/clients/search avec debounce.
  // Le dropdown des résultats permet de sélectionner un client, ou de
  // créer un nouveau client pré-rempli si rien ne matche.
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<Array<{ id: string; name: string | null; phone: string | null }>>([]);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  // Pré-remplissage à passer au NewClientModal si on l'ouvre depuis le dropdown.
  const [newClientInitial, setNewClientInitial] = useState<{ name?: string; phone?: string }>({});

  // Stock par produit pour cet outlet : alimente les badges produits.
  // Clés = product UUID PK (matche Product.Id ou .id côté catalogue).
  const [stockByProduct, setStockByProduct] = useState<Map<string, { qty: number; min: number }>>(new Map());

  // Quantité vendue par produit sur 30j glissants (cet outlet) : sert à
  // ranger les top vendeurs en premier dans la grille catalogue.
  const [popularityByProduct, setPopularityByProduct] = useState<Map<string, number>>(new Map());

  // Compteur de lignes de transfert pending sur cet outlet : alimente le
  // badge du bouton « Réceptions ».
  const [incomingCount, setIncomingCount] = useState(0);

  // Vue : compact (grille avec images, ~9 par écran) ou list (1 ligne par
  // produit, ~15-20 par écran). Persisté en localStorage.
  const [viewMode, setViewMode] = useState<'compact' | 'list'>('compact');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('posViewMode') : null;
    if (saved === 'list' || saved === 'compact') setViewMode(saved);
  }, []);
  function toggleViewMode() {
    const next = viewMode === 'compact' ? 'list' : 'compact';
    setViewMode(next);
    try { localStorage.setItem('posViewMode', next); } catch { /* private mode */ }
  }

  // Debounced search clients : 250 ms après dernière frappe.
  useEffect(() => {
    const q = clientSearch.trim();
    if (q.length === 0) {
      setClientSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/clients/search?q=' + encodeURIComponent(q));
        if (!r.ok) return;
        const { data } = await r.json();
        setClientSearchResults(Array.isArray(data) ? data : []);
      } catch { /* réseau flaky, on retentera à la prochaine frappe */ }
    }, 250);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // ===== Outlets disponibles pour ce commercial =====
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

  // ===== Quand l'outlet change : ouvrir/réutiliser la session POS =====
  useEffect(() => {
    if (!activeOutletId) return;
    void openSession(activeOutletId);
  }, [activeOutletId]);

  async function openSession(outletId: string) {
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
  }

  // ===== Catalogue : produits + prix outlet + stock outlet + popularité =====
  // Les 4 fetchs sont indépendants : on tolère qu'un seul échoue (réseau
  // mobile flaky, dev server qui recompile). Promise.allSettled évite
  // qu'un fail collectif ne plante l'UI avec un « Load failed ».
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
          const m = new Map<string, { qty: number; min: number }>();
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

  // ===== Transferts entrants — compteur pour le bouton « Réceptions » =====
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
    // Poll modéré : alerte le vendeur d'une réception fraîchement émise
    // par le manager de production sans qu'il ait à changer d'outlet.
    const t = setInterval(loadIncomingCount, 30000);
    return () => clearInterval(t);
  }, [activeOutletId, loadIncomingCount]);

  // ===== File de scans clients (poll toutes les 10s) =====
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

  // ===== Catalogue filtré : seuls les produits avec un prix outlet/type sont vendables =====
  // /api/outlets/[id]/applicable-prices retourne ProductId = UUID de la PK (FK).
  // /api/products retourne Id (PascalCase) = la même PK UUID.
  const sellableProducts = useMemo(() => {
    const priced = new Map(prices.map(p => [p.ProductId, p]));
    return products
      .map(p => {
        const pid = (p.Id || p.id) as string;
        const price = priced.get(pid);
        return { ...p, _id: pid, outletPrice: Number(price?.UnitPrice || 0), hasPrice: !!price };
      })
      .filter(p => p.hasPrice)
      .filter(p => !search.trim() ||
        p.Name.toLowerCase().includes(search.toLowerCase()) ||
        p.Code.toLowerCase().includes(search.toLowerCase()))
      // Tri : top vendeurs (30j) en premier, puis alpha. Les produits
      // jamais vendus sur la période tombent à la fin, ordonnés par nom.
      .sort((a, b) => {
        const sa = popularityByProduct.get(a._id) ?? 0;
        const sb = popularityByProduct.get(b._id) ?? 0;
        if (sb !== sa) return sb - sa;
        return a.Name.localeCompare(b.Name);
      });
  }, [products, prices, search, popularityByProduct]);

  // Stock cap : on ne laisse pas dépasser la quantité disponible sur l'outlet
  // pour ne pas se faire rejeter au checkout (CHECK SQL côté base + service).
  // Si on n'a pas l'info de stock (Map vide), on laisse passer — la base
  // rattrapera en dernier recours.
  function addToCart(p: typeof sellableProducts[number]) {
    const maxQty = stockByProduct.get(p._id)?.qty ?? Infinity;
    const inCartQty = cart.find(c => c.productId === p._id)?.quantity ?? 0;
    if (inCartQty + 1 > maxQty) {
      setFeedback({ type: 'error', message: `Stock épuisé pour ${p.Name} (${maxQty} disponible${maxQty > 1 ? 's' : ''})` });
      return;
    }
    setCart(prev => {
      const ex = prev.find(c => c.productId === p._id);
      if (ex) return prev.map(c => c.productId === p._id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { productId: p._id, name: p.Name, unitPrice: p.outletPrice, quantity: 1, imageUrl: p.ImageUrl }];
    });
  }

  function changeQty(id: string, delta: number) {
    if (delta > 0) {
      const maxQty = stockByProduct.get(id)?.qty ?? Infinity;
      const current = cart.find(c => c.productId === id)?.quantity ?? 0;
      if (current + delta > maxQty) {
        setFeedback({ type: 'error', message: `Stock max atteint (${maxQty})` });
        return;
      }
    }
    setCart(prev => prev.map(c => c.productId === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  }

  function checkout() {
    if (!activeOutletId || cart.length === 0) return;
    setShowCheckout(true);
  }

  async function processCheckout(payment: CheckoutResult) {
    if (!activeOutletId) return;
    setSubmitting(true); setFeedback(null);
    try {
      const res = await fetch('/api/sales/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: activeOutletId,
          items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
          // Priorité au scan QR si présent ; sinon client créé directement.
          clientId: selectedScan?.ClientId || manualClient?.id || null,
          scanId: selectedScan?.id || null,
          paymentMethod: payment.paymentMethod,
          walletId: payment.walletId,
          amountPaid: payment.amountPaid,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      const { data } = await res.json();
      const remainingMsg = data.Balance > 0
        ? ` · Reste dû : ${formatPrice(Number(data.Balance))} (à recouvrer)`
        : '';
      setFeedback({ type: 'success', message: `Vente ${data.SaleNumber} encaissée — ${formatPrice(Number(data.TotalAmount))}${remainingMsg}` });
      setCart([]); setSelectedScan(null); setManualClient(null);
      setShowCheckout(false);
      void loadScans();
      void loadCatalog(); // refresh stock badges après décrément
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
      throw e; // pour que la modale affiche aussi l'erreur
    } finally { setSubmitting(false); }
  }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ===== ÉCRAN 1 : Pas d'outlet sélectionné =====
  if (!activeOutletId) {
    return (
      <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <MapPin className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-gray-900">Choisir mon point de vente</h1>
              <p className="text-sm text-gray-500 mt-2">Pour commencer la vente, sélectionnez le stand où vous êtes.</p>
            </div>
            {outlets.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500">
                Aucun outlet n'est assigné à votre planning aujourd'hui.<br />
                Contactez votre manager.
              </div>
            ) : (
              <div className="space-y-3">
                {outlets.some(o => o.source === 'assignment') && (
                  <>
                    <div className="text-xs font-semibold text-blue-600 uppercase">Vos affectations du jour</div>
                    {outlets.filter(o => o.source !== 'fallback').map(o => (
                      <button
                        key={o.id}
                        onClick={() => setActiveOutletId(o.id)}
                        className="w-full text-left p-4 rounded-lg border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50"
                      >
                        <p className="font-semibold">{o.Name}</p>
                        {o.City && <p className="text-xs text-gray-500">{o.City}</p>}
                      </button>
                    ))}
                  </>
                )}
                {outlets.some(o => o.source === 'fallback') && (
                  <>
                    <div className="text-xs font-semibold text-gray-500 uppercase mt-4">
                      Autres outlets (privilège admin)
                    </div>
                    {outlets.filter(o => o.source === 'fallback').map(o => (
                      <button
                        key={o.id}
                        onClick={() => setActiveOutletId(o.id)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                      >
                        <p className="font-medium text-sm">{o.Name}</p>
                        {o.City && <p className="text-xs text-gray-500">{o.City}</p>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  // ===== ÉCRAN 2 : POS actif =====
  const currentOutlet = outlets.find(o => o.id === activeOutletId);

  // Client effectivement sélectionné (scan QR prioritaire, sinon création directe)
  const activeClientLabel = selectedScan
    ? (selectedScan.ClientName || selectedScan.ClientPhone || 'Client scan')
    : manualClient
      ? (manualClient.name || manualClient.phone || 'Client')
      : null;
  const clearActiveClient = () => { setSelectedScan(null); setManualClient(null); };

  // Contenu du panier — réutilisé en panel droite (desktop) ET drawer bas (mobile).
  // Le bandeau client est l'opportunité de capturer l'identité au moment de
  // l'encaissement : un client qui paye est déjà engagé, c'est le bon moment
  // pour lui demander son numéro ou de scanner. Si pas de client, on met
  // donc 2 gros CTA visuels en évidence.
  const cartContent = (
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
            <button onClick={clearActiveClient} className="text-gray-400 hover:text-red-600 p-1" aria-label="Retirer client">
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
                onClick={() => setShowNewClient(true)}
                className="inline-flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 border-indigo-300 bg-white text-indigo-700 font-semibold hover:bg-indigo-50 active:scale-95 transition"
              >
                <UserPlus className="w-6 h-6" />
                <span className="text-sm">Nouveau client</span>
              </button>
              <button
                onClick={() => setShowQr(true)}
                className="inline-flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border-2 border-blue-300 bg-white text-blue-700 font-semibold hover:bg-blue-50 active:scale-95 transition"
              >
                <QrCode className="w-6 h-6" />
                <span className="text-sm">Scanner QR</span>
              </button>
            </div>
            {scans.length > 0 && (
              <button
                onClick={() => setShowScansList(true)}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100"
              >
                <Smartphone className="w-4 h-4" />
                {scans.length} scan{scans.length > 1 ? 's' : ''} client{scans.length > 1 ? 's' : ''} en attente — toucher pour choisir
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
                  <button onClick={() => changeQty(item.productId, -1)} className="w-8 h-8 rounded border bg-white hover:bg-gray-100 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => changeQty(item.productId, 1)} className="w-8 h-8 rounded border bg-white hover:bg-gray-100 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
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
        <Button onClick={checkout} disabled={cart.length === 0 || submitting} className="w-full py-6 text-base">
          {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Encaissement…</> : <><Check className="w-5 h-5 mr-2" />Encaisser</>}
        </Button>
      </div>
    </div>
  );

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
      <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-0">
          {/* COLONNE GAUCHE : header sticky + bandeau client + recherche + grille produits */}
          <div className="min-w-0">
            {/* Header sticky — top-14 pour rester collé sous AppTopBar (h-14) */}
            <div className="sticky top-14 z-10 bg-white border-b px-3 py-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate leading-tight">{currentOutlet?.Name || '…'}</p>
                <p className="text-[10px] leading-tight">
                  {openingSession
                    ? <span className="text-gray-500"><Loader2 className="w-2.5 h-2.5 inline animate-spin mr-1" />ouverture session…</span>
                    : sessionId
                      ? <span className="text-emerald-600">● Session active</span>
                      : <span className="text-gray-400">—</span>}
                </p>
              </div>
              {/* Icône 📦 Stock — ouvre directement les réceptions à confirmer
                  (cas le plus fréquent) ; le bouton « Envoyer du stock » est
                  dans le modal lui-même. Badge violet si réceptions en attente. */}
              <button
                onClick={() => setShowIncoming(true)}
                className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                title="Stock : recevoir / envoyer"
                aria-label="Stock"
              >
                <Package className="w-5 h-5 text-purple-600" />
                {incomingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    {incomingCount}
                  </span>
                )}
              </button>

              {/* Icône 💰 Caisse — ouvre la vue caisse (solde + dépôt) */}
              <button
                onClick={() => setShowCashRegister(true)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                title="Caisse stand"
                aria-label="Caisse"
              >
                <Wallet className="w-5 h-5 text-emerald-600" />
              </button>

              {/* Bouton kebab actions secondaires */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                  aria-label="Actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
                      <MenuItem icon={<ClipboardList className="w-4 h-4 text-emerald-600" />} label="Journal de caisse"
                        onClick={() => { setShowJournal(true); setShowMenu(false); }} />
                      <MenuItem icon={<ArrowRightLeft className="w-4 h-4 text-purple-600" />} label="Envoyer du stock vers un autre stand"
                        onClick={() => { setShowSendStock(true); setShowMenu(false); }} />
                      <MenuItem icon={<Truck className="w-4 h-4 text-gray-600" />} label="Réception ad hoc"
                        onClick={() => { setShowReceive(true); setShowMenu(false); }} />
                      <MenuItem icon={<BarChart3 className="w-4 h-4 text-amber-600" />} label="Mes performances"
                        onClick={() => { router.push('/dashboard/sales'); setShowMenu(false); }} />
                      <div className="border-t my-1" />
                      <MenuItem
                        icon={viewMode === 'compact'
                          ? <List className="w-4 h-4 text-gray-600" />
                          : <LayoutGrid className="w-4 h-4 text-gray-600" />}
                        label={viewMode === 'compact' ? 'Vue liste (max produits)' : 'Vue grille (avec images)'}
                        onClick={() => { toggleViewMode(); setShowMenu(false); }} />
                      <div className="border-t my-1" />
                      <MenuItem icon={<MapPin className="w-4 h-4 text-gray-600" />} label="Changer de stand"
                        onClick={() => { setActiveOutletId(null); setShowMenu(false); }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bandeau client : input recherche live + boutons QR/Scans */}
            <div className="relative px-3 py-2 bg-white border-b">
              <div className="flex items-center gap-2">
                <Users className={'w-4 h-4 shrink-0 ' + (activeClientLabel ? 'text-indigo-600' : 'text-gray-400')} />
                {activeClientLabel ? (
                  <>
                    <p className="text-sm truncate flex-1 font-medium text-indigo-900">
                      {activeClientLabel}
                    </p>
                    <button onClick={clearActiveClient}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      aria-label="Retirer client">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="search"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setClientSearchOpen(true); }}
                      onFocus={() => setClientSearchOpen(true)}
                      onBlur={() => { setTimeout(() => setClientSearchOpen(false), 200); }}
                      placeholder="Rechercher un client (nom ou tél)…"
                      className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-gray-400"
                      aria-label="Recherche client"
                    />
                    <button onClick={() => setShowQr(true)}
                      className="px-2.5 py-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
                      title="Afficher le QR au client">
                      <QrCode className="w-4 h-4" />
                      QR
                    </button>
                    {scans.length > 0 && (
                      <button onClick={() => setShowScansList(true)}
                        className="relative px-2.5 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
                        title="Scans QR en attente">
                        <Smartphone className="w-4 h-4" />
                        <span>{scans.length}</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Dropdown résultats : visible dès qu'on a tapé qqch et que l'input a le focus */}
              {!activeClientLabel && clientSearchOpen && clientSearch.trim().length > 0 && (
                <div className="absolute left-3 right-3 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                  {clientSearchResults.length === 0 ? (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        // Heuristique : si la chaîne ne contient que chiffres / espaces / + . - → téléphone
                        const q = clientSearch.trim();
                        const isPhone = /^[\d +.\-]+$/.test(q);
                        setNewClientInitial(isPhone ? { phone: q } : { name: q });
                        setShowNewClient(true);
                        setClientSearchOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-sm text-indigo-700 font-medium inline-flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Créer « {clientSearch.trim()} » comme nouveau client
                    </button>
                  ) : (
                    <>
                      {clientSearchResults.map(c => (
                        <button
                          key={c.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setManualClient({ id: c.id, name: c.name ?? '', phone: c.phone ?? null });
                            setSelectedScan(null);
                            setClientSearch('');
                            setClientSearchResults([]);
                            setClientSearchOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">{c.name || '(sans nom)'}</p>
                          {c.phone && <p className="text-xs text-gray-500 truncate">{c.phone}</p>}
                        </button>
                      ))}
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const q = clientSearch.trim();
                          const isPhone = /^[\d +.\-]+$/.test(q);
                          setNewClientInitial(isPhone ? { phone: q } : { name: q });
                          setShowNewClient(true);
                          setClientSearchOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm text-indigo-700 font-medium inline-flex items-center gap-2 border-t border-gray-100"
                      >
                        <UserPlus className="w-4 h-4" />
                        Créer « {clientSearch.trim()} » à la place
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Feedback inline (non bloquant) */}
            {feedback && (
              <div className={`mx-3 mt-2 px-3 py-2 rounded-md border text-sm flex items-start gap-2 ${
                feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {feedback.type === 'success' && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span className="flex-1">{feedback.message}</span>
                <button onClick={() => setFeedback(null)}><X className="w-4 h-4 opacity-60" /></button>
              </div>
            )}

            {/* Recherche */}
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un produit…"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Catalogue */}
            <div className="px-3 pb-3">
              {loadingCatalog ? (
                <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></div>
              ) : sellableProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-lg border">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">Aucun produit avec un prix défini sur ce point de vente.</p>
                  <p className="text-xs text-gray-400 mt-2">L'admin doit configurer les prix dans /admin/outlets.</p>
                </div>
              ) : viewMode === 'compact' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-1.5">
                  {sellableProducts.map(p => {
                    const meta = getStockMeta(stockByProduct.get(p._id));
                    const inCart = cart.find(c => c.productId === p._id);
                    return (
                      <button
                        key={p._id}
                        onClick={() => !meta.disabled && addToCart(p)}
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
                              onClick={(e) => { e.stopPropagation(); changeQty(p._id, -1); }}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); changeQty(p._id, -1); } }}
                              title="Toucher pour retirer 1"
                              className="absolute top-1 right-1 min-w-[24px] h-6 px-1.5 rounded-full bg-blue-600 hover:bg-red-600 active:bg-red-700 text-white text-[10px] font-bold flex items-center justify-center shadow border border-white cursor-pointer transition-colors"
                            >
                              ×{inCart.quantity}
                            </span>
                          )}
                          {/* Icône ℹ — ouvre la fiche produit. Placée en
                              coin HAUT-gauche (opposé au compteur ×N en
                              haut-droit) pour ne pas chevaucher le libellé
                              du produit qui suit l'image. */}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setDetailsProductId(p._id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setDetailsProductId(p._id); } }}
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
              ) : (
                <div className="space-y-1">
                  {sellableProducts.map(p => {
                    const meta = getStockMeta(stockByProduct.get(p._id));
                    const inCart = cart.find(c => c.productId === p._id);
                    return (
                      <button
                        key={p._id}
                        onClick={() => !meta.disabled && addToCart(p)}
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
                            onClick={(e) => { e.stopPropagation(); setDetailsProductId(p._id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setDetailsProductId(p._id); } }}
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
              )}
            </div>
          </div>

          {/* PANEL DROITE — desktop only (lg+) */}
          <aside className="hidden lg:flex lg:flex-col bg-white border-l border-gray-200 lg:sticky lg:top-0 lg:h-screen">
            <div className="px-3 py-2 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" /> Panier ({itemCount})
              </h2>
            </div>
            {cartContent}
          </aside>
        </div>

        {/* BOTTOM BAR — mobile only (< lg). Tap → drawer panier */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t shadow-lg px-3 py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setShowCart(true)}
            disabled={cart.length === 0}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50 disabled:bg-gray-400"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {itemCount === 0 ? 'Panier vide' : `${itemCount} article${itemCount > 1 ? 's' : ''}`}
            </span>
            <span className="text-lg">{formatPrice(subtotal)}</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

        {/* DRAWER PANIER — mobile uniquement, ouvert au tap sur la bottom bar */}
        {showCart && (
          <div className="lg:hidden fixed inset-0 z-40 flex items-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
            <div className="relative w-full bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Panier ({itemCount})
                </h2>
                <button onClick={() => setShowCart(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">{cartContent}</div>
            </div>
          </div>
        )}

        {/* LISTE SCANS QR — modale mobile, accessible depuis le bandeau client */}
        {showScansList && (
          <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowScansList(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600" /> Scans en attente ({scans.length})
                </h2>
                <div className="flex items-center gap-1">
                  <button onClick={loadScans} className="p-1.5 rounded hover:bg-gray-100" aria-label="Rafraîchir">
                    <RefreshCw className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={() => setShowScansList(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Fermer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="overflow-auto p-3 space-y-1">
                {scans.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">Aucun scan client en attente.</p>
                ) : (
                  scans.map(s => (
                    <button key={s.id} onClick={() => {
                      setSelectedScan(s);
                      setManualClient(null);
                      setShowScansList(false);
                    }}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50">
                      <p className="font-medium text-sm">{s.ClientName || s.ClientPhone || '(sans nom)'}</p>
                      {s.ClientName && s.ClientPhone && <p className="text-xs text-gray-500">{s.ClientPhone}</p>}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showReceive && (
          <ReceiveStockModal
            outletId={activeOutletId}
            onClose={() => setShowReceive(false)}
            onDone={() => {
              setShowReceive(false);
              setFeedback({ type: 'success', message: 'Réception enregistrée — stock mis à jour' });
              void loadCatalog();
            }}
          />
        )}

        {showCheckout && (
          <CheckoutModal
            total={subtotal}
            outletId={activeOutletId}
            allowsCredit={Boolean(currentOutlet?.AllowsCredit)}
            onClose={() => setShowCheckout(false)}
            onConfirm={processCheckout}
          />
        )}

        {showNewClient && (
          <NewClientModal
            initialName={newClientInitial.name}
            initialPhone={newClientInitial.phone}
            onClose={() => { setShowNewClient(false); setNewClientInitial({}); }}
            onCreated={(c) => {
              setManualClient(c);
              setSelectedScan(null);
              setShowNewClient(false);
              setClientSearch('');
              setNewClientInitial({});
              setFeedback({ type: 'success', message: `${c.name || c.phone} rattaché à la prochaine vente` });
            }}
          />
        )}

        {showJournal && (
          <SessionJournalModal
            outletId={activeOutletId}
            outletName={currentOutlet?.Name}
            onClose={() => setShowJournal(false)}
          />
        )}

        {showIncoming && (
          <IncomingTransfersModal
            outletId={activeOutletId}
            onClose={() => setShowIncoming(false)}
            onConfirmed={() => {
              void loadCatalog();
              void loadIncomingCount();
            }}
          />
        )}

        <QrCustomerModal
          open={showQr}
          fullscreen
          onClose={() => setShowQr(false)}
          onIdentified={(info) => {
            if (info.clientId) {
              setManualClient({ id: info.clientId, name: info.name || '', phone: info.phone || null });
              setSelectedScan(null);
              setFeedback({ type: 'success', message: `${info.name || info.phone || 'Client'} identifié via QR — rattaché à la prochaine vente` });
            }
            setShowQr(false);
          }}
        />

        {showCashRegister && (
          <CashRegisterModal
            outletId={activeOutletId}
            outletName={currentOutlet?.Name || ''}
            onClose={() => setShowCashRegister(false)}
          />
        )}

        {showSendStock && currentOutlet && (
          <SendStockModal
            outletId={activeOutletId}
            outletName={currentOutlet.Name || ''}
            outletCode={currentOutlet.Code}
            onClose={() => setShowSendStock(false)}
            onSent={() => {
              setShowSendStock(false);
              setFeedback({ type: 'success', message: 'Transfert envoyé. Le stand destination doit confirmer la réception.' });
              void loadCatalog();
            }}
          />
        )}

        {detailsProductId && (() => {
          const p = sellableProducts.find(x => x._id === detailsProductId);
          if (!p) {
            setDetailsProductId(null);
            return null;
          }
          const inCart = cart.find(c => c.productId === p._id);
          const stock = stockByProduct.get(p._id);
          return (
            <ProductDetailsModal
              productId={p._id}
              outletPrice={p.outletPrice}
              stockQty={stock?.qty ?? null}
              stockMin={stock?.min ?? 0}
              cartQty={inCart?.quantity ?? 0}
              onClose={() => setDetailsProductId(null)}
              onAddToCart={() => addToCart(p)}
              onDecrement={() => changeQty(p._id, -1)}
            />
          );
        })()}
      </div>
    </ProtectedPage>
  );
}

function formatPrice(v: number) {
  return new Intl.NumberFormat('fr-FR').format(v) + ' XOF';
}

/**
 * Calcule la présentation visuelle du stock à partir des données brutes.
 * Quatre états : non suivi (gris), rupture (rouge, désactivé), bas
 * (ambre), normal (vert, libellé masqué pour économiser une ligne).
 * Partagé entre la vue compacte (grille) et la vue liste.
 */
function getStockMeta(stock: { qty: number; min: number } | undefined): {
  qty: number | null;
  dotClass: string;
  stockText: string;
  stockTextClass: string;
  showStockText: boolean;
  disabled: boolean;
  titleAttr: string;
} {
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

/** Ligne du menu kebab — icône colorée + libellé + badge optionnel. */
function MenuItem({
  icon, label, badge, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-100 text-left text-sm"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

async function captureGps(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
