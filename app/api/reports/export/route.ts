/**
 * API Route - Export de Rapport
 * Module Rapports & Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExportService } from '@/lib/modules/reports/export-service';
import { AirtableClient } from '@/lib/airtable/client';
import { ReportExecution } from '@/types/modules';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const exportService = new ExportService();
const airtableClient = new AirtableClient();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const body = await request.json();
    const { executionId, format = 'excel', filename, includeCharts = false, orientation = 'portrait' } = body;

    // Get execution
    const executions = await airtableClient.list<ReportExecution>('ReportExecution', {
      filterByFormula: `{ExecutionId} = '${executionId}'`,
    });

    if (executions.length === 0) {
      return NextResponse.json({ error: 'Exécution non trouvée' }, { status: 404 });
    }

    const execution = executions[0];

    if (execution.Status !== 'completed') {
      return NextResponse.json({ error: 'Le rapport n\'est pas encore terminé' }, { status: 400 });
    }

    // Export
    const blob = await exportService.exportReport(execution, {
      format,
      filename,
      includeCharts,
      orientation,
    });

    // Convert blob to buffer for response
    const buffer = Buffer.from(await blob.arrayBuffer());

    const contentTypes: Record<string, string> = {
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pdf: 'application/pdf',
      csv: 'text/csv',
      json: 'application/json',
    };

    const suggestedFilename = filename || exportService.getSuggestedFilename('rapport', format);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[format] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${suggestedFilename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
