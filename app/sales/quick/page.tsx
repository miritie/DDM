'use client';

/**
 * Page - VENTE RAPIDE ⚡
 * Vendre en 1 CLIC - Interface ultra-rapide et efficace
 * Module Ventes & Encaissements
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Plus, Minus, Trash2, DollarSign, Check } from 'lucide-react';

interface Product {
  ProductId: string;
  Name: string;
  Code: string;
  UnitPrice: number;
  Currency: string;
}

interface Customer {
  CustomerId: string;
  Name: string;
  Code: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export default function QuickSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'cheque' | 'credit'>('cash');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  async function loadProducts() {
    try {
      const response = await fetch('/api/products?isActive=true');
      const result = await response.json();
      if (response.ok) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  }

  async function loadCustomers() {
    try {
      const response = await fetch('/api/customers?isActive=true');
      const result = await response.json();
      if (response.ok) {
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  }

  function addToCart(product: Product) {
    const existingIndex = cart.findIndex(item => item.product.ProductId === product.ProductId);

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { product, quantity: 1, discount: 0 }]);
    }
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(cart.map(item =>
      item.product.ProductId === productId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    ));
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter(item => item.product.ProductId !== productId));
  }

  function calculateTotals() {
    const subtotal = cart.reduce((sum, item) =>
      sum + (item.product.UnitPrice * item.quantity), 0
    );
    const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
    const total = subtotal - totalDiscount;

    return { subtotal, totalDiscount, total };
  }

  async function processQuickSale() {
    if (!selectedCustomer) {
      alert('Veuillez sélectionner un client');
      return;
    }

    if (cart.length === 0) {
      alert('Le panier est vide');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/sales/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedCustomer.CustomerId,
          items: cart.map(item => ({
            productId: item.product.ProductId,
            quantity: item.quantity,
            unitPrice: item.product.UnitPrice,
            discount: item.discount,
          })),
          paymentMethod,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la vente');
      }

      // ✅ VENTE RÉUSSIE!
      setSuccess(true);
      setCart([]);
      setSelectedCustomer(null);
      setPaymentMethod('cash');

      setTimeout(() => setSuccess(false), 3000);

      alert(`✅ Vente ${result.data.SaleNumber} enregistrée avec succès!`);
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const { subtotal, totalDiscount, total } = calculateTotals();
  const filteredProducts = products.filter(p =>
    p.Name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.Code.toLowerCase().includes(searchProduct.toLowerCase())
  );
  const filteredCustomers = customers.filter(c =>
    c.Name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.Code.toLowerCase().includes(searchCustomer.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            VENTE RAPIDE ⚡
          </h1>
          <p className="text-gray-600 mt-1">Vendez en 1 clic - Rapide, Facile, Efficace</p>
        </div>
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2">
            <Check className="h-5 w-5" />
            Vente enregistrée avec succès!
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sélection Client */}
        <Card>
          <CardHeader>
            <CardTitle>1. Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={searchCustomer}
              onChange={(e) => setSearchCustomer(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />

            {selectedCustomer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-semibold">{selectedCustomer.Name}</p>
                <p className="text-sm text-gray-600">{selectedCustomer.Code}</p>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-sm text-blue-600 hover:underline mt-2"
                >
                  Changer de client
                </button>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredCustomers.map(customer => (
                  <button
                    key={customer.CustomerId}
                    onClick={() => setSelectedCustomer(customer)}
                    className="w-full text-left border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium">{customer.Name}</p>
                    <p className="text-sm text-gray-600">{customer.Code}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Center: Sélection Produits */}
        <Card>
          <CardHeader>
            <CardTitle>2. Produits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredProducts.map(product => (
                <button
                  key={product.ProductId}
                  onClick={() => addToCart(product)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-gray-50 transition-colors flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{product.Name}</p>
                    <p className="text-sm text-gray-600">{product.Code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: product.Currency,
                        minimumFractionDigits: 0,
                      }).format(product.UnitPrice)}
                    </p>
                    <Plus className="h-4 w-4 text-blue-600 ml-auto" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Panier & Paiement */}
        <Card>
          <CardHeader>
            <CardTitle>3. Panier & Paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cart Items */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {cart.map(item => (
                <div key={item.product.ProductId} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm">{item.product.Name}</p>
                    <button
                      onClick={() => removeFromCart(item.product.ProductId)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.ProductId, -1)}
                        className="border rounded p-1 hover:bg-gray-100"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.ProductId, 1)}
                        className="border rounded p-1 hover:bg-gray-100"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-semibold text-green-600">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: item.product.Currency,
                        minimumFractionDigits: 0,
                      }).format(item.product.UnitPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <p className="text-center text-gray-500 py-8">Panier vide</p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sous-total:</span>
                <span>{subtotal.toFixed(0)} XOF</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Remise:</span>
                  <span>-{totalDiscount.toFixed(0)} XOF</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>TOTAL:</span>
                <span className="text-green-600">{total.toFixed(0)} XOF</span>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium mb-2">Mode de paiement:</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="cash">💵 Espèces</option>
                <option value="card">💳 Carte bancaire</option>
                <option value="transfer">🏦 Virement</option>
                <option value="cheque">📝 Chèque</option>
                <option value="credit">📋 À crédit</option>
              </select>
            </div>

            {/* Action Button */}
            <button
              onClick={processQuickSale}
              disabled={loading || !selectedCustomer || cart.length === 0}
              className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center gap-2"
            >
              <DollarSign className="h-6 w-6" />
              {loading ? 'Enregistrement...' : 'VENDRE MAINTENANT ⚡'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
