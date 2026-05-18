const MobileUser = require('../models/mobile-user');
const bcrypt = require('bcryptjs');

// helper
async function generateUniqueUsername(name, email) {
  const base = (name ? String(name).split(' ')[0] : (email || '').split('@')[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  let username = base || `user${Date.now()}`;
  let suffix = 0;
  while (await MobileUser.exists({ username })) {
    suffix += 1;
    username = `${base || 'user'}${suffix}`;
  }
  return username;
}


// Replace your current create/new-user block with this pattern inside your register handler:
try {
  // ensure required fields present (you may already validate earlier)
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // ensure username exists and is unique
  if (!req.body.username) {
    req.body.username = await generateUniqueUsername(req.body.name || req.body.fullName, req.body.email);
  }

  // hash password
  const salt = await bcrypt.genSalt(10);
  req.body.password = await bcrypt.hash(req.body.password, salt);

  let user;
  try {
    user = await MobileUser.create(req.body);
  } catch (err) {
    // on duplicate username try once more with regenerated username
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.username) {
      req.body.username = await generateUniqueUsername(req.body.name || req.body.fullName, req.body.email);
      user = await MobileUser.create(req.body);
    } else {
      throw err;
    }
  }

  // adapt to your existing response/token flow
  // e.g. create token and return user
  const token = createTokenForUser(user); // replace with your token generation logic
  return res.status(201).json({ token, user });
} catch (err) {
  console.error('register error', err);
  return res.status(500).json({ message: 'Server error' });
}