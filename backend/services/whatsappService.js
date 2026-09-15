/**
 * whatsappService.js — Trinetra Online Academy
 * ─────────────────────────────────────────────
 * ✅ ZERO disk usage: All Baileys state kept IN MEMORY
 * ✅ Only creds.json backed to Supabase DB (~5KB total)
 * ✅ 24/7 auto-reconnect on network drops
 * ✅ Clean logout with no auto-restart
 * ✅ Render 5GB storage NOT consumed
 */

const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  initAuthCreds,
  BufferJSON
} = require('@whiskeysockets/baileys');
const pino = require('pino');
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
let connectionWatchdog = null;
let lastError = null;

// ─── Helper: Clean Indian Mobile ──────────────────────────────
function cleanIndianMobile(rawMobile) {
  const digits = String(rawMobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// ─── Supabase DB: creds.json only (~5KB) ──────────────────────
async function ensureDbSessionTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id VARCHAR(255) PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) { /* already exists */ }
}

async function loadCredsFromDb() {
  try {
    await ensureDbSessionTable();
    const rows = await prisma.$queryRawUnsafe(
      `SELECT data FROM whatsapp_sessions WHERE id = 'creds.json' LIMIT 1`
    );
    if (rows && rows.length > 0 && rows[0].data) {
      return JSON.parse(rows[0].data, BufferJSON.reviver);
    }
  } catch (e) {
    console.warn('⚠️ [WhatsApp] Could not load creds from DB:', e.message);
  }
  return null;
}

async function saveCredsToDb(creds) {
  try {
    const data = JSON.stringify(creds, BufferJSON.replacer);
    await prisma.$executeRawUnsafe(`
      INSERT INTO whatsapp_sessions (id, data, updated_at)
      VALUES ('creds.json', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()
    `, data);
  } catch (e) {
    console.warn('⚠️ [WhatsApp] Could not save creds to DB:', e.message);
  }
}

