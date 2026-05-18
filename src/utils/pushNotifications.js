const axios = require('axios');
const User = require('../models/user');
const ChatMessage = require('../models/chatMessage');

const FCM_KEY = process.env.FCM_SERVER_KEY || null;

async function sendToToken(token, payload) {
  if (!FCM_KEY) return false;
  try {
    const res = await axios.post('https://fcm.googleapis.com/fcm/send', payload, {
      headers: {
        Authorization: `key=${FCM_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return res.data;
  } catch (e) {
    console.warn('fcm send failed', e?.response?.data || e.message);
    return null;
  }
}

async function sendPushToUserId(userId, title, body, data = {}) {
  try {
    const user = await User.findOne({ userId }) || await User.findById(userId);
    if (!user) return null;
    const tokens = (user.deviceTokens || []).map(t => t.token).filter(Boolean);
    if (!tokens.length) return null;
    // compute badge count: unread messages addressed to this user
    const unreadCount = await ChatMessage.countDocuments({ to: userId, read: false }).catch(()=>0);
    const payload = {
      registration_ids: tokens,
      notification: {
        title,
        body,
        badge: unreadCount
      },
      data: { ...data }
    };
    return await sendToToken(tokens[0], payload);
  } catch (e) {
    console.warn('sendPushToUserId error', e);
    return null;
  }
}

module.exports = { sendPushToUserId };
