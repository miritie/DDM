-- ============================================================================
-- DDM - Schéma PostgreSQL Complet pour Neon.tech
-- ============================================================================
-- Version: 1.0
-- Date: 2025-11-16
-- Compatible avec: PostgreSQL 14+, Neon.tech
-- ============================================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Pour recherche full-text performante

-- ============================================================================
-- FONCTIONS UTILITAIRES
-- ============================================================================

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- MODULE TRANSVERSAL - Workspaces & Users
-- ============================================================================

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id VARCHAR(50) UNIQUE NOT NULL, -- Ancien WorkspaceId pour compatibilité
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    -- Identité visuelle / en-têtes imprimables
    slogan VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    logo_url TEXT,
    -- Devise et localisation
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Africa/Abidjan' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_is_active ON workspaces(is_active);

-- Trigger pour updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_permissions_code ON permissions(code);
CREATE INDEX idx_permissions_module ON permissions(module);

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permission_ids TEXT[] DEFAULT '{}', -- Array de permission IDs
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_roles_workspace_id ON roles(workspace_id);
CREATE INDEX idx_roles_is_active ON roles(is_active);

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Liaison rôles ↔ permissions (M:N)

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE, -- Identifiant simple (prénom). NULL = login par email uniquement.
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
CREATE INDEX idx_users_workspace_id ON users(workspace_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Multi-rôles : un utilisateur peut être assigné à plusieurs rôles.
-- Le rôle marqué is_primary=true est utilisé par défaut à la connexion et
-- correspond à users.role_id.
-- ============================================================================

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- ============================================================================
-- Clients (créée tôt car référencée par checkin_sessions, sales, etc.)
-- ============================================================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    company_name VARCHAR(255),
    tax_id VARCHAR(100),
    credit_limit DECIMAL(15, 2),
    current_balance DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_clients_workspace_id ON clients(workspace_id);
CREATE INDEX idx_clients_code ON clients(code);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_is_active ON clients(is_active);

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Sessions de check-in client (pairing QR ↔ POS).
-- TTL court (~10min). Le caissier crée une session, affiche le QR.
-- Le client scanne, soumet ses infos, la session passe à 'completed'.
-- ============================================================================

CREATE TABLE checkin_sessions (
    token VARCHAR(64) PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_checkin_workspace ON checkin_sessions(workspace_id);
CREATE INDEX idx_checkin_expires ON checkin_sessions(expires_at);

-- ============================================================================
-- Programme de fidélisation paramétrique.
-- Les règles définissent des conditions (tous optionnels, en ET) et une
-- récompense (% ou montant fixe). Évaluées à chaque vente.
-- ============================================================================

CREATE TABLE loyalty_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,

    -- Triggers
    every_nth_purchase INT,            -- (count_in_window + 1) % N === 0
    min_cart_total NUMERIC(15,2),      -- panier ≥ X
    min_item_count INT,                -- nb articles ≥ N
    min_total_spent NUMERIC(15,2),     -- montant cumulé client ≥ X
    min_total_purchases INT,           -- nb cumulé d'achats ≥ N (sur la fenêtre)
    window_days INT,                   -- fenêtre temporelle (NULL = lifetime)

    -- Reward
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('percentage', 'fixed_amount')),
    reward_value NUMERIC(10,2) NOT NULL,

    -- Méta
    priority INT DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_loyalty_rules_workspace ON loyalty_rules(workspace_id);
CREATE INDEX idx_loyalty_rules_active ON loyalty_rules(is_active, priority DESC);

-- (Les colonnes loyalty_rule_id / discount_amount sont ajoutées sur sales
--  juste après la création de cette table, plus bas.)

-- ============================================================================
-- MODULE 7.1 - Ventes & Encaissements
-- ============================================================================

CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#3b82f6',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (workspace_id, name)
);
CREATE INDEX idx_product_categories_workspace ON product_categories(workspace_id);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    unit_price DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    category VARCHAR(100), -- nom de catégorie (référence par nom à product_categories)
    unit VARCHAR(50), -- kg, piece, liter, etc.
    image_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_products_workspace_id ON products(workspace_id);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

