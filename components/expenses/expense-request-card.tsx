/**
 * Composant - ExpenseRequestCard (Mobile-First)
 * Carte visuelle pour afficher une sollicitation de dépense
 */

'use client';

import { ExpenseRequest, ExpenseRequestStatus, ExpenseUrgency } from '@/types/modules';
import {
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';

interface ExpenseRequestCardProps {
  request: ExpenseRequest;
  onClick?: () => void;
  showDetails?: boolean;
  showApprovalActions?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
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
      label: 'En attente',
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
 * Configuration de l'urgence
 */
const getUrgencyConfig = (urgency: ExpenseUrgency) => {
  const configs = {
    low: { label: 'Basse', color: 'bg-gray-100 text-gray-700', icon: null },
    normal: { label: 'Normale', color: 'bg-blue-100 text-blue-700', icon: null },
    high: { label: 'Haute', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
    urgent: { label: 'URGENTE', color: 'bg-red-100 text-red-700', icon: Zap },
  };
  return configs[urgency] || configs.normal;
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

export function ExpenseRequestCard({
  request,
  onClick,
  showDetails = true,
  showApprovalActions = false,
  onApprove,
  onReject,
}: ExpenseRequestCardProps) {
  const statusConfig = getStatusConfig(request.Status);
  const urgencyConfig = getUrgencyConfig(request.Urgency);
  const StatusIcon = statusConfig.icon;
  const UrgencyIcon = urgencyConfig.icon;

  // Calcul progression approbations
  const approvalProgress =
    request.RequiredApprovalLevels > 0
      ? (request.CurrentApprovalLevel / request.RequiredApprovalLevels) * 100
      : 0;

  const approvedCount = request.Approvals?.filter((a) => a.Decision === 'approved').length || 0;

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all ${
        onClick
          ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
          : ''
      }`}
      onClick={onClick}
    >
      {/* Header avec statut */}
      <div className={`bg-gradient-to-r ${statusConfig.gradient} p-4`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg line-clamp-1">
              {request.Title}
            </h3>
            <p className="text-white/90 text-sm">{request.RequestNumber}</p>
          </div>

          <div
            className={`px-3 py-1 rounded-full border-2 bg-white/20 backdrop-blur-sm ${statusConfig.color.replace(
              'bg-',
              'border-'
            )}`}
          >
            <span className="text-xs font-semibold text-white flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-white/90 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <User className="w-4 h-4" />
            <span className="line-clamp-1">{request.RequesterName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(request.RequestDate).toLocaleDateString('fr-FR')}</span>
          </div>
          {request.Urgency !== 'normal' && UrgencyIcon && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${urgencyConfig.color} flex items-center gap-1`}>
              <UrgencyIcon className="w-3 h-3" />
              {urgencyConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Montant */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-xs text-gray-600">Montant Demandé</span>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {new Intl.NumberFormat('fr-FR').format(request.Amount)} F
          </p>
        </div>

        {showDetails && (
          <>
            {/* Description */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm text-gray-700 line-clamp-2">
                {request.Description}
              </p>
            </div>

            {/* Catégorie */}
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {getCategoryLabel(request.Category as any)}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                {getSubcategoryLabel(request.Subcategory as any)}
              </span>
            </div>

            {/* Preuves */}
            {request.Proofs && request.Proofs.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      {request.Proofs.length} preuve(s) jointe(s)
                    </span>
                  </div>
                  <span className="text-xs text-blue-600">
                    {request.Proofs.filter((p) => p.Type === 'photo').length} photo(s)
                  </span>
                </div>
              </div>
            )}

            {/* Bénéficiaire (si différent) */}
            {request.BeneficiaryName && request.BeneficiaryName !== request.RequesterName && (
              <div className="border-t pt-3">
                <p className="text-xs text-gray-600">Bénéficiaire</p>
                <p className="font-semibold text-gray-900">{request.BeneficiaryName}</p>
              </div>
            )}

            {/* Workflow d'approbation */}
            {request.Status === 'submitted' && request.RequiredApprovalLevels > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Approbations ({approvedCount}/{request.RequiredApprovalLevels})
                  </span>
                  <span className="text-sm font-bold text-blue-700">
                    {Math.round(approvalProgress)}%
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-600 transition-all rounded-full"
                    style={{ width: `${Math.min(approvalProgress, 100)}%` }}
                  />
                </div>

                {/* Liste approbateurs */}
                {request.Approvals && request.Approvals.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {request.Approvals.slice(0, 3).map((approval) => (
                      <div
                        key={approval.ApprovalId}
                        className={`flex items-center justify-between text-sm p-2 rounded-lg ${
                          approval.Decision === 'approved'
                            ? 'bg-green-50'
                            : approval.Decision === 'rejected'
                            ? 'bg-red-50'
                            : 'bg-yellow-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {approval.Decision === 'approved' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : approval.Decision === 'rejected' ? (
                            <XCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-600" />
                          )}
                          <span className="font-medium">{approval.ApproverName}</span>
                        </div>
                        <span className="text-xs text-gray-600">Niveau {approval.Level}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Date nécessaire */}
            {request.NeededByDate && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="text-xs text-gray-600">Nécessaire avant le</p>
                    <p className="font-semibold text-orange-700">
                      {new Date(request.NeededByDate).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejet */}
            {request.Status === 'rejected' && request.RejectionReason && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Raison du rejet</p>
                  <p className="text-xs text-red-700 mt-1">{request.RejectionReason}</p>
                </div>
              </div>
            )}

            {/* Paiement */}
            {request.Status === 'approved' && request.PaidDate && (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-semibold text-purple-800">Payée</p>
                    <p className="text-xs text-purple-700 mt-1">
                      Le {new Date(request.PaidDate).toLocaleDateString('fr-FR')}
                      {request.WalletName && ` via ${request.WalletName}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions d'approbation */}
        {showApprovalActions && request.Status === 'submitted' && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject?.();
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <XCircle className="w-5 h-5" />
              Rejeter
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove?.();
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <CheckCircle className="w-5 h-5" />
              Approuver
            </button>
          </div>
        )}

        {/* Indicateur pour voir plus */}
        {onClick && !showApprovalActions && (
          <div className="flex items-center justify-center text-blue-600 pt-2">
            <FileText className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">Voir les détails</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
