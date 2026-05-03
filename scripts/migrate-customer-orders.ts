#!/usr/bin/env tsx
/**
 * Migration : tables customer_orders, customer_order_lines, customer_order_payments.
 * Idempotente.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

const SQL = `
-- ENUM statut commande
DO $$ BEGIN
  CREATE TYPE customer_order_status AS ENUM (
    'draft', 'submitted', 'approved', 'in_production',
    'produced', 'transferred', 'delivered', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customer_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(50) UNIQUE NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'XOF' NOT NULL,
    status customer_order_status DEFAULT 'draft' NOT NULL,
    requested_delivery_date DATE,
    destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    destination_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    notes TEXT,
    requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    production_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_co_workspace ON customer_orders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_co_status    ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_co_client    ON customer_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_co_created   ON customer_orders(created_at);

DROP TRIGGER IF EXISTS update_customer_orders_updated_at ON customer_orders;
CREATE TRIGGER update_customer_orders_updated_at BEFORE UPDATE ON customer_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Lignes
CREATE TABLE IF NOT EXISTS customer_order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    line_total DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_co_lines_order ON customer_order_lines(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_co_lines_product ON customer_order_lines(product_id);

-- Paiements (avance + paiements complémentaires)
CREATE TABLE IF NOT EXISTS customer_order_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method payment_method NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    received_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_advance BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_co_payments_order ON customer_order_payments(customer_order_id);

-- production_orders peut être rattachée à une commande client (lien optionnel)
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS customer_order_id UUID REFERENCES customer_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_po_customer_order ON production_orders(customer_order_id);
`;

(async () => {
  console.log('🔧 Migration customer_orders + dépendances');
  await pool.query(SQL);
  const r = await pool.query(`SELECT COUNT(*) FROM customer_orders`);
  console.log(`✅ Tables OK (${r.rows[0].count} commandes existantes)`);
  await pool.end();
})();
