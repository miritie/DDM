-- ============================================================================
-- Migration NOTIFICATIONS — Centre de notifications in-app
-- ============================================================================
-- Étend la table notifications existante (qui ciblait l'envoi multi-canal
-- email/sms/whatsapp) avec ce qu'il faut pour une boîte aux lettres in-app
-- consultable par l'utilisateur :
--   - read_at : timestamp de lecture (NULL = non lu)
--   - category : type sémantique (expense_approved, transfer_pending, etc.)
--   - entity_type + entity_id : référence à l'objet concerné (ex: expense_request)
--   - action_url : URL à ouvrir au clic
--
-- Pas de migration de données nécessaire (table vide).
-- Idempotente.
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS action_url TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id, read_at)
  WHERE read_at IS NULL AND channel = 'in_app';

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC)
  WHERE channel = 'in_app';

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON notifications(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

COMMENT ON COLUMN notifications.read_at IS 'Timestamp de lecture par le destinataire. NULL = non lu.';
COMMENT ON COLUMN notifications.category IS 'Type sémantique : expense_approved, expense_rejected, transfer_pending, transfer_received, customer_order_approved, etc.';
COMMENT ON COLUMN notifications.entity_type IS 'Type d''entité référencée : expense_request, stock_transfer, customer_order, production_order, etc.';
COMMENT ON COLUMN notifications.entity_id IS 'UUID de l''entité référencée.';
COMMENT ON COLUMN notifications.action_url IS 'URL relative à ouvrir au clic (ex: /expenses/requests/ER-xxx).';

DO $$ BEGIN
  RAISE NOTICE 'read_at .......... %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='read_at') THEN 'OK' ELSE 'MANQUANT' END;
  RAISE NOTICE 'category ......... %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='category') THEN 'OK' ELSE 'MANQUANT' END;
  RAISE NOTICE 'entity_type ...... %', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='entity_type') THEN 'OK' ELSE 'MANQUANT' END;
END $$;
