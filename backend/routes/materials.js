const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const prisma = new PrismaClient();

// Ensure materials directory exists inside uploads
const uploadDir = path.join(__dirname, '..', 'uploads', 'materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for PDFs, Documents, and Images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const cleanOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `mat_${Date.now()}_${cleanOriginal}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

// Format byte size to human readable (e.g. 2.4 MB)
function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// ─── GET /api/materials ──────────────────────────────────────
// Fetch all study materials
router.get('/', async (req, res) => {
  try {
    const { subject, type } = req.query;
    const where = {};
    if (subject && subject !== 'ALL') {
      where.subject = subject;
    }
    if (type && type !== 'ALL') {
      where.fileType = type;
    }

    const materials = await prisma.material.findMany({
      where,
      orderBy: { id: 'desc' }
    });

    res.json({
      success: true,
      data: materials,
      total: materials.length
    });
  } catch (err) {
    console.error('Error fetching materials:', err);
    res.status(500).json({ error: 'મટીરીયલ લોડ કરવામાં ક્ષતિ.' });
  }
});

// ─── POST /api/materials ─────────────────────────────────────
// Upload & Create Study Material
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { title, subject, description, fileType, tag, linkUrl, customFileSize } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'મટીરીયલનું શીર્ષક (Title) જરૂરી છે.' });
    }

    let fileUrl = linkUrl || '';
    let fileName = '';
    let fileSize = customFileSize || '';

    if (req.file) {
      fileUrl = `/uploads/materials/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = formatBytes(req.file.size);
    } else if (req.body.fileUrl) {
      fileUrl = req.body.fileUrl;
      fileName = req.body.fileName || 'Document';
    }

    const material = await prisma.material.create({
      data: {
        title: title.trim(),
        subject: subject ? subject.trim() : 'General',
        description: description ? description.trim() : '',
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || (fileUrl ? 'Online' : 'N/A'),
        fileType: fileType || 'PDF',
        tag: tag ? tag.trim() : 'IMP',
        linkUrl: linkUrl ? linkUrl.trim() : null
      }
    });

    res.status(201).json({
      success: true,
      data: material,
      message: '🎉 સ્ટડી મટીરીયલ સફળતાપૂર્વક ઉમેરાઈ ગયું!'
    });
  } catch (err) {
    console.error('Error creating material:', err);
    res.status(500).json({ error: 'મટીરીયલ સેવ કરવામાં ક્ષતિ: ' + err.message });
  }
});

// ─── PUT /api/materials/:id ──────────────────────────────────
// Update Study Material
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, subject, description, fileType, tag, linkUrl, customFileSize } = req.body;

    const existing = await prisma.material.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'મટીરીયલ મળ્યું નથી.' });
    }

    let fileUrl = existing.fileUrl;
    let fileName = existing.fileName;
    let fileSize = existing.fileSize;

    if (req.file) {
      // Remove old local file if any
      if (existing.fileUrl && existing.fileUrl.startsWith('/uploads/materials/')) {
        const oldPath = path.join(__dirname, '..', existing.fileUrl);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch {}
        }
      }
      fileUrl = `/uploads/materials/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = formatBytes(req.file.size);
    } else if (linkUrl) {
      fileUrl = linkUrl;
      if (customFileSize) fileSize = customFileSize;
    }

    const updated = await prisma.material.update({
      where: { id },
      data: {
        title: title ? title.trim() : existing.title,
        subject: subject !== undefined ? subject.trim() : existing.subject,
        description: description !== undefined ? description.trim() : existing.description,
        fileUrl,
        fileName,
        fileSize,
        fileType: fileType || existing.fileType,
        tag: tag !== undefined ? tag.trim() : existing.tag,
        linkUrl: linkUrl !== undefined ? linkUrl.trim() : existing.linkUrl
      }
    });

    res.json({
      success: true,
      data: updated,
      message: '✅ મટીરીયલ વિગત સુધારી લેવાઈ!'
    });
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).json({ error: 'મટીરીયલ અપડેટ કરવામાં ક્ષતિ: ' + err.message });
  }
});

// ─── DELETE /api/materials/:id ───────────────────────────────
// Delete Study Material
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.material.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: 'મટીરીયલ મળ્યું નથી.' });
    }

    // Unlink local file from disk
    if (existing.fileUrl && existing.fileUrl.startsWith('/uploads/materials/')) {
      const filePath = path.join(__dirname, '..', existing.fileUrl);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    await prisma.material.delete({ where: { id } });

    res.json({
      success: true,
      message: '🗑️ મટીરીયલ સફળતાપૂર્વક દૂર કરવામાં આવ્યું.'
    });
  } catch (err) {
    console.error('Error deleting material:', err);
    res.status(500).json({ error: 'મટીરીયલ ડીલીટ કરવામાં ક્ષતિ.' });
  }
});

module.exports = router;
