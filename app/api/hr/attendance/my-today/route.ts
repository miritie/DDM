/**
 * API Route - Mon pointage du jour (libre-service)
 *
 * GET  /api/hr/attendance/my-today        → mon pointage du jour (ou null)
 * POST /api/hr/attendance/my-today        → pointer l'ARRIVÉE (maintenant)
 * POST /api/hr/attendance/my-today  { action: 'check-out' } → pointer la SORTIE
 *
 * Réservé au personnel NON commercial (la présence des commerciaux est
 * automatique via le POS). Chacun ne pointe que pour lui-même : la
 * fiche employé est résolue depuis la session — aucune permission RH
 * requise, être connecté suffit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserUuid } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { handleApiError, NotFoundError, ConflictError } from '@/lib/http/api-error';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

async function myEmployee(workspaceId: string, userUuid: string | null) {
  if (!userUuid) return null;
  const r = await db.query(
    `SELECT id, full_name FROM employees
     WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, userUuid]
  );
  return r.rows[0] ?? null;
}

const TODAY_SELECT = `
  SELECT a.id AS "Id", a.attendance_id AS "AttendanceId", a.date AS "Date",
         a.check_in_time AS "CheckInTime", a.check_out_time AS "CheckOutTime",
         a.worked_hours::float AS "TotalHours", a.status AS "Status",
         e.full_name AS "EmployeeName"
  FROM attendances a
  JOIN employees e ON e.id = a.employee_id
  WHERE a.workspace_id = $1 AND a.employee_id = $2 AND a.date = CURRENT_DATE
  LIMIT 1`;

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const employee = await myEmployee(workspaceId, await getCurrentUserUuid());
    if (!employee) return NextResponse.json({ data: null });
    const r = await db.query(TODAY_SELECT, [workspaceId, employee.id]);
    return NextResponse.json({ data: r.rows[0] ?? null });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement du pointage');
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const employee = await myEmployee(workspaceId, await getCurrentUserUuid());
    if (!employee) {
      throw new NotFoundError('Aucune fiche employé liée à votre compte — voir avec les RH');
    }
    const body = await request.json().catch(() => ({}));
    const action = body.action === 'check-out' ? 'check-out' : 'check-in';

    const existing = (await db.query(TODAY_SELECT, [workspaceId, employee.id])).rows[0];

    if (action === 'check-in') {
      if (existing) throw new ConflictError('Arrivée déjà pointée aujourd\'hui');
      await db.query(
        `INSERT INTO attendances (attendance_id, employee_id, date, status, check_in_time, notes, workspace_id)
         VALUES ($1, $2, CURRENT_DATE, 'present', CURRENT_TIME, $3, $4)`,
        [uuidv4(), employee.id, body.notes ?? null, workspaceId]
      );
    } else {
      if (!existing) throw new ConflictError('Pointez d\'abord votre arrivée');
      if (existing.CheckOutTime) throw new ConflictError('Sortie déjà pointée aujourd\'hui');
      await db.query(
        `UPDATE attendances
         SET check_out_time = CURRENT_TIME,
             worked_hours = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIME - check_in_time)) / 3600.0, 2),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [existing.Id]
      );
    }

    const r = await db.query(TODAY_SELECT, [workspaceId, employee.id]);
    return NextResponse.json({ data: r.rows[0] });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du pointage');
  }
}
