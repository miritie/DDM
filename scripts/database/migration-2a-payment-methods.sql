-- ============================================================================
-- Migration 2a — Moyens de paiement en table activable (additive)
-- ============================================================================
-- Objectif : créer la table `payment_methods` + colonnes FK nullables en
-- parallèle de l'enum existant. Aucune lecture/écriture côté code ne bascule
-- ici. Entièrement réversible (cf. rollback-2a en bas).
--
-- Idempotente : peut être ré-exécutée sans effet de bord.
-- ============================================================================

-- 1) Table payment_methods --------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_method_id VARCHAR(50) UNIQUE NOT NULL,
    code VARCHAR(50) NOT NULL,                 -- 'cash', 'mobile_money', 'card', etc.
    label VARCHAR(255) NOT NULL,
    required_wallet_type VARCHAR(50),          -- 'cash' | 'bank' | 'mobile_money' | NULL
    display_order INTEGER DEFAULT 0 NOT NULL,
    icon VARCHAR(50),                          -- nom d'icône lucide-react
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_system BOOLEAN DEFAULT false NOT NULL,  -- valeurs héritées de l'enum, non supprimables
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE (code, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_workspace_id ON payment_methods(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);

-- Trigger updated_at (réutilise la fonction commune du schéma)
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Seed initial pour chaque workspace --------------------------------------
-- On insère les 6 valeurs de l'enum `payment_method` pour chaque workspace,
-- en s'appuyant sur UNIQUE(code, workspace_id) + ON CONFLICT pour rester idempotent.
INSERT INTO payment_methods
    (payment_method_id, code, label, required_wallet_type, display_order, icon, is_active, is_system, workspace_id)
SELECT
    -- Format: PM-<8 premiers chars du workspace UUID>-<code> ; reste sous 50 chars.
    'PM-' || substr(w.id::text, 1, 8) || '-' || pm.code,
    pm.code, pm.label, pm.required_wallet_type, pm.display_order, pm.icon,
    true, true, w.id
FROM workspaces w
CROSS JOIN (VALUES
    ('cash',          'Espèces',       'cash',         10, 'Banknote'),
    ('mobile_money',  'Mobile Money',  'mobile_money', 20, 'Smartphone'),
    ('card',          'Carte / TPE',   'bank',         30, 'CreditCard'),
    ('bank_transfer', 'Virement',      'bank',         40, 'Building2'),
    ('check',         'Chèque',        'bank',         50, 'FileText'),
    ('other',         'Autre',         NULL,           99, 'Wallet')
) AS pm(code, label, required_wallet_type, display_order, icon)
ON CONFLICT (code, workspace_id) DO NOTHING;

-- 3) Colonnes payment_method_id nullables en parallèle de l'existant --------
-- sale_payments
ALTER TABLE sale_payments
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_sale_payments_payment_method_id ON sale_payments(payment_method_id);

-- expenses
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method_id ON expenses(payment_method_id);

-- payrolls
ALTER TABLE payrolls
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_payrolls_payment_method_id ON payrolls(payment_method_id);

-- employee_advances
ALTER TABLE employee_advances
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_employee_advances_payment_method_id ON employee_advances(payment_method_id);

-- partner_settlements (présence conditionnelle selon la version du schéma)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'partner_settlements') THEN
        EXECUTE 'ALTER TABLE partner_settlements
                 ADD COLUMN IF NOT EXISTS payment_method_id UUID
                 REFERENCES payment_methods(id) ON DELETE RESTRICT';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_partner_settlements_payment_method_id
                 ON partner_settlements(payment_method_id)';
    END IF;
END $$;

-- customers (préférence, pas une transaction)
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS preferred_payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;

-- ============================================================================
-- ROLLBACK 2a (à exécuter manuellement si besoin de revenir en arrière)
-- ============================================================================
-- ALTER TABLE sale_payments       DROP COLUMN IF EXISTS payment_method_id;
-- ALTER TABLE expenses            DROP COLUMN IF EXISTS payment_method_id;
-- ALTER TABLE payrolls            DROP COLUMN IF EXISTS payment_method_id;
-- ALTER TABLE employee_advances   DROP COLUMN IF EXISTS payment_method_id;
-- ALTER TABLE partner_settlements DROP COLUMN IF EXISTS payment_method_id;
-- ALTER TABLE customers           DROP COLUMN IF EXISTS preferred_payment_method_id;
-- DROP TABLE IF EXISTS payment_methods;
