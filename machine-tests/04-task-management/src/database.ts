import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    assigned_to INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );
`);

// Seed data
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com');
  db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Bob', 'bob@example.com');
  
  db.prepare('INSERT INTO projects (name, description, created_at) VALUES (?, ?, ?)')
    .run('Website Redesign', 'Redesign company website', new Date().toISOString());
  db.prepare('INSERT INTO projects (name, description, created_at) VALUES (?, ?, ?)')
    .run('Mobile App', 'Build mobile application', new Date().toISOString());
  
  const now = new Date().toISOString();
  db.prepare('INSERT INTO tasks (project_id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(1, 'Design homepage', 'Create new homepage design', 'todo', 'high', now, now);
  db.prepare('INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(1, 'Implement header', 'Build responsive header', 'in_progress', 'medium', 1, now, now);
}

export default db;
