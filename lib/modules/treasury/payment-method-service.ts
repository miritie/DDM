/**
 * Service - Gestion des Moyens de Paiement
 * Module Trésorerie
 *
 * Table : payment_methods (créée en migration 2a, en parallèle de l'enum SQL)
 * Politique : pas de suppression — uniquement activate/deactivate. Les méthodes
 * `is_system=true` ne peuvent pas être désactivées définitivement ni renommées
 * sur leur code (mais leur label/icon/ordre sont éditables).
 *
 * NB : on utilise `where: {...}` plutôt que `filterByFormula` pour garantir
 * que les lookups sont des matches exacts (le parser legacy filterByFormula
 * du postgres-client renvoie tout en cas de formule non reconnue).
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { PaymentMethod, WalletType } from '@/types/modules';

const postgresClient = getPostgresClient();

export interface CreatePaymentMethodInput {
  code: string;
  label: string;
  requiredWalletType?: WalletType | null;
  displayOrder?: number;
  icon?: string | null;
  workspaceId: string;
}

export interface UpdatePaymentMethodInput {
  label?: string;
  requiredWalletType?: WalletType | null;
  displayOrder?: number;
  icon?: string | null;
}

export class PaymentMethodService {
  /** Liste les moyens de paiement d'un workspace. */
  async list(
    workspaceId: string,
    filters?: { isActive?: boolean }
  ): Promise<PaymentMethod[]> {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (filters?.isActive !== undefined) where.is_active = filters.isActive;
    return await postgresClient.list<PaymentMethod>('payment_methods', {
      where,
      orderBy: { field: 'display_order', direction: 'asc' },
    });
  }

  /** Récupère par code métier `payment_method_id`. */
  async getByBusinessId(paymentMethodId: string): Promise<PaymentMethod | null> {
    const r = await postgresClient.list<PaymentMethod>('payment_methods', {
      where: { payment_method_id: paymentMethodId },
      maxRecords: 1,
    });
    return r[0] || null;
  }

  /** Récupère par UUID interne (FK target). */
  async getByUuid(id: string): Promise<PaymentMethod | null> {
    const r = await postgresClient.list<PaymentMethod>('payment_methods', {
      where: { id },
      maxRecords: 1,
    });
    return r[0] || null;
  }

  /** Récupère par code fonctionnel + workspace (pour lookups POS / backfill). */
  async getByCode(workspaceId: string, code: string): Promise<PaymentMethod | null> {
    const r = await postgresClient.list<PaymentMethod>('payment_methods', {
      where: { workspace_id: workspaceId, code },
      maxRecords: 1,
    });
    return r[0] || null;
  }

  /**
   * Crée un moyen de paiement personnalisé (is_system=false).
   * Le code est unique par workspace.
   */
  async create(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    const code = input.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!code) throw new Error('Code invalide');

    const existing = await this.getByCode(input.workspaceId, code);
    if (existing) throw new Error(`Le code "${code}" existe déjà dans ce workspace.`);

    // ID métier court : PM-<8 chars workspace>-<code>
    const wsShort = input.workspaceId.substring(0, 8);
    const businessId = `PM-${wsShort}-${code}`.substring(0, 50);

    const row: Partial<PaymentMethod> = {
      PaymentMethodId: businessId,
      Code: code,
      Label: input.label.trim(),
      RequiredWalletType: input.requiredWalletType ?? null,
      DisplayOrder: input.displayOrder ?? 100,
      Icon: input.icon ?? null,
      IsActive: true,
      IsSystem: false,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };
    return await postgresClient.create<PaymentMethod>('payment_methods', row);
  }

  /** Met à jour label / type wallet requis / icon / ordre. Le code ne change jamais. */
  async update(paymentMethodId: string, updates: UpdatePaymentMethodInput): Promise<PaymentMethod> {
    const pm = await this.getByBusinessId(paymentMethodId);
    if (!pm) throw new Error('Moyen de paiement introuvable');
    if (!pm.Id) throw new Error('UUID interne introuvable');

    const data: Record<string, any> = { UpdatedAt: new Date().toISOString() };
    if (updates.label !== undefined) data.Label = updates.label.trim();
    if (updates.requiredWalletType !== undefined) data.RequiredWalletType = updates.requiredWalletType;
    if (updates.displayOrder !== undefined) data.DisplayOrder = updates.displayOrder;
    if (updates.icon !== undefined) data.Icon = updates.icon;

    return await postgresClient.update<PaymentMethod>('payment_methods', pm.Id, data);
  }

  /** Désactive (n'apparaît plus sur les nouveaux paiements ; conserve l'historique). */
  async deactivate(paymentMethodId: string): Promise<PaymentMethod> {
    const pm = await this.getByBusinessId(paymentMethodId);
    if (!pm) throw new Error('Moyen de paiement introuvable');
    if (!pm.Id) throw new Error('UUID interne introuvable');
    return await postgresClient.update<PaymentMethod>('payment_methods', pm.Id, {
      IsActive: false,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /** Réactive. */
  async activate(paymentMethodId: string): Promise<PaymentMethod> {
    const pm = await this.getByBusinessId(paymentMethodId);
    if (!pm) throw new Error('Moyen de paiement introuvable');
    if (!pm.Id) throw new Error('UUID interne introuvable');
    return await postgresClient.update<PaymentMethod>('payment_methods', pm.Id, {
      IsActive: true,
      UpdatedAt: new Date().toISOString(),
    });
  }
}
