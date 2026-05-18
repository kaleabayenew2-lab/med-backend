// Users routes for backend API
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

// Simple GET /api/users - Return empty array for now (placeholder)
router.get('/', (req, res) => {
  res.json([]);
});

// POST /api/users/admin-reset - Request admin reset
router.post('/admin-reset', usersController.requestAdminReset);

// GET /api/users/check-telegram - Check Telegram chat ID
router.get('/check-telegram', usersController.checkTelegramChatId);

module.exports = router;
