const express = require('express');
const router = express.Router();
const controller = require('../controllers/feedbackController');

// public submit
router.post('/', controller.submit);

// admin: list and manage replies
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/:id/reply', controller.reply);

module.exports = router;
