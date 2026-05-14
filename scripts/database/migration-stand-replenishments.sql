-- ============================================================================
-- Migration : Approvisionnements stands (commandes internes manager commercial)
-- ============================================================================
-- Concept : le manager commercial demande la production / fourniture d'articles
-- pour alimenter un ou plusieurs stands. Valorisé (coût de revient) mais JAMAIS
-- payé (transfert interne). Lié optionnellement à un production_order.
--
-- 3 tables :
--   - stand_replenishment_orders     : entête de la demande
--   - stand_replenishment_lines      : lignes produits (qté totale demandée)
--   - stand_replenishment_targets    : ventilation par stand bénéficiaire
--                                      (autorise plusieurs livraisons partielles)
--
-- Migration entièrement additive et idempotente.
-- ============================================================================

-- PostgreSQL ne supporte pas `CREATE TYPE IF NOT EXISTS` — bloc conditionnel.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'replenishment_status') THEN
    CREATE TYPE replenishment_status AS ENUM (
      'draft', 'submitted', 'approved', 'in_production', 'produced', 'distributed', 'cancelled'
    );
  END IF;
END $$;

-- 1) Entête de la demande
CREATE TABLE IF NOT EXISTS stand_replenishment_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  replenishment_id VARCHAR(50) UNIQUE NOT NULL,
  replenishment_number VARCHAR(50) NOT NULL,
  status replenishment_status DEFAULT 'draft' NOT NULL,
  total_value_estimate DECIMAL(15, 2) DEFAULT 0 NOT NULL,
  notes TEXT,
  requested_delivery_date DATE,
  requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replenishment_orders_workspace_id ON stand_replenishment_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_orders_status      ON stand_replenishment_orders(status);
CREATE INDEX IF NOT EXISTS idx_replenishment_orders_requested_by ON stand_replenishment_orders(requested_by_id);

DROP TRIGGER IF EXISTS update_stand_replenishment_orders_updated_at ON stand_replenishment_orders;
CREATE TRIGGER update_stand_replenishment_orders_updated_at
  BEFORE UPDATE ON stand_replenishment_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Lignes produits (quantité totale demandée pour cet article)
CREATE TABLE IF NOT EXISTS stand_replenishment_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  replenishment_id UUID NOT NULL REFERENCES stand_replenishment_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255) NOT NULL,
  quantity_requested  DECIMAL(15, 3) NOT NULL,
  quantity_produced   DECIMAL(15, 3) DEFAULT 0 NOT NULL,
  unit_cost           DECIMAL(15, 2) DEFAULT 0 NOT NULL,
  line_total          DECIMAL(15, 2) DEFAULT 0 NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK (quantity_requested > 0)
);
CREATE INDEX IF NOT EXISTS idx_replenishment_lines_replenishment ON stand_replenishment_lines(replenishment_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_lines_product       ON stand_replenishment_lines(product_id);

-- 3) Cibles par stand — chaque ligne produit peut être ventilée sur plusieurs stands.
--    quantity_received accumule les distributions partielles successives.
CREATE TABLE IF NOT EXISTS stand_replenishment_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_id UUID NOT NULL REFERENCES stand_replenishment_lines(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  quantity_target   DECIMAL(15, 3) NOT NULL,
  quantity_received DECIMAL(15, 3) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE (line_id, outlet_id),
  CHECK (quantity_target > 0),
  CHECK (quantity_received >= 0 AND quantity_received <= quantity_target)
);
CREATE INDEX IF NOT EXISTS idx_replenishment_targets_line   ON stand_replenishment_targets(line_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_targets_outlet ON stand_replenishment_targets(outlet_id);

DROP TRIGGER IF EXISTS update_stand_replenishment_targets_updated_at ON stand_replenishment_targets;
CREATE TRIGGER update_stand_replenishment_targets_updated_at
  BEFORE UPDATE ON stand_replenishment_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) Lien des mouvements de distribution → target (pour traçabilité).
--    Sur stock_movements, on stocke replenishment_target_id (nullable) si le
--    mouvement a été déclenché par une distribution d'approvisionnement.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS replenishment_target_id UUID REFERENCES stand_replenishment_targets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_replenishment_target
  ON stock_movements(replenishment_target_id);
