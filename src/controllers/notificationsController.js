const path = require('path');
const fs = require('fs');

const notifFile = path.join(__dirname, '..', 'data', 'notifications.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

// simple in-memory SSE clients
const sseClients = new Set();

function sendSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  try {
    // log number of SSE clients for debugging
    try { console.log('notifications.sendSSE: event=', event, 'clients=', sseClients.size); } catch (e) {}
    sseClients.forEach((res) => {
      try {
        res.write(payload);
      } catch (e) {
        // ignore
      }
    });
  } catch (e) {
    console.warn('sendSSE error', e);
  }
}

exports.stream = (req, res) => {
  // SSE headers
  const origin = req.headers.origin || process.env.FRONTEND_ORIGIN || '*';
  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true'
  });
  // send a comment to establish the stream and help some proxies
  try { res.write(`: connected\n\n`); } catch (e) {}
  // log connection for debugging
  try { console.log('SSE stream connected from origin=', origin, 'ip=', req.ip || req.connection.remoteAddress, 'currentClients=', sseClients.size); } catch (e) {}
  sseClients.add(res);
  req.on('close', () => {
    try { console.log('SSE client disconnected, remaining=', sseClients.size - 1); } catch (e) {}
    sseClients.delete(res);
  });
};

exports.list = (req, res) => {
  try {
    const { email, feedbackId, ip } = req.query || {};
    const notifs = readJson(notifFile, []);
    let list = notifs;
    if (email) list = list.filter(n => n.targetEmail === email);
    if (feedbackId) list = list.filter(n => n.feedbackId === feedbackId);
    if (ip) list = list.filter(n => n.targetIp === ip);
    list.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    return res.json({ ok: true, notifications: list });
  } catch (err) {
    console.error('list notifications', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.markRead = (req, res) => {
  try {
    const id = req.params.id;
    const notifs = readJson(notifFile, []);
    const idx = notifs.findIndex(n => n.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    notifs[idx].read = true;
    notifs[idx].readAt = new Date().toISOString();
    writeJson(notifFile, notifs);
    return res.json({ ok: true, notification: notifs[idx] });
  } catch (err) {
    console.error('mark read', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.create = (obj) => {
  try {
    const notifs = readJson(notifFile, []);
    notifs.push(obj);
    writeJson(notifFile, notifs);
    // broadcast to SSE clients
    try { sendSSE('notification', obj); } catch (e) {}
    return obj;
  } catch (err) {
    console.error('create notif', err);
    return null;
  }
};

exports.removeByContentId = (contentId) => {
  try {
    const notifs = readJson(notifFile, []);
    const remaining = notifs.filter(n => String(n.contentId) !== String(contentId));
    const removed = notifs.filter(n => String(n.contentId) === String(contentId));
    writeJson(notifFile, remaining);
    // broadcast removals via SSE
    try {
      removed.forEach(r => sendSSE('notification_deleted', r));
    } catch (e) {}
    return removed;
  } catch (err) {
    console.error('removeByContentId', err);
    return [];
  }
};

exports.removeById = (id) => {
  try {
    const notifs = readJson(notifFile, []);
    const idx = notifs.findIndex(n => String(n.id) === String(id));
    if (idx === -1) return null;
    const removed = notifs.splice(idx, 1)[0];
    writeJson(notifFile, notifs);
    try { sendSSE('notification_deleted', removed); } catch (e) {}
    return removed;
  } catch (err) {
    console.error('removeById', err);
    return null;
  }
};

// Remove any notifications whose contentId is not in the provided list of kept content ids
exports.removeNotIn = (keepIds) => {
  try {
    const notifs = readJson(notifFile, []);
    const remaining = notifs.filter(n => {
      if (!n.contentId) return true; // keep non-content notifications
      return keepIds.includes(String(n.contentId));
    });
    const removed = notifs.filter(n => n.contentId && !keepIds.includes(String(n.contentId)));
    if (removed.length > 0) writeJson(notifFile, remaining);
    try { removed.forEach(r => sendSSE('notification_deleted', r)); } catch (e) {}
    return removed;
  } catch (err) {
    console.error('removeNotIn', err);
    return [];
  }
};

exports.cleanupForContent = (contentItems) => {
  try {
    const keepIds = contentItems.map(i => String(i.id));
    return exports.removeNotIn(keepIds);
  } catch (err) {
    console.error('cleanupForContent', err);
    return [];
  }
};

exports._internal = { sendSSE, sseClients };
