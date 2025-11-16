-- ============================================================================
-- DDM - Données de Test Cohérentes
-- ============================================================================
-- Script pour peupler la base avec des données réalistes pour tests
-- À exécuter APRÈS schema.sql, schema-part2.sql et schema-part3.sql
-- ============================================================================

-- Désactiver temporairement les triggers pour l'insertion
SET session_replication_role = 'replica';

-- ============================================================================
-- 1. WORKSPACE & PERMISSIONS
-- ============================================================================

INSERT INTO workspaces (id, workspace_id, name, slug, description, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'WS-001', 'Douala Distribution & Management', 'ddm-douala', 'Entreprise de distribution basée à Douala, Cameroun', true),
('550e8400-e29b-41d4-a716-446655440002', 'WS-002', 'Yaoundé Logistics', 'yaoundé-log', 'Bureau secondaire à Yaoundé', true);

-- Permissions
INSERT INTO permissions (id, permission_id, name, code, description, module, is_active) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'PERM-001', 'Créer ventes', 'SALES_CREATE', 'Créer des ventes', 'sales', true),
('660e8400-e29b-41d4-a716-446655440002', 'PERM-002', 'Voir ventes', 'SALES_VIEW', 'Consulter les ventes', 'sales', true),
('660e8400-e29b-41d4-a716-446655440003', 'PERM-003', 'Modifier ventes', 'SALES_UPDATE', 'Modifier les ventes', 'sales', true),
('660e8400-e29b-41d4-a716-446655440004', 'PERM-004', 'Supprimer ventes', 'SALES_DELETE', 'Supprimer les ventes', 'sales', true),
('660e8400-e29b-41d4-a716-446655440005', 'PERM-005', 'Gérer stock', 'STOCK_MANAGE', 'Gérer le stock', 'stock', true),
('660e8400-e29b-41d4-a716-446655440006', 'PERM-006', 'Voir rapports', 'REPORTS_VIEW', 'Consulter les rapports', 'reports', true),
('660e8400-e29b-41d4-a716-446655440007', 'PERM-007', 'Gérer trésorerie', 'TREASURY_MANAGE', 'Gérer la trésorerie', 'treasury', true),
('660e8400-e29b-41d4-a716-446655440008', 'PERM-008', 'Gérer RH', 'HR_MANAGE', 'Gérer les ressources humaines', 'hr', true),
('660e8400-e29b-41d4-a716-446655440009', 'PERM-009', 'Approuver dépenses', 'EXPENSES_APPROVE', 'Approuver les dépenses', 'expenses', true),
('660e8400-e29b-41d4-a716-446655440010', 'PERM-010', 'Admin système', 'ADMIN_SYSTEM', 'Administrateur système complet', 'admin', true);

-- Rôles
INSERT INTO roles (id, role_id, name, description, permission_ids, workspace_id, is_active) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'ROLE-001', 'Administrateur', 'Accès complet au système',
    ARRAY['PERM-001', 'PERM-002', 'PERM-003', 'PERM-004', 'PERM-005', 'PERM-006', 'PERM-007', 'PERM-008', 'PERM-009', 'PERM-010'],
    '550e8400-e29b-41d4-a716-446655440001', true),
('770e8400-e29b-41d4-a716-446655440002', 'ROLE-002', 'Manager', 'Gestion opérationnelle',
    ARRAY['PERM-001', 'PERM-002', 'PERM-003', 'PERM-005', 'PERM-006', 'PERM-007', 'PERM-009'],
    '550e8400-e29b-41d4-a716-446655440001', true),
('770e8400-e29b-41d4-a716-446655440003', 'ROLE-003', 'Agent Commercial', 'Ventes uniquement',
    ARRAY['PERM-001', 'PERM-002'],
    '550e8400-e29b-41d4-a716-446655440001', true),
('770e8400-e29b-41d4-a716-446655440004', 'ROLE-004', 'Magasinier', 'Gestion stock',
    ARRAY['PERM-002', 'PERM-005'],
    '550e8400-e29b-41d4-a716-446655440001', true);

