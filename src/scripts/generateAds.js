const Facility = require('../models/facility');
const FacilityStats = require('../models/facilityStats');
const Ad = require('../models/ad');

async function generateAndPersistAds({ maxAds = 20, location } = {}) {
  // location: { lat, lng }
  const out = [];

  // Load facilities and stats
  const facilities = await Facility.findAll();
  const activeFacilities = facilities.filter(f => f.isActive);
  const statsMap = {};
  const stats = await FacilityStats.findAll();
  const relevantStats = stats.filter(s => activeFacilities.some(f => f.id === s.facility));
  relevantStats.forEach(s => { statsMap[String(s.facility)] = s; });

  // Popular services
  const freq = {};
  facilities.forEach(f => {
    const add = (v) => {
      if (!v) return;
      if (Array.isArray(v)) v.forEach(x => { freq[String(x).toLowerCase()] = (freq[String(x).toLowerCase()] || 0) + 1; });
      else freq[String(v).toLowerCase()] = (freq[String(v).toLowerCase()] || 0) + 1;
    };
    add(f.services);
    add(f.service);
    add(f.categories);
  });
  const popular = Object.keys(freq).sort((a,b) => freq[b] - freq[a]).slice(0,3).join(', ');
  out.push({ title: 'Popular searches', subtitle: popular || 'No data yet', kind: 'popular_search' });

  // Community rating
  let total = 0, count = 0;
  facilities.forEach(f => { if (typeof f.averageRating === 'number') { total += f.averageRating; count++; } });
  const avg = count>0 ? (total/count) : 0;
  out.push({ title: 'Community rating', subtitle: count>0 ? `Average ${avg.toFixed(1)} ★ from ${count} reviews` : 'No ratings yet', kind: 'rating_summary' });

  // Newly added (30 days)
  const now = new Date();
  let newly = null;
  for (const f of facilities) {
    const created = f.createdAt || f.created_at || f.created;
    if (!created) continue;
    const dt = new Date(created);
    if ((now - dt) / (1000*60*60*24) <= 30) {
      if (!newly) newly = f;
      else if (location && f.location && f.location.coordinates && f.location.coordinates.length >= 2) {
        // compute distance
        const latf = Number(f.location.coordinates[1]);
        const lngf = Number(f.location.coordinates[0]);
        const toRad = (d) => (d * Math.PI) / 180.0;
        const R = 6371;
        const dLat = toRad(latf - location.lat);
        const dLon = toRad(lngf - location.lng);
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(location.lat))*Math.cos(toRad(latf)) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = R * c;
        f.__tmpDist = dist;
        if ((newly.__tmpDist || Infinity) > dist) newly = f;
      }
    }
  }
  if (newly) {
    out.push({ title: 'Newly added near you', subtitle: `${newly.name || 'Facility'}` , kind: 'newly_added', facility: newly.id });
  }

  // Most viewed week/month using stats
  const withStats = facilities.map(f => ({ f, s: statsMap[String(f.id)] || {} }));
  withStats.sort((a,b) => (b.s.viewsWeek||0) - (a.s.viewsWeek||0));
  if (withStats.length) out.push({ title: 'Most viewed (week)', subtitle: withStats[0].f.name || '-', kind: 'most_viewed_week', facility: withStats[0].f.id });
  withStats.sort((a,b) => (b.s.viewsMonth||0) - (a.s.viewsMonth||0));
  if (withStats.length) out.push({ title: 'Most viewed (month)', subtitle: withStats[0].f.name || '-', kind: 'most_viewed_month', facility: withStats[0].f.id });

  // Top rated
  facilities.sort((a,b) => (b.averageRating||0) - (a.averageRating||0));
  if (facilities.length) out.push({ title: 'Top rated', subtitle: facilities[0].name || '-', kind: 'top_rated', facility: facilities[0].id });

  // Nearby: nearest by provided location
  if (location) {
    let nearest = null; let nd = Infinity;
    for (const f of facilities) {
      if (f.location && Array.isArray(f.location.coordinates) && f.location.coordinates.length >= 2) {
        const latf = Number(f.location.coordinates[1]);
        const lngf = Number(f.location.coordinates[0]);
        const toRad = (d) => (d * Math.PI) / 180.0;
        const R = 6371;
        const dLat = toRad(latf - location.lat);
        const dLon = toRad(lngf - location.lng);
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(location.lat))*Math.cos(toRad(latf)) * Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = R * c;
        if (dist < nd) { nd = dist; nearest = f; }
      }
    }
    if (nearest) out.push({ title: 'Nearby', subtitle: nearest.name || '-', kind: 'nearby', facility: nearest.id, meta: { distanceKm: nd } });
  }

  // Persist: upsert ads by kind (simple approach)
  for (const a of out) {
    const q = { kind: a.kind };
    const update = Object.assign({}, a, { active: true, updatedAt: new Date() });
    const [ad] = await Ad.findOrCreate({ where: q, defaults: update });
    if (!ad.isNewRecord) {
      await ad.update(update);
    }
  }

  return out.slice(0, maxAds);
}

module.exports = { generateAndPersistAds };
