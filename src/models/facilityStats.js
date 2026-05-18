const { registerModel, DataTypes } = require('../config/db');

// Define FacilityStats model
const FacilityStats = registerModel('FacilityStats', {
  facility: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  viewsWeek: { type: DataTypes.INTEGER, defaultValue: 0 },
  viewsMonth: { type: DataTypes.INTEGER, defaultValue: 0 },
  viewsTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
  ratingAvg: { type: DataTypes.FLOAT, defaultValue: 0 },
  ratingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastViewedAt: DataTypes.DATE,
  // arbitrary counters/metrics
  meta: { type: DataTypes.JSON, defaultValue: {} },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

FacilityStats.addHook('beforeSave', (stats) => {
  stats.updatedAt = new Date();
});

module.exports = FacilityStats;
