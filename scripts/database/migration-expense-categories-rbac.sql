-- ============================================================================
-- Migration — Catégories de dépenses + accès par rôle
-- ============================================================================
-- Permet de restreindre la visibilité/utilisation d'une catégorie de dépense
-- aux rôles autorisés. Si la colonne est NULL ou vide → la catégorie est
-- accessible à TOUS les utilisateurs (cas des fournitures de bureau, etc.).
--
-- Choix d'un UUID[] plutôt qu'une table d'association :
--   - Le nombre de rôles par catégorie reste petit (typiquement 1 à 4)
--   - Lectures fréquentes (à chaque ouverture d'un formulaire de dépense)
--   - Pas besoin d'ON DELETE CASCADE sophistiqué : un rôle supprimé reste
--     juste comme un UUID orphelin (ignoré au filtrage côté service).
--
-- Seede aussi un catalogue minimal de catégories typiques.
--
-- Idempotente.
-- ============================================================================

ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS allowed_role_ids UUID[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_expense_categories_allowed_role_ids
  ON expense_categories USING GIN (allowed_role_ids);

COMMENT ON COLUMN expense_categories.allowed_role_ids IS
  'Liste blanche des UUID de rôles autorisés à utiliser cette catégorie. NULL ou tableau vide = accessible à tous les utilisateurs.';

-- ----------------------------------------------------------------------------
-- Seed catalogue minimal de catégories OHADA-friendly
-- ----------------------------------------------------------------------------
-- Insertion idempotente (par code, par workspace). Les allowed_role_ids
-- restent NULL ici — un script séparé les configurera workspace par
-- workspace en s'appuyant sur les role_id business codes existants.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  ws RECORD;
  v_cat_uuid UUID;
BEGIN
  FOR ws IN SELECT id, workspace_id FROM workspaces LOOP

    -- Fournitures bureau (cahier, stylo, ramettes) — accessible à tous
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Fournitures de bureau', 'fournitures_bureau',
       'Cahiers, stylos, ramettes, classeurs, papèterie', false, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Transport / carburant — accessible à tous
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Transport & carburant', 'transport',
       'Carburant, taxi, déplacements professionnels', false, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Entretien locaux — accessible à tous
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Entretien & nettoyage', 'entretien_locaux',
       'Produits d''entretien, nettoyage, petite maintenance', false, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Communication — manager/admin
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Communication & télécom', 'communication',
       'Téléphone, internet, hébergement, services en ligne', false, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Marketing / publicité — commercial/admin
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Marketing & publicité', 'marketing_pub',
       'Publicité, supports promotionnels, événements', true, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Frais comptables — comptable uniquement
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Frais comptables & audit', 'frais_compta',
       'Honoraires comptables, audit, conseil financier', true, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Fiscalité — décideur/comptable
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Impôts & taxes', 'fiscalite',
       'Impôts, taxes, droits d''enregistrement, patente', true, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Formation — admin
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Formation & séminaires', 'formation',
       'Formations, séminaires, certifications du personnel', true, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Maintenance équipements — production/compta
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Maintenance équipements', 'maintenance_equip',
       'Entretien et réparation des machines de production', false, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Divers — accessible à tous (fallback)
    INSERT INTO expense_categories
      (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active)
    VALUES
      (gen_random_uuid()::text, 'Divers', 'divers',
       'Autres dépenses non catégorisées', true, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Configuration des accès par catégorie (par défaut sur tous les workspaces)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  ws RECORD;
  uuid_admin UUID;
  uuid_pca UUID;
  uuid_compta UUID;
  uuid_mgr_prod UUID;
  uuid_mgr_com UUID;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    SELECT id INTO uuid_admin     FROM roles WHERE role_id = 'admin'                 LIMIT 1;
    SELECT id INTO uuid_pca       FROM roles WHERE role_id = 'pca'                   LIMIT 1;
    SELECT id INTO uuid_compta    FROM roles WHERE role_id = 'manager_compta_stocks' LIMIT 1;
    SELECT id INTO uuid_mgr_prod  FROM roles WHERE role_id = 'manager_production'    LIMIT 1;
    SELECT id INTO uuid_mgr_com   FROM roles WHERE role_id = 'manager_commercial'    LIMIT 1;

    -- Fournitures bureau / transport / entretien / divers : NULL → accessible à tous (rien à faire)

    -- Communication : compta + admin + pca
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_pca, uuid_compta]::UUID[]
      WHERE code = 'communication' AND workspace_id = ws.id;

    -- Marketing / publicité : commercial + admin + pca
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_pca, uuid_mgr_com]::UUID[]
      WHERE code = 'marketing_pub' AND workspace_id = ws.id;

    -- Frais comptables : compta uniquement
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_compta]::UUID[]
      WHERE code = 'frais_compta' AND workspace_id = ws.id;

    -- Fiscalité : admin + pca + compta
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_pca, uuid_compta]::UUID[]
      WHERE code = 'fiscalite' AND workspace_id = ws.id;

    -- Formation : admin + pca
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_pca]::UUID[]
      WHERE code = 'formation' AND workspace_id = ws.id;

    -- Maintenance équipements : production + compta + admin
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_mgr_prod, uuid_compta]::UUID[]
      WHERE code = 'maintenance_equip' AND workspace_id = ws.id;

    -- Achat MP : production + compta + admin (déjà seedé par migration-production-v1)
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_mgr_prod, uuid_compta]::UUID[]
      WHERE code = 'achat_mp' AND workspace_id = ws.id;
  END LOOP;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'Migration expense_categories RBAC terminée. % catégories totales.',
    (SELECT COUNT(*) FROM expense_categories);
END $$;
