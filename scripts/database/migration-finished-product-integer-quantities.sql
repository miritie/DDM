-- Migration : contraintes CHECK pour quantités entières sur produits finis.
--
-- Préalable validé : scripts/database/audit-fractional-quantities.ts a
-- confirmé zéro ligne fractionnaire sur toutes les colonnes ciblées.
--
-- Les colonnes « dosage MP » (recipe_lines, ingredient_consumptions,
-- ingredients.*, purchase_request_lines) ne sont volontairement PAS
-- touchées : elles doivent rester fractionnaires (kg / g / L).
--
-- Idempotente : utilise NOT EXISTS sur pg_constraint.

DO $$
BEGIN
  -- sale_items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sale_items_qty_integer') THEN
    ALTER TABLE sale_items
      ADD CONSTRAINT chk_sale_items_qty_integer
      CHECK (quantity = floor(quantity));
  END IF;

  -- stock_items
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_items_qty_integer') THEN
    ALTER TABLE stock_items
      ADD CONSTRAINT chk_stock_items_qty_integer
      CHECK (quantity = floor(quantity));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_items_min_integer') THEN
    ALTER TABLE stock_items
      ADD CONSTRAINT chk_stock_items_min_integer
      CHECK (minimum_stock = floor(minimum_stock));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_items_max_integer') THEN
    ALTER TABLE stock_items
      ADD CONSTRAINT chk_stock_items_max_integer
      CHECK (maximum_stock IS NULL OR maximum_stock = floor(maximum_stock));
  END IF;

  -- stock_movements
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_movements_qty_integer') THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT chk_stock_movements_qty_integer
      CHECK (quantity = floor(quantity));
  END IF;

  -- stock_alerts
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_alerts_current_integer') THEN
    ALTER TABLE stock_alerts
      ADD CONSTRAINT chk_stock_alerts_current_integer
      CHECK (current_quantity = floor(current_quantity));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_alerts_threshold_integer') THEN
    ALTER TABLE stock_alerts
      ADD CONSTRAINT chk_stock_alerts_threshold_integer
      CHECK (threshold_quantity = floor(threshold_quantity));
  END IF;

  -- production_orders
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_planned_integer') THEN
    ALTER TABLE production_orders
      ADD CONSTRAINT chk_po_planned_integer
      CHECK (planned_quantity = floor(planned_quantity));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_po_produced_integer') THEN
    ALTER TABLE production_orders
      ADD CONSTRAINT chk_po_produced_integer
      CHECK (produced_quantity = floor(produced_quantity));
  END IF;

  -- production_batches
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_batches_produced_integer') THEN
    ALTER TABLE production_batches
      ADD CONSTRAINT chk_batches_produced_integer
      CHECK (quantity_produced = floor(quantity_produced));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_batches_defective_integer') THEN
    ALTER TABLE production_batches
      ADD CONSTRAINT chk_batches_defective_integer
      CHECK (quantity_defective = floor(quantity_defective));
  END IF;

  -- recipes
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_recipes_output_integer') THEN
    ALTER TABLE recipes
      ADD CONSTRAINT chk_recipes_output_integer
      CHECK (output_quantity = floor(output_quantity));
  END IF;

  -- stock_transfer_lines
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stl_sent_integer') THEN
    ALTER TABLE stock_transfer_lines
      ADD CONSTRAINT chk_stl_sent_integer
      CHECK (qty_sent = floor(qty_sent));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stl_received_integer') THEN
    ALTER TABLE stock_transfer_lines
      ADD CONSTRAINT chk_stl_received_integer
      CHECK (qty_received = floor(qty_received));
  END IF;

  -- stand_replenishment_lines
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_srl_requested_integer') THEN
    ALTER TABLE stand_replenishment_lines
      ADD CONSTRAINT chk_srl_requested_integer
      CHECK (quantity_requested = floor(quantity_requested));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_srl_produced_integer') THEN
    ALTER TABLE stand_replenishment_lines
      ADD CONSTRAINT chk_srl_produced_integer
      CHECK (quantity_produced = floor(quantity_produced));
  END IF;

  -- stand_replenishment_targets
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_srt_target_integer') THEN
    ALTER TABLE stand_replenishment_targets
      ADD CONSTRAINT chk_srt_target_integer
      CHECK (quantity_target = floor(quantity_target));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_srt_received_integer') THEN
    ALTER TABLE stand_replenishment_targets
      ADD CONSTRAINT chk_srt_received_integer
      CHECK (quantity_received = floor(quantity_received));
  END IF;

  -- customer_order_lines
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_col_qty_integer') THEN
    ALTER TABLE customer_order_lines
      ADD CONSTRAINT chk_col_qty_integer
      CHECK (quantity = floor(quantity));
  END IF;
END $$;
