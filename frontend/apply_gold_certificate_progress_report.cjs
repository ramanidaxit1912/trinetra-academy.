const fs = require('fs');
const path = require('path');

const sdPath = path.join(__dirname, 'src/pages/StudentDashboard.jsx');
let content = fs.readFileSync(sdPath, 'utf8');

const targetStart = `  // ─── Print Full Academic Progress Report with Exact Scorecard Marketing Posters ───
  const handlePrintProgressReport = async () => {`;

const targetEnd = `      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    }
  };`;

const startIdx = content.indexOf(targetStart);
const endIdx = content.indexOf(targetEnd);

const goldCertificatePrintFunction = `  // ─── Print Full Academic Progress Report: Option 1 Gold Certificate & Seal ───
  const handlePrintProgressReport = async () => {
    // 1. Fetch exact marketing posters (same as Student Scorecard & Answer Sheet)
    let activeMarketing = [];
    try {
      const mktRes = await getMarketingItems().catch(() => ({ data: [] }));
      const list = Array.isArray(mktRes?.data?.data)
        ? mktRes.data.data
        : Array.isArray(mktRes?.data)
          ? mktRes.data
          : Array.isArray(mktRes?.items)
            ? mktRes.items
            : [];
      
      activeMarketing = list.filter(x => x.isActive !== false && x.showInPdf !== false && (x.imageUrl || x.image));
      if (activeMarketing.length === 0) {
        activeMarketing = list.filter(x => x.isActive !== false && (x.imageUrl || x.image));
      }
    } catch (e) {
      activeMarketing = marketingList.filter(x => x.isActive !== false && (x.imageUrl || x.image));
    }

    const origin = window.location.origin;
    const logoUrl = \`\${origin}/images/logo.jpg\`;
    const certNumber = \`TRN-\${Math.floor(100000 + Math.random() * 900000)}\`;

    // Overall grade calculation
    const overallGrade = stats.avgScore >= 90 ? 'A+ (ટોપર)' : stats.avgScore >= 75 ? 'A (ઉત્કૃષ્ટ)' : stats.avgScore >= 60 ? 'B (સક્ષમ)' : 'C (સુધારણા)';
    const gradeColor = stats.avgScore >= 75 ? '#15803d' : stats.avgScore >= 60 ? '#b45309' : '#b91c1c';

    // Generate Bar Chart SVG for Test Progression
    const chartBars = testTrendData.map((d, i) => {
      const clamped = Math.min(100, Math.max(0, d.percentage || 0));
      const barH = Math.max(8, (clamped / 100) * 115);
      const y = 135 - barH;
      const x = 30 + i * 65;
      const isGreen = clamped >= 70;
      const isAmber = clamped >= 50 && clamped < 70;
      const barColor = isGreen ? '#16a34a' : isAmber ? '#d97706' : '#dc2626';
      const badgeBg = isGreen ? '#dcfce7' : isAmber ? '#fef3c7' : '#fee2e2';
      const badgeColor = isGreen ? '#15803d' : isAmber ? '#b45309' : '#b91c1c';

      return \`
        <g>
          <!-- Score Pill Background -->
          <rect x="\${x - 2}" y="\${y - 20}" width="42" height="15" rx="4" fill="\${badgeBg}" stroke="\${barColor}" stroke-width="0.8" />
          <!-- Score % on top of bar -->
          <text x="\${x + 19}" y="\${y - 9}" text-anchor="middle" font-size="9.5" font-weight="900" fill="\${badgeColor}">\${clamped}%</text>
          <!-- Vertical Bar Pillar with 3D Gloss -->
          <rect x="\${x}" y="\${y}" width="38" height="\${barH}" rx="4" fill="\${barColor}" />
          <!-- Test label below bar -->
          <text x="\${x + 19}" y="152" text-anchor="middle" font-size="10.5" font-weight="800" fill="#1e293b">T\${d.testNum}</text>
          <text x="\${x + 19}" y="164" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">\${(d.testName || '').substring(0, 8)}</text>
        </g>
      \`;
    }).join('');

    const svgBarChartWidth = Math.max(460, 45 + testTrendData.length * 65);

    const html = \`<!DOCTYPE html>
    <html lang="gu">
    <head>
      <meta charset="UTF-8">
      <title>Trinetra Academy - Official Academic Certificate & Progress Report - \${user?.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700;800;900&display=swap');
        @page { size: A4; margin: 8mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Hind Vadodara', sans-serif, system-ui; padding: 12px; color: #0f172a; max-width: 840px; margin: 0 auto; background: #ffffff; }
        
        .no-print-bar { position: sticky; top: 0; z-index: 9999; background: #1e3a8a; color: white; padding: 10px 16px; border-radius: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .print-btn { background: #22c55e; color: white; border: none; padding: 7px 16px; border-radius: 7px; font-weight: 900; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
        
        /* 🎖️ GOLDEN CERTIFICATE ROYAL OUTER CONTAINER 🎖️ */
        .certificate-wrapper {
          border: 3.5px solid #1e3a8a;
          outline: 2px solid #d97706;
          outline-offset: 4px;
          border-radius: 14px;
          padding: 16px 20px;
          background: #ffffff;
          position: relative;
        }

        .corner-ornament {
          position: absolute;
          width: 22px;
          height: 22px;
          color: #d97706;
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
        }
        .corner-tl { top: 6px; left: 8px; }
        .corner-tr { top: 6px; right: 8px; }
        .corner-bl { bottom: 6px; left: 8px; }
        .corner-br { bottom: 6px; right: 8px; }

        .cert-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 12px;
          margin-bottom: 14px;
          gap: 12px;
        }

        .gold-seal-badge {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%);
          border: 2.5px dashed #b45309;
          box-shadow: 0 4px 12px rgba(217,119,6,0.25);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex-shrink: 0;
          padding: 4px;
        }

        .meta-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 14px;
          font-size: 12px;
        }

        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; }
        .stat-card { background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 3.5px solid #1e3a8a; border-radius: 8px; padding: 9px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
        .stat-num { font-size: 20px; font-weight: 900; color: #1e3a8a; margin-top: 2px; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 12.5px; }
        th { background: #f1f5f9; color: #1e3a8a; font-weight: 900; }
        
        .chart-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin: 14px 0; }
        
        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="watermark" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 50px; font-weight: 900; color: rgba(30, 58, 138, 0.035); white-space: nowrap; pointer-events: none; text-transform: uppercase;">🏛️ TRINETRA ACADEMY CERTIFIED</div>
      
      <!-- Top Action Bar for PDF & Print -->
      <div class="no-print-bar">
        <div style="font-weight: 800; font-size: 13.5px;">🎖️ ત્રિનેત્ર ઓનલાઇન એકેડેમી - સત્તાવાર શૈક્ષણિક પ્રગતિ પ્રમાણપત્ર & માર્કશીટ</div>
        <button class="print-btn" onclick="window.print()">🖨️ PDF ડાઉનલોડ / પ્રિન્ટ કરો</button>
      </div>

      <!-- 🎖️ MAIN CERTIFICATE CONTAINER 🎖️ -->
      <div class="certificate-wrapper">
        <div class="corner-ornament corner-tl">❖</div>
        <div class="corner-ornament corner-tr">❖</div>
        <div class="corner-ornament corner-bl">❖</div>
        <div class="corner-ornament corner-br">❖</div>

        <!-- Official Certificate Header -->
        <div class="cert-header">
          <!-- Academy Logo with Golden Ring -->
          <div style="width: 60px; height: 60px; border-radius: 50%; border: 2.5px solid #d97706; overflow: hidden; background: white; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(217,119,6,0.2);">
            <img src="\${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=TA&background=1e3a8a&color=fff'" alt="Logo" />
          </div>

          <!-- Academy Details in Center -->
          <div style="text-align: center; flex: 1; padding: 0 10px;">
            <div style="font-size: 11px; font-weight: 800; color: #d97706; letter-spacing: 1px; text-transform: uppercase;">★ OFFICIAL ACADEMIC PROGRESS CERTIFICATE ★</div>
            <h1 style="margin: 2px 0 0; color: #1e3a8a; font-size: 21px; font-weight: 900; letter-spacing: 0.2px;">
              🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી
            </h1>
            <div style="font-size: 11px; font-weight: 800; color: #15803d; margin-top: 1px;">
              ✨ મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              TET-1 • TET-2 • TAT-S • TAT-HS • GPSC સ્પેશિયલ મોક ટેસ્ટ સિરીઝ મૂલ્યાંકન અહેવાલ
            </div>
          </div>

          <!-- Official Gold Certified Seal Badge -->
          <div class="gold-seal-badge">
            <div style="font-size: 18px; line-height: 1;">🎖️</div>
            <div style="font-size: 8px; font-weight: 900; color: #92400e; letter-spacing: 0.5px; margin-top: 2px;">VERIFIED</div>
            <div style="font-size: 7.5px; font-weight: 800; color: #1e3a8a;">TRINETRA</div>
            <div style="font-size: 7px; color: #b45309; font-weight: 900;">CERTIFIED</div>
          </div>
        </div>

        <!-- Student Metadata Strip -->
        <div class="meta-strip">
          <div><span style="color:#64748b;">વિદ્યાર્થી:</span> <strong style="color:#1e3a8a;">\${user?.name}</strong></div>
          <div><span style="color:#64748b;">મોબાઈલ:</span> <strong>\${user?.mobile}</strong></div>
          <div><span style="color:#64748b;">સર્ટિફિકેટ ક્રમ:</span> <strong style="color:#d97706;">\${certNumber}</strong></div>
          <div><span style="color:#64748b;">તારીખ:</span> <strong>\${new Date().toLocaleDateString('gu-IN')}</strong></div>
        </div>

        <!-- 4 Golden Key Metric Cards -->
        <div class="grid">
          <div class="stat-card">
            <div style="font-size:11px; color:#64748b; font-weight:700;">કુલ કસોટીઓ</div>
            <div class="stat-num">\${stats.totalTests}</div>
          </div>
          <div class="stat-card">
            <div style="font-size:11px; color:#64748b; font-weight:700;">સરેરાશ સ્કોર</div>
            <div class="stat-num" style="color:\${gradeColor};">\${stats.avgScore}%</div>
          </div>
          <div class="stat-card">
            <div style="font-size:11px; color:#64748b; font-weight:700;">ચોકસાઈ દર</div>
            <div class="stat-num">\${accuracyMetrics.accuracy}%</div>
          </div>
          <div class="stat-card" style="border-top-color: #d97706;">
            <div style="font-size:11px; color:#d97706; font-weight:800;">પરફોર્મન્સ ગ્રેડ</div>
            <div class="stat-num" style="font-size:16px; color:\${gradeColor};">\${overallGrade}</div>
          </div>
        </div>

        <!-- 📊 TEST PROGRESSION BAR CHART -->
        \${testTrendData.length > 0 ? \`
          <div class="chart-box">
            <div style="font-weight: 900; font-size: 13px; color: #1e3a8a; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
              <span>📊 કસોટી-દર-કસોટી સ્કોર બાર ચાર્ટ (Test Progression Bar Chart)</span>
              <span style="font-size: 10px; color: #64748b; font-weight: normal;">(ગુણ ટકાવારી %)</span>
            </div>
            <div style="width: 100%; overflow-x: auto;">
              <svg width="100%" height="175" viewBox="0 0 \${svgBarChartWidth} 175" style="overflow: visible;">
                <!-- Grid lines -->
                <line x1="25" y1="20" x2="\${svgBarChartWidth - 10}" y2="20" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
                <text x="5" y="24" font-size="9" fill="#94a3b8" font-weight="700">100%</text>
                <line x1="25" y1="78" x2="\${svgBarChartWidth - 10}" y2="78" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
                <text x="5" y="82" font-size="9" fill="#94a3b8" font-weight="700">50%</text>
                <line x1="25" y1="135" x2="\${svgBarChartWidth - 10}" y2="135" stroke="#cbd5e1" stroke-width="1.5" />
                <text x="5" y="139" font-size="9" fill="#94a3b8" font-weight="700">0%</text>
                
                <!-- Bars -->
                \${chartBars}
              </svg>
            </div>
          </div>
        \` : ''}

        <!-- 📚 SUBJECT ANALYSIS TABLE -->
        <h3 style="color: #1e3a8a; margin: 12px 0 6px 0; font-size: 13.5px; font-weight: 900; display:flex; align-items:center; justify-content:space-between;">
          <span>📚 વિષયવાર પ્રગતિ અને ગુણ વિશ્લેષણ:</span>
          <span style="font-size:11px; color:#d97706; font-weight:800;">કુલ વિષયો: \${subjectAnalytics.length}</span>
        </h3>
        <table>
          <thead>
            <tr>
              <th>વિષય</th>
              <th>કુલ પરીક્ષાઓ</th>
              <th>મેળવેલ ગુણ</th>
              <th>ટકાવારી</th>
              <th>પરિણામ સ્થિતિ</th>
            </tr>
          </thead>
          <tbody>
            \${subjectAnalytics.map(s => \`
              <tr>
                <td><strong>📚 \${s.subject}</strong></td>
                <td>\${s.count} કસોટીઓ</td>
                <td>\${s.totalScore}/\${s.totalMax}</td>
                <td><strong style="color:\${s.pct >= 70 ? '#166534' : s.pct >= 50 ? '#b45309' : '#991b1b'};">\${s.pct}%</strong></td>
                <td>
                  <span style="font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px; background:\${s.pct >= 70 ? '#dcfce7' : s.pct >= 50 ? '#fef3c7' : '#fee2e2'}; color:\${s.pct >= 70 ? '#166534' : s.pct >= 50 ? '#b45309' : '#991b1b'};">
                    \${s.pct >= 70 ? '🟢 સબળ (Strong)' : s.pct >= 50 ? '🟡 સરેરાશ (Average)' : '🔴 મહેનત જરૂરી'}
                  </span>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>

        <!-- Certificate Official Sign-off Strip -->
        <div style="margin-top: 18px; border-top: 1.5px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #475569;">
          <div>
            <div style="font-weight: 800; color: #1e3a8a;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી (સત્તાવાર શૈક્ષણિક મૂલ્યાંકન)</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Helpline: 8200405300 • Website: trinetraacademy.in</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px;">[ અત્રે સહી / મહોર ]</div>
            <div style="font-weight: 800; color: #1e3a8a; border-top: 1px solid #94a3b8; padding-top: 2px; min-width: 140px;">
              તપાસનાર ફેકલ્ટી સહી & સિક્કો
            </div>
          </div>
        </div>

      </div>

      <!-- 🖼️ EXACT SCORECARD MARKETING BROCHURE PAGE -->
      \${buildMarketingBrochureHtml(activeMarketing)}

      <script>
        window.onload = function() {
          setTimeout(function() {
            try {
              window.focus();
              window.print();
            } catch(e) {}
          }, 500);
        };
      </script>
    </body>
    </html>\`;

    // Open via Blob URL for 100% reliable rendering on Mobile & Desktop
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        window.location.href = blobUrl;
      }
    } catch (err) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    }
  };`;

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + goldCertificatePrintFunction + content.substring(endIdx + targetEnd.length);
  console.log('✅ Applied Option 1: Gold Certificate & Official Seal to Progress Report');
}

fs.writeFileSync(sdPath, content, 'utf8');
