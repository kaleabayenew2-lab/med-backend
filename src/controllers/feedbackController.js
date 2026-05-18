const path = require('path');
const fs = require('fs');

const feedbackFile = path.join(__dirname, '..', 'data', 'feedbacks.json');
const statsFile = path.join(__dirname, '..', 'data', 'stats.json');
const notifController = require('./notificationsController');
let socketManager = null;
try { socketManager = require('../utils/socketManager'); } catch (e) { socketManager = null; }
let FeedbackModel = null;
try { FeedbackModel = require('../models/feedback'); } catch (e) { FeedbackModel = null; }
const notifFile = path.join(__dirname, '..', 'data', 'notifications.json');
const UserModel = (() => { try { return require('../models/user'); } catch (e) { return null; } })();

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

exports.submit = (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!message || message.trim().length < 5) return res.status(400).json({ error: 'Message too short' });

    const feedbacks = readJson(feedbackFile, []);
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').toString();
    const entry = {
      id: Date.now().toString(),
      name: name || '',
      email: email || '',
      message: message.trim(),
      attachments: req.body && req.body.attachments ? req.body.attachments : [],
      createdAt: new Date().toISOString(),
      sourceIp: ip,
      replied: false,
      reply: null,
      replyMethod: null,
    };
    feedbacks.push(entry);
    writeJson(feedbackFile, feedbacks);

    // increment stats
    const stats = readJson(statsFile, { feedbacks_sent: 0 });
    stats.feedbacks_sent = (stats.feedbacks_sent || 0) + 1;
    writeJson(statsFile, stats);

    // Create a notification so admin UIs receive realtime alerts (feedback type)
    try {
      const notif = {
        id: Date.now().toString(),
        type: 'feedback',
        feedbackId: entry.id,
        from: entry.email || entry.name || entry.sourceIp || 'anonymous',
        fromName: entry.name || entry.email || entry.sourceIp || 'Anonymous',
        text: entry.message,
        attachments: entry.attachments || [],
        createdAt: new Date().toISOString(),
        read: false,
      };
      // persist and broadcast via SSE
      try { notifController.create(notif); } catch (e) { console.error('notif create failed', e); }

      // also emit via socket manager if available (best-effort)
      try {
        if (socketManager && socketManager.emitToAll) {
          socketManager.emitToAll('notification', notif);
        }
      } catch (e) { console.error('socket emit failed', e); }
    } catch (e) { console.error('feedback submit: notification create failed', e); }

    return res.status(201).json({ ok: true, entry });
  } catch (err) {
    console.error('submit feedback error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.list = (req, res) => {
  try {
    const feedbacks = readJson(feedbackFile, []);
    // return in reverse chronological order
    feedbacks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return res.json({ ok: true, feedbacks });
  } catch (err) {
    console.error('list feedbacks error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.get = (req, res) => {
  try {
    const id = req.params.id;
    const feedbacks = readJson(feedbackFile, []);
    const entry = feedbacks.find(f => f.id === id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, entry });
  } catch (err) {
    console.error('get feedback error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// admin reply: { reply: string, method: string }
exports.reply = async (req, res) => {
  try {
    const id = req.params.id;
    const { reply, method } = req.body || {};
    if (!reply || reply.trim().length === 0) return res.status(400).json({ error: 'Reply required' });
    const feedbacks = readJson(feedbackFile, []);
    const idx = feedbacks.findIndex(f => f.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    feedbacks[idx].replied = true;
    feedbacks[idx].reply = reply.trim();
    feedbacks[idx].replyMethod = method || 'admin';
    feedbacks[idx].repliedAt = new Date().toISOString();
    writeJson(feedbackFile, feedbacks);

    // Optionally increment a stat for replies
    const stats = readJson(statsFile, { feedbacks_sent: 0, feedbacks_replied: 0 });
    stats.feedbacks_replied = (stats.feedbacks_replied || 0) + 1;
    writeJson(statsFile, stats);

    // create notification for the feedback author (by email if available, else by IP)
    try {
      const notif = {
        id: Date.now().toString(),
        feedbackId: id,
        targetEmail: feedbacks[idx].email || null,
        targetIp: feedbacks[idx].sourceIp || null,
        message: reply.trim(),
        attachments: feedbacks[idx].attachments || [],
        createdAt: new Date().toISOString(),
        read: false,
      };
      notifController.create(notif);
      try {
        // Try to resolve the feedback author to a registered user (by email)
        let targetUserId = null;
        if (feedbacks[idx].email && UserModel) {
          try {
            const emailLower = String(feedbacks[idx].email).toLowerCase();
            const u = await UserModel.findOne({ email: emailLower }).select('_id').lean().exec();
            if (u && u._id) targetUserId = String(u._id);
          } catch (ue) {
            console.error('feedbackController: lookup user by email failed', ue);
          }
        }

        if (targetUserId) notif.targetUserId = targetUserId;

        // Emit notification: prefer per-user emit, fall back to broadcast
        if (targetUserId && socketManager && socketManager.emitToUser) {
          socketManager.emitToUser(targetUserId, 'notification', notif);
          console.log('feedbackController: emitted notification to user', targetUserId, notif.id);
        } else if (socketManager && socketManager.emitToAll) {
          socketManager.emitToAll('notification', notif);
          console.log('feedbackController: emitted notification (broadcast)', notif.id);
        }

        // Also emit a chat_message so in-app chat windows receive admin replies (left-aligned)
        try {
          const chatMsg = {
            _id: `fb-${notif.id}`,
            id: `fb-${notif.id}`,
            from: 'admin',
            to: targetUserId || undefined,
            text: reply.trim(),
            attachments: feedbacks[idx].attachments || [],
            createdAt: new Date().toISOString(),
            feedbackId: id,
          };
          if (targetUserId && socketManager && socketManager.emitToUser) {
            socketManager.emitToUser(targetUserId, 'chat_message', chatMsg);
            console.log('feedbackController: emitted chat_message to user', targetUserId, chatMsg.id);
          } else if (socketManager && socketManager.emitToAll) {
            socketManager.emitToAll('chat_message', chatMsg);
            console.log('feedbackController: emitted chat_message (broadcast)', chatMsg.id);
          }
        } catch (e) { console.error('feedbackController: emit chat_message error', e); }
      } catch (e) { console.error('create notification failed', e); }
    } catch (e) { console.error('create notification failed', e); }

    // Persist/update feedback in MongoDB (best-effort)
    if (FeedbackModel) {
      try {
        const doc = {
          id: feedbacks[idx].id,
          name: feedbacks[idx].name || '',
          email: feedbacks[idx].email || '',
          message: feedbacks[idx].message || '',
          createdAt: feedbacks[idx].createdAt ? new Date(feedbacks[idx].createdAt) : new Date(),
          sourceIp: feedbacks[idx].sourceIp || '',
          replied: true,
          reply: feedbacks[idx].reply,
          replyMethod: feedbacks[idx].replyMethod,
          repliedAt: new Date(feedbacks[idx].repliedAt),
        };
        await FeedbackModel.findOneAndUpdate({ id: feedbacks[idx].id }, doc, { upsert: true, new: true, setDefaultsOnInsert: true });
      } catch (e) { console.error('saving feedback to db failed', e); }
    }

    return res.json({ ok: true, entry: feedbacks[idx] });
  } catch (err) {
    console.error('reply feedback error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
