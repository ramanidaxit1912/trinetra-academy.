/**
 * whatsappPortal.js — Trinetra Online Academy
 * 5-Slot Multi-WhatsApp Pool Dashboard HTML Template
 */

function getWhatsAppPortalHtml() {
  return `<!DOCTYPE html>
<html lang="gu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ત્રિનેત્ર એકેડેમી — ૫-નંબર WhatsApp પુલ કંટ્રોલ સેન્ટર</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Noto+Sans+Gujarati:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
      font-family: 'Noto Sans Gujarati', 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      padding: 24px 16px 40px;
      color: #f8fafc;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header-logo {
      font-size: 2.4rem;
      margin-bottom: 6px;
    }
    .header h1 {
      font-size: 1.6rem;
      font-weight: 800;
      color: #38bdf8;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .header .subtitle {
      font-size: 0.92rem;
      color: #94a3b8;
    }
    /* Stats Bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .stat-icon {
      font-size: 1.8rem;
      background: rgba(56, 189, 248, 0.12);
      border-radius: 12px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-label {
      font-size: 0.78rem;
      color: #94a3b8;
      margin-bottom: 3px;
    }
    .stat-val {
      font-size: 1.15rem;
      font-weight: 800;
      color: #f8fafc;
    }
    /* Slots Grid */
    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .slot-card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px);
      border-radius: 20px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 380px;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
      transition: border-color 0.25s, transform 0.25s;
    }
    .slot-card:hover {
      border-color: rgba(56, 189, 248, 0.3);
      transform: translateY(-2px);
    }
    .slot-card.connected {
      border-color: rgba(34, 197, 94, 0.35);
      background: radial-gradient(circle at top right, rgba(34, 197, 94, 0.08) 0%, rgba(15, 23, 42, 0.9) 60%);
    }
    .slot-card.scanning {
      border-color: rgba(245, 158, 11, 0.4);
      background: radial-gradient(circle at top right, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.9) 60%);
    }
    .slot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .slot-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.74rem;
      font-weight: 700;
    }
    .badge-connected { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid #22c55e; }
    .badge-scan { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #f59e0b; }
    .badge-connecting { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #0284c7; }
    .badge-disconnected { background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }

    .slot-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 10px 0;
    }
    .phone-text {
      font-size: 1.3rem;
      font-weight: 800;
      color: #4ade80;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .stat-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 0.78rem;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    .slot-desc {
      font-size: 0.82rem;
      color: #94a3b8;
      line-height: 1.5;
    }
    .qr-box {
      background: #ffffff;
      padding: 10px;
      border-radius: 14px;
      display: inline-block;
      margin: 0 auto 12px;
      box-shadow: 0 8px 20px -4px rgba(37, 211, 102, 0.35);
      border: 2px solid #25d366;
    }
    .qr-img {
      width: 170px;
      height: 170px;
      display: block;
    }
    .qr-steps {
      font-size: 0.75rem;
      color: #cbd5e1;
      text-align: left;
      background: rgba(30, 41, 59, 0.6);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
      line-height: 1.4;
      width: 100%;
    }
    .qr-steps ol { padding-left: 16px; }
    .qr-steps li { margin-bottom: 3px; }

    .slot-footer {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn:hover { opacity: 0.9; transform: scale(0.99); }
    .btn-connect {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: white;
    }
    .btn-disconnect {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #ef4444;
      color: #f87171;
    }
    .btn-refresh {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid #3b82f6;
      color: #93c5fd;
    }

    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top: 3px solid #38bdf8;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* Info Guide */
    .info-card {
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 18px;
      padding: 20px 24px;
      margin-top: 10px;
    }
    .info-title {
      font-size: 0.96rem;
      font-weight: 800;
      color: #38bdf8;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      font-size: 0.82rem;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .info-item {
      background: rgba(30, 41, 59, 0.4);
      padding: 12px 14px;
      border-radius: 12px;
      border-left: 3px solid #38bdf8;
    }
    .info-item strong {
      color: #f8fafc;
      display: block;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">🏛️📱</div>
      <h1>ત્રિનેત્ર એકેડેમી — ૫-નંબર WhatsApp પુલ કંટ્રોલ સેન્ટર</h1>
      <div class="subtitle">૫૦૦+ વિદ્યાર્થીઓ માટે ઓટોમેટિક OTP અને સ્કોરકાર્ડ લોડ-બેલેન્સિંગ સિસ્ટમ</div>
    </div>

    <!-- Live Stats Bar -->
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-icon">📱</div>
        <div>
          <div class="stat-label">કુલ જોડાયેલા નંબર્સ</div>
          <div class="stat-val" id="stat-connected">-- / 5 સક્રિય</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div>
          <div class="stat-label">પેરેલલ ડિલિવરી સ્પીડ</div>
          <div class="stat-val" id="stat-speed">--x પેરેલલ</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🛡️</div>
        <div>
          <div class="stat-label">એન્ટિ-બેન સુરક્ષા</div>
          <div class="stat-val" style="color: #4ade80;">૧૦૦% સુરક્ષિત (૨.૫-૪s)</div>
        </div>
      </div>
    </div>

    <!-- 5 Slots Grid -->
    <div class="slots-grid" id="slots-container">
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <div class="spinner"></div>
        <p style="color: #94a3b8; font-size: 0.9rem;">WhatsApp પુલ સ્ટેટસ લોડ થઈ રહ્યું છે...</p>
      </div>
    </div>

    <!-- Explanation Guide -->
    <div class="info-card">
      <div class="info-title">💡 ૫-નંબર WhatsApp પુલ કેવી રીતે કામ કરે છે?</div>
      <div class="info-grid">
        <div class="info-item">
          <strong>૧. ૫૦૦ વિદ્યાર્થીઓ માટે સુરક્ષિત:</strong>
          જ્યારે ૫૦૦ વિદ્યાર્થીઓ ટેસ્ટ પૂર્ણ કરશે, ત્યારે સિસ્ટમ બધા કનેક્ટેડ નંબરોમાં મેસેજ વહેંચી દેશે (દા.ત. ૫ નંબર હોય તો દરેક નંબર પર માત્ર ~૧૦૦ મેસેજ જશે).
        </div>
        <div class="info-item">
          <strong>૨. ૦% બ્લોક જોખમ (Anti-Ban Jitter):</strong>
          દરેક નંબર પરથી મેસેજ વચ્ચે ૨.૫ થી ૪.૨ સેકન્ડનો વિરામ રહેશે, જેથી WhatsApp/Meta ના અલ્ગોરિધમમાં કોઈ સ્પામિંગ ફ્લેગ નહીં થાય.
        </div>
        <div class="info-item">
          <strong>૩. પેરેલલ સ્પીડ બૂસ્ટ:</strong>
          ૫ નંબરો એક સાથે સમાંતર મેસેજ મોકલશે, એટલે ૫૦૦ વિદ્યાર્થીઓને પરિણામ માત્ર ૪ થી ૫ મિનિટમાં પહોંચી જશે.
        </div>
        <div class="info-item">
          <strong>૪. ૧ થી ૫ કોઈપણ સંખ્યામાં જોડી શકાય:</strong>
          જો તમારી પાસે અત્યારે ૨ કે ૩ નંબર હોય તો પણ સિસ્ટમ સરળતાથી કામ કરશે. બાકીના નંબર ગમે ત્યારે ઉમેરી શકો છો.
        </div>
      </div>
    </div>
  </div>

  <script>
    let pollInterval = null;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        renderDashboard(data);
      } catch (err) {
        console.error('Fetch status error:', err);
      }
    }

    function renderDashboard(data) {
      const connectedCount = data.connectedCount || 0;
      document.getElementById('stat-connected').innerText = connectedCount + ' / 5 સક્રિય';
      document.getElementById('stat-speed').innerText = connectedCount > 0 ? (connectedCount + 'x પેરેલલ') : '0x (ઑફલાઇન)';

      const container = document.getElementById('slots-container');
      const slots = data.slots || [];

      let html = '';
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const sid = slot.id;
        const status = slot.status;
        const phone = slot.phone;
        const qr = slot.qrCode;
        const sentCount = slot.sentCount || 0;

        let cardClass = 'slot-card';
        let badgeHtml = '';
        let bodyHtml = '';
        let footerHtml = '';

        if (status === 'CONNECTED') {
          cardClass += ' connected';
          badgeHtml = '<span class="badge badge-connected">🟢 જોડાયેલ છે</span>';
          bodyHtml = '<div class="phone-text">+91 ' + (phone || 'Active') + '</div>' +
            '<div class="stat-pill">✉️ આ સત્રમાં મોકલેલ: <strong>' + sentCount + '</strong> મેસેજ</div>' +
            '<p class="slot-desc">✅ આ નંબર ઓટોમેટિક OTP અને સ્કોરકાર્ડ લિંક વહેંચવા માટે સક્રિય છે.</p>';
          footerHtml = '<button class="btn btn-disconnect" onclick="disconnectSlot(' + sid + ')">🚪 ડિસ્કનેક્ટ / નંબર બદલો</button>';
        } else if (status === 'SCAN_QR' && qr) {
          cardClass += ' scanning';
          badgeHtml = '<span class="badge badge-scan">🟡 QR સ્કેન કરો</span>';
          bodyHtml = '<div class="qr-box">' +
              '<img class="qr-img" src="' + qr + '" alt="WhatsApp Slot ' + sid + ' QR" />' +
            '</div>' +
            '<div class="qr-steps">' +
              '<ol>' +
                '<li>ફોનમાં WhatsApp ➔ ⋮ (૩ ટપકાં) ➔ <strong>Linked Devices</strong>.</li>' +
                '<li><strong>Link a Device</strong> દબાવી આ QR સ્કેન કરો.</li>' +
              '</ol>' +
            '</div>';
          footerHtml = '<button class="btn btn-refresh" onclick="connectSlot(' + sid + ')">🔄 નવો QR કોડ (Refresh)</button>';
        } else if (status === 'CONNECTING') {
          badgeHtml = '<span class="badge badge-connecting">🔵 કનેક્ટિંગ...</span>';
          bodyHtml = '<div class="spinner"></div>' +
            '<p class="slot-desc">QR કોડ કે સર્વર જોડાણ તૈયાર થઈ રહ્યું છે, થોડી સેકન્ડ રાહ જુઓ...</p>' +
            (slot.lastError ? '<div style="color:#f87171;font-size:0.75rem;margin-top:6px;">ℹ️ ' + slot.lastError + '</div>' : '');
          footerHtml = '<button class="btn btn-refresh" onclick="connectSlot(' + sid + ')">🔄 તાજું કરો (Reload)</button>';
        } else {
          // DISCONNECTED
          badgeHtml = '<span class="badge badge-disconnected">⚪ ડિસ્કનેક્ટેડ</span>';
          bodyHtml = '<div style="font-size:2.5rem; margin-bottom: 12px; opacity: 0.6;">📲</div>' +
            '<p class="slot-desc" style="margin-bottom: 8px;">આ સ્લોટ હાલ ખાલી છે. નવો WhatsApp નંબર જોડવા નીચે બટન દબાવો.</p>';
          footerHtml = '<button class="btn btn-connect" onclick="connectSlot(' + sid + ')">🚀 QR કોડ લાવો (નંબર જોડો)</button>';
        }

        html += '<div class="' + cardClass + '">' +
            '<div class="slot-header">' +
              '<div class="slot-title">📱 સ્લોટ #' + sid + '</div>' +
              badgeHtml +
            '</div>' +
            '<div class="slot-body">' +
              bodyHtml +
            '</div>' +
            '<div class="slot-footer">' +
              footerHtml +
            '</div>' +
          '</div>';
      }

      container.innerHTML = html;
    }

    async function connectSlot(slotId) {
      try {
        await fetch('/api/whatsapp/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId: slotId })
        });
        setTimeout(fetchStatus, 800);
      } catch (e) {
        console.error('Connect slot error:', e);
      }
    }

    async function disconnectSlot(slotId) {
      if (!confirm('શું તમે ખરેખર WhatsApp સ્લોટ #' + slotId + ' ડિસ્કનેક્ટ કરવા માંગો છો?')) return;
      try {
        await fetch('/api/whatsapp/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId: slotId })
        });
        setTimeout(fetchStatus, 800);
      } catch (e) {
        console.error('Disconnect slot error:', e);
      }
    }

    // Live smart polling every 3.5s
    fetchStatus();
    pollInterval = setInterval(fetchStatus, 3500);
  </script>
</body>
</html>`;
}

module.exports = { getWhatsAppPortalHtml };
