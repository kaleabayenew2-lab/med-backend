// Facility controller for backend API
const { connectToDatabase, initializeDatabase } = require('../database/connection');

// Get all facilities or specific facility
async function getFacilities(req, res) {
  try {
    const { id, search, type, ownership, emergency } = req.query;
    
    // Connect to database and initialize schema
    const db = connectToDatabase();
    initializeDatabase();

    let query = 'SELECT * FROM facilities';
    const params = [];

    // Add filters
    const whereConditions = [];
    
    if (id) {
      whereConditions.push('id = ?');
      params.push(id);
    } else {
      if (search) {
        whereConditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR address LIKE ?)');
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
      }
      if (type) {
        whereConditions.push('type = ?');
        params.push(type);
      }
      if (ownership) {
        whereConditions.push('ownership = ?');
        params.push(ownership);
      }
      if (emergency !== undefined) {
        whereConditions.push('emergency = ?');
        params.push(emergency === 'true' ? 1 : 0);
      }
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const facilities = id ? 
      db.prepare(query).get(params) : 
      db.prepare(query).all(params);

    // Clean and sanitize facility data
    const cleanFacilities = (facility) => {
      // Parse JSON fields with fallbacks
      let parsedServices = [];
      let parsedLocation = null;
      
      try {
        parsedServices = facility.services ? JSON.parse(facility.services) : [];
      } catch (e) {
        console.warn('Failed to parse services for facility:', facility.id, e);
        parsedServices = [];
      }
      
      // Create location object from lat/lng
      if (facility.latitude && facility.longitude) {
        parsedLocation = {
          type: "Point",
          coordinates: [parseFloat(facility.longitude), parseFloat(facility.latitude)]
        };
      }
      
      // Return clean, complete facility object
      return {
        id: facility.id || null,
        name: facility.name || '',
        type: facility.type || '',
        email: facility.email || '',
        phone: facility.phone || '',
        address: facility.address || '',
        openingHours: facility.opening_hours || '',
        ownership: facility.ownership || 'public',
        username: facility.username || '',
        isActive: facility.is_active === 1,
        emergency: facility.emergency === 1,
        notes: facility.notes || '',
        location: parsedLocation,
        services: parsedServices,
        hospital_type: facility.hospital_type || null,
        pharmacy_type: facility.pharmacy_type || null,
        profileImage: facility.profile || null,
        galleryImages: facility.gallary ? JSON.parse(facility.gallary) : [],
        createdAt: facility.created_at || null,
        updatedAt: facility.updated_at || null
      };
    };
    
    // Process facilities array or single facility
    const processedFacilities = Array.isArray(facilities) 
      ? facilities.map(cleanFacilities)
      : cleanFacilities(facilities);

    res.status(200).json({
      success: true,
      data: processedFacilities,
      count: Array.isArray(facilities) ? facilities.length : 1
    });
  } catch (error) {
    console.error('GET facilities error:', error);
    res.status(500).json({ message: 'Error fetching facilities' });
  }
}

