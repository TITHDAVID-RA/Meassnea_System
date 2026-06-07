PRAGMA foreign_keys = OFF;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  size TEXT,                    
  quantity INTEGER NOT NULL DEFAULT 0,
  initial_quantity INTEGER DEFAULT 0,
  unit_price REAL DEFAULT 0,    
  cost_price REAL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);

-- Materials (with size + stock columns)
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_khmer TEXT NOT NULL,
  type TEXT NOT NULL,         
  unit TEXT DEFAULT 'unit',
  size TEXT DEFAULT 'N/A',
  quantity REAL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  is_labor INTEGER DEFAULT 0,   
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ថង់ S/M only
INSERT OR IGNORE INTO materials (id, name, name_khmer, type, unit, size, quantity, unit_price, is_labor) VALUES
  ('mat_1_s', 'plastic_bag', 'ថង់', 'sized', 'unit', 'S', 0, 0, 0),
  ('mat_1_m', 'plastic_bag', 'ថង់', 'sized', 'unit', 'M', 0, 0, 0),
  ('mat_2', 'case_box', 'កេស', 'nosize', 'unit', 'N/A', 0, 0, 0),
  ('mat_3_s', 'package_bag', 'ថង់វេចខ្ចប់', 'sized', 'unit', 'S', 0, 0, 0),
  ('mat_3_m', 'package_bag', 'ថង់វេចខ្ចប់', 'sized', 'unit', 'M', 0, 0, 0),
  ('mat_4_s', 'box', 'ប្រអប់', 'sized', 'unit', 'S', 0, 0, 0),
  ('mat_4_m', 'box', 'ប្រអប់', 'sized', 'unit', 'M', 0, 0, 0),
  ('mat_5_s', 'leafleap', 'Leafleap', 'sized', 'unit', 'S', 0, 0, 0),
  ('mat_5_m', 'leafleap', 'Leafleap', 'sized', 'unit', 'M', 0, 0, 0),
  ('mat_sticker_m', 'sticker', 'ស្ទីកគ័រ', 'sized', 'unit', 'M', 0, 0, 0),
  ('mat_sticker_l', 'sticker', 'ស្ទីកគ័រ', 'sized', 'unit', 'L', 0, 0, 0),
  ('mat_6', 'tea_powder', 'ទាបបារាំង', 'kg', 'kg', 'N/A', 0, 0, 0),
  ('mat_7', 'labor', 'ពលកម្ម', 'labor', 'unit', 'N/A', 0, 0, 1),
  ('mat_8', 'tea', 'តែ', 'derived', 'g', 'N/A', NULL, 0, 0);

-- Material Transactions
CREATE TABLE IF NOT EXISTS material_transactions (
  id TEXT PRIMARY KEY,
  material_id TEXT,
  material_name TEXT NOT NULL,
  size TEXT DEFAULT 'N/A',    
  quantity REAL NOT NULL DEFAULT 0,
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'deduction', 'return')),
  transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE INDEX IF NOT EXISTS idx_mt_material ON material_transactions(material_name, size);
CREATE INDEX IF NOT EXISTS idx_mt_type ON material_transactions(type);
CREATE INDEX IF NOT EXISTS idx_mt_date ON material_transactions(transaction_date);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer TEXT,
  total REAL NOT NULL DEFAULT 0,
  delivery_cost REAL DEFAULT 0,
  plastic_bags TEXT DEFAULT '[]',
  plastic_bag_cost REAL DEFAULT 0,
  case_box_qty INTEGER DEFAULT 0,
  free_items TEXT DEFAULT '[]',
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  order_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  cost_price REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_product ON order_items(product_id);

-- Incomes
CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'លក់ផលិតផល',
  payment_method TEXT DEFAULT 'cash',
  description TEXT,
  customer TEXT,
  reference TEXT,
  income_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(income_date);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(category);
CREATE INDEX IF NOT EXISTS idx_incomes_order ON incomes(order_id);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  description TEXT,
  payment_method TEXT DEFAULT 'cash',
  vendor TEXT,
  reference TEXT,
  expense_date DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'return', 'adjustment')),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER,
  new_quantity INTEGER,
  unit_price REAL DEFAULT 0,
  total_value REAL DEFAULT 0,
  reference TEXT,
  reference_id TEXT,
  notes TEXT,
  movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_im_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_im_date ON inventory_movements(movement_date);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  location TEXT,
  assigned_to TEXT,
  vendor TEXT,
  value REAL DEFAULT 0,
  description TEXT,
  purchase_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'asset', 'product')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO categories (id, name, type) VALUES
  ('inc_1', 'លក់ផលិតផល', 'income'),
  ('inc_2', 'សេវាកម្ម', 'income'),
  ('inc_3', 'ចំណូលផ្សេង', 'income'),
  ('exp_1', 'សភិរះប្រើប្រាស់', 'expense'),
  ('exp_2', 'បុគ្គលិកនិងប្រាក់ខែ', 'expense'),
  ('exp_3', 'ចំណាយផ្នែកទីផ្សារ boost', 'expense'),
  ('exp_4', 'ប្រម៉ូតទីផ្សារ video', 'expense'),
  ('exp_5', 'ចំណាយថ្លៃចុះទីផ្សារ', 'expense'),
  ('exp_6', 'តែប្រម៉ូត', 'expense'),
  ('exp_7', 'ការធ្វើដំណើរ', 'expense'),
  ('exp_8', 'ស្តុកទំនិញ', 'expense'),
  ('exp_9', 'វត្ថុធាតុដើម', 'expense'),
  ('ast_1', 'Electronics', 'asset'),
  ('ast_2', 'Furniture', 'asset'),
  ('ast_3', 'Vehicles', 'asset'),
  ('ast_4', 'Machinery', 'asset'),
  ('ast_5', 'Tools', 'asset'),
  ('ast_6', 'Other', 'asset');

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  vendor TEXT,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
  items TEXT,                
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  received_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
-- App Settings / Configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default tea price per gram (stored as rate per gram)
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tea_price_per_gram', '0');