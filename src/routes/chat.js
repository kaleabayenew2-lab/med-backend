const express = require('express');
const router = express.Router();
const controller = require('../controllers/chatController');

router.post('/messages', controller.createMessage);
router.get('/messages', controller.listByUser);
router.get('/conversation/:id', controller.getConversation);
router.get('/stats', controller.getStats);
router.post('/conversation/:id/read', controller.markRead);

// moderation
router.delete('/messages/:id', controller.deleteMessage);
router.post('/messages/:id/edit', controller.editMessage);
router.post('/conversation/:id/flag', controller.flagConversation);
router.post('/user/:id/block', controller.blockUser);
router.post('/conversation/:id/clear', controller.clearConversation);

// typing / presence / message read
router.post('/typing', controller.typing);
router.post('/presence', controller.presence);
router.post('/messages/:id/read', controller.markMessageRead);

// conversation status endpoints
router.get('/conversations/statuses', controller.listStatuses);
router.post('/conversation/:id/status', controller.setStatus);

module.exports = router;
