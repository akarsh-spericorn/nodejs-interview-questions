import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    capacity INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price REAL NOT NULL,
    reorder_level INTEGER NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE(warehouse_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    from_warehouse INTEGER,
    to_warehouse INTEGER,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    reference TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (from_warehouse) REFERENCES warehouses(id),
    FOREIGN KEY (to_warehouse) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Seed data
const warehouseCount = db.prepare('SELECT COUNT(*) as count FROM warehouses').get() as { count: number };
if (warehouseCount.count === 0) {
  db.prepare('INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?)').run('Main Warehouse', 'New York', 10000);
  db.prepare('INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?)').run('West Coast Hub', 'Los Angeles', 8000);
  db.prepare('INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?)').run('Distribution Center', 'Chicago', 5000);
  
  db.prepare('INSERT INTO products (sku, name, category, unit_price, reorder_level) VALUES (?, ?, ?, ?, ?)').run('LAPTOP-001', 'Laptop Pro', 'Electronics', 999.99, 20);
  db.prepare('INSERT INTO products (sku, name, category, unit_price, reorder_level) VALUES (?, ?, ?, ?, ?)').run('MOUSE-001', 'Wireless Mouse', 'Electronics', 29.99, 50);
  db.prepare('INSERT INTO products (sku, name, category, unit_price, reorder_level) VALUES (?, ?, ?, ?, ?)').run('DESK-001', 'Standing Desk', 'Furniture', 499.99, 10);
  
  const now = new Date().toISOString();
  db.prepare('INSERT INTO stock (warehouse_id, product_id, quantity, last_updated) VALUES (?, ?, ?, ?)').run(1, 1, 100, now);
  db.prepare('INSERT INTO stock (warehouse_id, product_id, quantity, last_updated) VALUES (?, ?, ?, ?)').run(1, 2, 500, now);
  db.prepare('INSERT INTO stock (warehouse_id, product_id, quantity, last_updated) VALUES (?, ?, ?, ?)').run(2, 1, 50, now);
  db.prepare('INSERT INTO stock (warehouse_id, product_id, quantity, last_updated) VALUES (?, ?, ?, ?)').run(2, 3, 30, now);
}

export default db;
