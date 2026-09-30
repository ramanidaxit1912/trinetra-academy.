import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, Printer, Trophy, FileText, CheckCircle, Award, Users, Smartphone, ShieldCheck, Crown } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   1. EXPORT TOP 10 COMBINED MULTI-PAGE BOOKLET PDF
═══════════════════════════════════════════════════════════════ */
export function exportTop10BookletPDF(topList = [], teacherProfile = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF પ્રિન્ટ કરવા માટે પોપ-અપ વિન્ડો (Popups) ચાલુ કરો.');
    return;
  }

  const academy = teacherProfile.academy || teacherProfile.academyName || 'ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)';
  const teacher = teacherProfile.name || 'શિક્ષક TET-2';
  const helpline = teacherProfile.phone || '8200405300';
  const dateStr = new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  // Generate HTML for Page 1: Merit Summary Table
  const page1SummaryRows = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sRoll = s.student?.mobile || s.student?.rollNo || `TR-${1000 + idx + 1}`;
    const score = Number(s.score ?? s.marks ?? 0);
    const total = Number(s.totalMarks || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const medal = idx === 0 ? '👑 🥇 ૧' : idx === 1 ? '🥈 ૨' : idx === 2 ? '🥉 ૩' : `#${idx + 1}`;
    const badgeColor = idx === 0 ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#c2410c' : '#1e3a8a';
    const grade = pct >= 80 ? 'A+ (ઉત્કૃષ્ટ)' : pct >= 60 ? 'A (પ્રથમ વર્ગ)' : pct >= 40 ? 'B (સફળ)' : 'પ્રયાસ';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 10px 12px; text-align: center; font-weight: 900; color: ${badgeColor}; font-size: 15px;">
          ${medal}
        </td>
        <td style="padding: 10px 12px; font-weight: 800; color: #0f172a; font-size: 14px;">
          ${sName}
        </td>
        <td style="padding: 10px 12px; color: #64748b; font-size: 12px; font-family: monospace;">
          ${sRoll}
        </td>
        <td style="padding: 10px 12px; text-align: center; font-weight: 900; color: #1e3a8a; font-size: 15px;">
          ${score} ${total > 0 ? `<span style="font-size: 11px; color: #64748b;">/ ${total}</span>` : ''}
        </td>
        <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #059669; font-size: 14px;">
          ${pct}%
        </td>
        <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #1e40af; font-size: 13px;">
          ${grade}
        </td>
      </tr>
    `;
  }).join('');

  // Generate Individual Scorecards for Each Student (Pages 2 to 11)
  const individualCardsHtml = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sRoll = s.student?.mobile || s.student?.rollNo || `TR-${1000 + idx + 1}`;
    const score = Number(s.score ?? s.marks ?? 0);
    const total = Number(s.totalMarks || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const testTitle = s.test?.testName || 'સ્પેશ્યલ મોક ટેસ્ટ';
    const rankTitle = idx === 0 ? '૧ લો ક્રમ (1st State Topper)' : idx === 1 ? '૨ જો ક્રમ (2nd State Rank)' : idx === 2 ? '૩ જો ક્રમ (3rd State Rank)' : `મેરિટ ક્રમ #${idx + 1}`;
    const grade = pct >= 80 ? 'A+ (Outstandig)' : pct >= 60 ? 'A (Excellent)' : pct >= 40 ? 'B (Qualified)' : 'Participated';
    const medalIcon = idx === 0 ? '👑 🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';

    return `
      <div class="page-break" style="padding-top: 10px;">
        <div style="border: 3px double #1e3a8a; border-radius: 16px; padding: 24px; position: relative; background: #ffffff; min-height: 900px; display: flex; flexDirection: column; justify-content: space-between;">
          
          <!-- Watermark -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 54px; font-weight: 900; color: rgba(30, 58, 138, 0.04); white-space: nowrap; pointer-events: none; text-transform: uppercase;">
            ${academy}
          </div>

          <!-- Scorecard Header -->
          <div>
            <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 20px; text-align: center;">
              <div style="color: #1e3a8a; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
                ${academy}
              </div>
              <div style="color: #64748b; font-size: 13px; font-weight: 700; margin-top: 4px;">
                ગુજરાત શિક્ષક યોગ્યતા કસોટી & સ્પર્ધાત્મક પરીક્ષા પોર્ટલ
              </div>
              <div style="display: inline-block; background: #1e3a8a; color: white; padding: 4px 16px; border-radius: 20px; font-weight: 800; font-size: 13px; margin-top: 10px; letter-spacing: 0.5px;">
                અધિકૃત વિદ્યાર્થી સ્કોરકાર્ડ (OFFICIAL SCORECARD)
              </div>
            </div>

            <!-- Rank Highlight Banner -->
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border: 1.5px solid #0284c7; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
              <div>
                <div style="font-size: 12px; color: #0369a1; font-weight: 800; text-transform: uppercase;">પ્રમાણિત ગુણવત્તા ક્રમ</div>
                <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 2px;">
                  ${medalIcon} ${rankTitle}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; color: #0369a1; font-weight: 800;">પરિણામ સ્થિતિ</div>
                <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 2px;">
                  ✓ ઉત્તીર્ણ (PASSED)
                </div>
              </div>
            </div>

            <!-- Student Bio Details Box -->
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700; width: 35%;">વિદ્યાર્થીનું નામ:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 900; font-size: 16px;">${sName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">મોબાઈલ / રોલ નંબર:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 800; font-family: monospace;">${sRoll}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">કસોટીનું નામ:</td>
                  <td style="padding: 6px 0; color: #1e3a8a; font-weight: 800;">${testTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">પરીક્ષા તારીખ:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 800;">${dateStr}</td>
                </tr>
              </table>
            </div>

            <!-- 4 Visual Metric Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;">
              <div style="border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; background: #ffffff;">
                <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">મેળવેલ ગુણ</div>
                <div style="font-size: 24px; font-weight: 900; color: #1e3a8a; margin-top: 4px;">${score}</div>
                <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">કુલ: ${total || score}</div>
              </div>
              <div style="border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; background: #ffffff;">
                <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">ટકાવારી</div>
                <div style="font-size: 24px; font-weight: 900; color: #059669; margin-top: 4px;">${pct}%</div>
                <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">ચોકસાઈ દર</div>
              </div>
              <div style="border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; background: #ffffff;">
                <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">મેરિટ રેન્ક</div>
                <div style="font-size: 24px; font-weight: 900; color: #d97706; margin-top: 4px;">#${idx + 1}</div>
                <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">ટોપ ૧૦ બેચ</div>
              </div>
              <div style="border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; text-align: center; background: #ffffff;">
                <div style="font-size: 11px; color: #64748b; font-weight: 800; text-transform: uppercase;">ગ્રેડ</div>
                <div style="font-size: 20px; font-weight: 900; color: #2563eb; margin-top: 6px;">${grade.split(' ')[0]}</div>
                <div style="font-size: 10px; color: #94a3b8; font-weight: 700;">શ્રેણી</div>
              </div>
            </div>

            <!-- Performance Remarks -->
            <div style="border-left: 4px solid #1e3a8a; background: #f1f5f9; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 30px;">
              <strong>શિક્ષક અભિપ્રાય (Faculty Feedback):</strong> વિદ્યાર્થીનું પ્રદર્શન અત્યંત સંતોષકારક અને પ્રશંસનીય છે. મુખ્ય વિભાવનાઓ પર ઉત્તમ પકડ છે. આગામી મુખ્ય પરીક્ષા માટે ખૂબ ખૂબ શુભેચ્છાઓ!
            </div>
          </div>

          <!-- Scorecard Footer with Signatures -->
          <div style="border-top: 1.5px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="text-align: left;">
              <div style="width: 70px; height: 70px; border-radius: 50%; border: 2px dashed #059669; display: flex; align-items: center; justifyContent: center; color: #059669; font-weight: 900; font-size: 10px; text-align: center; padding: 4px;">
                TRINETRA<br>ACADEMY<br>VERIFIED
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 6px;">વેરીફાઇડ ડિજિટલ પરિણામ</div>
            </div>

            <div style="text-align: center;">
              <div style="font-size: 12px; color: #64748b;">હેલ્પલાઇન સંપર્ક: <strong>${helpline}</strong></div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">ઈ-મેઇલ / સપોર્ટ: info@trinetra.edu</div>
            </div>

            <div style="text-align: right;">
              <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${teacher}</div>
              <div style="font-size: 12px; color: #64748b; font-weight: 700;">મુખ્ય માર્ગદર્શક / પ્રિન્સિપાલ</div>
              <div style="border-top: 1.5px solid #0f172a; width: 140px; margin-top: 6px; margin-left: auto;"></div>
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Top 10 Merit List & Scorecards - ${academy}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700;800;900&display=swap');
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Hind Vadodara', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Print Controls Floating Bar -->
  <div class="no-print" style="position: fixed; top: 12px; right: 16px; z-index: 9999; display: flex; gap: 10px; background: #0f172a; padding: 10px 18px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); border: 1px solid #38bdf8;">
    <button onclick="window.print()" style="background: linear-gradient(135deg,#0284c7,#2563eb); color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px;">
      🖨️ PDF ડાઉનલોડ / પ્રિન્ટ (Print Booklet)
    </button>
    <button onclick="window.close()" style="background: rgba(255,255,255,0.15); color: white; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer;">
      ✕ બંધ કરો
    </button>
  </div>

  <!-- ═════════ PAGE 1: OFFICIAL TOP 10 MERIT SUMMARY ═════════ -->
  <div class="page-break" style="padding: 10px 0;">
    <div style="border: 2px solid #1e3a8a; border-radius: 14px; padding: 22px; background: #ffffff;">
      
      <!-- Top Letterhead -->
      <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 20px;">
        <h1 style="color: #1e3a8a; margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 0.5px;">
          ${academy}
        </h1>
        <div style="color: #64748b; font-size: 13px; font-weight: 700; margin-top: 4px;">
          TET-1 / TET-2 / TAT / GPSC સ્પર્ધાત્મક પરીક્ષા માર્ગદર્શન કેન્દ્ર
        </div>
        <div style="display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: white; padding: 5px 20px; border-radius: 20px; font-weight: 900; font-size: 14px; margin-top: 10px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(217,119,6,0.3);">
          👑 સત્તાવાર ટોપ ૧૦ મેરિટ લિસ્ટ (OFFICIAL TOP 10 MERIT LIST)
        </div>
        <div style="color: #475569; font-size: 12px; font-weight: 700; margin-top: 8px;">
          પ્રસારણ તારીખ: ${dateStr} • મુખ્ય શિક્ષક: ${teacher}
        </div>
      </div>

      <!-- Top 3 Podium Cards on Page 1 -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px;">
        ${[
          { idx: 1, s: topList[1], medal: '🥈', title: '૨ જો ક્રમ (2nd Rank)', bg: '#f1f5f9', border: '#94a3b8' },
          { idx: 0, s: topList[0], medal: '👑 🥇', title: '૧ લો ટોપર (1st Topper)', bg: '#fef3c7', border: '#f59e0b' },
          { idx: 2, s: topList[2], medal: '🥉', title: '૩ જો ક્રમ (3rd Rank)', bg: '#ffedd5', border: '#ea580c' },
        ].map(p => {
          const sObj = p.s;
          const sName = sObj?.student?.name || 'વિદ્યાર્થી';
          const score = Number(sObj?.score ?? sObj?.marks ?? 0);
          return `
            <div style="border: 2px solid ${p.border}; border-radius: 12px; background: ${p.bg}; padding: 12px; text-align: center;">
              <div style="font-size: 24px;">${p.medal}</div>
              <div style="font-weight: 900; font-size: 15px; color: #0f172a; margin-top: 4px;">${sName}</div>
              <div style="font-weight: 900; font-size: 18px; color: #1e3a8a; margin-top: 4px;">${score} <span style="font-size: 11px;">ગુણ</span></div>
              <div style="font-weight: 800; font-size: 11px; color: #475569; margin-top: 2px;">${p.title}</div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Merit Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #1e3a8a; color: #ffffff;">
            <th style="padding: 10px 12px; text-align: center; border-radius: 8px 0 0 0; font-size: 13px;">ક્રમ</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 13px;">વિદ્યાર્થીનું નામ</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 13px;">મોબાઈલ / રોલ નં.</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 13px;">મેળવેલ ગુણ</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 13px;">ટકાવારી</th>
            <th style="padding: 10px 12px; text-align: center; border-radius: 0 8px 0 0; font-size: 13px;">પરિણામ શ્રેણી</th>
          </tr>
        </thead>
        <tbody>
          ${page1SummaryRows}
        </tbody>
      </table>

      <!-- Footer Declaration -->
      <div style="border-top: 1.5px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
        <div>નોંધ: આ પરિણામ ત્રિનેત્ર એકેડેમી દ્વારા મૂલ્યાંકન કરેલ અધિકૃત મેરિટ લિસ્ટ છે.</div>
        <div style="font-weight: 900; color: #0f172a;">પ્રમાણિત સહી: ${teacher}</div>
      </div>
    </div>
  </div>

  <!-- ═════════ PAGES 2-11: INDIVIDUAL SCORECARDS ═════════ -->
  ${individualCardsHtml}

  <script>
    window.onload = function() {
      // Auto-trigger print after short delay
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}

/* ═══════════════════════════════════════════════════════════════
   2. EXPORT TOP 10 SINGLE-PAGE POSTER (WhatsApp / Notice Board)
═══════════════════════════════════════════════════════════════ */
export function exportTop10PosterPDF(topList = [], teacherProfile = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF પ્રિન્ટ કરવા માટે પોપ-અપ વિન્ડો (Popups) ચાલુ કરો.');
    return;
  }

  const academy = teacherProfile.academy || teacherProfile.academyName || 'ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)';
  const teacher = teacherProfile.name || 'શિક્ષક TET-2';
  const helpline = teacherProfile.phone || '8200405300';
  const dateStr = new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  const rowsHtml = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const score = Number(s.score ?? s.marks ?? 0);
    const total = Number(s.totalMarks || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const medal = idx === 0 ? '👑 🥇 ૧' : idx === 1 ? '🥈 ૨' : idx === 2 ? '🥉 ૩' : `#${idx + 1}`;
    const badgeColor = idx === 0 ? '#d97706' : idx === 1 ? '#64748b' : idx === 2 ? '#ea580c' : '#2563eb';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: ${idx < 3 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'}; border-radius: 10px; margin-bottom: 6px; border: 1px solid ${idx < 3 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'};">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-weight: 900; font-size: 15px; color: ${badgeColor}; width: 44px;">${medal}</span>
          <span style="font-weight: 800; font-size: 15px; color: #ffffff;">${sName}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-weight: 900; font-size: 16px; color: #4ade80;">${score} ગુણ</span>
          <span style="font-size: 13px; color: #93c5fd; background: rgba(37,99,235,0.25); padding: 2px 8px; borderRadius: 6px; font-weight: 800;">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Top 10 Poster - ${academy}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700;800;900&display=swap');
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Hind Vadodara', -apple-system, sans-serif;
      margin: 0;
      padding: 10px;
      background: #090e1a;
      color: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 10px; right: 14px; z-index: 9999; display: flex; gap: 10px; background: #0f172a; padding: 8px 16px; border-radius: 10px; border: 1px solid #38bdf8;">
    <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; cursor: pointer;">
      🖨️ પ્રિન્ટ / સેવ (Save Poster PDF)
    </button>
  </div>

  <div style="border: 2px solid rgba(245,158,11,0.5); border-radius: 20px; padding: 24px; background: radial-gradient(120% 120% at 50% 0%, #1e3a8a 0%, #0f172a 60%, #090e1a 100%); box-shadow: 0 10px 40px rgba(0,0,0,0.8); min-height: 96vh; display: flex; flex-direction: column; justify-content: space-between;">
    
    <!-- Top Header -->
    <div style="text-align: center; border-bottom: 1.5px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
      <div style="color: #60a5fa; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 2px;">
        ★ TRINETRA ACADEMY OFFICIAL MERIT ★
      </div>
      <h1 style="color: #ffffff; margin: 4px 0 0; font-size: 28px; font-weight: 900;">
        ${academy}
      </h1>
      <div style="display: inline-block; background: linear-gradient(135deg,#d97706,#b45309); color: white; padding: 4px 18px; border-radius: 20px; font-weight: 900; font-size: 14px; margin-top: 10px; box-shadow: 0 4px 16px rgba(217,119,6,0.4);">
        👑 ટોપ ૧૦ વિજેતાઓ (TOP 10 RANKERS)
      </div>
      <div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">
        કસોટી તારીખ: ${dateStr} • માર્ગદર્શક: ${teacher}
      </div>
    </div>

    <!-- Middle Top 10 List -->
    <div style="margin: 18px 0;">
      ${rowsHtml}
    </div>

    <!-- Bottom Motivational Strip -->
    <div style="border-top: 1.5px solid rgba(255,255,255,0.1); padding-top: 14px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="color: #fbbf24; font-weight: 900; font-size: 13px;">"મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી!"</div>
        <div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">વિદ્યાર્થીઓને ખૂબ ખૂબ અભિનંદન 💐</div>
      </div>
      <div style="text-align: right;">
        <div style="color: #38bdf8; font-weight: 800; font-size: 13px;">📞 હેલ્પલાઇન: ${helpline}</div>
        <div style="color: #64748b; font-size: 11px;">Trinetra Online Testing Portal</div>
      </div>
    </div>

  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/* ═══════════════════════════════════════════════════════════════
   3. EXPORT TOP 10 EXCEL SPREADSHEET (.xlsx)
═══════════════════════════════════════════════════════════════ */
export function exportTop10Excel(topList = [], teacherProfile = {}) {
  const academy = teacherProfile.academy || teacherProfile.academyName || 'Trinetra Online Academy';
  
  const excelData = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sMobile = s.student?.mobile || s.student?.rollNo || 'N/A';
    const score = Number(s.score ?? s.marks ?? 0);
    const total = Number(s.totalMarks || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const testTitle = s.test?.testName || 'Mock Test';

    return {
      'મેરિટ ક્રમ (Rank)': idx + 1,
      'વિદ્યાર્થીનું નામ (Student Name)': sName,
      'મોબાઈલ નંબર (Mobile)': sMobile,
      'કસોટીનું નામ (Test)': testTitle,
      'મેળવેલ ગુણ (Score)': score,
      'કુલ ગુણ (Total Marks)': total || score,
      'ટકાવારી (Percentage)': `${pct}%`,
      'પરિણામ (Status)': pct >= 40 ? 'PASSED' : 'NEEDS PRACTICE',
      'એકેડેમી (Academy)': academy
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Top 10 Merit List');

  // Generate and download file
  XLSX.writeFile(workbook, `Trinetra_Top_10_Merit_List_${Date.now()}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════════
   4. MODAL DIALOG COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Top10ScorecardExportModal({ isOpen, onClose, topStudents = [], teacherProfile = {} }) {
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const validTop10 = topStudents.slice(0, 10);

  const handleDownloadBooklet = () => {
    setDownloading(true);
    try {
      exportTop10BookletPDF(validTop10, teacherProfile);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPoster = () => {
    setDownloading(true);
    try {
      exportTop10PosterPDF(validTop10, teacherProfile);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = () => {
    exportTop10Excel(validTop10, teacherProfile);
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div className="animate-fade-in" style={{
        background: 'radial-gradient(120% 120% at 50% 0%, rgba(30, 58, 138, 0.6) 0%, rgba(15, 23, 42, 0.98) 100%)',
        border: '1.5px solid rgba(245, 158, 11, 0.45)',
        borderRadius: 22,
        padding: '24px',
        width: '100%',
        maxWidth: 580,
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(245,158,11,0.15)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(245,158,11,0.4)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <Trophy size={22} color="#fef08a" />
            </div>
            <div>
              <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', margin: 0 }}>
                Top 10 સ્કોરકાર્ડ & મેરિટ એક્સપોર્ટ
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.74rem', margin: '3px 0 0', fontWeight: 600 }}>
                એક સાથે તમામ ટોચના ૧૦ વિદ્યાર્થીઓના રિપોર્ટ ડાઉનલોડ કરો
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none', color: '#cbd5e1',
              width: 32, height: 32, borderRadius: 10,
              fontSize: '1.1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            ✕
          </button>
        </div>

        {/* Student Preview Summary Strip */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fbbf24', fontSize: '0.76rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Crown size={14} /> તૈયાર થયેલ ટોપર્સ યાદી
            </span>
            <span style={{ color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800 }}>
              કુલ: {validTop10.length} વિદ્યાર્થીઓ
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {validTop10.slice(0, 5).map((s, idx) => (
              <div key={idx} style={{
                background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                border: idx === 0 ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)',
                padding: '4px 10px', borderRadius: 8,
                fontSize: '0.72rem', fontWeight: 800,
                color: idx === 0 ? '#fef08a' : '#e2e8f0',
                whiteSpace: 'nowrap'
              }}>
                #{idx + 1} {s.student?.name || 'વિદ્યાર્થી'} ({Number(s.score ?? 0)} ગુણ)
              </div>
            ))}
            {validTop10.length > 5 && (
              <div style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                +{validTop10.length - 5} વધુ...
              </div>
            )}
          </div>
        </div>

        {/* 3 Main Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Option 1: Combined Booklet PDF */}
          <button
            onClick={handleDownloadBooklet}
            disabled={downloading}
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(15,23,42,0.9) 100%)',
              border: '1.5px solid rgba(56,189,248,0.45)',
              borderRadius: 16,
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              boxShadow: '0 8px 24px rgba(37,99,235,0.2)',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #1d4ed8, #0284c7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
            }}>
              <FileText size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem' }}>
                  📄 કમ્બાઈન્ડ સ્કોરકાર્ડ બુકલેટ (Combined Multi-Page PDF)
                </div>
                <span style={{ fontSize: '0.64rem', background: 'rgba(56,189,248,0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontWeight: 900 }}>
                  સૌથી વધુ પસંદ ⭐
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.4 }}>
                એક જ PDF માં પેજ ૧ પર મેરિટ સમરી અને પાછળ તમામ ૧૦ વિદ્યાર્થીઓના વ્યક્તિગત સર્ટિફિકેટ્સ.
              </div>
            </div>
          </button>

          {/* Option 2: 1-Page Poster PDF */}
          <button
            onClick={handleDownloadPoster}
            disabled={downloading}
            style={{
              background: 'linear-gradient(135deg, rgba(217,119,6,0.2) 0%, rgba(15,23,42,0.9) 100%)',
              border: '1.5px solid rgba(245,158,11,0.4)',
              borderRadius: 16,
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              boxShadow: '0 8px 24px rgba(217,119,6,0.15)',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(217,119,6,0.35)'
            }}>
              <Award size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem', marginBottom: 2 }}>
                🏆 ૧-પેજ મેરિટ લિસ્ટ પોસ્ટર (WhatsApp & નોટિસ બોર્ડ)
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.4 }}>
                એક જ સુંદર A4 પેજ પર ૧ થી ૧૦ રેન્કર્સની યાદી, WhatsApp સ્ટેટસ અને સ્કૂલ બોર્ડ માટે ઉત્તમ.
              </div>
            </div>
          </button>

          {/* Option 3: Excel Sheet */}
          <button
            onClick={handleDownloadExcel}
            style={{
              background: 'linear-gradient(135deg, rgba(5,150,105,0.2) 0%, rgba(15,23,42,0.9) 100%)',
              border: '1.5px solid rgba(16,185,129,0.35)',
              borderRadius: 16,
              padding: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              boxShadow: '0 8px 24px rgba(16,185,129,0.15)',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #059669, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(16,185,129,0.35)'
            }}>
              <Download size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem', marginBottom: 2 }}>
                📊 Excel સ્પ્રેડશીટ ડાઉનલોડ (.xlsx)
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', lineHeight: 1.4 }}>
                ટોપ ૧૦ વિદ્યાર્થીઓના ગુણ, ટકાવારી અને મોબાઇલ નંબર સાથે ઓફિશિયલ એક્સેલ રિપોર્ટ.
              </div>
            </div>
          </button>

        </div>

        {/* Modal Close Button */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#94a3b8',
              padding: '9px 24px',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            બંધ કરો (Cancel)
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
