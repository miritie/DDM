-- ============================================================================
-- Migration — Lien transactions ↔ expenses (paiement multi-wallet)
-- ============================================================================
-- Permet à une dépense (expenses) d'être réglée par 1 ou N transactions
-- chacune débitant un wallet précis. Le total des transactions liées doit
-- égaler le montant de la dépense (vérifié côté service à l'INSERT).
--
-- Une dépense ⇄ N transactions (1 dépense peut être payée multi-wallet).
-- ON DELETE SET NULL : si une dépense disparaît, les transactions restent
-- traçables — on ne perd pas l'historique des mouvements wallet.
--
-- Idempotente.
-- ============================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS expense_id UUID
    REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_expense_id
  ON transactions(expense_id)
  WHERE expense_id IS NOT NULL;

COMMENT ON COLUMN transactions.expense_id IS
  'Si non null, cette transaction règle (partiellement ou totalement) la dépense référencée. Une dépense peut être payée par N transactions (paiement multi-wallet).';

DO $$ BEGIN
  RAISE NOTICE 'transactions.expense_id ........ %',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='transactions' AND column_name='expense_id'
    ) THEN 'OK' ELSE 'MANQUANT' END;
END $$;
