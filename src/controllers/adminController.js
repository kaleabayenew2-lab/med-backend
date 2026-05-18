const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const User = require('../models/user');
const Facility = require('../models/facility');
const { decrypt } = require('../utils/encryption');

const statsFile = path.join(__dirname, '..', 'data', 'stats.json');

function readStats() {
  try {
    const raw = fs.readFileSync(statsFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      total_users: 0,
      app_users: 0,
      profile_creators: 0,
      agent_logins: 0,
      feedbacks_sent: 0,
      total_served: 0
    };
  }
}

exports.getStats = (req, res) => {
  const stats = readStats();
  res.json(stats);
};

// GET /api/admin/all
// Returns consolidated admin data: stats, counts and small samples of users, facilities, feedbacks and notifications
exports.getAll = async (req, res) => {
  try {
    const stats = readStats();

    // gather counts and quick samples
    const totalUsers = await User.count();
    const usersSample = await User.findAll({
      attributes: ['fullName', 'email', 'phone', 'telegramChatId', 'telegramUsername'],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const totalFacilities = await Facility.count();
    const facilitiesSample = await Facility.findAll({
      attributes: ['name', 'type', 'address', 'phone', 'isEmergency'],
      order: [['updatedAt', 'DESC']],
      limit: 50
    });

    const usersSampleDecrypted = usersSample.map(u => ({ ...u.toJSON(), email: decrypt(u.email), phone: decrypt(u.phone) }));
    const facilitiesSampleDecrypted = facilitiesSample.map(f => ({ ...f.toJSON(), phone: decrypt(f.phone) }));

    // read feedbacks and notifications from data files (if present)
    let feedbacks = [];
    let notifications = [];
    try {
      const fbRaw = fs.readFileSync(path.join(__dirname, '..', 'data', 'feedbacks.json'), 'utf8');
      feedbacks = JSON.parse(fbRaw);
    } catch (e) { /* ignore */ }
    try {
      const nRaw = fs.readFileSync(path.join(__dirname, '..', 'data', 'notifications.json'), 'utf8');
      notifications = JSON.parse(nRaw);
    } catch (e) { /* ignore */ }

    return res.json({
      stats,
      totals: { users: totalUsers, facilities: totalFacilities, feedbacks: feedbacks.length, notifications: notifications.length },
      users: usersSampleDecrypted,
      facilities: facilitiesSampleDecrypted,
      feedbacks: feedbacks.slice(-50).reverse(),
      notifications: notifications.slice(-50).reverse()
    });
  } catch (err) {
    console.error('admin getAll error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const settingsFile = path.join(__dirname, '..', 'data', 'settings.json');

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      appName: 'FindMed',
      mapProvider: 'google',
      defaultLanguage: 'en',
      maintenanceMode: false,
      backupIntervalDays: 7,
      // feature flags / toggles
      darkMode: false,
      multiLanguage: false,
      realtimeUpdates: true,
      // analytics toggles
      enableAnalytics: false,
      userTracking: false,
      pageViews: false,
      behaviorTracking: false
    };
  }
}

function writeSettings(obj) {
  fs.writeFileSync(settingsFile, JSON.stringify(obj, null, 2), 'utf8');
}

exports.getSettings = (req, res) => {
  const s = readSettings();
  res.json(s);
};

// expose utility for other modules (e.g. maintenance middleware)
exports.readSettings = readSettings;

exports.updateSettings = (req, res) => {
  try {
    const updates = req.body || {};
    const current = readSettings();
    const merged = Object.assign({}, current, updates);
    writeSettings(merged);
    try {
      if (socketManager) {
        if (socketManager.emitToAdmins) {
          socketManager.emitToAdmins('settings_updated', merged);
        }
        if (socketManager.emitToAll) {
          socketManager.emitToAll('settings_updated', merged);
        }
      }
    } catch (e) {}
    res.json(merged);
  } catch (err) {
    console.error('updateSettings error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/emergencies
exports.getEmergencies = async (req, res) => {
  try {
    const facilities = await Facility.find({ isEmergency: true }, 'name type address phone location updatedAt');
    const decryptedFacilities = facilities.map(f => ({ ...f.toObject(), phone: decrypt(f.phone) }));
    res.json({ facilities: decryptedFacilities });
  } catch (err) {
    console.error('getEmergencies error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/emergencies/bulk
// body: { ids: string[], isEmergency: boolean }
exports.bulkUpdateEmergencies = async (req, res) => {
  try {
    const { ids, isEmergency } = req.body || {};
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids array required' });
    await Facility.updateMany({ _id: { $in: ids } }, { $set: { isEmergency: !!isEmergency } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('bulkUpdateEmergencies error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Content management (file-backed)
const contentFile = path.join(__dirname, '..', 'data', 'content.json');

let socketManager;
try { socketManager = require('../utils/socketManager'); } catch (e) { socketManager = null; }
const notifications = require('./notificationsController');

function readContent() {
  try {
    const raw = fs.readFileSync(contentFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeContent(arr) {
  fs.writeFileSync(contentFile, JSON.stringify(arr, null, 2), 'utf8');
}

// GET /api/admin/content
exports.getContent = (req, res) => {
  try {
    const items = readContent();
    // cleanup any notifications that refer to content items no longer present
    try {
      const keepIds = items.map(i => String(i.id));
      try { notifications.removeNotIn(keepIds); } catch (e) {}
      try { if (socketManager && socketManager.emitToAll) {
        // re-read notifications file and emit deletions to sockets if needed
        // notifications.removeNotIn already sent SSE; to sync socket clients we will emit a simple refresh event
        socketManager.emitToAll('notification_cleanup', { keep: keepIds });
      } } catch (e) {}
    } catch (e) {}
    items.sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
    return res.json({ items });
  } catch (err) {
    console.error('getContent error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/content
exports.createContent = (req, res) => {
  try {
    const { type, title, body, language, meta, published, startAt, endAt, imageUrl, caption, pinned } = req.body || {};
    if (!type || !title) return res.status(400).json({ message: 'type and title required' });
    const arr = readContent();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const item = { id, type, title, body: body || '', language: language || 'en', meta: meta || {}, published: !!published, startAt: startAt || null, endAt: endAt || null, imageUrl: imageUrl || null, caption: caption || null, pinned: !!pinned, reminderSent: false, createdAt: now, updatedAt: now };
    arr.push(item);
    writeContent(arr);
    // create a notification for mobile clients and broadcast
    try {
        // Only notify clients if the content is published
        if (item.published) {
          // check display interval if provided
          const nowTs = new Date();
          let within = true;
          try {
            if (item.startAt) {
              const s = new Date(item.startAt);
              if (nowTs < s) within = false;
            }
            if (item.endAt) {
              const e = new Date(item.endAt);
              if (nowTs > e) within = false;
            }
          } catch (e) { /* ignore parse errors and default to within=false? keep within as true */ }

          if (within) {
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
                createdAt: item.createdAt || new Date().toISOString()
              };
            try { notifications.create(notif); } catch (e) {}
            try { if (socketManager && socketManager.emitToAll) socketManager.emitToAll('notification', notif); } catch (e) {}
          }
        }
    } catch (e) {}
    return res.status(201).json({ item });
  } catch (err) {
    console.error('createContent error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/admin/content/:id
exports.updateContent = (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body || {};
    const arr = readContent();
    const idx = arr.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const prev = arr[idx];
    const item = Object.assign({}, prev, updates, { updatedAt: new Date().toISOString() });
    // If endAt changed or published flag toggled, reset reminderSent so scheduler may re-create a reminder
    try {
      if ((prev.endAt || null) !== (item.endAt || null)) {
        item.reminderSent = false;
      }
      if ((!!prev.published) !== (!!item.published)) {
        item.reminderSent = false;
      }
    } catch (e) {}
    arr[idx] = item;
    writeContent(arr);
    // If content changed from unpublished to published, create notification and broadcast
    try {
      const wasPublished = !!prev.published;
      const nowPublished = !!item.published;
      if (!wasPublished && nowPublished) {
        // check interval
        const nowTs = new Date();
        let within = true;
        try {
          if (item.startAt) {
            const s = new Date(item.startAt);
            if (nowTs < s) within = false;
          }
          if (item.endAt) {
            const e = new Date(item.endAt);
            if (nowTs > e) within = false;
          }
        } catch (e) {}

        if (within) {
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
            createdAt: item.updatedAt || new Date().toISOString()
          };
          try { notifications.create(notif); } catch (e) {}
          try { if (socketManager && socketManager.emitToAll) socketManager.emitToAll('notification', notif); } catch (e) {}
        }
      }
      else if (wasPublished && nowPublished) {
        // already published, but updated -> broadcast updated notification to clients
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
          updatedAt: item.updatedAt || new Date().toISOString()
        };
        try { // update notifications store: remove old entries for this content and add updated one
          const removed = notifications.removeByContentId(item.id);
          try { notifications.create(notif); } catch(e){}
        } catch(e){}
        try { if (socketManager && socketManager.emitToAll) socketManager.emitToAll('notification_updated', notif); } catch (e) {}
      }
    } catch (e) {}

    return res.json({ item });
  } catch (err) {
    console.error('updateContent error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/admin/content/:id
exports.deleteContent = (req, res) => {
  try {
    const id = req.params.id;
    let arr = readContent();
    const idx = arr.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const removedItem = arr.splice(idx, 1)[0];
    writeContent(arr);
    let removedNotifs = [];
    try {
      // remove any notifications associated with this content and broadcast deletions
      removedNotifs = notifications.removeByContentId(removedItem.id) || [];
      try { if (socketManager && socketManager.emitToAll) {
        removedNotifs.forEach(n => {
          try { socketManager.emitToAll('notification_deleted', n); } catch (e) {}
        });
      } } catch (e) {}
    } catch (e) {}
    return res.json({ ok: true, removedNotifications: removedNotifs });
  } catch (err) {
    console.error('deleteContent error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/admin/generate-ads
exports.generateAds = async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    const generator = require('../scripts/generateAds');
    const loc = (lat !== undefined && lng !== undefined) ? { lat: Number(lat), lng: Number(lng) } : undefined;
    const result = await generator.generateAndPersistAds({ location: loc });
    return res.json({ created: result.length, items: result });
  } catch (err) {
    console.error('generateAds error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/reports/most-viewed
exports.getMostViewed = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const items = await Facility.findAll({
      order: [['viewsTotal', 'DESC']],
      limit: limit,
      attributes: ['name', 'type', 'address', 'phone', 'viewsTotal', 'averageRating', 'ratingCount']
    });
    const decryptedItems = items.map(f => ({ ...f.toJSON(), phone: decrypt(f.phone) }));
    return res.json({ items: decryptedItems });
  } catch (err) {
    console.error('getMostViewed error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/admin/reports/top-rated
exports.getTopRated = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const facilities = await Facility.findAll();
    const items = facilities
      .filter(f => f.ratingCount > 0)
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.ratingCount - a.ratingCount;
      })
      .slice(0, limit)
      .map(f => ({
        name: f.name,
        type: f.type,
        address: f.address,
        phone: decrypt(f.phone),
        viewsTotal: f.viewsTotal,
        averageRating: f.averageRating,
        ratingCount: f.ratingCount
      }));
    return res.json({ items });
  } catch (err) {
    console.error('getTopRated error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/admin/facilities - Remove all facilities
exports.removeAllFacilities = async (req, res) => {
  try {
    console.log('🗑️  ADMIN: Removing all facilities...');
    
    // Get count before deletion
    const count = await Facility.count();
    console.log(`📊 ADMIN: Found ${count} facilities to delete`);
    
    if (count === 0) {
      return res.json({ 
        success: true, 
        message: 'No facilities to remove',
        deletedCount: 0 
      });
    }
    
    // Delete all facilities
    const deletedCount = await Facility.destroy({ where: {} });
    
    console.log(`✅ ADMIN: Successfully deleted ${deletedCount} facilities`);
    
    return res.json({ 
      success: true, 
      message: `Successfully removed ${deletedCount} facilities`,
      deletedCount: deletedCount 
    });
  } catch (err) {
    console.error('❌ ADMIN: Error removing all facilities:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to remove facilities',
      error: err.message 
    });
  }
};