-- (clients est créée plus haut, avant checkin_sessions)

-- ============================================================================
-- MODULE 7.10 - Points de Vente (Outlets)
-- ============================================================================

CREATE TABLE outlet_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (workspace_id, code)
);

CREATE INDEX idx_outlet_types_workspace ON outlet_types(workspace_id);

CREATE TRIGGER update_outlet_types_updated_at BEFORE UPDATE ON outlet_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------

CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    outlet_type_id UUID REFERENCES outlet_types(id) ON DELETE SET NULL,
    address TEXT,
    city VARCHAR(100),
    gps_lat DECIMAL(10, 7),
    gps_lng DECIMAL(10, 7),
    qr_token UUID DEFAULT uuid_generate_v4() NOT NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (workspace_id, code),
    UNIQUE (qr_token)
);

CREATE INDEX idx_outlets_workspace ON outlets(workspace_id);
CREATE INDEX idx_outlets_type ON outlets(outlet_type_id);
CREATE INDEX idx_outlets_qr_token ON outlets(qr_token);
CREATE INDEX idx_outlets_is_active ON outlets(is_active);

CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON outlets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Périodes d'activité d'un outlet (active/inactif, payant/non payant, frais)

CREATE TYPE outlet_fee_period AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly', 'one_off');

CREATE TABLE outlet_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_paid BOOLEAN DEFAULT false NOT NULL,
    fee_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    fee_period outlet_fee_period DEFAULT 'monthly' NOT NULL,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_outlet_periods_outlet ON outlet_periods(outlet_id);
CREATE INDEX idx_outlet_periods_dates ON outlet_periods(start_date, end_date);

CREATE TRIGGER update_outlet_periods_updated_at BEFORE UPDATE ON outlet_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Prix par outlet ou par type d'outlet (mutuellement exclusifs)

CREATE TABLE outlet_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    outlet_type_id UUID REFERENCES outlet_types(id) ON DELETE CASCADE,
    unit_price DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CHECK ((outlet_id IS NULL) <> (outlet_type_id IS NULL)),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_outlet_prices_product ON outlet_prices(product_id);
CREATE INDEX idx_outlet_prices_outlet ON outlet_prices(outlet_id) WHERE outlet_id IS NOT NULL;
CREATE INDEX idx_outlet_prices_type ON outlet_prices(outlet_type_id) WHERE outlet_type_id IS NOT NULL;
CREATE INDEX idx_outlet_prices_dates ON outlet_prices(valid_from, valid_to);

CREATE TRIGGER update_outlet_prices_updated_at BEFORE UPDATE ON outlet_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Planning hebdomadaire des commerciaux par outlet

CREATE TABLE outlet_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL, -- lundi
    week_end DATE NOT NULL,   -- dimanche
    assigned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (outlet_id, user_id, week_start),
    CHECK (week_end >= week_start)
);

CREATE INDEX idx_outlet_assignments_outlet ON outlet_assignments(outlet_id);
CREATE INDEX idx_outlet_assignments_user ON outlet_assignments(user_id);
CREATE INDEX idx_outlet_assignments_week ON outlet_assignments(week_start, week_end);

CREATE TRIGGER update_outlet_assignments_updated_at BEFORE UPDATE ON outlet_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Exceptions ponctuelles au planning (déplacement ad-hoc par un manager)

CREATE TABLE outlet_assignment_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    reason TEXT,
    overrides_assignment_id UUID REFERENCES outlet_assignments(id) ON DELETE SET NULL,
    assigned_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CHECK (date_to >= date_from)
);

CREATE INDEX idx_outlet_overrides_outlet ON outlet_assignment_overrides(outlet_id);
CREATE INDEX idx_outlet_overrides_user ON outlet_assignment_overrides(user_id);
CREATE INDEX idx_outlet_overrides_dates ON outlet_assignment_overrides(date_from, date_to);

CREATE TRIGGER update_outlet_overrides_updated_at BEFORE UPDATE ON outlet_assignment_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Sessions POS (un commercial actif sur un outlet à un moment T)

CREATE TYPE pos_session_start_method AS ENUM ('explicit', 'implicit');

