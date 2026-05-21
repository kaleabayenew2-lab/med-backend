// Backend server entry point
require('dotenv').config();
const express = require('express'); // ADD THIS - missing express import
const app = require('./src/app');
const path = require('path');
const { updateBackendUrl } = require('./src/services/githubUpdater');

const os = require('os');
const HospitalType = require('./src/models/hospitalType');
const PharmacyType = require('./src/models/pharmacyType');

// Initialize database tables
async function initDatabase() {
  try {
    await HospitalType.createTable();
    await PharmacyType.createTable();
    await HospitalType.seedData();
    await PharmacyType.seedData();
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Start the server
const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🔧 Starting backend server...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Port: ${PORT}`);

// Initialize email transporter once at startup (lazy init also handled)
const { createTransporter } = require('./src/services/emailService');
console.log('📧 Ensuring email transporter available...');
try {
  createTransporter();
  console.log('✅ Email transporter creation attempted (see logs for details)');
} catch (err) {
  console.warn('⚠️ Email transporter init warning:', err && err.message ? err.message : err);
}

(async () => {
  await initDatabase();
  
  // FIX: Use the server with Socket.IO from app.js
  const server = require('http').createServer(app);
  const socketIo = require('socket.io');
  
  // Setup socket.io
  const io = socketIo(server, {
    cors: {
      origin: [
        process.env.FRONTEND_ORIGIN || 'https://med-admin-n3ij.onrender.com',
        'https://admin-lpya.onrender.com',
        'https://med-admin-n3ij.onrender.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  // Handle socket.io connections
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    // Handle admin connections
    if (socket.handshake.query.admin === '1') {
      console.log(`👨‍💼 Admin socket connected: ${socket.id}`);
      socket.join('admin');
    }
    
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
  
  const HOST = process.env.HOST || '0.0.0.0';
  server.listen(PORT, HOST, async () => {
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/health`);
    console.log(`🏥 Facilities API: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/facilities`);
    console.log(`🔐 OTP API: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/otp`);
    console.log(`👨‍💼 Admin API: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/admin`);
    console.log(`🔌 Socket.IO: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/socket.io`);

    const interfaces = os.networkInterfaces();
    Object.values(interfaces).forEach((networkArray) => {
      if (!networkArray) return;
      networkArray.forEach((network) => {
        if (network.family === 'IPv4' && !network.internal) {
          console.log(`🌐 Network address: http://${network.address}:${PORT}`);
        }
      });
    });

    const currentUrl = process.env.BACKEND_URL ||
      `https://${process.env.RENDER_EXTERNAL_URL}` ||
      `http://localhost:${PORT}`;

    await updateBackendUrl(currentUrl);

    setInterval(() => {
      updateBackendUrl(currentUrl);
    }, 60 * 60 * 1000);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
})();