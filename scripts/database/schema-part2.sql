-- ============================================================================
-- DDM - Schéma PostgreSQL Complet (PARTIE 2)
-- ============================================================================
-- Suite du fichier schema.sql
-- À exécuter APRÈS schema.sql
-- ============================================================================

-- ============================================================================
-- MODULE 7.7 - Ressources Humaines
-- ============================================================================

CREATE TYPE contract_type AS ENUM ('permanent', 'temporary', 'contractor', 'intern');
CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'suspended', 'terminated');

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    date_of_birth DATE,
    hire_date DATE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(255) NOT NULL,
    contract_type contract_type NOT NULL,
    base_salary DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    bank_account VARCHAR(100),
    tax_number VARCHAR(100),
    social_security_number VARCHAR(100),
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(50),
    status employee_status DEFAULT 'active' NOT NULL,
    termination_date DATE,
    termination_reason TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(employee_code, workspace_id)
);

CREATE INDEX idx_employees_workspace_id ON employees(workspace_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department);

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'remote');

CREATE TABLE attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id VARCHAR(50) UNIQUE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    worked_hours DECIMAL(5, 2),
    notes TEXT,
    validated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_at TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(employee_id, date)
);

CREATE INDEX idx_attendances_employee_id ON attendances(employee_id);
CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_attendances_workspace_id ON attendances(workspace_id);

CREATE TRIGGER update_attendances_updated_at BEFORE UPDATE ON attendances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leave_id VARCHAR(50) UNIQUE NOT NULL,
    leave_number VARCHAR(50) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL,
    reason TEXT,
    status leave_status DEFAULT 'pending' NOT NULL,
    requested_at TIMESTAMP NOT NULL,
    reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    attachment_url TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX idx_leaves_status ON leaves(status);
CREATE INDEX idx_leaves_start_date ON leaves(start_date);

CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON leaves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE payroll_status AS ENUM ('draft', 'validated', 'paid', 'cancelled');

CREATE TABLE payrolls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_id VARCHAR(50) UNIQUE NOT NULL,
    payroll_number VARCHAR(50) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    period VARCHAR(7) NOT NULL, -- YYYY-MM
    base_salary DECIMAL(15, 2) NOT NULL,
    allowances DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    bonuses DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    deductions DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    advance_deduction DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    net_salary DECIMAL(15, 2) NOT NULL,
    payment_date DATE,
    payment_method VARCHAR(50),
    status payroll_status DEFAULT 'draft' NOT NULL,
    notes TEXT,
    processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_payrolls_employee_id ON payrolls(employee_id);
CREATE INDEX idx_payrolls_period ON payrolls(period);
CREATE INDEX idx_payrolls_status ON payrolls(status);

CREATE TRIGGER update_payrolls_updated_at BEFORE UPDATE ON payrolls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE payroll_item_type AS ENUM ('allowance', 'bonus', 'deduction');

CREATE TABLE payroll_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_item_id VARCHAR(50) UNIQUE NOT NULL,
    payroll_id UUID NOT NULL REFERENCES payrolls(id) ON DELETE CASCADE,
    item_type payroll_item_type NOT NULL,
    label VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_payroll_items_payroll_id ON payroll_items(payroll_id);

-- ============================================================================

CREATE TABLE employee_advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advance_id VARCHAR(50) UNIQUE NOT NULL,
    advance_number VARCHAR(50) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT,
    request_date DATE NOT NULL,
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    payment_date DATE,
    payment_method VARCHAR(50),
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    deduction_payroll_id UUID REFERENCES payrolls(id) ON DELETE SET NULL,
    deduction_date DATE,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_employee_advances_employee_id ON employee_advances(employee_id);
CREATE INDEX idx_employee_advances_status ON employee_advances(status);

CREATE TRIGGER update_employee_advances_updated_at BEFORE UPDATE ON employee_advances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE employee_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id VARCHAR(50) UNIQUE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- YYYY-MM
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    sales_target DECIMAL(15, 2) NOT NULL,
    current_sales DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    achievement_rate DECIMAL(5, 2) DEFAULT 0 NOT NULL,
    target_bonus DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    bonus_earned DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    bonus_paid BOOLEAN DEFAULT false NOT NULL,
    is_achieved BOOLEAN DEFAULT false NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_employee_targets_employee_id ON employee_targets(employee_id);
CREATE INDEX idx_employee_targets_period ON employee_targets(period);

