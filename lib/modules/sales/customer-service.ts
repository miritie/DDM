/**
 * Service - Gestion des Clients
 * Module Ventes & Encaissements
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Client as Customer } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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

    const customer: Partial<Customer> = {
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

    return await airtableClient.create<Customer>('Client', customer);
  }

  /**
   * Générer un code client automatique (CLI-0001)
   */
  async generateCustomerCode(workspaceId: string): Promise<string> {
    const customers = await airtableClient.list<Customer>('Client', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    return `CLI-${String(customers.length + 1).padStart(4, '0')}`;
  }

  /**
   * Récupérer un client par ID
   */
  async getById(customerId: string): Promise<Customer | null> {
    const customers = await airtableClient.list<Customer>('Client', {
      filterByFormula: `{ClientId} = '${customerId}'`,
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
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.isActive !== undefined) {
      filterFormulas.push(`{IsActive} = ${filters.isActive ? '1' : '0'}`);
    }

    const filterByFormula = filterFormulas.length > 1
      ? `AND(${filterFormulas.join(', ')})`
      : filterFormulas[0];

    return await airtableClient.list<Customer>('Client', {
      filterByFormula,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Mettre à jour un client
   */
  async update(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const customers = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
    });

    if (customers.length === 0) {
      throw new Error('Client non trouvé');
    }

    return await airtableClient.update<Customer>(
      'Client',
      (customers[0] as any)._recordId,
      {
        ...updates,
        UpdatedAt: new Date().toISOString(),
      }
    );
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
