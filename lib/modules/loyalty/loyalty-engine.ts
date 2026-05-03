/**
 * Moteur de fidélisation paramétrique
 *
 * Évalue toutes les règles actives d'un workspace contre l'état du client
 * et le contexte du panier. Retourne la règle prioritaire applicable + remise.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';

export type RewardType = 'percentage' | 'fixed_amount';

export interface LoyaltyRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;

  everyNthPurchase: number | null;
  minCartTotal: number | null;
  minItemCount: number | null;
  minTotalSpent: number | null;
  minTotalPurchases: number | null;
  windowDays: number | null;

  rewardType: RewardType;
  rewardValue: number;

  priority: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateLoyaltyRuleInput {
  workspaceId: string;
  name: string;
  description?: string;
  everyNthPurchase?: number | null;
  minCartTotal?: number | null;
  minItemCount?: number | null;
  minTotalSpent?: number | null;
  minTotalPurchases?: number | null;
  windowDays?: number | null;
  rewardType: RewardType;
  rewardValue: number;
  priority?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export type UpdateLoyaltyRuleInput = Partial<Omit<CreateLoyaltyRuleInput, 'workspaceId'>>;

export interface CartContext {
  total: number;
  itemCount: number;
}

export interface ClientMetrics {
  totalPurchases: number;
  totalSpent: number;
  purchasesInWindow: number;
  spentInWindow: number;
  lastPurchaseAt: string | null;
}

export interface RuleEvaluation {
  rule: LoyaltyRule;
  discountAmount: number;
  reasons: string[];
}

const SELECT_FIELDS = `
  id,
  workspace_id as "workspaceId",
  name,
  description,
  every_nth_purchase as "everyNthPurchase",
  min_cart_total as "minCartTotal",
  min_item_count as "minItemCount",
  min_total_spent as "minTotalSpent",
  min_total_purchases as "minTotalPurchases",
  window_days as "windowDays",
  reward_type as "rewardType",
  reward_value as "rewardValue",
  priority,
  is_active as "isActive",
  starts_at as "startsAt",
  ends_at as "endsAt",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const getDb = () => getPostgresClient();

function num(v: any): number {
  return v == null ? 0 : typeof v === 'number' ? v : parseFloat(v);
}

export class LoyaltyEngine {
  // ─── CRUD ─────────────────────────────────────────────────────────────

  async list(workspaceId: string, includeInactive = false): Promise<LoyaltyRule[]> {
    const db = getDb();
    const r = await db.query(
      `SELECT ${SELECT_FIELDS} FROM loyalty_rules
       WHERE workspace_id = $1
       ${includeInactive ? '' : 'AND is_active = true'}
       ORDER BY priority DESC, name ASC`,
      [workspaceId]
    );
    return r.rows;
  }

  async getById(id: string): Promise<LoyaltyRule | null> {
    const db = getDb();
    const r = await db.query(`SELECT ${SELECT_FIELDS} FROM loyalty_rules WHERE id = $1`, [id]);
    return r.rows[0] || null;
  }

  async create(input: CreateLoyaltyRuleInput): Promise<LoyaltyRule> {
    const db = getDb();
    const r = await db.query(
      `INSERT INTO loyalty_rules (
        workspace_id, name, description,
        every_nth_purchase, min_cart_total, min_item_count, min_total_spent, min_total_purchases, window_days,
        reward_type, reward_value, priority, is_active, starts_at, ends_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING ${SELECT_FIELDS}`,
      [
        input.workspaceId,
        input.name.trim(),
        input.description || null,
        input.everyNthPurchase ?? null,
        input.minCartTotal ?? null,
        input.minItemCount ?? null,
        input.minTotalSpent ?? null,
        input.minTotalPurchases ?? null,
        input.windowDays ?? null,
        input.rewardType,
        input.rewardValue,
        input.priority ?? 0,
        input.isActive ?? true,
        input.startsAt ?? null,
        input.endsAt ?? null,
      ]
    );
    return r.rows[0];
  }

  async update(id: string, input: UpdateLoyaltyRuleInput): Promise<LoyaltyRule> {
    const db = getDb();
    const set: string[] = [];
    const params: any[] = [];
    let i = 1;

    const map: Record<string, string> = {
      name: 'name',
      description: 'description',
      everyNthPurchase: 'every_nth_purchase',
      minCartTotal: 'min_cart_total',
      minItemCount: 'min_item_count',
      minTotalSpent: 'min_total_spent',
      minTotalPurchases: 'min_total_purchases',
      windowDays: 'window_days',
      rewardType: 'reward_type',
      rewardValue: 'reward_value',
      priority: 'priority',
      isActive: 'is_active',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
    };

    for (const [k, col] of Object.entries(map)) {
      if (k in input) {
        set.push(`${col} = $${i++}`);
        params.push((input as any)[k]);
      }
    }
    set.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const r = await db.query(
      `UPDATE loyalty_rules SET ${set.join(', ')} WHERE id = $${i} RETURNING ${SELECT_FIELDS}`,
      params
    );
    return r.rows[0];
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.query(`DELETE FROM loyalty_rules WHERE id = $1`, [id]);
  }

  // ─── Métriques client ────────────────────────────────────────────────

  /**
   * Récupère les métriques (lifetime + fenêtre la plus large utilisée parmi les règles actives).
   * On calcule par fenêtre à la demande pour rester précis.
   */
  async computeMetrics(
    clientId: string,
    workspaceId: string,
    windowDays: number | null
  ): Promise<ClientMetrics> {
    const db = getDb();

    const lifetime = await db.query(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total, MAX(created_at) as last
       FROM sales
       WHERE workspace_id = $1
         AND client_id = $2
         AND status NOT IN ('cancelled')`,
      [workspaceId, clientId]
    );

    let purchasesInWindow = num(lifetime.rows[0].cnt);
    let spentInWindow = num(lifetime.rows[0].total);

    if (windowDays && windowDays > 0) {
      const win = await db.query(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as total
         FROM sales
         WHERE workspace_id = $1
           AND client_id = $2
           AND status NOT IN ('cancelled')
           AND created_at >= NOW() - ($3::int * INTERVAL '1 day')`,
        [workspaceId, clientId, windowDays]
      );
      purchasesInWindow = num(win.rows[0].cnt);
      spentInWindow = num(win.rows[0].total);
    }

    return {
      totalPurchases: num(lifetime.rows[0].cnt),
      totalSpent: num(lifetime.rows[0].total),
      purchasesInWindow,
      spentInWindow,
      lastPurchaseAt: lifetime.rows[0].last || null,
    };
  }

  // ─── Évaluation ──────────────────────────────────────────────────────

  /**
   * Vérifie si une règle est applicable pour ce client + ce panier.
   * Toutes les conditions définies doivent être satisfaites (ET).
   * `includeCurrent=true` ajoute fictivement +1 achat (on évalue AVANT que la vente ne soit posée).
   */
  evaluateRule(
    rule: LoyaltyRule,
    metrics: ClientMetrics,
    cart: CartContext,
    now: Date = new Date()
  ): { matches: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (!rule.isActive) return { matches: false, reasons: ['Règle inactive'] };

    if (rule.startsAt && new Date(rule.startsAt) > now) {
      return { matches: false, reasons: ['Pas encore commencée'] };
    }
    if (rule.endsAt && new Date(rule.endsAt) < now) {
      return { matches: false, reasons: ['Période terminée'] };
    }

    // En POS, le client n'a pas encore "compté" cette vente. On ajoute +1 pour évaluer.
    const projectedPurchases = metrics.totalPurchases + 1;
    const projectedInWindow = metrics.purchasesInWindow + 1;
    const projectedSpent = metrics.totalSpent + cart.total;
    const projectedSpentInWindow = metrics.spentInWindow + cart.total;

    if (rule.everyNthPurchase != null && rule.everyNthPurchase > 0) {
      const target = rule.windowDays ? projectedInWindow : projectedPurchases;
      if (target % rule.everyNthPurchase !== 0) {
        return { matches: false, reasons: [`pas le ${rule.everyNthPurchase}e achat`] };
      }
      reasons.push(`${target}e achat (multiple de ${rule.everyNthPurchase})`);
    }

    if (rule.minCartTotal != null && cart.total < num(rule.minCartTotal)) {
      return { matches: false, reasons: [`panier < ${rule.minCartTotal}`] };
    }

    if (rule.minItemCount != null && cart.itemCount < rule.minItemCount) {
      return { matches: false, reasons: [`articles < ${rule.minItemCount}`] };
    }

    if (rule.minTotalSpent != null && projectedSpent < num(rule.minTotalSpent)) {
      return { matches: false, reasons: [`total dépensé < ${rule.minTotalSpent}`] };
    }

    if (rule.minTotalPurchases != null) {
      const target = rule.windowDays ? projectedInWindow : projectedPurchases;
      if (target < rule.minTotalPurchases) {
        return { matches: false, reasons: [`achats < ${rule.minTotalPurchases}`] };
      }
    }

    if (rule.minCartTotal != null) reasons.push(`panier ≥ ${rule.minCartTotal}`);
    if (rule.minItemCount != null) reasons.push(`${cart.itemCount} articles ≥ ${rule.minItemCount}`);

    return { matches: true, reasons };
  }

  /**
   * Calcule le montant de remise selon le type.
   */
  computeDiscount(rule: LoyaltyRule, cartTotal: number): number {
    const value = num(rule.rewardValue);
    if (rule.rewardType === 'percentage') {
      return Math.round((cartTotal * value) / 100);
    }
    return Math.min(value, cartTotal);
  }

  /**
   * Trouve la règle prioritaire applicable.
   */
  async findApplicable(
    workspaceId: string,
    clientId: string,
    cart: CartContext
  ): Promise<RuleEvaluation | null> {
    if (cart.total <= 0 || !clientId) return null;

    const rules = await this.list(workspaceId, false);
    if (rules.length === 0) return null;

    // Métriques : on prend le max(window_days) parmi les règles avec window pour optimiser.
    // Cette implémentation évalue au cas par cas — chaque règle utilisera ses propres métriques.
    const windowsNeeded = Array.from(
      new Set(rules.map((r) => r.windowDays).filter((w): w is number => w != null && w > 0))
    );

    // On calcule lifetime une fois ; pour chaque fenêtre distincte on requête.
    const lifetime = await this.computeMetrics(clientId, workspaceId, null);
    const windowMetrics = new Map<number, ClientMetrics>();
    for (const w of windowsNeeded) {
      windowMetrics.set(w, await this.computeMetrics(clientId, workspaceId, w));
    }

    let best: RuleEvaluation | null = null;
    for (const rule of rules) {
      const metrics = rule.windowDays
        ? windowMetrics.get(rule.windowDays) || lifetime
        : lifetime;
      const ev = this.evaluateRule(rule, metrics, cart);
      if (!ev.matches) continue;

      const discount = this.computeDiscount(rule, cart.total);
      if (discount <= 0) continue;

      const candidate: RuleEvaluation = { rule, discountAmount: discount, reasons: ev.reasons };

      if (
        !best ||
        rule.priority > best.rule.priority ||
        (rule.priority === best.rule.priority && discount > best.discountAmount)
      ) {
        best = candidate;
      }
    }

    return best;
  }
}
