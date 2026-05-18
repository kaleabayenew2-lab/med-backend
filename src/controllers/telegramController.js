const TelegramContact = require('../models/telegramContact');
const User = require('../models/user');

exports.getByChatId = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) return res.status(400).json({ message: 'Missing chatId' });
    const t = await TelegramContact.findOne({ chatId }).populate('linkedUser');
    if (!t) return res.status(404).json({ message: 'Not found' });
    return res.json({ chatId: t.chatId, phone: t.phone, username: t.username, linkedUser: t.linkedUser ? String(t.linkedUser._id) : null });
  } catch (err) {
    console.error('telegram.getByChatId error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// create or update a contact record
// list all chat contacts (admin may use for broadcasting)
exports.listContacts = async (req, res) => {
  const docs = await TelegramContact.find({}).select('chatId');
  res.json({ chatIds: docs.map(d => d.chatId) });
};

exports.upsertContact = async (req, res) => {
  try {
    const { phone, chatId, telegramUsername } = req.body || {};
    if (!chatId) return res.status(400).json({ message: 'chatId required' });
    const norm = phone ? String(phone).replace(/[^0-9]/g, '') : undefined;

    // attempt to find matching user
    let linkedUser = null;
    if (norm) {
      const suffix9 = norm.length > 9 ? norm.slice(-9) : norm;
      const suffix10 = norm.length > 10 ? norm.slice(-10) : norm;
      const queries = [ { phone: { $regex: norm + '$' } }, { phone: { $regex: suffix9 + '$' } } ];
      if (suffix10 != suffix9) queries.push({ phone: { $regex: suffix10 + '$' } });
      linkedUser = await User.findOne({ $or: queries });
    }

    let rec = await TelegramContact.findOne({ chatId });
    if (!rec) {
      rec = new TelegramContact({ chatId, phone: norm, username: telegramUsername });
    } else {
      rec.phone = norm || rec.phone;
      rec.username = telegramUsername || rec.username;
    }
    if (linkedUser) {
      rec.linkedUser = linkedUser._id;
      // also set on user
      linkedUser.telegramChatId = String(chatId);
      linkedUser.telegramUsername = telegramUsername || linkedUser.telegramUsername;
      linkedUser.telegramPhone = norm || linkedUser.telegramPhone;
      await linkedUser.save();
    }
    await rec.save();
    return res.json({ ok: true, chatId: rec.chatId, linkedUser: rec.linkedUser ? String(rec.linkedUser) : null });
  } catch (err) {
    console.error('telegram.upsertContact error', err);
    res.status(500).json({ message: 'Server error' });
  }
};
