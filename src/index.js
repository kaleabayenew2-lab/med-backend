require('dotenv').config();
const express = require('express');
const cors = require('cors');const helmet = require('helmet');
const rateLimit = require('express-rate-limit');const db = require('./config/db');
const fs = require('fs');
const path = require('path');

const app = express();
// Configure CORS to allow the frontend origin and credentials when required
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN || 'https://admin-lpya.onrender.com',
  'https://admin-lpya.onrender.com',
  'http://localhost:3000',
  'http://192.168.55.60:3000'
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

// basic rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});
app.use(apiLimiter);

app.use(express.json());

// maintenance mode middleware: if enabled, reject all non-admin requests
const adminController = require('./controllers/adminController');
app.use((req, res, next) => {
  try {
    const s = adminController.readSettings();
    if (s && s.maintenanceMode === true) {
      // allow admin endpoints to toggle off maintenance and health check
      if (req.path.startsWith('/api/admin') || req.path === '/health') {
        return next();
      }
      return res.status(503).json({ message: 'Server under maintenance' });
    }
  } catch (e) {
    // ignore errors and proceed normally
  }
  next();
});

// simple health endpoint used by frontend connection checks
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// simple CSRF token endpoint (dev-friendly): returns a token and sets a non-httpOnly cookie
app.get('/api/csrf-token', (req, res) => {
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    // set cookie so clients that prefer double-submit can read it (not httpOnly for demo/dev)
    res.cookie('csrfToken', token, { sameSite: 'lax', secure: false });
    res.json({ csrfToken: token });
  } catch (e) {
    res.status(500).json({ error: 'csrf token generation failed' });
  }
});

// Import models to ensure they're registered
require('./models/facility');

// Initialize SQLite database
db.testConnection().then(() => db.syncDatabase());

// ensure uploads and logs directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const logsDir = path.join(__dirname, '..', 'logs');
fs.mkdirSync(logsDir, { recursive: true });

// serve uploaded files
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

const facilitiesRouter = require('./routes/facilities');
app.use('/api/facilities', facilitiesRouter);

const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);

const agentRoutes = require('./routes/agentRoutes');
app.use('/api/agents', agentRoutes);

const telegramRouter = require('./routes/telegram');
app.use('/api/telegram', telegramRouter);
const feedbackRouter = require('./routes/feedback');
app.use('/api/feedback', feedbackRouter);

const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', notificationsRouter);

const contentRouter = require('./routes/content');
app.use('/api/content', contentRouter);

// Ads and facility stats
const adsRouter = require('./routes/ads');
app.use('/api/ads', adsRouter);

const statsRouter = require('./routes/facilityStats');
app.use('/api/stats', statsRouter);

// Chat
const chatRouter = require('./routes/chat');
app.use('/api/chat', chatRouter);

// uploads
const uploadsRouter = require('./routes/uploads');
app.use('/api/uploads', uploadsRouter);

// OTP
const otpRouter = require('./routes/otp');
app.use('/api/otp', otpRouter);

const os = require('os');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// support WebSocket (socket.io)
const http = require('http');
const https = require('https');
let server;
let socketManager = null;
let notificationsController = null;

// if HTTPS key/cert are provided via environment, use them
const httpsKey = process.env.HTTPS_KEY_PATH;
const httpsCert = process.env.HTTPS_CERT_PATH;
if (httpsKey && httpsCert) {
  try {
    const fs = require('fs');
    const key = fs.readFileSync(httpsKey);
    const cert = fs.readFileSync(httpsCert);
    server = https.createServer({ key, cert }, app);
    console.log('HTTPS server configured');
  } catch (err) {
    console.warn('Failed to create HTTPS server, falling back to HTTP:', err);
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

try {
  const { Server } = require('socket.io');
  socketManager = require('./utils/socketManager');
  notificationsController = require('./controllers/notificationsController');
  const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });
  socketManager.init(io);
  // log socket connections for debugging
  io.on('connect', (socket) => {
    console.log('socket connected', socket.id, socket.handshake && socket.handshake.query);
  });
} catch (e) {
  // if socket.io not installed, fall back to normal http server
  server = http.createServer(app);
  try { notificationsController = require('./controllers/notificationsController'); } catch (err) { notificationsController = null; }
  console.warn('socket.io not available, realtime sockets disabled');
}