async function clearCredsFromDb() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM whatsapp_sessions`);
    console.log('🗑️ [WhatsApp] Session cleared from DB.');
  } catch (e) {
    console.warn('⚠️ [WhatsApp] Could not clear DB:', e.message);
  }
}

// ─── Custom IN-MEMORY Auth State (ZERO disk writes) ───────────
async function useDbAuthState() {
  const savedCreds = await loadCredsFromDb();
  let creds = savedCreds || initAuthCreds();

  // In-memory signal key store — stays in RAM, never hits disk
  const keys = {};

  const state = {
    creds,
    keys: {
      get: (type, ids) => {
        const data = {};
        for (const id of ids) {
          const val = keys[`${type}-${id}`];
          if (val) data[id] = val;
        }
        return data;
      },
      set: (data) => {
        for (const [type, entries] of Object.entries(data)) {
          for (const [id, val] of Object.entries(entries)) {
            if (val != null) {
              keys[`${type}-${id}`] = val;
            } else {
              delete keys[`${type}-${id}`];
            }
          }
        }
      }
    }
  };

  const saveCreds = async () => {
    await saveCredsToDb(state.creds);
  };

  return { state, saveCreds };
}

// ─── Reconnect Scheduler ──────────────────────────────────────
function scheduleReconnect(forceDelay) {
  if (reconnectTimer) return;
  const delay = forceDelay !== undefined
    ? forceDelay
    : Math.min(3000 * Math.pow(1.5, reconnectAttempts), 30000);
  reconnectAttempts++;
  console.log(`🔄 [WhatsApp] Reconnecting in ${Math.round(delay / 1000)}s (attempt #${reconnectAttempts})...`);
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
    const { state, saveCreds } = await useDbAuthState();

    let version = [2, 3000, 1043857760];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v && v.version) version = v.version;
    } catch (e) {
      console.warn('⚠️ [WhatsApp] Using fallback Baileys version.');
    }

    if (waSocket) {
      try { waSocket.end(); } catch (e) {}
      waSocket = null;
    }

    waSocket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
    });

    waSocket.ev.on('creds.update', async () => {
      await saveCreds();
    });

    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'SCAN_QR';
        lastError = null;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          console.log('\n🟢 [WhatsApp] QR Code ready — scan to connect!\n');
        } catch (e) {
          console.error('QR error:', e.message);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const errMsg = lastDisconnect?.error?.message || '';
        lastError = `Closed (${statusCode}): ${errMsg}`;

        const isAuthFailure =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.forbidden ||
          statusCode === DisconnectReason.badSession ||
          statusCode === 401 || statusCode === 403;

        const isRestartRequired =
          statusCode === DisconnectReason.restartRequired || statusCode === 515;

        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        connectedPhone = null;
        console.log(`🔴 [WhatsApp] Closed. Code: ${statusCode}, AuthFail: ${isAuthFailure}`);

        if (sessionSaveInterval) { clearInterval(sessionSaveInterval); sessionSaveInterval = null; }
        if (connectionWatchdog) { clearInterval(connectionWatchdog); connectionWatchdog = null; }

        if (isAuthFailure) {
          console.log('🧹 [WhatsApp] Auth failure — clearing DB session, fresh QR needed.');
          await clearCredsFromDb();
          reconnectAttempts = 0;
          scheduleReconnect(1500);
        } else if (isRestartRequired) {
          scheduleReconnect(1000);
        } else {
          // Network drop — 24/7 auto-reconnect
          scheduleReconnect();
        }
      } else if (connection === 'open') {
        connectionStatus = 'CONNECTED';
        qrCodeDataUrl = null;
        lastError = null;
        connectedPhone = waSocket.user?.id?.split(':')[0] || 'Active';
        reconnectAttempts = 0;
        console.log('✅ [WhatsApp] Connected as:', connectedPhone);

        // Periodic creds backup to DB every 5 minutes
        if (sessionSaveInterval) clearInterval(sessionSaveInterval);
        sessionSaveInterval = setInterval(async () => {
          if (connectionStatus === 'CONNECTED') await saveCreds();
        }, 5 * 60 * 1000);

        // Watchdog
        if (connectionWatchdog) clearInterval(connectionWatchdog);
        connectionWatchdog = setInterval(() => {
          if (connectionStatus !== 'CONNECTED') {
            clearInterval(connectionWatchdog);
            connectionWatchdog = null;
            scheduleReconnect();
          }
        }, 60 * 1000);
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
    if (connectionWatchdog) { clearInterval(connectionWatchdog); connectionWatchdog = null; }

    if (waSocket) {
      try { await waSocket.logout(); } catch (e) {}
      try { waSocket.end(); } catch (e) {}
      waSocket = null;
    }

    await clearCredsFromDb();

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
  const textMessage = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n🔑 OTP: *${otp.split('').join(' ')}*\n\n⏱️ OTP 5 મિનિટ માટે. 🔒 OTP share ન કરશો.\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 https://trinetraacademy.in  📞 8200405300`;
  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      await waSocket.sendMessage(jid, { text: textMessage });
      console.log(`✅ [OTP] Sent to +91${cleanMobile}`);
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
  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n📊 ${testName} — ${score}/${totalMarks} (${pct}%) — ${resultStatus}\n\n📄 PDF ઉપર છે. ✨ 🌐 https://trinetraacademy.in`;
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
  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*, 📊 પ્રગતિ રિપોર્ટ PDF ઉપર. ✨ 🌐 https://trinetraacademy.in`;
  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      const safeName = String(studentName || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      await waSocket.sendMessage(jid, { document: pdfBuffer, mimetype: 'application/pdf', fileName: `Trinetra_Pragati_${safeName}.pdf`, caption });
      return { success: true, message: `📊 PDF (+91${cleanMobile}) WhatsApp પર!` };
    } catch (err) { return { success: false, error: err.message }; }
  }
  return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન.' };
}

// ─── Send Daily Report ────────────────────────────────────────
async function sendWhatsAppDailyReport(targetMobile = '8200405300') {
  if (!waSocket || connectionStatus !== 'CONNECTED') {
    return { success: false, isOffline: true, error: 'WhatsApp ડિસ્કનેક્ટ. QR સ્કેન કરો.' };
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
    return { success: true, message: `અહેવાલ (+91${cleanMobile}) WhatsApp પર!` };
  } catch (err) {
    console.error('❌ [Daily Report]:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { initWhatsApp, sendWhatsAppOTP, sendWhatsAppScorecardPDF, sendWhatsAppPragatiPDF, sendWhatsAppDailyReport, getWhatsAppStatus, logoutWhatsApp };
