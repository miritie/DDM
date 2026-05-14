-- ============================================================================
-- Migration — Clarification sémantique de stand_replenishment_lines.unit_cost
-- ============================================================================
-- La colonne s'appelle historiquement `unit_cost` mais stocke en réalité le
-- PRIX DE VENTE unitaire du produit (products.unit_price) au moment de la
-- création de la demande. Un réappro stand est valorisé au prix de vente
-- (valeur que le stand pourra écouler), pas au coût de revient CUMP.
--
-- Idempotente.
-- ============================================================================

COMMENT ON COLUMN stand_replenishment_lines.unit_cost IS
  'Prix de vente unitaire (products.unit_price) figé au moment de la demande. Nommée "unit_cost" pour raisons historiques — c''est bien un prix de vente, pas un coût de revient.';

COMMENT ON COLUMN stand_replenishment_lines.line_total IS
  'Total ligne = quantity_requested × unit_cost (= valeur estimée au prix de vente).';

COMMENT ON COLUMN stand_replenishment_orders.total_value_estimate IS
  'Somme des line_total des lignes — valeur estimée du réappro au prix de vente.';
