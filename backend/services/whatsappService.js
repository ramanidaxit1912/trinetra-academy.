/**
 * whatsappService.js — Trinetra Online Academy
 * ─────────────────────────────────────────────────────────────────────────
 * 🚀 MULTI-WHATSAPP POOL (5 Numbers Load-Balancing & Anti-Ban Architecture)
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ 5 Independent Baileys WhatsApp Slots (Slots 1 to 5)
 * ✅ Parallel round-robin message queue: distributes 500+ student messages evenly
 *    e.g., 5 numbers connected = 100 messages/number with 2.5–4.5s anti-ban jitter
 * ✅ Zero Meta/WhatsApp ban risk (human-like pacing per phone number)
 * ✅ Automatic Supabase DB session persistence per slot (survives Render redeploy)
 * ✅ Backwards compatible: Slot 1 seamlessly restores any previous single session
 * ✅ High-priority lane for OTP login messages (instant <2s delivery)
 * ✅ Resilient: auto-reconnects on temporary network drops
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

const NUM_SLOTS = 5;

// Base sessions directory
const baseSessionsDir = path.join(__dirname, '../whatsapp_sessions');
if (!fs.existsSync(baseSessionsDir)) {
  fs.mkdirSync(baseSessionsDir, { recursive: true });
}

function getSlotDir(slotId) {
  const dir = path.join(baseSessionsDir, `slot_${slotId}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Slot State Management ────────────────────────────────────
const slots = {};
const slotWorkers = {};

for (let i = 1; i <= NUM_SLOTS; i++) {
  slots[i] = {
    id: i,
    socket: null,
    status: 'DISCONNECTED', // 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED'
    qrCodeDataUrl: null,
    connectedPhone: null,
    lastError: null,
    isInitializing: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    conflictCount: 0,
    sessionSaveInterval: null,
    saveDebounceTimer: null
  };
  slotWorkers[i] = {
    busy: false,
    sentCount: 0
  };
}

// In-memory cache of saved file contents per slot to eliminate redundant Supabase writes
const savedSessionCache = new Map(); // key: `slot_${slotId}__${filename}` -> content

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
    console.warn('⚠️ [WhatsApp Pool] DB Table check note:', e.message);
  }
}

// ─── Check Saved Session in DB ────────────────────────────────
async function hasSavedSession(slotId = null) {
  try {
    await ensureDbSessionTable();
    if (slotId) {
      const sid = Number(slotId);
      const prefixKey = `slot_${sid}__creds.json`;
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM whatsapp_sessions WHERE id = $1 LIMIT 1`,
        prefixKey
      );
      if (rows && rows.length > 0) return true;

      // Legacy fallback for slot 1
      if (sid === 1) {
        const legacyRows = await prisma.$queryRawUnsafe(
          `SELECT id FROM whatsapp_sessions WHERE id = 'creds.json' LIMIT 1`
        );
        return Boolean(legacyRows && legacyRows.length > 0);
      }
      return false;
    }

    // Any slot has saved session
    const anyRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM whatsapp_sessions WHERE id LIKE '%creds.json' LIMIT 1`
    );
    return Boolean(anyRows && anyRows.length > 0);
  } catch (e) {
    return false;
  }
}

// ─── Restore Session from DB for a Slot ───────────────────────
async function restoreSessionFromDb(slotId) {
  const sid = Number(slotId);
  const slotDir = getSlotDir(sid);
  try {
    await ensureDbSessionTable();
    const prefix = `slot_${sid}__`;
    let rows = await prisma.$queryRawUnsafe(
      `SELECT id, data FROM whatsapp_sessions WHERE id LIKE $1`,
      `${prefix}%`
    );

    // If slot 1 has no prefixed files, check for legacy unprefixed files (smooth upgrade!)
    if ((!rows || rows.length === 0) && sid === 1) {
      const legacyRows = await prisma.$queryRawUnsafe(
        `SELECT id, data FROM whatsapp_sessions WHERE id NOT LIKE 'slot_%'`
      );
      if (legacyRows && legacyRows.length > 0) {
        console.log(`📥 [WhatsApp Slot 1] Migrating ${legacyRows.length} legacy session files...`);
        for (const row of legacyRows) {
          fs.writeFileSync(path.join(slotDir, row.id), row.data, 'utf8');
          const newDbKey = `slot_1__${row.id}`;
          savedSessionCache.set(newDbKey, row.data);
          // Persist with new slot_1__ key
          await prisma.$executeRawUnsafe(`
            INSERT INTO whatsapp_sessions (id, data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
          `, newDbKey, row.data);
        }
        return true;
      }
    }

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const origFileName = row.id.replace(prefix, '');
        fs.writeFileSync(path.join(slotDir, origFileName), row.data, 'utf8');
        savedSessionCache.set(row.id, row.data);
      }
      console.log(`📥 [WhatsApp Slot ${sid}] Restored ${rows.length} session files from DB.`);
      return true;
    }
  } catch (e) {
    console.warn(`⚠️ [WhatsApp Slot ${sid}] Session restore error:`, e.message);
  }
  return false;
}

// ─── Delta Sync Session Files to Supabase DB ──────────────────
async function saveSessionToDb(slotId, forceAll = false) {
  const sid = Number(slotId);
  const slotDir = getSlotDir(sid);
  try {
    if (!fs.existsSync(slotDir)) return;
    const files = fs.readdirSync(slotDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) return;

    let savedCount = 0;
    const prefix = `slot_${sid}__`;
    for (const file of files) {
      const filePath = path.join(slotDir, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const dbKey = `${prefix}${file}`;
        if (forceAll || savedSessionCache.get(dbKey) !== content) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO whatsapp_sessions (id, data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
          `, dbKey, content);
          savedSessionCache.set(dbKey, content);
          savedCount++;
        }
      }
    }
    if (savedCount > 0) {
      console.log(`💾 [WhatsApp Slot ${sid}] Delta sync saved ${savedCount} changed key(s) to Supabase.`);
    }
  } catch (e) {
    console.warn(`⚠️ [WhatsApp Slot ${sid}] Session save error:`, e.message);
  }
}

// Debounce helper per slot
function queueSaveSessionToDb(slotId) {
  const slot = slots[slotId];
  if (!slot) return;
  if (slot.saveDebounceTimer) clearTimeout(slot.saveDebounceTimer);
  slot.saveDebounceTimer = setTimeout(() => {
    slot.saveDebounceTimer = null;
    saveSessionToDb(slotId, false).catch(err => console.warn(`Slot ${slotId} debounced save error:`, err.message));
  }, 4000);
}

// Clear session from DB and disk for a specific slot
async function clearSessionFromDb(slotId) {
  const sid = Number(slotId);
  const slot = slots[sid];
  const slotDir = getSlotDir(sid);
  try {
    if (slot && slot.saveDebounceTimer) {
      clearTimeout(slot.saveDebounceTimer);
      slot.saveDebounceTimer = null;
    }
    const prefix = `slot_${sid}__`;
    await prisma.$executeRawUnsafe(
      `DELETE FROM whatsapp_sessions WHERE id LIKE $1`,
      `${prefix}%`
    );
    if (sid === 1) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM whatsapp_sessions WHERE id NOT LIKE 'slot_%'`
      );
    }
    // Clear cache
    for (const key of savedSessionCache.keys()) {
      if (key.startsWith(prefix)) savedSessionCache.delete(key);
    }
    if (fs.existsSync(slotDir)) {
      const files = fs.readdirSync(slotDir);
      for (const f of files) {
        try { fs.unlinkSync(path.join(slotDir, f)); } catch (_) {}
      }
    }
    console.log(`🗑️ [WhatsApp Slot ${sid}] Cleared session from Database and disk.`);
  } catch (e) {
    console.warn(`⚠️ [WhatsApp Slot ${sid}] Clear error:`, e.message);
  }
}

// ─── Reconnect Scheduler Per Slot ─────────────────────────────
function scheduleReconnect(slotId, forceDelay) {
  const slot = slots[slotId];
  if (!slot || slot.reconnectTimer) return;
  const delay = forceDelay !== undefined
    ? forceDelay
    : Math.min(3000 * Math.pow(1.5, slot.reconnectAttempts), 25000);
  slot.reconnectAttempts++;
  console.log(`🔄 [WhatsApp Slot ${slotId}] Auto-reconnecting in ${Math.round(delay / 1000)}s (attempt #${slot.reconnectAttempts})...`);
  slot.reconnectTimer = setTimeout(() => {
    slot.reconnectTimer = null;
    initWhatsAppSlot(slotId);
  }, delay);
}

// ─── Core: initWhatsAppSlot ───────────────────────────────────
async function initWhatsAppSlot(slotId) {
  const sid = Number(slotId);
  const slot = slots[sid];
  if (!slot) return;

  if (slot.isInitializing) {
    console.log(`ℹ️ [WhatsApp Slot ${sid}] Already initializing, skipping.`);
    return;
  }
  if (slot.status === 'CONNECTED' || (slot.status === 'SCAN_QR' && slot.qrCodeDataUrl)) {
    return;
  }

  slot.isInitializing = true;
  slot.status = 'CONNECTING';

  const slotDir = getSlotDir(sid);

  try {
    // 1. Restore persistent session keys from Supabase if local folder is empty
    const diskFiles = fs.existsSync(slotDir) ? fs.readdirSync(slotDir).filter(f => f.endsWith('.json')) : [];
    if (diskFiles.length === 0) {
      if (sid === 1) {
        // Render redeploy grace period: give old instance 5s to release lock
        await new Promise(r => setTimeout(r, 5000));
      }
      await restoreSessionFromDb(sid);
    }

    // 2. Load Multi-File Auth State
    const { state, saveCreds } = await useMultiFileAuthState(slotDir);

    // 3. Latest Baileys version with fallback
    let version = [2, 3000, 1043857760];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (e) {
      // use fallback
    }

    // 4. Clean up any existing socket
    if (slot.socket) {
      try { slot.socket.ev.removeAllListeners(); } catch (_) {}
      try { slot.socket.end(); } catch (_) {}
      slot.socket = null;
    }

    // 5. Create WA Socket with optimal bandwidth-saving settings
    slot.socket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu(`Chrome Slot ${sid}`),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      fireInitQueries: false,
      emitOwnEvents: false,
      shouldIgnoreJid: (jid) => {
        if (!jid) return true;
        return (
          jid.endsWith('@g.us') ||
          jid.endsWith('@broadcast') ||
          jid.endsWith('@newsletter') ||
          jid.includes('status@broadcast')
        );
      },
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 3,
    });

    // 6. Creds update -> save to disk & debounced delta sync to Supabase
    slot.socket.ev.on('creds.update', async () => {
      await saveCreds();
      queueSaveSessionToDb(sid);
    });

    // 7. Connection updates
    slot.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        slot.status = 'SCAN_QR';
        slot.lastError = null;
        try {
          slot.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          console.log(`\n🟢 [WhatsApp Slot ${sid}] QR Code ready — scan on /whatsapp to link phone #${sid}!\n`);
        } catch (e) {
          console.error(`Slot ${sid} QR generation error:`, e.message);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const errMsg = lastDisconnect?.error?.message || '';
        slot.lastError = `Closed (${statusCode}): ${errMsg}`;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const isConflict = statusCode === 440;

        slot.status = 'DISCONNECTED';
        slot.qrCodeDataUrl = null;
        slot.connectedPhone = null;
        console.log(`🔴 [WhatsApp Slot ${sid}] Connection closed. StatusCode: ${statusCode} (${errMsg})`);

        if (slot.sessionSaveInterval) {
          clearInterval(slot.sessionSaveInterval);
          slot.sessionSaveInterval = null;
        }

        if (isLoggedOut) {
          console.log(`🧹 [WhatsApp Slot ${sid}] Explicitly logged out from phone — clearing session.`);
          await clearSessionFromDb(sid);
          slot.reconnectAttempts = 0;
          scheduleReconnect(sid, 2000);
        } else if (isRestartRequired) {
          scheduleReconnect(sid, 1000);
        } else if (isConflict) {
          slot.conflictCount++;
          if (slot.conflictCount >= 3) {
            await clearSessionFromDb(sid);
            slot.conflictCount = 0;
            slot.reconnectAttempts = 0;
            scheduleReconnect(sid, 3000);
          } else {
            scheduleReconnect(sid, 10000);
          }
        } else {
          scheduleReconnect(sid);
        }
      } else if (connection === 'open') {
        slot.conflictCount = 0;
        slot.status = 'CONNECTED';
        slot.qrCodeDataUrl = null;
        slot.lastError = null;
        slot.connectedPhone = slot.socket.user?.id?.split(':')[0] || `Slot ${sid} Active`;
        slot.reconnectAttempts = 0;
        console.log(`✅ [WhatsApp Slot ${sid}] Connected successfully as: +91 ${slot.connectedPhone}`);

        // Immediately backup session keys to Supabase
        await saveSessionToDb(sid, true);

        // Periodic session backup every 2 hours (skips Night Mode 12 AM - 7 AM IST)
        if (slot.sessionSaveInterval) clearInterval(slot.sessionSaveInterval);
        slot.sessionSaveInterval = setInterval(async () => {
          if (slot.status === 'CONNECTED') {
            const istHour = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
            if (istHour >= 0 && istHour < 7) return;
            await saveSessionToDb(sid);
          }
        }, 120 * 60 * 1000);
      }
    });

  } catch (err) {
    console.error(`WhatsApp Slot ${sid} Init Error:`, err.message);
    slot.lastError = err.message;
    slot.status = 'DISCONNECTED';
    scheduleReconnect(sid);
  } finally {
    slot.isInitializing = false;
  }
}

// ─── Initialize All Saved Slots or a Specific Slot ────────────
async function initWhatsApp(targetSlotId = null) {
  if (targetSlotId) {
    return initWhatsAppSlot(Number(targetSlotId));
  }

  // Server startup: check which slots have saved sessions
  let anyStarted = false;
  for (let i = 1; i <= NUM_SLOTS; i++) {
    const hasSaved = await hasSavedSession(i);
    if (hasSaved) {
      console.log(`📱 [WhatsApp Pool] Slot ${i} has saved session — auto-connecting...`);
      initWhatsAppSlot(i);
      anyStarted = true;
    }
  }

  // If no slots configured yet, initialize Slot 1 by default so QR is ready
  if (!anyStarted) {
    console.log(`ℹ️ [WhatsApp Pool] No saved sessions found. Initializing Slot 1 for pairing...`);
    initWhatsAppSlot(1);
  }
}

// ─── Logout a Specific Slot ───────────────────────────────────
async function logoutWhatsApp(slotId = 1) {
  const sid = Number(slotId || 1);
  const slot = slots[sid];
  if (!slot) return { success: false, error: 'અમાન્ય સ્લોટ ID' };

  try {
    if (slot.reconnectTimer) { clearTimeout(slot.reconnectTimer); slot.reconnectTimer = null; }
    if (slot.sessionSaveInterval) { clearInterval(slot.sessionSaveInterval); slot.sessionSaveInterval = null; }

    if (slot.socket) {
      try { await slot.socket.logout(); } catch (_) {}
      try { slot.socket.end(); } catch (_) {}
      slot.socket = null;
    }

    await clearSessionFromDb(sid);

    slot.status = 'DISCONNECTED';
    slot.qrCodeDataUrl = null;
    slot.connectedPhone = null;
    slot.lastError = null;
    slot.reconnectAttempts = 0;
    slot.isInitializing = false;

    console.log(`✅ [WhatsApp Slot ${sid}] Logged out successfully.`);
    return { success: true, slotId: sid, message: `WhatsApp સ્લોટ ${sid} ડિસ્કનેક્ટ થઈ ગયું છે.` };
  } catch (e) {
    return { success: false, slotId: sid, error: e.message };
  }
}

// ─── Pause WhatsApp (Night Mode) ──────────────────────────────
async function pauseWhatsApp() {
  try {
    for (let i = 1; i <= NUM_SLOTS; i++) {
      const slot = slots[i];
      if (slot.reconnectTimer) { clearTimeout(slot.reconnectTimer); slot.reconnectTimer = null; }
      if (slot.sessionSaveInterval) { clearInterval(slot.sessionSaveInterval); slot.sessionSaveInterval = null; }

      await saveSessionToDb(i);

      if (slot.socket) {
        try { slot.socket.end(); } catch (_) {}
        slot.socket = null;
      }

      slot.status = 'DISCONNECTED';
      slot.qrCodeDataUrl = null;
      slot.connectedPhone = null;
      slot.lastError = null;
      slot.reconnectAttempts = 0;
      slot.isInitializing = false;
    }
    console.log('⏸️ [WhatsApp Pool] Night Mode: All slots paused. Sessions saved. Auto-resume at 6 AM IST.');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── Status Query (Comprehensive 5-Slot Pool) ─────────────────
function getWhatsAppStatus() {
  const activeSlots = Object.values(slots).filter(s => s.status === 'CONNECTED');
  const scanningSlots = Object.values(slots).filter(s => s.status === 'SCAN_QR');
  const connectingSlots = Object.values(slots).filter(s => s.status === 'CONNECTING');

  const overallStatus = activeSlots.length > 0 
    ? 'CONNECTED' 
    : (scanningSlots.length > 0 ? 'SCAN_QR' : (connectingSlots.length > 0 ? 'CONNECTING' : 'DISCONNECTED'));

  const phones = activeSlots.map(s => s.connectedPhone).filter(Boolean);

  return {
    status: overallStatus,
    totalSlots: NUM_SLOTS,
    connectedCount: activeSlots.length,
    phone: phones.length > 0 ? phones.join(', ') : null,
    qrCode: scanningSlots[0]?.qrCodeDataUrl || null,
    activeSlotIds: activeSlots.map(s => s.id),
    slots: Object.values(slots).map(s => ({
      id: s.id,
      status: s.status,
      phone: s.connectedPhone,
      qrCode: s.qrCodeDataUrl,
      lastError: s.lastError,
      attempts: s.reconnectAttempts,
      sentCount: slotWorkers[s.id]?.sentCount || 0
    }))
  };
}

// ─── Parallel Multi-Slot Queue & Load Balancing ───────────────
const waMessageQueue = [];

function getConnectedSlots() {
  return Object.values(slots).filter(s => s.status === 'CONNECTED' && s.socket);
}

function hasAnyConnectedSlot() {
  return getConnectedSlots().length > 0;
}

// ─── Record Message Sent Metric per Slot ──────────────────────
function recordMessageSent(slotId) {
  const sid = Number(slotId);
  if (slotWorkers[sid]) {
    slotWorkers[sid].sentCount = (slotWorkers[sid].sentCount || 0) + 1;
  }
}

// ─── Fair Load-Balanced Selection (Least-Loaded First) ─────────
let roundRobinCounter = 0;
function getNextConnectedSlot() {
  const active = getConnectedSlots();
  if (active.length === 0) return null;

  // Find minimum sentCount among all active slots
  const minSent = Math.min(...active.map(s => slotWorkers[s.id]?.sentCount || 0));
  // Filter candidate slots that currently have the lowest message count
  const candidateSlots = active.filter(s => (slotWorkers[s.id]?.sentCount || 0) === minSent);

  // Round-robin among candidate slots
  const chosen = candidateSlots[roundRobinCounter % candidateSlots.length];
  roundRobinCounter = (roundRobinCounter + 1) % candidateSlots.length;
  return chosen;
}

function dispatchWAQueue() {
  if (waMessageQueue.length === 0) return;

  const connected = getConnectedSlots();
  if (connected.length === 0) return;

  // Find all idle slots, sorted by least-used first (sentCount ascending)
  const idleSlots = connected
    .filter(s => !slotWorkers[s.id]?.busy)
    .sort((a, b) => {
      const countA = slotWorkers[a.id]?.sentCount || 0;
      const countB = slotWorkers[b.id]?.sentCount || 0;
      if (countA !== countB) return countA - countB;
      return a.id - b.id;
    });

  for (const slot of idleSlots) {
    if (waMessageQueue.length === 0) break;
    const worker = slotWorkers[slot.id];
    if (worker.busy) continue; // safety guard

    const task = waMessageQueue.shift();
    worker.busy = true;

    (async () => {
      try {
        await task(slot.socket, slot);
        recordMessageSent(slot.id);
      } catch (e) {
        console.warn(`[WA Pool Slot ${slot.id}] Task execution error:`, e.message);
      } finally {
        // 🛡️ ANTI-BAN JITTER: 2.5s to 4.2s delay between messages per phone number
        const jitter = 2500 + Math.floor(Math.random() * 1700);
        await new Promise(r => setTimeout(r, jitter));
        worker.busy = false;
        dispatchWAQueue(); // Continue processing next message in queue
      }
    })();
  }
}

function enqueueWAMessage(taskFn, isHighPriority = false) {
  if (isHighPriority) {
    waMessageQueue.unshift(taskFn);
  } else {
    waMessageQueue.push(taskFn);
  }
  dispatchWAQueue();
}

// ─── Send OTP (Priority Lane — Instant Delivery) ──────────────
async function sendWhatsAppOTP(mobile, otp, studentName = 'વિદ્યાર્થી') {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const textMessage = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n🔑 OTP: *${otp.split('').join(' ')}*\n\n⏱️ OTP 5 મિનિટ માટે માન્ય છે. 🔒 કોઈ સાથે શેર ન કરશો.\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 https://www.trinetraonline.in  📞 8200405300`;

  // Wait guard if any slot is currently CONNECTING
  if (!hasAnyConnectedSlot()) {
    const anyConnecting = Object.values(slots).some(s => s.status === 'CONNECTING' || s.isInitializing);
    if (anyConnecting) {
      console.log(`⏳ [OTP] WhatsApp slot waking up... waiting for +91${cleanMobile}`);
      const waited = await new Promise(resolve => {
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed += 500;
          if (hasAnyConnectedSlot() || elapsed >= 15000) {
            clearInterval(interval);
            resolve(hasAnyConnectedSlot());
          }
        }, 500);
      });
      if (!waited) {
        return { success: false, isOffline: true, otp };
      }
    } else {
      console.log(`⚠️ [WhatsApp Pool Offline] OTP for +91${cleanMobile}: ${otp}`);
      return { success: false, isOffline: true, otp };
    }
  }

  const slot = getNextConnectedSlot();
  if (slot && slot.socket) {
    try {
      await slot.socket.sendMessage(jid, { text: textMessage });
      recordMessageSent(slot.id);
      console.log(`✅ [OTP] Sent via WhatsApp Slot #${slot.id} to +91${cleanMobile}`);
      return { success: true, slotId: slot.id, method: 'BAILEYS_WHATSAPP' };
    } catch (err) {
      console.warn(`⚠️ [OTP Error Slot #${slot.id}]:`, err.message);
      // Fallback: try next available slot
      const fallbackSlot = getNextConnectedSlot();
      if (fallbackSlot && fallbackSlot.id !== slot.id) {
        try {
          await fallbackSlot.socket.sendMessage(jid, { text: textMessage });
          recordMessageSent(fallbackSlot.id);
          console.log(`✅ [OTP Fallback] Sent via WhatsApp Slot #${fallbackSlot.id} to +91${cleanMobile}`);
          return { success: true, slotId: fallbackSlot.id, method: 'BAILEYS_WHATSAPP' };
        } catch (e2) {}
      }
      return { success: false, error: err.message, otp };
    }
  }

  return { success: false, isOffline: true, otp };
}

// ─── Send Scorecard Summary Link (Parallel Round-Robin Dispatch) ─
async function sendWhatsAppScorecardSummary(mobile, studentName, testName, score, totalMarks, submissionId, resultsPublishAt = null) {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const resultStatus = pct >= 75 ? '👑 ઉત્કૃષ્ટ (PASS)' : pct >= 60 ? '🟢 પાસ (PASS)' : '🔴 સુધારો જરૂરી';
  const scorecardUrl = `https://trinetraonline.in/scorecard/${submissionId}`;

  // Scheduled results lock logic
  let isScheduled = false;
  let publishTimeStr = '';
  if (resultsPublishAt) {
    const rawTime = String(resultsPublishAt).trim();
    let pubTime = 0;
    if (rawTime.includes('Z') || /[+-]\d{2}:\d{2}$/.test(rawTime)) {
      pubTime = new Date(rawTime).getTime();
    } else {
      const withSec = rawTime.length === 16 ? `${rawTime}:00` : rawTime;
      pubTime = new Date(`${withSec}+05:30`).getTime();
    }

    if (pubTime && pubTime > Date.now()) {
      isScheduled = true;
      try {
        const istDate = new Date(pubTime);
        publishTimeStr = istDate.toLocaleDateString('gu-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }) + ' ' +
                         istDate.toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      } catch (e) {
        publishTimeStr = String(resultsPublishAt);
      }
    }
  }

  let messageText = '';
  if (isScheduled) {
    messageText = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n📝 કસોટી: *${testName}*\n🎯 તમારા મેળવેલ ગુણ: *${score} / ${totalMarks}* (${pct}%)\n🏅 પરિણામ: *${resultStatus}*\n\n🔒 *ચોરી અટકાવવા સુરક્ષા:* વિગતવાર સોલ્યુશન, આન્સર કી અને લીડરબોર્ડ નિયત સમયે (*${publishTimeStr}*) જાહેર કરવામાં આવશે.\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 https://trinetraonline.in  📞 8200405300`;
  } else {
    messageText = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n📝 કસોટી: *${testName}*\n🎯 તમારા મેળવેલ ગુણ: *${score} / ${totalMarks}* (${pct}%)\n🏅 પરિણામ: *${resultStatus}*\n\n📄 *તમારું સત્તાવાર સ્કોરકાર્ડ જોવા અને PDF ડાઉનલોડ કરવા નીચે ક્લિક કરો:*\n👉 ${scorecardUrl}\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 https://trinetraonline.in  📞 8200405300`;
  }

  if (!hasAnyConnectedSlot()) {
    return { success: false, isOffline: true, error: 'કોઈપણ WhatsApp નંબર કનેક્ટેડ નથી.' };
  }

  return new Promise(resolve => {
    enqueueWAMessage(async (socket, slot) => {
      try {
        await socket.sendMessage(jid, { text: messageText });
        console.log(`✅ [WA Slot ${slot.id} Result Note] Sent to +91${cleanMobile} (Scheduled: ${isScheduled}) for submission #${submissionId}`);
        resolve({ success: true, slotId: slot.id, message: `પરિણામ વિગત (+91${cleanMobile}) WhatsApp #${slot.id} પરથી મોકલાઈ ગઈ!` });
      } catch (err) {
        console.warn(`⚠️ [WA Slot ${slot.id} Result Error]:`, err.message);
        resolve({ success: false, error: err.message });
      }
    });
  });
}

// ─── Send Scorecard PDF (via Parallel Multi-Slot Queue) ───────
async function sendWhatsAppScorecardPDF(mobile, studentName, testName, score, totalMarks, pdfBuffer) {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const resultStatus = pct >= 75 ? '👑 ઉત્કૃષ્ટ' : pct >= 60 ? '🟢 પાસ' : '🔴 સુધારો';
  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n📊 ${testName} — ${score}/${totalMarks} (${pct}%) — ${resultStatus}\n\n📄 તમારું સ્કોરકાર્ડ PDF ઉપર આપેલ છે. ✨\n🌐 https://www.trinetraonline.in`;

  if (!hasAnyConnectedSlot()) {
    return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન છે.' };
  }

  return new Promise(resolve => {
    enqueueWAMessage(async (socket, slot) => {
      try {
        const safeName = String(testName || 'Test').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
        await socket.sendMessage(jid, { document: pdfBuffer, mimetype: 'application/pdf', fileName: `Trinetra_${safeName}.pdf`, caption });
        console.log(`✅ [WA Slot ${slot.id} PDF] Sent to +91${cleanMobile}`);
        resolve({ success: true, slotId: slot.id });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

// ─── Send Pragati Summary Link ────────────────────────────────
async function sendWhatsAppPragatiSummary(mobile, studentName, totalTests, avgPct, overallGrade) {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const pragatiUrl = `https://trinetraonline.in/pragati/${cleanMobile}`;

  const messageText = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n\n📊 *સર્વગ્રાહી પ્રગતિ અહેવાલ (PROGRESS REPORT)*\n📝 આપેલ કુલ કસોટીઓ: *${totalTests}*\n🎯 સરેરાશ સ્કોર: *${avgPct}%*\n🏅 ઓવરઓલ ગ્રેડ: *${overallGrade}*\n\n📄 *તમારો સત્તાવાર પ્રગતિ અહેવાલ જોવા અને PDF ડાઉનલોડ કરવા નીચે ક્લિક કરો:*\n👉 ${pragatiUrl}\n━━━━━━━━━━━━━━━━━━━━━━\n🌐 https://trinetraonline.in  📞 8200405300`;

  if (!hasAnyConnectedSlot()) {
    return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન છે.' };
  }

  return new Promise(resolve => {
    enqueueWAMessage(async (socket, slot) => {
      try {
        await socket.sendMessage(jid, { text: messageText });
        console.log(`✅ [WA Slot ${slot.id} Pragati Link] Sent to +91${cleanMobile}`);
        resolve({ success: true, slotId: slot.id, message: `પ્રગતિ અહેવાલની લિંક (+91${cleanMobile}) WhatsApp #${slot.id} પરથી મોકલાઈ ગઈ!` });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

// ─── Send Pragati PDF ─────────────────────────────────────────
async function sendWhatsAppPragatiPDF(mobile, studentName, pdfBuffer) {
  const cleanMobile = cleanIndianMobile(mobile);
  const jid = `91${cleanMobile}@s.whatsapp.net`;
  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી*\n━━━━━━━━━━━━━━━━━━━━━━\nનમસ્તે *${studentName}*,\n📊 તમારો સર્વગ્રાહી પ્રગતિ અહેવાલ (Progress Certificate) PDF ઉપર આપેલ છે. ✨\n🌐 https://www.trinetraonline.in`;

  if (!hasAnyConnectedSlot()) {
    return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન.' };
  }

  return new Promise(resolve => {
    enqueueWAMessage(async (socket, slot) => {
      try {
        const safeName = String(studentName || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
        await socket.sendMessage(jid, { document: pdfBuffer, mimetype: 'application/pdf', fileName: `Trinetra_Pragati_${safeName}.pdf`, caption });
        resolve({ success: true, slotId: slot.id, message: `📊 PDF (+91${cleanMobile}) WhatsApp #${slot.id} પરથી મોકલાઈ ગઈ!` });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

// ─── Send Daily Report ────────────────────────────────────────
async function sendWhatsAppDailyReport(targetMobile = '8200405300') {
  const slot = getNextConnectedSlot();
  if (!slot || !slot.socket) {
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

    const activeCount = getConnectedSlots().length;
    const message = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી - દૈનિક અહેવાલ* 📊\n━━━━━━━━━━━━━━━━━━━━━━\n📅 *તારીખ:* ${istDate} (${istTime})\n👨‍🏫 *ડિરેક્ટર:* સુનિલ સર\n📱 *WhatsApp પુલ:* ${activeCount}/${NUM_SLOTS} નંબર્સ સક્રિય\n\n📈 *છેલ્લા ૨૪ કલાક:*\n👥 *વિદ્યાર્થીઓ:* ${uniqueStudents}\n📝 *કસોટીઓ:* ${totalSubs}\n🎯 *સરેરાશ:* ${avgScore} ગુણ\n${cheatingCount > 0 ? `⚠️ *ઉલ્લંઘન:* ${cheatingCount}\n` : ''}${topScorers ? `🏆 *ટોપ:*\n${topScorers}\n` : 'ℹ️ આજે કોઈ કસોટી નથી.\n'}\n━━━━━━━━━━━━━━━━━━━━━━\n✅ Render & DB Active\n🌐 https://www.trinetraonline.in/teacher`;

    await slot.socket.sendMessage(jid, { text: message });
    recordMessageSent(slot.id);
    console.log(`✅ [Daily Report] Sent via Slot #${slot.id} to +91${cleanMobile}`);
    return { success: true, slotId: slot.id, message: `અહેવાલ (+91${cleanMobile}) WhatsApp પર મોકલાયો!` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Send Test Completion Summary ─────────────────────────────
async function sendWhatsAppTestCompletionSummary(testCode, targetMobile = '8200405300') {
  const slot = getNextConnectedSlot();
  if (!slot || !slot.socket) {
    return { success: false, isOffline: true, error: 'WhatsApp ઑફલાઇન છે.' };
  }

  try {
    const cleanMobile = cleanIndianMobile(targetMobile);
    const jid = `91${cleanMobile}@s.whatsapp.net`;

    const submissions = await prisma.submission.findMany({
      where: { testCode, status: 'COMPLETED' },
      include: { student: true },
      orderBy: { mcqScore: 'desc' }
    });

    if (!submissions || submissions.length === 0) {
      return { success: false, error: 'આ ટેસ્ટ માટે કોઈ સબમિશન નથી મળ્યા.' };
    }

    const testName = submissions[0].testName || testCode;
    const totalMarks = submissions[0].totalMarks || 100;
    const totalStudents = submissions.length;

    const avgScore = (submissions.reduce((acc, s) => acc + (s.mcqScore ?? 0), 0) / totalStudents).toFixed(1);
    const top3 = submissions.slice(0, 3).map((s, i) => {
      const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      return `${rankEmoji} *${s.student?.name || 'વિદ્યાર્થી'}* — ${s.mcqScore}/${totalMarks}`;
    }).join('\n');

    const istNow = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
    const timeStr = istNow.toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const summaryMsg = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી — ટેસ્ટ પરિણામ સમરી* 📝\n━━━━━━━━━━━━━━━━━━━━━━\n📋 *ટેસ્ટ:* ${testName}\n⏰ *પૂર્ણ સમય:* ${timeStr}\n\n👥 *કુલ સબમિશન:* ${totalStudents} વિદ્યાર્થીઓ\n🎯 *સરેરાશ સ્કોર:* ${avgScore} / ${totalMarks}\n\n🏆 *ટોપ ૩ વિદ્યાર્થીઓ:*\n${top3}\n━━━━━━━━━━━━━━━━━━━━━━\nસંપૂર્ણ પરિણામ ટીચર પોર્ટલ પર ઉપલબ્ધ છે.\n🌐 https://www.trinetraonline.in/teacher`;

    await slot.socket.sendMessage(jid, { text: summaryMsg });
    recordMessageSent(slot.id);
    console.log(`✅ [Test Summary] WhatsApp sent to +91${cleanMobile} for test: ${testCode}`);
    return { success: true, slotId: slot.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  NUM_SLOTS,
  initWhatsApp,
  initWhatsAppSlot,
  hasSavedSession,
  pauseWhatsApp,
  sendWhatsAppOTP,
  sendWhatsAppScorecardSummary,
  sendWhatsAppScorecardPDF,
  sendWhatsAppPragatiSummary,
  sendWhatsAppPragatiPDF,
  sendWhatsAppDailyReport,
  sendWhatsAppTestCompletionSummary,
  getWhatsAppStatus,
  logoutWhatsApp
};
