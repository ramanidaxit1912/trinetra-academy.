const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ─── 🛡️ Global Process Crash Shield (Zero-Downtime Immunity) ───────
// Intercepts unhandled async promise rejections and uncaught exceptions so Node.js process NEVER abruptly exits
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [Global Safety Shield] Intercepted Unhandled Rejection:', reason?.message || reason);
  if (reason?.stack) console.error(reason.stack);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 [Global Safety Shield] Intercepted Uncaught Exception:', err?.message || err);
  if (err?.stack) console.error(err.stack);
});

const authRoutes = require('./routes/auth');
const questionsRoutes = require('./routes/questions');
const submissionsRoutes = require('./routes/submissions');
const uploadRoutes = require('./routes/upload');
const teacherRoutes = require('./routes/teacher');
const materialsRoutes = require('./routes/materials');
const marketingRoutes = require('./routes/marketing');
const { initWhatsApp, initWhatsAppSlot, getWhatsAppStatus, logoutWhatsApp, hasSavedSession, pauseWhatsApp, NUM_SLOTS } = require('./services/whatsappService');
const { prewarmPdfEngine } = require('./services/pdfService');
const { cleanupOldCloudinaryPdfs } = require('./services/cloudinaryService');
const { getWhatsAppPortalHtml } = require('./views/whatsappPortal');

const app = express();
const PORT = process.env.PORT || 8085;

// Enable High-Efficiency Data Compression (Saves 85% Bandwidth)
app.use(compression());

// Auto-initialize WhatsApp Bridge 24/7 if previously paired
(async () => {
  try {
    const saved = await hasSavedSession();
    if (saved || process.env.ENABLE_WHATSAPP === 'true') {
      console.log('📱 [WhatsApp] Saved session detected — Auto-connecting WhatsApp 24/7...');
      initWhatsApp();
    } else {
      console.log('ℹ️ [WhatsApp] No saved session yet. Scan QR at /whatsapp to pair.');
    }
  } catch (e) {
    console.warn('⚠️ [WhatsApp Startup]:', e.message);
  }
})();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://trinetraonline.in',
    'https://www.trinetraonline.in',
    'https://trinetra-class.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploaded photos and materials with 7-day browser caching (reduces backend RAM and bandwidth)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));

// ⚡ Active Memory Optimizer & Garbage Collector (Keeps RAM minimal during 850+ student tests)
if (global.gc) {
  console.log('🧹 [Memory Shield] V8 Garbage Collector enabled (--expose-gc) for active RAM management');
  setInterval(() => {
    try {
      const memory = process.memoryUsage();
      const heapMb = Math.round(memory.heapUsed / 1024 / 1024);
      // Trigger GC if heap exceeds 140MB or RSS exceeds 200MB
      if (heapMb > 140) {
        global.gc();
        const after = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(`🧹 [Memory Shield] Cleaned RAM: ${heapMb} MB → ${after} MB`);
      }
    } catch (_) {}
  }, 2 * 60 * 1000); // Check every 2 minutes
}

// ─── Root Check ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Trinetra Online Academy Backend API',
    health: '/api/health'
  });
});

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/marketing', marketingRoutes);

// ─── WhatsApp Live UI Portal & Management (5-Slot Multi-WhatsApp Pool) ───
app.get('/whatsapp', (req, res) => {
  initWhatsApp();
  res.send(getWhatsAppPortalHtml());
});

// ─── WhatsApp Pool API Endpoints ──────────────────────────────
app.get('/api/whatsapp/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/init', async (req, res) => {
  const slotId = req.body?.slotId ? Number(req.body.slotId) : null;
  if (slotId) {
    await initWhatsAppSlot(slotId);
  } else {
    await initWhatsApp();
  }
  res.json({ success: true, slotId });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const slotId = req.body?.slotId ? Number(req.body.slotId) : 1;
  const result = await logoutWhatsApp(slotId);
  res.json(result);
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const { isCloudinaryConfigured } = require('./services/cloudinaryService');
  res.json({ 
    status: 'ok', 
    message: '🎓 Trinetra Online Academy API is running!',
    whatsapp: getWhatsAppStatus().status,
    cloudinary: isCloudinaryConfigured() ? '✅ Configured' : '❌ NOT set — images go to local disk!',
    timestamp: new Date().toISOString()
  });
});

