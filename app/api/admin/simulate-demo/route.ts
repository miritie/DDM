/**
 * API Route - Simulation du jeu de données (admin)
 * POST /api/admin/simulate-demo
 *
 * ⚠️  DESTRUCTIF — réservé aux admins (admin:settings:edit) et exige
 *     une confirmation explicite. Exécuté par étapes pour tenir dans
 *     la durée max d'une fonction serverless :
 *
 *   { confirm: 'SIMULER', step: 'prepare' }            → purge + référentiels
 *   { confirm: 'SIMULER', step: 'year', year: 2020 }   → une année d'activité
 *   { confirm: 'SIMULER', step: 'finalize' }           → stocks finaux + résumé
 *
 * L'interface /admin/simulate enchaîne ces appels automatiquement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError, ValidationError } from '@/lib/http/api-error';
import {
  simulatePrepare, simulateYearStep, simulateFinalize, SIMULATION_START_YEAR,
} from '@/lib/demo/simulation-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel : étape la plus lourde = une année complète

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);

    const body = await request.json().catch(() => ({}));
    const { confirm, step, year } = body as { confirm?: string; step?: string; year?: number };

    if (confirm !== 'SIMULER') {
      throw new ValidationError("Confirmation requise : envoyer { confirm: 'SIMULER' } — opération destructive.");
    }

    switch (step) {
      case 'prepare': {
        const data = await simulatePrepare();
        return NextResponse.json({ success: true, step, data });
      }
      case 'year': {
        const y = Number(year);
        const currentYear = new Date().getUTCFullYear();
        if (!Number.isInteger(y) || y < SIMULATION_START_YEAR || y > currentYear) {
          throw new ValidationError(`year invalide (attendu : ${SIMULATION_START_YEAR}–${currentYear})`);
        }
        const data = await simulateYearStep(y);
        return NextResponse.json({ success: true, step, data });
      }
      case 'finalize': {
        const data = await simulateFinalize();
        return NextResponse.json({ success: true, step, data });
      }
      default:
        throw new ValidationError("step invalide : 'prepare' | 'year' | 'finalize'");
    }
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la simulation');
  }
}
