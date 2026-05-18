const db = require('../config/db');

// Hospital Types model using Knex
class HospitalType {
  static async createTable() {
    const exists = await db.schema.hasTable('hospital_types');
    if (!exists) {
      await db.schema.createTable('hospital_types', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable().unique();
        table.json('services').defaultTo(JSON.stringify([]));
        table.text('description');
        table.boolean('isActive').defaultTo(true);
        table.timestamps(true, true);
      });
      console.log('✅ Hospital types table created');
    }
  }

  static async seedData() {
    const types = [
      {
        name: 'General Hospitals',
        description: 'Provide many different services (full service hospital)',
        services: [
          'Emergency care',
          'Outpatient (OPD) services',
          'Inpatient admission (beds)',
          'Basic surgeries',
          'Laboratory tests',
          'Pharmacy',
          'X-ray / imaging',
          'Maternity care'
        ]
      },
      {
        name: 'Specialized Hospitals',
        description: 'Focus on one specific disease or body part',
        services: [
          'Specialist doctors (experts)',
          'Advanced diagnosis (special tests)',
          'Specialized treatments',
          'Follow-up care',
          'Rehabilitation (recovery support)'
        ]
      },
      {
        name: 'Internal / Medical Hospitals',
        description: 'Treat diseases WITHOUT surgery',
        services: [
          'Diagnosis of illness',
          'Medication treatment',
          'Chronic disease care (diabetes, hypertension)',
          'Infection treatment',
          'Health checkups'
        ]
      },
      {
        name: 'Surgical Hospitals',
        description: 'Focus mainly on operations (surgery)',
        services: [
          'Minor and major surgeries',
          'Pre-surgery evaluation',
          'Operation rooms (OR)',
          'Post-surgery care',
          'Intensive Care Unit (ICU)'
        ]
      },
      {
        name: 'Maternal & Child Hospitals',
        description: 'Care for mothers and children',
        services: [
          'Pregnancy care (antenatal)',
          'Delivery (normal & C-section)',
          'Postnatal care',
          'Newborn care',
          'Vaccination',
          'Pediatric (child) treatment',
          'Family planning'
        ]
      },
      {
        name: 'Teaching & Referral Hospitals',
        description: 'Large hospitals for education and serious cases',
        services: [
          'Advanced treatment',
          'Specialist consultation',
          'Medical student training',
          'Research services',
          'Referral handling (from smaller clinics)',
          'Complex surgeries'
        ]
      },
      {
        name: 'Clinics & Primary Care Facilities',
        description: 'Small and first-contact health centers',
        services: [
          'Basic diagnosis and treatment',
          'Minor injuries care',
          'Vaccination',
          'Health advice',
          'Simple lab tests',
          'Referral to hospitals if needed'
        ]
      }
    ];

    for (const type of types) {
      const existing = await db('hospital_types').where('name', type.name).first();
      if (!existing) {
        await db('hospital_types').insert(type);
      }
    }
    console.log('✅ Hospital types seeded');
  }

  static async findAll() {
    return await db('hospital_types').where('isActive', true);
  }

  static async findById(id) {
    return await db('hospital_types').where('id', id).first();
  }
}

module.exports = HospitalType;