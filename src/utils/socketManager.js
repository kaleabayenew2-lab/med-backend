let io = null;
const userSockets = new Map(); // userId -> Set(socketId)
const adminSockets = new Set();

function init(ioServer) {
  io = ioServer;
  io.on('connection', (socket) => {
    const q = socket.handshake && socket.handshake.query ? socket.handshake.query : {};
    const userId = q.userId || q.userid || q.uid;
    const role = q.role || q.roleName || q.r;
    if (userId) {
      const set = userSockets.get(userId) || new Set();
      set.add(socket.id);
      userSockets.set(userId, set);
      socket.data.userId = userId;
    }
    if (role === 'admin' || q.admin === '1' || q.admin === 'true') {
      adminSockets.add(socket.id);
      socket.data.admin = true;
    }

    socket.on('register', (payload) => {
      try {
        if (payload && payload.userId) {
          const sidSet = userSockets.get(payload.userId) || new Set();
          sidSet.add(socket.id);
          userSockets.set(payload.userId, sidSet);
          socket.data.userId = payload.userId;
        }
        if (payload && payload.role === 'admin') {
          adminSockets.add(socket.id);
          socket.data.admin = true;
        }
      } catch (e) {
        // ignore
      }
    });

    socket.on('disconnect', () => {
      try {
        if (socket.data && socket.data.userId) {
          const set = userSockets.get(socket.data.userId);
          if (set) {
            set.delete(socket.id);
            if (set.size === 0) userSockets.delete(socket.data.userId);
          }
        }
        if (socket.data && socket.data.admin) {
          adminSockets.delete(socket.id);
        }
      } catch (e) {
        // ignore
      }
    });
  });
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  const set = userSockets.get(userId);
  if (!set || set.size === 0) return;
  set.forEach((sid) => {
    try {
      io.to(sid).emit(event, payload);
    } catch (e) {}
  });
}

function emitToAdmins(event, payload) {
  if (!io) return;
  adminSockets.forEach((sid) => {
    try {
      io.to(sid).emit(event, payload);
    } catch (e) {}
  });
}

function emitToAll(event, payload) {
  if (!io) return;
  try {
    io.emit(event, payload);
  } catch (e) {}
}

module.exports = { init, emitToUser, emitToAdmins, emitToAll };
