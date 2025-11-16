'use client';

/**
 * Page - Historique des Mouvements de Stock
 * Module Stocks & Mouvements
 * Production → Entrepôt → Distribution
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StockMovement, Product, Warehouse } from '@/types/modules';
import { ArrowDown, ArrowUp, ArrowLeftRight, AlertCircle, RotateCcw, Plus } from 'lucide-react';

export default function StockMovementsPage() {
  const router = useRouter();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'entry' | 'exit' | 'transfer'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // Load products
      const productsRes = await fetch('/api/products?isActive=true');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.data || []);
      }

      // Load warehouses
      const warehousesRes = await fetch('/api/stock/warehouses?isActive=true');
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json();
        setWarehouses(warehousesData.data || []);
      }

      // Load movements
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('type', filter);
      }

      const movementsRes = await fetch(`/api/stock/movements?${params.toString()}`);
      if (movementsRes.ok) {
        const movementsData = await movementsRes.json();
        setMovements(movementsData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getProductName(productId: string): string {
    const product = products.find((p) => p.ProductId === productId);
    return product?.Name || 'Produit inconnu';
  }

  function getWarehouseName(warehouseId?: string): string {
    if (!warehouseId) return '-';
    const warehouse = warehouses.find((w) => w.WarehouseId === warehouseId);
    return warehouse?.Name || 'Entrepôt inconnu';
  }

  function getMovementIcon(type: string) {
    const icons = {
      entry: <ArrowDown className="h-5 w-5 text-green-600" />,
      exit: <ArrowUp className="h-5 w-5 text-red-600" />,
      transfer: <ArrowLeftRight className="h-5 w-5 text-blue-600" />,
      adjustment: <AlertCircle className="h-5 w-5 text-orange-600" />,
      return: <RotateCcw className="h-5 w-5 text-purple-600" />,
    };
    return icons[type as keyof typeof icons] || icons.entry;
  }

  function getMovementLabel(type: string) {
    const labels = {
      entry: 'Entrée (Production)',
      exit: 'Sortie (Distribution)',
      transfer: 'Transfert',
      adjustment: 'Ajustement',
      return: 'Retour',
    };
    return labels[type as keyof typeof labels] || type;
  }

  function getMovementBadge(type: string) {
    const styles = {
      entry: 'bg-green-100 text-green-800',
      exit: 'bg-red-100 text-red-800',
      transfer: 'bg-blue-100 text-blue-800',
      adjustment: 'bg-orange-100 text-orange-800',
      return: 'bg-purple-100 text-purple-800',
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
          styles[type as keyof typeof styles] || styles.entry
        }`}
      >
        {getMovementIcon(type)}
        {getMovementLabel(type)}
      </span>
    );
  }

  function getStatusBadge(status: string) {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      validated: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'En attente',
      validated: 'Validé',
      cancelled: 'Annulé',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mouvements de Stock</h1>
            <p className="text-gray-600">Production → Entrepôt → Distribution</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/stock')}>
              Retour
            </Button>
            <Button onClick={() => router.push('/stock/movements/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Mouvement
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Tous
              </Button>
              <Button
                variant={filter === 'entry' ? 'default' : 'outline'}
                onClick={() => setFilter('entry')}
                className="inline-flex items-center gap-2"
              >
                <ArrowDown className="h-4 w-4" />
                Entrées (Production)
              </Button>
              <Button
                variant={filter === 'exit' ? 'default' : 'outline'}
                onClick={() => setFilter('exit')}
                className="inline-flex items-center gap-2"
              >
                <ArrowUp className="h-4 w-4" />
                Sorties (Distribution)
              </Button>
              <Button
                variant={filter === 'transfer' ? 'default' : 'outline'}
                onClick={() => setFilter('transfer')}
                className="inline-flex items-center gap-2"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Transferts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Movements List */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des Mouvements</CardTitle>
            <CardDescription>{movements.length} mouvement(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : movements.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Aucun mouvement trouvé</p>
                <Button onClick={() => router.push('/stock/movements/new')}>
                  Créer le premier mouvement
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Numéro
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Produit
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        De / Vers
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Quantité
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr key={movement.MovementId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{movement.MovementNumber}</td>
                        <td className="px-4 py-3 text-sm">{getMovementBadge(movement.Type)}</td>
                        <td className="px-4 py-3 text-sm">{getProductName(movement.ProductId)}</td>
                        <td className="px-4 py-3 text-sm">
                          {movement.Type === 'entry' && (
                            <span>
                              Production → <span className="font-medium">{getWarehouseName(movement.DestinationWarehouseId)}</span>
                            </span>
                          )}
                          {movement.Type === 'exit' && (
                            <span>
                              <span className="font-medium">{getWarehouseName(movement.SourceWarehouseId)}</span> → Distribution
                            </span>
                          )}
                          {movement.Type === 'transfer' && (
                            <span>
                              <span className="font-medium">{getWarehouseName(movement.SourceWarehouseId)}</span> →{' '}
                              <span className="font-medium">{getWarehouseName(movement.DestinationWarehouseId)}</span>
                            </span>
                          )}
                          {movement.Type === 'adjustment' && (
                            <span className="font-medium">{getWarehouseName(movement.DestinationWarehouseId)}</span>
                          )}
                          {movement.Type === 'return' && (
                            <span>
                              Retour → <span className="font-medium">{getWarehouseName(movement.DestinationWarehouseId)}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold">{movement.Quantity}</td>
                        <td className="px-4 py-3 text-sm text-center">{getStatusBadge(movement.Status)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(movement.CreatedAt)}</td>
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
