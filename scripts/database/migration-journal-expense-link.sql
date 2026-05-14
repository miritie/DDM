-- ============================================================================
-- Migration — Lien journal_entries ↔ expenses + seed journaux
-- ============================================================================
-- 1. Seede les journaux comptables standards (achats, trésorerie cash/bank/MM).
-- 2. Ajoute journal_entries.expense_id pour tracer l'écriture générée
--    automatiquement à chaque paiement de dépense.
--
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Seed des journaux standards
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP

    -- Journal des achats : écritures de constatation des charges (débit 6/44, crédit 401 ou direct 5)
    INSERT INTO journals (journal_id, code, label, journal_type, workspace_id, is_active)
    VALUES (gen_random_uuid()::text, 'ACH', 'Journal des achats', 'purchases', ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Journaux de trésorerie (un par grand type)
    INSERT INTO journals (journal_id, code, label, journal_type, workspace_id, is_active)
    VALUES (gen_random_uuid()::text, 'CAI', 'Journal de caisse', 'cash', ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    INSERT INTO journals (journal_id, code, label, journal_type, workspace_id, is_active)
    VALUES (gen_random_uuid()::text, 'BAN', 'Journal de banque', 'bank', ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    INSERT INTO journals (journal_id, code, label, journal_type, workspace_id, is_active)
    VALUES (gen_random_uuid()::text, 'MM', 'Journal mobile money', 'bank', ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

    -- Journal des opérations diverses (fallback)
    INSERT INTO journals (journal_id, code, label, journal_type, workspace_id, is_active)
    VALUES (gen_random_uuid()::text, 'OD', 'Opérations diverses', 'operations', ws.id, true)
    ON CONFLICT (code, workspace_id) DO NOTHING;

  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. journal_entries.expense_id
-- ----------------------------------------------------------------------------

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS expense_id UUID
    REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_expense_id
  ON journal_entries(expense_id) WHERE expense_id IS NOT NULL;

COMMENT ON COLUMN journal_entries.expense_id IS
  'Si non null, cette écriture comptable a été générée automatiquement par le paiement de la dépense référencée (Phase C du module dépenses).';

DO $$ BEGIN
  RAISE NOTICE 'Phase C migration terminée. % journaux seedés.',
    (SELECT COUNT(*) FROM journals);
END $$;
