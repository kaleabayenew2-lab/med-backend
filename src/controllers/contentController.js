const path = require('path');
const fs = require('fs');

const contentFile = path.join(__dirname, '..', 'data', 'content.json');

function readContent() {
  try { return JSON.parse(fs.readFileSync(contentFile, 'utf8')); } catch (e) { return []; }
}

exports.publicList = (req, res) => {
  try {
    const showAll = req.query.showAll === '1' || req.query.showAll === 'true';
    const items = readContent() || [];
    const now = new Date();
    const filtered = items.filter((it) => {
      if (!it || !it.published) return false;
      if (showAll) return true;
      try {
        if (it.startAt) {
          const s = new Date(it.startAt);
          if (now < s) return false;
        }
        if (it.endAt) {
          const e = new Date(it.endAt);
          if (now > e) return false;
        }
      } catch (e) { /* ignore parse errors */ }
      return true;
    });
    // sort newest first
    filtered.sort((a,b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
    return res.json({ items: filtered });
  } catch (err) {
    console.error('publicList content error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