function logNetworkInterfaces() {
  try {
    const nets = os.networkInterfaces();
    let primaryAddress = null;
    
    Object.keys(nets).forEach((name) => {
      const iface = nets[name] || [];
      iface.forEach((info) => {
        if (info.internal) return;
        if (info.family === 'IPv4' && !primaryAddress) {
          primaryAddress = info.address;
        }
      });
    });
    
    if (primaryAddress) {
      console.log(`🌐 Server: http://${primaryAddress}:${PORT}`);
      console.log(`🏠 Local: http://localhost:${PORT}`);
    } else {
      console.log(`🚀 Server running on port ${PORT}`);
    }
  } catch (err) {
    console.log(`🚀 Server running on port ${PORT}`);
  }
}

server.listen(PORT, HOST, () => {
  console.log(`🚀 Backend server started`);
  logNetworkInterfaces();
  // Optionally run ad generator on startup and at interval
  try {
    const enableGen = process.env.ENABLE_AD_GENERATOR || 'true';
    if (enableGen === 'true' || enableGen === '1') {
      const generator = require('./scripts/generateAds');
      // run once on startup (non-blocking) and log
      (async () => {
        try {
          await generator.generateAndPersistAds();
          console.log('✅ Ads generated');
        } catch (e) {
          appendLog('generateAds', 'startup', `error: ${e.message || e}`);
          sendAlert({ source: 'generateAds', when: 'startup', error: e });
          console.error('❌ Ads generation failed:', e.message);
        }
      })();
      // schedule periodic generation (every AD_GENERATOR_INTERVAL_MIN minutes)
      const intervalMin = parseInt(process.env.AD_GENERATOR_INTERVAL_MIN || '15', 10);
      setInterval(async () => {
        try {
          await generator.generateAndPersistAds();
          console.log('✅ Ads refreshed');
        } catch (e) {
          appendLog('generateAds', 'interval', `error: ${e.message || e}`);
          sendAlert({ source: 'generateAds', when: 'interval', error: e });
          console.error('❌ Ads refresh failed:', e.message);
        }
      }, Math.max(1, intervalMin) * 60 * 1000);
    }
  } catch (e) {
    console.error('ad generator setup error', e);
    appendLog('generateAds', 'setup', `error: ${e.message || e}`);
    sendAlert({ source: 'generateAds', when: 'setup', error: e });
  }
  // start background scheduler to publish scheduled content
  try {
    const contentFile = path.join(__dirname, 'data', 'content.json');
    const notifFile = path.join(__dirname, 'data', 'notifications.json');
    const scanAndPublish = () => {
      try {
        let items = [];
        try { items = JSON.parse(fs.readFileSync(contentFile, 'utf8') || '[]'); } catch (e) { items = []; }
        let notifs = [];
        try { notifs = JSON.parse(fs.readFileSync(notifFile, 'utf8') || '[]'); } catch (e) { notifs = []; }
        const now = new Date();
        items.forEach((item) => {
          try {
            if (!item || !item.published) return;
            // determine if content is within display interval
            let within = true;
            if (item.startAt) {
              const s = new Date(item.startAt);
              if (now < s) within = false;
            }
            if (item.endAt) {
              const e = new Date(item.endAt);
              if (now > e) within = false;
            }
            if (!within) return;
            const exists = notifs.find(n => String(n.contentId) === String(item.id));
            if (exists) return; // already created
            const notif = {
              id: item.id,
              type: 'content',
              contentId: item.id,
              title: item.title,
              body: item.body || '',
              startAt: item.startAt || null,
              endAt: item.endAt || null,
              imageUrl: item.imageUrl || null,
              caption: item.caption || null,
              pinned: !!item.pinned,
              createdAt: new Date().toISOString()
            };
            try {
              if (notificationsController && notificationsController.create) notificationsController.create(notif);
            } catch (e) { appendLog('scheduler', 'create-notif-error', e.message || String(e)); }
            try { if (socketManager && socketManager.emitToAll) socketManager.emitToAll('notification', notif); } catch (e) {}
            appendLog('scheduler', 'publish', `notification created for content ${item.id}`);
          } catch (e) { appendLog('scheduler', 'item-loop-error', e.message || String(e)); }
        });
        // second pass: check for near-end reminders (30 minutes before end)
        items.forEach((item) => {
          try {
            if (!item || !item.published || !item.endAt) return;
            const end = new Date(item.endAt);
            const msRemaining = end - now;
            const minutesRemaining = Math.round(msRemaining / 60000);
            if (minutesRemaining <= 0 || minutesRemaining > 30) return;
            // check if a reminder already exists for this content
            const existingReminder = notifs.find(n => String(n.contentId) === String(item.id) && n.type === 'content_reminder');
            if (existingReminder) return;
            const reminder = {
              id: `${item.id}-reminder`,
              type: 'content_reminder',
              contentId: item.id,
              title: item.title,
              body: item.caption || item.body || '',
              minutesRemaining,
              imageUrl: item.imageUrl || null,
              createdAt: new Date().toISOString()
            };
            try { if (notificationsController && notificationsController.create) notificationsController.create(reminder); } catch (e) { appendLog('scheduler', 'create-reminder-error', e.message || String(e)); }
            try { if (socketManager && socketManager.emitToAll) socketManager.emitToAll('notification_reminder', reminder); } catch (e) {}
            // mark content as reminderSent to avoid duplicate reminders
            try {
              const idx = items.findIndex(i => String(i.id) === String(item.id));
              if (idx !== -1) {
                items[idx].reminderSent = true;
                fs.writeFileSync(contentFile, JSON.stringify(items, null, 2), 'utf8');
              }
            } catch (e) { appendLog('scheduler', 'mark-reminderSent-error', e.message || String(e)); }
            appendLog('scheduler', 'reminder', `reminder created for ${item.id} (${minutesRemaining}m left)`);
          } catch (e) { appendLog('scheduler', 'reminder-loop-error', e.message || String(e)); }
        });
      } catch (e) { appendLog('scheduler', 'scan-error', e.message || String(e)); }
    };
    // run once at startup, then every minute
    setTimeout(scanAndPublish, 2000);
    setInterval(scanAndPublish, 60 * 1000);
  } catch (e) {
    console.error('scheduler setup error', e);
    appendLog('scheduler', 'setup', `error: ${e.message || e}`);
  }
});

// Basic process-level handlers to log errors and avoid silent crashes during development
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  appendLog('process', 'uncaughtException', `${err && err.message ? err.message : String(err)}`);
  sendAlert({ source: 'process', when: 'uncaughtException', error: err });
});

function appendLog(topic, when, message) {
  try {
    const p = path.join(logsDir, 'scheduler.log');
    const line = `${new Date().toISOString()} [${topic}] (${when}) ${message}\n`;
    fs.appendFileSync(p, line);
  } catch (e) {
    console.error('appendLog error', e);
  }
}

async function sendAlert(payload) {
  try {
    const webhook = process.env.ALERT_WEBHOOK;
    if (!webhook) return;
    // prefer global fetch (Node 18+)
    if (typeof fetch === 'function') {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ts: new Date().toISOString(), payload })
      });
    } else {
      // fallback: use https.request
      const https = require('https');
      const u = new URL(webhook);
      const data = JSON.stringify({ ts: new Date().toISOString(), payload });
      const opts = {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      };
      const req = https.request(opts, (res) => { res.on('data', () => {}); });
      req.on('error', () => {});
      req.write(data);
      req.end();
    }
  } catch (e) {
    console.error('sendAlert error', e);
  }
}
