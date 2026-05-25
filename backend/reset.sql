PRAGMA foreign_keys = OFF;
-- 1. First, drop child tables that depend on others
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS material_transactions;
DROP TABLE IF EXISTS material_stock;
DROP TABLE IF EXISTS purchase_orders;

-- 2. Next, drop intermediate tables
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS materials;

-- 3. Finally, drop independent tables
DROP TABLE IF EXISTS incomes;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS assets;
PRAGMA foreign_keys = ON;