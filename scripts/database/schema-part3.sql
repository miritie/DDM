-- ============================================================================
-- DDM - Schéma PostgreSQL Complet (PARTIE 3)
-- ============================================================================
-- Suite du fichier schema-part2.sql
-- À exécuter APRÈS schema-part2.sql
-- ============================================================================

-- ============================================================================
-- MODULE 7.9 - Consignation & Partenaires
-- ============================================================================

CREATE TYPE partner_type AS ENUM ('pharmacy', 'relay_point', 'wholesaler', 'retailer', 'other');
CREATE TYPE partner_status AS ENUM ('active', 'inactive', 'suspended', 'pending');

CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id VARCHAR(50) UNIQUE NOT NULL,
    partner_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type partner_type NOT NULL,
    status partner_status DEFAULT 'active' NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    contract_start_date DATE NOT NULL,
    contract_end_date DATE,
    commission_rate DECIMAL(5, 2) NOT NULL,
    payment_terms INTEGER DEFAULT 30 NOT NULL, -- jours
    total_deposited DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    total_sold DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    total_returned DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    current_balance DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    notes TEXT,
    tags TEXT[],
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(partner_code, workspace_id)
);

CREATE INDEX idx_partners_workspace_id ON partners(workspace_id);
CREATE INDEX idx_partners_type ON partners(type);
CREATE INDEX idx_partners_status ON partners(status);

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE deposit_status AS ENUM ('pending', 'validated', 'partial', 'completed', 'cancelled');

CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deposit_id VARCHAR(50) UNIQUE NOT NULL,
    deposit_number VARCHAR(50) NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    partner_name VARCHAR(255) NOT NULL,
    partner_type partner_type NOT NULL,
    status deposit_status DEFAULT 'pending' NOT NULL,
    total_items INTEGER DEFAULT 0 NOT NULL,
    total_value DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    deposit_date DATE NOT NULL,
    expected_return_date DATE,
    actual_return_date DATE,
    prepared_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    prepared_by_name VARCHAR(255) NOT NULL,
    validated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_by_name VARCHAR(255),
    validated_at TIMESTAMP,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    warehouse_name VARCHAR(255),
    notes TEXT,
    delivery_proof TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_deposits_workspace_id ON deposits(workspace_id);
CREATE INDEX idx_deposits_partner_id ON deposits(partner_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposits_deposit_date ON deposits(deposit_date);

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE deposit_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deposit_line_id VARCHAR(50) UNIQUE NOT NULL,
    deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255),
    quantity_deposited DECIMAL(10, 3) NOT NULL,
    quantity_sold DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    quantity_returned DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    quantity_remaining DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_value DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_deposit_lines_deposit_id ON deposit_lines(deposit_id);
CREATE INDEX idx_deposit_lines_product_id ON deposit_lines(product_id);

-- ============================================================================

CREATE TYPE sales_report_status AS ENUM ('draft', 'submitted', 'validated', 'processed', 'rejected');

CREATE TABLE sales_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sales_report_id VARCHAR(50) UNIQUE NOT NULL,
    report_number VARCHAR(50) NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    partner_name VARCHAR(255) NOT NULL,
    deposit_id UUID REFERENCES deposits(id) ON DELETE SET NULL,
    deposit_number VARCHAR(50),
    status sales_report_status DEFAULT 'draft' NOT NULL,
    report_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_sales DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    partner_commission DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    net_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    submitted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_by_name VARCHAR(255),
    submitted_at TIMESTAMP,
    validated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_by_name VARCHAR(255),
    validated_at TIMESTAMP,
    rejection_reason TEXT,
    sales_generated BOOLEAN DEFAULT false NOT NULL,
    generated_sale_ids TEXT[],
    notes TEXT,
    attachments TEXT[],
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_sales_reports_workspace_id ON sales_reports(workspace_id);
CREATE INDEX idx_sales_reports_partner_id ON sales_reports(partner_id);
CREATE INDEX idx_sales_reports_status ON sales_reports(status);
CREATE INDEX idx_sales_reports_report_date ON sales_reports(report_date);

CREATE TRIGGER update_sales_reports_updated_at BEFORE UPDATE ON sales_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE sales_report_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_line_id VARCHAR(50) UNIQUE NOT NULL,
    sales_report_id UUID NOT NULL REFERENCES sales_reports(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255),
    quantity_sold DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_sales_report_lines_sales_report_id ON sales_report_lines(sales_report_id);