// Create new facility
async function createFacility(req, res) {
  try {
    const facility = req.body;

    // Validate required fields
    const requiredFields = ['name', 'type', 'email', 'phone', 'address', 'opening_hours', 'ownership', 'username', 'latitude', 'longitude'];
    const missingFields = requiredFields.filter(field => !facility[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        missingFields 
      });
    }

    // Connect to database and initialize schema
    const db = connectToDatabase();
    initializeDatabase();

    // Generate unique ID
    const timestamp = Date.now();
    const randomCode = Math.random().toString(36).substr(2, 9).toUpperCase();
    const facilityId = `FAC-${timestamp}-${randomCode}`;

    // Check for duplicates
    const existingEmail = db.prepare('SELECT id FROM facilities WHERE LOWER(email) = LOWER(?)').get([facility.email.trim()]);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const existingPhone = db.prepare('SELECT id FROM facilities WHERE phone = ?').get([`+251${facility.phone}`]);
    if (existingPhone) {
      return res.status(400).json({ message: 'Phone number already exists' });
    }

    const existingUsername = db.prepare('SELECT id FROM facilities WHERE LOWER(username) = LOWER(?)').get([facility.username.trim()]);
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const existingName = db.prepare('SELECT id FROM facilities WHERE LOWER(name) = LOWER(?) AND type = ?').get([facility.name.trim(), facility.type]);
    if (existingName) {
      return res.status(400).json({ message: 'Facility name already exists for this type' });
    }

    // Insert facility
    const insertQuery = `
      INSERT INTO facilities (
        id, name, type, email, phone, address, opening_hours, ownership,
        username, password, emergency, notes, latitude, longitude,
        hospital_type, pharmacy_type, services, profile, gallary, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const params = [
      facilityId,
      facility.name.trim(),
      facility.type,
      facility.email.trim(),
      `+251${facility.phone}`,
      facility.address.trim(),
      facility.opening_hours,
      facility.ownership,
      facility.username.trim(),
      facility.password || null,
      facility.emergency ? 1 : 0,
      facility.notes || null,
      parseFloat(facility.latitude),
      parseFloat(facility.longitude),
      facility.hospital_type || null,
      facility.pharmacy_type || null,
      facility.services ? JSON.stringify(facility.services) : null,
      facility.profileImage || null,
      facility.galleryImages ? JSON.stringify(facility.galleryImages.slice(0, 10)) : null
    ];

    db.prepare(insertQuery).run(params);

    // Get created facility
    const createdFacility = db.prepare('SELECT * FROM facilities WHERE id = ?').get([facilityId]);

    res.status(201).json({
      success: true,
      message: 'Facility created successfully',
      facility: createdFacility
    });
  } catch (error) {
    console.error('POST facility error:', error);
    res.status(500).json({ message: 'Error creating facility' });
  }
}

// Update facility
async function updateFacility(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Facility ID is required' });
    }

    // Connect to database and initialize schema
    const db = await connectToDatabase();
    await initializeDatabase();

    // Check if facility exists
    const existingFacility = await db.get('SELECT * FROM facilities WHERE id = ?', [id]);
    if (!existingFacility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const params = [];

    const allowedFields = [
      'name', 'email', 'phone', 'address', 'opening_hours', 'ownership',
      'username', 'password', 'emergency', 'notes', 'latitude', 'longitude',
      'hospital_type', 'pharmacy_type', 'services', 'is_active',
      'profileImage', 'galleryImages'
    ];

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        let dbField = field;
        if (field === 'profileImage') dbField = 'profile';
        if (field === 'galleryImages') dbField = 'gallary';
        updateFields.push(`${dbField} = ?`);
        
        let value = updates[field];
        if (field === 'phone' && !value.startsWith('+251')) {
          value = `+251${value}`;
        }
        if (field === 'services' && Array.isArray(value)) {
          value = JSON.stringify(value);
        }
        if (field === 'galleryImages' && Array.isArray(value)) {
          value = JSON.stringify(value.slice(0, 10));
        }
        if (field === 'emergency') {
          value = value ? 1 : 0;
        }
        if (field === 'is_active') {
          value = value ? 1 : 0;
        }
        if (field === 'latitude' || field === 'longitude') {
          value = parseFloat(value);
        }

        params.push(value);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const updateQuery = `UPDATE facilities SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.run(updateQuery, params);

    // Get updated facility and clean it
    const updatedFacility = await db.get('SELECT * FROM facilities WHERE id = ?', [id]);
    
    // Clean the updated facility data
    const cleanFacilities = (facility) => {
      let parsedServices = [];
      let parsedLocation = null;
      
      try {
        parsedServices = facility.services ? JSON.parse(facility.services) : [];
      } catch (e) {
        console.warn('Failed to parse services for facility:', facility.id, e);
        parsedServices = [];
      }
      
      if (facility.latitude && facility.longitude) {
        parsedLocation = {
          type: "Point",
          coordinates: [parseFloat(facility.longitude), parseFloat(facility.latitude)]
        };
      }
      
      return {
        id: facility.id || null,
        name: facility.name || '',
        type: facility.type || '',
        email: facility.email || '',
        phone: facility.phone || '',
        address: facility.address || '',
        openingHours: facility.opening_hours || '',
        ownership: facility.ownership || 'public',
        username: facility.username || '',
        isActive: facility.is_active === 1,
        emergency: facility.emergency === 1,
        notes: facility.notes || '',
        location: parsedLocation,
        services: parsedServices,
        hospital_type: facility.hospital_type || null,
        pharmacy_type: facility.pharmacy_type || null,
        profileImage: facility.profile || null,
        galleryImages: facility.gallary ? JSON.parse(facility.gallary) : [],
        createdAt: facility.created_at || null,
        updatedAt: facility.updated_at || null
      };
    };

    const cleanedFacility = cleanFacilities(updatedFacility);

    res.status(200).json({
      success: true,
      message: 'Facility updated successfully',
      facility: cleanedFacility
    });
  } catch (error) {
    console.error('PUT facility error:', error);
    res.status(500).json({ message: 'Error updating facility' });
  }
}

