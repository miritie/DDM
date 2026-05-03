'use client';

/**
 * Page - Catalogue Produits
 * Module Ventes & Encaissements
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Product } from '@/types/modules';
import { Package, Plus, ArrowLeft, Search } from 'lucide-react';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void load();
  }, [filter]);

  async function load() {
    try {
      setLoading(true);
      let url = '/api/products';
      if (filter !== 'all') url += `?isActive=${filter === 'active'}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.Name.toLowerCase().includes(q) ||
        p.Code.toLowerCase().includes(q) ||
        (p.Category || '').toLowerCase().includes(q) ||
        (p.Description || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const stats = {
    total: products.length,
    active: products.filter((p) => p.IsActive).length,
    categories: new Set(products.map((p) => p.Category).filter(Boolean)).size,
  };

  function formatPrice(value: number, currency: string) {
    return new Intl.NumberFormat('fr-FR').format(value) + ' ' + currency;
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8 text-blue-600" />
              Catalogue Produits
            </h1>
            <p className="text-gray-600">Définition et gestion des produits du workspace</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Button onClick={() => router.push('/products/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Produit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Produits référencés</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-gray-500 mt-1">En vente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Catégories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{stats.categories}</p>
              <p className="text-xs text-gray-500 mt-1">Distinctes</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, code, catégorie..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Tous
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                onClick={() => setFilter('active')}
              >
                Actifs
              </Button>
              <Button
                variant={filter === 'inactive' ? 'default' : 'outline'}
                onClick={() => setFilter('inactive')}
              >
                Inactifs
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liste des produits</CardTitle>
            <CardDescription>{filtered.length} produit(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  {search ? 'Aucun produit ne correspond à votre recherche' : 'Aucun produit défini'}
                </p>
                <Button onClick={() => router.push('/products/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le premier produit
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">Image</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unité</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Prix</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filtered.map((p) => (
                      <tr
                        key={p.ProductId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/products/${p.ProductId}`)}
                      >
                        <td className="px-4 py-2">
                          {p.ImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.ImageUrl}
                              alt={p.Name}
                              className="w-12 h-12 rounded-md object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{p.Code}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{p.Name}</p>
                          {p.Description && (
                            <p className="text-xs text-gray-500 line-clamp-1">{p.Description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.Category || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.Unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatPrice(Number(p.UnitPrice), p.Currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              p.IsActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {p.IsActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
