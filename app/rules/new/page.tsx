/**
 * Page - Création de Règle Métier
 * Wizard mobile-first en 4 étapes
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  X,
  Zap,
  AlertCircle,
  Settings,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Step = 'basics' | 'conditions' | 'action' | 'settings';

const DECISION_TYPES = [
  { value: 'expense_approval', label: 'Approbation Dépense' },
  { value: 'purchase_order', label: 'Commande Fournisseur' },
  { value: 'production_order', label: 'Ordre de Production' },
  { value: 'stock_replenishment', label: 'Réapprovisionnement' },
  { value: 'price_adjustment', label: 'Ajustement Prix' },
  { value: 'credit_approval', label: 'Crédit Client' },
];

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'greater_than', label: '>' },
  { value: 'greater_than_or_equal', label: '≥' },
  { value: 'less_than', label: '<' },
  { value: 'less_than_or_equal', label: '≤' },
  { value: 'contains', label: 'Contient' },
  { value: 'between', label: 'Entre' },
];

export default function NewRulePage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('basics');
  const [submitting, setSubmitting] = useState(false);

  // Données du formulaire
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [decisionType, setDecisionType] = useState('');

  const [conditions, setConditions] = useState<Array<{
    field: string;
    operator: string;
    value: any;
    logicalOperator: 'AND' | 'OR';
  }>>([{ field: '', operator: 'equals', value: '', logicalOperator: 'AND' }]);

  const [recommendedAction, setRecommendedAction] = useState<'approve' | 'reject' | 'escalate'>('approve');

  const [autoExecute, setAutoExecute] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [priority, setPriority] = useState(100);
  const [notifyOnTrigger, setNotifyOnTrigger] = useState(false);

  const steps: Array<{ key: Step; label: string; icon: any }> = [
    { key: 'basics', label: 'Informations', icon: Target },
    { key: 'conditions', label: 'Conditions', icon: Settings },
    { key: 'action', label: 'Action', icon: Zap },
    { key: 'settings', label: 'Paramètres', icon: Settings },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  function addCondition() {
    setConditions([
      ...conditions,
      { field: '', operator: 'equals', value: '', logicalOperator: 'AND' },
    ]);
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, key: string, value: any) {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [key]: value };
    setConditions(updated);
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);

      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          decisionType,
          triggerType: 'automatic',
          conditions,
          recommendedAction,
          autoExecute,
          requiresApproval,
          priority,
          notifyOnTrigger,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la création');
      }

      router.push('/rules');
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la création de la règle');
    } finally {
      setSubmitting(false);
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 'basics':
        return name.trim().length > 0 && decisionType.length > 0;
      case 'conditions':
        return conditions.every(c => c.field && c.operator && c.value);
      case 'action':
        return recommendedAction.length > 0;
      case 'settings':
        return true;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>

          <h1 className="text-2xl font-bold mb-1">Nouvelle Règle</h1>
          <p className="text-sm opacity-90">Automatisez vos décisions récurrentes</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = s.key === step;
              const isCompleted = idx < currentStepIndex;

              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                      {s.label}
                    </span>
                  </div>

                  {idx < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}`}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Step 1: Basics */}
          {step === 'basics' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Nom de la règle <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Approuver dépenses < 10 000 F"
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Décrivez quand cette règle doit s'appliquer..."
                  className="w-full h-24 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Type de décision <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DECISION_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setDecisionType(type.value)}
                      className={`p-4 rounded-xl border-2 text-left font-medium transition-colors ${
                        decisionType === type.value
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Conditions */}
          {step === 'conditions' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">Conditions de déclenchement</p>
                    <p className="text-sm text-blue-800">
                      La règle s'appliquera uniquement si TOUTES les conditions sont remplies (ET logique).
                    </p>
                  </div>
                </div>
              </div>

              {conditions.map((condition, idx) => (
                <div key={idx} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Condition {idx + 1}</h3>
                    {conditions.length > 1 && (
                      <button
                        onClick={() => removeCondition(idx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Champ</label>
                      <input
                        type="text"
                        value={condition.field}
                        onChange={e => updateCondition(idx, 'field', e.target.value)}
                        placeholder="Ex: Amount"
                        className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Opérateur</label>
                      <select
                        value={condition.operator}
                        onChange={e => updateCondition(idx, 'operator', e.target.value)}
                        className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Valeur</label>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={e => updateCondition(idx, 'value', e.target.value)}
                        placeholder="Ex: 10000"
                        className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {idx < conditions.length - 1 && (
                    <div className="mt-3">
                      <select
                        value={condition.logicalOperator}
                        onChange={e => updateCondition(idx, 'logicalOperator', e.target.value)}
                        className="px-3 py-1 bg-white border-2 border-gray-200 rounded-lg text-sm font-medium"
                      >
                        <option value="AND">ET</option>
                        <option value="OR">OU</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}

              <Button
                onClick={addCondition}
                variant="outline"
                className="w-full h-12 border-2 border-dashed"
              >
                <Plus className="w-5 h-5 mr-2" />
                Ajouter une condition
              </Button>
            </div>
          )}

          {/* Step 3: Action */}
          {step === 'action' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Action recommandée <span className="text-red-600">*</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setRecommendedAction('approve')}
                    className={`p-6 rounded-xl border-2 text-center transition-colors ${
                      recommendedAction === 'approve'
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Check className={`w-12 h-12 mx-auto mb-3 ${
                      recommendedAction === 'approve' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <h3 className="font-bold text-gray-900 mb-1">Approuver</h3>
                    <p className="text-xs text-gray-600">Valider automatiquement la demande</p>
                  </button>

                  <button
                    onClick={() => setRecommendedAction('reject')}
                    className={`p-6 rounded-xl border-2 text-center transition-colors ${
                      recommendedAction === 'reject'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <X className={`w-12 h-12 mx-auto mb-3 ${
                      recommendedAction === 'reject' ? 'text-red-600' : 'text-gray-400'
                    }`} />
                    <h3 className="font-bold text-gray-900 mb-1">Rejeter</h3>
                    <p className="text-xs text-gray-600">Refuser automatiquement la demande</p>
                  </button>

                  <button
                    onClick={() => setRecommendedAction('escalate')}
                    className={`p-6 rounded-xl border-2 text-center transition-colors ${
                      recommendedAction === 'escalate'
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${
                      recommendedAction === 'escalate' ? 'text-orange-600' : 'text-gray-400'
                    }`} />
                    <h3 className="font-bold text-gray-900 mb-1">Escalader</h3>
                    <p className="text-xs text-gray-600">Transférer à un supérieur</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Settings */}
          {step === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Exécution automatique</h3>
                    <p className="text-sm text-gray-600">
                      Appliquer la décision sans intervention humaine
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoExecute(!autoExecute)}
                    className={`w-14 h-8 rounded-full transition-colors relative ${
                      autoExecute ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        autoExecute ? 'transform translate-x-6' : ''
                      }`}
                    ></div>
                  </button>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Approbation requise</h3>
                    <p className="text-sm text-gray-600">
                      Demander validation avant exécution automatique
                    </p>
                  </div>
                  <button
                    onClick={() => setRequiresApproval(!requiresApproval)}
                    className={`w-14 h-8 rounded-full transition-colors relative ${
                      requiresApproval ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        requiresApproval ? 'transform translate-x-6' : ''
                      }`}
                    ></div>
                  </button>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Notifications</h3>
                    <p className="text-sm text-gray-600">
                      Notifier lors du déclenchement de la règle
                    </p>
                  </div>
                  <button
                    onClick={() => setNotifyOnTrigger(!notifyOnTrigger)}
                    className={`w-14 h-8 rounded-full transition-colors relative ${
                      notifyOnTrigger ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                        notifyOnTrigger ? 'transform translate-x-6' : ''
                      }`}
                    ></div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Priorité (1-1000)
                </label>
                <input
                  type="number"
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  min="1"
                  max="1000"
                  className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Plus la priorité est élevée, plus la règle sera évaluée en premier
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {currentStepIndex > 0 && (
              <Button
                onClick={() => setStep(steps[currentStepIndex - 1].key)}
                variant="outline"
                className="flex-1 h-12"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Précédent
              </Button>
            )}

            {currentStepIndex < steps.length - 1 ? (
              <Button
                onClick={() => setStep(steps[currentStepIndex + 1].key)}
                disabled={!canProceed()}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
              >
                Suivant
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !canProceed()}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  'Création...'
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Créer la règle
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
