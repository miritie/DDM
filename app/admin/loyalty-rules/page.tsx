'use client';

/**
 * Page - Programme de fidélisation : règles paramétriques.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Award, Trash2, Loader2, Save, X } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  description: string | null;
  everyNthPurchase: number | null;
  minCartTotal: number | null;
  minItemCount: number | null;
  minTotalSpent: number | null;
  minTotalPurchases: number | null;
  windowDays: number | null;
  rewardType: 'percentage' | 'fixed_amount';
  rewardValue: number;
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

interface FormState {
  name: string;
  description: string;
  everyNthPurchase: string;
  minCartTotal: string;
  minItemCount: string;
  minTotalSpent: string;
  minTotalPurchases: string;
  windowDays: string;
  rewardType: 'percentage' | 'fixed_amount';
  rewardValue: string;
  priority: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  everyNthPurchase: '',
  minCartTotal: '',
  minItemCount: '',
  minTotalSpent: '',
  minTotalPurchases: '',
  windowDays: '',
  rewardType: 'percentage',
  rewardValue: '',
  priority: '0',
  isActive: true,
  startsAt: '',
  endsAt: '',
};

function ruleToForm(r: Rule): FormState {
  const num = (v: number | null) => (v == null ? '' : String(v));
  const dt = (v: string | null) => (v ? v.slice(0, 16) : '');
  return {
    name: r.name,
    description: r.description || '',
    everyNthPurchase: num(r.everyNthPurchase),
    minCartTotal: num(r.minCartTotal),
    minItemCount: num(r.minItemCount),
    minTotalSpent: num(r.minTotalSpent),
    minTotalPurchases: num(r.minTotalPurchases),
    windowDays: num(r.windowDays),
    rewardType: r.rewardType,
    rewardValue: num(r.rewardValue),
    priority: String(r.priority ?? 0),
    isActive: r.isActive,
    startsAt: dt(r.startsAt),
    endsAt: dt(r.endsAt),
  };
}

function formToPayload(f: FormState) {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    everyNthPurchase: num(f.everyNthPurchase),
    minCartTotal: num(f.minCartTotal),
    minItemCount: num(f.minItemCount),
    minTotalSpent: num(f.minTotalSpent),
    minTotalPurchases: num(f.minTotalPurchases),
    windowDays: num(f.windowDays),
    rewardType: f.rewardType,
    rewardValue: Number(f.rewardValue),
    priority: parseInt(f.priority, 10) || 0,
    isActive: f.isActive,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
  };
}

function ruleSummary(r: Rule): string {
  const parts: string[] = [];
  if (r.everyNthPurchase) parts.push(`tous les ${r.everyNthPurchase}e achats`);
  if (r.minCartTotal) parts.push(`panier ≥ ${r.minCartTotal}`);
  if (r.minItemCount) parts.push(`articles ≥ ${r.minItemCount}`);
  if (r.minTotalPurchases) parts.push(`achats cumulés ≥ ${r.minTotalPurchases}`);
  if (r.minTotalSpent) parts.push(`dépensé cumulé ≥ ${r.minTotalSpent}`);
  if (r.windowDays) parts.push(`fenêtre ${r.windowDays}j`);
  return parts.length ? parts.join(' · ') : 'aucune condition (toujours actif)';
}

export default function LoyaltyRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/loyalty-rules?includeInactive=true');
      if (!res.ok) throw new Error('Chargement impossible');
      const data = await res.json();
      setRules(data.data || []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }

  function startEdit(r: Rule) {
    setForm(ruleToForm(r));
    setEditing(r);
    setCreating(true);
  }

  function cancelEdit() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({ type: 'error', message: 'Nom requis' });
      return;
    }
    if (!form.rewardValue || Number(form.rewardValue) <= 0) {
      setFeedback({ type: 'error', message: 'Valeur de récompense > 0 requise' });
      return;
    }

    try {
      setSaving(true);
      const payload = formToPayload(form);
      const url = editing
        ? `/api/admin/loyalty-rules/${editing.id}`
        : '/api/admin/loyalty-rules';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      setFeedback({
        type: 'success',
        message: editing ? 'Règle mise à jour' : 'Règle créée',
      });
      cancelEdit();
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: Rule) {
    try {
      const res = await fetch(`/api/admin/loyalty-rules/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      if (!res.ok) throw new Error('Erreur');
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleDelete(r: Rule) {
    if (!confirm(`Supprimer la règle "${r.name}" ?`)) return;
    try {
      const res = await fetch(`/api/admin/loyalty-rules/${r.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erreur');
      setFeedback({ type: 'success', message: 'Règle supprimée' });
      await load();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_VIEW}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Award className="h-8 w-8 text-amber-600" />
              Programme de fidélisation
            </h1>
            <p className="text-gray-600">
              Règles paramétriques évaluées à chaque vente
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/settings')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            {!creating && (
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle règle
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            className={`mb-6 px-4 py-3 rounded-md border ${
              feedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex justify-between items-start">
              <span>{feedback.message}</span>
              <button onClick={() => setFeedback(null)}>
                <X className="w-4 h-4 opacity-60" />
              </button>
            </div>
          </div>
        )}

        {creating && (
          <Card className="mb-6 border-blue-200">
            <CardHeader>
              <CardTitle>{editing ? 'Modifier la règle' : 'Nouvelle règle'}</CardTitle>
              <CardDescription>
                Tous les champs de condition sont optionnels — laissez vide pour ne pas appliquer ce
                critère. Si plusieurs conditions, elles s'appliquent en ET.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder='Ex: "Fidélité 5e achat", "Promo grand panier"'
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priorité
                    </label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">Plus grand = prioritaire</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Description courte"
                  />
                </div>

                <fieldset className="border rounded-lg p-4 border-gray-200">
                  <legend className="text-sm font-semibold text-gray-700 px-2">
                    Conditions (toutes optionnelles)
                  </legend>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tous les N achats du client
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.everyNthPurchase}
                        onChange={(e) =>
                          setForm({ ...form, everyNthPurchase: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: 5 (déclenche au 5e, 10e, 15e...)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fenêtre temporelle (jours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.windowDays}
                        onChange={(e) => setForm({ ...form, windowDays: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: 30 (le mois écoulé)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Vide = sur toute la vie du client
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Panier minimum
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.minCartTotal}
                        onChange={(e) => setForm({ ...form, minCartTotal: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: 10000 (XOF)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Articles minimum
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.minItemCount}
                        onChange={(e) => setForm({ ...form, minItemCount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: 3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Achats cumulés ≥
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={form.minTotalPurchases}
                        onChange={(e) =>
                          setForm({ ...form, minTotalPurchases: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: 10 (sur la fenêtre si définie)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total dépensé ≥
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.minTotalSpent}
                        onChange={(e) => setForm({ ...form, minTotalSpent: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="ex: 100000"
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="border rounded-lg p-4 border-gray-200">
                  <legend className="text-sm font-semibold text-gray-700 px-2">
                    Récompense
                  </legend>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={form.rewardType}
                        onChange={(e) =>
                          setForm({ ...form, rewardType: e.target.value as any })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="percentage">Pourcentage (%)</option>
                        <option value="fixed_amount">Montant fixe (XOF)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valeur <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.rewardValue}
                        onChange={(e) => setForm({ ...form, rewardValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder={form.rewardType === 'percentage' ? 'ex: 30' : 'ex: 5000'}
                      />
                    </div>
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Début (optionnel)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fin (optionnel)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Règle active</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {editing ? 'Enregistrer' : 'Créer'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Règles existantes</CardTitle>
            <CardDescription>
              {rules.filter((r) => r.isActive).length} active(s) / {rules.length} au total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : rules.length === 0 ? (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Aucune règle. Créez la première.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <div key={r.id} className="py-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p
                          className={`font-semibold ${
                            r.isActive ? 'text-gray-900' : 'text-gray-400 line-through'
                          }`}
                        >
                          {r.name}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                          {r.rewardType === 'percentage'
                            ? `-${r.rewardValue}%`
                            : `-${r.rewardValue} XOF`}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          priorité {r.priority}
                        </span>
                        {!r.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-sm text-gray-600 mb-1">{r.description}</p>
                      )}
                      <p className="text-xs text-gray-500 font-mono">{ruleSummary(r)}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                        Modifier
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>
                        {r.isActive ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(r)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
