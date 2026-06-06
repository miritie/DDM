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
 *
 * Cette page est l'orchestrateur : les données viennent des hooks de
 * components/pos/use-pos-data.ts, l'UI des composants components/pos/*.
 * (Découpée depuis un monolithe de 1221 lignes — comportement identique.)
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Search, ShoppingCart, X, Check, ChevronUp } from 'lucide-react';
import { ReceiveStockModal } from '@/components/pos/receive-stock-modal';
import { CheckoutModal, type CheckoutResult } from '@/components/pos/checkout-modal';
import { NewClientModal } from '@/components/pos/new-client-modal';
import { SessionJournalModal } from '@/components/pos/session-journal-modal';
import { IncomingTransfersModal } from '@/components/pos/incoming-transfers-modal';
import { QrCustomerModal } from '@/components/sales/qr-customer-modal';
import { ProductDetailsModal } from '@/components/pos/product-details-modal';
import { CashRegisterModal } from '@/components/pos/cash-register-modal';
import { SendStockModal } from '@/components/pos/send-stock-modal';
import { SaleReceiptModal, type SaleReceiptData } from '@/components/pos/sale-receipt-modal';
import { CloseCashModal } from '@/components/pos/close-cash-modal';
import { OutletPicker } from '@/components/pos/outlet-picker';
import { PosHeader } from '@/components/pos/pos-header';
import { ClientSearchBar } from '@/components/pos/client-search-bar';
import { ProductCatalog } from '@/components/pos/product-catalog';
import { CartPanel } from '@/components/pos/cart-panel';
import { ScansListModal } from '@/components/pos/scans-list-modal';
import {
  usePosOutlets, usePosSession, usePosCatalog, useScanQueue,
  useIncomingTransfersCount, usePosViewMode, useWorkspaceBranding,
} from '@/components/pos/use-pos-data';
import { formatPrice } from '@/components/pos/pos-utils';
import type { CartItem, PendingScan, ManualClient, SellableProduct } from '@/components/pos/pos-types';

