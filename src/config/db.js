const path = require('path');
const knex = require('knex');

const DB_PATH = path.join(__dirname, '..', '..', 'database.sqlite');

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: DB_PATH
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn, done) => {
      conn.run('PRAGMA foreign_keys = ON', (err) => {
        done(err, conn);
      });
    }
  }
});

async function testConnection() {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database testConnection error:', error);
    throw error;
  }
}

async function syncDatabase() {
  return Promise.resolve();
}

db.testConnection = testConnection;
db.syncDatabase = syncDatabase;

module.exports = db;
