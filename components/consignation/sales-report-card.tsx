/**
 * Composant - SalesReportCard (Mobile-First)
 * Carte interactive pour afficher un rapport de ventes
 */

'use client';

import { SalesReport, SalesReportStatus } from '@/types/modules';
import {
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface SalesReportCardProps {
  report: SalesReport;
  onClick?: () => void;
  showDetails?: boolean;
}

/**
 * Configuration du badge de statut
 */
const getStatusConfig = (status: SalesReportStatus) => {
  const configs = {
    draft: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      label: 'Brouillon',
      icon: FileText,
      iconColor: 'text-gray-600',
      gradient: 'from-gray-400 to-gray-600',
    },
    submitted: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'Soumis',
      icon: Clock,
      iconColor: 'text-yellow-600',
      gradient: 'from-yellow-500 to-orange-600',
    },
    validated: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Validé',
      icon: CheckCircle,
      iconColor: 'text-blue-600',
      gradient: 'from-blue-500 to-cyan-600',
    },
    processed: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Traité',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      gradient: 'from-green-500 to-emerald-600',
    },
    rejected: {
      color: 'bg-red-100 text-red-800 border-red-200',
      label: 'Rejeté',
      icon: XCircle,
      iconColor: 'text-red-600',
      gradient: 'from-red-500 to-pink-600',
    },
  };
  return configs[status] || configs.draft;
};

export function SalesReportCard({
  report,
  onClick,
  showDetails = true,
}: SalesReportCardProps) {
  const statusConfig = getStatusConfig(report.Status);
  const StatusIcon = statusConfig.icon;

  // Calculer le taux de commission
  const commissionRate =
    report.TotalSales > 0
      ? (report.PartnerCommission / report.TotalSales) * 100
      : 0;

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
      <div
        className={`bg-gradient-to-r ${statusConfig.gradient} p-4`}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-white font-bold text-lg">
              {report.ReportNumber}
            </h3>
            <p className="text-white/90 text-sm line-clamp-1">
              {report.PartnerName}
            </p>
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

        <div className="flex items-center gap-4 text-white/90 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(report.PeriodStart).toLocaleDateString('fr-FR')} -{' '}
              {new Date(report.PeriodEnd).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Montants principaux */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">Ventes Totales</span>
            </div>
            <p className="text-2xl font-bold text-green-700">
              {new Intl.NumberFormat('fr-FR').format(report.TotalSales)} F
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-600">Net à Payer</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {new Intl.NumberFormat('fr-FR').format(report.NetAmount)} F
            </p>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Commission */}
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Commission Partenaire
                </span>
                <span className="text-sm font-bold text-orange-700">
                  {Math.round(commissionRate)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Montant</span>
                <span className="font-bold text-orange-700">
                  {new Intl.NumberFormat('fr-FR').format(
                    report.PartnerCommission
                  )}{' '}
                  F
                </span>
              </div>
            </div>

            {/* Lignes du rapport */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Nombre d'articles</span>
                <span className="font-semibold text-gray-900">
                  {report.Lines.length} ligne{report.Lines.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Quantité totale vendue</span>
                <span className="font-semibold text-gray-900">
                  {report.Lines.reduce((sum, l) => sum + l.QuantitySold, 0)}{' '}
                  unités
                </span>
              </div>
            </div>

            {/* Informations validation */}
            {report.ValidatedById && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">
                    Rapport validé
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  Le{' '}
                  {new Date(report.ValidatedAt!).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}

            {/* Ventes générées */}
            {report.SalesGenerated && report.GeneratedSaleIds && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">
                    Ventes générées
                  </span>
                </div>
                <p className="text-xs text-green-700">
                  {report.GeneratedSaleIds.length} vente
                  {report.GeneratedSaleIds.length > 1 ? 's' : ''} créée
                  {report.GeneratedSaleIds.length > 1 ? 's' : ''} dans le
                  système
                </p>
              </div>
            )}

            {/* Rejet */}
            {report.Status === 'rejected' && report.RejectionReason && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Rapport rejeté
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {report.RejectionReason}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Indicateur pour voir plus de détails */}
        {onClick && (
          <div className="flex items-center justify-center text-green-600 pt-2">
            <FileText className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">Voir le rapport</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
