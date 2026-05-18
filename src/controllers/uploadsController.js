const path = require('path');
const fs = require('fs');

function makeUrl(req, filename) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/${encodeURIComponent(filename)}`;
}

exports.upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.filename;
    return res.status(201).json({ url: makeUrl(req, filename), filename });
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ error: 'upload failed' });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const filename = req.file.filename;
    return res.status(201).json({ url: makeUrl(req, filename), filename, type: 'image' });
  } catch (err) {
    console.error('uploadImage', err);
    return res.status(500).json({ error: 'upload failed' });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });
    const filename = req.file.filename;
    return res.status(201).json({ url: makeUrl(req, filename), filename, type: 'document' });
  } catch (err) {
    console.error('uploadDocument', err);
    return res.status(500).json({ error: 'upload failed' });
  }
};

exports.uploadVoice = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No voice file uploaded' });
    const filename = req.file.filename;
    return res.status(201).json({ url: makeUrl(req, filename), filename, type: 'voice' });
  } catch (err) {
    console.error('uploadVoice', err);
    return res.status(500).json({ error: 'upload failed' });
  }
};