export default function QuickSalePage() {
  const router = useRouter();
  const { data: session } = useSession();

  // ===== Données (hooks extraits) =====
  const { outlets, activeOutletId, setActiveOutletId } = usePosOutlets();
  const { sessionId, openingSession } = usePosSession(activeOutletId);
  const { products, prices, stockByProduct, popularityByProduct, loadingCatalog, loadCatalog } = usePosCatalog(activeOutletId);
  const { scans, loadScans } = useScanQueue(activeOutletId);
  const { incomingCount, loadIncomingCount } = useIncomingTransfersCount(activeOutletId);
  const { viewMode, toggleViewMode } = usePosViewMode();
  const branding = useWorkspaceBranding();

  // ===== État local d'orchestration =====
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedScan, setSelectedScan] = useState<PendingScan | null>(null);
  // Client identifié hors scan QR (création directe ou QR plein écran consommé).
  // Utilisé si selectedScan est null lors du checkout.
  const [manualClient, setManualClient] = useState<ManualClient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modales
  const [showReceive, setShowReceive] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showIncoming, setShowIncoming] = useState(false);
  // UI mobile : drawer panier + liste scans (séparée du panier pour rester
  // rapide d'accès sans masquer le catalogue).
  const [showCart, setShowCart] = useState(false);
  const [showScansList, setShowScansList] = useState(false);
  // Fiche produit détaillée (modal plein écran), accessible par icône ℹ.
  const [detailsProductId, setDetailsProductId] = useState<string | null>(null);
  const [showCashRegister, setShowCashRegister] = useState(false);
  const [showSendStock, setShowSendStock] = useState(false);
  // Reçu de vente affiché après un encaissement réussi.
  const [receipt, setReceipt] = useState<SaleReceiptData | null>(null);
  // Fermeture de caisse (Z-out).
  const [showCloseCash, setShowCloseCash] = useState(false);
  // Pré-remplissage à passer au NewClientModal si on l'ouvre depuis le dropdown.
  const [newClientInitial, setNewClientInitial] = useState<{ name?: string; phone?: string }>({});

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

  // Stock cap : on ne laisse pas dépasser la quantité disponible sur l'outlet.
  // Règle métier : TOUT stock est suivi — pas d'info de stock = ZÉRO,
  // donc invendable. Le serveur applique la même règle (refus 409).
  function addToCart(p: SellableProduct) {
    const maxQty = stockByProduct.get(p._id)?.qty ?? 0;
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
      const maxQty = stockByProduct.get(id)?.qty ?? 0;
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
    // Snapshot du panier AVANT de le vider — nécessaire pour le reçu.
    const snapshotItems = cart.map(c => ({ name: c.name, quantity: c.quantity, unitPrice: c.unitPrice }));
    const snapshotClient = activeClientLabel;
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

      // Construit le reçu plein écran qui remplace l'ancien bandeau success.
      setReceipt({
        saleNumber: data.SaleNumber,
        // CreatedAt porte l'heure réelle ; SaleDate est une DATE (minuit).
        date: data.CreatedAt ?? new Date().toISOString(),
        outletName: currentOutlet?.Name ?? '',
        sellerName: session?.user?.name || 'Vendeur',
        companyName: branding?.name || undefined,
        companyTagline: branding?.slogan || undefined,
        companyAddress: branding?.address || undefined,
        companyPhone: branding?.phone || undefined,
        logoUrl: branding?.logoUrl || undefined,
        clientLabel: snapshotClient,
        items: snapshotItems,
        totalAmount: Number(data.TotalAmount),
        amountPaid: Number(data.AmountPaid ?? payment.amountPaid),
        balance: Number(data.Balance ?? 0),
        paymentMethodLabel: payment.paymentMethodLabel,
      });

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
        <OutletPicker outlets={outlets} onPick={setActiveOutletId} />
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

  const cartContent = (
    <CartPanel
      cart={cart}
      subtotal={subtotal}
      submitting={submitting}
      activeClientLabel={activeClientLabel}
      scansCount={scans.length}
      onClearClient={clearActiveClient}
      onNewClient={() => setShowNewClient(true)}
      onShowQr={() => setShowQr(true)}
      onShowScans={() => setShowScansList(true)}
      onChangeQty={changeQty}
      onCheckout={checkout}
    />
  );

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
      <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-0">
          {/* COLONNE GAUCHE : header sticky + bandeau client + recherche + grille produits */}
          <div className="min-w-0">
            <PosHeader
              outletName={currentOutlet?.Name || ''}
              openingSession={openingSession}
              sessionId={sessionId}
              incomingCount={incomingCount}
              viewMode={viewMode}
              onOpenIncoming={() => setShowIncoming(true)}
              onOpenCashRegister={() => setShowCashRegister(true)}
              onJournal={() => setShowJournal(true)}
              onSendStock={() => setShowSendStock(true)}
              onReceive={() => setShowReceive(true)}
              onCloseCash={() => setShowCloseCash(true)}
              onPerformances={() => router.push('/dashboard/sales')}
              onToggleViewMode={toggleViewMode}
              onChangeOutlet={() => setActiveOutletId(null)}
            />

            <ClientSearchBar
              activeClientLabel={activeClientLabel}
              scansCount={scans.length}
              onClearClient={clearActiveClient}
              onSelectClient={(c) => {
                setManualClient({ id: c.id, name: c.name ?? '', phone: c.phone ?? null });
                setSelectedScan(null);
              }}
              onCreateClient={(initial) => {
                setNewClientInitial(initial);
                setShowNewClient(true);
              }}
              onShowQr={() => setShowQr(true)}
              onShowScans={() => setShowScansList(true)}
            />

            {/* Feedback inline (non bloquant) */}
            {feedback && (
              <div className={`mx-3 mt-2 px-3 py-2 rounded-md border text-sm flex items-start gap-2 ${
                feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
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
              <ProductCatalog
                products={sellableProducts}
                stockByProduct={stockByProduct}
                cart={cart}
                viewMode={viewMode}
                loading={loadingCatalog}
                onAdd={addToCart}
                onDecrement={(id) => changeQty(id, -1)}
                onShowDetails={setDetailsProductId}
              />
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
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 disabled:bg-gray-400 active:scale-[0.98] transition"
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
          <ScansListModal
            scans={scans}
            onRefresh={loadScans}
            onPick={(s) => {
              setSelectedScan(s);
              setManualClient(null);
              setShowScansList(false);
            }}
            onClose={() => setShowScansList(false)}
          />
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
              stockQty={stock?.qty ?? 0}
              stockMin={stock?.min ?? 0}
              cartQty={inCart?.quantity ?? 0}
              onClose={() => setDetailsProductId(null)}
              onAddToCart={() => addToCart(p)}
              onDecrement={() => changeQty(p._id, -1)}
            />
          );
        })()}

        {receipt && (
          <SaleReceiptModal
            data={receipt}
            onClose={() => setReceipt(null)}
            onNewSale={() => setReceipt(null)}
          />
        )}

        {showCloseCash && currentOutlet && (
          <CloseCashModal
            outletId={activeOutletId}
            outletName={currentOutlet.Name || ''}
            onClose={() => setShowCloseCash(false)}
            onClosed={() => {
              setShowCloseCash(false);
              setFeedback({ type: 'success', message: 'Caisse clôturée. Bonne fin de journée !' });
              // La session est fermée — on retire l'outlet actif pour
              // forcer un re-pick + ouverture de nouvelle session à la
              // prochaine connexion.
              setActiveOutletId(null);
            }}
          />
        )}
      </div>
    </ProtectedPage>
  );
}
