/**
 * Page - Gestion des Rapports
 * Module Rapports & Analytics
 */

'use client';

import { useEffect, useState } from 'react';
import { Report, ReportExecution } from '@/types/modules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Play, Download, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executionLoading, setExecutionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);
      const response = await fetch('/api/reports');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du chargement des rapports');
      }

      setReports(result.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeReport(reportId: string) {
    try {
      setExecutionLoading(reportId);
      const response = await fetch(`/api/reports/${reportId}/execute`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'exécution du rapport');
      }

      alert('Rapport exécuté avec succès!');
      loadReports();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    } finally {
      setExecutionLoading(null);
    }
  }

  function getReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      sales: 'Ventes',
      expenses: 'Dépenses',
      inventory: 'Stock',
      cashflow: 'Trésorerie',
      hr: 'RH',
      accounting: 'Comptabilité',
      custom: 'Personnalisé',
    };
    return labels[type] || type;
  }

  function getReportTypeColor(type: string): string {
    const colors: Record<string, string> = {
      sales: 'bg-blue-100 text-blue-800',
      expenses: 'bg-red-100 text-red-800',
      inventory: 'bg-orange-100 text-orange-800',
      cashflow: 'bg-green-100 text-green-800',
      hr: 'bg-purple-100 text-purple-800',
      accounting: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.custom;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Chargement des rapports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rapports & Analytics</h1>
          <p className="text-gray-600 mt-2">Générez et consultez vos rapports personnalisés</p>
        </div>
        <button
          onClick={() => (window.location.href = '/analytics')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Dashboard Analytics
        </button>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Rapport de Ventes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Analyse complète des ventes par période, produit et client
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              Rapport de Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Suivi des dépenses par catégorie et période
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Rapport de Trésorerie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Analyse des flux de trésorerie et soldes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Rapports Configurés</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucun rapport configuré</p>
              <p className="text-sm text-gray-400 mt-2">
                Créez votre premier rapport pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.ReportId}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{report.ReportName}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getReportTypeColor(report.ReportType)}`}
                        >
                          {getReportTypeLabel(report.ReportType)}
                        </span>
                        {report.IsActive && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                            Actif
                          </span>
                        )}
                      </div>
                      {report.Description && (
                        <p className="text-sm text-gray-600 mt-2">{report.Description}</p>
                      )}
                      {report.Schedule && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                          <Calendar className="h-4 w-4" />
                          <span>Planifié: {report.Schedule.frequency}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeReport(report.ReportId)}
                        disabled={executionLoading === report.ReportId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {executionLoading === report.ReportId ? (
                          <>
                            <Clock className="h-4 w-4 animate-spin" />
                            Exécution...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Exécuter
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Information */}
      <Card>
        <CardHeader>
          <CardTitle>Formats d'Export Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <Download className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-semibold">Excel (.xlsx)</p>
                <p className="text-xs text-gray-600">Données tabulaires</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Download className="h-8 w-8 text-red-600" />
              <div>
                <p className="font-semibold">PDF</p>
                <p className="text-xs text-gray-600">Document imprimable</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Download className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-semibold">CSV</p>
                <p className="text-xs text-gray-600">Format universel</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Download className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-semibold">JSON</p>
                <p className="text-xs text-gray-600">Données structurées</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
