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

/**
 * Send Scorecard PDF document buffer directly to student WhatsApp from teacher's connected session
 */
async function sendWhatsAppScorecardPDF(mobile, studentName, testName, score, totalMarks, pdfBuffer) {
  const cleanMobile = String(mobile).replace(/\D/g, '').replace(/^(91|0)/, '');
  const jid = `91${cleanMobile}@s.whatsapp.net`;

  const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const isPass = pct >= 60;
  const resultStatus = pct >= 75 ? '👑 ઉત્કૃષ્ટ (Distinction)' : pct >= 60 ? '🟢 પાસ (Passed)' : '🔴 સુધારાની જરૂર';

  const caption = `🏛️ *ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ACADEMY)*
━━━━━━━━━━━━━━━━━━━━━━
નમસ્તે *${studentName}*,

તમારી કસોટીનું અધિકૃત મૂલ્યાંકન સ્કોરકાર્ડ & ઉત્તરવહી તૈયાર છે!

📊 *કસોટીનું નામ:* ${testName}
🎯 *મેળવેલ ગુણ:* ${score} / ${totalMarks}
📈 *ટકાવારી:* ${pct}%
🏅 *પરિણામ:* ${resultStatus}

📄 વિગતવાર ઉત્તરો, પ્રશ્નવાર સોલ્યુશન્સ અને સુનિલ સરની સહી સાથેની PDF ફાઇલ ઉપર જોડાયેલ છે.
━━━━━━━━━━━━━━━━━━━━━━
✨ *મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી!* 🏆
🌐 પોર્ટલ: https://trinetraacademy.in
📞 હેલ્પલાઇન: 8200405300`;

  if (waSocket && connectionStatus === 'CONNECTED') {
    try {
      const safeTestName = String(testName || 'Scorecard').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      const safeStudentName = String(studentName || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      const fileName = `Trinetra_${safeTestName}_${safeStudentName}.pdf`;

      await waSocket.sendMessage(jid, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: fileName,
        caption: caption
      });

      console.log(`✅ [WhatsApp PDF Sent] Document sent to +91${cleanMobile} (${studentName})`);
      return { success: true, message: `PDF તમારા WhatsApp (+91${cleanMobile}) પર સફળતાપૂર્વક મોકલી દીધું છે!` };
    } catch (err) {
      console.error(`❌ [WhatsApp PDF Failed] to ${mobile}:`, err);
      return { success: false, error: 'WhatsApp પર PDF મોકલવામાં તકલીફ પડી: ' + err.message };
    }
  } else {
    console.log(`⚠️ [WhatsApp Offline] Teacher WhatsApp is disconnected. Status: ${connectionStatus}`);
    return {
      success: false,
      isOffline: true,
      error: 'ટીચરનું WhatsApp હાલ ઑફલાઇન છે. કૃપા કરીને થોડીવાર પછી પ્રયાસ કરો અથવા ટીચર ડેશબોર્ડમાં QR સ્કેન કરો.'
    };
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
  sendWhatsAppScorecardPDF,
  getWhatsAppStatus,
  logoutWhatsApp
};
