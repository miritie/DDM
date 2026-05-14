/**
 * Service - Gestion des Clients
 * Module Clients & Fidélité
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Customer, CustomerType, CustomerStatus, LoyaltyTier } from '@/types/modules';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();
const paymentMethodService = new PaymentMethodService();

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
    const customers = await postgresClient.list<Customer>('customers', {
      where: { workspace_id: workspaceId },
    });
    return `CUS-${String(customers.length + 1).padStart(4, '0')}`;
  }

  async create(input: CreateCustomerInput): Promise<Customer> {
    const existing = await postgresClient.list<Customer>('customers', {
      where: { workspace_id: input.workspaceId, phone: input.phone },
    });

    if (existing.length > 0) {
      throw new Error('Un client avec ce numéro de téléphone existe déjà');
    }

    const customerCode = await this.generateCustomerCode(input.workspaceId);

    // Préférence : résolution payment_method_id si fournie (la colonne legacy
    // preferred_payment_method a été supprimée en 2c).
    let preferredPaymentMethodId: string | null = null;
    if (input.preferredPaymentMethod) {
      const pm = await paymentMethodService.getByCode(input.workspaceId, input.preferredPaymentMethod);
      preferredPaymentMethodId = pm?.Id ?? null;
    }

    const customer: any = {
      CustomerId: uuidv4(),
      CustomerCode: customerCode,
      Type: input.type,
      Status: 'active' as const,
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
      LoyaltyTier: 'bronze' as const,
      LoyaltyPoints: 0,
      TotalPointsEarned: 0,
      TotalPointsRedeemed: 0,
      MemberSince: new Date().toISOString(),
      TotalOrders: 0,
      TotalSpent: 0,
      AverageOrderValue: 0,
      PreferredPaymentMethodId: preferredPaymentMethodId,
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

    const created = await postgresClient.create<Customer>('customers', customer);
    return created;
  }

  async getById(customerId: string): Promise<Customer | null> {
    // JOIN pour exposer le code du moyen de paiement préféré (alias legacy).
    const r = await postgresClient.query(
      `SELECT c.*, pm.code AS preferred_payment_method
       FROM customers c
       LEFT JOIN payment_methods pm ON pm.id = c.preferred_payment_method_id
       WHERE c.customer_id = $1 LIMIT 1`,
      [customerId]
    );
    if (r.rows.length === 0) return null;
    // Conversion snake_case → PascalCase manuelle (le client postgres a un helper
    // mais on l'a court-circuité avec le query direct).
    const row = r.rows[0];
    const mapped: any = {};
    for (const k in row) {
      const pk = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
      mapped[pk] = row[k];
    }
    return mapped as Customer;
  }

  async getByPhone(phone: string, workspaceId: string): Promise<Customer | null> {
    const customers = await postgresClient.list<Customer>('customers', {
      where: { workspace_id: workspaceId, phone: phone },
    });
    return customers.length > 0 ? customers[0] : null;
  }

  async list(workspaceId: string, filters: any = {}): Promise<Customer[]> {
    const where: any = { workspace_id: workspaceId };

    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.tier) where.loyalty_tier = filters.tier;
    if (filters.city) where.city = filters.city;
    if (filters.region) where.region = filters.region;

    return await postgresClient.list<Customer>('customers', {
      where,
      orderBy: { field: 'full_name', direction: 'asc' },
    });
  }

  async update(customerId: string, updates: UpdateCustomerInput): Promise<Customer> {
    const customers = await postgresClient.list<Customer>('customers', {
      where: { customer_id: customerId },
    });

    if (customers.length === 0) throw new Error('Client non trouvé');

    const customer: any = customers[0];
    const uuid = customer.Id || customer.id;
    if (!uuid) throw new Error('Customer ID is missing');

    const updateData: any = { UpdatedAt: new Date().toISOString() };

    // Résolution du code en payment_method_id (la colonne legacy preferred_payment_method a été supprimée en 2c).
    if (updates.preferredPaymentMethod !== undefined) {
      const workspaceId = customer.WorkspaceId;
      if (updates.preferredPaymentMethod === null || updates.preferredPaymentMethod === '') {
        updateData.PreferredPaymentMethodId = null;
      } else if (workspaceId) {
        const pm = await paymentMethodService.getByCode(workspaceId, updates.preferredPaymentMethod);
        updateData.PreferredPaymentMethodId = pm?.Id ?? null;
      }
    }

    Object.keys(updates).forEach((key) => {
      if (key === 'preferredPaymentMethod') return; // déjà traité ci-dessus
      if (updates[key as keyof UpdateCustomerInput] !== undefined) {
        // Convert first letter to uppercase for PascalCase
        const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
        updateData[pascalKey] = updates[key as keyof UpdateCustomerInput];
      }
    });

    const updated = await postgresClient.update<Customer>(
      'customers',
      uuid,
      updateData
    );
    return updated;
  }

  async updateStats(
    customerId: string,
    orderAmount: number,
    pointsEarned: number = 0
  ): Promise<Customer> {
    const customer = await this.getById(customerId);
    if (!customer) throw new Error('Client non trouvé');
    if (!customer.id) throw new Error('Customer ID is missing');

    const newTotalOrders = customer.TotalOrders + 1;
    const newTotalSpent = customer.TotalSpent + orderAmount;
    const newAverageOrderValue = newTotalSpent / newTotalOrders;

    const updated = await postgresClient.update<Customer>('customers', customer.id, {
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
    return updated;
  }

  async updateLoyaltyTier(customerId: string, newTier: LoyaltyTier): Promise<Customer> {
    const customers = await postgresClient.list<Customer>('customers', {
      where: { customer_id: customerId },
    });

    if (customers.length === 0) throw new Error('Client non trouvé');

    const customer = customers[0];
    if (!customer.id) throw new Error('Customer ID is missing');

    const updated = await postgresClient.update<Customer>('customers', customer.id, {
      LoyaltyTier: newTier,
      UpdatedAt: new Date().toISOString(),
    });
    return updated;
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

// Export singleton instance
export const customerService = new CustomerService();
