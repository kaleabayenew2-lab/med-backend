const express = require('express');
const router = express.Router();
const controller = require('../controllers/facilitiesController');

// POST /api/views/:id - Record a view for a facility
router.post('/:id', controller.recordView);

module.exports = router;
