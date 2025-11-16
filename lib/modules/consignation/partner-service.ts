/**
 * Service - Gestion des Partenaires de Consignation
 * Module Consignation & Partenaires
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Partner, PartnerType, PartnerStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreatePartnerInput {
  name: string;
  type: PartnerType;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  contractStartDate: string;
  contractEndDate?: string;
  commissionRate: number;
  paymentTerms: number;
  currency?: string;
  notes?: string;
  tags?: string[];
  workspaceId: string;
}

export interface UpdatePartnerInput {
  name?: string;
  type?: PartnerType;
  status?: PartnerStatus;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  commissionRate?: number;
  paymentTerms?: number;
  notes?: string;
  tags?: string[];
}

export interface PartnerFilters {
  status?: PartnerStatus;
  type?: PartnerType;
  city?: string;
  region?: string;
  minBalance?: number;
  maxBalance?: number;
}

export class PartnerService {
  /**
   * Générer le code partenaire (PAR-0001, PAR-0002, etc.)
   */
  async generatePartnerCode(workspaceId: string): Promise<string> {
    const partners = await airtableClient.list<Partner>('Partner', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });
    return `PAR-${String(partners.length + 1).padStart(4, '0')}`;
  }

  /**
   * Créer un nouveau partenaire
   */
  async create(input: CreatePartnerInput): Promise<Partner> {
    // Validation: commission entre 0 et 100%
    if (input.commissionRate < 0 || input.commissionRate > 100) {
      throw new Error('Le taux de commission doit être entre 0 et 100%');
    }

    // Validation: termes de paiement positifs
    if (input.paymentTerms < 0) {
      throw new Error('Les termes de paiement doivent être positifs');
    }

    // Validation: téléphone unique
    const existing = await airtableClient.list<Partner>('Partner', {
      filterByFormula: `AND({WorkspaceId} = '${input.workspaceId}', {Phone} = '${input.phone}')`,
    });

    if (existing.length > 0) {
      throw new Error('Un partenaire avec ce numéro de téléphone existe déjà');
    }

    const partnerCode = await this.generatePartnerCode(input.workspaceId);

    const partner: Partial<Partner> = {
      PartnerId: uuidv4(),
      PartnerCode: partnerCode,
      Name: input.name,
      Type: input.type,
      Status: 'pending', // Par défaut en attente
      ContactPerson: input.contactPerson,
      Phone: input.phone,
      Email: input.email,
      Address: input.address,
      City: input.city,
      Region: input.region,
      ContractStartDate: input.contractStartDate,
      ContractEndDate: input.contractEndDate,
      CommissionRate: input.commissionRate,
      PaymentTerms: input.paymentTerms,
      TotalDeposited: 0,
      TotalSold: 0,
      TotalReturned: 0,
      CurrentBalance: 0,
      Currency: input.currency || 'XOF',
      Notes: input.notes,
      Tags: input.tags,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Partner>('Partner', partner);
  }

  /**
   * Récupérer un partenaire par son ID
   */
  async getById(partnerId: string): Promise<Partner | null> {
    const partners = await airtableClient.list<Partner>('Partner', {
      filterByFormula: `{PartnerId} = '${partnerId}'`,
    });
    return partners.length > 0 ? partners[0] : null;
  }

  /**
   * Récupérer un partenaire par son code
   */
  async getByCode(partnerCode: string, workspaceId: string): Promise<Partner | null> {
    const partners = await airtableClient.list<Partner>('Partner', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {PartnerCode} = '${partnerCode}')`,
    });
    return partners.length > 0 ? partners[0] : null;
  }

  /**
   * Lister les partenaires avec filtres
   */
  async list(workspaceId: string, filters: PartnerFilters = {}): Promise<Partner[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.type) {
      filterFormulas.push(`{Type} = '${filters.type}'`);
    }
    if (filters.city) {
      filterFormulas.push(`{City} = '${filters.city}'`);
    }
    if (filters.region) {
      filterFormulas.push(`{Region} = '${filters.region}'`);
    }
    if (filters.minBalance !== undefined) {
      filterFormulas.push(`{CurrentBalance} >= ${filters.minBalance}`);
    }
    if (filters.maxBalance !== undefined) {
      filterFormulas.push(`{CurrentBalance} <= ${filters.maxBalance}`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<Partner>('Partner', {
      filterByFormula,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Mettre à jour un partenaire
   */
  async update(partnerId: string, updates: UpdatePartnerInput): Promise<Partner> {
    const partners = await airtableClient.list<Partner>('Partner', {
      filterByFormula: `{PartnerId} = '${partnerId}'`,
    });

    if (partners.length === 0) {
      throw new Error('Partenaire non trouvé');
    }

    // Validation: commission entre 0 et 100%
    if (updates.commissionRate !== undefined) {
      if (updates.commissionRate < 0 || updates.commissionRate > 100) {
        throw new Error('Le taux de commission doit être entre 0 et 100%');
      }
    }

    // Validation: termes de paiement positifs
    if (updates.paymentTerms !== undefined && updates.paymentTerms < 0) {
      throw new Error('Les termes de paiement doivent être positifs');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.Name = updates.name;
    if (updates.type !== undefined) updateData.Type = updates.type;
    if (updates.status !== undefined) updateData.Status = updates.status;
    if (updates.contactPerson !== undefined) updateData.ContactPerson = updates.contactPerson;
    if (updates.phone !== undefined) updateData.Phone = updates.phone;
    if (updates.email !== undefined) updateData.Email = updates.email;
    if (updates.address !== undefined) updateData.Address = updates.address;
    if (updates.city !== undefined) updateData.City = updates.city;
    if (updates.region !== undefined) updateData.Region = updates.region;
    if (updates.contractStartDate !== undefined)
      updateData.ContractStartDate = updates.contractStartDate;
    if (updates.contractEndDate !== undefined)
      updateData.ContractEndDate = updates.contractEndDate;
    if (updates.commissionRate !== undefined) updateData.CommissionRate = updates.commissionRate;
    if (updates.paymentTerms !== undefined) updateData.PaymentTerms = updates.paymentTerms;
    if (updates.notes !== undefined) updateData.Notes = updates.notes;
    if (updates.tags !== undefined) updateData.Tags = updates.tags;

    return await airtableClient.update<Partner>(
      'Partner',
      (partners[0] as any)._recordId,
      updateData
    );
  }

  /**
   * Activer un partenaire
   */
  async activate(partnerId: string): Promise<Partner> {
    return await this.update(partnerId, { status: 'active' });
  }

  /**
   * Suspendre un partenaire
   */
  async suspend(partnerId: string): Promise<Partner> {
    return await this.update(partnerId, { status: 'suspended' });
  }

  /**
   * Désactiver un partenaire
   */
  async deactivate(partnerId: string): Promise<Partner> {
    return await this.update(partnerId, { status: 'inactive' });
  }

  /**
   * Mettre à jour les statistiques financières d'un partenaire
   */
  async updateFinancials(
    partnerId: string,
    updates: {
      totalDeposited?: number;
      totalSold?: number;
      totalReturned?: number;
      currentBalance?: number;
    }
  ): Promise<Partner> {
    const partners = await airtableClient.list<Partner>('Partner', {
      filterByFormula: `{PartnerId} = '${partnerId}'`,
    });

    if (partners.length === 0) {
      throw new Error('Partenaire non trouvé');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.totalDeposited !== undefined) updateData.TotalDeposited = updates.totalDeposited;
    if (updates.totalSold !== undefined) updateData.TotalSold = updates.totalSold;
    if (updates.totalReturned !== undefined) updateData.TotalReturned = updates.totalReturned;
    if (updates.currentBalance !== undefined) updateData.CurrentBalance = updates.currentBalance;

    return await airtableClient.update<Partner>(
      'Partner',
      (partners[0] as any)._recordId,
      updateData
    );
  }

  /**
   * Incrémenter les dépôts d'un partenaire
   */
  async incrementDeposited(partnerId: string, amount: number): Promise<Partner> {
    const partner = await this.getById(partnerId);
    if (!partner) throw new Error('Partenaire non trouvé');

    return await this.updateFinancials(partnerId, {
      totalDeposited: partner.TotalDeposited + amount,
    });
  }

  /**
   * Incrémenter les ventes d'un partenaire et ajuster le solde
   */
  async incrementSold(partnerId: string, salesAmount: number): Promise<Partner> {
    const partner = await this.getById(partnerId);
    if (!partner) throw new Error('Partenaire non trouvé');

    // Calculer la commission
    const commission = (salesAmount * partner.CommissionRate) / 100;
    const netAmount = salesAmount - commission;

    return await this.updateFinancials(partnerId, {
      totalSold: partner.TotalSold + salesAmount,
      currentBalance: partner.CurrentBalance + netAmount,
    });
  }

  /**
   * Incrémenter les retours d'un partenaire
   */
  async incrementReturned(partnerId: string, amount: number): Promise<Partner> {
    const partner = await this.getById(partnerId);
    if (!partner) throw new Error('Partenaire non trouvé');

    return await this.updateFinancials(partnerId, {
      totalReturned: partner.TotalReturned + amount,
    });
  }

  /**
   * Payer un partenaire (réduire le solde)
   */
  async pay(partnerId: string, amount: number): Promise<Partner> {
    const partner = await this.getById(partnerId);
    if (!partner) throw new Error('Partenaire non trouvé');

    if (amount > partner.CurrentBalance) {
      throw new Error('Le montant à payer dépasse le solde actuel');
    }

    return await this.updateFinancials(partnerId, {
      currentBalance: partner.CurrentBalance - amount,
    });
  }

  /**
   * Obtenir les statistiques des partenaires
   */
  async getStatistics(
    workspaceId: string
  ): Promise<{
    totalPartners: number;
    byStatus: Record<PartnerStatus, number>;
    byType: Record<PartnerType, number>;
    totalBalance: number;
    totalDeposited: number;
    totalSold: number;
    totalReturned: number;
    topPartnersBySales: Array<{ partnerId: string; name: string; totalSold: number }>;
  }> {
    const partners = await this.list(workspaceId);

    const totalPartners = partners.length;

    // Par statut
    const byStatus: Record<PartnerStatus, number> = {
      active: 0,
      inactive: 0,
      suspended: 0,
      pending: 0,
    };
    partners.forEach((p) => {
      byStatus[p.Status]++;
    });

    // Par type
    const byType: Record<PartnerType, number> = {
      pharmacy: 0,
      relay_point: 0,
      wholesaler: 0,
      retailer: 0,
      other: 0,
    };
    partners.forEach((p) => {
      byType[p.Type]++;
    });

    // Totaux financiers
    const totalBalance = partners.reduce((sum, p) => sum + p.CurrentBalance, 0);
    const totalDeposited = partners.reduce((sum, p) => sum + p.TotalDeposited, 0);
    const totalSold = partners.reduce((sum, p) => sum + p.TotalSold, 0);
    const totalReturned = partners.reduce((sum, p) => sum + p.TotalReturned, 0);

    // Top partenaires par ventes
    const topPartnersBySales = partners
      .sort((a, b) => b.TotalSold - a.TotalSold)
      .slice(0, 10)
      .map((p) => ({
        partnerId: p.PartnerId,
        name: p.Name,
        totalSold: p.TotalSold,
      }));

    return {
      totalPartners,
      byStatus,
      byType,
      totalBalance,
      totalDeposited,
      totalSold,
      totalReturned,
      topPartnersBySales,
    };
  }

  /**
   * Vérifier si un partenaire a un contrat actif
   */
  async hasActiveContract(partnerId: string): Promise<boolean> {
    const partner = await this.getById(partnerId);
    if (!partner) return false;

    const now = new Date();
    const startDate = new Date(partner.ContractStartDate);

    if (startDate > now) return false;

    if (partner.ContractEndDate) {
      const endDate = new Date(partner.ContractEndDate);
      if (endDate < now) return false;
    }

    return partner.Status === 'active';
  }

  /**
   * Obtenir les partenaires avec contrats expirant bientôt
   */
  async getExpiringContracts(
    workspaceId: string,
    daysAhead: number = 30
  ): Promise<Partner[]> {
    const partners = await this.list(workspaceId, { status: 'active' });

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return partners.filter((p) => {
      if (!p.ContractEndDate) return false;
      const endDate = new Date(p.ContractEndDate);
      return endDate >= now && endDate <= futureDate;
    });
  }
}
