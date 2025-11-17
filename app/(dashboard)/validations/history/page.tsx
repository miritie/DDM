'use client';

/**
 * Page - Journal des Validations
 * Historique complet avec traçabilité et géolocalisation
 */

import { useState, useEffect } from 'react';
import { ValidationRequest, Validation, ValidatableEntityType } from '@/lib/modules/governance/validation-workflow-service';

export default function ValidationHistoryPage() {
  const [history, setHistory] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [entityType, setEntityType] = useState<ValidatableEntityType | ''>('');
  const [entityId, setEntityId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!entityType || !entityId) {
      alert('Veuillez sélectionner un type et saisir un ID');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/validations/history?entityType=${entityType}&entityId=${entityId}`
      );
      const result = await response.json();

      if (result.success) {
        setHistory(result.data);
      } else {
        alert(result.error || 'Erreur lors de la recherche');
      }
    } catch (error) {
      console.error('Erreur recherche historique:', error);
      alert('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const entityTypes: { value: ValidatableEntityType; label: string }[] = [
    { value: 'expense', label: 'Dépense' },
    { value: 'purchase_order', label: 'Commande' },
    { value: 'production_order', label: 'Production' },
    { value: 'advance', label: 'Avance' },
    { value: 'debt', label: 'Dette' },
    { value: 'leave', label: 'Congé' },
    { value: 'transfer', label: 'Transfert' },
    { value: 'price_adjustment', label: 'Ajustement prix' },
    { value: 'credit_approval', label: 'Crédit' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Journal des validations</h1>
          <p className="text-sm text-gray-500 mt-1">Historique et traçabilité complète</p>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <div className="bg-white border-b px-4 py-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type d'entité
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as ValidatableEntityType)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            ID de l'entité
          </label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="ex: 123e4567-e89b-12d3-a456-426614174000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !entityType || !entityId}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>

      {/* Résultats */}
      <div className="px-4 py-4">
        {history.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {loading ? 'Chargement...' : 'Aucun historique trouvé'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {history.length} demande{history.length > 1 ? 's' : ''} trouvée{history.length > 1 ? 's' : ''}
            </p>

            {history.map((request) => (
              <HistoryCard
                key={request.ValidationRequestId}
                request={request}
                expanded={expandedId === request.ValidationRequestId}
                onToggle={() =>
                  setExpandedId(
                    expandedId === request.ValidationRequestId
                      ? null
                      : request.ValidationRequestId
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Card Historique
function HistoryCard({
  request,
  expanded,
  onToggle,
}: {
  request: ValidationRequest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'escalated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'auto_approved':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      approved: 'Approuvée',
      rejected: 'Rejetée',
      pending: 'En attente',
      escalated: 'Escaladée',
      auto_approved: 'Auto-approuvée',
    };
    return labels[status] || status;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header cliquable */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 text-left active:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.Status)}`}>
                {getStatusLabel(request.Status)}
              </span>
              <span className="text-xs text-gray-500">
                {request.Priority.toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {new Date(request.RequestedAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {request.Validations.length} validation{request.Validations.length > 1 ? 's' : ''}
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Détails expandables */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Informations générales */}
          <div className="py-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-gray-500">Demandeur</p>
              <p className="text-sm text-gray-900">{request.RequestedBy}</p>
            </div>

            {request.Amount !== undefined && (
              <div>
                <p className="text-xs font-medium text-gray-500">Montant</p>
                <p className="text-lg font-bold text-gray-900">
                  {request.Amount.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            )}

            {request.RequestReason && (
              <div>
                <p className="text-xs font-medium text-gray-500">Raison</p>
                <p className="text-sm text-gray-900 italic">"{request.RequestReason}"</p>
              </div>
            )}

            <div className="flex gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Niveau actuel</p>
                <p className="text-sm text-gray-900">{request.CurrentLevel.replace('level_', 'Niveau ')}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Niveau requis</p>
                <p className="text-sm text-gray-900">{request.RequiredLevel.replace('level_', 'Niveau ')}</p>
              </div>
            </div>
          </div>

          {/* Validations */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-900 mb-3">
              Traçabilité ({request.Validations.length})
            </p>

            <div className="space-y-3">
              {request.Validations.map((validation, index) => (
                <ValidationTrace key={validation.ValidationId} validation={validation} index={index} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Trace de Validation
function ValidationTrace({ validation, index }: { validation: Validation; index: number }) {
  const [showDetails, setShowDetails] = useState(false);

  const getValidationIcon = (status: string) => {
    return status === 'approved' ? '✓' : '✗';
  };

  const getValidationColor = (status: string) => {
    return status === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  return (
    <div className={`rounded-lg border p-3 ${getValidationColor(validation.Status)}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
              validation.Status === 'approved' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {getValidationIcon(validation.Status)}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900">{validation.ValidatedBy}</p>
            <p className="text-xs text-gray-500">
              {validation.Level.replace('level_', 'Niveau ')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-blue-600 active:text-blue-700"
        >
          {showDetails ? 'Masquer' : 'Détails'}
        </button>
      </div>

      {/* Date */}
      <p className="text-xs text-gray-600 mb-2">
        {new Date(validation.ValidatedAt).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}{' '}
        à{' '}
        {new Date(validation.ValidatedAt).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      {/* Commentaire */}
      {validation.Comment && (
        <p className="text-sm text-gray-700 italic bg-white bg-opacity-50 p-2 rounded">
          "{validation.Comment}"
        </p>
      )}

      {/* Détails techniques */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-2">
          {/* Géolocalisation */}
          {validation.Geolocation && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">📍 Géolocalisation</p>
              <div className="bg-white bg-opacity-50 p-2 rounded text-xs space-y-1">
                <p>
                  Latitude: {validation.Geolocation.latitude.toFixed(6)}
                </p>
                <p>
                  Longitude: {validation.Geolocation.longitude.toFixed(6)}
                </p>
                {validation.Geolocation.accuracy && (
                  <p>Précision: ±{validation.Geolocation.accuracy.toFixed(0)}m</p>
                )}
                {validation.Geolocation.address && (
                  <p className="text-gray-600">Adresse: {validation.Geolocation.address}</p>
                )}
              </div>
            </div>
          )}

          {/* IP et User Agent */}
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">🔐 Informations techniques</p>
            <div className="bg-white bg-opacity-50 p-2 rounded text-xs space-y-1">
              {validation.IpAddress && <p>IP: {validation.IpAddress}</p>}
              {validation.UserAgent && (
                <p className="truncate">User-Agent: {validation.UserAgent}</p>
              )}
            </div>
          </div>

          {/* Signature */}
          {validation.SignatureData && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">✍️ Signature</p>
              <div className="bg-white bg-opacity-50 p-2 rounded">
                <img
                  src={validation.SignatureData}
                  alt="Signature"
                  className="max-w-full h-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
