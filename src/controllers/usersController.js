// Public: request admin-assisted password reset. Accepts { email } and notifies admin (for demo, just returns ok)
exports.requestAdminReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const u = await User.findByEmail(String(email).toLowerCase());
    if (!u) return res.status(404).json({ message: 'User not found' });
    await User.update(u.id, { adminResetRequested: true });
    // In a real app, notify admin (email, dashboard, etc). For now, just return ok.
    return res.json({ ok: true });
  } catch (err) {
    console.error('requestAdminReset error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
// Check if a Telegram chat ID is linked to any user
exports.checkTelegramChatId = async (req, res) => {
  try {
    const chatId = req.query.chatId;
    if (!chatId) return res.status(400).json({ message: 'Missing chatId' });
    const u = await User.findOne({ where: { telegramChatId: String(chatId) } });
    if (!u) return res.json({ linked: false });
    return res.json({ linked: true, email: decrypt(u.email) });
  } catch (err) {
    console.error('checkTelegramChatId error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/user');
const TelegramContact = require('../models/telegramContact');
const { decrypt } = require('../utils/encryption');
// When true (set DEV_RETURN_OTP=true in env), backend will include the OTP
// in the JSON response to aid local/dev testing. Do NOT enable in production.
const DEV_RETURN_OTP = (process.env.DEV_RETURN_OTP || 'false') === 'true';

function generateUserId() {
  // simple 6-digit numeric id
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function ensureUniqueIds() {
  // generate systemId + userId ensuring uniqueness
  let systemId = crypto.randomUUID();
  let userId = generateUserId();
  // if collision, retry (extremely unlikely)
  while (await User.findOne({ systemId })) {
    systemId = crypto.randomUUID();
  }
  while (await User.findOne({ userId })) {
    userId = generateUserId();
  }
  return { systemId, userId };
}

exports.register = async (req, res) => {
  try {

    const { fullName, email, password, phone, age, provider, idToken } = req.body;

    let resolvedEmail = email;
    let resolvedName = fullName;

    // If using Google provider, verify ID token with Google
    if (provider === 'google') {
      if (!idToken) return res.status(400).json({ message: 'Missing idToken for Google sign-in' });
      // Verify token
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const verifyRes = await axios.get(verifyUrl).catch((e) => null);
      if (!verifyRes || !verifyRes.data || !verifyRes.data.email) {
        return res.status(400).json({ message: 'Invalid Google ID token' });
      }
      resolvedEmail = verifyRes.data.email.toLowerCase();
      resolvedName = resolvedName || verifyRes.data.name || verifyRes.data.email.split('@')[0];
    }

    if (!resolvedName || !resolvedEmail || (!password && !provider)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const emailLower = resolvedEmail.toLowerCase();
    const existing = await User.findByEmail(emailLower);
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    // If phone provided, validate Ethiopian E.164 format and check for existing phone to avoid duplicate-key DB error
    if (phone) {
      const phoneRegex = /^\+251\d{9}$/;
      if (!phoneRegex.test(String(phone))) {
        return res.status(400).json({ message: 'Phone must be in format +251 followed by 9 digits (Ethiopia)' });
      }
      const allUsers = await User.findAll();
      const existingPhone = allUsers.find(u => u.phone === phone);
      if (existingPhone) return res.status(409).json({ message: 'Phone already registered', field: 'phone', value: phone });
    }

    const { systemId, userId } = await ensureUniqueIds();

    const passwordHash = password ? await bcrypt.hash(password, 10) : 'SOCIAL';

    const u = await User.create({
      fullName: resolvedName,
      email: emailLower,
      passwordHash,
      phone,
      age,
      provider: provider || null,
      systemId,
      userId
    });

    // create token
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: u.id, systemId: u.systemId }, secret, { expiresIn: '30d' });

    const out = {
      id: u.id,
      fullName: u.fullName,
      email: decrypt(u.email),
      phone: decrypt(u.phone),
      age: u.age,
      systemId: u.systemId,
      userId: u.userId,
      provider: u.provider,
      token
    };

    res.status(201).json(out);
  } catch (err) {
    console.error('register error', err);
    // Handle duplicate key errors from SQLite
    if (err && err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ message: 'Record already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, provider, idToken } = req.body;

    // Social/provider login
    if (provider === 'google') {
      if (!idToken) return res.status(400).json({ message: 'Missing idToken for Google login' });
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const verifyRes = await axios.get(verifyUrl).catch((e) => null);
      if (!verifyRes || !verifyRes.data || !verifyRes.data.email) {
        return res.status(400).json({ message: 'Invalid Google ID token' });
      }
      const emailLower = verifyRes.data.email.toLowerCase();
      // find or create user
      let u = await User.findByEmail(emailLower);
      if (!u) {
        console.log('🔧 Creating Google user for: $emailLower');
        const { systemId, userId } = await ensureUniqueIds();
        u = await User.create({
          fullName: verifyRes.data.name || emailLower.split('@')[0],
          email: emailLower,
          passwordHash: 'SOCIAL',
          provider: 'google',
          systemId,
          userId
        });
        console.log('✅ Google user created successfully');
      } else {
        console.log('✅ Google user found: $emailLower');
      }
      const secret = process.env.JWT_SECRET || 'dev_secret';
      const token = jwt.sign({ id: u.id, systemId: u.systemId }, secret, { expiresIn: '30d' });
      return res.json({ id: u.id, fullName: u.fullName, email: decrypt(u.email), phone: decrypt(u.phone), age: u.age, systemId: u.systemId, userId: u.userId, provider: u.provider, token });
    }

    // Email/password login for regular users
    if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });

    console.log('🔍 Login attempt for email: ' + email.toLowerCase());
    console.log('🔍 Password provided: ' + password);

    // Find user by email (regular user authentication)
    const u = await User.findByEmail(email.toLowerCase());
    if (!u) {
      console.log('❌ User not found: ' + email.toLowerCase());
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    console.log('✅ User found: ' + u.email);
    console.log('🔍 User ID: ' + u.id);
    console.log('🔍 Stored password hash: ' + u.passwordHash);
    console.log('🔍 User full name: ' + u.fullName);


    // If user is using admin reset password, check expiry and match
    if (u.adminResetPassword && u.adminResetPasswordExpires) {
      console.log('🔑 Checking admin reset password...');
      const now = new Date();
      if (password === u.adminResetPassword && now < u.adminResetPasswordExpires) {
        console.log('✅ Admin reset password valid');
        // Valid admin reset password, allow login and clear fields
        u.adminResetPassword = null;
        u.adminResetPasswordExpires = null;
        await u.save();
      } else if (password === u.adminResetPassword && now >= u.adminResetPasswordExpires) {
        console.log('❌ Admin reset password expired');
        return res.status(401).json({ message: 'Default password expired. Request admin reset again.' });
      } else {
        console.log('🔑 Falling back to normal password check...');
        // Fallback to normal password check
        const ok = await bcrypt.compare(password, u.passwordHash || '');
        if (!ok) {
          console.log('❌ Normal password check failed');
          return res.status(401).json({ message: 'Invalid credentials' });
        }
        console.log('✅ Normal password check passed');
      }
    } else {
      console.log('🔑 Performing normal password check...');
      // Normal password check
      console.log('🔍 Comparing password: ' + password);
      console.log('🔍 Against hash: ' + u.passwordHash);
      
      const ok = await bcrypt.compare(password, u.passwordHash || '');
      console.log('🔍 Password comparison result: ' + ok);
      
      if (!ok) {
        console.log('❌ Normal password check failed');
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      console.log('✅ Normal password check passed');
    }

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: u.id, systemId: u.systemId }, secret, { expiresIn: '30d' });

    res.json({
      id: u.id,
      fullName: u.fullName,
      email: decrypt(u.email),
      phone: decrypt(u.phone),
      age: u.age,
      systemId: u.systemId,
      userId: u.userId,
      provider: u.provider,
      token
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile: accepts { id, fullName, phone, age }
exports.updateProfile = async (req, res) => {
  try {
    const { id, fullName, phone, age, password } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findByPk(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (fullName) u.fullName = fullName;
    if (phone) {
      const phoneRegex = /^\+251\d{9}$/;
      if (!phoneRegex.test(String(phone))) return res.status(400).json({ message: 'Phone must be in format +251 followed by 9 digits (Ethiopia)' });
      u.phone = phone;
    }
    if (age !== undefined) u.age = age;
    if (password) {
      u.passwordHash = await bcrypt.hash(password, 10);
      // Clear admin reset fields if password is changed
      u.adminResetPassword = null;
      u.adminResetPasswordExpires = null;
    }
    await u.save();
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: u.id, systemId: u.systemId }, secret, { expiresIn: '30d' });
    return res.json({ id: u.id, fullName: u.fullName, email: decrypt(u.email), phone: decrypt(u.phone), age: u.age, systemId: u.systemId, userId: u.userId, provider: u.provider, token });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get basic profile by id
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findByPk(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    return res.json({ id: u.id, fullName: u.fullName, email: decrypt(u.email), phone: decrypt(u.phone), telegramChatId: u.telegramChatId, telegramUsername: u.telegramUsername, telegramPhone: u.telegramPhone });
  } catch (err) {
    console.error('getProfile error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Check if an email exists (query param: email)
exports.checkEmail = async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ message: 'email required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.json({ exists: false });
    // Add adminResetPassword and adminResetPasswordExpires if available and not expired
    let adminResetPassword = null;
    let adminResetPasswordExpires = null;
    if (u.adminResetPassword && u.adminResetPasswordExpires) {
      const now = new Date();
      if (now < u.adminResetPasswordExpires) {
        adminResetPassword = u.adminResetPassword;
        adminResetPasswordExpires = u.adminResetPasswordExpires;
      }
    }
    return res.json({
      exists: true,
      telegramLinked: !!u.telegramChatId,
      telegramUsername: u.telegramUsername || null,
      adminResetPassword,
      adminResetPasswordExpires
    });
  } catch (err) {
    console.error('checkEmail error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register a Telegram contact posted by the bot: { phone, chatId, telegramUsername }
exports.registerTelegramContact = async (req, res) => {
  try {
    let { phone, email, chatId, telegramUsername } = req.body || {};
    // If email is provided, look up user by email and get phone
    let user = null;
    if (email && !phone) {
      user = await User.findOne({ email: String(email).toLowerCase() });
      if (!user) return res.status(404).json({ message: 'No user with that email' });
      phone = user.phone;
    }
    if (!phone || !chatId) return res.status(400).json({ message: 'phone and chatId required' });
    // normalize phone: keep only digits
    const norm = String(phone).replace(/[^0-9]/g, '');
    // Prepare suffix matches (last 9 and last 10 digits) to tolerate country code differences
    const suffix9 = norm.length > 9 ? norm.slice(-9) : norm;
    const suffix10 = norm.length > 10 ? norm.slice(-10) : norm;

    const queries = [
      { phone: { $regex: norm + '$' } },
      { phone: { $regex: suffix9 + '$' } },
    ];
    if (suffix10 != suffix9) queries.push({ phone: { $regex: suffix10 + '$' } });

    // try to find user by matching different phone suffixes
    if (!user) {
      user = await User.findOne({ $or: queries });
      if (!user) {
        // try exact full match as last resort
        user = await User.findOne({ phone: phone });
      }
    }
    if (!user) return res.status(404).json({ message: 'No user with that phone or email' });
    user.telegramChatId = String(chatId);
    if (telegramUsername) user.telegramUsername = String(telegramUsername);
    user.telegramPhone = norm;
    await user.save();
    // also upsert into TelegramContact collection
    try {
      let tc = await TelegramContact.findOne({ chatId: String(chatId) });
      if (!tc) tc = new TelegramContact({ chatId: String(chatId), phone: norm, username: telegramUsername });
      else {
        tc.phone = norm || tc.phone;
        tc.username = telegramUsername || tc.username;
      }
      tc.linkedUser = user._id;
      await tc.save();
    } catch (e) {
      console.warn('Failed to upsert TelegramContact:', e && e.message ? e.message : e);
    }
    return res.json({ ok: true, id: user._id, telegramChatId: user.telegramChatId });
  } catch (err) {
    console.error('registerTelegramContact error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: request a login OTP to be sent via email for an email address
exports.requestLoginOtp = async (req, res) => {
  try {
    let { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ message: 'No user with that email' });

    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.loginOtp = otp;
    user.loginOtpExpires = expires;
    await user.save();

    // Send OTP via email
    const { sendEmailOTP } = require('../utils/emailService');
    const emailResult = await sendEmailOTP(user.email, otp, 'login');
    
    if (emailResult.success) {
      const out = { ok: true, via: 'email', request_id: String(user.id) };
      if (DEV_RETURN_OTP) out.otp = otp; // dev helper
      return res.json(out);
    } else {
      return res.status(500).json({ 
        ok: false, 
        success: false,
        via: 'email', 
        message: emailResult.error || 'Failed to send OTP email' 
      });
    }
  } catch (err) {
    console.error('requestLoginOtp error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: verify login OTP and return auth token if valid
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ message: 'email and otp required' });
    
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(404).json({ message: 'No user with that email' });
    if (!user.loginOtp || !user.loginOtpExpires) return res.status(400).json({ message: 'No pending login request' });
    if (String(user.loginOtp) !== String(otp)) return res.status(400).json({ message: 'Invalid code' });
    if (new Date() > new Date(user.loginOtpExpires)) return res.status(400).json({ message: 'Code expired' });

    // clear OTP and return token
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    await user.save();
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: user.id, systemId: user.systemId }, secret, { expiresIn: '30d' });
    return res.json({ id: user.id, fullName: user.fullName, email: decrypt(user.email), phone: decrypt(user.phone), token });
  } catch (err) {
    console.error('verifyLoginOtp error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Find a user by Telegram chatId
exports.findByTelegramChatId = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) return res.status(400).json({ message: 'Missing chatId' });
    const u = await User.findOne({ telegramChatId: String(chatId) });
    if (!u) return res.status(404).json({ message: 'Not found' });
    return res.json({ id: u._id, fullName: u.fullName, email: decrypt(u.email), phone: decrypt(u.phone), telegramChatId: u.telegramChatId });
  } catch (err) {
    console.error('findByTelegramChatId error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get saved facilities for a user (populated)
exports.getSavedFacilities = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    return res.json({ saved: u.savedFacilities || [] });
  } catch (err) {
    console.error('getSavedFacilities error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a saved facility by id
exports.addSavedFacility = async (req, res) => {
  try {
    const { id } = req.params; // user id
    const { facilityId } = req.body;
    if (!id || !facilityId) return res.status(400).json({ message: 'Missing parameters' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    // avoid duplicates
    const exists = (u.savedFacilities || []).some(f => f.toString() === facilityId.toString());
    if (!exists) u.savedFacilities = (u.savedFacilities || []).concat([facilityId]);
    await u.save();
    const populated = await User.findById(id).populate('savedFacilities');
    return res.json({ saved: populated.savedFacilities || [] });
  } catch (err) {
    console.error('addSavedFacility error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove saved facility
exports.removeSavedFacility = async (req, res) => {
  try {
    const { id, fid } = req.params;
    if (!id || !fid) return res.status(400).json({ message: 'Missing parameters' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    u.savedFacilities = (u.savedFacilities || []).filter(f => f.toString() !== fid.toString());
    await u.save();
    const populated = await User.findById(id).populate('savedFacilities');
    return res.json({ saved: populated.savedFacilities || [] });
  } catch (err) {
    console.error('removeSavedFacility error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

  // Device token management: add, list, remove
  exports.addDeviceToken = async (req, res) => {
    try {
      const { id } = req.params;
      const { token, platform } = req.body || {};
      if (!id || !token) return res.status(400).json({ message: 'Missing user id or token' });
      const u = await User.findById(id);
      if (!u) return res.status(404).json({ message: 'User not found' });
      // avoid duplicates
      u.deviceTokens = u.deviceTokens || [];
      const exists = u.deviceTokens.some(t => t && t.token === token);
      if (!exists) u.deviceTokens.push({ token: String(token), platform: platform || 'unknown', addedAt: new Date() });
      await u.save();
      return res.json({ ok: true, deviceTokens: u.deviceTokens });
    } catch (err) {
      console.error('addDeviceToken error', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  exports.listDeviceTokens = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ message: 'Missing id' });
      const u = await User.findById(id, 'deviceTokens');
      if (!u) return res.status(404).json({ message: 'User not found' });
      return res.json({ deviceTokens: u.deviceTokens || [] });
    } catch (err) {
      console.error('listDeviceTokens error', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

  exports.removeDeviceToken = async (req, res) => {
    try {
      const { id } = req.params;
      // token may be in body or query
      const token = (req.body && req.body.token) || req.query.token;
      if (!id || !token) return res.status(400).json({ message: 'Missing user id or token' });
      const u = await User.findById(id);
      if (!u) return res.status(404).json({ message: 'User not found' });
      u.deviceTokens = (u.deviceTokens || []).filter(t => t && t.token !== token);
      await u.save();
      return res.json({ ok: true, deviceTokens: u.deviceTokens });
    } catch (err) {
      console.error('removeDeviceToken error', err);
      res.status(500).json({ message: 'Server error' });
    }
  };

// Admin: list all users
exports.listUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    
    // Sort users by createdAt DESC
    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    // Email and phone are already decrypted by User.findAll()
    return res.json({ users: users });
  } catch (err) {
    console.error('listUsers error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Admin: update a user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, roles, isActive } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (fullName !== undefined) u.fullName = fullName;
    if (email !== undefined) u.email = String(email).toLowerCase();
    if (phone !== undefined) u.phone = phone;
    if (roles !== undefined) u.roles = roles;
    if (isActive !== undefined) u.isActive = isActive;
    await u.save();
    return res.json({ id: u._id, fullName: u.fullName, email: decrypt(u.email), phone: decrypt(u.phone), roles: u.roles, isActive: u.isActive });
  } catch (err) {
    console.error('updateUser error', err);
    if (err && err.code === 11000) {
      const keyValue = err.keyValue || {};
      const field = Object.keys(keyValue)[0] || 'field';
      const value = keyValue[field];
      return res.status(409).json({ message: `${field} already registered`, field, value });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: delete a user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    await User.findByIdAndDelete(id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('deleteUser error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: reset a user's password and set to fixed default 'Kale@1513', and clear adminResetRequested
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const u = await User.findById(id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    // Generate a random 10-character password
    const defaultPassword = Math.random().toString(36).slice(-10) + Math.floor(Math.random()*10);
    const hash = await bcrypt.hash(defaultPassword, 10);
    u.passwordHash = hash;
    u.adminResetRequested = false;
    u.adminResetPassword = defaultPassword;
    u.adminResetPasswordExpires = new Date(Date.now() + 60 * 1000); // 1 minute from now
    await u.save();
    return res.json({ ok: true, password: defaultPassword });
  } catch (err) {
    console.error('resetPassword error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: request a password reset. Accepts { email } and sends OTP via email.
exports.requestReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.status(404).json({ message: 'User not found' });
    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    u.resetOtp = otp;
    u.resetOtpExpires = expires;
    await u.save();

    // Send OTP via email
    const { sendEmailOTP } = require('../utils/emailService');
    const emailResult = await sendEmailOTP(u.email, otp, 'reset');
    
    if (emailResult.success) {
      return res.json({ ok: true, via: 'email' });
    } else {
      return res.status(500).json({ 
        ok: false, 
        success: false,
        via: 'email', 
        message: emailResult.error || 'Failed to send reset code' 
      });
    }
  } catch (err) {
    console.error('requestReset error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: verify reset OTP without changing password yet: { email, otp }
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ message: 'email and otp required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (!u.resetOtp || !u.resetOtpExpires) return res.status(400).json({ message: 'No pending reset request' });
    if (String(u.resetOtp) !== String(otp)) return res.status(400).json({ message: 'Invalid code' });
    if (new Date() > new Date(u.resetOtpExpires)) return res.status(400).json({ message: 'Code expired' });
    return res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verifyResetOtp error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Public: confirm reset with OTP and new password: { email, otp, newPassword }
exports.confirmReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'email, otp and newPassword required' });
    const u = await User.findOne({ email: String(email).toLowerCase() });
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (!u.resetOtp || !u.resetOtpExpires) return res.status(400).json({ message: 'No pending reset request' });
    if (String(u.resetOtp) !== String(otp)) return res.status(400).json({ message: 'Invalid code' });
    if (new Date() > new Date(u.resetOtpExpires)) return res.status(400).json({ message: 'Code expired' });
    // set new password
    const hash = await bcrypt.hash(String(newPassword), 10);
    u.passwordHash = hash;
    u.resetOtp = undefined;
    u.resetOtpExpires = undefined;
    await u.save();
    return res.json({ ok: true });
  } catch (err) {
    console.error('confirmReset error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
