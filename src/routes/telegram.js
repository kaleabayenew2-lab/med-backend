const express = require('express');
const router = express.Router();
const telegramController = require('../controllers/telegramController');

// GET /api/telegram/contacts/:chatId
router.get('/contacts/:chatId', telegramController.getByChatId);

// GET /api/telegram/contacts  -- list all contacts (admin use)
router.get('/contacts', telegramController.listContacts);

// POST /api/telegram/contacts  -- upsert contact
router.post('/contacts', telegramController.upsertContact);

module.exports = router;
