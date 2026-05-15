-- ============================================================================
-- Migration — Statut "scheduled" pour expenses + Mes demandes
-- ============================================================================
-- Permet au comptable de PLANIFIER le paiement d'une dépense approuvée
-- (date prévue) avant l'exécution effective depuis les wallets.
--
-- Workflow : approved → scheduled → paid (ou approved → paid direct)
--
-- Idempotente.
-- ============================================================================

-- Ajout du statut 'scheduled' à l'enum (Postgres ne permet pas ALTER TYPE
-- avec IF NOT EXISTS sur ADD VALUE, donc on encapsule dans un bloc).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'scheduled'
      AND enumtypid = 'expense_status'::regtype
  ) THEN
    ALTER TYPE expense_status ADD VALUE 'scheduled' AFTER 'approved';
  END IF;
END $$;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS scheduled_payment_date DATE;

CREATE INDEX IF NOT EXISTS idx_expenses_scheduled_payment_date
  ON expenses(scheduled_payment_date)
  WHERE scheduled_payment_date IS NOT NULL;

COMMENT ON COLUMN expenses.scheduled_payment_date IS
  'Date prévue pour l''exécution effective du paiement par le comptable. Renseignée quand status passe à scheduled.';

DO $$ BEGIN
  RAISE NOTICE 'Phase D migration terminée. Statut scheduled disponible : %',
    EXISTS(SELECT 1 FROM pg_enum WHERE enumlabel='scheduled' AND enumtypid='expense_status'::regtype);
END $$;
