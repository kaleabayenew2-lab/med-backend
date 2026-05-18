// SQLite database connection for backend
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, '..', '..', 'database.sqlite');

let db = null;

function connectToDatabase() {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    try {
      // Open database connection
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('SQLite connection error:', err);
          reject(err);
          return;
        }
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            console.error('Error enabling foreign keys:', err);
            reject(err);
            return;
          }
          
          console.log('Connected to SQLite database successfully');
          resolve(db);
        });
      });
    } catch (error) {
      console.error('SQLite connection error:', error);
      reject(error);
    }
  });
}

// Initialize database schema
async function initializeDatabase() {
  try {
    const database = await connectToDatabase();
    
    // Create facilities table
    await new Promise((resolve, reject) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS facilities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('hospital', 'pharmacy')),
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT NOT NULL,
          opening_hours TEXT NOT NULL,
          ownership TEXT NOT NULL CHECK (ownership IN ('Public', 'Private')),
          username TEXT NOT NULL UNIQUE,
          password TEXT,
          emergency INTEGER DEFAULT 0,
          notes TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          hospital_type TEXT,
          pharmacy_type TEXT,
          services TEXT,
          profile TEXT,
          gallary TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Add missing columns for existing databases (migration)
    await new Promise((resolve, reject) => {
      database.exec(`
        ALTER TABLE facilities ADD COLUMN profile TEXT
      `, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column name')) {
          console.warn('Error adding profile column:', err.message);
        }
        resolve();
      });
    });

    await new Promise((resolve, reject) => {
      database.exec(`
        ALTER TABLE facilities ADD COLUMN gallary TEXT
      `, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column name')) {
          console.warn('Error adding gallary column:', err.message);
        }
        resolve();
      });
    });

    // Create indexes for better performance
    await new Promise((resolve, reject) => {
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_facilities_email ON facilities(email);
        CREATE INDEX IF NOT EXISTS idx_facilities_phone ON facilities(phone);
        CREATE INDEX IF NOT EXISTS idx_facilities_username ON facilities(username);
        CREATE INDEX IF NOT EXISTS idx_facilities_name_type ON facilities(name, type);
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Create OTP codes table
    await new Promise((resolve, reject) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identifier TEXT NOT NULL,
          method TEXT NOT NULL,
          code TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          attempts INTEGER DEFAULT 0,
          is_used INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Close database connection
function disconnectFromDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Disconnected from SQLite database');
  }
}

// Check if database is connected
function isDatabaseConnected() {
  return db !== null;
}

module.exports = { 
  connectToDatabase, 
  disconnectFromDatabase, 
  isDatabaseConnected, 
  initializeDatabase 
};
