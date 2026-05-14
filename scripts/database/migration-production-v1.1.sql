-- ============================================================================
-- Migration PRODUCTION v1.1 — Lien OP ↔ réappro stand
-- ============================================================================
-- Ajoute production_orders.replenishment_id (symétrique de customer_order_id)
-- pour que le pont OP→stand_replenishment_orders puisse propager les statuts
-- (in_production / produced) automatiquement.
--
-- Idempotente.
-- ============================================================================

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS replenishment_id UUID
    REFERENCES stand_replenishment_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_orders_replenishment_id
  ON production_orders(replenishment_id);

DO $$ BEGIN
  RAISE NOTICE 'production_orders.replenishment_id ........ %',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='production_orders' AND column_name='replenishment_id'
    ) THEN 'OK' ELSE 'MANQUANT' END;
END $$;
