const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Upload single profile image
async function uploadProfileImage(req, res) {
  try {
    upload.single('profileImage')(req, res, (err) => {
      if (err) {
        console.error('Profile image upload error:', err);
        return res.status(400).json({ 
          success: false, 
          message: 'Error uploading profile image',
          error: err.message 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No profile image file provided' 
        });
      }

      // Generate image URL
      const imageUrl = `/uploads/${req.file.filename}`;
      
      res.status(200).json({
        success: true,
        message: 'Profile image uploaded successfully',
        imageUrl: imageUrl
      });
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during profile image upload',
      error: error.message 
    });
  }
}

// Upload multiple gallery images
async function uploadGalleryImages(req, res) {
  try {
    upload.array('galleryImages', 10)(req, res, (err, files) => {
      if (err) {
        console.error('Gallery images upload error:', err);
        return res.status(400).json({ 
          success: false, 
          message: 'Error uploading gallery images',
          error: err.message 
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No gallery images provided' 
        });
      }

      // Generate image URLs
      const imageUrls = files.map(file => `/uploads/${file.filename}`);
      
      res.status(200).json({
        success: true,
        message: `${files.length} gallery images uploaded successfully`,
        imageUrls: imageUrls
      });
    });
  } catch (error) {
    console.error('Gallery images upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during gallery images upload',
      error: error.message 
    });
  }
}

module.exports = {
  uploadProfileImage,
  uploadGalleryImages
};
