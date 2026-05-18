const knex = require('../config/db');

const TABLE = 'telegram_contacts';

module.exports = {
  // Create contact
  async create(data) {
    const [id] = await knex(TABLE).insert(data);
    return this.findById(id);
  },

  // Find by ID
  async findById(id) {
    return await knex(TABLE)
      .where({ id })
      .first();
  },

  // Find by chatId
  async findByChatId(chatId) {
    return await knex(TABLE)
      .where({ chatId })
      .first();
  },

  // Update contact
  async updateByChatId(chatId, data) {
    await knex(TABLE)
      .where({ chatId })
      .update(data);

    return this.findByChatId(chatId);
  },

  // Delete
  async deleteByChatId(chatId) {
    return await knex(TABLE)
      .where({ chatId })
      .del();
  },

  // Get all
  async findAll() {
    return await knex(TABLE).select('*');
  }
};