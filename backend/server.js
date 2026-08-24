const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const questionsRoutes = require('./routes/questions');
const submissionsRoutes = require('./routes/submissions');
const uploadRoutes = require('./routes/upload');
const teacherRoutes = require('./routes/teacher');
const materialsRoutes = require('./routes/materials');
const marketingRoutes = require('./routes/marketing');

const app = express();
const PORT = process.env.PORT || 8085;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploaded photos and materials
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/marketing', marketingRoutes);

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '🎓 Trinetra Online Academy API is running!',
    timestamp: new Date().toISOString()
  });
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Background Job: Auto-activate Scheduled Tests Every 10 Seconds ──
const { PrismaClient } = require('@prisma/client');
const cronPrisma = new PrismaClient();

setInterval(async () => {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    await cronPrisma.question.updateMany({
      where: {
        isActive: false,
        scheduledAt: { not: null },
        OR: [
          { scheduledAt: { lte: nowIso } },
          { scheduledAt: { lte: nowLocal } }
        ]
      },
      data: { isActive: true, scheduledAt: null }
    });
  } catch (e) {}
}, 10000);

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Trinetra Academy Backend started: http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
});
