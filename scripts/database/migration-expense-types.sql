-- ============================================================================
-- Migration — Types de dépense (enfant de catégories)
-- ============================================================================
-- Hiérarchie : expense_categories (groupe) > expense_types (poste précis)
-- Chaque type peut surcharger les attributs comptables de la catégorie
-- (charge_account, tva, taux, rôles autorisés). Si NULL → hérite de la
-- catégorie au runtime.
--
-- Les expense_requests et expenses gardent leur category_id, on ajoute
-- juste un expense_type_id (NULL si type "Autre" / pas de précision).
--
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_type_id VARCHAR(50) UNIQUE NOT NULL,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Surcharges optionnelles (sinon hérite de la catégorie au runtime)
  allowed_role_ids UUID[] DEFAULT NULL,
  charge_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
  tva_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
  tva_rate DECIMAL(5,2),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_types_category    ON expense_types(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_types_workspace   ON expense_types(workspace_id);
CREATE INDEX IF NOT EXISTS idx_expense_types_active      ON expense_types(is_active) WHERE is_active = true;

COMMENT ON TABLE expense_types IS
  'Poste de dépense précis sous une catégorie (ex: "Farine" sous "Matières premières"). Surcharge optionnellement les attributs comptables et droits d''accès de la catégorie.';
COMMENT ON COLUMN expense_types.charge_account_id IS
  'Compte de charge spécifique au type. Si NULL, on hérite du charge_account_id de la catégorie au moment du paiement.';
COMMENT ON COLUMN expense_types.tva_rate IS
  'Taux TVA spécifique. NULL = hérite de la catégorie. 0 = pas de TVA explicite.';
COMMENT ON COLUMN expense_types.allowed_role_ids IS
  'Restriction par rôle au niveau type (surcharge celle de la catégorie). NULL = hérite de la catégorie.';

-- ----------------------------------------------------------------------------
-- Ajout de expense_type_id sur expense_requests et expenses
-- ----------------------------------------------------------------------------

ALTER TABLE expense_requests
  ADD COLUMN IF NOT EXISTS expense_type_id UUID REFERENCES expense_types(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS expense_type_id UUID REFERENCES expense_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_requests_type_id ON expense_requests(expense_type_id) WHERE expense_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_type_id         ON expenses(expense_type_id) WHERE expense_type_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Seed des catégories étendues (alignement sur le besoin métier)
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

    -- Nouvelles catégories métier (si manquantes)
    INSERT INTO expense_categories (expense_category_id, label, code, description, requires_pre_approval, workspace_id, is_active) VALUES
      (gen_random_uuid()::text, 'Salaires & charges sociales', 'salaires_charges',
       'Salaires nets, primes, indemnités, charges patronales CNPS, médecine du travail', true, ws.id, true),
      (gen_random_uuid()::text, 'Obligations administratives', 'obligations_administratives',
       'Frais bancaires, honoraires comptables/légaux, assurances, cotisations professionnelles', true, ws.id, true),
      (gen_random_uuid()::text, 'Fonctionnement', 'fonctionnement',
       'Eau, électricité, loyer, internet, carburant, entretien locaux, fournitures bureau, missions', false, ws.id, true),
      (gen_random_uuid()::text, 'Emballages', 'emballages',
       'Sachets, cartons, étiquettes, emballages perdus et récupérables', false, ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Renommage des catégories Phase A pour cohérence métier (idempotent)
    UPDATE expense_categories SET label = 'Matières premières' WHERE code = 'achat_mp' AND workspace_id = ws.id;
    UPDATE expense_categories SET label = 'Obligations fiscales' WHERE code = 'fiscalite' AND workspace_id = ws.id;
    UPDATE expense_categories SET label = 'Marketing & commercial' WHERE code = 'marketing_pub' AND workspace_id = ws.id;
    UPDATE expense_categories SET label = 'Formations' WHERE code = 'formation' AND workspace_id = ws.id;

    -- Désactivation des catégories Phase A devenues redondantes (couvertes par "Fonctionnement")
    UPDATE expense_categories SET is_active = false
      WHERE code IN ('communication', 'transport', 'entretien_locaux', 'fournitures_bureau', 'maintenance_equip', 'frais_compta')
        AND workspace_id = ws.id;

    -- Refresh accès rôles
    SELECT id INTO uuid_admin     FROM roles WHERE role_id = 'admin'                 LIMIT 1;
    SELECT id INTO uuid_pca       FROM roles WHERE role_id = 'pca'                   LIMIT 1;
    SELECT id INTO uuid_compta    FROM roles WHERE role_id = 'manager_compta_stocks' LIMIT 1;
    SELECT id INTO uuid_mgr_prod  FROM roles WHERE role_id = 'manager_production'    LIMIT 1;
    SELECT id INTO uuid_mgr_com   FROM roles WHERE role_id = 'manager_commercial'    LIMIT 1;

    -- Salaires : RH/compta/admin
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_pca, uuid_compta]::UUID[]
      WHERE code = 'salaires_charges' AND workspace_id = ws.id;

    -- Obligations administratives : compta/admin
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_pca, uuid_compta]::UUID[]
      WHERE code = 'obligations_administratives' AND workspace_id = ws.id;

    -- Fonctionnement : public (tous), comme avant
    UPDATE expense_categories SET allowed_role_ids = NULL
      WHERE code = 'fonctionnement' AND workspace_id = ws.id;

    -- Emballages : prod/compta/admin
    UPDATE expense_categories SET allowed_role_ids = ARRAY[uuid_admin, uuid_mgr_prod, uuid_compta]::UUID[]
      WHERE code = 'emballages' AND workspace_id = ws.id;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Seed des TYPES (postes précis sous chaque catégorie)
--
-- Pour chaque (catégorie, type, compte_charge) on insère via SELECT pour
-- résoudre les UUIDs (catégorie + compte) au moment de l'INSERT. Idempotent
-- via ON CONFLICT (code, workspace_id).
-- ----------------------------------------------------------------------------

INSERT INTO expense_types (expense_type_id, category_id, label, code, charge_account_id, tva_account_id, tva_rate, workspace_id, is_active)
SELECT
  gen_random_uuid()::text,
  ec.id,
  v.label,
  v.code,
  ca.id,
  tva.id,
  v.tva_rate,
  ec.workspace_id,
  true
FROM (VALUES
  -- (cat_code, type_code, label, account_number, tva_rate)
  -- MATIÈRES PREMIÈRES
  ('achat_mp',   'mp_farine',         'Farine',                       '6021', 18.0),
  ('achat_mp',   'mp_sucre',          'Sucre',                        '6021', 18.0),
  ('achat_mp',   'mp_oeufs',          'Œufs',                         '6021', 18.0),
  ('achat_mp',   'mp_lait',           'Lait',                         '6021', 18.0),
  ('achat_mp',   'mp_levure',         'Levure',                       '6021', 18.0),
  ('achat_mp',   'mp_beurre',         'Beurre / Matières grasses',    '6021', 18.0),
  ('achat_mp',   'mp_cacao',          'Cacao / Chocolat',             '6021', 18.0),
  ('achat_mp',   'mp_fruits',         'Fruits & garnitures',          '6021', 18.0),
  ('achat_mp',   'mp_additifs',       'Sel, additifs, arômes',        '6041', 18.0),
  ('achat_mp',   'mp_autres',         'Autres matières premières',    '6021', 18.0),
  -- EMBALLAGES
  ('emballages', 'emb_sachets',       'Sachets / sacs',               '6081', 18.0),
  ('emballages', 'emb_cartons',       'Cartons d''emballage',         '6081', 18.0),
  ('emballages', 'emb_etiquettes',    'Étiquettes & marquage',        '6081', 18.0),
  ('emballages', 'emb_jetables',      'Plats / barquettes jetables',  '6081', 18.0),
  -- SALAIRES & CHARGES (pas de TVA)
  ('salaires_charges', 'sal_nets',        'Salaires nets',                          '6611', 0.0),
  ('salaires_charges', 'sal_primes',      'Primes & gratifications',                '6612', 0.0),
  ('salaires_charges', 'sal_conges',      'Congés payés',                           '6613', 0.0),
  ('salaires_charges', 'sal_indem_lic',   'Indemnités licenciement/préavis',        '6614', 0.0),
  ('salaires_charges', 'sal_indem_mal',   'Indemnités maladie',                     '6615', 0.0),
  ('salaires_charges', 'sal_indem_tpt',   'Indemnité transport / déplacement',      '6638', 0.0),
  ('salaires_charges', 'sal_avantages',   'Avantages en nature',                    '6617', 0.0),
  ('salaires_charges', 'sal_cnps',        'Charges sociales (CNPS)',                '6641', 0.0),
  ('salaires_charges', 'sal_medecine',    'Médecine du travail',                    '6684', 0.0),
  ('salaires_charges', 'sal_interim',     'Personnel intérimaire',                  '6371', 18.0),
  ('salaires_charges', 'sal_recrutement', 'Frais de recrutement',                   '6381', 18.0),
  ('salaires_charges', 'sal_formation',   'Frais de formation',                     '6331', 18.0),
  -- OBLIGATIONS FISCALES (pas de TVA)
  ('fiscalite', 'fisc_foncier',   'Impôt foncier',                       '6411', 0.0),
  ('fiscalite', 'fisc_patente',   'Patente / licence',                   '6412', 0.0),
  ('fiscalite', 'fisc_its',       'Impôt sur traitements & salaires',    '6413', 0.0),
  ('fiscalite', 'fisc_apprent',   'Taxe d''apprentissage',               '6414', 0.0),
  ('fiscalite', 'fisc_fdfp',      'Formation prof. continue (FDFP)',     '6415', 0.0),
  ('fiscalite', 'fisc_timbre',    'Droits de timbre',                    '6462', 0.0),
  ('fiscalite', 'fisc_vignettes', 'Vignettes véhicules',                 '6464', 0.0),
  ('fiscalite', 'fisc_vehicules', 'Taxe véhicules de société',           '6463', 0.0),
  ('fiscalite', 'fisc_penalites', 'Pénalités fiscales',                  '6478', 0.0),
  -- OBLIGATIONS ADMINISTRATIVES
  ('obligations_administratives', 'oa_frais_bq',    'Frais bancaires',                  '6311', 0.0),
  ('obligations_administratives', 'oa_compta',      'Honoraires comptable',             '6324', 18.0),
  ('obligations_administratives', 'oa_avocat',      'Honoraires avocat / conseil',      '6324', 18.0),
  ('obligations_administratives', 'oa_actes',       'Frais d''actes & contentieux',     '6325', 0.0),
  ('obligations_administratives', 'oa_cotisations', 'Cotisations professionnelles',     '6351', 0.0),
  ('obligations_administratives', 'oa_assur_mr',    'Assurances multirisques',          '6251', 18.0),
  ('obligations_administratives', 'oa_assur_veh',   'Assurances véhicules',             '6252', 18.0),
  ('obligations_administratives', 'oa_dons',        'Dons & mécénat',                   '6582', 0.0),
  ('obligations_administratives', 'oa_logiciels',   'Redevances logiciels',             '6342', 18.0),
  -- FONCTIONNEMENT
  ('fonctionnement', 'fct_eau',         'Eau',                                '6051', 18.0),
  ('fonctionnement', 'fct_elec',        'Électricité',                        '6052', 18.0),
  ('fonctionnement', 'fct_gaz',         'Gaz / autres énergies',              '6053', 18.0),
  ('fonctionnement', 'fct_loyer',       'Loyer locaux',                       '6222', 0.0),
  ('fonctionnement', 'fct_tel',         'Téléphone fixe',                     '6281', 18.0),
  ('fonctionnement', 'fct_internet',    'Internet & abonnements',             '6288', 18.0),
  ('fonctionnement', 'fct_carburant',   'Carburant véhicules',                '6181', 18.0),
  ('fonctionnement', 'fct_entretien',   'Entretien locaux',                   '6241', 18.0),
  ('fonctionnement', 'fct_maintenance', 'Maintenance équipements',            '6243', 18.0),
  ('fonctionnement', 'fct_nettoyage',   'Produits d''entretien & nettoyage',  '6043', 18.0),
  ('fonctionnement', 'fct_fourn_bur',   'Fournitures de bureau',              '6055', 18.0),
  ('fonctionnement', 'fct_outillage',   'Petit matériel & outillage',         '6056', 18.0),
  ('fonctionnement', 'fct_receptions',  'Réceptions',                         '6383', 18.0),
  ('fonctionnement', 'fct_missions',    'Missions & déplacements',            '6384', 0.0),
  ('fonctionnement', 'fct_tpt_pers',    'Transport du personnel',             '614',  0.0),
  -- MARKETING
  ('marketing_pub', 'mkt_annonces',    'Publicité / annonces',     '6271', 18.0),
  ('marketing_pub', 'mkt_imprimes',    'Imprimés & catalogues',    '6272', 18.0),
  ('marketing_pub', 'mkt_echant',      'Échantillons promotionnels','6273', 18.0),
  ('marketing_pub', 'mkt_foires',      'Foires & salons',          '6274', 18.0),
  ('marketing_pub', 'mkt_cadeaux',     'Cadeaux clients',          '6276', 18.0),
  ('marketing_pub', 'mkt_commissions', 'Commissions sur ventes',   '6322', 18.0),
  -- FORMATIONS
  ('formation', 'form_continue',   'Formation continue interne',     '6331', 18.0),
  ('formation', 'form_seminaires', 'Séminaires / colloques externes','6277', 18.0),
  -- DIVERS
  ('divers', 'div_autres', 'Autres charges diverses', '6588', 0.0)
) AS v(cat_code, code, label, account_number, tva_rate)
JOIN expense_categories ec ON ec.code = v.cat_code
JOIN chart_accounts ca     ON ca.account_number = v.account_number AND ca.workspace_id = ec.workspace_id
LEFT JOIN chart_accounts tva ON tva.account_number = '445660' AND tva.workspace_id = ec.workspace_id AND v.tva_rate > 0
ON CONFLICT (code, workspace_id) DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE 'expense_types seed terminé. % types au total.',
    (SELECT COUNT(*) FROM expense_types);
END $$;
