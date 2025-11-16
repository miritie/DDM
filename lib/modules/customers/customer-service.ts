/**
 * Service - Gestion des Clients
 * Module Clients & Fidélité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Customer, CustomerType, CustomerStatus, LoyaltyTier } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateCustomerInput {
  type: CustomerType;
  firstName?: string;
  lastName?: string;
  fullName: string;
  companyName?: string;
  companyRegistration?: string;
  taxNumber?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  preferredPaymentMethod?: string;
  preferredLanguage?: string;
  receivePromotions?: boolean;
  receiveSMS?: boolean;
  receiveEmail?: boolean;
  assignedSalesAgentId?: string;
  assignedSalesAgentName?: string;
  tags?: string[];
  notes?: string;
  photoUrl?: string;
  workspaceId: string;
}

export interface UpdateCustomerInput {
  type?: CustomerType;
  status?: CustomerStatus;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  preferredPaymentMethod?: string;
  preferredLanguage?: string;
  receivePromotions?: boolean;
  receiveSMS?: boolean;
  receiveEmail?: boolean;
  assignedSalesAgentId?: string;
  assignedSalesAgentName?: string;
  tags?: string[];
  notes?: string;
  photoUrl?: string;
}

export class CustomerService {
  async generateCustomerCode(workspaceId: string): Promise<string> {
    const customers = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });
    return `CUS-${String(customers.length + 1).padStart(4, '0')}`;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const existing = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `AND({WorkspaceId} = '${input.workspaceId}', {Phone} = '${input.phone}')`,
    });

    if (existing.length > 0) {
      throw new Error('Un client avec ce numéro de téléphone existe déjà');
    }

    const customerCode = await this.generateCustomerCode(input.workspaceId);

    const customer: Partial<Customer> = {
      CustomerId: uuidv4(),
      CustomerCode: customerCode,
      Type: input.type,
      Status: 'active',
      FirstName: input.firstName,
      LastName: input.lastName,
      FullName: input.fullName,
      CompanyName: input.companyName,
      CompanyRegistration: input.companyRegistration,
      TaxNumber: input.taxNumber,
      Phone: input.phone,
      Email: input.email,
      Address: input.address,
      City: input.city,
      Region: input.region,
      Country: input.country,
      LoyaltyTier: 'bronze',
      LoyaltyPoints: 0,
      TotalPointsEarned: 0,
      TotalPointsRedeemed: 0,
      MemberSince: new Date().toISOString(),
      TotalOrders: 0,
      TotalSpent: 0,
      AverageOrderValue: 0,
      PreferredPaymentMethod: input.preferredPaymentMethod,
      PreferredLanguage: input.preferredLanguage || 'fr',
      ReceivePromotions: input.receivePromotions !== false,
      ReceiveSMS: input.receiveSMS !== false,
      ReceiveEmail: input.receiveEmail !== false,
      AssignedSalesAgentId: input.assignedSalesAgentId,
      AssignedSalesAgentName: input.assignedSalesAgentName,
      Tags: input.tags,
      Notes: input.notes,
      PhotoUrl: input.photoUrl,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Customer>('Customer', customer);
  }

  async getById(customerId: string): Promise<Customer | null> {
    const customers = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
    });
    return customers.length > 0 ? customers[0] : null;
  }

  async getByPhone(phone: string, workspaceId: string): Promise<Customer | null> {
    const customers = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Phone} = '${phone}')`,
    });
    return customers.length > 0 ? customers[0] : null;
  }

  async list(workspaceId: string, filters: any = {}): Promise<Customer[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.status) filterFormulas.push(`{Status} = '${filters.status}'`);
    if (filters.type) filterFormulas.push(`{Type} = '${filters.type}'`);
    if (filters.tier) filterFormulas.push(`{LoyaltyTier} = '${filters.tier}'`);
    if (filters.city) filterFormulas.push(`{City} = '${filters.city}'`);
    if (filters.region) filterFormulas.push(`{Region} = '${filters.region}'`);

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<Customer>('Customer', {
      filterByFormula,
      sort: [{ field: 'FullName', direction: 'asc' }],
    });
  }

  async update(customerId: string, updates: UpdateCustomerInput): Promise<Customer> {
    const customers = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
    });

    if (customers.length === 0) throw new Error('Client non trouvé');

    const updateData: any = { UpdatedAt: new Date().toISOString() };

    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof UpdateCustomerInput] !== undefined) {
        updateData[key.charAt(0).toUpperCase() + key.slice(1)] =
          updates[key as keyof UpdateCustomerInput];
      }
    });

    return await airtableClient.update<Customer>(
      'Customer',
      (customers[0] as any)._recordId,
      updateData
    );
  }

  async updateStats(
    customerId: string,
    orderAmount: number,
    pointsEarned: number = 0
  ): Promise<Customer> {
    const customer = await this.getById(customerId);
    if (!customer) throw new Error('Client non trouvé');

    const newTotalOrders = customer.TotalOrders + 1;
    const newTotalSpent = customer.TotalSpent + orderAmount;
    const newAverageOrderValue = newTotalSpent / newTotalOrders;

    return await airtableClient.update<Customer>('Customer', (customer as any)._recordId, {
      TotalOrders: newTotalOrders,
      TotalSpent: newTotalSpent,
      AverageOrderValue: newAverageOrderValue,
      LastOrderDate: new Date().toISOString(),
      LastOrderAmount: orderAmount,
      LastVisit: new Date().toISOString(),
      LoyaltyPoints: customer.LoyaltyPoints + pointsEarned,
      TotalPointsEarned: customer.TotalPointsEarned + pointsEarned,
      UpdatedAt: new Date().toISOString(),
    });
  }

  async updateLoyaltyTier(customerId: string, newTier: LoyaltyTier): Promise<Customer> {
    const customers = await airtableClient.list<Customer>('Customer', {
      filterByFormula: `{CustomerId} = '${customerId}'`,
    });

    if (customers.length === 0) throw new Error('Client non trouvé');

    return await airtableClient.update<Customer>('Customer', (customers[0] as any)._recordId, {
      LoyaltyTier: newTier,
      UpdatedAt: new Date().toISOString(),
    });
  }

  async search(workspaceId: string, query: string): Promise<Customer[]> {
    const customers = await this.list(workspaceId);

    if (!query) return customers;

    const lowercaseQuery = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.FullName.toLowerCase().includes(lowercaseQuery) ||
        c.CustomerCode.toLowerCase().includes(lowercaseQuery) ||
        c.Email?.toLowerCase().includes(lowercaseQuery) ||
        c.Phone?.includes(query) ||
        c.CompanyName?.toLowerCase().includes(lowercaseQuery)
    );
  }

  async activate(customerId: string): Promise<Customer> {
    return await this.update(customerId, { status: 'active' });
  }

  async deactivate(customerId: string): Promise<Customer> {
    return await this.update(customerId, { status: 'inactive' });
  }

  async suspend(customerId: string): Promise<Customer> {
    return await this.update(customerId, { status: 'suspended' });
  }

  async promoteToVIP(customerId: string): Promise<Customer> {
    return await this.update(customerId, { status: 'vip' });
  }

  async assignSalesAgent(customerId: string, salesAgentId: string, salesAgentName: string): Promise<Customer> {
    return await this.update(customerId, {
      assignedSalesAgentId: salesAgentId,
      assignedSalesAgentName: salesAgentName,
    });
  }

  async getTopCustomers(workspaceId: string, limit: number = 10): Promise<Customer[]> {
    const customers = await this.list(workspaceId);
    return customers
      .sort((a, b) => b.TotalSpent - a.TotalSpent)
      .slice(0, limit);
  }

  async getAtRiskCustomers(workspaceId: string, daysThreshold: number = 90): Promise<Customer[]> {
    const customers = await this.list(workspaceId);
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return customers.filter((customer) => {
      if (!customer.LastOrderDate) return true;
      return new Date(customer.LastOrderDate) < thresholdDate;
    });
  }

  async getStatistics(workspaceId: string): Promise<{
    totalCustomers: number;
    activeCustomers: number;
    vipCustomers: number;
    byTier: Record<LoyaltyTier, number>;
    byType: Record<'individual' | 'business', number>;
    averageOrderValue: number;
    totalRevenue: number;
    retentionRate: number;
  }> {
    const customers = await this.list(workspaceId);
    const activeCustomers = customers.filter((c) => c.Status === 'active');

    // Calculer le taux de rétention (clients ayant commandé dans les 90 derniers jours)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentCustomers = customers.filter((c) =>
      c.LastOrderDate && new Date(c.LastOrderDate) >= ninetyDaysAgo
    );

    return {
      totalCustomers: customers.length,
      activeCustomers: activeCustomers.length,
      vipCustomers: customers.filter((c) => c.Status === 'vip').length,
      byTier: {
        bronze: customers.filter((c) => c.LoyaltyTier === 'bronze').length,
        silver: customers.filter((c) => c.LoyaltyTier === 'silver').length,
        gold: customers.filter((c) => c.LoyaltyTier === 'gold').length,
        platinum: customers.filter((c) => c.LoyaltyTier === 'platinum').length,
        diamond: customers.filter((c) => c.LoyaltyTier === 'diamond').length,
      },
      byType: {
        individual: customers.filter((c) => c.Type === 'individual').length,
        business: customers.filter((c) => c.Type === 'business').length,
      },
      averageOrderValue: customers.length > 0
        ? customers.reduce((sum, c) => sum + c.AverageOrderValue, 0) / customers.length
        : 0,
      totalRevenue: customers.reduce((sum, c) => sum + c.TotalSpent, 0),
      retentionRate: customers.length > 0
        ? (recentCustomers.length / customers.length) * 100
        : 0,
    };
  }
}
