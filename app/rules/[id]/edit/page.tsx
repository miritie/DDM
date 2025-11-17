'use client';

/**
 * Page - Édition d'une Règle
 * Mobile-First - Formulaire de modification de règle existante
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  Settings,
  FileText,
  Filter,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

interface DecisionRule {
  RuleId: string;
  Name: string;
  Description: string;
  DecisionType: string;
  Conditions: RuleCondition[];
  RecommendedAction: {
    action: 'approve' | 'reject' | 'escalate';
    reason?: string;
    escalateTo?: string;
  };
  AutoExecute: boolean;
  RequiresApproval: boolean;
  Priority: number;
  NotifyOnMatch: boolean;
  NotifyRoles: string[];
  Status: 'active' | 'inactive';
}

const DECISION_TYPES = [
  { value: 'expense_approval', label: 'Approbation Dépense', icon: '💰' },
  { value: 'purchase_order', label: "Bon d'Achat", icon: '🛒' },
  { value: 'production_order', label: 'Ordre de Production', icon: '🏭' },
  { value: 'stock_replenishment', label: 'Réapprovisionnement', icon: '📦' },
  { value: 'price_adjustment', label: 'Ajustement Prix', icon: '💵' },
  { value: 'credit_approval', label: 'Crédit Client', icon: '🏦' },
];

const OPERATORS = [
  { value: 'equals', label: 'Égal à (=)' },
  { value: 'not_equals', label: 'Différent de (≠)' },
  { value: 'greater_than', label: 'Supérieur à (>)' },
  { value: 'less_than', label: 'Inférieur à (<)' },
  { value: 'greater_or_equal', label: 'Supérieur ou égal (≥)' },
  { value: 'less_or_equal', label: 'Inférieur ou égal (≤)' },
  { value: 'contains', label: 'Contient' },
  { value: 'not_contains', label: 'Ne contient pas' },
  { value: 'between', label: 'Entre' },
];

export default function EditRulePage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Données de la règle
  const [rule, setRule] = useState<DecisionRule | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [decisionType, setDecisionType] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [action, setAction] = useState<'approve' | 'reject' | 'escalate'>('approve');
  const [actionReason, setActionReason] = useState('');
  const [autoExecute, setAutoExecute] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [notifyOnMatch, setNotifyOnMatch] = useState(false);
  const [priority, setPriority] = useState(50);

  // Charger la règle
  useEffect(() => {
    loadRule();
  }, [ruleId]);

  const loadRule = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/rules/${ruleId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      const loadedRule = data.data;
      setRule(loadedRule);
      setName(loadedRule.Name);
      setDescription(loadedRule.Description || '');
      setDecisionType(loadedRule.DecisionType);
      setConditions(loadedRule.Conditions);
      setAction(loadedRule.RecommendedAction.action);
      setActionReason(loadedRule.RecommendedAction.reason || '');
      setAutoExecute(loadedRule.AutoExecute);
      setRequiresApproval(loadedRule.RequiresApproval);
      setNotifyOnMatch(loadedRule.NotifyOnMatch);
      setPriority(loadedRule.Priority);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validation
      if (!name.trim()) {
        throw new Error('Le nom est obligatoire');
      }

      if (conditions.length === 0) {
        throw new Error('Au moins une condition est requise');
      }

      // Préparer les données
      const updates = {
        name: name.trim(),
        description: description.trim(),
        conditions,
        recommendedAction: {
          action,
          reason: actionReason.trim() || undefined,
        },
        autoExecute,
        requiresApproval,
        notifyOnMatch,
        priority,
      };

      // Envoyer la requête
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/rules');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      router.push('/rules');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setDeleting(false);
    }
  };

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        field: '',
        operator: 'equals',
        value: '',
        logicalOperator: conditions.length > 0 ? 'AND' : undefined,
      },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setConditions(
      conditions.map((cond, i) => (i === index ? { ...cond, ...updates } : cond))
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de la règle...</p>
        </div>
      </div>
    );
  }

  if (error && !rule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-800 text-center mb-2">Erreur</h2>
          <p className="text-red-700 text-center mb-4">{error}</p>
          <Button onClick={() => router.push('/rules')} className="w-full">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/rules')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Modifier la Règle</h1>
            <p className="text-sm opacity-90">{rule?.Name}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 mt-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              rule?.Status === 'active'
                ? 'bg-green-500 text-white'
                : 'bg-gray-400 text-white'
            }`}
          >
            {rule?.Status === 'active' ? 'Active' : 'Inactive'}
          </span>
          {rule?.AutoExecute && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
              Auto
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Messages */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800">Erreur</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-green-800">Succès</h3>
              <p className="text-sm text-green-700">Règle mise à jour avec succès</p>
            </div>
          </div>
        )}

        {/* Section 1: Informations de base */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Informations de base</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom de la règle *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="Ex: Approbation auto petites dépenses"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all min-h-[100px]"
                placeholder="Décrivez le but de cette règle..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Type de décision
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DECISION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setDecisionType(type.value)}
                    disabled
                    className={`p-3 rounded-xl border-2 text-left transition-all opacity-50 cursor-not-allowed ${
                      decisionType === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{type.icon}</div>
                    <p className="text-xs font-semibold text-gray-800">{type.label}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Le type de décision ne peut pas être modifié après création
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Conditions */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">Conditions</h2>
            </div>
            <Button onClick={addCondition} size="sm" variant="outline">
              + Ajouter
            </Button>
          </div>

          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={index} className="space-y-2">
                {index > 0 && (
                  <select
                    value={condition.logicalOperator}
                    onChange={(e) =>
                      updateCondition(index, {
                        logicalOperator: e.target.value as 'AND' | 'OR',
                      })
                    }
                    className="w-24 px-2 py-1 border-2 border-gray-300 rounded-lg bg-yellow-50 font-bold text-sm"
                  >
                    <option value="AND">ET</option>
                    <option value="OR">OU</option>
                  </select>
                )}

                <div className="bg-gray-50 rounded-xl p-3 border-2 border-gray-200">
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      placeholder="Champ (ex: amount, quantity)"
                    />

                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                      placeholder="Valeur"
                    />

                    <Button
                      onClick={() => removeCondition(index)}
                      variant="outline"
                      size="sm"
                      className="w-full border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {conditions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Filter className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune condition définie</p>
                <Button onClick={addCondition} variant="outline" size="sm" className="mt-3">
                  + Ajouter une condition
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Action */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Action recommandée</h2>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => setAction('approve')}
              className={`p-4 rounded-xl border-2 transition-all ${
                action === 'approve'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <div className="text-3xl mb-2">✅</div>
              <p className="text-xs font-bold">Approuver</p>
            </button>

            <button
              onClick={() => setAction('reject')}
              className={`p-4 rounded-xl border-2 transition-all ${
                action === 'reject'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <div className="text-3xl mb-2">❌</div>
              <p className="text-xs font-bold">Rejeter</p>
            </button>

            <button
              onClick={() => setAction('escalate')}
              className={`p-4 rounded-xl border-2 transition-all ${
                action === 'escalate'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <div className="text-3xl mb-2">⬆️</div>
              <p className="text-xs font-bold">Escalader</p>
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Raison (optionnel)
            </label>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl"
              placeholder="Ex: Montant sous le seuil autorisé"
            />
          </div>
        </div>

        {/* Section 4: Paramètres */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Paramètres</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-200 cursor-pointer">
              <div>
                <p className="font-semibold text-gray-900">Exécution automatique</p>
                <p className="text-xs text-gray-600">
                  Appliquer l'action sans intervention humaine
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoExecute}
                onChange={(e) => setAutoExecute(e.target.checked)}
                className="w-6 h-6 accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-200 cursor-pointer">
              <div>
                <p className="font-semibold text-gray-900">Requiert approbation</p>
                <p className="text-xs text-gray-600">
                  Un manager doit valider avant exécution
                </p>
              </div>
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-6 h-6 accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border-2 border-gray-200 cursor-pointer">
              <div>
                <p className="font-semibold text-gray-900">Notifications</p>
                <p className="text-xs text-gray-600">
                  Notifier quand cette règle correspond
                </p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnMatch}
                onChange={(e) => setNotifyOnMatch(e.target.checked)}
                className="w-6 h-6 accent-blue-600"
              />
            </label>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Priorité: {priority}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Basse</span>
                <span>Moyenne</span>
                <span>Haute</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleSave}
            disabled={saving || success}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="w-6 h-6 mr-2" />
                Sauvegardé
              </>
            ) : (
              <>
                <Save className="w-6 h-6 mr-2" />
                Sauvegarder
              </>
            )}
          </Button>

          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="outline"
            className="w-full h-14 text-lg font-bold border-2 border-red-300 text-red-600 hover:bg-red-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="w-6 h-6 mr-2" />
                Supprimer cette règle
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
