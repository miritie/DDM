/**
 * API Route - Configuration Rapports
 * GET /api/reports/config - Recupere la configuration
 * POST /api/reports/config - Sauvegarde la configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const postgresClient = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = 'default'; // TODO: Recuperer depuis session

    // Recuperer la config depuis PostgreSQL
    const configs = await postgresClient.query(
      `SELECT * FROM report_configs WHERE workspace_id = $1`,
      [workspaceId]
    );

    let config;
    if (configs.rows.length > 0) {
      const row = configs.rows[0];
      config = {
        pointFlash: row.point_flash_config || {
          enabled: true,
          schedule: {
            dayOfWeek: 0,
            hour: 19,
            minute: 0,
          },
          whatsappGroups: [],
          includePDF: true,
          sendTextSummary: true,
        },
        dailyExpenses: row.daily_expenses_config || {
          enabled: false,
          schedule: {
            hour: 18,
            minute: 0,
          },
          whatsappGroups: [],
          includePDF: false,
        },
        dailySales: row.daily_sales_config || {
          enabled: false,
          schedule: {
            hour: 20,
            minute: 0,
          },
          whatsappGroups: [],
          includePDF: false,
        },
      };
    } else {
      // Config par defaut
      config = {
        pointFlash: {
          enabled: true,
          schedule: {
            dayOfWeek: 0, // Dimanche
            hour: 19,
            minute: 0,
          },
          whatsappGroups: [],
          includePDF: true,
          sendTextSummary: true,
        },
        dailyExpenses: {
          enabled: false,
          schedule: {
            hour: 18,
            minute: 0,
          },
          whatsappGroups: [],
          includePDF: false,
        },
        dailySales: {
          enabled: false,
          schedule: {
            hour: 20,
            minute: 0,
          },
          whatsappGroups: [],
          includePDF: false,
        },
      };
    }

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur recuperation config:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = 'default'; // TODO: Recuperer depuis session
    const config = await request.json();

    // Valider la config
    if (!config.pointFlash || !config.dailyExpenses || !config.dailySales) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration invalide',
        },
        { status: 400 }
      );
    }

    // Sauvegarder dans PostgreSQL
    const existing = await postgresClient.query(
      `SELECT * FROM report_configs WHERE workspace_id = $1`,
      [workspaceId]
    );

    if (existing.rows.length > 0) {
      await postgresClient.query(
        `UPDATE report_configs
         SET point_flash_config = $1, daily_expenses_config = $2, daily_sales_config = $3, updated_at = $4
         WHERE workspace_id = $5`,
        [config.pointFlash, config.dailyExpenses, config.dailySales, new Date().toISOString(), workspaceId]
      );
    } else {
      await postgresClient.query(
        `INSERT INTO report_configs (workspace_id, point_flash_config, daily_expenses_config, daily_sales_config, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, config.pointFlash, config.dailyExpenses, config.dailySales, new Date().toISOString(), new Date().toISOString()]
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Configuration sauvegardee avec succes',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur sauvegarde config:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
