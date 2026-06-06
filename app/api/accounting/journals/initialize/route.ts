/**
 * API Route - Initialiser les Journaux Comptables
 * Module Comptabilité
 *
 * Le bouton « Initialiser Journaux » de /accounting appelait cette route
 * qui n'existait pas — le service initializeDefaultJournals (VT, AC, BQ,
 * CA, OD, PAI), lui, existait déjà.
 */

import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { JournalService } from '@/lib/modules/accounting/journal-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError } from '@/lib/http/api-error';

const service = new JournalService();

export async function POST() {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const journals = await service.initializeDefaultJournals(workspaceId);
    return NextResponse.json({ data: journals }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de l'initialisation des journaux");
  }
}
