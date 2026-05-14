-- ============================================================================
-- Migration — Lien purchase_request_lines ↔ production_orders
-- ============================================================================
-- Permet d'associer une sollicitation d'achat de matières premières à un
-- ordre de production spécifique : le manager peut solliciter les MP
-- manquantes pour l'OP avant de la démarrer.
--
-- FK SET NULL : si l'OP est supprimé, la sollicitation reste mais perd
-- juste le lien (l'historique d'achat des MP est conservé).
--
-- Mis sur la ligne (pas l'entête) pour rester évolutif : une sollicitation
-- pourrait à terme couvrir plusieurs OPs avec des lignes différentes.
-- Aujourd'hui l'UI traite ça comme un choix unique au niveau entête.
--
-- Idempotente.
-- ============================================================================

ALTER TABLE purchase_request_lines
  ADD COLUMN IF NOT EXISTS production_order_id UUID
    REFERENCES production_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_request_lines_production_order_id
  ON purchase_request_lines(production_order_id)
  WHERE production_order_id IS NOT NULL;

COMMENT ON COLUMN purchase_request_lines.production_order_id IS
  'Si renseigné, lie cette ligne d''achat MP à un ordre de production. Toutes les lignes d''une même sollicitation pointent généralement vers le même OP (choix unique au niveau UI), mais le schéma autorise du multi-OP pour évolution future.';

DO $$ BEGIN
  RAISE NOTICE 'purchase_request_lines.production_order_id ........ %',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='purchase_request_lines' AND column_name='production_order_id'
    ) THEN 'OK' ELSE 'MANQUANT' END;
END $$;
