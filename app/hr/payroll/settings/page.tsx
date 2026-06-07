'use client';

/**
 * Page - Paramètres des Primes Commerciaux
 * Forfait de prime de vente (global + exceptions par produit) et
 * prime de transport quotidienne par salarié. Modifiable à tout
 * moment — appliqué aux prochaines clôtures de caisse.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Settings2, Save } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

interface ProductRow { id: string; name: string; bonus: number | null }
interface EmployeeRow { id: string; name: string; position?: string; transportDaily: number }

export default function PrimeSettingsPage() {
  const [globalBonus, setGlobalBonus] = useState('100');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/hr/payroll/prime-settings')
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur de chargement');
        const d = (await r.json()).data;
        setGlobalBonus(String(d.global ?? 100));
        setProducts(d.products || []);
        setEmployees(d.employees || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch('/api/hr/payroll/prime-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global: Number(globalBonus) || 0,
          products: products.map(p => ({ id: p.id, bonus: p.bonus })),
          employees: employees.map(e => ({ id: e.id, transportDaily: Number(e.transportDaily) || 0 })),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Échec de l\'enregistrement');
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.HR_EDIT}>
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-4 pb-24">
        <div>
          <Link href="/hr/payroll" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Gestion de la paie
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-amber-700" /> Paramètres des Primes
          </h1>
          <p className="text-muted-foreground text-sm">
            Appliqués aux prochaines clôtures de caisse — les primes déjà versées ne changent pas
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}
        {saved && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✅ Paramètres enregistrés
          </div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : (
          <>
            <Card>
              <CardContent className="pt-5">
                <h2 className="font-bold mb-1">Prime de vente — forfait global</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Montant versé au commercial pour CHAQUE unité vendue, identique pour tous les produits
                  (sauf exception ci-dessous). Payé en espèces à la clôture de caisse.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" step="5" value={globalBonus}
                    onChange={e => setGlobalBonus(e.target.value)}
                    className="w-36 px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-bold tabular-nums"
                  />
                  <span className="text-sm font-semibold text-gray-600">F / unité vendue</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <h2 className="font-bold mb-1">Exceptions par produit</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Laissez vide pour suivre le forfait global ({globalBonus || 0} F).
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {products.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm truncate">{p.name}</span>
                      <input
                        type="number" min="0" step="5"
                        value={p.bonus ?? ''}
                        placeholder={globalBonus || '0'}
                        onChange={e => {
                          const v = e.target.value;
                          setProducts(prev => prev.map((x, j) =>
                            j === i ? { ...x, bonus: v === '' ? null : Number(v) } : x));
                        }}
                        className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right tabular-nums shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <h2 className="font-bold mb-1">Prime de transport quotidienne</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Versée en espèces à chaque jour de présence effective (clôture de caisse). 2 500 F par défaut.
                </p>
                <div className="space-y-2">
                  {employees.map((emp, i) => (
                    <div key={emp.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        {emp.position && <p className="text-xs text-gray-400 truncate">{emp.position}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number" min="0" step="100"
                          value={emp.transportDaily}
                          onChange={e => {
                            const v = Number(e.target.value) || 0;
                            setEmployees(prev => prev.map((x, j) => j === i ? { ...x, transportDaily: v } : x));
                          }}
                          className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right tabular-nums"
                        />
                        <span className="text-xs text-gray-500">F/j</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t p-3 sm:static sm:bg-transparent sm:border-0 sm:p-0">
              <button onClick={save} disabled={saving}
                className="w-full max-w-2xl mx-auto block py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:opacity-50">
                {saving
                  ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</span>
                  : <span className="inline-flex items-center gap-2"><Save className="w-4 h-4" /> Enregistrer les paramètres</span>}
              </button>
            </div>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
