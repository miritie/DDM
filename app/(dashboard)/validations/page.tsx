/**
 * Page - File de Validation Centralisée
 * Interface mobile-first pour la validation hiérarchique
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ValidationRequest, ValidationStatus, ValidationLevel } from '@/lib/modules/governance/validation-workflow-service';

type FilterStatus = ValidationStatus | 'all';
type FilterPriority = 'low' | 'medium' | 'high' | 'urgent' | 'all';

export default function ValidationsPage() {
  const [validations, setValidations] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // TODO: Récupérer depuis session/auth
  const workspaceId = 'default';
  const validatorId = 'current_user_id';
  const validatorLevel: ValidationLevel = 'level_1';

  useEffect(() => {
    loadValidations();
  }, []);

  const loadValidations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/validations/pending?workspaceId=${workspaceId}&validatorId=${validatorId}&validatorLevel=${validatorLevel}`
      );
      const result = await response.json();

      if (result.success) {
        setValidations(result.data);
      }
    } catch (error) {
      console.error('Erreur chargement validations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (
    validationRequestId: string,
    status: 'approved' | 'rejected',
    comment?: string
  ) => {
    try {
      // Récupérer géolocalisation si disponible
      let geolocation;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          geolocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
        } catch (error) {
          console.log('Géolocalisation non disponible');
        }
      }

      const response = await fetch(`/api/validations/${validationRequestId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validatedBy: validatorId,
          status,
          comment,
          geolocation,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Recharger la liste
        loadValidations();
      } else {
        alert(result.error || 'Erreur lors du traitement');
      }
    } catch (error) {
      console.error('Erreur traitement validation:', error);
      alert('Erreur lors du traitement');
    }
  };

  // Filtrage
  const filteredValidations = validations.filter((v) => {
    if (filterStatus !== 'all' && v.Status !== filterStatus) return false;
    if (filterPriority !== 'all' && v.Priority !== filterPriority) return false;
    if (
      searchQuery &&
      !v.EntityType.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !v.EntityId.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: ValidationStatus) => {
    const colors: Record<ValidationStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      escalated: 'bg-blue-100 text-blue-800',
      auto_approved: 'bg-gray-100 text-gray-800',
    };

    const labels: Record<ValidationStatus, string> = {
      pending: 'En attente',
      approved: 'Approuvée',
      rejected: 'Rejetée',
      escalated: 'Escaladée',
      auto_approved: 'Auto-approuvée',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getEntityTypeLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      expense: 'Dépense',
      purchase_order: 'Commande',
      production_order: 'Production',
      advance: 'Avance',
      debt: 'Dette',
      leave: 'Congé',
      transfer: 'Transfert',
      price_adjustment: 'Ajustement prix',
      credit_approval: 'Crédit',
    };
    return labels[entityType] || entityType;
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
          <h1 className="text-2xl font-bold text-gray-900">À valider</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredValidations.length} demande{filteredValidations.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Filtres */}
        <div className="px-4 pb-4 space-y-3">
          {/* Recherche */}
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Statut */}
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'pending', 'escalated', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Tous' : status === 'pending' ? 'En attente' : status === 'escalated' ? 'Escaladées' : status === 'approved' ? 'Approuvées' : 'Rejetées'}
              </button>
            ))}
          </div>

          {/* Priorité */}
          <div className="flex gap-2 overflow-x-auto">
            {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((priority) => (
              <button
                key={priority}
                onClick={() => setFilterPriority(priority)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filterPriority === priority
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                }`}
              >
                {priority === 'all' ? 'Toutes' : priority === 'urgent' ? 'Urgentes' : priority === 'high' ? 'Hautes' : priority === 'medium' ? 'Moyennes' : 'Basses'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des validations */}
      <div className="px-4 py-4 space-y-3">
        {filteredValidations.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">Aucune demande à valider</p>
          </div>
        ) : (
          filteredValidations.map((validation) => (
            <ValidationCard
              key={validation.ValidationRequestId}
              validation={validation}
              onProcess={handleProcess}
              getPriorityColor={getPriorityColor}
              getStatusBadge={getStatusBadge}
              getEntityTypeLabel={getEntityTypeLabel}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Composant Card de Validation
function ValidationCard({
  validation,
  onProcess,
  getPriorityColor,
  getStatusBadge,
  getEntityTypeLabel,
}: {
  validation: ValidationRequest;
  onProcess: (id: string, status: 'approved' | 'rejected', comment?: string) => void;
  getPriorityColor: (priority: string) => string;
  getStatusBadge: (status: ValidationStatus) => JSX.Element;
  getEntityTypeLabel: (entityType: string) => string;
}) {
  const [showActions, setShowActions] = useState(false);
  const [comment, setComment] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  const isPending = validation.Status === 'pending' || validation.Status === 'escalated';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Bande de priorité */}
      <div className={`h-1 ${getPriorityColor(validation.Priority)}`} />

      {/* Contenu */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              {getEntityTypeLabel(validation.EntityType)}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">ID: {validation.EntityId.slice(0, 8)}...</p>
          </div>
          {getStatusBadge(validation.Status)}
        </div>

        {/* Montant */}
        {validation.Amount !== undefined && (
          <div className="mb-3">
            <p className="text-2xl font-bold text-gray-900">
              {validation.Amount.toLocaleString('fr-FR')} FCFA
            </p>
          </div>
        )}

        {/* Demandeur */}
        <div className="text-sm text-gray-600 mb-3">
          <p>Demandé par: {validation.RequestedBy}</p>
          <p>
            Le {new Date(validation.RequestedAt).toLocaleDateString('fr-FR')} à{' '}
            {new Date(validation.RequestedAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {validation.RequestReason && <p className="mt-1 italic">"{validation.RequestReason}"</p>}
        </div>

        {/* Niveau */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <span className="bg-gray-100 px-2 py-1 rounded">
            Niveau: {validation.CurrentLevel.replace('level_', '')}
          </span>
          <span className="bg-gray-100 px-2 py-1 rounded">
            Requis: {validation.RequiredLevel.replace('level_', '')}
          </span>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="space-y-2">
            {!showActions ? (
              <button
                onClick={() => setShowActions(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 transition-colors"
              >
                Traiter
              </button>
            ) : (
              <>
                {showCommentInput ? (
                  <div className="space-y-2">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Commentaire (optionnel)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowCommentInput(false);
                          setComment('');
                        }}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium active:bg-gray-200"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          onProcess(validation.ValidationRequestId, 'approved', comment);
                          setShowActions(false);
                          setShowCommentInput(false);
                          setComment('');
                        }}
                        className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium active:bg-green-700"
                      >
                        Confirmer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (confirm('Êtes-vous sûr de vouloir approuver cette demande ?')) {
                          onProcess(validation.ValidationRequestId, 'approved');
                          setShowActions(false);
                        }
                      }}
                      className="py-3 bg-green-600 text-white rounded-lg font-medium active:bg-green-700 transition-colors"
                    >
                      ✓ Approuver
                    </button>
                    <button
                      onClick={() => setShowCommentInput(true)}
                      className="py-3 bg-red-600 text-white rounded-lg font-medium active:bg-red-700 transition-colors"
                    >
                      ✗ Rejeter
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
