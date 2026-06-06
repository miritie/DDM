'use client';

/**
 * Page - Alertes de Stock
 * Alertes actives (rupture / stock bas / surstock) avec produit et lieu.
 * (Le lien depuis /stock pointait vers un 404.)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle, PackageX, PackageMinus, PackagePlus } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

interface Alert {
  AlertId: string; ProductId: string; WarehouseId?: string; OutletId?: string;
  AlertType: string; CurrentQuantity: number; ThresholdQuantity: number; CreatedAt: string;
}

const TYPE_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  out_of_stock: { label: 'Rupture', cls: 'bg-red-50 text-red-700 border-red-200', icon: <PackageX className="w-4 h-4" /> },
  low_stock: { label: 'Stock bas', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <PackageMinus className="w-4 h-4" /> },
  overstock: { label: 'Surstock', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: <PackagePlus className="w-4 h-4" /> },
};

export default function StockAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [productNames, setProductNames] = useState<Map<string, string>>(new Map());
  const [locationNames, setLocationNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch('/api/stock/alerts'),
      fetch('/api/products'),
      fetch('/api/outlets'),
      fetch('/api/stock/warehouses'),
    ]).then(async ([aRes, pRes, oRes, wRes]) => {
      if (aRes.status !== 'fulfilled' || !aRes.value.ok) {
        const body = aRes.status === 'fulfilled' ? await aRes.value.json().catch(() => ({})) : {};
        throw new Error((body as any).error || 'Erreur de chargement');
      }
      setAlerts((await aRes.value.json()).data || []);

      const names = new Map<string, string>();
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        for (const p of ((await pRes.value.json()).data || [])) {
          names.set(p.Id || p.id, p.Name || p.name);
        }
      }
      setProductNames(names);

      const locs = new Map<string, string>();
      if (oRes.status === 'fulfilled' && oRes.value.ok) {
        for (const o of ((await oRes.value.json()).data || [])) locs.set(o.Id || o.id, o.Name || o.name);
      }
      if (wRes.status === 'fulfilled' && wRes.value.ok) {
        for (const w of ((await wRes.value.json()).data || [])) locs.set(w.Id || w.id, w.Name || w.name);
      }
      setLocationNames(locs);
    })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...alerts].sort((a, b) => (a.AlertType === 'out_of_stock' ? -1 : 1) - (b.AlertType === 'out_of_stock' ? -1 : 1)),
    [alerts]
  );

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div>
          <Link href="/stock" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Stock
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-700" /> Alertes de Stock
          </h1>
          <p className="text-muted-foreground">{alerts.length} alerte(s) active(s)</p>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              ✅ Aucune alerte active — tous les stocks sont au-dessus de leurs seuils.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sorted.map(a => {
              const meta = TYPE_META[a.AlertType] || TYPE_META.low_stock;
              const product = productNames.get(a.ProductId) || a.ProductId;
              const location = locationNames.get(a.OutletId || a.WarehouseId || '') ||
                (a.OutletId ? 'Stand' : 'Entrepôt');
              return (
                <div key={a.AlertId} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${meta.cls}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {meta.icon}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{product}</p>
                      <p className="text-xs opacity-80">{location} · depuis le {new Date(a.CreatedAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold uppercase">{meta.label}</p>
                    <p className="text-sm tabular-nums">
                      {fmt(a.CurrentQuantity)} / seuil {fmt(a.ThresholdQuantity)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
