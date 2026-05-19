const express = require('express');
const router = express.Router();
const controller = require('../controllers/facilitiesController');
const uploadController = require('../controllers/uploadController');
const db = require('../config/db');
const { decrypt } = require('../utils/encryption');

// GET /api/facilities - Get all facilities
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Fetching facilities from database...');
    
    // db is a function (Knex style or similar)
    let facilities = [];
    
    // Try Knex style (db is a function)
    if (typeof db === 'function') {
      console.log('📡 Using Knex-style query');
      try {
        facilities = await db('facilities')
          .select('*')
          .orderBy('createdAt', 'desc')
          .limit(50);
      } catch (knexError) {
        console.log('Knex style failed, trying query method');
        // Try query method
        if (typeof db.query === 'function') {
          facilities = await db.query('SELECT * FROM facilities ORDER BY createdAt DESC LIMIT 50');
        } else if (typeof db.all === 'function') {
          facilities = await db.all('SELECT * FROM facilities ORDER BY createdAt DESC LIMIT 50');
        } else {
          throw knexError;
        }
      }
    } 
    // Try query method
    else if (typeof db.query === 'function') {
      console.log('📡 Using query method');
      facilities = await db.query('SELECT * FROM facilities ORDER BY createdAt DESC LIMIT 50');
    }
    // Try all method (SQLite)
    else if (typeof db.all === 'function') {
      console.log('📡 Using all method');
      facilities = await db.all('SELECT * FROM facilities ORDER BY createdAt DESC LIMIT 50');
    }
    else {
      throw new Error('No supported database method found. db type: ' + typeof db);
    }
    
    console.log(`✅ Found ${facilities.length} facilities`);
    
    // Helper to build absolute image URL from the actual request host if no BASE_URL is set
    const buildImageUrl = (p, req) => {
      if (!p) return null;
      if (/^https?:\/\//i.test(p)) return p;
      const hostUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      return `${hostUrl}/${p.replace(/^\//, '')}`;
    };
    
    // Handle empty result
    if (!facilities || facilities.length === 0) {
      return res.json({
        success: true,
        message: 'No facilities found',
        facilities: [],
        total: 0
      });
    }
    
    // Transform data for Flutter
    const transformedFacilities = facilities.map(facility => ({
      id: facility.id,
      name: facility.name || 'Unnamed Facility',
      type: facility.type || 'unknown',
      location: facility.location || '',
      address: facility.address || '',
      email: decrypt(facility.email) || '',
      phone: decrypt(facility.phone) || '',
      services: facility.services,
      openingHours: facility.openingHours || '',
      hospitalType: facility.hospitalType || '',
      pharmacyType: facility.pharmacyType || '',
      ownership: facility.ownership || '',
      agentId: facility.agentId || null,
      profileImage: buildImageUrl(facility.profile, req),
      galleryImages: (() => {
        try {
          if (!facility.gallary) return [];
          const arr = typeof facility.gallary === 'string' ? JSON.parse(facility.gallary) : facility.gallary;
          return arr.map((item) => buildImageUrl(item, req)).filter(Boolean);
        } catch (e) {
          return [];
        }
      })(),
      isEmergency: facility.isEmergency === 1 || facility.isEmergency === true,
      isActive: facility.isActive === 1 || facility.isActive === true,
      viewsTotal: facility.viewsTotal || 0,
      lastViewedAt: facility.lastViewedAt,
      ratingCount: facility.ratingCount || 0,
      ratingSum: facility.ratingSum || 0,
      averageRating: facility.averageRating || 0,
      updatedAt: facility.updatedAt,
      createdAt: facility.createdAt,
      favoriteCount: 0 // Will be populated below
    }));

    // Get favorite counts for all facilities
    try {
      const favoriteCounts = await db('facility_statuses')
        .where({ status: 'favorite' })
        .select('facilityId')
        .count('* as count')
        .groupBy('facilityId');

      const favCountMap = {};
      if (Array.isArray(favoriteCounts)) {
        favoriteCounts.forEach(item => {
          favCountMap[item.facilityId] = parseInt(item.count) || 0;
        });
      }

      transformedFacilities.forEach(facility => {
        facility.favoriteCount = favCountMap[facility.id] || 0;
      });
    } catch (favError) {
      console.warn('Warning: Could not fetch favorite counts:', favError.message);
      // Continue without favorite counts if query fails
    }
    
    res.json({
      success: true,
      message: 'Facilities retrieved successfully',
      facilities: transformedFacilities,
      total: facilities.length
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching facilities',
      error: error.message
    });
  }
});

// Test endpoint to try different query methods
router.get('/test', async (req, res) => {
  const results = {};
  
  try {
    // Test if db is a function (Knex)
    if (typeof db === 'function') {
      try {
        const test = await db('facilities').limit(1);
        results.knex = { success: true, count: test.length };
      } catch (e) {
        results.knex = { success: false, error: e.message };
      }
    }
    
    // Test query method
    if (typeof db.query === 'function') {
      try {
        const test = await db.query('SELECT COUNT(*) as count FROM facilities');
        results.query = { success: true, count: test[0]?.count || test?.count };
      } catch (e) {
        results.query = { success: false, error: e.message };
      }
    }
    
    // Test all method
    if (typeof db.all === 'function') {
      try {
        const test = await db.all('SELECT COUNT(*) as count FROM facilities');
        results.all = { success: true, count: test[0]?.count };
      } catch (e) {
        results.all = { success: false, error: e.message };
      }
    }
    
    res.json({
      dbType: typeof db,
      isFunction: typeof db === 'function',
      availableMethods: Object.keys(db).filter(k => typeof db[k] === 'function'),
      testResults: results
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Other routes
router.get('/catalog', controller.catalog);
router.get('/check-name', controller.checkName);
router.get('/check-email', controller.checkEmail);
router.get('/check-phone', controller.checkPhone);
router.post('/:id/reset-password', controller.resetPassword);
router.post('/:id/verify-password', controller.verifyPassword);
router.post('/send-password-email', controller.sendPasswordEmail);
router.post('/', controller.create);
router.post('/login', controller.login);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.post('/:id/view', controller.recordView);
router.post('/:id/rate', controller.rate);
router.post('/:id/upload-profile', uploadController.uploadProfileImage);
router.post('/:id/upload-gallery', uploadController.uploadGalleryImages);

module.exports = router;