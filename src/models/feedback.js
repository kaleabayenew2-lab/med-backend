const { registerModel, DataTypes } = require('../config/db');

// Define Feedback model
const Feedback = registerModel('Feedback', {
  id: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, defaultValue: '' },
  email: { type: DataTypes.STRING, defaultValue: '' },
  message: { type: DataTypes.STRING, defaultValue: '' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  sourceIp: { type: DataTypes.STRING, defaultValue: '' },
  replied: { type: DataTypes.BOOLEAN, defaultValue: false },
  reply: { type: DataTypes.STRING, defaultValue: null },
  replyMethod: { type: DataTypes.STRING, defaultValue: null },
  repliedAt: DataTypes.DATE,
  meta: { type: DataTypes.JSON, defaultValue: {} }
});

module.exports = Feedback;
