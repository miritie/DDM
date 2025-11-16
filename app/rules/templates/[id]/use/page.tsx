/**
 * Page - Utiliser un Template
 * Mobile-First - Création de règle depuis un template
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Lightbulb,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RuleTemplate {
  TemplateId: string;
  Name: string;
  Description: string;
  Category: string;
  DecisionType: string;
  ConditionTemplate: Array<{
    field: string;
    fieldLabel: string;
    fieldType: 'number' | 'text' | 'date';
    operator: string;
    operatorLabel: string;
    defaultValue?: any;
    placeholder?: string;
  }>;
  ActionTemplate: {
    action: 'approve' | 'reject' | 'escalate';
    reason?: string;
  };
  EstimatedTimeSaving: string;
}

export default function UseTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [template, setTemplate] = useState<RuleTemplate | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [conditionValues, setConditionValues] = useState<Record<string, any>>({});
  const [autoExecute, setAutoExecute] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [priority, setPriority] = useState(50);

  // Charger le template
  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/rules/templates');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      const foundTemplate = data.data.all.find(
        (t: RuleTemplate) => t.TemplateId === templateId
      );

      if (!foundTemplate) {
        throw new Error('Template non trouvé');
      }

      setTemplate(foundTemplate);
      setRuleName(foundTemplate.Name);
      setRuleDescription(foundTemplate.Description);

      // Initialiser les valeurs par défaut
      const initialValues: Record<string, any> = {};
      foundTemplate.ConditionTemplate.forEach((cond) => {
        initialValues[cond.field] = cond.defaultValue || '';
      });
      setConditionValues(initialValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      setSuccess(false);

      // Validation
      if (!ruleName.trim()) {
        throw new Error('Le nom de la règle est obligatoire');
      }

      // Vérifier que toutes les conditions ont une valeur
      const missingValues = template?.ConditionTemplate.filter(
        (cond) => !conditionValues[cond.field] && conditionValues[cond.field] !== 0
      );

      if (missingValues && missingValues.length > 0) {
        throw new Error(
          `Veuillez remplir toutes les conditions: ${missingValues.map((c) => c.fieldLabel).join(', ')}`
        );
      }

      // Créer la règle
      const response = await fetch(`/api/rules/templates/${templateId}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName.trim(),
          description: ruleDescription.trim(),
          conditionValues,
          autoExecute,
          requiresApproval,
          priority,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/rules');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const updateConditionValue = (field: string, value: any) => {
    setConditionValues({
      ...conditionValues,
      [field]: value,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du template...</p>
        </div>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-800 text-center mb-2">Erreur</h2>
          <p className="text-red-700 text-center mb-4">{error}</p>
          <Button onClick={() => router.push('/rules/templates')} className="w-full">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.push('/rules/templates')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Créer depuis Template</h1>
            <p className="text-sm opacity-90">{template.Name}</p>
          </div>
          <Lightbulb className="w-8 h-8" />
        </div>

        {/* Info gain de temps */}
        <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mt-3">
          <p className="text-xs opacity-90 mb-1">Gain de temps estimé</p>
          <p className="font-bold text-lg">{template.EstimatedTimeSaving}</p>
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
              <p className="text-sm text-green-700">Règle créée avec succès</p>
            </div>
          </div>
        )}

        {/* Section 1: Informations de base */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <h2 className="font-bold text-gray-900 mb-4">Informations de base</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom de la règle *
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder={template.Name}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all min-h-[100px]"
                placeholder={template.Description}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Configuration des conditions */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <h2 className="font-bold text-gray-900 mb-4">Configuration des Conditions</h2>

          <div className="space-y-4">
            {template.ConditionTemplate.map((cond, idx) => (
              <div
                key={cond.field}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200"
              >
                <div className="flex items-start gap-2 mb-3">
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{cond.fieldLabel}</p>
                    <p className="text-sm text-gray-600">{cond.operatorLabel}</p>
                  </div>
                </div>

                {cond.fieldType === 'number' ? (
                  <input
                    type="number"
                    value={conditionValues[cond.field] || ''}
                    onChange={(e) =>
                      updateConditionValue(cond.field, parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-4 py-4 text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder={cond.placeholder || '0'}
                  />
                ) : cond.fieldType === 'date' ? (
                  <input
                    type="date"
                    value={conditionValues[cond.field] || ''}
                    onChange={(e) => updateConditionValue(cond.field, e.target.value)}
                    className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                ) : (
                  <input
                    type="text"
                    value={conditionValues[cond.field] || ''}
                    onChange={(e) => updateConditionValue(cond.field, e.target.value)}
                    className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder={cond.placeholder || ''}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Action recommandée (preview) */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <h2 className="font-bold text-gray-900 mb-4">Action Recommandée</h2>

          <div
            className={`p-4 rounded-xl border-2 ${
              template.ActionTemplate.action === 'approve'
                ? 'bg-green-50 border-green-200'
                : template.ActionTemplate.action === 'reject'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-orange-50 border-orange-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              {template.ActionTemplate.action === 'approve' && (
                <>
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <span className="text-lg font-bold text-green-700">Approuver</span>
                </>
              )}
              {template.ActionTemplate.action === 'reject' && (
                <>
                  <AlertCircle className="w-6 h-6 text-red-600" />
                  <span className="text-lg font-bold text-red-700">Rejeter</span>
                </>
              )}
              {template.ActionTemplate.action === 'escalate' && (
                <>
                  <Lightbulb className="w-6 h-6 text-orange-600" />
                  <span className="text-lg font-bold text-orange-700">Escalader</span>
                </>
              )}
            </div>
            {template.ActionTemplate.reason && (
              <p className="text-sm text-gray-700">{template.ActionTemplate.reason}</p>
            )}
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

        {/* Bouton créer */}
        <Button
          onClick={handleCreate}
          disabled={creating || success}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90"
        >
          {creating ? (
            <>
              <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              Création...
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="w-6 h-6 mr-2" />
              Créée
            </>
          ) : (
            <>
              <Save className="w-6 h-6 mr-2" />
              Créer la Règle
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
