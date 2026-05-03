'use client';

/**
 * Page - Édition d'un Produit
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Product } from '@/types/modules';
import { Package, ArrowLeft, Loader2, Save, AlertCircle, Power, PowerOff } from 'lucide-react';
import { ProductImageUpload } from '@/components/products/image-upload';

const COMMON_UNITS = ['piece', 'kg', 'g', 'L', 'mL', 'carton', 'pack', 'bouteille', 'casier'];

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    unit: 'piece',
    unitPrice: '',
    isActive: true,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void load();
    void loadCategories();
  }, [productId]);

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

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) {
        setProduct(null);
        return;
      }
      const data = await res.json();
      const p: Product = data.data;
      setProduct(p);
      setForm({
        name: p.Name || '',
        description: p.Description || '',
        category: p.Category || '',
        unit: p.Unit || 'piece',
        unitPrice: String(p.UnitPrice ?? ''),
        isActive: p.IsActive ?? true,
      });
      setImageUrl(p.ImageUrl || null);
    } catch (err) {
      console.error(err);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nom requis';
    if (!form.unitPrice || isNaN(Number(form.unitPrice))) e.unitPrice = 'Prix invalide';
    else if (Number(form.unitPrice) < 0) e.unitPrice = 'Le prix doit être positif';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category || null,
          unit: form.unit,
          unitPrice: Number(form.unitPrice),
          imageUrl: imageUrl,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la mise à jour');
      }
      const data = await res.json();
      setProduct(data.data);
      setFeedback({ type: 'success', message: 'Produit mis à jour avec succès' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!product) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.IsActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      const data = await res.json();
      setProduct(data.data);
      setForm((f) => ({ ...f, isActive: data.data.IsActive }));
      setFeedback({
        type: 'success',
        message: data.data.IsActive ? 'Produit activé' : 'Produit désactivé',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.SALES_EDIT}>
        <div className="p-8 max-w-3xl mx-auto">
          <p className="text-gray-500">Chargement...</p>
        </div>
      </ProtectedPage>
    );
  }

  if (!product) {
    return (
      <ProtectedPage permission={PERMISSIONS.SALES_EDIT}>
        <div className="p-8 max-w-3xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                Produit introuvable
              </CardTitle>
            </CardHeader>
            <CardContent className="text-red-700">
              <p className="mb-4">Le produit "{productId}" n'existe pas ou a été supprimé.</p>
              <Button onClick={() => router.push('/products')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au catalogue
              </Button>
            </CardContent>
          </Card>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_EDIT}>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-blue-600" />
              {product.Name}
            </h1>
            <p className="text-gray-600">
              Code <code className="text-sm font-mono">{product.Code}</code> ·{' '}
              <span className={product.IsActive ? 'text-green-600' : 'text-gray-500'}>
                {product.IsActive ? 'Actif' : 'Inactif'}
              </span>
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/products')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {feedback && (
          <div
            className={`mb-6 px-4 py-3 rounded-md border ${
              feedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations produit</CardTitle>
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
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
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
                      {form.category &&
                        !categories.find((c) => c.name === form.category) && (
                          <option value={form.category}>
                            {form.category} (catégorie supprimée)
                          </option>
                        )}
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
              <CardDescription>Devise : {product.Currency}</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
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
                />
                {errors.unitPrice && <p className="text-red-500 text-xs mt-1">{errors.unitPrice}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={toggleActive}
              disabled={saving}
              className={
                product.IsActive
                  ? 'text-orange-600 border-orange-300 hover:bg-orange-50'
                  : 'text-green-600 border-green-300 hover:bg-green-50'
              }
            >
              {product.IsActive ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Désactiver
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Activer
                </>
              )}
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/products')}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
