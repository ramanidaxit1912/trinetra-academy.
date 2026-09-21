const express = require('express');
const compression = require('compression');
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
const { initWhatsApp, getWhatsAppStatus, logoutWhatsApp, hasSavedSession, pauseWhatsApp } = require('./services/whatsappService');
const { prewarmPdfEngine } = require('./services/pdfService');
const { cleanupOldCloudinaryPdfs } = require('./services/cloudinaryService');

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
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploaded photos and materials
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// ─── WhatsApp Live UI Portal & Management ─────────────────────
app.get('/whatsapp', (req, res) => {
  initWhatsApp();
  res.send(`<!DOCTYPE html>
<html lang="gu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ત્રિનેત્ર એકેડેમી - WhatsApp કનેક્શન પોર્ટલ</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Noto+Sans+Gujarati:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
      font-family: 'Noto Sans Gujarati', 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #f8fafc;
    }
    .card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      max-width: 460px;
      width: 100%;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .logo {
      font-size: 2.2rem;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 800;
      color: #38bdf8;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 0.88rem;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .badge-connected { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; }
    .badge-scan { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b; }
    .badge-connecting { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #0284c7; }
    .qr-box {
      background: #ffffff;
      padding: 16px;
      border-radius: 18px;
      display: inline-block;
      margin: 0 auto 20px;
      box-shadow: 0 10px 25px -5px rgba(37, 211, 102, 0.3);
      border: 3px solid #25d366;
    }
    .qr-img {
      width: 240px;
      height: 240px;
      display: block;
    }
    .steps {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 16px;
      text-align: left;
      font-size: 0.84rem;
      color: #cbd5e1;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .steps ol { padding-left: 20px; }
    .steps li { margin-bottom: 6px; }
    .btn {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { opacity: 0.9; transform: scale(0.98); }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top: 3px solid #38bdf8;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      animation: spin 1s linear infinite;
      margin: 30px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏛️📱</div>
    <h1>ત્રિનેત્ર ઓનલાઇન એકેડેમી</h1>
    <div class="subtitle">WhatsApp સ્વચાલિત OTP & પરિણામ સિસ્ટમ</div>
    <div id="content">
      <div class="spinner"></div>
      <p style="color:#94a3b8; font-size:0.85rem">કનેક્શન સ્ટેટસ ચકાસી રહ્યું છે...</p>
    </div>
  </div>

  <script>
    // Smart polling: polls every 5s only until CONNECTED, then stops completely (zero bandwidth!)
    let pollingInterval = null;

    async function smartCheckStatus() {
      await checkStatus();
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        const content = document.getElementById('content');

        if (data.status === 'CONNECTED') {
          // ✅ CONNECTED — stop all polling immediately (zero further bandwidth!)
          if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
          content.innerHTML = \`
            <div class="badge badge-connected">🟢 સફળતાપૂર્વક જોડાયેલ છે</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #f8fafc; margin-bottom: 8px;">
              +91 \${data.phone || 'Active'}
            </div>
            <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 24px;">
              તમામ વિદ્યાર્થીઓના લૉગિન OTP અને PDF સ્કોરકાર્ડ આ WhatsApp નંબરથી ઓટોમેટિક મોકલાશે!
            </p>
            <button class="btn" onclick="disconnectWA()">🚪 ડિસ્કનેક્ટ / નંબર બદલો</button>
          \`;
        } else if (data.status === 'SCAN_QR' && data.qrCode) {
          content.innerHTML = \`
            <div class="badge badge-scan">🟡 QR કોડ સ્કેન કરો</div>
            <div class="qr-box">
              <img class="qr-img" src="\${data.qrCode}" alt="WhatsApp QR Code" />
            </div>
            <div class="steps">
              <ol>
                <li>તમારા મોબાઈલમાં <strong>WhatsApp</strong> ખોલો.</li>
                <li>જમણી બાજુ ઉપર <strong>⋮ (ત્રણ ટપકાં)</strong> પર ક્લિક કરો.</li>
                <li><strong>"Linked Devices" (જોડાયેલા ઉપકરણો)</strong> પસંદ કરો.</li>
                <li><strong>"Link a Device" (ઉપકરણ જોડો)</strong> દબાવી આ QR Code સ્કેન કરો.</li>
              </ol>
            </div>
            <div style="font-size: 0.76rem; color: #64748b">
              ⚡ QR કોડ દર થોડી સેકન્ડે આપમેળે રીફ્રેશ થાય છે.
            </div>
          \`;
        } else {
          content.innerHTML = \`
            <div class="badge badge-connecting">🔵 સર્વર સાથે જોડાણ થઈ રહ્યું છે...</div>
            <div class="spinner"></div>
            <p style="color: #94a3b8; font-size: 0.85rem">QR કોડ તૈયાર થઈ રહ્યો છે, કૃપા કરીને થોડી સેકન્ડ રાહ જુઓ...</p>
            \${data.lastError ? \`<div style="color:#f87171;font-size:0.75rem;margin-top:8px;padding:6px 10px;background:rgba(239,68,68,0.1);border-radius:8px">ℹ️ \${data.lastError}</div>\` : ''}
            <button class="btn" style="background:rgba(59,130,246,0.2);border:1px solid #3b82f6;color:#93c5fd;margin-top:16px" onclick="forceReset()">🔄 નવો QR કોડ લોડ કરો (Fresh QR)</button>
          \`;
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    async function forceReset() {
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = '<div class="spinner"></div><p style="color:#94a3b8;font-size:0.85rem">નવો QR કોડ તૈયાર થઈ રહ્યો છે...</p>';
      }
      try {
        await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      } catch (e) {}
      setTimeout(checkStatus, 1500);
    }

    async function disconnectWA() {
      if (confirm('શું તમે ખરેખર આ WhatsApp નંબર ડિસ્કનેક્ટ કરવા માંગો છો?')) {
        await fetch('/api/whatsapp/disconnect', { method: 'POST' });
        checkStatus();
      }
    }

    // Start smart polling — auto-stops when CONNECTED (zero bandwidth after QR scan!)
    smartCheckStatus();
    pollingInterval = setInterval(smartCheckStatus, 5000);
  </script>
</body>
</html>`);
});

