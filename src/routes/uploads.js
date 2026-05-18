const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadsController = require('../controllers/uploadsController');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, `${unique}${ext}`);
  }
});

function fileFilterFactory(allowedMimes) {
  return function (req, file, cb) {
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  };
}

const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilterFactory(['image/png', 'image/jpeg', 'image/jpg', 'image/gif'])
});

const uploadDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilterFactory([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ])
});

const uploadVoice = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: fileFilterFactory(['audio/mpeg', 'audio/wav', 'audio/ogg'])
});

const uploadAny = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.post('/image', uploadImage.single('file'), uploadsController.uploadImage);
router.post('/document', uploadDocument.single('file'), uploadsController.uploadDocument);
router.post('/voice', uploadVoice.single('file'), uploadsController.uploadVoice);
router.post('/', uploadAny.single('file'), uploadsController.upload);

module.exports = router;
