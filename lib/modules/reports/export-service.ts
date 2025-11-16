/**
 * Service - Export de Rapports (Excel, PDF, CSV)
 * Module Rapports & Analytics
 */

import { ReportExecution } from '@/types/modules';

export type ExportFormat = 'excel' | 'pdf' | 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeCharts?: boolean;
  orientation?: 'portrait' | 'landscape';
}

export class ExportService {
  /**
   * Export report data to specified format
   */
  async exportReport(
    reportExecution: ReportExecution,
    options: ExportOptions
  ): Promise<Blob> {
    const { format } = options;

    switch (format) {
      case 'excel':
        return await this.exportToExcel(reportExecution, options);
      case 'pdf':
        return await this.exportToPDF(reportExecution, options);
      case 'csv':
        return await this.exportToCSV(reportExecution, options);
      case 'json':
        return await this.exportToJSON(reportExecution, options);
      default:
        throw new Error(`Format d'export non supporté: ${format}`);
    }
  }

  /**
   * Export to Excel format (.xlsx)
   * Uses SheetJS (xlsx library) for Excel generation
   */
  private async exportToExcel(
    reportExecution: ReportExecution,
    options: ExportOptions
  ): Promise<Blob> {
    // This will require installing 'xlsx' package
    // npm install xlsx

    const data = reportExecution.ResultData;

    // For now, create a simple CSV-like structure
    // TODO: Implement proper Excel export with xlsx library
    const csv = this.dataToCSV(data);

    return new Blob([csv], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Export to PDF format
   * Uses jsPDF or pdfkit for PDF generation
   */
  private async exportToPDF(
    reportExecution: ReportExecution,
    options: ExportOptions
  ): Promise<Blob> {
    // This will require installing 'jspdf' or 'pdfkit'
    // npm install jspdf jspdf-autotable

    const data = reportExecution.ResultData;
    const { orientation = 'portrait' } = options;

    // For now, create a simple text representation
    // TODO: Implement proper PDF export with jsPDF
    const text = JSON.stringify(data, null, 2);

    return new Blob([text], { type: 'application/pdf' });
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(
    reportExecution: ReportExecution,
    options: ExportOptions
  ): Promise<Blob> {
    const data = reportExecution.ResultData;
    const csv = this.dataToCSV(data);

    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    reportExecution: ReportExecution,
    options: ExportOptions
  ): Promise<Blob> {
    const data = reportExecution.ResultData;
    const json = JSON.stringify(data, null, 2);

    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Convert report data to CSV format
   */
  private dataToCSV(data: any): string {
    if (!data) return '';

    // Handle different data structures
    if (Array.isArray(data)) {
      return this.arrayToCSV(data);
    }

    if (typeof data === 'object') {
      return this.objectToCSV(data);
    }

    return String(data);
  }

  /**
   * Convert array to CSV
   */
  private arrayToCSV(arr: any[]): string {
    if (arr.length === 0) return '';

    // Get headers from first object
    const firstItem = arr[0];
    if (typeof firstItem !== 'object') {
      return arr.join('\n');
    }

    const headers = Object.keys(firstItem);
    const rows = arr.map(item =>
      headers.map(header => {
        const value = item[header];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Convert object to CSV
   */
  private objectToCSV(obj: Record<string, any>): string {
    const rows: string[] = [];

    // Handle nested objects by flattening
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        rows.push(`\n${key}:`);
        rows.push(this.arrayToCSV(value));
      } else if (typeof value === 'object' && value !== null) {
        rows.push(`\n${key}:`);
        rows.push(this.objectToCSV(value));
      } else {
        rows.push(`${key},${value}`);
      }
    }

    return rows.join('\n');
  }

  /**
   * Download blob as file in browser
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get suggested filename for export
   */
  getSuggestedFilename(
    reportName: string,
    format: ExportFormat,
    date: Date = new Date()
  ): string {
    const dateStr = date.toISOString().split('T')[0];
    const sanitizedName = reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const extensions: Record<ExportFormat, string> = {
      excel: 'xlsx',
      pdf: 'pdf',
      csv: 'csv',
      json: 'json',
    };

    return `${sanitizedName}_${dateStr}.${extensions[format]}`;
  }
}
