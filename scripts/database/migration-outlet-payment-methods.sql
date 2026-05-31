-- Migration : table de jointure outlet ↔ payment_methods
-- Permet de définir, par point de vente, les moyens de paiement acceptés.
--
-- Convention métier : si un outlet n'a AUCUNE ligne dans cette table,
-- on considère que seul `cash` est accepté par défaut (cf.
-- OutletService.listPaymentMethods côté serveur). Ce défaut prudent
-- évite qu'un outlet « oublié » accepte par inadvertance des moyens
-- de paiement risqués (mobile money sans wallet, etc.).
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS outlet_payment_methods (
  outlet_id          UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  payment_method_id  UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (outlet_id, payment_method_id)
);

CREATE INDEX IF NOT EXISTS idx_outlet_payment_methods_outlet
  ON outlet_payment_methods(outlet_id);
CREATE INDEX IF NOT EXISTS idx_outlet_payment_methods_pm
  ON outlet_payment_methods(payment_method_id);
