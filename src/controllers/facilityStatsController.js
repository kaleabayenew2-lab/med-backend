const FacilityStats = require('../models/facilityStats');
const Facility = require('../models/facility');

// Get stats for a facility
exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await FacilityStats.findOne({ facility: id });
    if (!stats) return res.status(404).json({ error: 'Not found' });
    return res.json(stats);
  } catch (err) {
    console.error('stats get error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Create or update stats for a facility
exports.upsert = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const f = await Facility.findById(id);
    if (!f) return res.status(404).json({ error: 'Facility not found' });
    const stats = await FacilityStats.findOneAndUpdate({ facility: id }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return res.json(stats);
  } catch (err) {
    console.error('stats upsert error', err);
    return res.status(400).json({ error: 'Bad request' });
  }
};

// Increment view counters (useful when facility viewed)
exports.recordView = async (req, res) => {
  try {
    const { id } = req.params; // facility id
    const stats = await FacilityStats.findOneAndUpdate(
      { facility: id },
      { $inc: { viewsWeek: 1, viewsMonth: 1, viewsTotal: 1 }, $set: { lastViewedAt: new Date() } },
      { upsert: true, new: true }
    );
    return res.json(stats);
  } catch (err) {
    console.error('stats recordView error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// List top facilities by period: ?period=week|month|total&limit=10
exports.top = async (req, res) => {
  try {
    const { period = 'week', limit = 10 } = req.query;
    const fld = period === 'month' ? 'viewsMonth' : (period === 'total' ? 'viewsTotal' : 'viewsWeek');
    const docs = await FacilityStats.find().sort({ [fld]: -1 }).limit(parseInt(limit, 10)).populate('facility');
    return res.json(docs);
  } catch (err) {
    console.error('stats top error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