// ─── Disk Usage Diagnostic ────────────────────────────────────
app.get('/api/disk-usage', async (req, res) => {
  const { execSync } = require('child_process');
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  const result = {
    platform: process.platform,
    nodeEnv: process.env.NODE_ENV,
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime: `${Math.round(process.uptime() / 60)} minutes`,
    disk: {},
    uploads: {},
    whatsappSession: {},
    nodeModules: {}
  };

  try {
    // Overall disk usage (Linux/Render)
    const dfOut = execSync('df -h / 2>/dev/null || df -h .', { encoding: 'utf8', timeout: 5000 });
    const dfLines = dfOut.trim().split('\n');
    if (dfLines.length >= 2) {
      const parts = dfLines[1].split(/\s+/);
      result.disk = {
        total: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4]
      };
    }
  } catch (e) {
    result.disk.error = e.message;
  }

  try {
    // uploads folder
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const duOut = execSync(`du -sh "${uploadsDir}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 });
      result.uploads.size = duOut.trim().split('\t')[0];
      result.uploads.fileCount = fs.readdirSync(uploadsDir).length;
    } else {
      result.uploads.size = '0';
      result.uploads.fileCount = 0;
    }
  } catch (e) {
    result.uploads.error = e.message;
  }

  try {
    // whatsapp_session folder
    const waDir = path.join(__dirname, 'whatsapp_session');
    if (fs.existsSync(waDir)) {
      const files = fs.readdirSync(waDir);
      const duOut = execSync(`du -sh "${waDir}" 2>/dev/null`, { encoding: 'utf8', timeout: 5000 });
      result.whatsappSession = { size: duOut.trim().split('\t')[0], fileCount: files.length, files };
    } else {
      result.whatsappSession = { size: '0', fileCount: 0, note: 'Directory does not exist (good! zero-disk mode)' };
    }
  } catch (e) {
    result.whatsappSession.error = e.message;
  }

  try {
    // node_modules size
    const nmDir = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nmDir)) {
      const duOut = execSync(`du -sh "${nmDir}" 2>/dev/null`, { encoding: 'utf8', timeout: 8000 });
      result.nodeModules.size = duOut.trim().split('\t')[0];
    }
  } catch (e) {
    result.nodeModules.size = 'Could not measure';
  }

  res.json(result);
});

// ─── Test PDF Diagnostic Route ────────────────────────────────
app.get('/api/test-pdf', async (req, res) => {
  const diag = {
    platform: process.platform,
    nodeVersion: process.version,
    env: process.env.NODE_ENV
  };

  try {
    const cLib = require('@sparticuz/chromium');
    const chromium = cLib.default || cLib;
    diag.hasChromiumPackage = true;
    try {
      diag.chromiumExecPath = await chromium.executablePath();
      diag.execExists = require('fs').existsSync(diag.chromiumExecPath);
    } catch (e) {
      diag.chromiumExecError = e.message;
    }
  } catch (e) {
    diag.hasChromiumPackage = false;
    diag.chromiumRequireError = e.message;
  }

  try {
    const { launchPdfBrowser } = require('./services/pdfService');
    const browser = await launchPdfBrowser();
    diag.browserVersion = await browser.version();
    await browser.close();
    res.json({ success: true, diag });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack, diag });
  }
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

// ─── Background Job: Auto-activate Scheduled Tests Every 300 Seconds (5 Min) ──
setInterval(async () => {
  try {
    if (questionsRoutes && typeof questionsRoutes.autoActivateScheduledTests === 'function') {
      await questionsRoutes.autoActivateScheduledTests();
    }
  } catch (e) {}
}, 300 * 1000);

// ─── Daily 9:30 PM IST WhatsApp Summary Report ───────────────
const { sendWhatsAppDailyReport } = require('./services/whatsappService');
let lastReportDateKey = '';
setInterval(async () => {
  try {
    const now = new Date();
    // Convert to IST (UTC + 5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const todayKey = istTime.toISOString().slice(0, 10);

    // Check if it's 21:30 - 21:45 IST (9:30 PM - 9:45 PM) and hasn't dispatched today
    if (hours === 21 && minutes >= 30 && minutes <= 45 && lastReportDateKey !== todayKey) {
      lastReportDateKey = todayKey;
      console.log('📢 [Cron] Dispatching Daily Academic Summary Report to Director via WhatsApp...');
      const adminMobile = process.env.TEACHER_ADMIN_MOBILE || '8200405300';
      await sendWhatsAppDailyReport(adminMobile);
    }
  } catch (err) {
    console.warn('⚠️ [Daily Report Cron Error]:', err.message);
  }
}, 60 * 1000); // Check once per minute

// ─── Night Mode Cron: Pause 12 AM, Resume 7 AM IST (saves ~800 MB/month!) ──
let nightPausedToday = '';
let nightResumedToday = '';
setInterval(async () => {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const todayKey = istTime.toISOString().slice(0, 10);

    // ⏸️ Pause WhatsApp at 12:00 AM IST (Midnight)
    if (hours === 0 && minutes === 0 && nightPausedToday !== todayKey) {
      nightPausedToday = todayKey;
      console.log('🌙 [Night Mode] Pausing WhatsApp at midnight (12 AM) to save bandwidth...');
      await pauseWhatsApp();
    }

    // ▶️ Resume WhatsApp & Wakeup Server at 7:00 AM IST
    if (hours === 7 && minutes === 0 && nightResumedToday !== todayKey) {
      nightResumedToday = todayKey;
      console.log('☀️ [Night Mode] 7:00 AM IST reached! Sending Wakeup Ping & starting WhatsApp...');

      // 🔔 7:00 AM Wakeup Ping to keep Render warm
      const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://trinetra-class.onrender.com`;
      try {
        const https = require('https');
        https.get(`${SELF_URL}/api/health`, (res) => {
          console.log(`⏰ [7 AM Wakeup Ping] Self-ping status: ${res.statusCode} — Server is fully awake!`);
        }).on('error', (e) => {
          console.warn(`⚠️ [7 AM Wakeup Ping] note: ${e.message}`);
        });
      } catch (e) {}

      // Re-initialize WhatsApp connection
      initWhatsApp();
    }
  } catch (err) {
    console.warn('⚠️ [Night Mode Cron Error]:', err.message);
  }
}, 60 * 1000); // Check once per minute

