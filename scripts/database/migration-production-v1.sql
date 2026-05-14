-- ============================================================================
-- Migration PRODUCTION v1 — Matières premières, formules, achats MP
-- Date : 2026-05-14
-- ============================================================================
-- Étend le module production pour supporter :
--   (1) Distinction MP brute (raw) vs semi-fini fabricable (semi).
--   (2) Workflow ordre de production draft→submitted→approved→in_progress→completed.
--   (3) Lien customer_orders → production_orders (commande négociée déclenche l'OP).
--   (4) Sollicitation d'achat MP (purchase_request_lines greffées sur expense_requests)
--       qui à l'approbation crée automatiquement une expense (option (a) verrouillée).
--   (5) Traçabilité des réceptions (ingredient_receptions) pour recalcul PMP.
--
-- Idempotente : tous les ALTER/CREATE utilisent IF NOT EXISTS / DO blocks gardés.
-- La transaction est gérée par le script d'application (apply-migration-production-v1.ts).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ingredients : kind (raw|semi) + recipe_id si semi + supplier favori + PMP
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ingredient_kind') THEN
    CREATE TYPE ingredient_kind AS ENUM ('raw', 'semi');
  END IF;
END $$;

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS kind ingredient_kind NOT NULL DEFAULT 'raw';

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL;

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS preferred_supplier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- unit_cost existe déjà : on documente sa nouvelle sémantique
COMMENT ON COLUMN ingredients.unit_cost IS
  'PMP courant (Prix Moyen Pondéré) recalculé à chaque réception via IngredientService.receive()';

CREATE INDEX IF NOT EXISTS idx_ingredients_kind ON ingredients(kind);
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id);

-- ----------------------------------------------------------------------------
-- 2. production_order_status : ajout 'submitted'
-- ----------------------------------------------------------------------------
-- (déplacé dans le script d'application — ALTER TYPE ADD VALUE doit être
-- hors transaction pour pouvoir utiliser la valeur ailleurs ensuite)

-- ----------------------------------------------------------------------------
-- 3. production_orders : lien customer_order, snapshot recipe_version, audit
-- ----------------------------------------------------------------------------

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS customer_order_id UUID REFERENCES customer_orders(id) ON DELETE SET NULL;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS recipe_version INTEGER;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;

ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE production_orders
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_production_orders_customer_order_id ON production_orders(customer_order_id);

-- ----------------------------------------------------------------------------
-- 4. ingredient_consumptions : on garde unit_cost comme PMP figé à la conso.
--    (la colonne existe déjà ; on ajoute juste un commentaire)
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN ingredient_consumptions.unit_cost IS
  'PMP figé au moment de la consommation (snapshot, non recalculé après)';

-- ----------------------------------------------------------------------------
-- 5. purchase_request_lines : détail d'un achat MP greffé sur expense_requests
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS purchase_request_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_request_line_id VARCHAR(50) UNIQUE NOT NULL,
    expense_request_id UUID NOT NULL REFERENCES expense_requests(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    ingredient_name VARCHAR(255),
    supplier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    qty_requested DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    estimated_unit_price DECIMAL(15, 2) NOT NULL,
    estimated_total DECIMAL(15, 2) NOT NULL,
    qty_received DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    actual_total DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prl_expense_request_id ON purchase_request_lines(expense_request_id);
CREATE INDEX IF NOT EXISTS idx_prl_ingredient_id ON purchase_request_lines(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_prl_supplier_account_id ON purchase_request_lines(supplier_account_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_purchase_request_lines_updated_at') THEN
    CREATE TRIGGER update_purchase_request_lines_updated_at
      BEFORE UPDATE ON purchase_request_lines
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. ingredient_receptions : trace des entrées MP (pour PMP + historique)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ingredient_receptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reception_id VARCHAR(50) UNIQUE NOT NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    purchase_request_line_id UUID REFERENCES purchase_request_lines(id) ON DELETE SET NULL,
    supplier_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    qty DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    pmp_before DECIMAL(15, 2),
    pmp_after DECIMAL(15, 2),
    stock_before DECIMAL(10, 3),
    stock_after DECIMAL(10, 3),
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ir_ingredient_id ON ingredient_receptions(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ir_purchase_request_line_id ON ingredient_receptions(purchase_request_line_id);
CREATE INDEX IF NOT EXISTS idx_ir_received_at ON ingredient_receptions(received_at);
CREATE INDEX IF NOT EXISTS idx_ir_workspace_id ON ingredient_receptions(workspace_id);

-- ----------------------------------------------------------------------------
-- 7. expense_categories : seed catégorie 'achat_mp' (sollicitation MP)
-- ----------------------------------------------------------------------------

INSERT INTO expense_categories (id, expense_category_id, label, code, description, requires_pre_approval, icon, workspace_id)
SELECT
  uuid_generate_v4(),
  'EC-ACHAT-MP',
  'Achat matières premières',
  'achat_mp',
  'Sollicitation d''achat de matières premières pour la production',
  true,
  'Beaker',
  w.id
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories ec
  WHERE ec.workspace_id = w.id AND ec.code = 'achat_mp'
);

-- ============================================================================
-- Sanity check : afficher l'état après migration
-- ============================================================================
DO $$
DECLARE
  v_kind_count INT;
  v_prl_exists BOOLEAN;
  v_ir_exists BOOLEAN;
  v_submitted BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_kind_count FROM information_schema.columns
   WHERE table_name='ingredients' AND column_name='kind';
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='purchase_request_lines') INTO v_prl_exists;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='ingredient_receptions') INTO v_ir_exists;
  SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid='production_order_status'::regtype AND enumlabel='submitted') INTO v_submitted;

  RAISE NOTICE 'ingredients.kind ........... %', CASE WHEN v_kind_count=1 THEN 'OK' ELSE 'MANQUANT' END;
  RAISE NOTICE 'purchase_request_lines ..... %', CASE WHEN v_prl_exists THEN 'OK' ELSE 'MANQUANT' END;
  RAISE NOTICE 'ingredient_receptions ...... %', CASE WHEN v_ir_exists THEN 'OK' ELSE 'MANQUANT' END;
  RAISE NOTICE 'enum submitted ............. %', CASE WHEN v_submitted THEN 'OK' ELSE 'MANQUANT' END;
END $$;