CREATE TABLE pos_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    start_method pos_session_start_method DEFAULT 'explicit' NOT NULL,
    device_id VARCHAR(255),
    gps_lat DECIMAL(10, 7),
    gps_lng DECIMAL(10, 7),
    gps_accuracy DECIMAL(10, 2),
    gps_captured_at TIMESTAMP,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_pos_sessions_outlet ON pos_sessions(outlet_id);
CREATE INDEX idx_pos_sessions_user ON pos_sessions(user_id);
CREATE INDEX idx_pos_sessions_active ON pos_sessions(outlet_id, user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_pos_sessions_started ON pos_sessions(started_at);

CREATE TRIGGER update_pos_sessions_updated_at BEFORE UPDATE ON pos_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- (pending_client_scans est créée plus bas, après la table sales)

-- ----------------------------------------------------------------------------
-- Factures mensuelles reçues de l'outlet (qu'on doit payer)

CREATE TYPE outlet_invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

CREATE TABLE outlet_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) NOT NULL,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status outlet_invoice_status DEFAULT 'pending' NOT NULL,
    paid_at TIMESTAMP,
    paid_amount DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    expense_id UUID, -- lien vers la dépense qui matérialise le paiement
    notes TEXT,
    attachment_url TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (outlet_id, invoice_number)
);

CREATE INDEX idx_outlet_invoices_outlet ON outlet_invoices(outlet_id);
CREATE INDEX idx_outlet_invoices_status ON outlet_invoices(status);
CREATE INDEX idx_outlet_invoices_period ON outlet_invoices(period_year, period_month);

CREATE TRIGGER update_outlet_invoices_updated_at BEFORE UPDATE ON outlet_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE sale_status AS ENUM ('draft', 'confirmed', 'partially_paid', 'fully_paid', 'cancelled');
CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'fully_paid', 'overdue');

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id VARCHAR(50) UNIQUE NOT NULL,
    sale_number VARCHAR(50) NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255),
    total_amount DECIMAL(15, 2) NOT NULL,
    amount_paid DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    balance DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    status sale_status DEFAULT 'draft' NOT NULL,
    payment_status payment_status DEFAULT 'unpaid' NOT NULL,
    sale_date TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    notes TEXT,
    sales_person_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    pos_session_id UUID REFERENCES pos_sessions(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_sales_workspace_id ON sales(workspace_id);
CREATE INDEX idx_sales_sale_number ON sales(sale_number);
CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_sales_sales_person_id ON sales(sales_person_id);
CREATE INDEX idx_sales_outlet_id ON sales(outlet_id);
CREATE INDEX idx_sales_pos_session_id ON sales(pos_session_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Colonnes côté ventes pour historiser la remise fidélité appliquée
ALTER TABLE sales ADD COLUMN IF NOT EXISTS loyalty_rule_id UUID REFERENCES loyalty_rules(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0 NOT NULL;

-- File de scans clients en attente d'attribution par un commercial
-- (référence sales — donc créée APRÈS la table sales)
CREATE TABLE pending_client_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    consumed_by_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_scans_outlet_pending ON pending_client_scans(outlet_id, expires_at) WHERE consumed_at IS NULL;
CREATE INDEX idx_scans_client ON pending_client_scans(client_id);

-- ============================================================================

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_item_id VARCHAR(50) UNIQUE NOT NULL,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    total_price DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);

CREATE TRIGGER update_sale_items_updated_at BEFORE UPDATE ON sale_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'mobile_money', 'check', 'card', 'other');

CREATE TABLE sale_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id VARCHAR(50) UNIQUE NOT NULL,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_number VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    payment_date TIMESTAMP NOT NULL,
    wallet_id UUID, -- Référence vers wallets (défini plus bas)
    reference VARCHAR(255),
    notes TEXT,
    received_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX idx_sale_payments_workspace_id ON sale_payments(workspace_id);
CREATE INDEX idx_sale_payments_payment_date ON sale_payments(payment_date);

CREATE TRIGGER update_sale_payments_updated_at BEFORE UPDATE ON sale_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODULE 7.2 - Stock & Mouvements
-- ============================================================================

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    address TEXT,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_warehouses_workspace_id ON warehouses(workspace_id);
CREATE INDEX idx_warehouses_code ON warehouses(code);

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE stock_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_item_id VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    minimum_stock DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    maximum_stock DECIMAL(10, 3),
    unit_cost DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    total_value DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    last_restock_date TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- exactement une localisation
    CHECK ((warehouse_id IS NULL) <> (outlet_id IS NULL))
);

