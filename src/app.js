// Main backend application
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import database and models
const db = require('./config/db');
const Facility = require('./models/facility');
const User = require('./models/user');
const ChatMessage = require('./models/chatMessage');
const FacilityStatus = require('./models/facilityStatus');
const ViewModel = require('./models/view');
const BookingModel = require('./models/booking');
const PromotionModel = require('./models/promotion');

// Import email service
const { createTransporter } = require('./services/emailService');

// Import routes
const facilityRoutes = require('./routes/facilities');
const otpRoutes = require('./routes/otpRoutes');
const adminRoutes = require('./routes/adminRoutes');
const usersRoutes = require('./routes/users');
const agentRoutes = require('./routes/agentRoutes');
const facilityStatusRoutes = require('./routes/facilityStatus');
const notificationsRoutes = require('./routes/notificationsRoutes');
const chatRoutes = require('./routes/chatRoutes');
const hospitalTypesRoutes = require('./routes/hospitalTypes');
const pharmacyTypesRoutes = require('./routes/pharmacyTypes');
const uploadsRoutes = require('./routes/uploads');

// Initialize Express app
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ============================================
// IMPORTANT: Set database in app for routes to access
// ============================================
app.set('db', db);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads folder exists and serve uploaded files
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path, stat) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: token });
});

// API routes
app.use('/api/facilities', facilityRoutes);
app.use('/api/views', require('./routes/views'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/otp', otpRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/facility-status', facilityStatusRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/hospital-types', hospitalTypesRoutes);
app.use('/api/pharmacy-types', pharmacyTypesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/content', (req, res) => {
  res.json({ message: 'Content endpoint working', data: { content: 'Static content for the app' } });
});

// Add places endpoint
app.use('/api/places', (req, res) => {
  res.json({ message: 'Places endpoint working', data: { places: 'Places data for the app' } });
});

// Add markers endpoint  
app.use('/api/markers', (req, res) => {
  res.json({ message: 'Markers endpoint working', data: { markers: 'Markers data for the app' } });
});

// OTP request logging middleware
app.use('/api/otp', (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔐 [${timestamp}] OTP API Request:`);
  console.log(`📋 Method: ${req.method}`);
  console.log(`🛣️  Path: ${req.originalUrl}`);
  console.log(`📧 Body: ${JSON.stringify(req.body)}`);
  console.log(`🌐 IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`📱 User-Agent: ${req.get('User-Agent') || 'Unknown'}`);
  console.log('─'.repeat(50));
  
  // Store the original send function
  const originalSend = res.send;
  res.send = function(data) {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] OTP API Response:`);
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`📦 Response: ${data}`);
    console.log('═'.repeat(50));
    originalSend.call(this, data);
  };
  
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Facility Management Backend API',
    version: '1.0.0',
    endpoints: {
      facilities: '/api/facilities',
      otp: '/api/otp',
      hospitalTypes: '/api/hospital-types',
      pharmacyTypes: '/api/pharmacy-types',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'File too large'
    });
  }
  
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// ============================================
// FIXED: Initialize database with proper error handling
// ============================================
async function initializeDatabase() {
  try {
    console.log('📦 Initializing database...');
    
    if (typeof db.testConnection === 'function') {
      await db.testConnection();
      console.log('✅ Database connection test passed');
    } else {
      console.log('⚠️ Database testConnection method not available, skipping test');
    }
    
    if (typeof db.syncDatabase === 'function') {
      await db.syncDatabase();
      console.log('✅ Database synced');
    }
    
    if (Facility && typeof Facility.createTable === 'function') {
      try {
        await Facility.createTable();
        console.log('✅ Facilities table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating facilities table:', err.message);
        }
      }
    }
    
    if (User && typeof User.createTable === 'function') {
      try {
        await User.createTable();
        console.log('✅ Users table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating users table:', err.message);
        }
      }
    }

    if (FacilityStatus && typeof FacilityStatus.createTable === 'function') {
      try {
        await FacilityStatus.createTable();
        console.log('✅ Facility status table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating facility status table:', err.message);
        }
      }
    }
    
    if (ChatMessage && typeof ChatMessage.createTable === 'function') {
      try {
        await ChatMessage.createTable();
        console.log('✅ ChatMessages table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating chatMessages table:', err.message);
        }
      }
    }

    if (ViewModel && typeof ViewModel.createTable === 'function') {
      try {
        await ViewModel.createTable();
        console.log('✅ Facility views table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating facility views table:', err.message);
        }
      }
    }

    if (BookingModel && typeof BookingModel.createTable === 'function') {
      try {
        await BookingModel.createTable();
        console.log('✅ Bookings table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating bookings table:', err.message);
        }
      }
    }

    if (PromotionModel && typeof PromotionModel.createTable === 'function') {
      try {
        await PromotionModel.createTable();
        console.log('✅ Promotions table ready');
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('❌ Error creating promotions table:', err.message);
        }
      }
    }
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.log('⚠️ Continuing without database...');
  }
}

// Attempt to create transporter (non-blocking)
try {
  createTransporter();
  console.log('📧 Email transporter initialization attempted');
} catch (err) {
  console.log('⚠️ Email transporter initialization warning:', err && err.message ? err.message : err);
}

initializeDatabase().catch((error) => {
  console.error('❌ Initial database setup failed:', error.message);
});

module.exports = app;