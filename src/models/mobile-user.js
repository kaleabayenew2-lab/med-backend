const { registerModel, DataTypes, Op } = require('../config/db');

// Define MobileUser model
const MobileUser = registerModel('MobileUser', {
  name: DataTypes.STRING,
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  username: { type: DataTypes.STRING, unique: true },
  phone: DataTypes.STRING
}, {
  timestamps: true,
  indexes: [
    { unique: true, fields: ['username'], where: { username: { [Op.ne]: null } } }
  ]
});

module.exports = MobileUser;