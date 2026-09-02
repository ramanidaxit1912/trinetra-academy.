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
const { initWhatsApp, getWhatsAppStatus, logoutWhatsApp } = require('./services/whatsappService');

const app = express();
const PORT = process.env.PORT || 8085;

// Initialize 100% Free Automated WhatsApp Bridge
initWhatsApp();

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
    async function checkStatus() {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        const content = document.getElementById('content');

        if (data.status === 'CONNECTED') {
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
            <p style="color: #94a3b8; font-size: 0.85rem">કૃપા કરીને થોડી સેકન્ડ રાહ જુઓ...</p>
          \`;
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }

    async function disconnectWA() {
      if (confirm('શું તમે ખરેખર આ WhatsApp નંબર ડિસ્કનેક્ટ કરવા માંગો છો?')) {
        await fetch('/api/whatsapp/disconnect', { method: 'POST' });
        checkStatus();
      }
    }

    checkStatus();
    setInterval(checkStatus, 2500);
  </script>
</body>
</html>`);
});

// ─── WhatsApp Status, Live QR Code & Disconnect/Switch API ────
app.get('/api/whatsapp/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  const result = await logoutWhatsApp();
  res.json(result);
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '🎓 Trinetra Online Academy API is running!',
    whatsapp: getWhatsAppStatus().status,
    timestamp: new Date().toISOString()
  });
});

// ─── Test PDF Diagnostic Route ────────────────────────────────
app.get('/api/test-pdf', async (req, res) => {
  try {
    const { launchPdfBrowser } = require('./services/pdfService');
    const browser = await launchPdfBrowser();
    const ver = await browser.version();
    await browser.close();
    res.json({ success: true, browserVersion: ver, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Test PDF Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
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
