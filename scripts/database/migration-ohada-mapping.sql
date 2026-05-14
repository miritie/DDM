-- ============================================================================
-- Migration — Plan comptable OHADA + mapping catégories & wallets
-- ============================================================================
-- 1. Seede un plan comptable OHADA minimal (classes 5 trésorerie, 6 charges,
--    44 TVA déductible) pour chaque workspace.
-- 2. Ajoute charge_account_id, tva_account_id, tva_rate sur expense_categories.
-- 3. Ajoute chart_account_id sur wallets (mapping vers compte de trésorerie).
-- 4. Mappe les catégories existantes à leur compte de charge OHADA.
--
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Plan comptable OHADA minimal
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP

    -- Classe 5 - Trésorerie (assets pour wallets)
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '521', 'Banques locales', 'asset', 'class_5', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '531', 'Chèques postaux', 'asset', 'class_5', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '571', 'Caisse en monnaies nationales', 'asset', 'class_5', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '551', 'Mobile money', 'asset', 'class_5', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- Classe 6 - Charges
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6011', 'Achats de matières premières', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6064', 'Fournitures de bureau', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6135', 'Locations & charges locatives', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6241', 'Transport sur achats', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6263', 'Frais de télécommunication', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6271', 'Annonces & insertions', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6281', 'Frais bancaires & financiers', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6324', 'Honoraires comptables', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6354', 'Impôts, taxes & versements assimilés', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6181', 'Entretien & maintenance', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6285', 'Frais de formation du personnel', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '6588', 'Autres charges diverses', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- Classe 4 - Tiers (TVA déductible)
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting)
    VALUES (gen_random_uuid()::text, '445660', 'TVA déductible sur biens & services', 'asset', 'class_4', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. expense_categories : mapping vers comptes OHADA
-- ----------------------------------------------------------------------------

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS charge_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL;

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS tva_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL;

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS tva_rate DECIMAL(5,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_expense_categories_charge_account
  ON expense_categories(charge_account_id) WHERE charge_account_id IS NOT NULL;

COMMENT ON COLUMN expense_categories.charge_account_id IS
  'Compte de charge OHADA (classe 6) à débiter lors du paiement d''une dépense de cette catégorie.';
COMMENT ON COLUMN expense_categories.tva_account_id IS
  'Compte TVA déductible (typiquement 44566x) à débiter si la dépense porte TVA. NULL = pas de TVA sur cette catégorie.';
COMMENT ON COLUMN expense_categories.tva_rate IS
  'Taux de TVA applicable (ex: 18.00 = 18%%). 0 = pas de TVA.';

-- Mapping par défaut (par workspace)
DO $$
DECLARE
  ws RECORD;
  v_acc UUID;
  v_tva UUID;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    -- TVA standard (référencé en commun pour les catégories qui portent TVA)
    SELECT id INTO v_tva FROM chart_accounts WHERE account_number = '445660' AND workspace_id = ws.id LIMIT 1;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6011' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code = 'achat_mp' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6064' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code = 'fournitures_bureau' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6241' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_rate = 0
      WHERE code = 'transport' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6181' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code IN ('entretien_locaux', 'maintenance_equip') AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6263' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code = 'communication' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6271' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code = 'marketing_pub' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6324' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code = 'frais_compta' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6354' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_rate = 0
      WHERE code = 'fiscalite' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6285' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_account_id = v_tva, tva_rate = 18
      WHERE code = 'formation' AND workspace_id = ws.id AND charge_account_id IS NULL;

    SELECT id INTO v_acc FROM chart_accounts WHERE account_number = '6588' AND workspace_id = ws.id LIMIT 1;
    UPDATE expense_categories SET charge_account_id = v_acc, tva_rate = 0
      WHERE code = 'divers' AND workspace_id = ws.id AND charge_account_id IS NULL;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. wallets : mapping vers compte de trésorerie
-- ----------------------------------------------------------------------------

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS chart_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wallets_chart_account_id
  ON wallets(chart_account_id) WHERE chart_account_id IS NOT NULL;

COMMENT ON COLUMN wallets.chart_account_id IS
  'Compte OHADA de trésorerie (classe 5) à crédirer lors d''un paiement depuis ce wallet. Mappage standard : cash → 571, mobile_money → 551, bank → 521.';

-- Mapping par défaut par type de wallet
DO $$
DECLARE
  ws RECORD;
  v_acc_cash UUID;
  v_acc_bank UUID;
  v_acc_mm UUID;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    SELECT id INTO v_acc_cash FROM chart_accounts WHERE account_number = '571' AND workspace_id = ws.id LIMIT 1;
    SELECT id INTO v_acc_bank FROM chart_accounts WHERE account_number = '521' AND workspace_id = ws.id LIMIT 1;
    SELECT id INTO v_acc_mm   FROM chart_accounts WHERE account_number = '551' AND workspace_id = ws.id LIMIT 1;

    UPDATE wallets SET chart_account_id = v_acc_cash WHERE workspace_id = ws.id AND type = 'cash'         AND chart_account_id IS NULL;
    UPDATE wallets SET chart_account_id = v_acc_bank WHERE workspace_id = ws.id AND type = 'bank'         AND chart_account_id IS NULL;
    UPDATE wallets SET chart_account_id = v_acc_mm   WHERE workspace_id = ws.id AND type = 'mobile_money' AND chart_account_id IS NULL;
  END LOOP;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'Migration OHADA terminée — % comptes seedés.',
    (SELECT COUNT(*) FROM chart_accounts);
END $$;
