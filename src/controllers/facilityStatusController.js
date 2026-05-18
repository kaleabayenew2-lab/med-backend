const FacilityStatus = require('../models/facilityStatus');
const User = require('../models/user');
const db = require('../config/db');
const jwt = require('jsonwebtoken');

function getAuthorizationToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

exports.addFavoriteStatus = async (req, res) => {
  try {
    const { email, facilityId } = req.body || {};
    if (!email || !facilityId) {
      return res.status(400).json({ message: 'Missing email or facilityId' });
    }

    // Find user by email
    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const favorite = await FacilityStatus.addFavorite(user.id, facilityId);
    return res.json({ success: true, favorite });
  } catch (err) {
    console.error('addFavoriteStatus error', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

exports.removeFavoriteStatus = async (req, res) => {
  try {
    const { email, facilityId } = req.body || {};
    if (!email || !facilityId) {
      return res.status(400).json({ message: 'Missing email or facilityId' });
    }

    // Find user by email
    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await FacilityStatus.removeFavorite(user.id, facilityId);
    return res.json({ success: true, removed: { email, facilityId } });
  } catch (err) {
    console.error('removeFavoriteStatus error', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

exports.getFavoritesByUserEmail = async (req, res) => {
  try {
    const email = (req.query.email || '').toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Missing email query parameter' });
    }

    const token = getAuthorizationToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized - missing auth token' });
    }

    const secret = process.env.JWT_SECRET || 'dev_secret';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (verifyError) {
      return res.status(401).json({ message: 'Unauthorized - invalid token' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!decoded || String(decoded.id) !== String(user.id)) {
      return res.status(401).json({ message: 'Unauthorized - token does not match user' });
    }

    const favorites = await db('facility_statuses as fs')
      .join('facilities as f', 'fs.facilityId', 'f.id')
      .where({ 'fs.userId': user.id, 'fs.status': 'favorite' })
      .select(
        'f.*',
        db.raw('(SELECT COUNT(*) FROM facility_statuses WHERE facilityId = f.id AND status = ?) AS favoriteCount', ['favorite'])
      );

    const normalized = favorites.map((row) => ({
      ...row,
      isFavorite: true,
      favoriteCount: Number(row.favoriteCount || 0),
    }));

    return res.json({ success: true, favorites: normalized });
  } catch (err) {
    console.error('getFavoritesByUserEmail error', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

exports.getFavoritesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }

    const favorites = await FacilityStatus.findByUser(userId);
    return res.json({ success: true, favorites });
  } catch (err) {
    console.error('getFavoritesByUser error', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

exports.getFavoritesByFacility = async (req, res) => {
  try {
    const { facilityId } = req.params;
    if (!facilityId) {
      return res.status(400).json({ message: 'Missing facilityId' });
    }

    const statuses = await db('facility_statuses as fs')
      .where({ 'fs.facilityId': Number(facilityId), 'fs.status': 'favorite' })
      .select('fs.*');

    // Retrieve all users to decrypt and match
    const allUsers = await db('users').select('*');
    const { decrypt: _decrypt } = require('../utils/encryption');

    const results = [];
    for (const status of statuses) {
      const user = allUsers.find(u => Number(u.id) === Number(status.userId));
      if (user) {
        let decEmail = '';
        let decPhone = '';
        try { decEmail = _decrypt(user.email); } catch(e) { decEmail = user.email; }
        try { decPhone = _decrypt(user.phone); } catch(e) { decPhone = user.phone; }
        
        results.push({
          id: status.id,
          userId: user.id,
          fullName: user.fullName,
          email: decEmail,
          phone: decPhone,
          createdAt: status.createdAt
        });
      }
    }

    return res.json({ success: true, statuses: results });
  } catch (err) {
    console.error('getFavoritesByFacility error', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
