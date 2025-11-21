/**
 * Service - Gestion des Entrepôts
 * Module Stocks & Mouvements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Warehouse } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateWarehouseInput {
  name: string;
  location?: string;
  address?: string;
  managerId?: string;
  workspaceId: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  location?: string;
  address?: string;
  managerId?: string;
  isActive?: boolean;
}

/**
 * Service de gestion des entrepôts
 */
export class WarehouseService {
  /**
   * Génère un code entrepôt unique
   */
  async generateWarehouseCode(workspaceId: string): Promise<string> {
    const warehouses = await postgresClient.list<Warehouse>('warehouses', {
      filterByFormula: `{workspace_id} = '${workspaceId}'`,
    });

    const count = warehouses.length + 1;
    return `WH-${String(count).padStart(3, '0')}`;
  }

  /**
   * Crée un nouveau entrepôt
   */
  async create(input: CreateWarehouseInput): Promise<Warehouse> {
    const code = await this.generateWarehouseCode(input.workspaceId);

    const warehouse: Partial<Warehouse> = {
      WarehouseId: uuidv4(),
      Name: input.name,
      Code: code,
      Location: input.location,
      Address: input.address,
      ManagerId: input.managerId,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Warehouse>('warehouses', warehouse);
    return created;
  }

  /**
   * Récupère un entrepôt par ID
   */
  async getById(warehouseId: string): Promise<Warehouse | null> {
    const warehouses = await postgresClient.list<Warehouse>('warehouses', {
      filterByFormula: `{warehouse_id} = '${warehouseId}'`,
    });

    return warehouses.length > 0 ? warehouses[0] : null;
  }

  /**
   * Liste tous les entrepôts d'un workspace
   */
  async list(
    workspaceId: string,
    filters: { isActive?: boolean } = {}
  ): Promise<Warehouse[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.isActive !== undefined) {
      filterFormulas.push(`{is_active} = ${filters.isActive ? 1 : 0}`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<Warehouse>('warehouses', {
      filterByFormula,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Met à jour un entrepôt
   */
  async update(warehouseId: string, input: UpdateWarehouseInput): Promise<Warehouse> {
    const warehouses = await postgresClient.list<Warehouse>('warehouses', {
      filterByFormula: `{warehouse_id} = '${warehouseId}'`,
    });

    if (warehouses.length === 0) {
      throw new Error('Entrepôt non trouvé');
    }

    if (!warehouses[0].id) {
      throw new Error('ID d\'entrepôt manquant pour mise à jour');
    }

    const updates: Partial<Warehouse> = {
      Name: input.name,
      Location: input.location,
      Address: input.address,
      ManagerId: input.managerId,
      IsActive: input.isActive,
      UpdatedAt: new Date().toISOString(),
    };

    const updated = await postgresClient.update<Warehouse>(
      'warehouses',
      warehouses[0].id,
      updates
    );
    return updated;
  }

  /**
   * Désactive un entrepôt
   */
  async deactivate(warehouseId: string): Promise<Warehouse> {
    return await this.update(warehouseId, { isActive: false });
  }

  /**
   * Active un entrepôt
   */
  async activate(warehouseId: string): Promise<Warehouse> {
    return await this.update(warehouseId, { isActive: true });
  }
}
