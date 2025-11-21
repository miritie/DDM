/**
 * Service - Gestion des Congés
 * Module Ressources Humaines
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Leave, LeaveBalance } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateLeaveInput {
  employeeId: string;
  type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other';
  startDate: string;
  endDate: string;
  reason?: string;
  attachmentUrl?: string;
  workspaceId: string;
}

export interface ReviewLeaveInput {
  leaveId: string;
  status: 'approved' | 'rejected';
  reviewNotes?: string;
  reviewedById: string;
}

export class LeaveService {
  async generateLeaveNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const leaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `AND(workspace_id = '${workspaceId}', YEAR(requested_at) = ${year})`,
    });
    return `LVE-${year}-${String(leaves.length + 1).padStart(4, '0')}`;
  }

  calculateDaysCount(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  }

  async create(input: CreateLeaveInput): Promise<Leave> {
    const leaveNumber = await this.generateLeaveNumber(input.workspaceId);
    const daysCount = this.calculateDaysCount(input.startDate, input.endDate);

    const leave: any = {
      LeaveId: uuidv4(),
      LeaveNumber: leaveNumber,
      EmployeeId: input.employeeId,
      Type: input.type,
      StartDate: input.startDate,
      EndDate: input.endDate,
      DaysCount: daysCount,
      Reason: input.reason,
      Status: 'pending',
      RequestedAt: new Date().toISOString(),
      AttachmentUrl: input.attachmentUrl,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Leave>('leaves', leave);
    return created;
  }

  async getById(leaveId: string): Promise<Leave | null> {
    const leaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `leave_id = '${leaveId}'`,
    });
    return leaves.length > 0 ? leaves[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { employeeId?: string; status?: string; type?: string } = {}
  ): Promise<Leave[]> {
    const filterFormulas: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`employee_id = '${filters.employeeId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`status = '${filters.status}'`);
    }
    if (filters.type) {
      filterFormulas.push(`type = '${filters.type}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<Leave>('leaves', {
      filterByFormula,
      sort: [{ field: 'RequestedAt', direction: 'desc' }],
    });
  }

  async review(input: ReviewLeaveInput): Promise<Leave> {
    const leaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `leave_id = '${input.leaveId}'`,
    });

    if (leaves.length === 0) {
      throw new Error('Congé non trouvé');
    }

    if (leaves[0].Status !== 'pending') {
      throw new Error('Ce congé a déjà été traité');
    }

    if (!leaves[0].id) {
      throw new Error('Leave ID is missing');
    }

    const updated = await postgresClient.update<Leave>(
      'leaves',
      leaves[0].id,
      {
        Status: input.status,
        ReviewedById: input.reviewedById,
        ReviewedAt: new Date().toISOString(),
        ReviewNotes: input.reviewNotes,
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async cancel(leaveId: string): Promise<Leave> {
    const leaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `leave_id = '${leaveId}'`,
    });

    if (leaves.length === 0) {
      throw new Error('Congé non trouvé');
    }

    if (!leaves[0].id) {
      throw new Error('Leave ID is missing');
    }

    const updated = await postgresClient.update<Leave>(
      'leaves',
      leaves[0].id,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async getBalance(employeeId: string, year: number = new Date().getFullYear()): Promise<LeaveBalance[]> {
    const leaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `AND(employee_id = '${employeeId}', status = 'approved', YEAR(start_date) = ${year})`,
    });

    const balances: Map<string, LeaveBalance> = new Map();
    const types: Array<'annual' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'other'> = [
      'annual',
      'sick',
      'maternity',
      'paternity',
      'unpaid',
      'other',
    ];

    for (const type of types) {
      const usedDays = leaves
        .filter((l) => l.Type === type)
        .reduce((sum, l) => sum + l.DaysCount, 0);

      const totalDays = type === 'annual' ? 30 : type === 'sick' ? 10 : 0;

      balances.set(type, {
        EmployeeId: employeeId,
        LeaveType: type,
        TotalDays: totalDays,
        UsedDays: usedDays,
        RemainingDays: totalDays - usedDays,
        Year: year,
      });
    }

    return Array.from(balances.values());
  }
}
