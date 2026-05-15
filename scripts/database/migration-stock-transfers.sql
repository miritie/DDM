-- ============================================================================
-- Migration STOCK TRANSFERS — Mouvements 1→N avec workflow de réception
-- ============================================================================
-- Implémente :
--   - Source unique (entrepôt OU stand) qui éclate vers N destinations
--     (entrepôts ou stands, mélange libre)
--   - Workflow : émetteur déclenche → destinataire(s) reçoivent alerte →
--     chaque destinataire confirme (full / partiel / refus)
--   - Écarts conservés en trace, décision déléguée à l'émetteur ensuite
--     (déclarer en perte transit OU retour à la source)
--
-- Distinct du legacy `stock_movements` (qui reste pour les entrées/sorties
-- unitaires : production, ventes, démarques).
--
-- Idempotente.
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_status') THEN
    CREATE TYPE stock_transfer_status AS ENUM (
      'draft', 'in_transit', 'partially_received', 'fully_received', 'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_leg_status') THEN
    CREATE TYPE stock_transfer_leg_status AS ENUM (
      'pending', 'confirmed', 'adjusted', 'refused'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_shortfall') THEN
    CREATE TYPE stock_transfer_shortfall AS ENUM (
      'pending', 'declared_loss', 'returned_to_source'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- ENTÊTE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id VARCHAR(50) UNIQUE NOT NULL,
  transfer_number VARCHAR(50) NOT NULL,
  status stock_transfer_status DEFAULT 'draft' NOT NULL,

  -- Source : exactement une des deux (XOR contraint en CHECK)
  source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  source_outlet_id    UUID REFERENCES outlets(id)    ON DELETE SET NULL,

  initiated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  initiated_at    TIMESTAMP,
  closed_at       TIMESTAMP,                -- rempli quand toutes lignes terminées

  notes TEXT,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT chk_stock_transfers_one_source CHECK (
    (source_warehouse_id IS NOT NULL) <> (source_outlet_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_workspace ON stock_transfers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status    ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_src_wh    ON stock_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_src_out   ON stock_transfers(source_outlet_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_initiated_by ON stock_transfers(initiated_by_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stock_transfers_updated_at') THEN
    CREATE TRIGGER update_stock_transfers_updated_at
      BEFORE UPDATE ON stock_transfers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- LIGNES (= LEGS) — 1 produit × 1 destination
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_line_id VARCHAR(50) UNIQUE NOT NULL,
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,

  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(255),
  qty_sent     NUMERIC(15, 3) NOT NULL CHECK (qty_sent > 0),
  unit         VARCHAR(50),

  -- Destination : exactement une des deux
  destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  destination_outlet_id    UUID REFERENCES outlets(id)    ON DELETE SET NULL,

  qty_received   NUMERIC(15, 3) DEFAULT 0 NOT NULL,
  leg_status     stock_transfer_leg_status DEFAULT 'pending' NOT NULL,
  confirmed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at    TIMESTAMP,
  adjustment_reason TEXT,

  -- Décision sur écart : remplie par l'émetteur APRÈS un ajustement à la baisse
  shortfall_decision     stock_transfer_shortfall DEFAULT 'pending' NOT NULL,
  shortfall_decided_at   TIMESTAMP,
  shortfall_decided_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CONSTRAINT chk_stock_transfer_lines_one_dest CHECK (
    (destination_warehouse_id IS NOT NULL) <> (destination_outlet_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_stl_transfer    ON stock_transfer_lines(transfer_id);
CREATE INDEX IF NOT EXISTS idx_stl_product     ON stock_transfer_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_stl_dest_wh     ON stock_transfer_lines(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stl_dest_outlet ON stock_transfer_lines(destination_outlet_id);
CREATE INDEX IF NOT EXISTS idx_stl_status      ON stock_transfer_lines(leg_status);
CREATE INDEX IF NOT EXISTS idx_stl_shortfall   ON stock_transfer_lines(shortfall_decision)
  WHERE shortfall_decision = 'pending';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stock_transfer_lines_updated_at') THEN
    CREATE TRIGGER update_stock_transfer_lines_updated_at
      BEFORE UPDATE ON stock_transfer_lines
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Sanity check
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  RAISE NOTICE 'stock_transfers ............ %', CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name='stock_transfers'
  ) THEN 'OK' ELSE 'MANQUANT' END;
  RAISE NOTICE 'stock_transfer_lines ....... %', CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name='stock_transfer_lines'
  ) THEN 'OK' ELSE 'MANQUANT' END;
END $$;