-- Utilisateurs (mot de passe: "password123" hashé avec bcrypt)
INSERT INTO users (id, user_id, email, password_hash, full_name, display_name, phone, workspace_id, role_id, is_active) VALUES
('880e8400-e29b-41d4-a716-446655440001', 'USR-001', 'admin@ddm.cm', '$2a$10$K7Ln1FH8RPNFZzL8YxPGHuN5c4rBzlBKJT8VH9HQ8RUyFZQ8bQO0m', 'Marie Kouam', 'Marie K.', '+237670123456', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', true),
('880e8400-e29b-41d4-a716-446655440002', 'USR-002', 'paul.nguesso@ddm.cm', '$2a$10$K7Ln1FH8RPNFZzL8YxPGHuN5c4rBzlBKJT8VH9HQ8RUyFZQ8bQO0m', 'Paul Nguesso', 'Paul N.', '+237670234567', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440002', true),
('880e8400-e29b-41d4-a716-446655440003', 'USR-003', 'sylvie.mbarga@ddm.cm', '$2a$10$K7Ln1FH8RPNFZzL8YxPGHuN5c4rBzlBKJT8VH9HQ8RUyFZQ8bQO0m', 'Sylvie Mbarga', 'Sylvie M.', '+237670345678', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440003', true),
('880e8400-e29b-41d4-a716-446655440004', 'USR-004', 'roger.fotso@ddm.cm', '$2a$10$K7Ln1FH8RPNFZzL8YxPGHuN5c4rBzlBKJT8VH9HQ8RUyFZQ8bQO0m', 'Roger Fotso', 'Roger F.', '+237670456789', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440003', true),
('880e8400-e29b-41d4-a716-446655440005', 'USR-005', 'jean.tala@ddm.cm', '$2a$10$K7Ln1FH8RPNFZzL8YxPGHuN5c4rBzlBKJT8VH9HQ8RUyFZQ8bQO0m', 'Jean Tala', 'Jean T.', '+237670567890', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440004', true);

-- ============================================================================
-- 2. PRODUITS
-- ============================================================================

INSERT INTO products (id, product_id, name, code, description, unit_price, currency, category, unit, is_active, workspace_id) VALUES
-- Boissons
('990e8400-e29b-41d4-a716-446655440001', 'PRD-001', 'Coca-Cola 33cl', 'COCA-33', 'Canette Coca-Cola 33cl', 300, 'XOF', 'Boissons', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440002', 'PRD-002', 'Eau minérale 1.5L', 'EAU-15', 'Bouteille eau minérale 1.5L', 250, 'XOF', 'Boissons', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440003', 'PRD-003', 'Jus Tropical 1L', 'JUS-TRP', 'Jus de fruits tropical 1L', 800, 'XOF', 'Boissons', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440004', 'PRD-004', 'Bière Castel 65cl', 'BIERE-CAS', 'Bière Castel bouteille 65cl', 600, 'XOF', 'Boissons', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),

-- Alimentaire
('990e8400-e29b-41d4-a716-446655440005', 'PRD-005', 'Riz parfumé 50kg', 'RIZ-50', 'Sac de riz parfumé 50kg', 18000, 'XOF', 'Alimentaire', 'sac', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440006', 'PRD-006', 'Huile végétale 5L', 'HUILE-5', 'Bidon huile végétale 5L', 4500, 'XOF', 'Alimentaire', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440007', 'PRD-007', 'Sucre cristal 50kg', 'SUCRE-50', 'Sac sucre cristallisé 50kg', 25000, 'XOF', 'Alimentaire', 'sac', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440008', 'PRD-008', 'Farine de blé 25kg', 'FARINE-25', 'Sac farine de blé 25kg', 12000, 'XOF', 'Alimentaire', 'sac', true, '550e8400-e29b-41d4-a716-446655440001'),

-- Hygiène
('990e8400-e29b-41d4-a716-446655440009', 'PRD-009', 'Savon lessive 1kg', 'SAVON-1', 'Savon en poudre 1kg', 1200, 'XOF', 'Hygiène', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440010', 'PRD-010', 'Dentifrice Signal', 'DENTI-SIG', 'Dentifrice Signal 75ml', 800, 'XOF', 'Hygiène', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440011', 'PRD-011', 'Shampoing Dove 200ml', 'SHAMP-DOV', 'Shampoing Dove 200ml', 1500, 'XOF', 'Hygiène', 'piece', true, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440012', 'PRD-012', 'Papier toilette x12', 'PAPIER-12', 'Pack de 12 rouleaux papier toilette', 3000, 'XOF', 'Hygiène', 'piece', true, '550e8400-e29b-41d4-a716-446655440001');

-- ============================================================================
-- 3. CLIENTS
-- ============================================================================

INSERT INTO customers (id, customer_id, customer_code, type, status, first_name, last_name, full_name, phone, email, address, city, loyalty_tier, loyalty_points, member_since, total_orders, total_spent, workspace_id) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', 'CUS-001', 'CUS-0001', 'individual', 'active', 'Amadou', 'Diallo', 'Amadou Diallo', '+237690111222', 'amadou.diallo@email.cm', 'Akwa, Douala', 'Douala', 'gold', 450, '2024-01-15', 12, 125000, '550e8400-e29b-41d4-a716-446655440001'),
('aa0e8400-e29b-41d4-a716-446655440002', 'CUS-002', 'CUS-0002', 'business', 'vip', NULL, NULL, 'Pharmacie du Centre', '+237690222333', 'contact@pharmacentre.cm', 'Bonapriso, Douala', 'Douala', 'platinum', 1250, '2023-06-10', 45, 850000, '550e8400-e29b-41d4-a716-446655440001'),
('aa0e8400-e29b-41d4-a716-446655440003', 'CUS-003', 'CUS-0003', 'individual', 'active', 'Fatima', 'Nkolo', 'Fatima Nkolo', '+237690333444', NULL, 'Bépanda, Douala', 'Douala', 'silver', 180, '2024-03-20', 6, 45000, '550e8400-e29b-41d4-a716-446655440001'),
('aa0e8400-e29b-41d4-a716-446655440004', 'CUS-004', 'CUS-0004', 'business', 'active', NULL, NULL, 'Restaurant Le Palais', '+237690444555', 'resto.palais@email.cm', 'Bonanjo, Douala', 'Douala', 'gold', 620, '2023-11-05', 28, 320000, '550e8400-e29b-41d4-a716-446655440001'),
('aa0e8400-e29b-41d4-a716-446655440005', 'CUS-005', 'CUS-0005', 'individual', 'active', 'Christine', 'Onana', 'Christine Onana', '+237690555666', 'christine.o@email.cm', 'Logpom, Douala', 'Douala', 'bronze', 50, '2024-10-01', 2, 15000, '550e8400-e29b-41d4-a716-446655440001'),
('aa0e8400-e29b-41d4-a716-446655440006', 'CUS-006', 'CUS-0006', 'business', 'active', NULL, NULL, 'SuperMarché Express', '+237690666777', 'contact@superexpress.cm', 'Ndokoti, Douala', 'Douala', 'diamond', 2100, '2022-03-15', 89, 1450000, '550e8400-e29b-41d4-a716-446655440001');

-- ============================================================================
-- 4. ENTREPÔTS & STOCK
-- ============================================================================

INSERT INTO warehouses (id, warehouse_id, name, code, location, address, manager_id, is_active, workspace_id) VALUES
('bb0e8400-e29b-41d4-a716-446655440001', 'WH-001', 'Entrepôt Principal Douala', 'WH-DLA-01', 'Zone Industrielle Bassa', 'BP 1234 Douala', '880e8400-e29b-41d4-a716-446655440005', true, '550e8400-e29b-41d4-a716-446655440001'),
('bb0e8400-e29b-41d4-a716-446655440002', 'WH-002', 'Dépôt Bonabéri', 'WH-DLA-02', 'Bonabéri', 'Route Bonabéri, Douala', '880e8400-e29b-41d4-a716-446655440005', true, '550e8400-e29b-41d4-a716-446655440001'),
('bb0e8400-e29b-41d4-a716-446655440003', 'WH-003', 'Magasin Akwa', 'WH-DLA-03', 'Centre-ville Akwa', 'Avenue de la Liberté, Douala', NULL, true, '550e8400-e29b-41d4-a716-446655440001');

-- Stock Items
INSERT INTO stock_items (id, stock_item_id, product_id, warehouse_id, quantity, minimum_stock, maximum_stock, unit_cost, total_value, workspace_id) VALUES
-- Entrepôt Principal
('cc0e8400-e29b-41d4-a716-446655440001', 'STK-001', '990e8400-e29b-41d4-a716-446655440001', 'bb0e8400-e29b-41d4-a716-446655440001', 500, 100, 1000, 200, 100000, '550e8400-e29b-41d4-a716-446655440001'),
('cc0e8400-e29b-41d4-a716-446655440002', 'STK-002', '990e8400-e29b-41d4-a716-446655440002', 'bb0e8400-e29b-41d4-a716-446655440001', 800, 200, 1500, 180, 144000, '550e8400-e29b-41d4-a716-446655440001'),
('cc0e8400-e29b-41d4-a716-446655440003', 'STK-003', '990e8400-e29b-41d4-a716-446655440005', 'bb0e8400-e29b-41d4-a716-446655440001', 45, 10, 100, 15000, 675000, '550e8400-e29b-41d4-a716-446655440001'),
('cc0e8400-e29b-41d4-a716-446655440004', 'STK-004', '990e8400-e29b-41d4-a716-446655440006', 'bb0e8400-e29b-41d4-a716-446655440001', 120, 20, 200, 3800, 456000, '550e8400-e29b-41d4-a716-446655440001'),

-- Dépôt Bonabéri
('cc0e8400-e29b-41d4-a716-446655440005', 'STK-005', '990e8400-e29b-41d4-a716-446655440001', 'bb0e8400-e29b-41d4-a716-446655440002', 300, 50, 500, 200, 60000, '550e8400-e29b-41d4-a716-446655440001'),
('cc0e8400-e29b-41d4-a716-446655440006', 'STK-006', '990e8400-e29b-41d4-a716-446655440009', 'bb0e8400-e29b-41d4-a716-446655440002', 200, 50, 400, 900, 180000, '550e8400-e29b-41d4-a716-446655440001'),

-- Magasin Akwa
('cc0e8400-e29b-41d4-a716-446655440007', 'STK-007', '990e8400-e29b-41d4-a716-446655440010', 'bb0e8400-e29b-41d4-a716-446655440003', 150, 30, 300, 600, 90000, '550e8400-e29b-41d4-a716-446655440001'),
('cc0e8400-e29b-41d4-a716-446655440008', 'STK-008', '990e8400-e29b-41d4-a716-446655440011', 'bb0e8400-e29b-41d4-a716-446655440003', 80, 20, 150, 1100, 88000, '550e8400-e29b-41d4-a716-446655440001');

-- ============================================================================
-- 5. TRÉSORERIE
-- ============================================================================

INSERT INTO wallets (id, wallet_id, name, code, type, currency, balance, initial_balance, bank_name, account_number, status, is_active, workspace_id) VALUES
('dd0e8400-e29b-41d4-a716-446655440001', 'WAL-001', 'Caisse Principale', 'CASH-001', 'cash', 'XOF', 850000, 500000, NULL, NULL, 'active', true, '550e8400-e29b-41d4-a716-446655440001'),
('dd0e8400-e29b-41d4-a716-446655440002', 'WAL-002', 'Compte Ecobank', 'BANK-ECO', 'bank', 'XOF', 5250000, 3000000, 'Ecobank', 'CM21 0001 0000 1234 5678 9012 34', 'active', true, '550e8400-e29b-41d4-a716-446655440001'),
('dd0e8400-e29b-41d4-a716-446655440003', 'WAL-003', 'Mobile Money MTN', 'MM-MTN', 'mobile_money', 'XOF', 425000, 200000, 'MTN Mobile Money', '+237670123456', 'active', true, '550e8400-e29b-41d4-a716-446655440001'),
('dd0e8400-e29b-41d4-a716-446655440004', 'WAL-004', 'Caisse Bonabéri', 'CASH-002', 'cash', 'XOF', 320000, 100000, NULL, NULL, 'active', true, '550e8400-e29b-41d4-a716-446655440001');

-- Transactions
INSERT INTO transactions (id, transaction_id, transaction_number, type, category, amount, source_wallet_id, destination_wallet_id, description, status, processed_by_id, processed_at, workspace_id, created_at) VALUES
('ee0e8400-e29b-41d4-a716-446655440001', 'TRX-001', 'TRX-202411-0001', 'income', 'sale', 125000, NULL, 'dd0e8400-e29b-41d4-a716-446655440001', 'Encaissement vente SAL-202411-0015', 'completed', '880e8400-e29b-41d4-a716-446655440002', '2024-11-10 14:30:00', '550e8400-e29b-41d4-a716-446655440001', '2024-11-10 14:30:00'),
('ee0e8400-e29b-41d4-a716-446655440002', 'TRX-002', 'TRX-202411-0002', 'transfer', 'transfer', 500000, 'dd0e8400-e29b-41d4-a716-446655440001', 'dd0e8400-e29b-41d4-a716-446655440002', 'Versement caisse vers banque', 'completed', '880e8400-e29b-41d4-a716-446655440001', '2024-11-11 10:00:00', '550e8400-e29b-41d4-a716-446655440001', '2024-11-11 10:00:00'),
('ee0e8400-e29b-41d4-a716-446655440003', 'TRX-003', 'TRX-202411-0003', 'expense', 'salary', 180000, 'dd0e8400-e29b-41d4-a716-446655440002', NULL, 'Paiement salaire Roger Fotso', 'completed', '880e8400-e29b-41d4-a716-446655440001', '2024-11-05 16:00:00', '550e8400-e29b-41d4-a716-446655440001', '2024-11-05 16:00:00');

-- ============================================================================
-- 6. VENTES
-- ============================================================================

-- Ventes du mois
INSERT INTO sales (id, sale_id, sale_number, client_id, client_name, total_amount, amount_paid, balance, currency, status, payment_status, sale_date, sales_person_id, workspace_id, created_at) VALUES
('ff0e8400-e29b-41d4-a716-446655440001', 'SAL-001', 'SAL-202411-0001', 'aa0e8400-e29b-41d4-a716-446655440001', 'Amadou Diallo', 15600, 15600, 0, 'XOF', 'confirmed', 'fully_paid', '2024-11-05 09:15:00', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2024-11-05 09:15:00'),
('ff0e8400-e29b-41d4-a716-446655440002', 'SAL-002', 'SAL-202411-0002', 'aa0e8400-e29b-41d4-a716-446655440002', 'Pharmacie du Centre', 125000, 80000, 45000, 'XOF', 'confirmed', 'partially_paid', '2024-11-06 11:30:00', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '2024-11-06 11:30:00'),
('ff0e8400-e29b-41d4-a716-446655440003', 'SAL-003', 'SAL-202411-0003', 'aa0e8400-e29b-41d4-a716-446655440004', 'Restaurant Le Palais', 92000, 92000, 0, 'XOF', 'confirmed', 'fully_paid', '2024-11-07 14:45:00', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2024-11-07 14:45:00'),
('ff0e8400-e29b-41d4-a716-446655440004', 'SAL-004', 'SAL-202411-0004', NULL, 'Client Passant', 8500, 8500, 0, 'XOF', 'confirmed', 'fully_paid', '2024-11-08 16:20:00', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2024-11-08 16:20:00'),
('ff0e8400-e29b-41d4-a716-446655440005', 'SAL-005', 'SAL-202411-0005', 'aa0e8400-e29b-41d4-a716-446655440006', 'SuperMarché Express', 450000, 450000, 0, 'XOF', 'confirmed', 'fully_paid', '2024-11-10 10:00:00', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '2024-11-10 10:00:00');

-- Lignes de ventes
INSERT INTO sale_items (id, sale_item_id, sale_id, product_id, product_name, quantity, unit_price, total_price, currency, created_at) VALUES
-- Vente 1 (Amadou Diallo)
('aa1e8400-e29b-41d4-a716-446655440001', 'SALI-001', 'ff0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440001', 'Coca-Cola 33cl', 12, 300, 3600, 'XOF', '2024-11-05 09:15:00'),
('aa1e8400-e29b-41d4-a716-446655440002', 'SALI-002', 'ff0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440002', 'Eau minérale 1.5L', 24, 250, 6000, 'XOF', '2024-11-05 09:15:00'),
('aa1e8400-e29b-41d4-a716-446655440003', 'SALI-003', 'ff0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440006', 'Huile végétale 5L', 1, 4500, 4500, 'XOF', '2024-11-05 09:15:00'),
('aa1e8400-e29b-41d4-a716-446655440004', 'SALI-004', 'ff0e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440009', 'Savon lessive 1kg', 1, 1200, 1200, 'XOF', '2024-11-05 09:15:00'),

-- Vente 2 (Pharmacie du Centre)
('aa1e8400-e29b-41d4-a716-446655440005', 'SALI-005', 'ff0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440010', 'Dentifrice Signal', 50, 800, 40000, 'XOF', '2024-11-06 11:30:00'),
('aa1e8400-e29b-41d4-a716-446655440006', 'SALI-006', 'ff0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440011', 'Shampoing Dove 200ml', 40, 1500, 60000, 'XOF', '2024-11-06 11:30:00'),
('aa1e8400-e29b-41d4-a716-446655440007', 'SALI-007', 'ff0e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440012', 'Papier toilette x12', 8, 3000, 24000, 'XOF', '2024-11-06 11:30:00'),

-- Vente 3 (Restaurant)
('aa1e8400-e29b-41d4-a716-446655440008', 'SALI-008', 'ff0e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440005', 'Riz parfumé 50kg', 2, 18000, 36000, 'XOF', '2024-11-07 14:45:00'),
('aa1e8400-e29b-41d4-a716-446655440009', 'SALI-009', 'ff0e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440006', 'Huile végétale 5L', 10, 4500, 45000, 'XOF', '2024-11-07 14:45:00'),
('aa1e8400-e29b-41d4-a716-446655440010', 'SALI-010', 'ff0e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440007', 'Sucre cristal 50kg', 0.4, 25000, 10000, 'XOF', '2024-11-07 14:45:00'),

-- Vente 5 (SuperMarché)
('aa1e8400-e29b-41d4-a716-446655440011', 'SALI-011', 'ff0e8400-e29b-41d4-a716-446655440005', '990e8400-e29b-41d4-a716-446655440005', 'Riz parfumé 50kg', 10, 18000, 180000, 'XOF', '2024-11-10 10:00:00'),
('aa1e8400-e29b-41d4-a716-446655440012', 'SALI-012', 'ff0e8400-e29b-41d4-a716-446655440005', '990e8400-e29b-41d4-a716-446655440006', 'Huile végétale 5L', 30, 4500, 135000, 'XOF', '2024-11-10 10:00:00'),
('aa1e8400-e29b-41d4-a716-446655440013', 'SALI-013', 'ff0e8400-e29b-41d4-a716-446655440005', '990e8400-e29b-41d4-a716-446655440007', 'Sucre cristal 50kg', 5, 25000, 125000, 'XOF', '2024-11-10 10:00:00');

-- Paiements
INSERT INTO sale_payments (id, payment_id, sale_id, payment_number, amount, payment_method, payment_date, wallet_id, received_by_id, workspace_id, created_at) VALUES
('bb1e8400-e29b-41d4-a716-446655440001', 'PAY-001', 'ff0e8400-e29b-41d4-a716-446655440001', 'PAY-202411-0001', 15600, 'cash', '2024-11-05 09:15:00', 'dd0e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2024-11-05 09:15:00'),
('bb1e8400-e29b-41d4-a716-446655440002', 'PAY-002', 'ff0e8400-e29b-41d4-a716-446655440002', 'PAY-202411-0002', 50000, 'bank_transfer', '2024-11-06 11:30:00', 'dd0e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '2024-11-06 11:30:00'),
('bb1e8400-e29b-41d4-a716-446655440003', 'PAY-003', 'ff0e8400-e29b-41d4-a716-446655440002', 'PAY-202411-0003', 30000, 'mobile_money', '2024-11-07 09:00:00', 'dd0e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '2024-11-07 09:00:00'),
('bb1e8400-e29b-41d4-a716-446655440004', 'PAY-004', 'ff0e8400-e29b-41d4-a716-446655440003', 'PAY-202411-0004', 92000, 'cash', '2024-11-07 14:45:00', 'dd0e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '2024-11-07 14:45:00'),
('bb1e8400-e29b-41d4-a716-446655440005', 'PAY-005', 'ff0e8400-e29b-41d4-a716-446655440005', 'PAY-202411-0005', 450000, 'bank_transfer', '2024-11-10 10:00:00', 'dd0e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '2024-11-10 10:00:00');

-- Continue dans le prochain fichier seed-data-part2.sql...

-- Réactiver les triggers
SET session_replication_role = 'origin';

-- Message de fin
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Données de test insérées avec succès !';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Workspaces: 2';
    RAISE NOTICE 'Utilisateurs: 5';
    RAISE NOTICE 'Produits: 12';
    RAISE NOTICE 'Clients: 6';
    RAISE NOTICE 'Ventes: 5';
    RAISE NOTICE '==============================================';
END $$;
