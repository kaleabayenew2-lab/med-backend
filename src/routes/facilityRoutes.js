// Facility routes for backend API
const express = require('express');
const router = express.Router();
const {
  list,
  create,
  update,
  login,
  get,
  recordView,
  rate,
  resetPassword,
  checkName,
  catalog
} = require('../controllers/facilitiesController');

// GET /api/facilities - Get all facilities
router.get('/', list);

// POST /api/facilities - Create new facility
router.post('/', create);

// PUT /api/facilities/:id - Update facility
router.put('/:id', update);

// POST /api/facilities/login - Facility login
router.post('/login', login);

// GET /api/facilities/:id - Get facility by id
router.get('/:id', get);

// POST /api/facilities/:id/view - Record facility view
router.post('/:id/view', recordView);

// POST /api/facilities/:id/rate - Rate facility
router.post('/:id/rate', rate);

// POST /api/facilities/:id/reset-password - Reset facility password
router.post('/:id/reset-password', resetPassword);

// GET /api/facilities/check-name - Check name uniqueness
router.get('/check-name', checkName);

// GET /api/facilities/catalog - Get service catalog
router.get('/catalog', catalog);

module.exports = router;