// ─── WhatsApp Status, Live QR Code & Disconnect/Switch API ────
// NOTE: /api/whatsapp/status is polled every 2.5s by the portal UI.
// We do NOT auto-start WhatsApp here - only the /whatsapp portal page triggers init.
app.get('/api/whatsapp/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const result = await logoutWhatsApp();
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

// ─── Night Mode Cron: Pause 12 AM, Resume 6 AM IST (saves ~600 MB/month!) ──
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
      console.log('🌙 [Night Mode] Pausing WhatsApp at midnight to save bandwidth...');
      await pauseWhatsApp();
    }

    // ▶️ Resume WhatsApp at 6:00 AM IST
    if (hours === 6 && minutes === 0 && nightResumedToday !== todayKey) {
      nightResumedToday = todayKey;
      console.log('☀️ [Night Mode] Resuming WhatsApp at 6 AM IST...');
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

// ─── Start ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Trinetra Academy Backend started: http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
  // Pre-warm Chromium in background so 1st student click is instant
  setTimeout(prewarmPdfEngine, 5000);

  // ── Self-ping every 12 minutes to prevent Render free tier from sleeping ──
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://trinetra-academy.onrender.com`;
  if (process.env.NODE_ENV === 'production') {
    setInterval(async () => {
      try {
        const http = require('https');
        http.get(`${SELF_URL}/api/health`, (res) => {
          console.log(`💓 [Keep-Alive] Self-ping OK (${res.statusCode}) - Server staying awake`);
        }).on('error', (e) => {
          console.warn(`⚠️ [Keep-Alive] Self-ping failed: ${e.message}`);
        });
      } catch (e) {}
    }, 12 * 60 * 1000); // Every 12 minutes (Render sleeps after 15 min inactivity)
    console.log(`💓 [Keep-Alive] Self-ping scheduled every 12 min → ${SELF_URL}/api/health`);
  }
});
