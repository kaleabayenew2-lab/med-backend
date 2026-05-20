const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'usersController.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. await u.save() -> await User.update(u.id, u)
// Wait, passing `u` directly might be dangerous if `u` has extra fields or `User.update` complains about `id`.
// But `User.update` in user.js:
// await db(TABLE).where({ id }).update(prepared);
// So it updates whatever fields are passed. Passing `id` is fine in SQLite.
code = code.replace(/await u\.save\(\);/g, 'await User.update(u.id, u);');
code = code.replace(/await user\.save\(\);/g, 'await User.update(user.id, user);');

// 2. TelegramContact Mongoose fixes
// TelegramContact.findOne({ chatId: String(chatId) }) -> TelegramContact.findByChatId(String(chatId))
code = code.replace(/await TelegramContact\.findOne\(\{ chatId: (.*?) \}\);/g, 'await TelegramContact.findByChatId($1);');

// new TelegramContact(...) and tc.save()
code = code.replace(/tc = new TelegramContact\(\{ chatId: String\(chatId\), phone: norm, username: telegramUsername \}\);/g, "tc = { chatId: String(chatId), phone: norm, username: telegramUsername };");
code = code.replace(/await tc\.save\(\);/g, "if (tc.id) { await TelegramContact.updateByChatId(tc.chatId, tc); } else { await TelegramContact.create(tc); }");

// 3. user._id -> user.id
code = code.replace(/user\._id/g, 'user.id');
code = code.replace(/u\._id/g, 'u.id');

// 4. User.findByIdAndDelete(id) -> User.delete(id)
code = code.replace(/await User\.findByIdAndDelete\(id\);/g, 'await User.delete(id);');

// 5. User.findById(id) -> User.findById(id) exists, but User.findByPk(id) doesn't exist, wait, let's check findByPk
code = code.replace(/await User\.findByPk\(id\)/g, 'await User.findById(id)');

fs.writeFileSync(filePath, code, 'utf8');
console.log('Fixed usersController.js Mongoose leftovers');