CREATE TRIGGER update_employee_targets_updated_at BEFORE UPDATE ON employee_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commission_id VARCHAR(50) UNIQUE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    period VARCHAR(7) NOT NULL,
    based_on_amount DECIMAL(15, 2),
    commission_rate DECIMAL(5, 2),
    calculated_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    reference_id VARCHAR(50),
    reference_type VARCHAR(50),
    reference_number VARCHAR(50),
    paid_date DATE,
    payroll_id UUID REFERENCES payrolls(id) ON DELETE SET NULL,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_commissions_employee_id ON commissions(employee_id);
CREATE INDEX idx_commissions_period ON commissions(period);
CREATE INDEX idx_commissions_status ON commissions(status);

CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE transport_allowances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transport_id VARCHAR(50) UNIQUE NOT NULL,
    transport_number VARCHAR(50) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    transport_type VARCHAR(50) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    default_rate DECIMAL(15, 2) NOT NULL,
    applied_rate DECIMAL(15, 2) NOT NULL,
    location_id VARCHAR(50),
    location_name VARCHAR(255),
    attendance_id UUID REFERENCES attendances(id) ON DELETE SET NULL,
    proof_photo_url TEXT,
    distance_km DECIMAL(10, 2),
    rate_per_km DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    validated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    validated_at TIMESTAMP,
    rejection_reason TEXT,
    paid_date DATE,
    payroll_id UUID REFERENCES payrolls(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_transport_allowances_employee_id ON transport_allowances(employee_id);
CREATE INDEX idx_transport_allowances_work_date ON transport_allowances(work_date);
CREATE INDEX idx_transport_allowances_status ON transport_allowances(status);

CREATE TRIGGER update_transport_allowances_updated_at BEFORE UPDATE ON transport_allowances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODULE 7.8 - Clients & Fidélité
-- ============================================================================

CREATE TYPE customer_type AS ENUM ('individual', 'business');
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'suspended', 'vip');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    customer_code VARCHAR(50) NOT NULL,
    type customer_type NOT NULL,
    status customer_status DEFAULT 'active' NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    company_registration VARCHAR(100),
    tax_number VARCHAR(100),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Cameroun',
    loyalty_tier loyalty_tier DEFAULT 'bronze' NOT NULL,
    loyalty_points INTEGER DEFAULT 0 NOT NULL,
    total_points_earned INTEGER DEFAULT 0 NOT NULL,
    total_points_redeemed INTEGER DEFAULT 0 NOT NULL,
    member_since DATE NOT NULL,
    last_visit TIMESTAMP,
    total_orders INTEGER DEFAULT 0 NOT NULL,
    total_spent DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    average_order_value DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    last_order_date DATE,
    last_order_amount DECIMAL(15, 2),
    preferred_payment_method VARCHAR(50),
    preferred_language VARCHAR(10) DEFAULT 'fr',
    receive_promotions BOOLEAN DEFAULT true NOT NULL,
    receive_sms BOOLEAN DEFAULT true NOT NULL,
    receive_email BOOLEAN DEFAULT false NOT NULL,
    assigned_sales_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_sales_agent_name VARCHAR(255),
    tags TEXT[],
    notes TEXT,
    photo_url TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    UNIQUE(customer_code, workspace_id)
);