-- Unicité (product, location) : index partiels distincts pour outlet et warehouse
CREATE UNIQUE INDEX idx_stock_items_unique_warehouse
    ON stock_items(product_id, warehouse_id)
    WHERE warehouse_id IS NOT NULL;
CREATE UNIQUE INDEX idx_stock_items_unique_outlet
    ON stock_items(product_id, outlet_id)
    WHERE outlet_id IS NOT NULL;

CREATE INDEX idx_stock_items_workspace_id ON stock_items(workspace_id);
CREATE INDEX idx_stock_items_product_id ON stock_items(product_id);
CREATE INDEX idx_stock_items_warehouse_id ON stock_items(warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX idx_stock_items_outlet_id ON stock_items(outlet_id) WHERE outlet_id IS NOT NULL;

CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON stock_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE stock_movement_type AS ENUM ('entry', 'exit', 'transfer', 'adjustment', 'return');
CREATE TYPE stock_movement_status AS ENUM ('pending', 'validated', 'cancelled');

CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_id VARCHAR(50) UNIQUE NOT NULL,
    movement_number VARCHAR(50) NOT NULL,
    type stock_movement_type NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    source_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    destination_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_cost DECIMAL(15, 2),
    total_cost DECIMAL(15, 2),
    reason TEXT,
    status stock_movement_status DEFAULT 'pending' NOT NULL,
    reference VARCHAR(255),
    attachment_url TEXT,
    processed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    processed_at TIMESTAMP NOT NULL,
    validated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_at TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_stock_movements_workspace_id ON stock_movements(workspace_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_stock_movements_status ON stock_movements(status);
CREATE INDEX idx_stock_movements_processed_at ON stock_movements(processed_at);

CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE stock_alert_type AS ENUM ('low_stock', 'out_of_stock', 'overstock');

CREATE TABLE stock_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id VARCHAR(50) UNIQUE NOT NULL,
    stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
    alert_type stock_alert_type NOT NULL,
    current_quantity DECIMAL(10, 3) NOT NULL,
    threshold_quantity DECIMAL(10, 3) NOT NULL,
    is_resolved BOOLEAN DEFAULT false NOT NULL,
    resolved_at TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_stock_alerts_workspace_id ON stock_alerts(workspace_id);
CREATE INDEX idx_stock_alerts_is_resolved ON stock_alerts(is_resolved);

CREATE TRIGGER update_stock_alerts_updated_at BEFORE UPDATE ON stock_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODULE 7.3 - Trésorerie Multi-wallet
-- ============================================================================

CREATE TYPE wallet_type AS ENUM ('cash', 'bank', 'mobile_money', 'other');
CREATE TYPE wallet_status AS ENUM ('active', 'inactive', 'closed');

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    type wallet_type NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    initial_balance DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    description TEXT,
    status wallet_status DEFAULT 'active' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_wallets_workspace_id ON wallets(workspace_id);
CREATE INDEX idx_wallets_type ON wallets(type);
CREATE INDEX idx_wallets_status ON wallets(status);

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE transaction_category AS ENUM ('sale', 'purchase', 'salary', 'advance', 'debt_payment', 'expense', 'transfer', 'adjustment', 'other');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    transaction_number VARCHAR(50) NOT NULL,
    type transaction_type NOT NULL,
    category transaction_category NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    source_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    destination_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    reference VARCHAR(255),
    attachment_url TEXT,
    status transaction_status DEFAULT 'pending' NOT NULL,
    processed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    processed_at TIMESTAMP NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_transactions_workspace_id ON transactions(workspace_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_processed_at ON transactions(processed_at);
CREATE INDEX idx_transactions_source_wallet_id ON transactions(source_wallet_id);
CREATE INDEX idx_transactions_destination_wallet_id ON transactions(destination_wallet_id);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ajouter la contrainte FK pour sale_payments.wallet_id maintenant que wallets existe
ALTER TABLE sale_payments
    ADD CONSTRAINT fk_sale_payments_wallet
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL;

-- ============================================================================
-- MODULE 7.4 - Production & Usine
-- ============================================================================

CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL, -- kg, L, piece, etc.
    unit_cost DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    minimum_stock DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    current_stock DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    supplier VARCHAR(255),
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_ingredients_workspace_id ON ingredients(workspace_id);
CREATE INDEX idx_ingredients_code ON ingredients(code);

CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id VARCHAR(50) UNIQUE NOT NULL,
    recipe_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255),
    version INTEGER DEFAULT 1 NOT NULL,
    output_quantity DECIMAL(10, 3) NOT NULL,
    output_unit VARCHAR(50) NOT NULL,
    estimated_duration INTEGER, -- minutes
    instructions TEXT,
    yield_rate DECIMAL(5, 2) DEFAULT 100 NOT NULL, -- pourcentage
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_recipes_workspace_id ON recipes(workspace_id);
CREATE INDEX idx_recipes_product_id ON recipes(product_id);

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE recipe_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_line_id VARCHAR(50) UNIQUE NOT NULL,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    ingredient_name VARCHAR(255),
    quantity DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    loss DECIMAL(5, 2) DEFAULT 0, -- pourcentage de perte
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_recipe_lines_recipe_id ON recipe_lines(recipe_id);
CREATE INDEX idx_recipe_lines_ingredient_id ON recipe_lines(ingredient_id);

-- ============================================================================

CREATE TYPE production_order_status AS ENUM ('draft', 'planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE production_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id VARCHAR(50) UNIQUE NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
    recipe_name VARCHAR(255),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255),
    status production_order_status DEFAULT 'draft' NOT NULL,
    planned_quantity DECIMAL(10, 3) NOT NULL,
    produced_quantity DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    unit VARCHAR(50) NOT NULL,
    planned_start_date TIMESTAMP NOT NULL,
    planned_end_date TIMESTAMP NOT NULL,
    actual_start_date TIMESTAMP,
    actual_end_date TIMESTAMP,
    priority production_priority DEFAULT 'normal' NOT NULL,
    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_name VARCHAR(255),
    source_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    total_cost DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    yield_rate DECIMAL(5, 2),
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_production_orders_workspace_id ON production_orders(workspace_id);
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_product_id ON production_orders(product_id);
CREATE INDEX idx_production_orders_planned_start_date ON production_orders(planned_start_date);

CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE ingredient_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consumption_id VARCHAR(50) UNIQUE NOT NULL,
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    ingredient_name VARCHAR(255),
    planned_quantity DECIMAL(10, 3) NOT NULL,
    actual_quantity DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    variance DECIMAL(5, 2), -- pourcentage d'écart
    consumed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_ingredient_consumptions_production_order_id ON ingredient_consumptions(production_order_id);
CREATE INDEX idx_ingredient_consumptions_ingredient_id ON ingredient_consumptions(ingredient_id);

-- ============================================================================

CREATE TABLE production_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(50) UNIQUE NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255),
    quantity_produced DECIMAL(10, 3) NOT NULL,
    quantity_defective DECIMAL(10, 3) DEFAULT 0 NOT NULL,
    quantity_good DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    quality_score DECIMAL(5, 2), -- 0-100
    expiry_date DATE,
    production_date DATE NOT NULL,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_production_batches_production_order_id ON production_batches(production_order_id);
CREATE INDEX idx_production_batches_product_id ON production_batches(product_id);
CREATE INDEX idx_production_batches_expiry_date ON production_batches(expiry_date);

CREATE TRIGGER update_production_batches_updated_at BEFORE UPDATE ON production_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODULE 7.5 - Dépenses & Sollicitations
-- ============================================================================

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_category_id VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    requires_pre_approval BOOLEAN DEFAULT false NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(50),
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_expense_categories_workspace_id ON expense_categories(workspace_id);

CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE expense_request_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'cancelled');

