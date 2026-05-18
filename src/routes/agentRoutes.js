const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

router.post('/register', agentController.register);
router.post('/login', agentController.login);
router.post('/forgot-password', agentController.forgotPassword);
router.post('/verify-otp', agentController.verifyOTP);
router.post('/reset-password', agentController.resetPassword);
router.put('/profile', agentController.updateProfile);
router.put('/change-credentials', agentController.changeCredentials);

module.exports = router;
