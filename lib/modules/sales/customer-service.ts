/**
 * Service - Gestion des Clients
 * Module Ventes & Encaissements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Client as Customer } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateCustomerInput {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  taxId?: string;
  creditLimit?: number;
  workspaceId: string;
}

export class CustomerService {
  /**
   * Créer un nouveau client
   */
  async create(input: CreateCustomerInput): Promise<Customer> {
    const code = input.code || await this.generateCustomerCode(input.workspaceId);

    const customer = {
      ClientId: uuidv4(),
      Name: input.name,
      Code: code,
      Email: input.email,
      Phone: input.phone,
      Address: input.address,
      CompanyName: input.companyName,
      TaxId: input.taxId,
      CreditLimit: input.creditLimit || 0,
      CurrentBalance: 0,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Customer>('clients', customer);
    return created;
  }

  /**
   * Générer un code client automatique (CLI-0001)
   */
  async generateCustomerCode(workspaceId: string): Promise<string> {
    const customers = await postgresClient.list<Customer>('clients', {
      where: { workspace_id: workspaceId },
    });

    return `CLI-${String(customers.length + 1).padStart(4, '0')}`;
  }

  /**
   * Récupérer un client par ID
   */
  async getById(customerId: string): Promise<Customer | null> {
    const customers = await postgresClient.list<Customer>('clients', {
      where: { client_id: customerId },
    });
    return customers.length > 0 ? customers[0] : null;
  }

  /**
   * Rechercher des clients (par nom, code, email, téléphone)
   */
  async search(workspaceId: string, query: string): Promise<Customer[]> {
    if (!query.trim()) {
      return this.list(workspaceId, { isActive: true });
    }

    const searchQuery = query.toLowerCase();
    const customers = await this.list(workspaceId, { isActive: true });

    return customers.filter(c =>
      c.Name.toLowerCase().includes(searchQuery) ||
      c.Code.toLowerCase().includes(searchQuery) ||
      (c.Email && c.Email.toLowerCase().includes(searchQuery)) ||
      (c.Phone && c.Phone.includes(searchQuery)) ||
      (c.CompanyName && c.CompanyName.toLowerCase().includes(searchQuery))
    );
  }

  /**
   * Lister les clients
   */
  async list(workspaceId: string, filters: { isActive?: boolean } = {}): Promise<Customer[]> {
    const where: Record<string, any> = { workspace_id: workspaceId };

    if (filters.isActive !== undefined) {
      where.is_active = filters.isActive;
    }

    return await postgresClient.list<Customer>('clients', {
      where,
      orderBy: { field: 'name', direction: 'asc' },
    });
  }

  /**
   * Mettre à jour un client
   */
  async update(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const customers = await postgresClient.list<Customer>('clients', {
      where: { client_id: customerId },
    });

    if (customers.length === 0) {
      throw new Error('Client non trouvé');
    }

    if (!customers[0].id) {
      throw new Error('Client ID manquant');
    }

    const dbUpdates: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };

    // Map PascalCase fields to PascalCase
    if (updates.Name !== undefined) dbUpdates.Name = updates.Name;
    if (updates.Code !== undefined) dbUpdates.Code = updates.Code;
    if (updates.Email !== undefined) dbUpdates.Email = updates.Email;
    if (updates.Phone !== undefined) dbUpdates.Phone = updates.Phone;
    if (updates.Address !== undefined) dbUpdates.Address = updates.Address;
    if (updates.CompanyName !== undefined) dbUpdates.CompanyName = updates.CompanyName;
    if (updates.TaxId !== undefined) dbUpdates.TaxId = updates.TaxId;
    if (updates.CreditLimit !== undefined) dbUpdates.CreditLimit = updates.CreditLimit;
    if (updates.CurrentBalance !== undefined) dbUpdates.CurrentBalance = updates.CurrentBalance;
    if (updates.IsActive !== undefined) dbUpdates.IsActive = updates.IsActive;

    const updated = await postgresClient.update<Customer>(
      'clients',
      customers[0].id,
      dbUpdates
    );
    return updated;
  }

  /**
   * Mettre à jour le solde client
   */
  async updateBalance(customerId: string, amount: number): Promise<Customer> {
    const customer = await this.getById(customerId);
    if (!customer) {
      throw new Error('Client non trouvé');
    }

    const newBalance = customer.CurrentBalance + amount;

    return await this.update(customerId, {
      CurrentBalance: newBalance,
    });
  }

  /**
   * Obtenir les clients avec des impayés
   */
  async getClientsWithBalance(workspaceId: string): Promise<Customer[]> {
    const customers = await this.list(workspaceId, { isActive: true });
    return customers.filter(c => c.CurrentBalance > 0);
  }

  /**
   * Statistiques clients
   */
  async getStatistics(workspaceId: string): Promise<{
    total: number;
    active: number;
    withBalance: number;
    totalBalance: number;
  }> {
    const allCustomers = await this.list(workspaceId);
    const activeCustomers = allCustomers.filter(c => c.IsActive);
    const withBalance = activeCustomers.filter(c => c.CurrentBalance > 0);
    const totalBalance = activeCustomers.reduce((sum, c) => sum + c.CurrentBalance, 0);

    return {
      total: allCustomers.length,
      active: activeCustomers.length,
      withBalance: withBalance.length,
      totalBalance,
    };
  }
}
