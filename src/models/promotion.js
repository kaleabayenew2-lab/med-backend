const db = require('../config/db');

class Promotion {
  static async createTable() {
    const exists = await db.schema.hasTable('promotions');
    if (!exists) {
      await db.schema.createTable('promotions', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.string('subtitle').defaultTo('');
        table.string('imageUrl').defaultTo('assets/images/logo.png');
        table.string('buttonText').defaultTo('Learn More');
        table.string('linkUrl').defaultTo('');
        table.boolean('active').defaultTo(true);
        table.timestamp('createdAt').defaultTo(db.fn.now());
        table.timestamp('updatedAt').defaultTo(db.fn.now());
      });
      console.log('✅ Promotions table created');
    }
  }

  static async create(data) {
    const [id] = await db('promotions').insert({
      title: data.title,
      subtitle: data.subtitle !== undefined ? data.subtitle : '',
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : 'assets/images/logo.png',
      buttonText: data.buttonText !== undefined ? data.buttonText : 'Learn More',
      linkUrl: data.linkUrl !== undefined ? data.linkUrl : '',
      active: data.active !== undefined ? (data.active ? 1 : 0) : 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return this.findById(id);
  }

  static async findById(id) {
    const row = await db('promotions').where({ id }).first();
    if (row) {
      row.active = !!row.active;
    }
    return row;
  }

  static async findAll(filters = {}) {
    const query = db('promotions').select('*');
    if (filters.active !== undefined) {
      query.where({ active: filters.active ? 1 : 0 });
    }
    const rows = await query.orderBy('id', 'desc');
    return rows.map(r => ({ ...r, active: !!r.active }));
  }

  static async update(id, data) {
    const updateData = {
      updatedAt: new Date()
    };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.buttonText !== undefined) updateData.buttonText = data.buttonText;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.active !== undefined) updateData.active = data.active ? 1 : 0;

    await db('promotions').where({ id }).update(updateData);
    return this.findById(id);
  }

  static async delete(id) {
    return await db('promotions').where({ id }).del();
  }
}

module.exports = Promotion;
