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
  MapPin, Users, ClipboardList, RefreshCw, Truck,
} from 'lucide-react';
import { ReceiveStockModal } from '@/components/pos/receive-stock-modal';
import { CheckoutModal, type CheckoutResult } from '@/components/pos/checkout-modal';

interface Outlet { id: string; Code: string; Name: string; City?: string; source?: 'assignment' | 'fallback' }
interface Product { Id?: string; id?: string; ProductId: string; Code: string; Name: string; Category?: string; ImageUrl?: string }
interface OutletPrice { Id?: string; ProductId: string; UnitPrice: number }
interface CartItem { productId: string; name: string; unitPrice: number; quantity: number; imageUrl?: string }
interface PendingScan { id: string; ClientId?: string; ClientName?: string; ClientPhone?: string; ScannedAt: string }

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
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

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

  // ===== Catalogue : produits + prix outlet =====
  const loadCatalog = useCallback(async () => {
    if (!activeOutletId) return;
    setLoadingCatalog(true);
    try {
      const [pRes, prRes] = await Promise.all([
        fetch('/api/products?isActive=true'),
        // Endpoint résolveur : combine prix outlet + prix par type
        fetch(`/api/outlets/${activeOutletId}/applicable-prices`),
      ]);
      if (pRes.ok) setProducts((await pRes.json()).data || []);
      if (prRes.ok) setPrices((await prRes.json()).data || []);
    } finally { setLoadingCatalog(false); }
  }, [activeOutletId]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

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
          clientId: selectedScan?.ClientId || null,
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
      setCart([]); setSelectedScan(null);
      setShowCheckout(false);
      void loadScans();
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
                <button onClick={() => setShowReceive(true)} className="px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 inline-flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Réceptionner stock
                </button>
                <button onClick={() => router.push('/sales')} className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100 inline-flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Journal
                </button>
                <button onClick={() => setActiveOutletId(null)} className="px-3 py-2 rounded-lg border text-gray-600 text-sm hover:bg-gray-100">
                  Changer d'outlet
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {sellableProducts.map(p => {
                  const inCart = cart.find(c => c.productId === p._id);
                  return (
                    <button key={p._id} onClick={() => addToCart(p)} className="text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:shadow-md relative">
                      <div className="aspect-square mb-2 rounded-md bg-gray-50 overflow-hidden flex items-center justify-center">
                        {p.ImageUrl
                          /* eslint-disable-next-line @next/next/no-img-element */
                          ? <img src={p.ImageUrl} alt={p.Name} className="w-full h-full object-cover" />
                          : <Package className="w-10 h-10 text-gray-300" />}
                      </div>
                      <p className="text-sm font-medium line-clamp-2">{p.Name}</p>
                      <p className="text-sm font-bold text-blue-600 mt-1">{formatPrice(p.outletPrice)}</p>
                      {inCart && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
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

            {/* SCANS CLIENTS */}
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Scans clients ({scans.length})
                </h2>
                <button onClick={loadScans} className="text-xs text-gray-400 hover:text-blue-600"><RefreshCw className="w-3 h-3" /></button>
              </div>
              {scans.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun scan en attente</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-auto">
                  {scans.map(s => (
                    <button key={s.id} onClick={() => setSelectedScan(s.id === selectedScan?.id ? null : s)}
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