CREATE INDEX idx_sales_report_lines_product_id ON sales_report_lines(product_id);

-- ============================================================================

CREATE TYPE settlement_status AS ENUM ('pending', 'partial', 'completed', 'cancelled');

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id VARCHAR(50) UNIQUE NOT NULL,
    settlement_number VARCHAR(50) NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    partner_name VARCHAR(255) NOT NULL,
    status settlement_status DEFAULT 'pending' NOT NULL,
    total_due DECIMAL(15, 2) NOT NULL,
    amount_paid DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    amount_remaining DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    sales_report_ids TEXT[],
    payment_method payment_method,
    payment_date DATE,
    payment_proof TEXT,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    prepared_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    prepared_by_name VARCHAR(255) NOT NULL,
    paid_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    paid_by_name VARCHAR(255),
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_settlements_workspace_id ON settlements(workspace_id);
CREATE INDEX idx_settlements_partner_id ON settlements(partner_id);
CREATE INDEX idx_settlements_status ON settlements(status);

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE return_condition AS ENUM ('good', 'damaged', 'expired');

CREATE TABLE consignation_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id VARCHAR(50) UNIQUE NOT NULL,
    return_number VARCHAR(50) NOT NULL,
    deposit_id UUID NOT NULL REFERENCES deposits(id) ON DELETE RESTRICT,
    deposit_number VARCHAR(50) NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
    partner_name VARCHAR(255) NOT NULL,
    return_date DATE NOT NULL,
    received_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    received_by_name VARCHAR(255) NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    warehouse_name VARCHAR(255),
    notes TEXT,
    return_proof TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_consignation_returns_workspace_id ON consignation_returns(workspace_id);
CREATE INDEX idx_consignation_returns_deposit_id ON consignation_returns(deposit_id);
CREATE INDEX idx_consignation_returns_partner_id ON consignation_returns(partner_id);

CREATE TRIGGER update_consignation_returns_updated_at BEFORE UPDATE ON consignation_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE consignation_return_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_line_id VARCHAR(50) UNIQUE NOT NULL,
    return_id UUID NOT NULL REFERENCES consignation_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    quantity_returned DECIMAL(10, 3) NOT NULL,
    condition return_condition NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_consignation_return_lines_return_id ON consignation_return_lines(return_id);

-- ============================================================================
-- MODULE - Comptabilité
-- ============================================================================

CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE account_class AS ENUM ('class_1', 'class_2', 'class_3', 'class_4', 'class_5', 'class_6', 'class_7', 'class_8', 'class_9');

CREATE TABLE chart_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(50) UNIQUE NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    label VARCHAR(255) NOT NULL,
    account_type account_type NOT NULL,
    account_class account_class NOT NULL,
    parent_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    allow_direct_posting BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(account_number, workspace_id)
);

CREATE INDEX idx_chart_accounts_workspace_id ON chart_accounts(workspace_id);
CREATE INDEX idx_chart_accounts_account_number ON chart_accounts(account_number);
CREATE INDEX idx_chart_accounts_account_type ON chart_accounts(account_type);

CREATE TRIGGER update_chart_accounts_updated_at BEFORE UPDATE ON chart_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE journal_type AS ENUM ('sales', 'purchases', 'bank', 'cash', 'operations', 'payroll');

CREATE TABLE journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id VARCHAR(50) UNIQUE NOT NULL,
    code VARCHAR(10) NOT NULL,
    label VARCHAR(255) NOT NULL,
    journal_type journal_type NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_journals_workspace_id ON journals(workspace_id);
CREATE INDEX idx_journals_journal_type ON journals(journal_type);

CREATE TRIGGER update_journals_updated_at BEFORE UPDATE ON journals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE entry_status AS ENUM ('draft', 'posted', 'validated', 'cancelled');

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id VARCHAR(50) UNIQUE NOT NULL,
    entry_number VARCHAR(50) NOT NULL,
    journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference VARCHAR(255),
    status entry_status DEFAULT 'draft' NOT NULL,
    posted_at TIMESTAMP,
    posted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_at TIMESTAMP,
    validated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    fiscal_year INTEGER NOT NULL,
    fiscal_period INTEGER NOT NULL CHECK (fiscal_period >= 1 AND fiscal_period <= 12),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_journal_entries_workspace_id ON journal_entries(workspace_id);
