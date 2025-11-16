/**
 * Page - Détail d'une Demande de Dépense (Mobile-First)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Image as ImageIcon,
  Download,
  Zap,
  Edit,
  Trash2,
} from 'lucide-react';
import { ExpenseRequest, ExpenseRequestStatus, ExpenseUrgency } from '@/types/modules';
import { Button } from '@/components/ui/button';

interface PageProps {
  params: {
    id: string;
  };
}

/**
 * Configuration du badge de statut
 */
const getStatusConfig = (status: ExpenseRequestStatus) => {
  const configs = {
    draft: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      label: 'Brouillon',
      icon: FileText,
      iconColor: 'text-gray-600',
      gradient: 'from-gray-400 to-gray-600',
    },
    submitted: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Soumise',
      icon: Clock,
      iconColor: 'text-blue-600',
      gradient: 'from-blue-500 to-cyan-600',
    },
    pending_approval: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'En attente d\'approbation',
      icon: Clock,
      iconColor: 'text-yellow-600',
      gradient: 'from-yellow-500 to-orange-600',
    },
    approved: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Approuvée',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      gradient: 'from-green-500 to-emerald-600',
    },
    rejected: {
      color: 'bg-red-100 text-red-800 border-red-200',
      label: 'Rejetée',
      icon: XCircle,
      iconColor: 'text-red-600',
      gradient: 'from-red-500 to-pink-600',
    },
    paid: {
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      label: 'Payée',
      icon: CheckCircle,
      iconColor: 'text-purple-600',
      gradient: 'from-purple-500 to-pink-600',
    },
    cancelled: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      label: 'Annulée',
      icon: XCircle,
      iconColor: 'text-gray-600',
      gradient: 'from-gray-400 to-gray-600',
    },
  };
  return configs[status] || configs.draft;
};

/**
 * Labels catégories
 */
const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    fonctionnelle: 'Fonctionnelle',
    structurelle: 'Structurelle',
  };
  return labels[category] || category;
};

const getSubcategoryLabel = (subcategory: string) => {
  const labels: Record<string, string> = {
    salaire: 'Salaire',
    transport: 'Transport',
    communication: 'Communication',
    fourniture: 'Fourniture',
    maintenance: 'Maintenance',
    loyer: 'Loyer',
    electricite: 'Électricité',
    eau: 'Eau',
    autres_charges: 'Autres charges',
    equipement: 'Équipement',
    vehicule: 'Véhicule',
    immobilier: 'Immobilier',
    infrastructure: 'Infrastructure',
    logiciel: 'Logiciel',
    formation: 'Formation',
    autres_investissements: 'Autres investissements',
  };
  return labels[subcategory] || subcategory;
};

const getUrgencyLabel = (urgency: ExpenseUrgency) => {
  const labels = {
    low: 'Basse',
    normal: 'Normale',
    high: 'Haute',
    urgent: 'URGENTE',
  };
  return labels[urgency] || urgency;
};

