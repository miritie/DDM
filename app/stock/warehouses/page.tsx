'use client';

/**
 * Page - Gestion des Entrepôts
 * Module Stocks & Mouvements
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Warehouse } from '@/types/modules';
import { Building2, MapPin, Plus, Edit, Trash2 } from 'lucide-react';

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouses() {
    try {
      setLoading(true);
      const response = await fetch('/api/stock/warehouses?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data.data || []);
      }
    } catch (error) {
      console.error('Error loading warehouses:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWarehouse(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch('/api/stock/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      setShowCreateForm(false);
      setFormData({ name: '', location: '', address: '' });
      loadWarehouses();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-blue-600" />
              Entrepôts
            </h1>
            <p className="text-gray-600">Gestion des entrepôts et lieux de stockage</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/stock')}>
              Retour
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel Entrepôt
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Créer un Entrepôt</CardTitle>
              <CardDescription>Ajouter un nouvel entrepôt ou lieu de stockage</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWarehouse} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Nom de l'entrepôt <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: Entrepôt Principal, Dépôt Nord..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Localisation</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ex: Abidjan, Yamoussoukro..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Adresse</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Adresse complète"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Créer l'Entrepôt</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({ name: '', location: '', address: '' });
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Warehouses List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Entrepôts</CardTitle>
            <CardDescription>{warehouses.length} entrepôt(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : warehouses.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucun entrepôt créé</p>
                <Button onClick={() => setShowCreateForm(true)}>Créer le premier entrepôt</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map((warehouse) => (
                  <Card key={warehouse.WarehouseId} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-blue-600" />
                          <div>
                            <CardTitle className="text-lg">{warehouse.Name}</CardTitle>
                            <p className="text-sm text-gray-500">{warehouse.Code}</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {warehouse.Location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span>{warehouse.Location}</span>
                        </div>
                      )}
                      {warehouse.Address && (
                        <p className="text-sm text-gray-600">{warehouse.Address}</p>
                      )}

                      <div className="pt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => router.push(`/stock?warehouseId=${warehouse.WarehouseId}`)}
                        >
                          Voir les stocks
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