CREATE INDEX idx_journal_entries_journal_id ON journal_entries(journal_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_fiscal_year ON journal_entries(fiscal_year, fiscal_period);

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id VARCHAR(50) UNIQUE NOT NULL,
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_id UUID NOT NULL REFERENCES chart_accounts(id) ON DELETE RESTRICT,
    label VARCHAR(255) NOT NULL,
    debit_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    credit_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    analytical_code VARCHAR(50),
    cost_center VARCHAR(100),
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT check_debit_or_credit CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX idx_journal_entry_lines_entry_id ON journal_entry_lines(entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

CREATE TRIGGER update_journal_entry_lines_updated_at BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year_id VARCHAR(50) UNIQUE NOT NULL,
    year INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT false NOT NULL,
    closed_at TIMESTAMP,
    closed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(year, workspace_id)
);

CREATE INDEX idx_fiscal_years_workspace_id ON fiscal_years(workspace_id);
CREATE INDEX idx_fiscal_years_year ON fiscal_years(year);

CREATE TRIGGER update_fiscal_years_updated_at BEFORE UPDATE ON fiscal_years
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODULE - Rapports & Analytics
-- ============================================================================

CREATE TYPE report_type AS ENUM ('sales', 'expenses', 'inventory', 'cashflow', 'hr', 'accounting', 'custom');
CREATE TYPE report_format AS ENUM ('pdf', 'excel', 'csv', 'json');

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(50) UNIQUE NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type report_type NOT NULL,
    parameters JSONB,
    schedule JSONB,
    recipients TEXT[],
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_reports_workspace_id ON reports(workspace_id);
CREATE INDEX idx_reports_report_type ON reports(report_type);

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE report_execution_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE report_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id VARCHAR(50) UNIQUE NOT NULL,
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    status report_execution_status DEFAULT 'pending' NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    triggered_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    result_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_report_executions_report_id ON report_executions(report_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);

-- ============================================================================
-- MODULE - Notifications & Audit
-- ============================================================================

CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'whatsapp', 'in_app');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id VARCHAR(50) UNIQUE NOT NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status notification_status DEFAULT 'pending' NOT NULL,
    sent_at TIMESTAMP,
    error_message TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_workspace_id ON notifications(workspace_id);

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_log_id VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id);

-- ============================================================================
-- VUES MATÉRIALISÉES (pour performance)
-- ============================================================================

-- Vue pour les statistiques de ventes
CREATE MATERIALIZED VIEW mv_sales_statistics AS
SELECT
    s.workspace_id,
    DATE_TRUNC('month', s.sale_date) AS month,
    COUNT(*) AS total_sales,
    SUM(s.total_amount) AS total_revenue,
    SUM(s.amount_paid) AS total_paid,
    SUM(s.balance) AS total_unpaid,
    AVG(s.total_amount) AS average_sale_amount,
    COUNT(DISTINCT s.client_id) AS unique_customers
FROM sales s
WHERE s.status != 'cancelled'
GROUP BY s.workspace_id, DATE_TRUNC('month', s.sale_date);

CREATE UNIQUE INDEX idx_mv_sales_statistics ON mv_sales_statistics(workspace_id, month);

-- Vue pour le stock actuel
CREATE MATERIALIZED VIEW mv_current_stock AS
SELECT
    si.workspace_id,
    si.warehouse_id,
    w.name AS warehouse_name,
    si.product_id,
    p.name AS product_name,
    p.code AS product_code,
    si.quantity,
    si.minimum_stock,
    si.unit_cost,
    si.total_value,
    CASE
        WHEN si.quantity <= 0 THEN 'out_of_stock'
        WHEN si.quantity <= si.minimum_stock THEN 'low_stock'
        WHEN si.maximum_stock IS NOT NULL AND si.quantity >= si.maximum_stock THEN 'overstock'
        ELSE 'normal'
    END AS stock_status
FROM stock_items si
JOIN products p ON si.product_id = p.id
JOIN warehouses w ON si.warehouse_id = w.id;

CREATE UNIQUE INDEX idx_mv_current_stock ON mv_current_stock(workspace_id, warehouse_id, product_id);

-- ============================================================================
-- CONTRAINTES DE VALIDATION
-- ============================================================================

-- Validation: Balance de vente = Total - Payé
ALTER TABLE sales
    ADD CONSTRAINT check_sale_balance
    CHECK (balance = total_amount - amount_paid);

-- Validation: Total sale item = quantité × prix unitaire
ALTER TABLE sale_items
    ADD CONSTRAINT check_sale_item_total
    CHECK (total_price = quantity * unit_price);

