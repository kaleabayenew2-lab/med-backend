const Facility = require('../models/facility');
const bcrypt = require('bcryptjs');
const serviceCatalog = require('../config/serviceCatalog');
const { decrypt, encrypt } = require('../utils/encryption');

exports.list = async (req, res) => {
  try {
    const { lat, lng, radius = 5000, type } = req.query;
    const where = {};

    if (type) {
      where.type = String(type).toLowerCase();
    }

    // Note: Geospatial queries not supported in SQLite, skipping location filter
    // In a real implementation, you might use a different approach or keep MongoDB for this

    const facilities = await Facility.findAll();
    if (type) {
      const filtered = facilities.filter(f => f.type === type);
      const decrypted = filtered.map(f => ({ ...f, profileImage: f.profile, galleryImages: f.gallary ? JSON.parse(f.gallary) : [], email: decrypt(f.email), phone: decrypt(f.phone) }));
      return res.json(decrypted.slice(0, 100));
    }
    const decrypted = facilities.map(f => ({ ...f, profileImage: f.profile, galleryImages: f.gallary ? JSON.parse(f.gallary) : [], email: decrypt(f.email), phone: decrypt(f.phone) }));
    return res.json(decrypted.slice(0, 100));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// DEBUG ENDPOINT - To check and clean up duplicate emails
exports.debugEmails = async (req, res) => {
  try {
    const facilities = await Facility.findAll();
    const emailList = [];
    const duplicates = [];
    const emailMap = new Map();
    
    // Decrypt all emails and find duplicates
    for (const facility of facilities) {
      let decryptedEmail;
      try {
        decryptedEmail = decrypt(facility.email);
      } catch(e) {
        decryptedEmail = facility.email;
      }
      
      emailList.push({
        id: facility.id,
        email: decryptedEmail,
        name: facility.name,
        type: facility.type,
        createdAt: facility.createdAt
      });
      
      // Check for duplicates
      if (emailMap.has(decryptedEmail)) {
        duplicates.push({
          email: decryptedEmail,
          existingId: emailMap.get(decryptedEmail),
          duplicateId: facility.id
        });
      } else {
        emailMap.set(decryptedEmail, facility.id);
      }
    }
    
    // Option to delete a specific email if requested
    const { deleteEmail } = req.query;
    if (deleteEmail) {
      const toDelete = emailList.find(e => e.email === deleteEmail);
      if (toDelete) {
        await Facility.destroy(toDelete.id);
        return res.json({ 
          message: `Deleted facility with email ${deleteEmail}`, 
          deleted: toDelete 
        });
      } else {
        return res.json({ 
          message: `Email ${deleteEmail} not found`,
          emails: emailList 
        });
      }
    }
    
    return res.json({ 
      total: facilities.length,
      emails: emailList,
      duplicates: duplicates.length > 0 ? duplicates : 'No duplicates found'
    });
  } catch(err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Clear all facilities (USE WITH CAUTION - for testing only)
exports.clearAllFacilities = async (req, res) => {
  try {
    const { confirm } = req.query;
    if (confirm !== 'YES_DELETE_ALL') {
      return res.status(400).json({ error: 'Use ?confirm=YES_DELETE_ALL to confirm deletion' });
    }
    
    const facilities = await Facility.findAll();
    for (const facility of facilities) {
      await Facility.destroy(facility.id);
    }
    
    return res.json({ message: `Deleted ${facilities.length} facilities` });
  } catch(err) {
    console.error('Clear error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    
    // Basic validation: require name, type, and email
    if (!data.name || !data.type || !data.email) {
      return res.status(400).json({ error: 'Missing required fields: name, type, and email' });
    }

    // Normalize name and email values
    data.name = String(data.name).trim();
    data.email = String(data.email).trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // normalize ownership value
    if (data.ownership) {
      data.ownership = String(data.ownership).toLowerCase();
      if (data.ownership !== 'public' && data.ownership !== 'private') {
        data.ownership = 'private';
      }
    }

    // Check for existing facility name within the same type (case-insensitive)
    const existing = await Facility.findByName(data.name, data.type);
    if (existing) {
      return res.status(409).json({ error: `${data.type} name already exists` });
    }

    // Check for existing email - FIXED: Properly decrypt and compare
    const allFacilities = await Facility.findAll();
    let existingEmail = null;
    
    for (const facility of allFacilities) {
      let decryptedEmail;
      try {
        decryptedEmail = decrypt(facility.email);
      } catch(e) {
        decryptedEmail = facility.email;
      }
      
      if (decryptedEmail && decryptedEmail.toLowerCase() === data.email.toLowerCase()) {
        existingEmail = facility;
        break;
      }
    }
    
    if (existingEmail) {
      console.log(`Email conflict detected: ${data.email} already exists in facility ID: ${existingEmail.id}`);
      return res.status(409).json({ error: 'Email already exists. Please use a different email address.' });
    }

    // If a username is provided, ensure it's unique
    if (data.username) {
      const existingUser = allFacilities.find(f => f.username === data.username);
      if (existingUser) return res.status(409).json({ error: 'Username already exists' });
    }

    // Validate coordinates if provided
    if (data.location && data.location.coordinates) {
      const [lng, lat] = data.location.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number' || 
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }
    }

    // Generate a random password for the facility
    const generatePassword = () => {
      return Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
    };
    
    const tempPassword = generatePassword();
    const salt = await bcrypt.genSalt(10);
    data.passwordHash = await bcrypt.hash(tempPassword, salt);

    // Generate agent ID automatically
    const generateAgentId = () => {
      const prefix = data.type === 'hospital' ? 'H' : 'P';
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `${prefix}${random}`;
    };

    data.agentId = generateAgentId();

    // Set default values
    data.isActive = true;
    data.createdAt = new Date();
    data.updatedAt = new Date();

    // Map image fields for database schema
    if (data.profileImage !== undefined) {
      data.profile = data.profileImage;
      delete data.profileImage;
    }
    if (data.galleryImages !== undefined) {
      data.gallary = JSON.stringify(Array.isArray(data.galleryImages) ? data.galleryImages.slice(0, 10) : []);
      delete data.galleryImages;
    }

    // Encrypt email and phone before saving
    if (data.email) {
      data.email = encrypt(data.email);
    }
    if (data.phone) {
      data.phone = encrypt(data.phone);
    }

    const facility = await Facility.create(data);
    
    // Return facility with temporary password (only shown once)
    const response = {
      id: facility.id,
      _id: facility.id,
      name: facility.name,
      type: facility.type,
      email: decrypt(facility.email),
      phone: facility.phone ? decrypt(facility.phone) : null,
      address: facility.address,
      location: facility.location,
      latitude: facility.latitude,
      longitude: facility.longitude,
      profile: facility.profile,
      profileImage: facility.profile,
      gallary: facility.gallary,
      galleryImages: facility.gallary ? JSON.parse(facility.gallary) : [],
      username: facility.username,
      agentId: facility.agentId,
      isActive: facility.isActive,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
      temporaryPassword: tempPassword,
      ownership: facility.ownership,
      openingHours: facility.openingHours,
      openingHoursType: facility.openingHoursType,
      customOpeningHours: facility.customOpeningHours,
      emergency: facility.emergency,
      services: facility.services,
      notes: facility.notes,
      ratingCount: facility.ratingCount || 0,
      averageRating: facility.averageRating || 0,
      viewsTotal: facility.viewsTotal || 0,
      lastViewedAt: facility.lastViewedAt
    };
    
    res.status(201).json(response);
  } catch (err) {
    console.error('Facility creation error:', err);
    // Handle duplicate key error
    if (err && err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Record already exists' });
    }
    res.status(400).json({ error: 'Bad request: ' + err.message });
  }
};

// Facility login via username/password -> returns facility object when credentials match
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const facilities = await Facility.findAll();
    const facility = facilities.find(f => f.username === username);
    if (!facility) return res.status(401).json({ error: 'Invalid credentials' });
    if (!facility.passwordHash) return res.status(401).json({ error: 'No password set for this facility' });
    const ok = await bcrypt.compare(password, facility.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const decrypted = { ...facility, profileImage: facility.profile, galleryImages: facility.gallary ? JSON.parse(facility.gallary) : [], email: decrypt(facility.email), phone: decrypt(facility.phone) };
    return res.json(decrypted);
  } catch (err) {
    console.error('facility login error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get facility by id
exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    // Find facility by ID or agentId
    let facility;
    if (!isNaN(id)) {
      facility = await Facility.findById(parseInt(id));
    }
    if (!facility) {
      const facilities = await Facility.findAll();
      facility = facilities.find(f => f.agentId === id);
    }
    if (!facility) return res.status(404).json({ error: 'Facility not found' });
    const decrypted = { ...facility, profileImage: facility.profile, galleryImages: facility.gallary ? JSON.parse(facility.gallary) : [], email: decrypt(facility.email), phone: decrypt(facility.phone) };
    return res.json(decrypted);
  } catch (err) {
    console.error('facility get error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/view
// increments view counters and records last viewed timestamp
exports.recordView = async (req, res) => {
  try {
    const { id } = req.params;
    const { viewerIdentifier, viewerType } = req.body;

    // Find facility by ID or agentId
    let facility;
    if (!isNaN(id)) {
      facility = await Facility.findById(parseInt(id));
    }
    if (!facility) {
      const facilities = await Facility.findAll();
      facility = facilities.find(f => f.agentId === id);
    }
    if (!facility) return res.status(404).json({ error: 'Not found' });
    
    // Determine unique identifier & type
    let finalIdentifier = viewerIdentifier;
    let finalType = viewerType;

    if (!finalIdentifier) {
      // Fallback to IP address / device identifier
      finalIdentifier = req.ip || req.connection?.remoteAddress || 'unknown-device';
      finalType = 'ip';
    }

    const ViewModel = require('../models/view');
    const uniqueViewsCount = await ViewModel.record(facility.id, finalIdentifier, finalType);
    
    // Get updated lastViewedAt
    const updated = await Facility.findById(facility.id);
    
    return res.json({ 
      ok: true, 
      viewsTotal: uniqueViewsCount, 
      lastViewedAt: updated.lastViewedAt 
    });
  } catch (err) {
    console.error('recordView error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/rate
// body: { rating: number }
exports.rate = async (req, res) => {
  try {
    const { id } = req.params;
    const rating = Number(req.body.rating || 0);
    if (!Number.isFinite(rating) || rating <= 0) return res.status(400).json({ error: 'rating required' });
    
    // Find facility
    const facility = await Facility.findById(parseInt(id));
    if (!facility) return res.status(404).json({ error: 'Not found' });
    
    // Update aggregated rating fields
    await Facility.updateRating(facility.id, rating);
    
    // Get updated facility
    const updated = await Facility.findById(facility.id);
    
    return res.json({ ok: true, ratingCount: updated.ratingCount, averageRating: updated.averageRating });
  } catch (err) {
    console.error('rate error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Update facility by id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    const data = { ...req.body };

    // Strip read-only / computed fields that must not be persisted
    ['id', '_id', 'agentId', 'createdAt', '_editing', 'temporaryPassword',
     'averageRating', 'viewsTotal', 'ratingCount', 'ratingSum',
     'lastViewedAt', 'favoriteCount'].forEach(k => delete data[k]);

    if (data.ownership) {
      data.ownership = String(data.ownership).toLowerCase();
      if (data.ownership !== 'public' && data.ownership !== 'private') data.ownership = 'private';
    }

    // Load once for all uniqueness checks
    const allFacilities = await Facility.findAll();

    // Name uniqueness (exclude self by numeric id)
    if (data.name) {
      const dupe = allFacilities.find(f => f.name === data.name && parseInt(f.id, 10) !== numericId);
      if (dupe) return res.status(409).json({ error: 'Facility name already exists' });
    }

    // Username uniqueness (exclude self)
    if (data.username) {
      const dupeUser = allFacilities.find(f => f.username === data.username && parseInt(f.id, 10) !== numericId);
      if (dupeUser) return res.status(409).json({ error: 'Username already exists' });
    }

    // Email uniqueness + re-encrypt
    if (data.email) {
      const normalizedEmail = String(data.email).trim().toLowerCase();
      for (const f of allFacilities) {
        if (parseInt(f.id, 10) === numericId) continue;
        let dec;
        try { dec = decrypt(f.email); } catch(e) { dec = f.email; }
        if (dec && dec.toLowerCase() === normalizedEmail) {
          return res.status(409).json({ error: 'Email already exists. Please use a different email address.' });
        }
      }
      data.email = encrypt(normalizedEmail);
    }

    // Re-encrypt phone (no uniqueness check on update)
    if (data.phone) {
      data.phone = encrypt(String(data.phone).trim());
    }

    // Hash new password
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(String(data.password), salt);
      delete data.password;
    }

    // Map image fields for database schema
    if (req.body.profileImage !== undefined) {
      data.profile = req.body.profileImage;
    }
    delete data.profileImage;
    if (req.body.galleryImages !== undefined) {
      data.gallary = JSON.stringify(Array.isArray(req.body.galleryImages) ? req.body.galleryImages.slice(0, 10) : []);
    }
    delete data.galleryImages;

    data.updatedAt = new Date().toISOString();

    // Persist
    const facility = await Facility.update(numericId, data);
    if (!facility) return res.status(404).json({ error: 'Not found' });

    const decrypted = {
      ...facility,
      id: facility.id,
      _id: facility.id,
      profileImage: facility.profile,
      galleryImages: facility.gallary ? JSON.parse(facility.gallary) : [],
      email: facility.email ? decrypt(facility.email) : '',
      phone: facility.phone ? decrypt(facility.phone) : ''
    };
    return res.json(decrypted);
  } catch (err) {
    console.error('facility update error', err);
    if (err && err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'Record already exists (constraint violation)' });
    }
    return res.status(400).json({ error: 'Bad request: ' + err.message });
  }
};

// POST /api/facilities/:id/reset-password
// If body.password provided, set that as the new password; otherwise generate a temporary one.
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    let { password } = req.body || {};
    // Log incoming request (do not print plaintext here unless DEBUG_PASSWORDS=true)
    try {
      console.log(`resetPassword request: id=${id} bodyContainsPassword=${password ? 'yes' : 'no'}`);
    } catch (e) {}

    // If no password provided, generate a secure temporary password
    if (!password) {
      const rand = () => Math.random().toString(36).slice(2);
      password = `${rand()}${rand()}`.slice(0, 16);
      try { console.log('resetPassword: generated a temporary password (plaintext suppressed)'); } catch (e) {}
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(password), salt);

    // Find and update facility
    const facility = await Facility.findById(parseInt(id));
    if (!facility) {
      try { console.warn(`resetPassword: facility not found for id=${id}`); } catch (e) {}
      return res.status(404).json({ error: 'Not found' });
    }

    await Facility.update(parseInt(id), { passwordHash });

    // Log outcome for operator visibility; optionally reveal plaintext when DEBUG_PASSWORDS=true
    try {
      if (process.env.DEBUG_PASSWORDS === 'true') {
        console.log(`resetPassword: facility ${facility.id} password set to: ${password}`);
      } else {
        console.log(`resetPassword: facility ${facility.id} password updated (plaintext suppressed)`);
      }
    } catch (e) { /* ignore logging failures */ }

    // Return the plaintext password so admin UI can display it once
    return res.json({ password });
  } catch (err) {
    console.error('resetPassword error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/send-password-email
// Send password email to facility
exports.sendPasswordEmail = async (req, res) => {
  try {
    const { email, facilityName, password } = req.body;
    
    if (!email || !facilityName || !password) {
      return res.status(400).json({ error: 'Email, facility name, and password are required' });
    }
    
    const emailService = require('../services/emailService');
    
    // Send email with password
    const result = await emailService.sendPasswordEmail(email, password, facilityName);
    
    if (result.success) {
      console.log(`📧 Password email sent successfully to ${email} for facility ${facilityName}`);
      return res.json({ success: true, message: 'Password email sent successfully' });
    } else {
      console.error('Failed to send password email:', result.error);
      return res.status(500).json({ error: 'Failed to send password email' });
    }
  } catch (err) {
    console.error('sendPasswordEmail error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/facilities/:id/verify-password
// Verify current password against database
exports.verifyPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Find facility by ID
    const facility = await Facility.findById(parseInt(id));
    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    
    // Compare password with stored hash
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(String(password), facility.passwordHash);
    
    if (isValid) {
      console.log(`✅ Password verification successful for facility ${facility.id}`);
      return res.json({ valid: true, message: 'Password verified successfully' });
    } else {
      console.log(`❌ Password verification failed for facility ${facility.id}`);
      return res.json({ valid: false, message: 'Invalid password' });
    }
  } catch (err) {
    console.error('verifyPassword error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check if a facility name exists
exports.checkName = async (req, res) => {
  try {
    const { name, type } = req.query;
    if (!name) return res.status(400).json({ error: 'name parameter required' });
    
    const existing = await Facility.findByName(name, type);
    return res.json({ exists: !!existing });
  } catch (err) {
    console.error('checkName error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check email uniqueness - FIXED: Properly decrypt emails for comparison
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email parameter required' });
    
    const normalizedEmail = String(email).trim().toLowerCase();
    const facilities = await Facility.findAll();
    
    let exists = false;
    for (const facility of facilities) {
      let decryptedEmail;
      try {
        decryptedEmail = decrypt(facility.email);
      } catch(e) {
        decryptedEmail = facility.email;
      }
      
      if (decryptedEmail && decryptedEmail.toLowerCase() === normalizedEmail) {
        exists = true;
        break;
      }
    }
    
    console.log(`Email check for ${normalizedEmail}: ${exists ? 'EXISTS' : 'AVAILABLE'}`);
    
    return res.json({ 
      exists: exists,
      email: email
    });
  } catch (err) {
    console.error('checkEmail error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Check phone uniqueness
exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone parameter required' });
    
    // Normalize phone number (ensure it starts with +251)
    let normalizedPhone = phone;
    if (!phone.startsWith('+251')) {
      normalizedPhone = `+251${phone}`;
    }
    
    // Use exact match
    const facilities = await Facility.findAll();
    const existing = facilities.find(f => f.phone === normalizedPhone);
    
    return res.json({ 
      exists: !!existing,
      phone: normalizedPhone
    });
  } catch (err) {
    console.error('checkPhone error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Return service catalog used by frontend for subtype-specific options
exports.catalog = async (req, res) => {
  try {
    return res.json(serviceCatalog);
  } catch (err) {
    console.error('service catalog error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};