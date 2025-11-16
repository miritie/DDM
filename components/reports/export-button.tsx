/**
 * Component - Bouton d'Export de Rapport
 * Module Rapports & Analytics
 */

'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  executionId: string;
  reportName: string;
  format?: 'excel' | 'pdf' | 'csv' | 'json';
  className?: string;
}

export function ExportButton({
  executionId,
  reportName,
  format = 'excel',
  className = '',
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    try {
      setLoading(true);

      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          executionId,
          format,
          filename: `${reportName}_${new Date().toISOString().split('T')[0]}.${format}`,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erreur lors de l\'export');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportName}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const formatLabels: Record<string, string> = {
    excel: 'Excel',
    pdf: 'PDF',
    csv: 'CSV',
    json: 'JSON',
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Download className="h-4 w-4" />
      {loading ? 'Export en cours...' : `Exporter ${formatLabels[format]}`}
    </button>
  );
}
