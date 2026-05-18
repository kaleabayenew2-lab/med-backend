const db = require('../config/db');

class FacilityStatus {
  static async createTable() {
    const exists = await db.schema.hasTable('facility_statuses');
    if (!exists) {
      await db.schema.createTable('facility_statuses', (table) => {
        table.increments('id').primary();
        table.integer('userId').notNullable();
        table.integer('facilityId').notNullable();
        table.string('status').notNullable().defaultTo('favorite');
        table.datetime('createdAt').defaultTo(db.fn.now());
        table.datetime('updatedAt').defaultTo(db.fn.now());
        table.unique(['userId', 'facilityId']);
      });
      console.log('✅ Facility status table created');
    }
  }

  static async addFavorite(userId, facilityId) {
    const parsedUserId = Number(userId);
    const parsedFacilityId = Number(facilityId);
    if (!parsedUserId || !parsedFacilityId) {
      throw new Error('Invalid userId or facilityId');
    }

    const existing = await db('facility_statuses')
      .where({ userId: parsedUserId, facilityId: parsedFacilityId, status: 'favorite' })
      .first();

    if (!existing) {
      await db('facility_statuses').insert({
        userId: parsedUserId,
        facilityId: parsedFacilityId,
        status: 'favorite',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return this.findByUserFacility(parsedUserId, parsedFacilityId);
  }

  static async removeFavorite(userId, facilityId) {
    const parsedUserId = Number(userId);
    const parsedFacilityId = Number(facilityId);
    if (!parsedUserId || !parsedFacilityId) {
      throw new Error('Invalid userId or facilityId');
    }

    await db('facility_statuses')
      .where({ userId: parsedUserId, facilityId: parsedFacilityId, status: 'favorite' })
      .del();

    return { userId: parsedUserId, facilityId: parsedFacilityId };
  }

  static async findByUserFacility(userId, facilityId) {
    return await db('facility_statuses')
      .where({ userId: Number(userId), facilityId: Number(facilityId), status: 'favorite' })
      .first();
  }

  static async findByUser(userId) {
    return await db('facility_statuses')
      .where({ userId: Number(userId), status: 'favorite' });
  }
}

module.exports = FacilityStatus;
