const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

let waSocket = null;
let qrCodeDataUrl = null;
let connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTED' | 'CONNECTING'
let connectedPhone = null;

const sessionDir = path.join(__dirname, '../whatsapp_session');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

async function initWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    connectionStatus = 'CONNECTING';

    waSocket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: true,
      browser: ['Trinetra Academy Portal', 'Chrome', '1.0.0']
    });

    waSocket.ev.on('creds.update', saveCreds);

    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'SCAN_QR';
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr);
          console.log('\n🟢 [WhatsApp Bridge] Scan QR Code on screen or Teacher Dashboard to connect!\n');
        } catch (e) {}
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = null;
        console.log('🔴 [WhatsApp Bridge] Connection closed. Reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 4000);
        }
      } else if (connection === 'open') {
        connectionStatus = 'CONNECTED';
        qrCodeDataUrl = null;
        connectedPhone = waSocket.user?.id?.split(':')[0] || 'Active';
        console.log('✅ [WhatsApp Bridge] 100% Connected successfully as:', connectedPhone);
      }
    });

  } catch (err) {
    console.error('WhatsApp Init Error:', err);
    connectionStatus = 'DISCONNECTED';
  }
}

/**
 * Send automated OTP message via connected WhatsApp
 */
async function sendWhatsAppOTP(mobile, otp, studentName = 'વિદ્યાર્થી') {
  const cleanMobile = String(mobile).replace(/\D/g, '').replace(/^(91|0)/, '');
  const jid = `91${cleanMobile}@s.whatsapp.net`;

  const textMessage = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*
━━━━━━━━━━━━━━━━━━━━━━
નમસ્તે *${studentName}*,

પોર્ટલમાં લૉગિન કરવા માટે તમારો વન-ટાઇમ પાસવર્ડ (OTP) નીચે મુજબ છે:

🔑 તમારો સુરક્ષિત OTP: *${otp.split('').join(' ')}*

⏱️ આ OTP આગામી *5 મિનિટ* માટે જ માન્ય રહેશે.
🔒 આ OTP અન્ય કોઈ સાથે શેર કરશો નહીં.
━━━━━━━━━━━━━━━━━━━━━━
🌐 પોર્ટલ: https://trinetraacademy.in
📞 હેલ્પલાઇન: 8200405300`;

  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      await waSocket.sendMessage(jid, { text: textMessage });
      console.log(`✅ [WhatsApp OTP Sent] To: +91${cleanMobile} (${studentName}) -> OTP: ${otp}`);
      return { success: true, method: 'BAILEYS_WHATSAPP' };
    } catch (err) {
      console.error(`❌ [WhatsApp OTP Failed] to ${mobile}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`⚠️ [WhatsApp Offline] OTP for +91${cleanMobile}: ${otp} (Please scan QR Code in Teacher Dashboard)`);
    return { success: false, isOffline: true, otp };
  }
}

async function logoutWhatsApp() {
  try {
    if (waSocket) {
      await waSocket.logout().catch(() => {});
    }
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    connectionStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    connectedPhone = null;
    console.log('🔄 [WhatsApp Bridge] Logged out. Starting new fresh session...');
    setTimeout(initWhatsApp, 1500);
    return { success: true, message: 'WhatsApp ડિસ્કનેક્ટ થયું. નવો નંબર લિંક કરવા QR Code સ્કેન કરો.' };
  } catch (e) {
    console.error('Logout error:', e);
    return { success: false, error: e.message };
  }
}

function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
    phone: connectedPhone
  };
}

module.exports = {
  initWhatsApp,
  sendWhatsAppOTP,
  getWhatsAppStatus,
  logoutWhatsApp
};