-- Validation: Équilibre des écritures comptables (à vérifier au niveau application)
-- Note: En PostgreSQL, on ne peut pas faire de contrainte CHECK sur agrégat
-- Cette validation doit être faite dans l'application

-- ============================================================================
-- POLITIQUES DE SÉCURITÉ (Row Level Security)
-- ============================================================================

-- Activer RLS sur les tables principales
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs ne peuvent voir que les données de leur workspace
-- Note: Ces politiques doivent être adaptées selon votre système d'authentification

-- ============================================================================
-- FONCTIONS UTILITAIRES MÉTIER
-- ============================================================================

-- Fonction pour rafraîchir les vues matérialisées
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_stock;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le solde d'une vente
CREATE OR REPLACE FUNCTION calculate_sale_balance(sale_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    sale_total DECIMAL;
    total_payments DECIMAL;
BEGIN
    SELECT total_amount INTO sale_total FROM sales WHERE id = sale_uuid;
    SELECT COALESCE(SUM(amount), 0) INTO total_payments FROM sale_payments WHERE sale_id = sale_uuid;
    RETURN sale_total - total_payments;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le stock après un mouvement
CREATE OR REPLACE FUNCTION update_stock_after_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
        -- Mouvement validé, mettre à jour le stock
        IF NEW.type = 'entry' THEN
            UPDATE stock_items
            SET quantity = quantity + NEW.quantity,
                total_value = (quantity + NEW.quantity) * unit_cost,
                last_restock_date = NEW.validated_at
            WHERE product_id = NEW.product_id AND warehouse_id = NEW.destination_warehouse_id;

        ELSIF NEW.type = 'exit' THEN
            UPDATE stock_items
            SET quantity = quantity - NEW.quantity,
                total_value = (quantity - NEW.quantity) * unit_cost
            WHERE product_id = NEW.product_id AND warehouse_id = NEW.source_warehouse_id;

        ELSIF NEW.type = 'transfer' THEN
            -- Sortie de l'entrepôt source
            UPDATE stock_items
            SET quantity = quantity - NEW.quantity,
                total_value = (quantity - NEW.quantity) * unit_cost
            WHERE product_id = NEW.product_id AND warehouse_id = NEW.source_warehouse_id;

            -- Entrée dans l'entrepôt destination
            UPDATE stock_items
            SET quantity = quantity + NEW.quantity,
                total_value = (quantity + NEW.quantity) * unit_cost
            WHERE product_id = NEW.product_id AND warehouse_id = NEW.destination_warehouse_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour le stock automatiquement
CREATE TRIGGER trigger_update_stock_after_movement
    AFTER INSERT OR UPDATE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_after_movement();

-- ============================================================================
-- COMMENTAIRES SUR LES TABLES (Documentation)
-- ============================================================================

COMMENT ON TABLE workspaces IS 'Espaces de travail (multi-tenant)';
COMMENT ON TABLE users IS 'Utilisateurs du système';
COMMENT ON TABLE products IS 'Catalogue produits';
COMMENT ON TABLE sales IS 'Ventes et factures';
COMMENT ON TABLE customers IS 'Clients avec fidélité';
COMMENT ON TABLE stock_items IS 'Stock par entrepôt et produit';
COMMENT ON TABLE stock_movements IS 'Mouvements de stock (entrées/sorties/transferts)';
COMMENT ON TABLE employees IS 'Employés de l''entreprise';
COMMENT ON TABLE payrolls IS 'Paies des employés';
COMMENT ON TABLE wallets IS 'Comptes de trésorerie (caisses, banques, mobile money)';
COMMENT ON TABLE transactions IS 'Transactions de trésorerie';
COMMENT ON TABLE production_orders IS 'Ordres de production';
COMMENT ON TABLE recipes IS 'Recettes de fabrication (BOM)';
COMMENT ON TABLE partners IS 'Partenaires consignation (pharmacies, points relais)';
COMMENT ON TABLE deposits IS 'Dépôts en consignation';
COMMENT ON TABLE chart_accounts IS 'Plan comptable';
COMMENT ON TABLE journal_entries IS 'Écritures comptables';

-- ============================================================================
-- FIN DU SCHÉMA
-- ============================================================================

-- Afficher un résumé
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';

    RAISE NOTICE '==============================================';
    RAISE NOTICE 'DDM - Base de données créée avec succès !';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Tables créées: %', table_count;
    RAISE NOTICE 'Index créés: %', index_count;
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Prochaine étape: Exécuter seed-data.sql';
    RAISE NOTICE '==============================================';
END $$;
