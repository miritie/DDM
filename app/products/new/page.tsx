'use client';

/**
 * Page - Création d'un Produit
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ArrowLeft, Loader2 } from 'lucide-react';
import { ProductImageUpload } from '@/components/products/image-upload';

const COMMON_UNITS = ['piece', 'kg', 'g', 'L', 'mL', 'carton', 'pack', 'bouteille', 'casier'];

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    unit: 'piece',
    unitPrice: '',
    currency: 'XOF',
  });

  useEffect(() => {
    void loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const res = await fetch('/api/admin/product-categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nom requis';
    if (!form.unitPrice || isNaN(Number(form.unitPrice))) e.unitPrice = 'Prix unitaire invalide';
    else if (Number(form.unitPrice) < 0) e.unitPrice = 'Le prix doit être positif';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    try {
      setLoading(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category || undefined,
          unit: form.unit || 'piece',
          unitPrice: Number(form.unitPrice),
          currency: form.currency,
          imageUrl: imageUrl || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la création');
      }
      const data = await res.json();
      router.push(`/products/${data.data.ProductId}`);
    } catch (err: any) {
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-blue-600" />
              Nouveau Produit
            </h1>
            <p className="text-gray-600">Définissez un nouveau produit du catalogue</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/products')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </div>

        {serverError && (
          <div className="mb-6 px-4 py-3 rounded-md border bg-red-50 border-red-200 text-red-800 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations produit</CardTitle>
              <CardDescription>
                Le code interne (PRD-XXXX) sera généré automatiquement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image (optionnel)
                  </label>
                  <ProductImageUpload value={imageUrl} onChange={setImageUrl} />
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Bière Castel 65cl"
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={2}
                      placeholder="Description courte du produit..."
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">— Aucune —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/admin/product-categories')}
                      className="flex-shrink-0"
                    >
                      Gérer
                    </Button>
                  </div>
                  {categories.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Aucune catégorie. Cliquez sur "Gérer" pour en créer.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tarification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix unitaire <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.unitPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                  {errors.unitPrice && (
                    <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="XOF">XOF (FCFA)</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.push('/products')}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Créer le produit
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
