-- Migration : flag « ce stand autorise la vente à crédit »
--
-- Par défaut FALSE : un vendeur ne peut PAS encaisser à crédit (montant
-- payé < total) sans configuration explicite du manager. Évite les
-- ventes à crédit accidentelles ou non autorisées.
--
-- Le manager / l'admin / le comptable peut activer ce flag depuis
-- /admin/outlets/[id] section paiements.
--
-- Idempotente.

ALTER TABLE outlets ADD COLUMN IF NOT EXISTS allows_credit BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN outlets.allows_credit IS
  'Active l''option « Crédit » dans le CheckoutModal du POS pour ce stand. '
  'Désactivé par défaut : un vendeur ne peut pas faire de vente à crédit '
  'sans configuration expresse.';
