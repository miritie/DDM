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
} from 'lucide-react';
import { ReceiveStockModal } from '@/components/pos/receive-stock-modal';
import { CheckoutModal, type CheckoutResult } from '@/components/pos/checkout-modal';
import { NewClientModal } from '@/components/pos/new-client-modal';
import { SessionJournalModal } from '@/components/pos/session-journal-modal';
import { IncomingTransfersModal } from '@/components/pos/incoming-transfers-modal';
import { QrCustomerModal } from '@/components/sales/qr-customer-modal';

interface Outlet { id: string; Code: string; Name: string; City?: string; source?: 'assignment' | 'fallback' }
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

  // Stock par produit pour cet outlet : alimente les badges produits.
  // Clés = product UUID PK (matche Product.Id ou .id côté catalogue).
  const [stockByProduct, setStockByProduct] = useState<Map<string, { qty: number; min: number }>>(new Map());

  // Compteur de lignes de transfert pending sur cet outlet : alimente le
  // badge du bouton « Réceptions ».
  const [incomingCount, setIncomingCount] = useState(0);

  // ===== Outlets disponibles pour ce commercial =====
  useEffect(() => {
    fetch('/api/outlets/active')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(({ data }) => {
        setOutlets(data || []);
        // Si un seul outlet assigné, on l'active automatiquement
        if (data?.length === 1) setActiveOutletId(data[0].id);
      });
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
    } finally {
      setOpeningSession(false);
    }
  }

  // ===== Catalogue : produits + prix outlet + stock outlet =====
  const loadCatalog = useCallback(async () => {
    if (!activeOutletId) return;
    setLoadingCatalog(true);
    try {
      const [pRes, prRes, stRes] = await Promise.all([
        fetch('/api/products?isActive=true'),
        // Endpoint résolveur : combine prix outlet + prix par type
        fetch(`/api/outlets/${activeOutletId}/applicable-prices`),
        // Stock physique sur ce stand : alimente les badges produits.
        fetch(`/api/stock/locations/outlet/${activeOutletId}/summary`),
      ]);
      if (pRes.ok) setProducts((await pRes.json()).data || []);
      if (prRes.ok) setPrices((await prRes.json()).data || []);
      if (stRes.ok) {
        const { data } = await stRes.json();
        const m = new Map<string, { qty: number; min: number }>();
        for (const it of (data?.items ?? []) as StockSummaryItem[]) {
          m.set(it.product.id, { qty: Number(it.quantity), min: Number(it.minimumStock) });
        }
        setStockByProduct(m);
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
    const r = await fetch(`/api/scan/queue/${activeOutletId}`);
    if (r.ok) setScans((await r.json()).data || []);
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
        p.Code.toLowerCase().includes(search.toLowerCase()));
  }, [products, prices, search]);

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
  const cartContent = (
    <div className="flex flex-col h-full">
      {/* Bandeau client en haut du panier */}
      <div className="px-3 py-2 border-b bg-indigo-50/50">
        <p className="text-[10px] uppercase font-semibold text-indigo-700 mb-1">Client</p>
        {activeClientLabel ? (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600 shrink-0" />
            <p className="text-sm font-medium text-indigo-900 truncate flex-1">{activeClientLabel}</p>
            <button onClick={clearActiveClient} className="text-indigo-400 hover:text-red-600 p-1" aria-label="Retirer client">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Vente anonyme</p>
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
            {/* Header sticky 1 ligne */}
            <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 flex items-center gap-2">
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
              {/* Bouton kebab actions secondaires */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="relative p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                  aria-label="Actions"
                >
                  <MoreVertical className="w-5 h-5" />
                  {incomingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                      {incomingCount}
                    </span>
                  )}
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-xl z-30 overflow-hidden">
                      <MenuItem icon={<ClipboardList className="w-4 h-4 text-emerald-600" />} label="Journal de caisse"
                        onClick={() => { setShowJournal(true); setShowMenu(false); }} />
                      <MenuItem icon={<PackageCheck className="w-4 h-4 text-purple-600" />} label="Réceptions à confirmer"
                        badge={incomingCount}
                        onClick={() => { setShowIncoming(true); setShowMenu(false); }} />
                      <MenuItem icon={<Truck className="w-4 h-4 text-gray-600" />} label="Réception ad hoc"
                        onClick={() => { setShowReceive(true); setShowMenu(false); }} />
                      <MenuItem icon={<BarChart3 className="w-4 h-4 text-amber-600" />} label="Mes performances"
                        onClick={() => { router.push('/dashboard/sales'); setShowMenu(false); }} />
                      <div className="border-t my-1" />
                      <MenuItem icon={<MapPin className="w-4 h-4 text-gray-600" />} label="Changer de stand"
                        onClick={() => { setActiveOutletId(null); setShowMenu(false); }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bandeau client compact 1 ligne */}
            <div className="px-3 py-2 bg-white border-b flex items-center gap-2">
              <Users className={`w-4 h-4 shrink-0 ${activeClientLabel ? 'text-indigo-600' : 'text-gray-400'}`} />
              <p className={`text-sm truncate flex-1 ${activeClientLabel ? 'font-medium text-indigo-900' : 'text-gray-500 italic'}`}>
                {activeClientLabel || 'Vente anonyme'}
              </p>
              {activeClientLabel && (
                <button onClick={clearActiveClient}
                  className="p-1.5 text-gray-400 hover:text-red-600"
                  aria-label="Retirer client">
                  <X className="w-4 h-4" />
                </button>
              )}
              {!activeClientLabel && (
                <>
                  <button onClick={() => setShowNewClient(true)}
                    className="p-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    title="Créer un client" aria-label="Nouveau client">
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowQr(true)}
                    className="p-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    title="Afficher le QR au client" aria-label="QR stand">
                    <QrCode className="w-4 h-4" />
                  </button>
                  {scans.length > 0 && (
                    <button onClick={() => setShowScansList(true)}
                      className="relative p-1.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      title="Scans QR en attente" aria-label="Scans en attente">
                      <Smartphone className="w-4 h-4" />
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {scans.length}
                      </span>
                    </button>
                  )}
                </>
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
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {sellableProducts.map(p => {
                    const inCart = cart.find(c => c.productId === p._id);
                    const stock = stockByProduct.get(p._id);
                    const qty = stock?.qty ?? null;
                    const min = stock?.min ?? 0;
                    // Pastille stock — TOUJOURS visible. Sans info, "—" gris.
                    let badgeClass = 'bg-gray-200 text-gray-500';
                    let badgeText = '—';
                    if (qty !== null) {
                      badgeText = new Intl.NumberFormat('fr-FR').format(qty);
                      if (qty <= 0) badgeClass = 'bg-red-600 text-white';
                      else if (qty <= min) badgeClass = 'bg-amber-500 text-white';
                      else badgeClass = 'bg-emerald-600 text-white';
                    }
                    const disabled = qty !== null && qty <= 0;
                    return (
                      <button
                        key={p._id}
                        onClick={() => !disabled && addToCart(p)}
                        disabled={disabled}
                        className={`text-left bg-white border rounded-lg overflow-hidden relative transition ${
                          disabled
                            ? 'opacity-60 cursor-not-allowed border-gray-200'
                            : 'border-gray-200 active:scale-95 hover:border-blue-500 hover:shadow-md'
                        }`}
                      >
                        <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
                          {p.ImageUrl
                            /* eslint-disable-next-line @next/next/no-img-element */
                            ? <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                            : <Package className="w-10 h-10 text-gray-300" />}
                          {/* Pastille stock — coin haut-droit, toujours visible */}
                          <span className={`absolute top-1.5 right-1.5 min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shadow ${badgeClass}`}
                            title={qty !== null ? `${badgeText} en stock` : 'Stock inconnu'}>
                            {badgeText}
                          </span>
                          {/* Compteur dans panier — coin bas-droit */}
                          {inCart && (
                            <span className="absolute bottom-1.5 right-1.5 min-w-[24px] h-6 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow">
                              ×{inCart.quantity}
                            </span>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2em]">{p.Name}</p>
                          <p className="text-sm font-bold text-blue-600 mt-0.5">{formatPrice(p.outletPrice)}</p>
                        </div>
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
            onClose={() => setShowCheckout(false)}
            onConfirm={processCheckout}
          />
        )}

        {showNewClient && (
          <NewClientModal
            onClose={() => setShowNewClient(false)}
            onCreated={(c) => {
              setManualClient(c);
              setSelectedScan(null);
              setShowNewClient(false);
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
      </div>
    </ProtectedPage>
  );
}

function formatPrice(v: number) {
  return new Intl.NumberFormat('fr-FR').format(v) + ' XOF';
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
