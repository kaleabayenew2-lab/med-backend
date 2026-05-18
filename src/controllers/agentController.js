const Facility = require('../models/facility');
const db = require('../config/db'); // Knex db instance
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../services/emailService');
const { decrypt, encrypt } = require('../utils/encryption');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.register = async (req, res) => {
  try {
    const { 
      name, facility_type, facility_sub_type, ownership, address, phone, note,
      emergency_enabled, is_24_hours, opening_hours, opening_time, closing_time, services, username, password, email,
      latitude, longitude, profile_image, gallery_images
    } = req.body;

    if (!name || !username || !password || !email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check if username already exists
    const existingUsername = await db('facilities').where({ username }).first();
    if (existingUsername) {
       return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    // Check if email already exists (must compare decrypted values)
    const allFacilities = await db('facilities').select('id', 'email');
    const normalizedEmail = String(email).trim().toLowerCase();
    for (const f of allFacilities) {
      let dec;
      try { dec = decrypt(f.email); } catch(e) { dec = f.email; }
      if (dec && dec.toLowerCase() === normalizedEmail) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const location = JSON.stringify({ type: 'Point', coordinates: [parseFloat(longitude) || 0, parseFloat(latitude) || 0] });
    
    // Convert times if opening_hours is not provided but opening_time and closing_time are
    let finalOpeningHours = opening_hours;
    if (!finalOpeningHours && opening_time && closing_time) {
      finalOpeningHours = `${opening_time} - ${closing_time}`;
    }

    // Encrypt PII before storing
    const encryptedEmail = encrypt(normalizedEmail);
    const encryptedPhone = phone ? encrypt(String(phone).trim()) : null;

    const newFacility = await Facility.create({
       name,
       type: facility_type ? facility_type.toLowerCase() : 'hospital',
       email: encryptedEmail,
       phone: encryptedPhone,
       address,
       location,
       ownership: ownership ? ownership.toLowerCase() : 'private',
       username,
       passwordHash,
       isEmergency: emergency_enabled ? 1 : 0,
       notes: note,
       hospitalType: facility_sub_type,
       pharmacyType: facility_sub_type,
       services: JSON.stringify(services || []),
       openingHours: finalOpeningHours,
       profile: profile_image,
       gallary: JSON.stringify(gallery_images || [])
    });

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: newFacility.id, agent: true }, secret, { expiresIn: '30d' });

    // Return decrypted values to the client
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      id: newFacility.id,
      agentId: newFacility.agentId,
      name: newFacility.name,
      fullName: newFacility.name,
      username: newFacility.username,
      email: normalizedEmail,
      phone: phone ? String(phone).trim() : null,
      type: newFacility.type,
      token,
    });

  } catch (error) {
    console.error('Agent register error:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ success: false, message: 'Record already exists (duplicate entry)' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Safe decrypt: never throws — returns plaintext if already plaintext, decrypts if encrypted
function safeDecrypt(value) {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch(e) {
    // decryption failed — value is probably plain text already
    return value;
  }
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body; 
    if (!username || !password) return res.status(400).json({ success: false, message: 'Missing credentials' });

    const facility = await db('facilities')
      .where({ username: username })
      .first();

    // If not found by username, try to find by decrypting stored emails
    let foundFacility = facility;
    if (!foundFacility) {
      const all = await db('facilities').select('*');
      foundFacility = all.find(f => safeDecrypt(f.email).toLowerCase() === username.toLowerCase());
    }

    if (!foundFacility) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, foundFacility.passwordHash || '');
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Decrypt sensitive fields before sending to client
    const decryptedEmail = safeDecrypt(foundFacility.email);
    const decryptedPhone = safeDecrypt(foundFacility.phone);

    console.log(`🔐 Login: raw email="${foundFacility.email?.substring(0,20)}..." → decrypted="${decryptedEmail}"`);
    console.log(`🔐 Login: raw phone="${foundFacility.phone?.substring(0,20)}..." → decrypted="${decryptedPhone}"`);

    // Parse services
    let services = [];
    try { services = foundFacility.services ? JSON.parse(foundFacility.services) : []; } catch(e) { services = []; }

    // Parse location
    let latitude = null;
    let longitude = null;
    try {
      const loc = foundFacility.location ? JSON.parse(foundFacility.location) : null;
      if (loc && loc.coordinates) {
        longitude = loc.coordinates[0];
        latitude = loc.coordinates[1];
      }
    } catch(e) {}

    // Count favorites for this facility
    let favoriteCount = 0;
    try {
      const favResult = await db('facility_statuses')
        .where({ facilityId: foundFacility.id, status: 'favorite' })
        .count('id as count')
        .first();
      favoriteCount = Number(favResult?.count || 0);
    } catch(e) {
      console.error('Error counting favorites:', e);
    }

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ id: foundFacility.id, agent: true }, secret, { expiresIn: '30d' });

    res.json({
      success: true,
      id: foundFacility.id,
      agentId: foundFacility.agentId || null,
      name: foundFacility.name,
      fullName: foundFacility.name,
      username: foundFacility.username,
      email: decryptedEmail,
      phone: decryptedPhone,
      type: foundFacility.type,
      hospitalType: foundFacility.hospitalType || null,
      pharmacyType: foundFacility.pharmacyType || null,
      address: foundFacility.address || '',
      openingHours: foundFacility.openingHours || '',
      ownership: foundFacility.ownership || '',
      isEmergency: foundFacility.isEmergency === 1 || foundFacility.isEmergency === true,
      isActive: foundFacility.isActive === 1 || foundFacility.isActive === true,
      services,
      latitude,
      longitude,
      profileImage: foundFacility.profile || null,
      averageRating: foundFacility.averageRating || 0,
      ratingCount: foundFacility.ratingCount || 0,
      viewsTotal: foundFacility.viewsTotal || 0,
      favoriteCount,
      createdAt: foundFacility.createdAt,
      token
    });
  } catch (error) {
    console.error('Agent login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const allFacilities = await db('facilities').select('*');
    const facility = allFacilities.find(f => safeDecrypt(f.email).toLowerCase() === email.trim().toLowerCase());
    if (!facility) return res.status(404).json({ success: false, message: 'Any facility is not registered with this email' });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await db('otp_codes').insert({
      identifier: email,
      method: 'agent_reset',
      code: otp,
      expires_at: expiresAt,
      is_used: 0,
      attempts: 0
    });

    const subject = 'Agent Password Reset OTP';
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Your OTP code to reset your password is: <strong style="font-size: 24px;">${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    const emailResult = await sendOTPEmail(email, subject, html);
    if (emailResult && emailResult.success) {
      return res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      return res.json({ success: false, message: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error('Agent forgotPassword error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    // Retrieve the most recent OTP for this email
    const recentOtp = await db('otp_codes')
      .where({ identifier: email, method: 'agent_reset', is_used: 0 })
      .andWhere('expires_at', '>', new Date().toISOString())
      .orderBy('id', 'desc')
      .first();

    if (!recentOtp) {
      return res.status(400).json({ success: false, message: 'No active OTP request found or code expired.' });
    }

    // Check if already blocked due to too many attempts
    if (recentOtp.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'Too many failed attempts. This code has been blocked. Please request a new one.' });
    }

    if (String(recentOtp.code) !== String(otp)) {
      const newAttempts = (recentOtp.attempts || 0) + 1;
      
      if (newAttempts >= 3) {
        await db('otp_codes').where({ id: recentOtp.id }).update({ is_used: 1, attempts: newAttempts });
        return res.status(400).json({ success: false, message: 'Too many failed attempts. This code has been blocked. Please request a new one.' });
      } else {
        await db('otp_codes').where({ id: recentOtp.id }).update({ attempts: newAttempts });
        return res.status(400).json({ success: false, message: `Invalid code. ${3 - newAttempts} attempts remaining.` });
      }
    }

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Agent verifyOTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Missing fields' });

    const otpRecord = await db('otp_codes')
      .where({ identifier: email, method: 'agent_reset', code: String(otp), is_used: 0 })
      .andWhere('expires_at', '>', new Date().toISOString())
      .orderBy('id', 'desc')
      .first();

    if (!otpRecord) {
       return res.status(400).json({ success: false, message: 'OTP is invalid, expired, or has been blocked' });
    }

    if (otpRecord.attempts >= 3) {
       return res.status(400).json({ success: false, message: 'This OTP was blocked due to too many failed verification attempts.' });
    }

    const allFacilities = await db('facilities').select('*');
    const facility = allFacilities.find(f => safeDecrypt(f.email).toLowerCase() === email.trim().toLowerCase());
    if (!facility) return res.status(404).json({ success: false, message: 'Any facility is not registered with this email' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db('facilities').where({ id: facility.id }).update({ passwordHash });

    // Mark OTP as used
    await db('otp_codes').where({ id: otpRecord.id }).update({ is_used: 1 });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Agent resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing facility ID' });
    }

    const Facility = require('../models/facility');
    
    // Fields that the agent is allowed to update
    const updatableFields = [
      'name',
      'email',
      'phone',
      'address',
      'openingHours',
      'ownership',
      'isEmergency',
      'services',
      'notes',
      'latitude',
      'longitude',
      'type',
      'hospitalType',
      'pharmacyType'
    ];

    const updateData = {};
    for (const key of updatableFields) {
      if (req.body[key] !== undefined) {
        if (key === 'services' && Array.isArray(req.body.services)) {
          updateData.services = JSON.stringify(req.body.services);
        } else {
          updateData[key] = req.body[key];
        }
      }
    }

    // Build location JSON if latitude and longitude are provided
    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      updateData.location = JSON.stringify({
        type: 'Point',
        coordinates: [Number(req.body.longitude), Number(req.body.latitude)]
      });
    }

    const updatedFacility = await Facility.update(id, updateData);
    if (!updatedFacility) {
      return res.status(404).json({ success: false, message: 'Facility not found' });
    }

    // Parse services
    let services = [];
    try { services = updatedFacility.services ? JSON.parse(updatedFacility.services) : []; } catch(e) { services = []; }

    // Parse location
    let latitude = null;
    let longitude = null;
    try {
      const loc = updatedFacility.location ? JSON.parse(updatedFacility.location) : null;
      if (loc && loc.coordinates) {
        longitude = loc.coordinates[0];
        latitude = loc.coordinates[1];
      }
    } catch(e) {}

    // Count favorites for this facility
    let favoriteCount = 0;
    try {
      const favResult = await db('facility_statuses')
        .where({ facilityId: updatedFacility.id, status: 'favorite' })
        .count('id as count')
        .first();
      favoriteCount = Number(favResult?.count || 0);
    } catch(e) {}

    // Return the updated user info to keep the client storage updated
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      facility: {
        id: updatedFacility.id,
        agentId: updatedFacility.agentId,
        name: updatedFacility.name,
        fullName: updatedFacility.name,
        username: updatedFacility.username,
        email: updatedFacility.email, // decrypted by Facility.update/findById
        phone: updatedFacility.phone, // decrypted by Facility.update/findById
        type: updatedFacility.type,
        hospitalType: updatedFacility.hospitalType,
        pharmacyType: updatedFacility.pharmacyType,
        address: updatedFacility.address || '',
        openingHours: updatedFacility.openingHours || '',
        ownership: updatedFacility.ownership || '',
        isEmergency: updatedFacility.isEmergency === 1 || updatedFacility.isEmergency === true,
        isActive: updatedFacility.isActive === 1 || updatedFacility.isActive === true,
        services,
        latitude,
        longitude,
        profileImage: updatedFacility.profile || null,
        averageRating: updatedFacility.averageRating || 0,
        ratingCount: updatedFacility.ratingCount || 0,
        viewsTotal: updatedFacility.viewsTotal || 0,
        favoriteCount,
        createdAt: updatedFacility.createdAt
      }
    });

  } catch (error) {
    console.error('Agent updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.changeCredentials = async (req, res) => {
  try {
    const { id, username, currentPassword, newPassword } = req.body;

    if (!id || !username || !currentPassword) {
      return res.status(400).json({ success: false, message: 'ID, username, and current password are required' });
    }

    // 1. Find the facility/agent by ID
    const facility = await db('facilities').where({ id }).first();
    if (!facility) {
      return res.status(404).json({ success: false, message: 'Agent facility not found' });
    }

    // 2. Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, facility.passwordHash || '');
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect current password' });
    }

    const updateData = {};

    // 3. Check username availability if it is being changed
    if (username.trim() !== facility.username) {
      const existingUser = await db('facilities').where({ username: username.trim() }).first();
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Username is already taken' });
      }
      updateData.username = username.trim();
    }

    // 4. Update password if new password is provided
    if (newPassword && newPassword.trim().length >= 6) {
      updateData.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    } else if (newPassword && newPassword.trim().length > 0) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    // 5. If nothing to update, return success
    if (Object.keys(updateData).length === 0) {
      return res.json({ success: true, message: 'No credential changes requested' });
    }

    // 6. Update database
    await db('facilities').where({ id }).update(updateData);

    res.json({
      success: true,
      message: 'Credentials updated successfully',
      username: updateData.username || facility.username
    });

  } catch (error) {
    console.error('Agent changeCredentials error:', error);
    res.status(500).json({ success: false, message: 'Server error during credentials update' });
  }
};
