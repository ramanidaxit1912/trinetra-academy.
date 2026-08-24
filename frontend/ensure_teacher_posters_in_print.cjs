const fs = require('fs');
const path = require('path');

const sdPath = path.join(__dirname, 'src/pages/StudentDashboard.jsx');
let content = fs.readFileSync(sdPath, 'utf8');

const targetFuncStart = `  // ─── Print Full Academic Progress Report with Exact Poster Frame & Bar Chart ───
  const handlePrintProgressReport = () => {`;

const targetFuncEnd = `      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    }
  };`;

const startIdx = content.indexOf(targetFuncStart);
const endIdx = content.indexOf(targetFuncEnd);

const updatedPrintFunction = `  // ─── Print Full Academic Progress Report with Fresh Teacher Set Posters ───
  const handlePrintProgressReport = async () => {
    // 1. Fetch latest active marketing posters uploaded by the teacher
    let rawList = marketingList;
    try {
      const mktRes = await getMarketingItems({ all: 'true' });
      const fetched = Array.isArray(mktRes?.data) ? mktRes.data : (mktRes?.data?.items || []);
      if (fetched.length > 0) {
        rawList = fetched;
        setMarketingList(fetched);
      }
    } catch (e) {}

    // Prioritize posters set for PDF / active posters
    const activePosters = rawList
      .filter(m => m.isActive !== false && (m.imageUrl || m.image))
      .sort((a, b) => {
        if (a.showInPdf && !b.showInPdf) return -1;
        if (!a.showInPdf && b.showInPdf) return 1;
        return (b.id || 0) - (a.id || 0);
      });

    const origin = window.location.origin;
    const logoUrl = \`\${origin}/images/logo.jpg\`;

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
          <!-- Vertical Bar Pillar -->
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
      <title>Trinetra Academy - Comprehensive Progress Report - \${user?.name}</title>
      <style>
        body { font-family: 'Hind Vadodara', sans-serif, system-ui; padding: 22px; color: #0f172a; max-width: 820px; margin: 0 auto; background: #ffffff; }
        .no-print-bar { position: sticky; top: 0; z-index: 9999; background: #1e3a8a; color: white; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .print-btn { background: #22c55e; color: white; border: none; padding: 7px 16px; border-radius: 7px; font-weight: 900; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
        .stat-card { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px; text-align: center; }
        .stat-num { font-size: 20px; font-weight: 900; color: #1e3a8a; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12.5px; }
        th { background: #f1f5f9; font-weight: 800; }
        .chart-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; margin: 14px 0; }
        .brochure-page { margin-top: 24px; position: relative; z-index: 2; background: #ffffff; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; }
        .brochure-container { border: 2px solid #1e3a8a; border-radius: 12px; padding: 12px 14px; background: #ffffff; }
        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="watermark" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 54px; font-weight: 900; color: rgba(30, 58, 138, 0.035); white-space: nowrap; pointer-events: none; text-transform: uppercase;">🏛️ TRINETRA ACADEMY</div>
      
      <!-- Top Action Bar for PDF & Print -->
      <div class="no-print-bar">
        <div style="font-weight: 800; font-size: 13.5px;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી - વિદ્યાર્થી પ્રગતિ રિપોર્ટ કાર્ડ</div>
        <button class="print-btn" onclick="window.print()">🖨️ PDF ડાઉનલોડ / પ્રિન્ટ કરો</button>
      </div>

      <!-- Academy Official Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border: 2px solid #1e3a8a; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);">
        <div style="width: 52px; height: 52px; border-radius: 50%; border: 1.5px solid #1e3a8a; overflow: hidden; background: white; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <img src="\${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=TA&background=1e3a8a&color=fff'" alt="Logo" />
        </div>
        <div style="text-align: center; flex: 1; padding: 0 10px;">
          <h1 style="margin: 0; color: #1e3a8a; font-size: 19px; font-weight: 900;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી</h1>
          <div style="font-size: 11px; font-weight: 800; color: #d97706; margin-top: 1px;">✨ મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆</div>
          <div style="font-size: 10px; color: #64748b;">સર્વગ્રાહી વિદ્યાર્થી શૈક્ષણિક પ્રગતિ અહેવાલ (Academic Progress Report)</div>
        </div>
        <div style="text-align: right; flex-shrink: 0; border-left: 1px dashed #cbd5e1; padding-left: 10px; font-size: 10px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 6px; border-radius: 5px; color: #1e40af; font-weight: 800;">📞 8200405300</div>
          <div style="color: #64748b; font-size: 9.5px; margin-top: 2px;">trinetraacademy.in</div>
        </div>
      </div>

      <!-- Student Metadata -->
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:12.5px; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div><strong>વિદ્યાર્થીનું નામ:</strong> \${user?.name}</div>
        <div><strong>મોબાઈલ નંબર:</strong> \${user?.mobile}</div>
        <div><strong>તારીખ:</strong> \${new Date().toLocaleDateString('gu-IN')}</div>
      </div>

      <!-- 4 Stat Metric Cards -->
      <div class="grid">
        <div class="stat-card"><div style="font-size:11px; color:#64748b; font-weight:700;">કુલ કસોટીઓ</div><div class="stat-num">\${stats.totalTests}</div></div>
        <div class="stat-card"><div style="font-size:11px; color:#64748b; font-weight:700;">સરેરાશ સ્કોર</div><div class="stat-num">\${stats.avgScore}%</div></div>
        <div class="stat-card"><div style="font-size:11px; color:#64748b; font-weight:700;">ચોકસાઈ દર</div><div class="stat-num">\${accuracyMetrics.accuracy}%</div></div>
        <div class="stat-card"><div style="font-size:11px; color:#64748b; font-weight:700;">શ્રેષ્ઠ સ્કોર</div><div class="stat-num">\${stats.highestScore}%</div></div>
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
      <h3 style="color: #1e3a8a; margin: 14px 0 6px 0; font-size: 13.5px;">📚 વિષયવાર પ્રગતિ અને ગુણ વિશ્લેષણ:</h3>
      <table>
        <thead><tr><th>વિષય</th><th>કુલ પરીક્ષાઓ</th><th>મેળવેલ ગુણ</th><th>ટકાવારી</th><th>પરિણામ સ્થિતિ</th></tr></thead>
        <tbody>
          \${subjectAnalytics.map(s => \`<tr><td><strong>\${s.subject}</strong></td><td>\${s.count}</td><td>\${s.totalScore}/\${s.totalMax}</td><td><strong>\${s.pct}%</strong></td><td>\${s.pct >= 70 ? '🟢 સબળ (Strong)' : s.pct >= 50 ? '🟡 સરેરાશ (Average)' : '🔴 મહેનત જરૂરી'}</td></tr>\`).join('')}
        </tbody>
      </table>

      <!-- 🖼️ TEACHER-SET MARKETING POSTERS (EXACT FRAME) -->
      \${activePosters.length > 0 ? \`
        <div class="brochure-page">
          <div class="brochure-container">
            
            <!-- Compact Brochure Header -->
            <div style="text-align: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 2px;">
                <div style="width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid #1e3a8a; overflow: hidden; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <img src="\${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=TA&background=1e3a8a&color=fff'" alt="Logo" />
                </div>
                <div style="font-size: 16px; font-weight: 900; color: #1e3a8a;">
                  🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી
                </div>
              </div>
              <div style="font-size: 11.5px; font-weight: 800; color: #d97706;">
                🌟 વિશેષ ટેસ્ટ સિરીઝ, લાઈવ બેચ & સ્પેશિયલ કોર્સ બ્રોશર
              </div>
              <div style="font-size: 10px; color: #475569; margin-top: 1px;">
                📞 WhatsApp / Call: <strong style="color: #1e3a8a;">8200405300</strong> &nbsp;|&nbsp; 🌐 <strong style="color: #2563eb;">trinetraacademy.in</strong>
              </div>
            </div>

            <!-- Exact Poster Size Frame for Teacher-Uploaded Posters -->
            <div style="display: grid; grid-template-columns: \${activePosters.length === 1 ? '1fr' : 'repeat(2, 1fr)'}; gap: 10px; justify-items: center; align-items: center; margin-bottom: 8px;">
              \${activePosters.slice(0, 2).map((p) => {
                const rawImg = p.imageUrl || p.image;
                const fullImg = rawImg ? (rawImg.startsWith('http') ? rawImg : \`\${origin}\${rawImg}\`) : null;
                const isSingle = activePosters.length === 1;
                const posterMaxHeight = isSingle ? '440px' : '280px';

                return \`
                  <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
                    \${fullImg ? \`
                      <img src="\${fullImg}" style="max-height: \${posterMaxHeight}; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; border-radius: 8px; border: 1.5px solid #cbd5e1; box-shadow: 0 3px 10px rgba(0,0,0,0.08); margin: 0 auto;" alt="\${p.title || 'Teacher Poster'}" />
                    \` : ''}
                  </div>
                \`;
              }).join('')}
            </div>

            <!-- Compact Footer -->
            <div style="padding-top: 6px; border-top: 1.5px solid #e2e8f0; text-align: center;">
              <div style="font-size: 11px; font-weight: 900; color: #1e3a8a;">
                🎯 મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી!
              </div>
              <div style="font-size: 9px; color: #64748b; margin-top: 1px;">
                TET-1 • TET-2 • TAT-S • TAT-HS • HTAT • સરકારી શિક્ષક ભરતી પરીક્ષા માર્ગદર્શન કેન્દ્ર • Helpline: 8200405300
              </div>
            </div>

          </div>
        </div>
      \` : ''}

      <!-- Official Certification Footer -->
      <div style="margin-top: 20px; border-top: 1px dashed #94a3b8; padding-top: 8px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
        <div>ત્રિનેત્ર એકેડેમી સર્ટિફાઇડ શૈક્ષણિક અહેવાલ</div>
        <div>શિક્ષકની સહી / મહોર: __________________</div>
      </div>

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
  content = content.substring(0, startIdx) + updatedPrintFunction + content.substring(endIdx + targetFuncEnd.length);
  console.log('✅ Updated handlePrintProgressReport with live teacher-set posters');
}

fs.writeFileSync(sdPath, content, 'utf8');
