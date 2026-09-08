const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/authMiddleware');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../services/cloudinaryService');

const router = express.Router();

// Use memory storage — file goes to Cloudinary or local fallback
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('ફક્ત image files upload થઈ શકે.'), false);
  }
});

// ─── POST /api/upload/photo ───────────────────────────────────
// Upload descriptive answer photo — permanent via Cloudinary
router.post('/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Photo file જરૂરી છે.' });
  }

  try {
    let photoUrl;

    if (isCloudinaryConfigured()) {
      // Upload to Cloudinary — permanent, survives Render restarts
      const result = await uploadToCloudinary(req.file.buffer, 'trinetra/photos', req.file.originalname);
      photoUrl = result.url;
      console.log('☁️ [Cloudinary] Photo uploaded:', photoUrl);
    } else {
      // Fallback: local disk (for local dev only)
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const uniqueName = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(req.file.originalname)}`;
      fs.writeFileSync(path.join(uploadDir, uniqueName), req.file.buffer);
      photoUrl = `/uploads/${uniqueName}`;
    }

    res.json({
      success: true,
      photoUrl,
      message: 'ફોટો અપલોડ સફળ!'
    });
  } catch (err) {
    console.error('[Upload] Photo upload error:', err);
    res.status(500).json({ error: 'ફોટો અપલોડ કરવામાં ભૂલ: ' + err.message });
  }
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload Error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;

