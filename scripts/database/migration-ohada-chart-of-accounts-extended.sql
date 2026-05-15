-- ============================================================================
-- Migration — Plan comptable OHADA étendu pour activité de production
-- ============================================================================
-- Extension du plan minimal seedé en Phase B avec les comptes pertinents
-- pour une activité de production alimentaire / boulangerie avec ventes
-- en stands. Pioché dans le SYSCOHADA officiel (classes 4, 5, 6, 7).
--
-- Idempotente : ON CONFLICT DO NOTHING sur (account_number, workspace_id).
-- ============================================================================

DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP

    -- ========================================================================
    -- CLASSE 4 — Tiers (TVA, fournisseurs, personnel)
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '401', 'Fournisseurs d''exploitation', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '421', 'Personnel - rémunérations dues', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '422', 'Personnel - rémunérations dues (étrangers)', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '423', 'Personnel - oppositions, saisies', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '425', 'Personnel - avances et acomptes', 'asset', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '431', 'Sécurité sociale (CNPS)', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '441', 'État - impôt sur les bénéfices', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '442', 'État - autres impôts et taxes', 'liability', 'class_4', ws.id, true),
      (gen_random_uuid()::text, '4434', 'État - TVA facturée (collectée)', 'liability', 'class_4', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 5 — Trésorerie (subdivisions optionnelles par wallet)
    -- ========================================================================
    -- 521 (banques) et 571 (caisse) déjà seedés en Phase B
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '5211', 'Banques locales — compte principal', 'asset', 'class_5', ws.id, true),
      (gen_random_uuid()::text, '5511', 'Mobile Money — Wave', 'asset', 'class_5', ws.id, true),
      (gen_random_uuid()::text, '5512', 'Mobile Money — Orange Money', 'asset', 'class_5', ws.id, true),
      (gen_random_uuid()::text, '5513', 'Mobile Money — MTN Money', 'asset', 'class_5', ws.id, true),
      (gen_random_uuid()::text, '5711', 'Caisse — Usine', 'asset', 'class_5', ws.id, true),
      (gen_random_uuid()::text, '5712', 'Caisse — Stand principal', 'asset', 'class_5', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 60 — Achats (déjà seedé 6011, 6064 ; on étend)
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6021', 'Achats de matières premières (dans la région)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6022', 'Achats de matières premières (hors région)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6041', 'Matières consommables (sel, additifs, etc.)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6042', 'Matières combustibles (gaz, fuel)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6043', 'Produits d''entretien', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6044', 'Fournitures d''atelier et d''usine', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6047', 'Fournitures de bureau stockables', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6051', 'Eau (non stockable)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6052', 'Électricité', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6053', 'Autres énergies (gaz, fuel non stockable)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6054', 'Fournitures entretien non stockables', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6055', 'Fournitures bureau non stockables', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6056', 'Petit matériel et outillage', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6057', 'Achats d''études et prestations de services', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6058', 'Travaux, matériels et équipements (non immo.)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6081', 'Emballages perdus (sachets, cartons)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6082', 'Emballages récupérables non identifiables', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 61 — Transports
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '611', 'Transports sur achats', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '612', 'Transports sur ventes', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '614', 'Transports du personnel', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6181', 'Voyages et déplacements', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 62 — Services Extérieurs A
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6222', 'Locations de bâtiments (loyer)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6223', 'Locations matériels et outillages', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6225', 'Locations d''emballages', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6241', 'Entretien & réparations biens immobiliers', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6242', 'Entretien & réparations biens mobiliers', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6243', 'Maintenance équipements', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6251', 'Assurances multirisques', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6252', 'Assurances matériel de transport', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6253', 'Assurances risques d''exploitation', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6271', 'Annonces, insertions (publicité)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6272', 'Catalogues, imprimés publicitaires', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6273', 'Échantillons', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6274', 'Foires et expositions', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6276', 'Cadeaux à la clientèle', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6277', 'Frais de colloques, séminaires, conférences', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6281', 'Frais de téléphone', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6288', 'Autres frais télécom (internet)', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 63 — Services Extérieurs B
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6311', 'Frais bancaires', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6321', 'Commissions et courtages sur achats', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6322', 'Commissions et courtages sur ventes', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6324', 'Honoraires (comptable, avocat, conseil)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6325', 'Frais d''actes et de contentieux', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6331', 'Frais de formation du personnel', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6342', 'Redevances brevets, licences, logiciels', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6351', 'Cotisations professionnelles', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6371', 'Personnel intérimaire', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6381', 'Frais de recrutement du personnel', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6383', 'Réceptions', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6384', 'Missions', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 64 — Impôts et taxes
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6411', 'Impôts fonciers et taxes annexes', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6412', 'Patentes, licences et taxes annexes', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6413', 'Taxes sur appointements et salaires (ITS)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6414', 'Taxe d''apprentissage', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6415', 'Formation professionnelle continue', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6461', 'Droits de mutation', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6462', 'Droits de timbre', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6463', 'Taxes sur les véhicules de société', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6464', 'Vignettes', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6478', 'Pénalités et amendes fiscales', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 65 — Autres charges
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6581', 'Jetons de présence administrateurs', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6582', 'Dons', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6583', 'Mécénat', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 66 — Charges de personnel
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6611', 'Salaires - personnel national', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6612', 'Primes et gratifications', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6613', 'Congés payés', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6614', 'Indemnités de préavis, licenciement', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6615', 'Indemnités de maladie', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6616', 'Supplément familial', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6617', 'Avantages en nature', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6618', 'Autres rémunérations directes', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6631', 'Indemnités de logement', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6632', 'Indemnités de représentation', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6638', 'Autres indemnités (transport, etc.)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6641', 'Charges sociales sur rémunérations (CNPS)', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6684', 'Médecine du travail et pharmacie', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 67 — Frais financiers
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '6712', 'Intérêts emprunts bancaires', 'expense', 'class_6', ws.id, true),
      (gen_random_uuid()::text, '6745', 'Intérêts bancaires sur trésorerie', 'expense', 'class_6', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- ========================================================================
    -- CLASSE 70 — Ventes
    -- ========================================================================
    INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, workspace_id, allow_direct_posting) VALUES
      (gen_random_uuid()::text, '7021', 'Ventes de produits finis', 'revenue', 'class_7', ws.id, true),
      (gen_random_uuid()::text, '7071', 'Ports, emballages perdus facturés', 'revenue', 'class_7', ws.id, true),
      (gen_random_uuid()::text, '7078', 'Autres produits accessoires', 'revenue', 'class_7', ws.id, true)
    ON CONFLICT (account_number, workspace_id) DO NOTHING;

    -- 445660 TVA déductible : déjà seedé en Phase B
  END LOOP;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'Plan comptable OHADA étendu. % comptes au total.',
    (SELECT COUNT(*) FROM chart_accounts);
END $$;
