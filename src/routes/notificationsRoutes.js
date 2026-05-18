// Notifications routes for backend API
const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');

// GET /api/notifications/stream - SSE stream for notifications
router.get('/stream', notificationsController.stream);

// GET /api/notifications - List notifications
router.get('/', notificationsController.list);

// PUT /api/notifications/:id - Mark notification as read
router.put('/:id', notificationsController.markRead);

module.exports = router;
