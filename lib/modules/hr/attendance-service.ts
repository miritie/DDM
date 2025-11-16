/**
 * Service - Gestion des Présences
 * Module Ressources Humaines
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Attendance, AttendanceStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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

    const attendance: Partial<Attendance> = {
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

    return await airtableClient.create<Attendance>('Attendance', attendance);
  }

  async getById(attendanceId: string): Promise<Attendance | null> {
    const attendances = await airtableClient.list<Attendance>('Attendance', {
      filterByFormula: `{AttendanceId} = '${attendanceId}'`,
    });
    return attendances.length > 0 ? attendances[0] : null;
  }

  async getByEmployeeAndDate(
    employeeId: string,
    date: string
  ): Promise<Attendance | null> {
    const attendances = await airtableClient.list<Attendance>('Attendance', {
      filterByFormula: `AND({EmployeeId} = '${employeeId}', {Date} = '${date}')`,
    });
    return attendances.length > 0 ? attendances[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { employeeId?: string; startDate?: string; endDate?: string; status?: string } = {}
  ): Promise<Attendance[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`{EmployeeId} = '${filters.employeeId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{Date} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{Date} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<Attendance>('Attendance', {
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
    const attendances = await airtableClient.list<Attendance>('Attendance', {
      filterByFormula: `{AttendanceId} = '${attendanceId}'`,
    });

    if (attendances.length === 0) {
      throw new Error('Présence non trouvée');
    }

    const currentAttendance = attendances[0];
    const checkInTime = updates.checkInTime || currentAttendance.CheckInTime;
    const checkOutTime = updates.checkOutTime || currentAttendance.CheckOutTime;
    const workedHours = this.calculateWorkedHours(checkInTime, checkOutTime);

    return await airtableClient.update<Attendance>(
      'Attendance',
      (attendances[0] as any)._recordId,
      {
        ...updates,
        WorkedHours: workedHours,
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async validate(input: ValidateAttendanceInput): Promise<Attendance> {
    const attendances = await airtableClient.list<Attendance>('Attendance', {
      filterByFormula: `{AttendanceId} = '${input.attendanceId}'`,
    });

    if (attendances.length === 0) {
      throw new Error('Présence non trouvée');
    }

    return await airtableClient.update<Attendance>(
      'Attendance',
      (attendances[0] as any)._recordId,
      {
        ValidatedById: input.validatedById,
        ValidatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async delete(attendanceId: string): Promise<void> {
    const attendances = await airtableClient.list<Attendance>('Attendance', {
      filterByFormula: `{AttendanceId} = '${attendanceId}'`,
    });

    if (attendances.length === 0) {
      throw new Error('Présence non trouvée');
    }

    await airtableClient.delete('Attendance', (attendances[0] as any)._recordId);
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

    const attendances = await airtableClient.list<Attendance>('Attendance', {
      filterByFormula: `AND(
        {EmployeeId} = '${employeeId}',
        {Date} >= '${startDate}',
        {Date} <= '${endDateStr}'
      )`,
      sort: [{ field: 'Date', direction: 'asc' }],
    });

    const totalDays = attendances.length;
    const presentDays = attendances.filter((a) => a.Status === 'present' || a.Status === 'remote').length;
    const absentDays = attendances.filter((a) => a.Status === 'absent').length;
    const lateDays = attendances.filter((a) => a.Status === 'late').length;
    const remoteDays = attendances.filter((a) => a.Status === 'remote').length;
    const totalWorkedHours = attendances.reduce((sum, a) => sum + (a.WorkedHours || 0), 0);

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
