const db = require('../config/db');

// Pharmacy Types model using Knex
class PharmacyType {
  static async createTable() {
    const exists = await db.schema.hasTable('pharmacy_types');
    if (!exists) {
      await db.schema.createTable('pharmacy_types', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable().unique();
        table.json('services').defaultTo(JSON.stringify([]));
        table.text('description');
        table.boolean('isActive').defaultTo(true);
        table.timestamps(true, true);
      });
      console.log('✅ Pharmacy types table created');
    }
  }

  static async seedData() {
    const types = [
      {
        name: 'Hospital Pharmacy',
        description: 'Pharmacies within hospitals providing inpatient services',
        services: [
          'Dispense medicines for admitted patients',
          'Emergency medicine supply',
          'IV fluids and injections',
          'Ward drug distribution',
          'Support doctors and nurses',
          'Prescription processing',
          'Drug information for medical staff'
        ]
      },
      {
        name: 'Community (Retail) Pharmacy',
        description: 'Pharmacies serving the general public in communities',
        services: [
          'Sell prescription medicines',
          'Sell over-the-counter (OTC) drugs',
          'Patient counseling (how to use medicine)',
          'Refill prescriptions',
          'Sell health products (vitamins, baby items)',
          'Basic health advice'
        ]
      },
      {
        name: 'Clinical Pharmacy',
        description: 'Pharmacies focused on clinical patient care',
        services: [
          'Monitor patient drug therapy',
          'Check drug interactions',
          'Help doctors choose correct medicine',
          'Dosage adjustment support',
          'Patient medication review',
          'Prevent medication errors'
        ]
      },
      {
        name: 'Industrial Pharmacy',
        description: 'Pharmacies involved in drug manufacturing',
        services: [
          'Drug manufacturing (tablets, syrups)',
          'Quality control testing',
          'Packaging and labeling',
          'Research and development',
          'Safety testing'
        ]
      },
      {
        name: 'Wholesale / Distribution Pharmacy',
        description: 'Pharmacies handling bulk drug distribution',
        services: [
          'Supply medicines in bulk',
          'Deliver drugs to pharmacies/hospitals',
          'Storage of medicines',
          'Inventory management',
          'Logistics and transportation'
        ]
      },
      {
        name: 'Compounding Pharmacy',
        description: 'Pharmacies creating customized medications',
        services: [
          'Prepare customized medicines',
          'Adjust dosage for patients',
          'Make creams, syrups, capsules',
          'Allergy-free formulations',
          'Pediatric special medicines'
        ]
      },
      {
        name: 'Regulatory / Public Health Pharmacy',
        description: 'Pharmacies involved in regulation and public health',
        services: [
          'Drug regulation and approval',
          'Drug safety monitoring',
          'Vaccination programs',
          'Public health campaigns',
          'Health policy support'
        ]
      }
    ];

    for (const type of types) {
      const existing = await db('pharmacy_types').where('name', type.name).first();
      if (!existing) {
        await db('pharmacy_types').insert(type);
      }
    }
    console.log('✅ Pharmacy types seeded');
  }

  static async findAll() {
    return await db('pharmacy_types').where('isActive', true);
  }

  static async findById(id) {
    return await db('pharmacy_types').where('id', id).first();
  }
}

module.exports = PharmacyType;