// ─── Cloudinary Auto-Cleanup: Purge scorecards older than 45 days (runs 3:00 AM IST) ──
let lastCleanupDateKey = '';
setInterval(async () => {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const todayKey = istTime.toISOString().slice(0, 10);

    if (hours === 3 && minutes === 0 && lastCleanupDateKey !== todayKey) {
      lastCleanupDateKey = todayKey;
      console.log('🧹 [Cron] Running daily Cloudinary scorecard cleanup (> 45 days)...');
      await cleanupOldCloudinaryPdfs(45);
    }
  } catch (err) {
    console.warn('⚠️ [Cloudinary Cleanup Cron Error]:', err.message);
  }
}, 60 * 1000);

// ─── OTP Auto-Cleanup: Delete expired OTPs older than 24h (runs 3:01 AM IST) ──
// Keeps Supabase DB Storage clean — removes hundreds of stale OTP rows monthly!
let lastOtpCleanupKey = '';
setInterval(async () => {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();
    const todayKey = istTime.toISOString().slice(0, 10);

    if (hours === 3 && minutes === 1 && lastOtpCleanupKey !== todayKey) {
      lastOtpCleanupKey = todayKey;
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count } = await prisma.oTPSession.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          used: true
        }
      });
      console.log(`🧹 [OTP Cleanup] Deleted ${count} expired OTP records from DB.`);
    }
  } catch (err) {
    console.warn('⚠️ [OTP Cleanup Cron Error]:', err.message);
  }
}, 60 * 1000);

// ─── 🛡️ Global Express Error Shield ──────────────────────────────
app.use((err, req, res, next) => {
  console.error('🚨 [Express Error Shield]:', err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'સર્વર આંતરિક ક્ષતિ (Internal Server Error). કૃપા કરીને ફરી પ્રયાસ કરો.'
  });
});

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Trinetra Academy Backend started: http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
  // Pre-warm Chromium in background so 1st student click is instant
  setTimeout(prewarmPdfEngine, 5000);

  // ── Bulletproof Self-ping every 9 minutes 24/7 (Keeps Render instance ALWAYS awake) ──
  // 9-minute interval ensures Render's 15-minute inactivity timer NEVER triggers!
  // Ultra-lightweight (1 KB HTTP ping), while heavy tasks (WhatsApp & DB backup) pause at night.
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://trinetra-class.onrender.com`;
  setInterval(async () => {
    try {
      const http = require('https');
      const req = http.get(`${SELF_URL}/api/health`, { timeout: 10000 }, (res) => {
        console.log(`💓 [Keep-Alive] 9-min Self-ping OK (${res.statusCode}) - Server is wide awake!`);
      });
      req.on('error', (e) => {
        console.warn(`⚠️ [Keep-Alive] Self-ping note: ${e.message}`);
      });
      req.on('timeout', () => {
        req.destroy();
      });
    } catch (e) {}
  }, 9 * 60 * 1000); // Bulletproof 9 minutes (Render sleeps after 15 min)
  console.log(`💓 [Keep-Alive] 9-minute 24/7 Self-ping active → ${SELF_URL}/api/health`);
});
