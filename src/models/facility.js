const db = require('../config/db');

// Facility model using Knex
class Facility {
  static async createTable() {
    const exists = await db.schema.hasTable('facilities');
    if (!exists) {
      await db.schema.createTable('facilities', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.enum('type', ['hospital', 'pharmacy']).notNullable();
        table.json('location').defaultTo(JSON.stringify({ type: 'Point', coordinates: [] }));
        table.string('address');
        table.string('email');
        table.json('altPhone').defaultTo(JSON.stringify([]));
        table.string('phone');
        table.string('username').unique();
        table.string('passwordHash');
        table.json('services').defaultTo(JSON.stringify([]));
        table.string('agentId').unique();
        table.string('openingHours');
        table.string('hospitalType');
        table.string('pharmacyType');
        table.enum('ownership', ['private', 'public']).defaultTo('private');
        table.string('notes');
        table.string('profile');
        table.json('gallary').defaultTo(JSON.stringify([]));
        table.boolean('isEmergency').defaultTo(false);
        table.boolean('isActive').defaultTo(true);
        table.integer('viewsTotal').defaultTo(0);
        table.datetime('lastViewedAt');
        table.integer('ratingCount').defaultTo(0);
        table.integer('ratingSum').defaultTo(0);
        table.float('averageRating').defaultTo(0);
        table.datetime('updatedAt').defaultTo(db.fn.now());
        table.timestamps(true, true);
        table.unique(['name', 'type']);
      });
      console.log('✅ Facilities table created');
      return;
    }

    // Existing table: ensure the schema supports unique name per type instead of unique name globally.
    const indexes = await db.raw("PRAGMA index_list('facilities')");
    const indexRows = Array.isArray(indexes) ? indexes[0] || [] : indexes;
    let hasCompositeNameTypeIndex = false;

    for (const index of indexRows) {
      if (index.unique !== 1) continue;
      const indexInfoResult = await db.raw(`PRAGMA index_info('${index.name}')`);
      const indexInfo = Array.isArray(indexInfoResult) ? indexInfoResult[0] || [] : indexInfoResult;
      const columns = indexInfo.map(info => info.name);
      if (columns.length === 1 && columns[0] === 'name') {
        await db.raw(`DROP INDEX IF EXISTS "${index.name}"`);
      }
      if (columns.length === 2 && columns[0] === 'name' && columns[1] === 'type') {
        hasCompositeNameTypeIndex = true;
      }
    }

    if (!hasCompositeNameTypeIndex) {
      await db.raw('CREATE UNIQUE INDEX IF NOT EXISTS facilities_name_type_unique ON facilities(name, type)');
    }
  }

  static async create(data) {
    const { encrypt: _encrypt } = require('../utils/encryption');
    
    // Define valid columns based on schema
    const validColumns = [
      'name', 'type', 'location', 'address', 'email', 'altPhone', 'phone', 
      'username', 'passwordHash', 'services', 'agentId', 'openingHours', 
      'hospitalType', 'pharmacyType', 'ownership', 'notes', 'profile', 
      'gallary', 'isEmergency', 'isActive', 'viewsTotal', 'lastViewedAt', 
      'ratingCount', 'ratingSum', 'averageRating', 'createdAt', 'updatedAt'
    ];

    // Filter data to only include valid columns
    const filteredData = {};
    for (const key of Object.keys(data)) {
      if (validColumns.includes(key) && data[key] !== undefined) {
        filteredData[key] = data[key];
      }
    }

    // Encrypt sensitive fields before saving
    if (filteredData.phone) {
      filteredData.phone = _encrypt(filteredData.phone);
    }
    if (filteredData.email) {
      filteredData.email = _encrypt(filteredData.email);
    }
    
    const [id] = await db('facilities').insert({
      ...filteredData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return this.findById(id);
  }

  static async findById(id) {
    const facility = await db('facilities').where({ id }).first();
    if (facility) {
      this.decryptFields(facility);
    }
    return facility;
  }

  static async findAll() {
    const facilities = await db('facilities').select('*');
    facilities.forEach(facility => this.decryptFields(facility));
    return facilities;
  }

  static async update(id, data) {
    const { encrypt: _encrypt } = require('../utils/encryption');
    
    // Define valid columns based on schema
    const validColumns = [
      'name', 'type', 'location', 'address', 'email', 'altPhone', 'phone', 
      'username', 'passwordHash', 'services', 'agentId', 'openingHours', 
      'hospitalType', 'pharmacyType', 'ownership', 'notes', 'profile', 
      'gallary', 'isEmergency', 'isActive', 'viewsTotal', 'lastViewedAt', 
      'ratingCount', 'ratingSum', 'averageRating', 'createdAt', 'updatedAt'
    ];

    // Filter data to only include valid columns
    const filteredData = {};
    for (const key of Object.keys(data)) {
      if (validColumns.includes(key) && data[key] !== undefined) {
        filteredData[key] = data[key];
      }
    }

    // Encrypt sensitive fields before saving
    if (filteredData.phone) {
      filteredData.phone = _encrypt(filteredData.phone);
    }
    if (filteredData.email) {
      filteredData.email = _encrypt(filteredData.email);
    }
    
    await db('facilities').where({ id }).update({
      ...filteredData,
      updatedAt: new Date()
    });
    return this.findById(id);
  }

  static async delete(id) {
    return await db('facilities').where({ id }).del();
  }

  static async findByName(name, type) {
    const query = db('facilities').whereRaw('lower(name) = ?', [String(name).toLowerCase()]);
    if (type) {
      query.andWhere({ type });
    }
    const facility = await query.first();
    if (facility) {
      this.decryptFields(facility);
    }
    return facility;
  }

  static async findByType(type) {
    const facilities = await db('facilities').where({ type });
    facilities.forEach(facility => this.decryptFields(facility));
    return facilities;
  }

  static async incrementViews(id) {
    await db('facilities').where({ id }).increment('viewsTotal', 1);
    await db('facilities').where({ id }).update({
      lastViewedAt: new Date()
    });
  }

  static async updateRating(id, newRating) {
    const facility = await db('facilities').where({ id }).first();
    if (facility) {
      const newRatingCount = facility.ratingCount + 1;
      const newRatingSum = facility.ratingSum + newRating;
      const newAverageRating = newRatingSum / newRatingCount;
      
      await db('facilities').where({ id }).update({
        ratingCount: newRatingCount,
        ratingSum: newRatingSum,
        averageRating: newAverageRating
      });
    }
  }

  static decryptFields(facility) {
    try {
      const { encrypt: _encrypt, decrypt: _decrypt } = require('../utils/encryption');
      if (facility.phone) facility.phone = _decrypt(facility.phone);
      if (facility.email) facility.email = _decrypt(facility.email);
    } catch (_) {}
    return facility;
  }
}

module.exports = Facility;
