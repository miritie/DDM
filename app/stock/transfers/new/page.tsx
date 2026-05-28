'use client';

/**
 * Page - Nouveau transfert de stock 1→N
 *
 * Choix : source unique (entrepôt OU stand) + N lignes
 * (produit × qty × destination indépendante).
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, ArrowRightLeft, Save, AlertTriangle,
  Warehouse as WarehouseIcon, Store, Package, Factory,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';

const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500';

interface Warehouse {
  id: string;
  warehouse_id?: string;
  WarehouseId?: string;
  name?: string;
  Name?: string;
  is_production_source?: boolean;
  IsProductionSource?: boolean;
}
interface Outlet {
  id: string;
  code?: string;
  Code?: string;
  name?: string;
  Name?: string;
}
interface Product { id?: string; ProductId: string; Name: string; Code: string; Unit?: string; }

interface LineDraft {
  productId: string;
  qtySent: string;
  destinationType: 'warehouse' | 'outlet';
  destinationId: string;
  notes: string;
}

export default function NewTransferPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_TRANSFER}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pré-remplissage de la source par querystring. Permet aux dashboards
  // métier (ex: Production & Usine) de greffer un raccourci « transfert
  // PF depuis l'unité de production » sans dupliquer la page.
  const presetWarehouseId = searchParams.get('sourceWarehouseId');
  const presetOutletId = searchParams.get('sourceOutletId');
  // Contexte production : verrouille la source au type warehouse, et
  // restreint la liste *source* aux entrepôts marqués
  // `is_production_source`. Les destinations restent ouvertes à TOUS
  // les entrepôts actifs et à tous les stands (règle métier : on sort
  // de l'unité de prod vers n'importe où, mais on n'y rentre pas par
  // ce wizard).
  const fromProduction = searchParams.get('fromProduction') === '1';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sourceType, setSourceType] = useState<'warehouse' | 'outlet'>(
    fromProduction ? 'warehouse' : (presetOutletId ? 'outlet' : 'warehouse')
  );
  const [sourceId, setSourceId] = useState<string>(presetWarehouseId || presetOutletId || '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isProductionSource(w: Warehouse): boolean {
    return Boolean(w.is_production_source ?? w.IsProductionSource);
  }
  // Sous-ensemble des entrepôts utilisables comme source en contexte
  // production. Hors contexte, on ne filtre pas.
  const sourceWarehouses = fromProduction ? warehouses.filter(isProductionSource) : warehouses;

  useEffect(() => {
    // On charge toujours TOUS les entrepôts actifs : ils servent de
    // destinations (et de source, filtrés côté client si production).
    Promise.all([
      fetch('/api/stock/warehouses?isActive=true').then((r) => r.ok ? r.json() : { data: [] }),
      fetch('/api/outlets?isActive=true').then((r) => r.ok ? r.json() : { data: [] }),
      fetch('/api/products?isActive=true').then((r) => r.ok ? r.json() : { data: [] }),
    ]).then(([wR, oR, pR]) => {
      const whs: Warehouse[] = wR.data || [];
      setWarehouses(whs);
      setOutlets(oR.data || []);
      setProducts(pR.data || []);

      // Auto-sélection : si en contexte production et qu'un seul
      // entrepôt source est éligible, on le verrouille par défaut.
      if (fromProduction && !sourceId) {
        const eligible = whs.filter(isProductionSource);
        if (eligible.length === 1) setSourceId(getWarehouseId(eligible[0]));
      }
    });
  }, []);

  function getWarehouseId(w: Warehouse): string {
    return (w.warehouse_id || w.WarehouseId || w.id) as string;
  }
  function getWarehouseName(w: Warehouse): string {
    return (w.name || w.Name || '?') as string;
  }
  // L'API transferts attend le code business de l'outlet (cf.
  // resolveUuid('outlets', 'code', …) côté service), pas l'UUID.
  function getOutletCode(o: Outlet): string {
    return (o.Code || o.code || '') as string;
  }
  function getOutletName(o: Outlet): string {
    return (o.Name || o.name || '?') as string;
  }

  function addLine() {
    setLines([...lines, { productId: '', qtySent: '', destinationType: 'outlet', destinationId: '', notes: '' }]);
  }
  function removeLine(idx: number) { setLines(lines.filter((_, i) => i !== idx)); }
  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    if (!sourceId) { setError('Source requise.'); return; }
    if (lines.length === 0) { setError('Ajoutez au moins une ligne.'); return; }
    if (lines.some((l) => !l.productId || !l.qtySent || !l.destinationId)) {
      setError('Chaque ligne doit avoir un produit, une quantité et une destination.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        source: sourceType === 'warehouse' ? { warehouseId: sourceId } : { outletId: sourceId },
        notes: notes || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          qtySent: Number(l.qtySent),
          destination: l.destinationType === 'warehouse'
            ? { warehouseId: l.destinationId }
            : { outletId: l.destinationId },
          notes: l.notes || undefined,
        })),
      };
      const r = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur création');
      router.push(`/stock/transfers/${j.data.transfer_id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-7 h-7" /> Nouveau transfert de stock
          </h1>
          <p className="text-sm opacity-90 mt-1">
            Un seul émetteur → une ou plusieurs destinations (entrepôts ou stands)
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* Source */}
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="font-bold">Source (émetteur)</h2>
          {fromProduction && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900 flex gap-2 items-start">
              <Factory className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>Transfert depuis l'unité de production.</strong> La source
                est restreinte aux entrepôts marqués « Adossé à l'unité de
                production ». Les destinations restent ouvertes à tous les
                entrepôts et stands actifs.
                {sourceWarehouses.length === 0 && (
                  <span className="block mt-1 text-red-700">
                    Aucun entrepôt source n'est marqué — impossible de créer un transfert.
                    Va dans Stock &gt; Entrepôts pour en désigner au moins un.
                  </span>
                )}
                {sourceWarehouses.length === 1 && (
                  <span className="block mt-1">
                    Seul <strong>{getWarehouseName(sourceWarehouses[0])}</strong> est éligible comme source —
                    sélection verrouillée.
                  </span>
                )}
              </div>
            </div>
          )}
          {!fromProduction && (
            <div className="flex gap-2">
              <button
                onClick={() => { setSourceType('warehouse'); setSourceId(''); }}
                className={`flex-1 h-12 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  sourceType === 'warehouse' ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <WarehouseIcon className="w-4 h-4" /> Entrepôt
              </button>
              <button
                onClick={() => { setSourceType('outlet'); setSourceId(''); }}
                className={`flex-1 h-12 rounded-lg font-medium flex items-center justify-center gap-2 ${
                  sourceType === 'outlet' ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Store className="w-4 h-4" /> Stand
              </button>
            </div>
          )}
          <select
            className={INP}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            disabled={fromProduction && sourceWarehouses.length <= 1}
          >
            <option value="">— Choisir un emplacement source —</option>
            {sourceType === 'warehouse'
              ? sourceWarehouses.map((w) => (
                  <option key={getWarehouseId(w)} value={getWarehouseId(w)}>{getWarehouseName(w)}</option>
                ))
              : outlets.map((o) => (
                  <option key={getOutletCode(o)} value={getOutletCode(o)}>{getOutletName(o)}</option>
                ))}
          </select>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</span>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-600" /> Produits à transférer
            </h2>
            <Button onClick={addLine} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Ligne
            </Button>
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              Ajoutez des lignes (1 ligne = 1 produit × 1 destination). Pour 2 destinations différentes, créez 2 lignes.
            </p>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const prod = products.find((p) => p.ProductId === line.productId);
                return (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-12 sm:col-span-6">
                          <label className="block text-xs text-gray-500 mb-1">Produit</label>
                          <select
                            className={INP + ' text-sm'}
                            value={line.productId}
                            onChange={(e) => updateLine(idx, { productId: e.target.value })}
                          >
                            <option value="">— Produit —</option>
                            {products.map((p) => (
                              <option key={p.ProductId} value={p.ProductId}>{p.Name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-6 sm:col-span-3">
                          <label className="block text-xs text-gray-500 mb-1">Quantité</label>
                          <input
                            type="number" min="1" step="1"
                            className={INP + ' text-sm'}
                            value={line.qtySent}
                            onChange={(e) => updateLine(idx, { qtySent: e.target.value })}
                          />
                        </div>
                        <div className="col-span-6 sm:col-span-3 flex flex-col">
                          <label className="block text-xs text-gray-500 mb-1">Type dest.</label>
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateLine(idx, { destinationType: 'warehouse', destinationId: '' })}
                              className={`flex-1 h-11 rounded-lg text-xs font-medium ${line.destinationType === 'warehouse' ? 'bg-cyan-600 text-white' : 'bg-white border-2'}`}
                              title="Entrepôt"
                            >🏭</button>
                            <button
                              onClick={() => updateLine(idx, { destinationType: 'outlet', destinationId: '' })}
                              className={`flex-1 h-11 rounded-lg text-xs font-medium ${line.destinationType === 'outlet' ? 'bg-cyan-600 text-white' : 'bg-white border-2'}`}
                              title="Stand"
                            >🏪</button>
                          </div>
                        </div>
                        <div className="col-span-12">
                          <label className="block text-xs text-gray-500 mb-1">Destination</label>
                          <select
                            className={INP + ' text-sm'}
                            value={line.destinationId}
                            onChange={(e) => updateLine(idx, { destinationId: e.target.value })}
                          >
                            <option value="">— Choisir une destination —</option>
                            {line.destinationType === 'warehouse'
                              ? warehouses.map((w) => (
                                  <option key={getWarehouseId(w)} value={getWarehouseId(w)}>{getWarehouseName(w)}</option>
                                ))
                              : outlets.map((o) => (
                                  <option key={getOutletCode(o)} value={getOutletCode(o)}>{getOutletName(o)}</option>
                                ))}
                          </select>
                        </div>
                      </div>
                      <button onClick={() => removeLine(idx)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                    {prod && line.qtySent && line.destinationId && (
                      <p className="text-xs text-gray-600">
                        → <strong>{Number(line.qtySent)} {prod.Unit || 'u'}</strong> de {prod.Name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
          <strong>Comment ça marche ?</strong> Au démarrage, le stock source est immédiatement décrémenté.
          Les destinataires reçoivent une alerte et confirment leur réception (qty exacte ou ajustée).
          En cas d'écart, c'est toi qui décides ensuite si l'écart est une perte ou un retour à la source.
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Button variant="outline" onClick={() => router.back()} className="flex-1 h-12">Annuler</Button>
          <Button onClick={submit} disabled={busy} className="flex-1 h-12 bg-cyan-600 hover:bg-cyan-700">
            <Save className="w-5 h-5 mr-1" /> {busy ? 'Création…' : 'Émettre le transfert'}
          </Button>
        </div>
      </div>
    </div>
  );
}
