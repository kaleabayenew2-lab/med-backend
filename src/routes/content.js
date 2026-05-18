const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');

// GET /api/content
router.get('/', contentController.publicList);

module.exports = router;