export default function ExpenseRequestDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [request, setRequest] = useState<ExpenseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    loadRequest();
  }, [params.id]);

  async function loadRequest() {
    try {
      setLoading(true);
      const response = await fetch(`/api/expenses/requests/${params.id}`);

      if (response.ok) {
        const data = await response.json();
        setRequest(data.data);
      } else {
        console.error('Erreur chargement demande');
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!confirm('Soumettre cette demande pour approbation ?')) return;

    try {
      const response = await fetch(`/api/expenses/requests/${params.id}/submit`, {
        method: 'POST',
      });

      if (response.ok) {
        loadRequest();
      }
    } catch (error) {
      console.error('Erreur soumission:', error);
    }
  }

  async function handleCancel() {
    if (!confirm('Annuler cette demande ?')) return;

    try {
      const response = await fetch(`/api/expenses/requests/${params.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/expenses/requests?my=true');
      }
    } catch (error) {
      console.error('Erreur annulation:', error);
    }
  }

  function openApprovalModal(decision: 'approved' | 'rejected') {
    setApprovalDecision(decision);
    setShowApprovalModal(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Demande introuvable</p>
          <Button onClick={() => router.push('/expenses')} className="mt-4">
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(request.Status);
  const StatusIcon = statusConfig.icon;

  const approvalProgress =
    request.RequiredApprovalLevels > 0
      ? (request.CurrentApprovalLevel / request.RequiredApprovalLevels) * 100
      : 0;

  const approvedCount = request.Approvals?.filter((a) => a.Decision === 'approved').length || 0;

  // Vérifier si l'utilisateur peut approuver
  const canApprove = request.Status === 'pending_approval'; // TODO: Vérifier niveau utilisateur

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header avec statut */}
      <div className={`bg-gradient-to-r ${statusConfig.gradient} text-white p-6 pb-8`}>
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 text-white/90 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>

          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{request.Title}</h1>
              <p className="text-white/90 text-sm">{request.RequestNumber}</p>
            </div>

            <div
              className={`px-4 py-2 rounded-full border-2 bg-white/20 backdrop-blur-sm flex items-center gap-2`}
            >
              <StatusIcon className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white">{statusConfig.label}</span>
            </div>
          </div>

          {/* Montant */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-7 h-7" />
              <span className="text-sm opacity-90">Montant Demandé</span>
            </div>
            <p className="text-5xl font-bold">
              {new Intl.NumberFormat('fr-FR').format(request.Amount)} F
            </p>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-4">
        {/* Informations principales */}
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            Informations
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Demandeur</p>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                {request.RequesterName}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-600 mb-1">Date demande</p>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                {new Date(request.RequestDate).toLocaleDateString('fr-FR')}
              </p>
            </div>

            {request.BeneficiaryName && request.BeneficiaryName !== request.RequesterName && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600 mb-1">Bénéficiaire</p>
                <p className="font-semibold text-gray-900">{request.BeneficiaryName}</p>
              </div>
            )}

            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1">Catégorie</p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {getCategoryLabel(request.Category)}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                  {getSubcategoryLabel(request.Subcategory)}
                </span>
              </div>
            </div>

            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1">Urgence</p>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                  request.Urgency === 'urgent'
                    ? 'bg-red-100 text-red-700'
                    : request.Urgency === 'high'
                    ? 'bg-orange-100 text-orange-700'
                    : request.Urgency === 'normal'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {request.Urgency === 'urgent' && <Zap className="w-4 h-4" />}
                {request.Urgency === 'high' && <AlertTriangle className="w-4 h-4" />}
                {getUrgencyLabel(request.Urgency)}
              </span>
            </div>

            {request.NeededByDate && (
              <div className="col-span-2">
                <p className="text-xs text-gray-600 mb-1">Nécessaire avant le</p>
                <p className="font-semibold text-orange-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {new Date(request.NeededByDate).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg text-gray-900 mb-3">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{request.Description}</p>
        </div>

        {/* Preuves */}
        {request.Proofs && request.Proofs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              Preuves Jointes ({request.Proofs.length})
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {request.Proofs.map((proof) => (
                <div
                  key={proof.ProofId}
                  className="bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200"
                >
                  {proof.Type === 'photo' && proof.FileUrl && (
                    <>
                      <img
                        src={proof.FileUrl}
                        alt={proof.FileName}
                        className="w-full h-40 object-cover"
                      />
                      <div className="p-3">
                        <p className="text-xs text-gray-600 truncate">{proof.FileName}</p>
                        <a
                          href={proof.FileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 flex items-center gap-1 mt-2"
                        >
                          <Download className="w-3 h-3" />
                          Télécharger
                        </a>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow d'approbation */}
        {request.Status === 'pending_approval' && request.RequiredApprovalLevels > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg text-gray-900 mb-4">
              Circuit d'Approbation ({approvedCount}/{request.RequiredApprovalLevels})
            </h2>

            {/* Barre de progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Progression</span>
                <span className="text-sm font-bold text-blue-700">
                  {Math.round(approvalProgress)}%
                </span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-600 transition-all rounded-full"
                  style={{ width: `${Math.min(approvalProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Liste des approbations */}
            {request.Approvals && request.Approvals.length > 0 && (
              <div className="space-y-3">
                {request.Approvals.map((approval) => (
                  <div
                    key={approval.ApprovalId}
                    className={`p-4 rounded-xl border-2 ${
                      approval.Decision === 'approved'
                        ? 'bg-green-50 border-green-200'
                        : approval.Decision === 'rejected'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {approval.Decision === 'approved' ? (
                          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                        ) : approval.Decision === 'rejected' ? (
                          <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                        ) : (
                          <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{approval.ApproverName}</p>
                          <p className="text-xs text-gray-600">Niveau {approval.Level}</p>
                        </div>
                      </div>
                      {approval.Decision !== 'pending' && approval.DecisionDate && (
                        <span className="text-xs text-gray-600">
                          {new Date(approval.DecisionDate).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                    {approval.Comments && (
                      <p className="text-sm text-gray-700 mt-2 pl-9">{approval.Comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rejet */}
        {request.Status === 'rejected' && request.RejectionReason && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-red-800 mb-1">Raison du rejet</p>
              <p className="text-sm text-red-700">{request.RejectionReason}</p>
            </div>
          </div>
        )}

        {/* Paiement */}
        {request.Status === 'paid' && request.PaidDate && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-purple-800 mb-1">Payée</p>
              <p className="text-sm text-purple-700">
                Le {new Date(request.PaidDate).toLocaleDateString('fr-FR')}
                {request.WalletName && ` via ${request.WalletName}`}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="font-bold text-lg text-gray-900 mb-4">Actions</h2>

          {/* Brouillon: Soumettre ou Supprimer */}
          {request.Status === 'draft' && (
            <>
              <Button
                onClick={handleSubmit}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Soumettre pour Approbation
              </Button>
              <Button
                onClick={() => router.push(`/expenses/requests/${params.id}/edit`)}
                className="w-full bg-gray-600 hover:bg-gray-700 h-12 text-base"
              >
                <Edit className="w-5 h-5 mr-2" />
                Modifier
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="w-full border-2 border-red-600 text-red-600 hover:bg-red-50 h-12 text-base"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Supprimer
              </Button>
            </>
          )}

          {/* En attente: Approuver ou Rejeter */}
          {canApprove && (
            <div className="flex gap-3">
              <Button
                onClick={() => openApprovalModal('rejected')}
                className="flex-1 bg-red-600 hover:bg-red-700 h-14 text-base"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Rejeter
              </Button>
              <Button
                onClick={() => openApprovalModal('approved')}
                className="flex-1 bg-green-600 hover:bg-green-700 h-14 text-base"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Approuver
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'approbation */}
      {showApprovalModal && (
        <ApprovalModal
          requestId={params.id}
          decision={approvalDecision!}
          onClose={() => {
            setShowApprovalModal(false);
            setApprovalDecision(null);
          }}
          onSuccess={() => {
            setShowApprovalModal(false);
            setApprovalDecision(null);
            loadRequest();
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal d'Approbation/Rejet
 */
interface ApprovalModalProps {
  requestId: string;
  decision: 'approved' | 'rejected';
  onClose: () => void;
  onSuccess: () => void;
}

function ApprovalModal({ requestId, decision, onClose, onSuccess }: ApprovalModalProps) {
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    try {
      setSubmitting(true);

      const response = await fetch(`/api/expenses/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          comments: comments.trim() || undefined,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert('Erreur lors de la soumission');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {decision === 'approved' ? 'Approuver' : 'Rejeter'} la demande
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Commentaires {decision === 'rejected' && '(obligatoire)'}
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={
                decision === 'approved'
                  ? 'Commentaires optionnels...'
                  : 'Raison du rejet...'
              }
              className="w-full h-32 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12"
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || (decision === 'rejected' && !comments.trim())}
              className={`flex-1 h-12 ${
                decision === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting ? 'Envoi...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
