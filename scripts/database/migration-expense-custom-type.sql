-- ============================================================================
-- Migration EXPENSE custom type — Saisie libre du type par l'utilisateur
-- ============================================================================
-- L'utilisateur peut saisir un type de dépense libre quand aucun des types
-- prédéfinis ne convient. Stocké dans expense_requests.custom_type_label,
-- à charge de l'admin (ou plus tard d'une IA) de classifier en OHADA.
--
-- Idempotente.
-- ============================================================================

ALTER TABLE expense_requests
  ADD COLUMN IF NOT EXISTS custom_type_label TEXT;

COMMENT ON COLUMN expense_requests.custom_type_label IS
  'Type saisi librement par l''utilisateur quand aucun expense_type prédéfini ne convient. À classifier ensuite (admin ou IA) pour rattacher à un compte OHADA.';

DO $$ BEGIN
  RAISE NOTICE 'expense_requests.custom_type_label .... %',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='expense_requests' AND column_name='custom_type_label'
    ) THEN 'OK' ELSE 'MANQUANT' END;
END $$;
