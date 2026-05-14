-- ============================================================================
-- Migration 2c — Cleanup : suppression de l'enum et des colonnes legacy
-- ============================================================================
-- Bascule complète sur `payment_methods` + `payment_method_id` (FK UUID).
-- Pré-requis : Phases 2a (table + FK) et 2b (dual-write + backfill) déjà
-- appliquées. Audit Phase B vérifié à zéro ligne à risque le 2026-05-13.
--
-- Périmètre étendu (constaté pendant l'exécution) :
--   sale_payments, expenses, payrolls, employee_advances, customers,
--   customer_order_payments (manquée par 2a), settlements (manquée par 2a).
--
-- DESTRUCTIF — non rollbackable sans backup.
-- ============================================================================

-- 1) Tables manquées par 2a : créer la FK payment_method_id (additif).
ALTER TABLE customer_order_payments
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_customer_order_payments_payment_method_id ON customer_order_payments(payment_method_id);

ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_settlements_payment_method_id ON settlements(payment_method_id);

-- 2) FK obligatoire là où l'enum d'origine était NOT NULL.
ALTER TABLE sale_payments           ALTER COLUMN payment_method_id SET NOT NULL;
ALTER TABLE customer_order_payments ALTER COLUMN payment_method_id SET NOT NULL;

-- 3) Suppression des colonnes legacy.
ALTER TABLE sale_payments           DROP COLUMN IF EXISTS payment_method;
ALTER TABLE expenses                DROP COLUMN IF EXISTS payment_method;
ALTER TABLE payrolls                DROP COLUMN IF EXISTS payment_method;
ALTER TABLE employee_advances       DROP COLUMN IF EXISTS payment_method;
ALTER TABLE customers               DROP COLUMN IF EXISTS preferred_payment_method;
ALTER TABLE customer_order_payments DROP COLUMN IF EXISTS payment_method;
ALTER TABLE settlements             DROP COLUMN IF EXISTS payment_method;

-- 4) Suppression du TYPE enum (plus aucune colonne ne le référence).
DROP TYPE IF EXISTS payment_method;