CREATE TABLE expense_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_request_id VARCHAR(50) UNIQUE NOT NULL,
    request_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status expense_request_status DEFAULT 'draft' NOT NULL,
    submitted_at TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_expense_requests_workspace_id ON expense_requests(workspace_id);
CREATE INDEX idx_expense_requests_status ON expense_requests(status);
CREATE INDEX idx_expense_requests_requester_id ON expense_requests(requester_id);

CREATE TRIGGER update_expense_requests_updated_at BEFORE UPDATE ON expense_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE approval_step_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE expense_approval_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_step_id VARCHAR(50) UNIQUE NOT NULL,
    expense_request_id UUID NOT NULL REFERENCES expense_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    step_order INTEGER NOT NULL,
    status approval_step_status DEFAULT 'pending' NOT NULL,
    comments TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_expense_approval_steps_expense_request_id ON expense_approval_steps(expense_request_id);

CREATE TRIGGER update_expense_approval_steps_updated_at BEFORE UPDATE ON expense_approval_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'paid', 'rejected', 'cancelled');

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id VARCHAR(50) UNIQUE NOT NULL,
    expense_number VARCHAR(50) NOT NULL,
    expense_request_id UUID NOT NULL REFERENCES expense_requests(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    payer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    beneficiary_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status expense_status DEFAULT 'pending' NOT NULL,
    payment_date TIMESTAMP,
    payment_method VARCHAR(50),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_expenses_workspace_id ON expenses(workspace_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_expense_request_id ON expenses(expense_request_id);

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE expense_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attachment_id VARCHAR(50) UNIQUE NOT NULL,
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_expense_attachments_expense_id ON expense_attachments(expense_id);

-- ============================================================================
-- MODULE 7.6 - Avances & Dettes
-- ============================================================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(50) UNIQUE NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('agent', 'supplier', 'client', 'other')),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(code, workspace_id)
);

