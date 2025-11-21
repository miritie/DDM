/**
 * Service - Gestion des Présences
 * Module Ressources Humaines
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Attendance, AttendanceStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  workspaceId: string;
}

export interface ValidateAttendanceInput {
  attendanceId: string;
  validatedById: string;
}

export class AttendanceService {
  calculateWorkedHours(checkInTime?: string, checkOutTime?: string): number {
    if (!checkInTime || !checkOutTime) {
      return 0;
    }

    try {
      const checkIn = new Date(`1970-01-01T${checkInTime}`);
      const checkOut = new Date(`1970-01-01T${checkOutTime}`);

      const diffMs = checkOut.getTime() - checkIn.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return Math.max(0, Math.round(diffHours * 100) / 100);
    } catch (error) {
      console.error('Error calculating worked hours:', error);
      return 0;
    }
  }

  async create(input: CreateAttendanceInput): Promise<Attendance> {
    const workedHours = this.calculateWorkedHours(input.checkInTime, input.checkOutTime);

    const attendance: any = {
      AttendanceId: uuidv4(),
      EmployeeId: input.employeeId,
      Date: input.date,
      Status: input.status,
      CheckInTime: input.checkInTime,
      CheckOutTime: input.checkOutTime,
      WorkedHours: workedHours,
      Notes: input.notes,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Attendance>('attendances', attendance);
    return created;
  }

  async getById(attendanceId: string): Promise<Attendance | null> {
    const attendances = await postgresClient.list<Attendance>('attendances', {
      filterByFormula: `attendance_id = '${attendanceId}'`,
    });
    return attendances.length > 0 ? attendances[0] : null;
  }

  async getByEmployeeAndDate(
    employeeId: string,
    date: string
  ): Promise<Attendance | null> {
    const attendances = await postgresClient.list<Attendance>('attendances', {
      filterByFormula: `AND(employee_id = '${employeeId}', date = '${date}')`,
    });
    return attendances.length > 0 ? attendances[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { employeeId?: string; startDate?: string; endDate?: string; status?: string } = {}
  ): Promise<Attendance[]> {
    const filterFormulas: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`employee_id = '${filters.employeeId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`status = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`date >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`date <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<Attendance>('attendances', {
      filterByFormula,
      sort: [{ field: 'Date', direction: 'desc' }],
    });
  }

  async update(
    attendanceId: string,
    updates: {
      status?: AttendanceStatus;
      checkInTime?: string;
      checkOutTime?: string;
      notes?: string;
    }
  ): Promise<Attendance> {
    const attendances = await postgresClient.list<Attendance>('attendances', {
      filterByFormula: `attendance_id = '${attendanceId}'`,
    });

    if (attendances.length === 0) {
      throw new Error('Présence non trouvée');
    }

    const currentAttendance = attendances[0];
    const checkInTime = updates.checkInTime || currentAttendance.CheckInTime;
    const checkOutTime = updates.checkOutTime || currentAttendance.CheckOutTime;
    const workedHours = this.calculateWorkedHours(checkInTime, checkOutTime);

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
      WorkedHours: workedHours,
    };

    if (updates.status !== undefined) updateData.Status = updates.status;
    if (updates.checkInTime !== undefined) updateData.CheckInTime = updates.checkInTime;
    if (updates.checkOutTime !== undefined) updateData.CheckOutTime = updates.checkOutTime;
    if (updates.notes !== undefined) updateData.Notes = updates.notes;

    if (!attendances[0].id) {
      throw new Error('Attendance ID is missing');
    }

    const updated = await postgresClient.update<Attendance>(
      'attendances',
      attendances[0].id,
      updateData
    );
    return updated;
  }

  async validate(input: ValidateAttendanceInput): Promise<Attendance> {
    const attendances = await postgresClient.list<Attendance>('attendances', {
      filterByFormula: `attendance_id = '${input.attendanceId}'`,
    });

    if (attendances.length === 0) {
      throw new Error('Présence non trouvée');
    }

    if (!attendances[0].id) {
      throw new Error('Attendance ID is missing');
    }

    const updated = await postgresClient.update<Attendance>(
      'attendances',
      attendances[0].id,
      {
        ValidatedById: input.validatedById,
        ValidatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async delete(attendanceId: string): Promise<void> {
    const attendances = await postgresClient.list<Attendance>('attendances', {
      filterByFormula: `attendance_id = '${attendanceId}'`,
    });

    if (attendances.length === 0) {
      throw new Error('Présence non trouvée');
    }

    if (!attendances[0].id) {
      throw new Error('Attendance ID is missing');
    }

    await postgresClient.delete('attendances', attendances[0].id);
  }

  async getMonthlyReport(
    employeeId: string,
    year: number,
    month: number
  ): Promise<{
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    remoteDays: number;
    totalWorkedHours: number;
    attendanceRate: number;
    attendances: Attendance[];
  }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const attendances = await postgresClient.list<Attendance>('attendances', {
      filterByFormula: `AND(
        employee_id = '${employeeId}',
        date >= '${startDate}',
        date <= '${endDateStr}'
      )`,
      sort: [{ field: 'Date', direction: 'asc' }],
    });

    const totalDays = attendances.length;
    const presentDays = attendances.filter((a) => (a as any).Status === 'present' || (a as any).Status === 'remote').length;
    const absentDays = attendances.filter((a) => (a as any).Status === 'absent').length;
    const lateDays = attendances.filter((a) => (a as any).Status === 'late').length;
    const remoteDays = attendances.filter((a) => (a as any).Status === 'remote').length;
    const totalWorkedHours = attendances.reduce((sum: number, a: any) => sum + (a.WorkedHours || 0), 0);

    const workingDaysInMonth = endDate.getDate();
    const attendanceRate = workingDaysInMonth > 0 ? (presentDays / workingDaysInMonth) * 100 : 0;

    return {
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      remoteDays,
      totalWorkedHours,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
      attendances,
    };
  }

  async bulkCreate(
    employeeIds: string[],
    date: string,
    status: AttendanceStatus,
    workspaceId: string
  ): Promise<Attendance[]> {
    const attendances: Attendance[] = [];

    for (const employeeId of employeeIds) {
      // Check if attendance already exists for this employee and date
      const existing = await this.getByEmployeeAndDate(employeeId, date);

      if (!existing) {
        const attendance = await this.create({
          employeeId,
          date,
          status,
          workspaceId,
        });
        attendances.push(attendance);
      }
    }

    return attendances;
  }
}
