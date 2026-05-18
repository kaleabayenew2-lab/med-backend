const db = require('../config/db');

class Booking {
  static async createTable() {
    const exists = await db.schema.hasTable('bookings');
    if (!exists) {
      await db.schema.createTable('bookings', (table) => {
        table.increments('id').primary();
        table.integer('facilityId').notNullable();
        table.string('facilityName').notNullable();
        table.string('facilityType').notNullable();
        table.string('patientName').notNullable();
        table.integer('patientAge').notNullable();
        table.string('patientPhone').notNullable();
        table.string('userEmail'); // Nullable, if user is logged in
        table.string('purpose').notNullable();
        table.string('appointmentDate').notNullable();
        table.string('appointmentTime').notNullable();
        table.string('status').defaultTo('confirmed'); // 'pending', 'confirmed', 'cancelled'
        table.string('paymentStatus').defaultTo('unpaid'); // 'unpaid', 'paid'
        table.string('paymentMethod'); // null, 'telebirr', 'chapa', 'cbe_birr'
        table.float('amount').defaultTo(250.0);
        table.timestamp('createdAt').defaultTo(db.fn.now());
        table.timestamp('updatedAt').defaultTo(db.fn.now());
      });
      console.log('✅ Bookings table created');
    }
  }

  static async create(data) {
    const [id] = await db('bookings').insert({
      facilityId: data.facilityId,
      facilityName: data.facilityName,
      facilityType: data.facilityType,
      patientName: data.patientName,
      patientAge: data.patientAge,
      patientPhone: data.patientPhone,
      userEmail: data.userEmail || null,
      purpose: data.purpose,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      status: data.status || 'confirmed',
      paymentStatus: data.paymentStatus || 'unpaid',
      paymentMethod: data.paymentMethod || null,
      amount: data.amount || 250.0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return this.findById(id);
  }

  static async findById(id) {
    return await db('bookings').where({ id }).first();
  }

  static async findAll() {
    return await db('bookings').select('*').orderBy('id', 'desc');
  }

  static async findByEmail(userEmail) {
    return await db('bookings').where({ userEmail }).orderBy('id', 'desc');
  }

  static async findByFacilityId(facilityId) {
    return await db('bookings').where({ facilityId }).orderBy('id', 'desc');
  }

  static async updatePaymentStatus(id, paymentStatus) {
    await db('bookings').where({ id }).update({
      paymentStatus,
      updatedAt: new Date()
    });
    return this.findById(id);
  }
}

module.exports = Booking;
