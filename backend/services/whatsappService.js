/**
 * whatsappService.js — Trinetra Online Academy
 * ─────────────────────────────────────────────
 * ✅ Rock-solid 24/7 WhatsApp connection using Baileys multi-file auth
 * ✅ Automatic Supabase DB sync: all cryptographic session keys persisted
 * ✅ Restores session on Render restart without requiring QR scan
 * ✅ Minimal disk footprint (~300 KB total, 0.006% of Render 5GB)
 * ✅ No accidental logouts on temporary network blips
 * ✅ Clean manual logout
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const prisma = require('../prismaClient');

// ─── State ────────────────────────────────────────────────────
let waSocket = null;
let qrCodeDataUrl = null;
let connectionStatus = 'DISCONNECTED';
let connectedPhone = null;
let isInitializing = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let sessionSaveInterval = null;
let lastError = null;

const sessionDir = path.join(__dirname, '../whatsapp_session');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

// ─── Helper: Clean Indian Mobile ──────────────────────────────
function cleanIndianMobile(rawMobile) {
  const digits = String(rawMobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ─── Supabase DB Table Check ──────────────────────────────────
async function ensureDbSessionTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id VARCHAR(255) PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('⚠️ [WhatsApp] DB Table check note:', e.message);
  }
}

// Check if credentials exist in DB
async function hasSavedSession() {
  try {
    await ensureDbSessionTable();
    const rows = await prisma.$queryRawUnsafe(`SELECT id FROM whatsapp_sessions WHERE id = 'creds.json' LIMIT 1`);
    return Boolean(rows && rows.length > 0);
  } catch (e) {
    return false;
  }
}

// Restore all session files from Supabase DB into sessionDir
async function restoreSessionFromDb() {
  try {
    await ensureDbSessionTable();
    const rows = await prisma.$queryRawUnsafe(`SELECT id, data FROM whatsapp_sessions`);
    if (rows && rows.length > 0) {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      for (const row of rows) {
        fs.writeFileSync(path.join(sessionDir, row.id), row.data, 'utf8');
      }
      console.log(`📥 [WhatsApp Session] Restored ${rows.length} session files from Supabase DB.`);
      return true;
    }
  } catch (e) {
    console.warn('⚠️ [WhatsApp Session] Restore error:', e.message);
  }
  return false;
}

// Backup all session files from sessionDir into Supabase DB
async function saveSessionToDb() {
  try {
    if (!fs.existsSync(sessionDir)) return;
    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) return;

    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        await prisma.$executeRawUnsafe(`
          INSERT INTO whatsapp_sessions (id, data, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
        `, file, content);
      }
    }
  } catch (e) {
    console.warn('⚠️ [WhatsApp Session] Save error:', e.message);
  }
}

// Wipe session from DB and disk
async function clearSessionFromDb() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM whatsapp_sessions`);
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(sessionDir, f)); } catch (e) {}
      }
    }
    console.log('🗑️ [WhatsApp Session] Cleared session from Database and disk.');
  } catch (e) {
    console.warn('⚠️ [WhatsApp Session] Clear error:', e.message);
  }
}

// ─── Reconnect Scheduler ──────────────────────────────────────
function scheduleReconnect(forceDelay) {
  if (reconnectTimer) return;
  const delay = forceDelay !== undefined
    ? forceDelay
    : Math.min(3000 * Math.pow(1.5, reconnectAttempts), 25000);
  reconnectAttempts++;
  console.log(`🔄 [WhatsApp] Auto-reconnecting in ${Math.round(delay / 1000)}s (attempt #${reconnectAttempts})...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initWhatsApp();
  }, delay);
}

// ─── Core: initWhatsApp ───────────────────────────────────────
async function initWhatsApp() {
  if (isInitializing) {
    console.log('ℹ️ [WhatsApp] Already initializing, skipping.');
    return;
  }
  if (connectionStatus === 'CONNECTED' || (connectionStatus === 'SCAN_QR' && qrCodeDataUrl)) {
    return;
  }

  isInitializing = true;
  connectionStatus = 'CONNECTING';

  try {
    // 1. Restore persistent session keys from Supabase if disk is empty (e.g. after Render redeploy)
    const diskFiles = fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir).filter(f => f.endsWith('.json')) : [];
    if (diskFiles.length === 0) {
      await restoreSessionFromDb();
    }

    // 2. Load Multi-File Auth State from session directory
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    // 3. Get latest Baileys version with fallback
    let version = [2, 3000, 1043857760];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (e) {
      console.warn('⚠️ [WhatsApp] Could not fetch version, using default:', version.join('.'));
    }

    // 4. Create WA Socket with optimal bandwidth-saving settings
    waSocket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 60000,   // 60s (was 25s) — 60% less WhatsApp bandwidth
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 3,          // was 5 — less retry traffic
    });

    // 5. Creds update -> save immediately to disk and Supabase
    waSocket.ev.on('creds.update', async () => {
      await saveCreds();
      await saveSessionToDb();
    });

    // 6. Connection updates
    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'SCAN_QR';
        lastError = null;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          console.log('\n🟢 [WhatsApp] QR Code ready — scan at /whatsapp to connect!\n');
        } catch (e) {
          console.error('QR generation error:', e.message);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const errMsg = lastDisconnect?.error?.message || '';
        lastError = `Closed (${statusCode}): ${errMsg}`;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        connectedPhone = null;
        console.log(`🔴 [WhatsApp] Connection closed. StatusCode: ${statusCode} (${errMsg})`);

        if (sessionSaveInterval) { clearInterval(sessionSaveInterval); sessionSaveInterval = null; }

        if (isLoggedOut) {
          console.log('🧹 [WhatsApp] Explicitly logged out from phone — clearing session.');
          await clearSessionFromDb();
          reconnectAttempts = 0;
          scheduleReconnect(2000);
        } else if (isRestartRequired) {
          console.log('🔄 [WhatsApp] Restart required (515) — reconnecting immediately...');
          scheduleReconnect(1000);
        } else {
          // Normal network drop, Render keep-alive blip, or WhatsApp ping timeout:
          // DO NOT delete DB! Just reconnect with existing valid keys!
          scheduleReconnect();
        }
      } else if (connection === 'open') {
        connectionStatus = 'CONNECTED';
        qrCodeDataUrl = null;
        lastError = null;
        connectedPhone = waSocket.user?.id?.split(':')[0] || 'Active';
        reconnectAttempts = 0;
        console.log('✅ [WhatsApp] Connected successfully as:', connectedPhone);

        // Immediately backup all handshake session keys to Supabase
        await saveSessionToDb();

        // Periodic session backup every 13 minutes (saves Render + Supabase bandwidth)
        if (sessionSaveInterval) clearInterval(sessionSaveInterval);
        sessionSaveInterval = setInterval(async () => {
          if (connectionStatus === 'CONNECTED') {
            await saveSessionToDb();
          }
        }, 13 * 60 * 1000);
      }
    });

  } catch (err) {
    console.error('WhatsApp Init Error:', err.message);
    lastError = err.message;
    connectionStatus = 'DISCONNECTED';
    scheduleReconnect();
  } finally {
    isInitializing = false;
  }
}

// ─── Logout (clean, no auto-restart) ─────────────────────────
async function logoutWhatsApp() {
  try {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (sessionSaveInterval) { clearInterval(sessionSaveInterval); sessionSaveInterval = null; }

    if (waSocket) {
      try { await waSocket.logout(); } catch (e) {}
      try { waSocket.end(); } catch (e) {}
      waSocket = null;
    }

    await clearSessionFromDb();

    connectionStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    connectedPhone = null;
    lastError = null;
    reconnectAttempts = 0;
    isInitializing = false;

    console.log('✅ [WhatsApp] Logged out. Open /whatsapp to reconnect.');
    return { success: true, message: 'WhatsApp ડિસ્કનેક્ટ. /whatsapp ખોલી QR સ્કેન કરો.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Status ───────────────────────────────────────────────────
function getWhatsAppStatus() {
  return { status: connectionStatus, qrCode: qrCodeDataUrl, phone: connectedPhone, lastError, attempts: reconnectAttempts };
}

// ─── Send OTP ─────────────────────────────────────────────────
async function sendWhatsAppOTP(mobile, otp, studentName = 'વિદ્યાર્થી') {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const textMessage = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n🔑 OTP: *${otp.split('').join(' ')}*\n\n⏱️ OTP 5 મિનિટ માટે માન્ય છે. 🔒 કોઈ સાથે શેર ન કરશો.\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 https://trinetraacademy.in  📞 8200405300`;
  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      await waSocket.sendMessage(jid, { text: textMessage });
      console.log(`✅ [OTP] Sent via WhatsApp to +91${cleanMobile}`);
      return { success: true, method: 'BAILEYS_WHATSAPP' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  console.log(`⚠️ [WhatsApp Offline] OTP for +91${cleanMobile}: ${otp}`);
  return { success: false, isOffline: true, otp };
}

// ─── Send Scorecard PDF ───────────────────────────────────────
async function sendWhatsAppScorecardPDF(mobile, studentName, testName, score, totalMarks, pdfBuffer) {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const resultStatus = pct >= 75 ? '👑 ઉત્કૃષ્ટ' : pct >= 60 ? '🟢 પાસ' : '🔴 સુધારો';
  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n📊 ${testName} — ${score}/${totalMarks} (${pct}%) — ${resultStatus}\n\n📄 તમારું સ્કોરકાર્ડ PDF ઉપર આપેલ છે. ✨\n🌐 https://trinetraacademy.in`;
  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      const safeName = String(testName || 'Test').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      await waSocket.sendMessage(jid, { document: pdfBuffer, mimetype: 'application/pdf', fileName: `Trinetra_${safeName}.pdf`, caption });
      return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
  }
  return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન.' };
}

// ─── Send Pragati PDF ─────────────────────────────────────────
async function sendWhatsAppPragatiPDF(mobile, studentName, pdfBuffer) {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n📊 તમારો સર્વગ્રાહી પ્રગતિ અહેવાલ (Progress Certificate) PDF ઉપર આપેલ છે. ✨\n🌐 https://trinetraacademy.in`;
  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      const safeName = String(studentName || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      await waSocket.sendMessage(jid, { document: pdfBuffer, mimetype: 'application/pdf', fileName: `Trinetra_Pragati_${safeName}.pdf`, caption });
      return { success: true, message: `📊 PDF (+91${cleanMobile}) WhatsApp પર મોકલાઈ ગઈ!` };
    } catch (err) { return { success: false, error: err.message }; }
  }
  return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન.' };
}

// ─── Send Daily Report ────────────────────────────────────────
async function sendWhatsAppDailyReport(targetMobile = '8200405300') {
  if (!waSocket || connectionStatus !== 'CONNECTED') {
    return { success: false, isOffline: true, error: 'WhatsApp ડિસ્કનેક્ટ છે. QR સ્કેન કરો.' };
  }
  try {
    const cleanMobile = cleanIndianMobile(targetMobile);
    const jid = `91${cleanMobile}@s.whatsapp.net`;
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const submissions = await prisma.submission.findMany({
      where: { submittedAt: { gte: twentyFourHoursAgo }, status: 'COMPLETED' },
      include: { student: true },
      orderBy: { submittedAt: 'desc' }
    });
    const totalSubs = submissions.length;
    const uniqueStudents = new Set(submissions.map(s => s.student?.mobile).filter(Boolean)).size;
    const avgScore = totalSubs > 0 ? (submissions.reduce((acc, s) => acc + (s.mcqScore ?? s.score ?? 0), 0) / totalSubs).toFixed(1) : 0;
    const topScorers = [...submissions].sort((a, b) => (b.mcqScore ?? 0) - (a.mcqScore ?? 0)).slice(0, 3).map((s, i) => `  ${i + 1}. *${s.student?.name || 'Student'}*: ${s.mcqScore} (${s.testName || s.testCode})`).join('\n');
    const cheatingCount = submissions.filter(s => s.remarks && s.remarks.includes('સ્ક્રીન સ્વિચ')).length;
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const istDate = istNow.toLocaleDateString('gu-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const istTime = istNow.toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const message = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી - દૈનિક અહેવાલ* 📊\n━━━━━━━━━━━━━━━━━━━━━━\n📅 *તારીખ:* ${istDate} (${istTime})\n👨‍🏫 *ડિરેક્ટર:* સુનિલ સર\n\n📈 *છેલ્લા ૨૪ કલાક:*\n👥 *વિદ્યાર્થીઓ:* ${uniqueStudents}\n📝 *કસોટીઓ:* ${totalSubs}\n🎯 *સરેરાશ:* ${avgScore} ગુણ\n${cheatingCount > 0 ? `⚠️ *ઉલ્લંઘન:* ${cheatingCount}\n` : ''}${topScorers ? `🏆 *ટોપ:*\n${topScorers}\n` : 'ℹ️ આજે કોઈ કસોટી નથી.\n'}\n━━━━━━━━━━━━━━━━━━━━━━\n✅ Render & DB Active\n🌐 https://www.trinetraonline.in/teacher`;
    await waSocket.sendMessage(jid, { text: message });
    console.log(`✅ [Daily Report] Sent to +91${cleanMobile}`);
    return { success: true, message: `અહેવાલ (+91${cleanMobile}) WhatsApp પર મોકલાયો!` };
  } catch (err) {
    console.error('❌ [Daily Report]:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  initWhatsApp,
  hasSavedSession,
  sendWhatsAppOTP,
  sendWhatsAppScorecardPDF,
  sendWhatsAppPragatiPDF,
  sendWhatsAppDailyReport,
  getWhatsAppStatus,
  logoutWhatsApp
};
