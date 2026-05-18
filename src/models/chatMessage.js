const db = require('../config/db');

// ChatMessage model using Knex
class ChatMessage {
  static async createTable() {
    const exists = await db.schema.hasTable('chatMessages');
    if (!exists) {
      await db.schema.createTable('chatMessages', (table) => {
        table.increments('id').primary();
        table.string('conversationId');
        table.string('from').notNullable();
        table.string('to');
        table.string('text');
        table.json('attachments').defaultTo(JSON.stringify([]));
        table.json('meta').defaultTo(JSON.stringify({}));
        table.boolean('read').defaultTo(false);
        table.datetime('createdAt').defaultTo(db.fn.now());
        table.timestamps(true, true);
        table.index('conversationId');
      });
      console.log('✅ ChatMessages table created');
    }
  }

  static async create(data) {
    const [id] = await db('chatMessages').insert(data);
    return this.findById(id);
  }

  static async findById(id) {
    return await db('chatMessages').where({ id }).first();
  }

  static async findAll() {
    return await db('chatMessages').select('*');
  }

  static async update(id, data) {
    await db('chatMessages').where({ id }).update(data);
    return this.findById(id);
  }

  static async delete(id) {
    return await db('chatMessages').where({ id }).del();
  }

  static async findByConversation(conversationId) {
    return await db('chatMessages').where({ conversationId }).orderBy('createdAt', 'asc');
  }

  static async findByUser(userId, limit = 200) {
    return await db('chatMessages')
      .where(function() {
        this.where('from', userId).orWhere('to', userId);
      })
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }
}

module.exports = ChatMessage;