CREATE INDEX idx_accounts_workspace_id ON accounts(workspace_id);
CREATE INDEX idx_accounts_account_type ON accounts(account_type);

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE advance_debt_type AS ENUM ('advance', 'debt');
CREATE TYPE advance_debt_status AS ENUM ('active', 'partially_paid', 'fully_paid', 'cancelled');

CREATE TABLE advance_debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advance_debt_id VARCHAR(50) UNIQUE NOT NULL,
    record_number VARCHAR(50) NOT NULL,
    type advance_debt_type NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL,
    reason TEXT NOT NULL,
    due_date DATE,
    status advance_debt_status DEFAULT 'active' NOT NULL,
    granted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_advance_debts_workspace_id ON advance_debts(workspace_id);
CREATE INDEX idx_advance_debts_account_id ON advance_debts(account_id);
CREATE INDEX idx_advance_debts_status ON advance_debts(status);
CREATE INDEX idx_advance_debts_type ON advance_debts(type);

CREATE TRIGGER update_advance_debts_updated_at BEFORE UPDATE ON advance_debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE advance_debt_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id VARCHAR(50) UNIQUE NOT NULL,
    advance_debt_id UUID NOT NULL REFERENCES advance_debts(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    is_paid BOOLEAN DEFAULT false NOT NULL,
    paid_at TIMESTAMP,
    paid_amount DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_advance_debt_schedules_advance_debt_id ON advance_debt_schedules(advance_debt_id);

CREATE TRIGGER update_advance_debt_schedules_updated_at BEFORE UPDATE ON advance_debt_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE movement_type AS ENUM ('payment', 'justification', 'adjustment');

CREATE TABLE advance_debt_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_id VARCHAR(50) UNIQUE NOT NULL,
    advance_debt_id UUID NOT NULL REFERENCES advance_debts(id) ON DELETE CASCADE,
    movement_type movement_type NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    attachment_url TEXT,
    processed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    processed_at TIMESTAMP NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_advance_debt_movements_advance_debt_id ON advance_debt_movements(advance_debt_id);

CREATE TRIGGER update_advance_debt_movements_updated_at BEFORE UPDATE ON advance_debt_movements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Continue dans le prochain message...