CREATE INDEX idx_customers_workspace_id ON customers(workspace_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_loyalty_tier ON customers(loyalty_tier);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE loyalty_transaction_type AS ENUM ('earn', 'redeem', 'adjustment', 'expiration');

CREATE TABLE loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type loyalty_transaction_type NOT NULL,
    points INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_id VARCHAR(50),
    reference_type VARCHAR(50),
    reference_number VARCHAR(50),
    description TEXT NOT NULL,
    processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    expiration_date DATE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions(type);

-- ============================================================================

CREATE TYPE reward_type AS ENUM ('discount', 'free_product', 'cashback', 'points_multiplier', 'special_offer');

CREATE TABLE loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reward_id VARCHAR(50) UNIQUE NOT NULL,
    reward_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type reward_type NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    points_cost INTEGER NOT NULL,
    discount_percentage DECIMAL(5, 2),
    discount_amount DECIMAL(15, 2),
    free_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    free_product_name VARCHAR(255),
    cashback_amount DECIMAL(15, 2),
    points_multiplier DECIMAL(5, 2),
    minimum_tier loyalty_tier,
    minimum_purchase DECIMAL(15, 2),
    valid_from DATE,
    valid_until DATE,
    max_redemptions_per_customer INTEGER,
    total_available INTEGER,
    total_redeemed INTEGER DEFAULT 0 NOT NULL,
    applicable_products TEXT[],
    applicable_categories TEXT[],
    excluded_products TEXT[],
    image_url TEXT,
    terms TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_loyalty_rewards_workspace_id ON loyalty_rewards(workspace_id);
CREATE INDEX idx_loyalty_rewards_type ON loyalty_rewards(type);
CREATE INDEX idx_loyalty_rewards_is_active ON loyalty_rewards(is_active);

CREATE TRIGGER update_loyalty_rewards_updated_at BEFORE UPDATE ON loyalty_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE reward_status AS ENUM ('available', 'redeemed', 'expired', 'cancelled');

CREATE TABLE customer_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_reward_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
    status reward_status NOT NULL,
    points_spent INTEGER NOT NULL,
    discount_percentage DECIMAL(5, 2),
    discount_amount DECIMAL(15, 2),
    cashback_amount DECIMAL(15, 2),
    redeemed_at TIMESTAMP NOT NULL,
    redeemed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMP,
    used_in_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    used_in_sale_number VARCHAR(50),
    expires_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_customer_rewards_customer_id ON customer_rewards(customer_id);
CREATE INDEX idx_customer_rewards_status ON customer_rewards(status);

CREATE TRIGGER update_customer_rewards_updated_at BEFORE UPDATE ON customer_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE loyalty_tier_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_config_id VARCHAR(50) UNIQUE NOT NULL,
    tier loyalty_tier UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    minimum_points INTEGER,
    minimum_spent DECIMAL(15, 2),
    minimum_orders INTEGER,
    points_earn_rate DECIMAL(5, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2),
    birthday_bonus INTEGER,
    welcome_bonus INTEGER,
    free_shipping BOOLEAN DEFAULT false NOT NULL,
    priority_support BOOLEAN DEFAULT false NOT NULL,
    exclusive_products BOOLEAN DEFAULT false NOT NULL,
    early_access_sales BOOLEAN DEFAULT false NOT NULL,
    color VARCHAR(50),
    icon_url TEXT,
    badge_url TEXT,
    "order" INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_loyalty_tier_configs_workspace_id ON loyalty_tier_configs(workspace_id);

CREATE TRIGGER update_loyalty_tier_configs_updated_at BEFORE UPDATE ON loyalty_tier_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE customer_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    customer_count INTEGER DEFAULT 0 NOT NULL,
    total_revenue DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    last_calculated_at TIMESTAMP,
    color VARCHAR(50),
    is_active BOOLEAN DEFAULT true NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_customer_segments_workspace_id ON customer_segments(workspace_id);

CREATE TRIGGER update_customer_segments_updated_at BEFORE UPDATE ON customer_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TYPE interaction_type AS ENUM ('call', 'email', 'sms', 'visit', 'complaint', 'feedback', 'note');
CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative');

CREATE TABLE customer_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interaction_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type interaction_type NOT NULL,
    subject VARCHAR(255),
    description TEXT NOT NULL,
    sentiment sentiment_type,
    interaction_date TIMESTAMP NOT NULL,
    duration INTEGER, -- minutes
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(255),
    follow_up_required BOOLEAN DEFAULT false NOT NULL,
    follow_up_date DATE,
    follow_up_done BOOLEAN DEFAULT false NOT NULL,
    attachments TEXT[],
    tags TEXT[],
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_customer_interactions_customer_id ON customer_interactions(customer_id);
CREATE INDEX idx_customer_interactions_type ON customer_interactions(type);
CREATE INDEX idx_customer_interactions_interaction_date ON customer_interactions(interaction_date);

CREATE TRIGGER update_customer_interactions_updated_at BEFORE UPDATE ON customer_interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

CREATE TABLE customer_feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    product_rating INTEGER CHECK (product_rating >= 1 AND product_rating <= 5),
    service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    comment TEXT,
    sentiment sentiment_type,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    sale_number VARCHAR(50),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    response TEXT,
    responded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_by_name VARCHAR(255),
    responded_at TIMESTAMP,
    is_public BOOLEAN DEFAULT false NOT NULL,
    is_verified BOOLEAN DEFAULT false NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_customer_feedbacks_customer_id ON customer_feedbacks(customer_id);
CREATE INDEX idx_customer_feedbacks_rating ON customer_feedbacks(rating);

CREATE TRIGGER update_customer_feedbacks_updated_at BEFORE UPDATE ON customer_feedbacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Continue dans le prochain fichier schema-part3.sql...
