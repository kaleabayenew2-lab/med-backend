const ChatMessage = require('../models/chatMessage');
const jwt = require('jsonwebtoken');
let UserModel = null;
try { UserModel = require('../models/user'); } catch (e) { UserModel = null; }
const notifications = require('./notificationsController');
let socketManager;
try {
  socketManager = require('../utils/socketManager');
} catch (e) {
  socketManager = null;
}
let push;
try { push = require('../utils/pushNotifications'); } catch (e) { push = null; }

// POST /api/chat/messages  { conversationId, from, to, text, attachments }
exports.createMessage = async (req, res) => {
  try {
    const data = req.body || {};
    // allow senderId or deviceId in payload; prefer explicit from, else use senderId
    if (!data.from && !data.senderId && !data.deviceId) return res.status(400).json({ error: 'from (or senderId/deviceId) and text required' });
    if (!data.text) return res.status(400).json({ error: 'text required' });
    // normalize from and meta
    const payload = { ...data };
    payload.meta = payload.meta || {};
    // Attempt to identify sender from Authorization JWT if present
    try {
      const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || null;
      if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
        const token = auth.slice(7).trim();
        try {
          const secret = process.env.JWT_SECRET || 'dev_secret';
          const decoded = jwt.verify(token, secret);
          if (decoded && decoded.id && UserModel) {
            try {
              const u = await UserModel.findById(decoded.id).select('_id fullName email userId').lean().exec();
              if (u && u._id) {
                payload.from = String(u._id);
                payload.meta = payload.meta || {};
                payload.meta.userId = String(u._id);
                payload.meta.fullName = u.fullName || u.email || (u.userId || '');
              }
            } catch (ue) { /* ignore user lookup errors */ }
          }
        } catch (ve) { /* invalid token */ }
      }
    } catch (e) { /* ignore */ }

    // fallback sender id: explicit from, senderId, deviceId, clientId or remote IP
    payload.from = payload.from || payload.senderId || `device:${payload.deviceId || payload.clientId || (req.headers && (req.headers['x-forwarded-for'] || req.connection && req.connection.remoteAddress) || 'unknown')}`;
    if (data.deviceId) payload.meta.deviceId = data.deviceId;
    if (data.clientId) payload.meta.clientId = data.clientId;
    if (data.senderId) payload.meta.senderId = data.senderId;
    if (data.userAgent) payload.meta.userAgent = data.userAgent;
    // Ensure admin routing and conversation grouping for client messages
    try {
      const isAdminSender = String(payload.from).toLowerCase() === 'admin';
      // If sender is not admin and no explicit recipient, route to admin
      if (!isAdminSender && !payload.to) {
        payload.to = 'admin';
      }
      // If no conversationId provided, use sender id as conversationId for user-originated messages
      if (!payload.conversationId) {
        if (!isAdminSender && payload.from) payload.conversationId = String(payload.from);
        else if (payload.meta && (payload.meta.userId || payload.meta.senderId)) payload.conversationId = payload.meta.userId || payload.meta.senderId;
      }
    } catch (e) { /* ignore */ }
    // If sender provided meta.userId (e.g., assistant/bot payload), set recipient `to` so user queries will include it
    try {
      if (!payload.to && payload.meta && (payload.meta.userId || payload.meta.recipientId)) {
        payload.to = payload.meta.userId || payload.meta.recipientId;
      }
    } catch (e) {}
    const msg = await ChatMessage.create(payload);
    console.log('chat.createMessage: saved', { id: msg.id, from: msg.from, to: msg.to, conversationId: msg.conversationId });
    // create a simple notification for admin/mobile clients
    try {
      const notif = {
        id: msg.id.toString(),
        type: 'chat_message',
        conversationId: msg.conversationId,
        from: msg.from,
        text: msg.text,
        meta: msg.meta || {},
        createdAt: msg.createdAt || new Date().toISOString()
      };
      // persist and broadcast (SSE)
      try {
        notifications.create(notif);
        if (notifications && notifications._internal && notifications._internal.sseClients) {
          console.log('chat.createMessage: notifications.sseClients=', notifications._internal.sseClients.size);
        }
      } catch (e) { console.warn('notifications.create failed', e); }
      // send push to recipient if available
      try {
        if (push && msg.to) {
          const toIdStr = String(msg.to);
          // don't attempt push for the special 'admin' routing marker
          if (toIdStr && toIdStr.toLowerCase() !== 'admin') {
            push.sendPushToUserId(toIdStr, 'New message', msg.text || '', { conversationId: msg.conversationId, from: msg.from });
          }
        }
      } catch (e) { console.warn('push send failed', e); }
      // also emit to connected sockets (mobile/admin) when available
      try {
        if (socketManager) {
          console.log('chat.createMessage: emitting to sockets (admins and user if present)');
          // send to admins
          socketManager.emitToAdmins('chat_message', notif);

          // If message has explicit recipient, send to that user
          if (msg.to) {
            try { socketManager.emitToUser(msg.to.toString(), 'chat_message', notif); } catch (e) {}
          } else if (msg.conversationId) {
            // attempt to resolve participants in this conversation and notify them
            try {
              const convId = msg.conversationId;
              // collect distinct user ids from 'from' and 'to' fields in this conversation
              const froms = await ChatMessage.distinct('from', { conversationId: convId });
              const tos = await ChatMessage.distinct('to', { conversationId: convId });
              const participants = new Set();
              (froms || []).forEach(f => { if (f) participants.add(String(f)); });
              (tos || []).forEach(t => { if (t) participants.add(String(t)); });
              // emit to each participant except 'admin'
              participants.forEach((p) => {
                try {
                  const pid = String(p);
                  if (pid === 'admin' || pid.toLowerCase() === 'admin') return;
                  socketManager.emitToUser(pid, 'chat_message', notif);
                } catch (e) {}
              });
            } catch (e) {
              console.warn('chat.createMessage: failed to notify conversation participants', e);
            }
          }
        }
      } catch (e) {
        console.warn('socket emit failed', e);
      }
    } catch (e) {
      console.warn('notify broadcast failed', e);
    }
    return res.status(201).json(msg);
  } catch (err) {
    console.error('chat create error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/chat/messages?userId=...  (messages where from==userId or to==userId)
exports.listByUser = async (req, res) => {
    try {
    const { userId, limit = 200 } = req.query;
    const lim = parseInt(limit, 10) || 200;
        
    if (!userId) {
      // return recent messages across system (most recent `limit` messages)
      const msgs = await ChatMessage.findAll();
      const limited = msgs.slice(-lim);
      // return in chronological order
      return res.json(limited.reverse());
    }
    // include messages where from/to match userId
    const msgs = await ChatMessage.findByUser(userId, lim);
    return res.json(msgs.reverse());
  } catch (err) {
    console.error('chat list error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/chat/stats
exports.getStats = async (req, res) => {
  try {
    // basic stats: active chats (unique conversationIds), messages last 24h, avg response time (naive)
    const msgs = await ChatMessage.findAll({ 
      order: [['createdAt', 'ASC']], 
      limit: 10000 
    });
    const convSet = new Set();
    let messagesLast24h = 0;
    const now = Date.now();
    msgs.forEach((m) => {
      const cid = m.conversationId || m.from || m.to || 'unknown';
      convSet.add(String(cid));
      if (m.createdAt && (now - new Date(m.createdAt).getTime()) <= 24 * 3600 * 1000) messagesLast24h += 1;
    });
    // naive avg response: time between user->admin pairs
    const deltas = [];
    const byConv = {};
    msgs.forEach((m) => {
      const k = m.conversationId || m.from || m.to || 'unknown';
      byConv[k] = byConv[k] || [];
      byConv[k].push(m);
    });
    Object.values(byConv).forEach((arr) => {
      arr.sort((a, b) => new Date(a.createdAt || Date.now()).getTime() - new Date(b.createdAt || Date.now()).getTime());
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i+1];
        if (a.from !== 'admin' && b.from === 'admin' && a.createdAt && b.createdAt) {
          deltas.push(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      }
    });
    const avgResponseTime = deltas.length ? Math.round(deltas.reduce((s, n) => s + n, 0) / deltas.length / 1000) : null;
    return res.json({ activeChats: convSet.size, messagesLast24h, avgResponseTime });
  } catch (e) {
    console.error('getStats error', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/chat/conversation/:id
exports.getConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const msgs = await ChatMessage.findAll({ 
      where: { conversationId: id },
      order: [['createdAt', 'ASC']] 
    });
    return res.json(msgs);
  } catch (err) {
    console.error('chat convo error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/chat/conversation/:id/read to mark read
exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    await ChatMessage.update({ read: true }, { where: { conversationId: id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('chat markRead error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Conversation status persistence (simple JSON store)
const path = require('path');
const fs = require('fs');
const statusFile = path.join(__dirname, '..', 'data', 'chatStatuses.json');

function readStatuses() {
  try { return JSON.parse(fs.readFileSync(statusFile, 'utf8') || '{}'); } catch (e) { return {}; }
}

function writeStatuses(obj) {
  try { fs.writeFileSync(statusFile, JSON.stringify(obj, null, 2), 'utf8'); return true; } catch (e) { return false; }
}

// GET /api/chat/conversations/statuses
exports.listStatuses = async (req, res) => {
  try {
    const obj = readStatuses();
    return res.json({ ok: true, statuses: obj });
  } catch (e) {
    console.error('listStatuses', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/chat/conversation/:id/status  { status: 'open'|'closed'|'pending' }
exports.setStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body || {};
    if (!id || !status) return res.status(400).json({ error: 'id and status required' });
    const obj = readStatuses();
    obj[id] = { status, updatedAt: new Date().toISOString() };
    writeStatuses(obj);
    return res.json({ ok: true, id, status: obj[id] });
  } catch (e) {
    console.error('setStatus', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/chat/messages/:id/delete
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id required' });
    const msg = await ChatMessage.findById(id);
    if (!msg) return res.status(404).json({ error: 'not found' });
    await ChatMessage.deleteOne({ _id: id });
    // notify admins and involved users (from/to)
    try {
      if (socketManager) {
        socketManager.emitToAdmins('message_deleted', { id, conversationId: msg.conversationId });
        // emit to sender
        if (msg.from) socketManager.emitToUser(String(msg.from), 'message_deleted', { id, conversationId: msg.conversationId });
        // emit to recipient
        if (msg.to) socketManager.emitToUser(String(msg.to), 'message_deleted', { id, conversationId: msg.conversationId });
      }
    } catch (e) { console.warn('emit message_deleted failed', e); }
    return res.json({ ok: true });
  } catch (e) {
    console.error('deleteMessage', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/chat/messages/:id/edit  { text }
exports.editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};
    if (!id || typeof text === 'undefined') return res.status(400).json({ error: 'id and text required' });
    const msg = await ChatMessage.findByIdAndUpdate(id, { $set: { text, edited: true } }, { new: true });
    try { if (socketManager) socketManager.emitToAdmins('message_edited', msg); } catch (e) {}
    return res.json(msg);
  } catch (e) {
    console.error('editMessage', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Simple block list persistence
const blockedFile = path.join(__dirname, '..', 'data', 'blockedUsers.json');
function readBlocked() { try { return JSON.parse(fs.readFileSync(blockedFile, 'utf8') || '[]'); } catch (e) { return []; } }
function writeBlocked(arr) { try { fs.writeFileSync(blockedFile, JSON.stringify(arr, null, 2), 'utf8'); return true; } catch (e) { return false; } }

// POST /api/chat/user/:id/block
exports.blockUser = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const arr = readBlocked();
    if (!arr.includes(id)) arr.push(id);
    writeBlocked(arr);
    try { if (socketManager) socketManager.emitToAdmins('user_blocked', { id }); } catch (e) {}
    return res.json({ ok: true, id });
  } catch (e) { console.error('blockUser', e); return res.status(500).json({ error: 'Server error' }); }
};

// POST /api/chat/conversation/:id/flag
const flaggedFile = path.join(__dirname, '..', 'data', 'flaggedConversations.json');
function readFlagged() { try { return JSON.parse(fs.readFileSync(flaggedFile, 'utf8') || '[]'); } catch (e) { return []; } }
function writeFlagged(arr) { try { fs.writeFileSync(flaggedFile, JSON.stringify(arr, null, 2), 'utf8'); return true; } catch (e) { return false; } }

exports.flagConversation = async (req, res) => {
  try {
    const id = req.params.id;
    const { reason } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const arr = readFlagged();
    arr.push({ id, reason: reason || null, at: new Date().toISOString() });
    writeFlagged(arr);
    try { if (socketManager) socketManager.emitToAdmins('conversation_flagged', { id, reason }); } catch (e) {}
    return res.json({ ok: true });
  } catch (e) { console.error('flagConversation', e); return res.status(500).json({ error: 'Server error' }); }
};

// POST /api/chat/typing  { conversationId, from, typing: true/false }
exports.typing = async (req, res) => {
  try {
    const payload = req.body || {};
    // broadcast to admins and target user
    try { if (socketManager) { socketManager.emitToAdmins('typing', payload); if (payload.to) socketManager.emitToUser(payload.to, 'typing', payload); } } catch (e) {}
    return res.json({ ok: true });
  } catch (e) { console.error('typing', e); return res.status(500).json({ error: 'Server error' }); }
};

// POST /api/chat/presence  { userId, status }
exports.presence = async (req, res) => {
  try {
    const { userId, status } = req.body || {};
    if (!userId || !status) return res.status(400).json({ error: 'userId and status required' });
    try { if (socketManager) socketManager.emitToAdmins('presence', { userId, status }); } catch (e) {}
    return res.json({ ok: true });
  } catch (e) { console.error('presence', e); return res.status(500).json({ error: 'Server error' }); }
};

// POST /api/chat/messages/:id/read
exports.markMessageRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id required' });
    await ChatMessage.updateOne({ _id: id }, { $set: { read: true } });
    try { if (socketManager) socketManager.emitToAdmins('message_read', { id }); } catch (e) {}
    return res.json({ ok: true });
  } catch (e) { console.error('markMessageRead', e); return res.status(500).json({ error: 'Server error' }); }
};

// POST /api/chat/conversation/:id/clear
exports.clearConversation = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    // find affected users before deletion
    const msgs = await ChatMessage.find({ conversationId: id }, 'from to');
    const userIds = new Set();
    msgs.forEach((m) => { if (m.from) userIds.add(String(m.from)); if (m.to) userIds.add(String(m.to)); });
    await ChatMessage.deleteMany({ conversationId: id });
    try {
      if (socketManager) {
        socketManager.emitToAdmins('conversation_cleared', { id });
        userIds.forEach(uid => socketManager.emitToUser(uid, 'conversation_cleared', { id }));
      }
    } catch (e) { console.warn('emit conversation_cleared failed', e); }
    return res.json({ ok: true });
  } catch (e) { console.error('clearConversation', e); return res.status(500).json({ error: 'Server error' }); }
};
