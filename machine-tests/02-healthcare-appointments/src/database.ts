import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    available_days TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    doctor_id INTEGER NOT NULL,
    patient_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  );
`);

// Seed data
const doctorCount = db.prepare('SELECT COUNT(*) as count FROM doctors').get() as { count: number };
if (doctorCount.count === 0) {
  const insertDoctor = db.prepare('INSERT INTO doctors (name, specialty, available_days) VALUES (?, ?, ?)');
  insertDoctor.run('Dr. Smith', 'General', '["monday","tuesday","wednesday","thursday","friday"]');
  insertDoctor.run('Dr. Johnson', 'Cardiology', '["monday","wednesday","friday"]');
  insertDoctor.run('Dr. Williams', 'Pediatrics', '["tuesday","thursday"]');
  
  const insertPatient = db.prepare('INSERT INTO patients (name, email, phone) VALUES (?, ?, ?)');
  insertPatient.run('John Doe', 'john@email.com', '555-0101');
  insertPatient.run('Jane Smith', 'jane@email.com', '555-0102');
  insertPatient.run('Bob Wilson', 'bob@email.com', '555-0103');
}

export default db;
