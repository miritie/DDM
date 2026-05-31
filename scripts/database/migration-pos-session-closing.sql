-- Migration : fermeture de caisse formelle des sessions POS
--
-- À la clôture, le vendeur saisit le cash physiquement compté dans le
-- tiroir. Le système calcule le cash attendu (balance du wallet caisse
-- à cet instant) et la discordance. Pour traçabilité comptable :
-- qui a clôturé et quand.
--
-- Idempotente.

ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_cash_expected DECIMAL(15, 2);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_cash_counted  DECIMAL(15, 2);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_discrepancy   DECIMAL(15, 2);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closed_by_id          UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN pos_sessions.closing_cash_expected IS  'Cash attendu en caisse au moment de la clôture (snapshot wallet balance).';
COMMENT ON COLUMN pos_sessions.closing_cash_counted  IS  'Cash physiquement compté par le vendeur à la fermeture.';
COMMENT ON COLUMN pos_sessions.closing_discrepancy   IS  'Différence (counted − expected). Négatif = manque, positif = excédent.';
COMMENT ON COLUMN pos_sessions.closed_by_id          IS  'Utilisateur ayant clôturé (vendeur lui-même en général).';
