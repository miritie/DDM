-- ============================================================================
-- Migration — Index sur FK manquants (perf)
-- ============================================================================
-- Postgres n'indexe pas automatiquement les FK (contrairement aux PK).
-- Cette migration ajoute un index B-tree sur chaque colonne FK fréquemment
-- utilisée dans des WHERE / JOIN, pour éviter les seq scans sur les tables
-- volumineuses (expenses, transactions, stock_movements, production_orders…).
--
-- Tous CREATE INDEX IF NOT EXISTS — idempotente.
-- ============================================================================

-- expenses : filtres ultra-fréquents par catégorie / payeur / bénéficiaire
CREATE INDEX IF NOT EXISTS idx_expenses_category_id      ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer_id         ON expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_beneficiary_id   ON expenses(beneficiary_id) WHERE beneficiary_id IS NOT NULL;

-- expense_requests : category_id (le requester_id et status sont déjà indexés)
CREATE INDEX IF NOT EXISTS idx_expense_requests_category_id ON expense_requests(category_id);

-- expense_categories / expense_types : compte TVA & charge (joints à chaque write)
CREATE INDEX IF NOT EXISTS idx_expense_categories_tva_account_id ON expense_categories(tva_account_id) WHERE tva_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expense_types_charge_account_id    ON expense_types(charge_account_id)  WHERE charge_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expense_types_tva_account_id        ON expense_types(tva_account_id)     WHERE tva_account_id IS NOT NULL;

-- expense_approval_steps : approver_id pour "qui a approuvé quoi"
CREATE INDEX IF NOT EXISTS idx_expense_approval_steps_approver_id ON expense_approval_steps(approver_id);

-- transactions : processed_by (audit), source/destination wallet déjà indexés
CREATE INDEX IF NOT EXISTS idx_transactions_processed_by_id ON transactions(processed_by_id);

-- sale_payments : received_by_id, wallet_id (dashboard caisse)
CREATE INDEX IF NOT EXISTS idx_sale_payments_received_by_id ON sale_payments(received_by_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_wallet_id      ON sale_payments(wallet_id) WHERE wallet_id IS NOT NULL;

-- sales : loyalty_rule_id (moins fréquent mais utile pour reporting)
CREATE INDEX IF NOT EXISTS idx_sales_loyalty_rule_id ON sales(loyalty_rule_id) WHERE loyalty_rule_id IS NOT NULL;

-- production_orders : assignation, validation, recettes, entrepôts
CREATE INDEX IF NOT EXISTS idx_production_orders_approved_by_id            ON production_orders(approved_by_id) WHERE approved_by_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_assigned_to_id            ON production_orders(assigned_to_id) WHERE assigned_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_recipe_id                 ON production_orders(recipe_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_source_warehouse_id       ON production_orders(source_warehouse_id) WHERE source_warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_destination_warehouse_id  ON production_orders(destination_warehouse_id) WHERE destination_warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_submitted_by_id           ON production_orders(submitted_by_id) WHERE submitted_by_id IS NOT NULL;

-- customer_orders : recherches fréquentes par demandeur / approbateur / lien sale ou OP
CREATE INDEX IF NOT EXISTS idx_customer_orders_requested_by_id           ON customer_orders(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_approved_by_id            ON customer_orders(approved_by_id) WHERE approved_by_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_destination_outlet_id     ON customer_orders(destination_outlet_id) WHERE destination_outlet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_destination_warehouse_id  ON customer_orders(destination_warehouse_id) WHERE destination_warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_sale_id                   ON customer_orders(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_production_order_id       ON customer_orders(production_order_id) WHERE production_order_id IS NOT NULL;

-- stand_replenishment_orders : approbation, lien OP
CREATE INDEX IF NOT EXISTS idx_replenishment_orders_approved_by_id        ON stand_replenishment_orders(approved_by_id) WHERE approved_by_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_replenishment_orders_production_order_id   ON stand_replenishment_orders(production_order_id) WHERE production_order_id IS NOT NULL;

-- stock_movements : 6 FK toutes utiles selon les écrans (transferts, audits, sources)
CREATE INDEX IF NOT EXISTS idx_stock_movements_source_warehouse_id       ON stock_movements(source_warehouse_id) WHERE source_warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_destination_warehouse_id  ON stock_movements(destination_warehouse_id) WHERE destination_warehouse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_source_outlet_id          ON stock_movements(source_outlet_id) WHERE source_outlet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_destination_outlet_id     ON stock_movements(destination_outlet_id) WHERE destination_outlet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_processed_by_id            ON stock_movements(processed_by_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_validated_by_id            ON stock_movements(validated_by_id) WHERE validated_by_id IS NOT NULL;

-- ingredient_receptions / adjustments : audit + lien expense
CREATE INDEX IF NOT EXISTS idx_ingredient_receptions_received_by_id      ON ingredient_receptions(received_by_id) WHERE received_by_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingredient_receptions_supplier_account_id ON ingredient_receptions(supplier_account_id) WHERE supplier_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingredient_receptions_expense_id          ON ingredient_receptions(expense_id) WHERE expense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ingredient_adjustments_processed_by_id    ON ingredient_adjustments(processed_by_id);

-- journal_entries : qui a posté/validé (audit comptable)
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted_by_id    ON journal_entries(posted_by_id) WHERE posted_by_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_validated_by_id ON journal_entries(validated_by_id) WHERE validated_by_id IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE 'Index perf appliqués. % index totaux.',
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
END $$;
