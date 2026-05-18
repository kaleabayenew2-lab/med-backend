const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationsController');

// GET /api/notifications?email=... or ?feedbackId=... or ?ip=...
router.get('/', controller.list);

// SSE stream for admin clients to receive live notifications
router.get('/stream', controller.stream);

// mark read
router.put('/:id/read', controller.markRead);

// POST /api/notifications/cleanup  -> body: { keepIds?: string[] }
router.post('/cleanup', (req, res) => {
	try {
		const keepIds = req.body && req.body.keepIds ? req.body.keepIds : null;
		let removed = [];
		if (Array.isArray(keepIds)) {
			removed = controller.removeNotIn(keepIds);
		} else {
			// no keepIds provided: caller can first pass content list to cleanupForContent
			removed = [];
		}
		return res.json({ ok: true, removed });
	} catch (e) {
		console.error('cleanup route error', e);
		return res.status(500).json({ ok: false });
	}
});

module.exports = router;
