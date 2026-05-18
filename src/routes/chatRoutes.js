// Chat routes for backend API
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// GET /api/chat/messages - Get chat messages by user
router.get('/messages', chatController.listByUser);

// POST /api/chat/messages - Send chat message
router.post('/messages', chatController.createMessage);

// GET /api/chat/conversations - Get conversation by ID
router.get('/conversations', chatController.getConversation);

// GET /api/chat/stats - Get chat stats
router.get('/stats', chatController.getStats);

module.exports = router;
