'use client';

/**
 * Admin — Détail d'un outlet : édition + prix par produit + factures + QR.
 * Pour le planning d'assignation, utiliser /admin/outlets/[id]/planning (à venir).
 */

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, QrCode, Loader2, Save, Trash2, Plus } from 'lucide-react';

// Convention : nos services outlets utilisent un mapper manuel → `id` minuscule.
// /api/products passe par postgres-client.list → PascalCase `Id`. D'où l'asymétrie.
interface Outlet {
  id: string; Code: string; Name: string; OutletTypeId?: string;
  Address?: string; City?: string; QrToken: string; IsActive: boolean;
  AllowsCredit?: boolean;
}
interface OutletType { id: string; Code: string; Name: string }
interface Product { Id: string; ProductId: string; Name: string; Code: string; UnitPrice: number }
interface OutletPrice { id: string; ProductId: string; OutletId?: string; OutletTypeId?: string; UnitPrice: number; ValidFrom: string; ValidTo?: string }
interface OutletInvoice {
  id: string; InvoiceNumber: string; PeriodYear: number; PeriodMonth: number;
  Amount: number; IssueDate: string; DueDate: string; Status: string;
}

export default function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: outletId } = use(params);
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [types, setTypes] = useState<OutletType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<OutletPrice[]>([]);
  const [invoices, setInvoices] = useState<OutletInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadAll(); }, [outletId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [oRes, tRes, pRes, prRes, iRes] = await Promise.all([
        fetch(`/api/outlets/${outletId}`),
        fetch('/api/outlets/types'),
        fetch('/api/products?isActive=true'),
        fetch(`/api/outlets/prices?outletId=${outletId}`),
        fetch(`/api/outlets/invoices?outletId=${outletId}`),
      ]);
      if (oRes.ok) setOutlet((await oRes.json()).data);
      if (tRes.ok) setTypes((await tRes.json()).data || []);
      if (pRes.ok) setProducts((await pRes.json()).data || []);
      if (prRes.ok) setPrices((await prRes.json()).data || []);
      if (iRes.ok) setInvoices((await iRes.json()).data || []);
    } finally { setLoading(false); }
  }

  async function saveOutlet() {
    if (!outlet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/outlets/${outletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Name: outlet.Name, Address: outlet.Address, City: outlet.City,
          OutletTypeId: outlet.OutletTypeId, IsActive: outlet.IsActive,
          AllowsCredit: outlet.AllowsCredit ?? false,
        }),
      });
      if (!res.ok) alert((await res.json()).error || 'Erreur');
    } finally { setSaving(false); }
  }

  if (loading || !outlet) {
    return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  }

  const scanUrl = typeof window !== 'undefined' ? `${window.location.origin}/scan/${outlet.QrToken}` : '';

  return (
    <ProtectedPage permission={PERMISSIONS.OUTLET_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link href="/admin/outlets" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour à la liste
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{outlet.Name}</h1>
            <p className="text-sm text-gray-500 font-mono">{outlet.Code}</p>
          </div>
          <Button onClick={saveOutlet} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* INFOS */}
          <div className="lg:col-span-2 space-y-3 bg-white p-6 rounded-2xl border">
            <h2 className="font-bold text-lg mb-3">Informations</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Nom</label>
                <input value={outlet.Name} onChange={e => setOutlet({ ...outlet, Name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Type</label>
                <select value={outlet.OutletTypeId || ''} onChange={e => setOutlet({ ...outlet, OutletTypeId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border rounded-md">
                  <option value="">— Sans type —</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.Name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Ville</label>
                <input value={outlet.City || ''} onChange={e => setOutlet({ ...outlet, City: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Statut</label>
                <select value={outlet.IsActive ? '1' : '0'} onChange={e => setOutlet({ ...outlet, IsActive: e.target.value === '1' })}
                  className="w-full px-3 py-2 border rounded-md">
                  <option value="1">Actif</option>
                  <option value="0">Inactif</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Adresse</label>
                <input value={outlet.Address || ''} onChange={e => setOutlet({ ...outlet, Address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div className="col-span-2">
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={Boolean(outlet.AllowsCredit)}
                    onChange={e => setOutlet({ ...outlet, AllowsCredit: e.target.checked })}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="text-sm">
                    <p className="font-medium">Autoriser la vente à crédit sur ce stand</p>
                    <p className="text-xs text-gray-500">
                      Si coché, l'option « Crédit » apparaît dans l'écran d'encaissement du POS.
                      Sinon (défaut), le vendeur doit toujours encaisser le montant total.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* QR */}
          <div className="bg-white p-6 rounded-2xl border text-center">
            <h2 className="font-bold text-lg mb-3 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" /> QR Stand
            </h2>
            <p className="text-xs text-gray-500 mb-3">Imprimez et affichez sur le stand. Tous les commerciaux du stand utilisent ce QR.</p>
            <div className="bg-gray-50 p-3 rounded-lg break-all text-xs font-mono">{scanUrl}</div>
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(scanUrl)}`}
               target="_blank" rel="noreferrer"
               className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              Générer / télécharger le QR code →
            </a>
          </div>
        </div>

        {/* PRIX */}
        <PricesSection outletId={outletId} products={products} prices={prices} onChange={loadAll} />

        {/* MOYENS DE PAIEMENT ACCEPTÉS */}
        <PaymentMethodsSection outletId={outletId} />

        {/* FACTURES */}
        <InvoicesSection outletId={outletId} invoices={invoices} onChange={loadAll} />
      </div>
    </ProtectedPage>
  );
}

// ============================================================================

function PricesSection({ outletId, products, prices, onChange }: {
  outletId: string; products: Product[]; prices: OutletPrice[]; onChange: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!productId || !unitPrice) return;
    setAdding(true);
    try {
      const res = await fetch('/api/outlets/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, outletId, unitPrice: Number(unitPrice) }),
      });
      if (!res.ok) { alert((await res.json()).error || 'Erreur'); return; }
      setProductId(''); setUnitPrice(''); onChange();
    } finally { setAdding(false); }
  }

  return (
    <div className="bg-white p-6 rounded-2xl border">
      <h2 className="font-bold text-lg mb-4">Prix par produit</h2>
      <p className="text-sm text-gray-600 mb-4">Définis ici un prix spécifique à ce point de vente. À défaut, les prix par défaut du produit (ou ceux du type d'outlet) seront automatiquement appliqués.</p>

      <div className="flex gap-2 mb-4 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-600">Produit</label>
          <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full px-3 py-2 border rounded-md">
            <option value="">— Sélectionner —</option>
            {products.map(p => <option key={p.Id} value={p.Id}>{p.Name}</option>)}
          </select>
        </div>
        <div className="w-40">
          <label className="text-xs text-gray-600">Prix unitaire (XOF)</label>
          <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
            className="w-full px-3 py-2 border rounded-md" />
        </div>
        <Button onClick={add} disabled={adding}><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
      </div>

      {prices.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-6">Aucun prix défini</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr><th className="text-left px-3 py-2">Produit</th><th className="text-right px-3 py-2">Prix</th><th className="text-left px-3 py-2">Valable du</th></tr>
          </thead>
          <tbody className="divide-y">
            {prices.map(p => {
              const product = products.find(prod => prod.Id === p.ProductId);
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2">{product?.Name || p.ProductId.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-right font-bold">{Number(p.UnitPrice).toLocaleString('fr-FR')} XOF</td>
                  <td className="px-3 py-2 text-gray-500">{p.ValidFrom}{p.ValidTo ? ` → ${p.ValidTo}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================================================

interface PaymentMethodOption {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  requiredWalletType: string | null;
}

function PaymentMethodsSection({ outletId }: { outletId: string }) {
  const [methods, setMethods] = useState<PaymentMethodOption[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    void load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [outletId]);

  async function load() {
    setLoading(true);
    try {
      const [pmRes, accRes] = await Promise.all([
        fetch('/api/treasury/payment-methods?isActive=true'),
        fetch(`/api/outlets/${outletId}/payment-methods`),
      ]);
      if (pmRes.ok) {
        const { data } = await pmRes.json();
        setMethods((data ?? []).map((m: any) => ({
          id: m.id,
          code: m.Code ?? m.code,
          label: m.Label ?? m.label,
          isActive: m.IsActive ?? m.is_active ?? true,
          requiredWalletType: m.RequiredWalletType ?? m.required_wallet_type ?? null,
        })));
      }
      if (accRes.ok) {
        const { data } = await accRes.json();
        setAcceptedIds(new Set(data?.acceptedIds ?? []));
        setFallback(Boolean(data?.fallback));
      }
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setAcceptedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/outlets/${outletId}/payment-methods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(acceptedIds) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur sauvegarde');
      }
      const { data } = await res.json();
      setAcceptedIds(new Set(data.acceptedIds));
      setFallback(Boolean(data.fallback));
      setFeedback({ type: 'success', message: 'Moyens de paiement enregistrés' });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setAcceptedIds(new Set());
  }

  return (
    <div className="bg-white p-6 rounded-2xl border">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h2 className="font-bold text-lg">Moyens de paiement acceptés sur ce stand</h2>
          <p className="text-sm text-gray-600 mt-1">
            Coche les moyens autorisés pour ce point de vente. Le checkout du POS
            filtrera la liste en conséquence. Sans sélection explicite, seul le
            cash est accepté par défaut.
          </p>
        </div>
        <Link href="/treasury/payment-methods" className="text-xs text-blue-600 hover:underline shrink-0 mt-1">
          Gérer le catalogue →
        </Link>
      </div>

      {fallback && acceptedIds.size === 0 && !loading && (
        <div className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          ⚠ Aucune sélection — par défaut, seul le cash est accepté sur ce stand.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin inline" /> Chargement…</p>
      ) : methods.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          Aucun moyen de paiement défini au niveau du workspace. Crée d'abord les méthodes
          depuis <Link href="/treasury/payment-methods" className="text-blue-600 hover:underline">Trésorerie &gt; Moyens de paiement</Link>.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {methods.map(m => {
              const checked = acceptedIds.has(m.id);
              return (
                <label key={m.id} className={
                  'flex items-start gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition ' +
                  (checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50')
                }>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(m.id)}
                    className="mt-0.5 w-4 h-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.label}</p>
                    <p className="text-[11px] text-gray-500 font-mono">
                      {m.code}
                      {m.requiredWalletType && ' · wallet ' + m.requiredWalletType}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {feedback && (
            <div className={
              'mt-3 px-3 py-2 rounded-md border text-sm ' +
              (feedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800')
            }>
              {feedback.message}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t">
            <button
              onClick={reset}
              disabled={saving}
              className="text-xs text-gray-600 hover:text-red-600 underline disabled:opacity-50"
            >
              Tout décocher (retour défaut cash)
            </button>
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Sauvegarde…' : 'Enregistrer'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================

function InvoicesSection({ outletId, invoices, onChange }: {
  outletId: string; invoices: OutletInvoice[]; onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="bg-white p-6 rounded-2xl border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Factures mensuelles reçues</h2>
        <Button onClick={() => setShowForm(s => !s)}><Plus className="w-4 h-4 mr-1" />Nouvelle facture</Button>
      </div>

      {showForm && <NewInvoiceForm outletId={outletId} onCreated={() => { setShowForm(false); onChange(); }} />}

      {invoices.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-6">Aucune facture</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">N°</th>
              <th className="text-left px-3 py-2">Période</th>
              <th className="text-right px-3 py-2">Montant</th>
              <th className="text-left px-3 py-2">Échéance</th>
              <th className="text-center px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map(i => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-mono text-xs">{i.InvoiceNumber}</td>
                <td className="px-3 py-2">{String(i.PeriodMonth).padStart(2, '0')}/{i.PeriodYear}</td>
                <td className="px-3 py-2 text-right font-bold">{Number(i.Amount).toLocaleString('fr-FR')} XOF</td>
                <td className="px-3 py-2">{i.DueDate}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    i.Status === 'paid' ? 'bg-green-100 text-green-700' :
                    i.Status === 'overdue' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{i.Status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewInvoiceForm({ outletId, onCreated }: { outletId: string; onCreated: () => void }) {
  const now = new Date();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(now.toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/outlets/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId, invoiceNumber, periodYear, periodMonth,
          amount: Number(amount), issueDate, dueDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 p-4 rounded-lg mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
      <input required value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="N° facture" className="px-3 py-2 border rounded-md" />
      <input type="number" required value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))} className="px-3 py-2 border rounded-md" placeholder="Année" />
      <input type="number" min={1} max={12} required value={periodMonth} onChange={e => setPeriodMonth(Number(e.target.value))} className="px-3 py-2 border rounded-md" placeholder="Mois" />
      <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="px-3 py-2 border rounded-md" placeholder="Montant XOF" />
      <input type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} className="px-3 py-2 border rounded-md" />
      <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className="px-3 py-2 border rounded-md" />
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <div className="col-span-full flex gap-2 justify-end">
        <Button type="submit" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
    </form>
  );
}