// Delete facility (soft delete)
async function deleteFacility(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Facility ID is required' });
    }

    // Connect to database and initialize schema
    const db = await connectToDatabase();
    await initializeDatabase();

    // Check if facility exists
    const existingFacility = await db.get('SELECT * FROM facilities WHERE id = ?', [id]);
    if (!existingFacility) {
      return res.status(404).json({ message: 'Facility not found' });
    }

    // Soft delete (set is_active = 0)
    await db.run('UPDATE facilities SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    res.status(200).json({
      success: true,
      message: 'Facility deleted successfully'
    });
  } catch (error) {
    console.error('DELETE facility error:', error);
    res.status(500).json({ message: 'Error deleting facility' });
  }
}

// Check email uniqueness
async function checkEmailUniqueness(req, res) {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Connect to database and initialize schema
    const db = connectToDatabase();
    initializeDatabase();
    
    // Check if email exists in database (case-insensitive)
    const existingFacility = db.prepare('SELECT id FROM facilities WHERE LOWER(email) = LOWER(?)').get([email.trim()]);
    
    const emailExists = !!existingFacility;
    
    res.status(200).json({ 
      exists: emailExists,
      email: email
    });
  } catch (error) {
    console.error('Error checking email uniqueness:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Check phone uniqueness
async function checkPhoneUniqueness(req, res) {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Normalize phone number (ensure it starts with +251)
    let normalizedPhone = phone;
    if (!phone.startsWith('+251')) {
      normalizedPhone = `+251${phone}`;
    }

    // Connect to database and initialize schema
    const db = connectToDatabase();
    initializeDatabase();
    
    // Check if phone exists in database (exact match)
    const existingFacility = db.prepare('SELECT id FROM facilities WHERE phone = ?').get([normalizedPhone]);
    
    const phoneExists = !!existingFacility;
    
    res.status(200).json({ 
      exists: phoneExists,
      phone: normalizedPhone
    });
  } catch (error) {
    console.error('Error checking phone uniqueness:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// Check name uniqueness
async function checkNameUniqueness(req, res) {
  try {
    const { name, type } = req.query;

    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }

    // Connect to database and initialize schema
    const db = connectToDatabase();
    initializeDatabase();
    
    // Check if facility name exists for the specific type (case-insensitive)
    const existingFacility = db.prepare('SELECT id FROM facilities WHERE LOWER(name) = LOWER(?) AND type = ?').get([name.trim(), type]);
    
    const nameExists = !!existingFacility;
    
    res.status(200).json({ 
      exists: nameExists,
      name: name,
      type: type
    });
  } catch (error) {
    console.error('Error checking facility name uniqueness:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
  checkEmailUniqueness,
  checkPhoneUniqueness,
  checkNameUniqueness
};
