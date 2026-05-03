'use client';

/**
 * Page - Gestion des catégories de produits
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Tag, Trash2, Loader2, Check, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#64748b', // slate
];

export default function ProductCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/product-categories?includeInactive=true');
      if (!res.ok) throw new Error('Chargement impossible');
      const data = await res.json();
      setCategories(data.data || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setCreating(true);
      const res = await fetch('/api/admin/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      setNewName('');
      setNewColor(DEFAULT_COLORS[0]);
      setFeedback({ type: 'success', message: 'Catégorie créée' });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/admin/product-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      cancelEdit();
      setFeedback({ type: 'success', message: 'Catégorie mise à jour' });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function toggleActive(cat: Category) {
    try {
      const res = await fetch(`/api/admin/product-categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Supprimer la catégorie "${cat.name}" ?\n\nSi des produits l'utilisent, elle sera désactivée plutôt que supprimée.`)) return;
    try {
      const res = await fetch(`/api/admin/product-categories/${cat.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      const result = await res.json();
      setFeedback({
        type: 'success',
        message: result.deactivated
          ? `Catégorie désactivée (utilisée par ${result.usageCount} produit(s))`
          : 'Catégorie supprimée',
      });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_VIEW}>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Tag className="h-8 w-8 text-blue-600" />
              Catégories de produits
            </h1>
            <p className="text-gray-600">
              Liste configurable utilisée dans le formulaire des produits
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin/settings')}>
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

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nouvelle catégorie</CardTitle>
            <CardDescription>Le nom doit être unique dans le workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Boissons, Hygiène, Alimentaire..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                <div className="flex gap-1">
                  {DEFAULT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-md border-2 transition-transform ${
                        newColor === c ? 'border-gray-900 scale-110' : 'border-transparent'
                      }`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={creating || !newName.trim()}>
                {creating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Ajouter
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catégories existantes</CardTitle>
            <CardDescription>
              {categories.filter((c) => c.isActive).length} active(s) / {categories.length} au total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : categories.length === 0 ? (
              <div className="text-center py-12">
                <Tag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucune catégorie. Créez la première ci-dessus.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {categories.map((cat) => (
                  <div key={cat.id} className="py-3 flex items-center gap-3">
                    {editingId === cat.id ? (
                      <>
                        <div className="flex gap-1">
                          {DEFAULT_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setEditColor(c)}
                              style={{ backgroundColor: c }}
                              className={`w-6 h-6 rounded border-2 ${
                                editColor === c ? 'border-gray-900' : 'border-transparent'
                              }`}
                            />
                          ))}
                        </div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(cat.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button size="sm" onClick={() => saveEdit(cat.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="flex-1">
                          <p className={`font-medium ${cat.isActive ? '' : 'text-gray-400 line-through'}`}>
                            {cat.name}
                          </p>
                        </div>
                        {!cat.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Inactive
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => startEdit(cat)}>
                          Renommer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(cat)}
                          className={cat.isActive ? 'text-orange-600' : 'text-green-600'}
                        >
                          {cat.isActive ? 'Désactiver' : 'Activer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(cat)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
