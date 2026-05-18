require('dotenv').config();
const mongoose = require('mongoose');
const Facility = require('../models/facility');
const db = require('../config/db');

async function seed() {
  try {
    await db.connectAll();

    // Example seed data
    const data = [
      {
        name: 'City General Hospital',
        type: 'hospital',
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        address: '123 Main St',
        phone: '555-0100',
        services: ['Emergency', 'Pharmacy', 'Outpatient'],
        openingHours: '24/7',
        isEmergency: true,
      },
      {
        name: 'Green Pharmacy',
        type: 'pharmacy',
        location: { type: 'Point', coordinates: [-122.414, 37.779] },
        address: '45 Market St',
        phone: '555-0111',
        services: ['Medicines', 'Consultation'],
        openingHours: '08:00-20:00',
        isEmergency: false,
      },
    ];

    // Clear existing minimal sample data (only those with same names)
    for (const item of data) {
      await Facility.deleteMany({ name: item.name });
    }

    const created = await Facility.insertMany(data);
    console.log(`Inserted ${created.length} facilities.`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding error', err);
    process.exit(1);
  }
}

seed();
