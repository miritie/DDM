-- Migration : versements de caisse par un vendeur de stand
--
-- Workflow : le vendeur dépose tout ou partie de sa caisse espèces
-- soit à la banque, soit à un responsable (espèces remises), soit par
-- mobile money. À la création, le wallet source (caisse stand) est
-- DÉCRÉMENTÉ immédiatement (l'argent a quitté physiquement le tiroir).
-- Le comptable valide ou rejette ; en cas de rejet, le wallet est
-- re-crédité (annulation propre).
--
-- Pour banque et mobile_money : la destination DOIT être un wallet
-- configuré dans le système (destination_wallet_id NOT NULL).
-- Pour person (remise espèces à un responsable) : destination_label
-- texte libre (nom + qualité), pas de wallet destination.
--
-- Idempotente.

DO $$ BEGIN
  CREATE TYPE cash_deposit_destination_type AS ENUM ('bank', 'person', 'mobile_money');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cash_deposit_status AS ENUM ('pending', 'validated', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS cash_deposits (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id               VARCHAR(50) UNIQUE NOT NULL,
  outlet_id                UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
  wallet_source_id         UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  destination_type         cash_deposit_destination_type NOT NULL,
  destination_wallet_id    UUID REFERENCES wallets(id) ON DELETE RESTRICT,
  destination_label        VARCHAR(255),
  amount                   DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency                 VARCHAR(10) DEFAULT 'XOF' NOT NULL,
  reference                VARCHAR(255),
  evidence_url             TEXT,
  notes                    TEXT,
  status                   cash_deposit_status DEFAULT 'pending' NOT NULL,
  deposited_by_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  deposited_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  validated_by_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at             TIMESTAMP,
  workspace_id             UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Cohérence : bank/mobile_money exigent un wallet destination,
  -- person exige un libellé texte (pas de wallet).
  CONSTRAINT chk_cash_deposit_destination CHECK (
    (destination_type IN ('bank', 'mobile_money') AND destination_wallet_id IS NOT NULL)
    OR
    (destination_type = 'person' AND destination_wallet_id IS NULL AND destination_label IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cash_deposits_outlet   ON cash_deposits(outlet_id, deposited_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_deposits_status   ON cash_deposits(status, deposited_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_deposits_user     ON cash_deposits(deposited_by_id, deposited_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_deposits_workspace ON cash_deposits(workspace_id, deposited_at DESC);

-- Trigger updated_at (réutilise la fonction commune du schéma)
DROP TRIGGER IF EXISTS update_cash_deposits_updated_at ON cash_deposits;
CREATE TRIGGER update_cash_deposits_updated_at
  BEFORE UPDATE ON cash_deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
