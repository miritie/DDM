'use client';

/**
 * Page - Nouvelle Vente
 * Module Ventes & Encaissements
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Product, Client } from '@/types/modules';

interface SaleItem {
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function NewSalePage() {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    saleDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    currency: 'XOF',
  });

  // Items state
  const [items, setItems] = useState<SaleItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    productId: '',
    productName: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
  });

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProducts();
    loadClients();
  }, []);

  useEffect(() => {
    if (productSearch) {
      searchProducts(productSearch);
    }
  }, [productSearch]);

  useEffect(() => {
    if (clientSearch) {
      searchClients(clientSearch);
    }
  }, [clientSearch]);

  async function loadProducts() {
    try {
      const response = await fetch('/api/products?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async function loadClients() {
    try {
      const response = await fetch('/api/clients?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }

  async function searchProducts(query: string) {
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(query)}&isActive=true`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Error searching products:', error);
    }
  }

  async function searchClients(query: string) {
    try {
      const response = await fetch(`/api/clients?search=${encodeURIComponent(query)}&isActive=true`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
    }
  }

  function selectProduct(product: Product) {
    setCurrentItem({
      ...currentItem,
      productId: product.ProductId,
      productName: product.Name,
      description: product.Description || '',
      unitPrice: product.UnitPrice,
    });
    setProductSearch(product.Name);
    setShowProductDropdown(false);
  }

  function selectClient(client: Client) {
    setFormData({
      ...formData,
      clientId: client.ClientId,
      clientName: client.Name,
    });
    setClientSearch(client.Name);
    setShowClientDropdown(false);
  }

  function addItem() {
    if (!currentItem.productName) {
      alert('Le nom du produit est requis');
      return;
    }
    if (currentItem.quantity <= 0) {
      alert('La quantité doit être supérieure à 0');
      return;
    }
    if (currentItem.unitPrice <= 0) {
      alert('Le prix unitaire doit être supérieur à 0');
      return;
    }

    const newItem: SaleItem = {
      productId: currentItem.productId,
      productName: currentItem.productName,
      description: currentItem.description,
      quantity: currentItem.quantity,
      unitPrice: currentItem.unitPrice,
      totalPrice: currentItem.quantity * currentItem.unitPrice,
    };

    setItems([...items, newItem]);

    // Reset form
    setCurrentItem({
      productId: '',
      productName: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
    });
    setProductSearch('');
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function calculateTotal(): number {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (items.length === 0) {
      newErrors.items = 'Au moins un article est requis';
    }

    if (!formData.saleDate) {
      newErrors.saleDate = 'La date de vente est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const payload = {
        clientId: formData.clientId || undefined,
        clientName: formData.clientName || formData.clientId ? undefined : 'Client anonyme',
        saleDate: formData.saleDate,
        dueDate: formData.dueDate || undefined,
        notes: formData.notes || undefined,
        currency: formData.currency,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      const result = await response.json();
      alert('Vente créée avec succès!');
      router.push(`/sales/${result.data.SaleId}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: formData.currency,
    }).format(amount);
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="outline" onClick={() => router.push('/sales')} className="mb-4">
            ← Retour
          </Button>
          <h1 className="text-3xl font-bold">Nouvelle Vente</h1>
          <p className="text-gray-600">Créer une nouvelle vente avec articles</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Client & Date */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client Search */}
              <div className="relative">
                <label className="block text-sm font-medium mb-1">Client (optionnel)</label>
                <Input
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Rechercher un client..."
                />
                {showClientDropdown && clientSearch && clients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {clients.slice(0, 10).map((client) => (
                      <button
                        key={client.ClientId}
                        type="button"
                        onClick={() => selectClient(client)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100"
                      >
                        <div className="font-medium">{client.Name}</div>
                        <div className="text-xs text-gray-500">
                          {client.Code} {client.Phone && `• ${client.Phone}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Date de Vente <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formData.saleDate}
                    onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                    className={errors.saleDate ? 'border-red-500' : ''}
                  />
                  {errors.saleDate && <p className="text-red-500 text-sm mt-1">{errors.saleDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date d'Échéance (optionnel)</label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes (optionnel)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notes sur cette vente..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Add Item */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Ajouter un Article</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Search */}
              <div className="relative">
                <label className="block text-sm font-medium mb-1">
                  Produit <span className="text-red-500">*</span>
                </label>
                <Input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setCurrentItem({ ...currentItem, productName: e.target.value });
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Rechercher ou saisir un produit..."
                />
                {showProductDropdown && productSearch && products.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {products.slice(0, 10).map((product) => (
                      <button
                        key={product.ProductId}
                        type="button"
                        onClick={() => selectProduct(product)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100"
                      >
                        <div className="font-medium">{product.Name}</div>
                        <div className="text-xs text-gray-500">
                          {product.Code} • {formatCurrency(product.UnitPrice)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
                <Input
                  value={currentItem.description}
                  onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                  placeholder="Description..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Quantité <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentItem.quantity}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Prix Unitaire <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentItem.unitPrice}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, unitPrice: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Total</label>
                  <div className="px-3 py-2 bg-gray-100 rounded-md font-bold">
                    {formatCurrency(currentItem.quantity * currentItem.unitPrice)}
                  </div>
                </div>
              </div>

              <Button type="button" onClick={addItem} variant="outline" className="w-full">
                + Ajouter l'article
              </Button>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Articles de la Vente</CardTitle>
              <CardDescription>
                {items.length} article{items.length > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errors.items && <p className="text-red-500 text-sm mb-4">{errors.items}</p>}

              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun article ajouté</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Produit
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Quantité
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Prix Unit.
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium">{item.productName}</div>
                            {item.description && (
                              <div className="text-xs text-gray-500">{item.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold">
                            {formatCurrency(item.totalPrice)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeItem(index)}
                              className="text-red-600"
                            >
                              Supprimer
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50">
                        <td colSpan={3} className="px-4 py-3 text-right font-bold">
                          TOTAL
                        </td>
                        <td className="px-4 py-3 text-right text-2xl font-bold text-blue-600">
                          {formatCurrency(calculateTotal())}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Création en cours...' : 'Créer la Vente'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/sales')}
              disabled={loading}
              className="flex-1"
            >
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
