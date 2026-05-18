const Ad = require('../models/ad');
const Facility = require('../models/facility');

// List ads with optional filters: ?active=true&kind=...&limit=10&lat=..&lng=..
exports.list = async (req, res) => {
  try {
    const { active, kind, limit = 20, lat, lng } = req.query;
    const q = {};
    if (active !== undefined) q.active = String(active) !== 'false' ? true : false;
    if (kind) q.kind = String(kind);
    let ads = await Ad.find(q).sort({ updatedAt: -1 }).limit(parseInt(limit, 10));

    // If lat/lng provided and some ads reference facilities, populate and compute distance
    if (lat !== undefined && lng !== undefined) {
      const plat = parseFloat(lat);
      const plng = parseFloat(lng);
      if (Number.isFinite(plat) && Number.isFinite(plng)) {
        // populate facility for those that have it
        ads = await Ad.find(q).populate('facility').limit(parseInt(limit, 10));
        ads = ads.map((a) => {
          const ad = a.toObject();
          if (ad.facility && ad.facility.location && Array.isArray(ad.facility.location.coordinates) && ad.facility.location.coordinates.length >= 2) {
            const lngf = Number(ad.facility.location.coordinates[0]);
            const latf = Number(ad.facility.location.coordinates[1]);
            // simple Haversine
            const toRad = (d) => (d * Math.PI) / 180.0;
            const R = 6371;
            const dLat = toRad(latf - plat);
            const dLon = toRad(lngf - plng);
            const aS = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(plat))*Math.cos(toRad(latf)) * Math.sin(dLon/2)*Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(aS), Math.sqrt(1-aS));
            ad._distanceKm = R * c;
          }
          return ad;
        });
        // sort ads with distance first if present
        ads.sort((x,y) => ((x._distanceKm||Infinity) - (y._distanceKm||Infinity)));
      }
    }

    return res.json(ads);
  } catch (err) {
    console.error('ads list error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findById(id).populate('facility');
    if (!ad) return res.status(404).json({ error: 'Not found' });
    return res.json(ad);
  } catch (err) {
    console.error('ads get error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.title || !data.kind) return res.status(400).json({ error: 'title and kind required' });
    // if facility id provided, ensure it exists
    if (data.facility) {
      const f = await Facility.findById(data.facility);
      if (!f) return res.status(400).json({ error: 'facility not found' });
    }
    const ad = new Ad(data);
    await ad.save();
    return res.status(201).json(ad);
  } catch (err) {
    console.error('ads create error', err);
    return res.status(400).json({ error: 'Bad request' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const ad = await Ad.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!ad) return res.status(404).json({ error: 'Not found' });
    return res.json(ad);
  } catch (err) {
    console.error('ads update error', err);
    return res.status(400).json({ error: 'Bad request' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Ad.findByIdAndDelete(id);
    if (!ad) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('ads delete error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
