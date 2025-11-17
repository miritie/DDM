'use client';

/**
 * Page - Templates de Règles
 * Mobile-First - Bibliothèque de templates prêts à l'emploi
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Lightbulb,
  Loader2,
  AlertCircle,
  Search,
  FileText,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RuleTemplate {
  TemplateId: string;
  Name: string;
  Description: string;
  Category: 'expense' | 'purchase' | 'production' | 'stock' | 'pricing' | 'credit' | 'custom';
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
  UsageCount: number;
}

const CATEGORY_CONFIG = {
  expense: {
    label: 'Dépenses',
    icon: '💰',
    gradient: 'from-green-500 to-emerald-600',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  purchase: {
    label: 'Achats',
    icon: '🛒',
    gradient: 'from-blue-500 to-cyan-600',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  production: {
    label: 'Production',
    icon: '🏭',
    gradient: 'from-orange-500 to-red-600',
    bgLight: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  stock: {
    label: 'Stock',
    icon: '📦',
    gradient: 'from-purple-500 to-pink-600',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  pricing: {
    label: 'Prix',
    icon: '💵',
    gradient: 'from-yellow-500 to-orange-600',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  credit: {
    label: 'Crédit',
    icon: '🏦',
    gradient: 'from-indigo-500 to-blue-600',
    bgLight: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  custom: {
    label: 'Personnalisé',
    icon: '⚙️',
    gradient: 'from-gray-500 to-slate-600',
    bgLight: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

export default function RuleTemplatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<RuleTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Charger les templates
  useEffect(() => {
    loadTemplates();
  }, []);

  // Filtrer les templates
  useEffect(() => {
    let filtered = templates;

    // Filtre par catégorie
    if (selectedCategory) {
      filtered = filtered.filter((t) => t.Category === selectedCategory);
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.Name.toLowerCase().includes(query) ||
          t.Description.toLowerCase().includes(query)
      );
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/rules/templates');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      setTemplates(data.data.all);
      setFilteredTemplates(data.data.all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template: RuleTemplate) => {
    // Rediriger vers la création avec le template ID
    router.push(`/rules/templates/${template.TemplateId}/use`);
  };

  // Compter templates par catégorie
  const categoryCounts = templates.reduce(
    (acc, template) => {
      acc[template.Category] = (acc[template.Category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement des templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.push('/rules')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Templates de Règles</h1>
            <p className="text-sm opacity-90">
              {filteredTemplates.length} template{filteredTemplates.length > 1 ? 's' : ''}{' '}
              disponible{filteredTemplates.length > 1 ? 's' : ''}
            </p>
          </div>
          <Lightbulb className="w-8 h-8" />
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un template..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-white/30 bg-white/20 text-white placeholder-white/70 focus:bg-white/30 focus:outline-none transition-all"
          />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800">Erreur</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Filtres par catégorie */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-3">Catégories</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous ({templates.length})
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
              const count = categoryCounts[category] || 0;
              if (count === 0) return null;

              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                    selectedCategory === category
                      ? `bg-gradient-to-r ${config.gradient} text-white`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{config.icon}</span>
                  <span>
                    {config.label} ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Liste des templates */}
        {filteredTemplates.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Aucun template trouvé</p>
            <p className="text-sm text-gray-500 mt-1">
              Essayez de modifier vos critères de recherche
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map((template) => {
              const config = CATEGORY_CONFIG[template.Category];

              return (
                <div
                  key={template.TemplateId}
                  className={`${config.bgLight} border-2 ${config.borderColor} rounded-2xl shadow-md overflow-hidden`}
                >
                  {/* Header du template */}
                  <div className={`bg-gradient-to-r ${config.gradient} text-white p-4`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2">
                        <div className="text-2xl">{config.icon}</div>
                        <div>
                          <h3 className="font-bold text-lg">{template.Name}</h3>
                          <p className="text-sm opacity-90">{template.Description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                        {config.label}
                      </span>
                      {template.UsageCount > 0 && (
                        <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold">
                          Utilisé {template.UsageCount}x
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corps du template */}
                  <div className="p-4 space-y-3">
                    {/* Gain de temps estimé */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Gain de temps estimé</p>
                      <p className="font-bold text-blue-600 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        {template.EstimatedTimeSaving}
                      </p>
                    </div>

                    {/* Aperçu des conditions */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Conditions à configurer:
                      </p>
                      <ul className="space-y-1">
                        {template.ConditionTemplate.map((cond, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>
                              <span className="font-semibold">{cond.fieldLabel}</span>{' '}
                              {cond.operatorLabel}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action recommandée */}
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Action par défaut:
                      </p>
                      <div className="flex items-center gap-2">
                        {template.ActionTemplate.action === 'approve' && (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-bold text-green-700">Approuver</span>
                          </>
                        )}
                        {template.ActionTemplate.action === 'reject' && (
                          <>
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <span className="text-sm font-bold text-red-700">Rejeter</span>
                          </>
                        )}
                        {template.ActionTemplate.action === 'escalate' && (
                          <>
                            <FileText className="w-5 h-5 text-orange-600" />
                            <span className="text-sm font-bold text-orange-700">Escalader</span>
                          </>
                        )}
                      </div>
                      {template.ActionTemplate.reason && (
                        <p className="text-xs text-gray-600 mt-1">
                          {template.ActionTemplate.reason}
                        </p>
                      )}
                    </div>

                    {/* Bouton utiliser */}
                    <Button
                      onClick={() => handleUseTemplate(template)}
                      className={`w-full h-12 font-bold bg-gradient-to-r ${config.gradient} hover:opacity-90`}
                    >
                      <Lightbulb className="w-5 h-5 mr-2" />
                      Utiliser ce Template
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
