// Admin routes for backend API
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/admin/settings - Get admin settings
router.get('/settings', adminController.getSettings);

// PUT /api/admin/settings - Update admin settings
router.put('/settings', adminController.updateSettings);

// GET /api/admin/stats - Get admin stats
router.get('/stats', adminController.getStats);

// GET /api/admin/all - Get all admin data
router.get('/all', adminController.getAll);

// GET /api/admin/emergencies - Get emergency facilities
router.get('/emergencies', adminController.getEmergencies);

// POST /api/admin/emergencies/bulk - Bulk update emergencies
router.post('/emergencies/bulk', adminController.bulkUpdateEmergencies);

// GET /api/admin/content - Get content
router.get('/content', adminController.getContent);

// POST /api/admin/content - Create content
router.post('/content', adminController.createContent);

// PUT /api/admin/content/:id - Update content
router.put('/content/:id', adminController.updateContent);

// DELETE /api/admin/content/:id - Delete content
router.delete('/content/:id', adminController.deleteContent);

// DELETE /api/admin/facilities - Remove all facilities
router.delete('/facilities', adminController.removeAllFacilities);

// POST /api/admin/generate-ads - Generate ads
router.post('/generate-ads', adminController.generateAds);

// GET /api/admin/reports/most-viewed - Get most viewed facilities
router.get('/reports/most-viewed', adminController.getMostViewed);

// GET /api/admin/reports/top-rated - Get top rated facilities
router.get('/reports/top-rated', adminController.getTopRated);

module.exports = router;
