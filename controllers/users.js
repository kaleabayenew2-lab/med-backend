```javascript
// ...existing imports...
const MobileUser = require('../models/mobile-user'); // use existing mobile-user.js model

// add helper at top of this file (after MobileUser import)
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

// ...existing code...

// inside your register handler / before creating User:
try {
  // ensure a non-null username
  if (!req.body.username) {
    req.body.username = await generateUniqueUsername(req.body.name || req.body.fullName, req.body.email);
  }

  let user;
  try {
    user = await MobileUser.create(req.body);
  } catch (err) {
    // on duplicate username regenerate and retry once
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.username) {
      req.body.username = await generateUniqueUsername(req.body.name || req.body.fullName, req.body.email);
      user = await MobileUser.create(req.body);
    } else {
      throw err;
    }
  }

  // ...existing post-create logic (return token / respond), using `user` ...
} catch (err) {
  console.error('register error', err);
  return res.status(500).json({ message: 'Server error' });
}

// ...existing code...
```