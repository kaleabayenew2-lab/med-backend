const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/admin/stats
router.get('/stats', adminController.getStats);

// GET /api/admin/all (consolidated admin data)
router.get('/all', adminController.getAll);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Emergency management
router.get('/emergencies', adminController.getEmergencies);
router.post('/emergencies/bulk', adminController.bulkUpdateEmergencies);

// Content management
router.get('/content', adminController.getContent);
router.post('/content', adminController.createContent);
router.put('/content/:id', adminController.updateContent);
router.delete('/content/:id', adminController.deleteContent);
// Trigger ad generation (admin)
router.post('/generate-ads', adminController.generateAds);
// Reports
router.get('/reports/most-viewed', adminController.getMostViewed);
router.get('/reports/top-rated', adminController.getTopRated);

module.exports = router;
