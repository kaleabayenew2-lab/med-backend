const db = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');

const TABLE = 'users';

// 🔒 Apply encryption before insert/update (replacement for beforeSave hook)
function prepareUserData(data) {
  const newData = { ...data };
  const crypto = require('crypto');

  if (newData.email) {
    newData.email = encrypt(newData.email.toLowerCase());
  }

  if (newData.phone) {
    newData.phone = encrypt(newData.phone);
  }

  // FIX: Handle password hashing
  if (newData.password) {
    newData.passwordHash = crypto.createHash('sha256').update(newData.password).digest('hex');
    delete newData.password; // Remove plain password
  }

  // FIX: Generate required systemId and userId if not provided
  if (!newData.systemId) {
    newData.systemId = 'sys_' + crypto.randomBytes(16).toString('hex');
  }
  
  if (!newData.userId) {
    newData.userId = 'user_' + crypto.randomBytes(16).toString('hex');
  }

  return newData;
}

// 🔓 Decrypt after fetching (replacement for afterFind hook)
function decryptUser(user) {
  if (!user) return user;

  try {
    if (user.email) user.email = decrypt(user.email);
    if (user.phone) user.phone = decrypt(user.phone);
  } catch (_) {}

  return user;
}

function decryptUsers(users) {
  if (!Array.isArray(users)) return decryptUser(users);
  return users.map(decryptUser);
}

// Create table method
async function createTable() {
  const exists = await db.schema.hasTable('users');
  if (!exists) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('fullName').notNullable();
      table.string('email').notNullable().unique();
      table.string('passwordHash').notNullable();
      table.string('phone');
      table.string('telegramChatId');
      table.string('telegramUsername');
      table.string('telegramPhone');
      table.json('deviceTokens').defaultTo(JSON.stringify([]));
      table.string('resetOtp');
      table.datetime('resetOtpExpires');
      table.string('loginOtp');
      table.datetime('loginOtpExpires');
      table.integer('age');
      table.json('savedFacilities').defaultTo(JSON.stringify([]));
      table.json('medicalConditions').defaultTo(JSON.stringify([]));
      table.json('allergies').defaultTo(JSON.stringify([]));
      table.json('medications').defaultTo(JSON.stringify([]));
      table.string('systemId').notNullable().unique();
      table.string('userId').notNullable().unique();
      table.string('provider');
      table.datetime('createdAt').defaultTo(db.fn.now());
      table.boolean('adminResetRequested').defaultTo(false);
      table.string('adminResetPassword');
      table.datetime('adminResetPasswordExpires');
      table.timestamps(true, true);
    });
    console.log('✅ Users table created');
  }
}

module.exports = {
  // Create table
  createTable,

  // Create user
  async create(data) {
    const prepared = prepareUserData(data);
    // Add updatedAt for Knex timestamps
    prepared.updatedAt = new Date();

    const [id] = await db(TABLE).insert(prepared);
    return this.findById(id);
  },

  // Find all users
  async findAll() {
    const users = await db(TABLE).select('*');
    return decryptUsers(users);
  },

  // Find by ID
  async findById(id) {
    const user = await db(TABLE)
      .where({ id })
      .first();

    return decryptUser(user);
  },

  // Find user by any field
  async findOne(where) {
    const query = where ? (where.where || where) : {};
    
    // If querying by email or phone, we must decrypt in memory due to non-deterministic encryption
    if (query.email || query.phone) {
      const allUsers = await this.findAll();
      return allUsers.find(user => {
        for (const [key, value] of Object.entries(query)) {
          if (key === 'email') {
            if (!user.email || user.email.toLowerCase() !== String(value).toLowerCase()) {
              return false;
            }
          } else if (key === 'phone') {
            const qPhone = String(value).replace(/[^0-9]/g, '');
            const uPhone = String(user.phone || '').replace(/[^0-9]/g, '');
            if (qPhone && uPhone) {
              if (!uPhone.endsWith(qPhone) && !qPhone.endsWith(uPhone)) {
                return false;
              }
            } else if (user.phone !== value) {
              return false;
            }
          } else {
            if (user[key] !== value) {
              return false;
            }
          }
        }
        return true;
      }) || null;
    }
    
    const user = await db(TABLE)
      .where(query)
      .first();

    return decryptUser(user);
  },

  // Find by email (FIX: Check all users and decrypt emails to find match)
  async findByEmail(email) {
    const allUsers = await db(TABLE).select('*');
    
    for (const user of allUsers) {
      if (user.email) {
        try {
          const decryptedEmail = decrypt(user.email);
          if (decryptedEmail === email.toLowerCase()) {
            return decryptUser(user);
          }
        } catch (error) {
          // Skip if decryption fails
          continue;
        }
      }
    }
    
    return null;
  },

  // Update user
  async update(id, data) {
    const prepared = prepareUserData(data);

    await db(TABLE)
      .where({ id })
      .update(prepared);

    return this.findById(id);
  },

  // Delete user
  async delete(id) {
    return await db(TABLE)
      .where({ id })
      .del();
  }
};