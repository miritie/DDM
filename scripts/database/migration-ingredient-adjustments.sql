-- ============================================================================
-- Migration — Table ingredient_adjustments (inventaire matières premières)
-- ============================================================================
-- Trace chaque ajustement de stock d'ingrédient (positif ou négatif) suite
-- à un inventaire physique. Complémente :
--   - ingredient_receptions  (entrées via achat MP)
--   - ingredient_consumptions (sorties via OP)
--   - ingredient_adjustments (écarts d'inventaire)
--
-- Chaque ajustement modifie ingredients.current_stock et garde un audit
-- trail complet (avant/après, raison, utilisateur, date).
--
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredient_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_id VARCHAR(50) UNIQUE NOT NULL,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  qty_delta DECIMAL(15, 3) NOT NULL,            -- + = surplus, - = manque
  stock_before DECIMAL(15, 3) NOT NULL,
  stock_after DECIMAL(15, 3) NOT NULL,
  reason TEXT,
  processed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingredient_adjustments_ingredient ON ingredient_adjustments(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_adjustments_workspace ON ingredient_adjustments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_adjustments_processed_at ON ingredient_adjustments(processed_at DESC);

COMMENT ON TABLE ingredient_adjustments IS
  'Ajustements de stock d''ingrédients suite à inventaire physique. Audit trail des écarts (théorique vs réel).';
COMMENT ON COLUMN ingredient_adjustments.qty_delta IS
  'Différence appliquée : positif = surplus (stock physique > théorique), négatif = manque (perte, casse, vol).';

DO $$ BEGIN
  RAISE NOTICE 'ingredient_adjustments créée.';
END $$;
