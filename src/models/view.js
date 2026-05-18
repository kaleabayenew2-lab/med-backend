const db = require('../config/db');

class View {
  static async createTable() {
    const exists = await db.schema.hasTable('facility_views');
    if (!exists) {
      await db.schema.createTable('facility_views', (table) => {
        table.increments('id').primary();
        table.integer('facilityId').notNullable();
        table.string('viewerIdentifier').notNullable();
        table.string('viewerType').notNullable(); // 'email' or 'device' or 'ip'
        table.timestamp('createdAt').defaultTo(db.fn.now());
      });
      console.log('✅ Facility views table created');
    }
  }

  static async record(facilityId, viewerIdentifier, viewerType) {
    // Save to database
    await db('facility_views').insert({
      facilityId,
      viewerIdentifier,
      viewerType: viewerType || 'ip',
      createdAt: new Date()
    });

    // Update facilities table with the unique views count
    const uniqueCountResult = await db('facility_views')
      .where({ facilityId })
      .countDistinct('viewerIdentifier as count')
      .first();

    const uniqueCount = parseInt(uniqueCountResult?.count || 0, 10);

    // Update in facilities
    await db('facilities')
      .where({ id: facilityId })
      .update({
        viewsTotal: uniqueCount,
        lastViewedAt: new Date()
      });

    return uniqueCount;
  }

  static async getUniqueViewsCount(facilityId) {
    const result = await db('facility_views')
      .where({ facilityId })
      .countDistinct('viewerIdentifier as count')
      .first();
    return parseInt(result?.count || 0, 10);
  }
}

module.exports = View;
