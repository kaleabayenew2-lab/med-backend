const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

// simple validation runner used by routes below
function runValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}


// =============================
// AUTH ROUTES
// =============================

// POST /api/users/register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  runValidation,
  usersController.register
);

// POST /api/users/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').exists().withMessage('Password required'),
  ],
  runValidation,
  usersController.login
);

// POST /api/users/auth/logout
// Simple logout endpoint for stateless JWT/localStorage frontend
router.post('/auth/logout', (req, res) => {
  // If you use cookies for authentication
  res.clearCookie('token');
  res.json({ ok: true });
});

// Request password reset (OTP via Telegram if linked)
router.post('/request-reset', usersController.requestReset);

// Request admin-assisted password reset
router.post('/request-admin-reset', usersController.requestAdminReset);

// Verify reset OTP without setting new password
router.post('/verify-reset-otp', usersController.verifyResetOtp);

// Confirm reset with OTP + new password
router.post('/confirm-reset', usersController.confirmReset);


// =============================
// TELEGRAM ROUTES
// =============================

// GET /api/users/check-telegram?chatId=...
router.get('/check-telegram', usersController.checkTelegramChatId);

// POST /api/users/telegram/register-contact
router.post('/telegram/register-contact', usersController.registerTelegramContact);

// GET /api/users/telegram/:chatId
router.get('/telegram/:chatId', usersController.findByTelegramChatId);

// POST /api/users/telegram/request-login
router.post('/telegram/request-login', usersController.requestLoginOtp);

// POST /api/users/telegram/verify-login
router.post('/telegram/verify-login', usersController.verifyLoginOtp);


// =============================
// USER CHECK ROUTES
// =============================

// GET /api/users/check?email=...
router.get('/check', usersController.checkEmail);


// =============================
// PROFILE ROUTES
// =============================

// POST /api/users/profile
router.post('/profile', usersController.updateProfile);

// GET /api/users/:id  (Keep parameter routes near bottom)
router.get('/:id', usersController.getProfile);


// =============================
// SAVED FACILITIES
// =============================

// GET saved facilities
router.get('/:id/saved', usersController.getSavedFacilities);

// Add saved facility
router.post('/:id/saved', usersController.addSavedFacility);

// Remove saved facility
router.delete('/:id/saved/:fid', usersController.removeSavedFacility);


// =============================
// DEVICE TOKENS
// =============================

router.post('/:id/device-tokens', usersController.addDeviceToken);
router.get('/:id/device-tokens', usersController.listDeviceTokens);
router.delete('/:id/device-tokens', usersController.removeDeviceToken);


// =============================
// ADMIN ROUTES
// =============================

// List all users
router.get('/', auth, usersController.listUsers);

// Update user
router.put('/:id', auth, usersController.updateUser);

// Delete user
router.delete('/:id', auth, usersController.deleteUser);

// Reset user password
router.post('/:id/reset-password', auth, usersController.resetPassword);


module.exports = router;
