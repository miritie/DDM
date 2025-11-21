/**
 * API Route - Export de Rapport
 * Module Rapports & Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExportService } from '@/lib/modules/reports/export-service';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { ReportExecution } from '@/types/modules';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const exportService = new ExportService();
const postgresClient = getPostgresClient();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const body = await request.json();
    const { executionId, format = 'excel', filename, includeCharts = false, orientation = 'portrait' } = body;

    // Get execution
    const executions = await postgresClient.query(
      `SELECT * FROM report_executions WHERE execution_id = $1`,
      [executionId]
    );

    if (executions.rows.length === 0) {
      return NextResponse.json({ error: 'Execution non trouvee' }, { status: 404 });
    }

    const executionRow = executions.rows[0];

    // Map to expected format
    const execution: ReportExecution = {
      ExecutionId: executionRow.execution_id,
      ReportId: executionRow.report_id,
      Status: executionRow.status,
      ResultData: executionRow.result,
      StartedAt: executionRow.started_at,
      CompletedAt: executionRow.completed_at,
      ErrorMessage: executionRow.error_message,
      TriggeredById: executionRow.created_by_id,
      CreatedAt: executionRow.created_at,
    };

    if (execution.Status !== 'completed') {
      return NextResponse.json({ error: 'Le rapport n\'est pas encore termine' }, { status: 400 });
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
