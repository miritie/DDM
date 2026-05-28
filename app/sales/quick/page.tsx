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
  BarChart3, PackageCheck,
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

  useEffect(() => { void loadIncomingCount(); }, [loadIncomingCount]);

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

  function addToCart(p: typeof sellableProducts[number]) {
    setCart(prev => {
      const ex = prev.find(c => c.productId === p._id);
      if (ex) return prev.map(c => c.productId === p._id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { productId: p._id, name: p.Name, unitPrice: p.outletPrice, quantity: 1, imageUrl: p.ImageUrl }];
    });
  }

  function changeQty(id: string, delta: number) {
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

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
      <div className="min-h-screen bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-0">
          {/* PANEL GAUCHE : produits */}
          <div className="p-6 lg:pr-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-blue-600" />
                  {currentOutlet?.Name || '…'}
                </h1>
                {openingSession && <p className="text-xs text-gray-500"><Loader2 className="w-3 h-3 inline animate-spin" /> ouverture session POS…</p>}
                {sessionId && !openingSession && <p className="text-xs text-emerald-600">● Session active</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowQr(true)}
                  className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 inline-flex items-center gap-2"
                  title="Afficher le QR à présenter au client"
                >
                  <QrCode className="w-4 h-4" /> QR stand
                </button>
                <button
                  onClick={() => setShowNewClient(true)}
                  className="px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm hover:bg-indigo-100 inline-flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Nouveau client
                </button>
                <button
                  onClick={() => setShowJournal(true)}
                  className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100 inline-flex items-center gap-2"
                >
                  <ClipboardList className="w-4 h-4" /> Journal
                </button>
                <button
                  onClick={() => setShowIncoming(true)}
                  className="relative px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 inline-flex items-center gap-2"
                  title="Confirmer la réception de transferts"
                >
                  <PackageCheck className="w-4 h-4" /> Réceptions
                  {incomingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center">
                      {incomingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowReceive(true)}
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm hover:bg-gray-100 inline-flex items-center gap-2"
                  title="Réception manuelle (hors transfert)"
                >
                  <Truck className="w-4 h-4" /> Récept. ad hoc
                </button>
                <button
                  onClick={() => router.push('/dashboard/sales')}
                  className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm hover:bg-amber-100 inline-flex items-center gap-2"
                  title="Voir mes performances / objectif / classement"
                >
                  <BarChart3 className="w-4 h-4" /> Mes perfs
                </button>
                <button onClick={() => setActiveOutletId(null)} className="px-3 py-2 rounded-lg border text-gray-600 text-sm hover:bg-gray-100">
                  Changer
                </button>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…" className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg" />
            </div>

            {loadingCatalog ? (
              <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" /></div>
            ) : sellableProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-lg border">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">Aucun produit avec un prix défini sur ce point de vente.</p>
                <p className="text-xs text-gray-400 mt-2">L'admin doit configurer les prix dans /admin/outlets.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
                {sellableProducts.map(p => {
                  const inCart = cart.find(c => c.productId === p._id);
                  const stock = stockByProduct.get(p._id);
                  const qty = stock?.qty ?? null;
                  const min = stock?.min ?? 0;
                  // Couleur du badge stock — 0 rouge / sous min orange / OK vert / inconnu gris
                  let stockBadge = 'bg-gray-100 text-gray-500';
                  let stockLabel = 'stock ?';
                  if (qty !== null) {
                    stockLabel = `${new Intl.NumberFormat('fr-FR').format(qty)} en stock`;
                    if (qty <= 0) stockBadge = 'bg-red-100 text-red-700';
                    else if (qty <= min) stockBadge = 'bg-amber-100 text-amber-800';
                    else stockBadge = 'bg-emerald-100 text-emerald-800';
                  }
                  const disabled = qty !== null && qty <= 0;
                  return (
                    <button
                      key={p._id}
                      onClick={() => !disabled && addToCart(p)}
                      disabled={disabled}
                      className={`text-left bg-white border rounded-lg p-2 relative transition ${
                        disabled
                          ? 'opacity-60 cursor-not-allowed border-gray-200'
                          : 'border-gray-200 hover:border-blue-500 hover:shadow-md'
                      }`}
                    >
                      <div className="aspect-square mb-1.5 rounded-md bg-gray-50 overflow-hidden flex items-center justify-center">
                        {p.ImageUrl
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                          : <Package className="w-8 h-8 text-gray-300" />}
                      </div>
                      <p className="text-xs font-medium line-clamp-2 leading-tight">{p.Name}</p>
                      <p className="text-sm font-bold text-blue-600 mt-0.5">{formatPrice(p.outletPrice)}</p>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${stockBadge}`}>
                        {stockLabel}
                      </span>
                      {inCart && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                          {inCart.quantity}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* PANEL DROITE : panier + scans */}
          <div className="bg-white border-l border-gray-200 p-6 lg:pl-3 lg:sticky lg:top-0 lg:h-screen flex flex-col">
            {feedback && (
              <div className={`mb-3 px-3 py-2 rounded-md border text-sm flex items-start gap-2 ${
                feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {feedback.type === 'success' && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span className="flex-1">{feedback.message}</span>
                <button onClick={() => setFeedback(null)}><X className="w-4 h-4 opacity-60" /></button>
              </div>
            )}

            {/* CLIENT */}
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Client
                </h2>
                <button onClick={loadScans} className="text-xs text-gray-400 hover:text-blue-600" title="Rafraîchir les scans">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {manualClient && !selectedScan && (
                <div className="mb-2 px-2.5 py-2 rounded bg-indigo-50 border border-indigo-200 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-indigo-900 truncate">{manualClient.name || manualClient.phone}</p>
                    {manualClient.name && manualClient.phone && (
                      <p className="text-xs text-indigo-700">{manualClient.phone}</p>
                    )}
                    <p className="text-[11px] text-indigo-600 mt-0.5">Rattaché à la prochaine vente</p>
                  </div>
                  <button onClick={() => setManualClient(null)} className="text-indigo-400 hover:text-indigo-700" aria-label="Retirer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <p className="text-[11px] text-gray-500 mb-1">Scans en attente ({scans.length})</p>
              {scans.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun scan en attente</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-auto">
                  {scans.map(s => (
                    <button key={s.id} onClick={() => {
                      setSelectedScan(s.id === selectedScan?.id ? null : s);
                      setManualClient(null);
                    }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm border ${
                        selectedScan?.id === s.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}>
                      <p className="font-medium">{s.ClientName || s.ClientPhone || '(sans nom)'}</p>
                      {s.ClientName && s.ClientPhone && <p className="text-xs text-gray-500">{s.ClientPhone}</p>}
                    </button>
                  ))}
                </div>
              )}
              {selectedScan && (
                <p className="mt-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  ✓ {selectedScan.ClientName || selectedScan.ClientPhone} sera rattaché à la prochaine vente
                </p>
              )}
            </div>

            <h2 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-1.5 mb-2">
              <ShoppingCart className="w-4 h-4" /> Panier ({itemCount})
            </h2>

            <div className="flex-1 overflow-auto -mx-2 px-2 mb-3">
              {cart.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-10">Cliquez sur un produit pour l'ajouter</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-2 p-2 rounded border bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatPrice(item.unitPrice)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(item.productId, -1)} className="w-7 h-7 rounded border bg-white hover:bg-gray-100 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => changeQty(item.productId, 1)} className="w-7 h-7 rounded border bg-white hover:bg-gray-100 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-2xl font-bold">{formatPrice(subtotal)}</span>
              </div>
              <Button onClick={checkout} disabled={cart.length === 0 || submitting} className="w-full py-6 text-base">
                {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Encaissement…</> : <><Check className="w-5 h-5 mr-2" />Encaisser</>}
              </Button>
            </div>
          </div>
        </div>

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
