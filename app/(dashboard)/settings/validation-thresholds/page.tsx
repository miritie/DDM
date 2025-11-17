'use client';

/**
 * Page - Configuration des Seuils de Validation
 * Interface mobile-first pour gérer les seuils par type d'entité
 */

import { useState, useEffect } from 'react';
import { ValidationThreshold, ValidatableEntityType } from '@/lib/modules/governance/validation-workflow-service';

export default function ValidationThresholdsPage() {
  const [thresholds, setThresholds] = useState<ValidationThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // TODO: Récupérer depuis session/auth
  const workspaceId = 'default';

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/validations/thresholds?workspaceId=${workspaceId}`);
      const result = await response.json();

      if (result.success) {
        setThresholds(result.data);
      }
    } catch (error) {
      console.error('Erreur chargement seuils:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (thresholdId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette configuration ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/validations/thresholds/${thresholdId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        loadThresholds();
      } else {
        alert(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const entityTypes: { value: ValidatableEntityType; label: string }[] = [
    { value: 'expense', label: 'Dépenses' },
    { value: 'purchase_order', label: 'Commandes' },
    { value: 'production_order', label: 'Production' },
    { value: 'advance', label: 'Avances' },
    { value: 'debt', label: 'Dettes' },
    { value: 'leave', label: 'Congés' },
    { value: 'transfer', label: 'Transferts' },
    { value: 'price_adjustment', label: 'Ajustements prix' },
    { value: 'credit_approval', label: 'Crédits' },
  ];

  const getEntityTypeLabel = (entityType: string) => {
    return entityTypes.find((t) => t.value === entityType)?.label || entityType;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Seuils de validation</h1>
          <p className="text-sm text-gray-500 mt-1">Configuration par type d'entité</p>
        </div>
      </div>

      {/* Bouton Créer */}
      <div className="px-4 py-4">
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span>
          Nouveau seuil
        </button>
      </div>

      {/* Liste des seuils */}
      <div className="px-4 space-y-3">
        {thresholds.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">Aucun seuil configuré</p>
          </div>
        ) : (
          thresholds.map((threshold) => (
            <ThresholdCard
              key={threshold.ThresholdId}
              threshold={threshold}
              getEntityTypeLabel={getEntityTypeLabel}
              onEdit={() => setEditingId(threshold.ThresholdId)}
              onDelete={() => handleDelete(threshold.ThresholdId)}
              isEditing={editingId === threshold.ThresholdId}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={() => {
                setEditingId(null);
                loadThresholds();
              }}
            />
          ))
        )}
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <ThresholdForm
          workspaceId={workspaceId}
          entityTypes={entityTypes}
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            loadThresholds();
          }}
        />
      )}
    </div>
  );
}

// Card Seuil
function ThresholdCard({
  threshold,
  getEntityTypeLabel,
  onEdit,
  onDelete,
  isEditing,
  onCancelEdit,
  onSaveEdit,
}: {
  threshold: ValidationThreshold;
  getEntityTypeLabel: (entityType: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}) {
  const [formData, setFormData] = useState({
    level1Threshold: threshold.Level1Threshold,
    level2Threshold: threshold.Level2Threshold,
    level3Threshold: threshold.Level3Threshold,
    autoApproveBelow: threshold.AutoApproveBelow,
    requireAllLevels: threshold.RequireAllLevels,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/validations/thresholds/${threshold.ThresholdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        onSaveEdit();
      } else {
        alert(result.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-blue-300 p-4">
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-gray-900">
            {getEntityTypeLabel(threshold.EntityType)}
          </h3>
          {threshold.Category && (
            <p className="text-sm text-gray-500">Catégorie: {threshold.Category}</p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Auto-approbation (FCFA)
            </label>
            <input
              type="number"
              value={formData.autoApproveBelow}
              onChange={(e) =>
                setFormData({ ...formData, autoApproveBelow: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Niveau 1 - Manager (FCFA)
            </label>
            <input
              type="number"
              value={formData.level1Threshold}
              onChange={(e) =>
                setFormData({ ...formData, level1Threshold: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Niveau 2 - Directeur (FCFA)
            </label>
            <input
              type="number"
              value={formData.level2Threshold}
              onChange={(e) =>
                setFormData({ ...formData, level2Threshold: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Niveau 3 - DG (FCFA)
            </label>
            <input
              type="number"
              value={formData.level3Threshold}
              onChange={(e) =>
                setFormData({ ...formData, level3Threshold: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id={`require-all-${threshold.ThresholdId}`}
              checked={formData.requireAllLevels}
              onChange={(e) =>
                setFormData({ ...formData, requireAllLevels: e.target.checked })
              }
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor={`require-all-${threshold.ThresholdId}`}
              className="ml-2 text-sm text-gray-700"
            >
              Requérir tous les niveaux
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={onCancelEdit}
              className="py-3 bg-gray-100 text-gray-700 rounded-lg font-medium active:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">
            {getEntityTypeLabel(threshold.EntityType)}
          </h3>
          {threshold.Category && (
            <p className="text-sm text-gray-500">Catégorie: {threshold.Category}</p>
          )}
        </div>
      </div>

      {/* Seuils */}
      <div className="space-y-2 mb-4">
        {threshold.AutoApproveBelow > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Auto-approbation</span>
            <span className="font-medium text-gray-900">
              {'< '}{threshold.AutoApproveBelow.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Niveau 1 (Manager)</span>
          <span className="font-medium text-gray-900">
            {'< '}{threshold.Level1Threshold.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Niveau 2 (Directeur)</span>
          <span className="font-medium text-gray-900">
            {'< '}{threshold.Level2Threshold.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Niveau 3 (DG)</span>
          <span className="font-medium text-gray-900">
            {'< '}{threshold.Level3Threshold.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Au-dessus</span>
          <span className="font-medium text-gray-900">Propriétaire</span>
        </div>

        {threshold.RequireAllLevels && (
          <div className="pt-2 border-t border-gray-100">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Tous les niveaux requis
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onEdit}
          className="py-2 bg-blue-50 text-blue-600 rounded-lg font-medium active:bg-blue-100"
        >
          Modifier
        </button>
        <button
          onClick={onDelete}
          className="py-2 bg-red-50 text-red-600 rounded-lg font-medium active:bg-red-100"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

// Formulaire de création
function ThresholdForm({
  workspaceId,
  entityTypes,
  onClose,
  onSuccess,
}: {
  workspaceId: string;
  entityTypes: { value: ValidatableEntityType; label: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    entityType: '' as ValidatableEntityType | '',
    category: '',
    level1Threshold: 50000,
    level2Threshold: 200000,
    level3Threshold: 1000000,
    autoApproveBelow: 10000,
    requireAllLevels: false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.entityType) {
      alert('Veuillez sélectionner un type d\'entité');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch('/api/validations/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          ...formData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
      } else {
        alert(result.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur création:', error);
      alert('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Nouveau seuil</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type d'entité *
            </label>
            <select
              value={formData.entityType}
              onChange={(e) =>
                setFormData({ ...formData, entityType: e.target.value as ValidatableEntityType })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Sélectionner...</option>
              {entityTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie (optionnel)
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="ex: Fournitures, Transport, etc."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Auto-approbation (FCFA)
            </label>
            <input
              type="number"
              value={formData.autoApproveBelow}
              onChange={(e) =>
                setFormData({ ...formData, autoApproveBelow: Number(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Niveau 1 - Manager (FCFA) *
            </label>
            <input
              type="number"
              value={formData.level1Threshold}
              onChange={(e) =>
                setFormData({ ...formData, level1Threshold: Number(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Niveau 2 - Directeur (FCFA) *
            </label>
            <input
              type="number"
              value={formData.level2Threshold}
              onChange={(e) =>
                setFormData({ ...formData, level2Threshold: Number(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Niveau 3 - DG (FCFA) *
            </label>
            <input
              type="number"
              value={formData.level3Threshold}
              onChange={(e) =>
                setFormData({ ...formData, level3Threshold: Number(e.target.value) })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="require-all-new"
              checked={formData.requireAllLevels}
              onChange={(e) =>
                setFormData({ ...formData, requireAllLevels: e.target.checked })
              }
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="require-all-new" className="ml-2 text-sm text-gray-700">
              Requérir tous les niveaux de validation
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="py-3 bg-gray-100 text-gray-700 rounded-lg font-medium active:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
