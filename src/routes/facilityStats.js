const express = require('express');
const router = express.Router();
const controller = require('../controllers/facilityStatsController');

router.get('/top', controller.top);
router.get('/:id', controller.get);
router.post('/:id', controller.upsert);
router.post('/:id/view', controller.recordView);

module.exports = router;
