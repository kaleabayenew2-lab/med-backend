const { registerModel, DataTypes } = require('../config/db');

// Define Ad model
const Ad = registerModel('Ad', {
  title: { type: DataTypes.STRING, allowNull: false },
  subtitle: DataTypes.STRING,
  image: { type: DataTypes.STRING, defaultValue: '' },
  // type of highlight: popular_search, rating_summary, newly_added, most_viewed_week, most_viewed_month, top_rated, nearby, custom
  kind: { type: DataTypes.STRING, allowNull: false },
  // optional link to a facility
  facility: { type: DataTypes.INTEGER, defaultValue: null },
  // arbitrary metadata useful to reconstruct or query the ad
  meta: { type: DataTypes.JSON, defaultValue: {} },
  source: { type: DataTypes.STRING, defaultValue: 'generated' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  indexes: [
    { fields: ['kind'] }
  ]
});

Ad.addHook('beforeSave', (ad) => {
  ad.updatedAt = new Date();
});

module.exports = Ad;
