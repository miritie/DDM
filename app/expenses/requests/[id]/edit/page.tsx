'use client';

/**
 * Page - Modifier une Demande de Dépense (brouillon uniquement)
 * Titre, description, montant, catégorie — le serveur refuse toute
 * modification d'une demande déjà soumise.
 * (Le bouton « Modifier » de la fiche demande pointait vers un 404.)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, PencilLine } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

interface CategoryOpt { id: string; label: string }

export default function EditExpenseRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      fetch(`/api/expenses/requests/${encodeURIComponent(id)}`),
      fetch('/api/expenses/categories?accessibleFor=me&isActive=true'),
    ]).then(async ([rRes, cRes]) => {
      if (rRes.status !== 'fulfilled' || !rRes.value.ok) {
        const body = rRes.status === 'fulfilled' ? await rRes.value.json().catch(() => ({})) : {};
        throw new Error((body as any).error || 'Demande introuvable');
      }
      const { data } = await rRes.value.json();
      setStatus(data.Status);
      setTitle(data.Title || '');
      setDescription(data.Description || '');
      setAmount(String(Number(data.Amount || 0)));
      setCategoryId(data.CategoryId || '');
      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        const cats = ((await cRes.value.json()).data || []) as any[];
        setCategories(cats.map(c => ({ id: c.id, label: c.label })));
      }
    })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/expenses/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          amount: Number(amount),
          categoryId: categoryId || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur lors de la mise à jour');
      router.push(`/expenses/requests/${id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.EXPENSE_EDIT}>
      <div className="container mx-auto p-6 max-w-xl space-y-4">
        <div>
          <Link href={`/expenses/requests/${id}`} className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Détail de la demande
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PencilLine className="w-7 h-7 text-amber-700" /> Modifier la Demande
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : status && status !== 'draft' ? (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            Seules les demandes en <strong>brouillon</strong> peuvent être modifiées —
            celle-ci est déjà « {status} ».{' '}
            <Link href={`/expenses/requests/${id}`} className="font-semibold underline">Retour au détail</Link>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5">
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Titre *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Catégorie</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">— Inchangée —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Montant (XOF) *</label>
                  <input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none" />
                </div>

                {error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                )}

                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : 'Enregistrer les modifications'}
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedPage>
  );
}
