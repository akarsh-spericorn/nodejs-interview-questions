import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT UNIQUE NOT NULL,
    holder_name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    pin TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    from_account INTEGER,
    to_account INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    FOREIGN KEY (from_account) REFERENCES accounts(id),
    FOREIGN KEY (to_account) REFERENCES accounts(id)
  );
`);

// Seed accounts
const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
if (accountCount.count === 0) {
  const insertAccount = db.prepare(
    'INSERT INTO accounts (account_number, holder_name, balance, status, pin, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  // BUG: PIN stored in plain text (should be hashed)
  insertAccount.run('ACC001', 'Alice Johnson', 5000.00, 'active', '1234', new Date().toISOString());
  insertAccount.run('ACC002', 'Bob Smith', 3000.00, 'active', '5678', new Date().toISOString());
  insertAccount.run('ACC003', 'Charlie Brown', 1000.00, 'frozen', '9999', new Date().toISOString());
}

export default db;
