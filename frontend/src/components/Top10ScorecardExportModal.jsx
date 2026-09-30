import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, Printer, Trophy, FileText, CheckCircle, Award, Users, Smartphone, ShieldCheck, Crown, Filter } from 'lucide-react';
import { getLeaderboardOverrides } from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   1. EXPORT TOP 10 COMBINED MULTI-PAGE BOOKLET PDF
═══════════════════════════════════════════════════════════════ */
export function exportTop10BookletPDF(topList = [], teacherProfile = {}, testMeta = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF પ્રિન્ટ કરવા માટે પોપ-અપ વિન્ડો (Popups) ચાલુ કરો.');
    return;
  }

  const academy = teacherProfile.academy || teacherProfile.academyName || 'ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)';
  const teacher = teacherProfile.name || 'શિક્ષક TET-2';
  const helpline = teacherProfile.phone || '8200405300';
  const dateStr = new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const testTitle = testMeta.testName || 'કસોટી પરિણામ';
  const testSubject = testMeta.subject || '';
  const metaTotal = Number(testMeta.totalMarks || 0);

  // Generate HTML for Page 1: Merit Summary Table
  const page1SummaryRows = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sRoll = s.student?.mobile || s.student?.rollNo || `TR-${1000 + idx + 1}`;
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const rankNum = s.assignedRank || (idx + 1);
    const medal = rankNum === 1 ? '👑 🥇 ૧' : rankNum === 2 ? '🥈 ૨' : rankNum === 3 ? '🥉 ૩' : `#${rankNum}`;
    const badgeColor = rankNum === 1 ? '#b45309' : rankNum === 2 ? '#475569' : rankNum === 3 ? '#c2410c' : '#1e3a8a';
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
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const cardTestTitle = testTitle !== 'કસોટી પરિણામ' ? testTitle : (s.test?.testName || s.testName || 'સ્પેશ્યલ મોક ટેસ્ટ');
    const rankNum = s.assignedRank || (idx + 1);
    const rankTitle = rankNum === 1 ? '૧ લો ક્રમ (1st State Topper)' : rankNum === 2 ? '૨ જો ક્રમ (2nd State Rank)' : rankNum === 3 ? '૩ જો ક્રમ (3rd State Rank)' : `મેરિટ ક્રમ #${rankNum}`;
    const grade = pct >= 80 ? 'A+ (Outstanding)' : pct >= 60 ? 'A (Excellent)' : pct >= 40 ? 'B (Qualified)' : 'Participated';
    const medalIcon = rankNum === 1 ? '👑 🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : '🎖️';

    return `
      <div class="page-break" style="padding-top: 10px;">
        <div style="border: 3px double #1e3a8a; border-radius: 16px; padding: 24px; position: relative; background: #ffffff; min-height: 900px; display: flex; flex-direction: column; justify-content: space-between;">
          
          <!-- Watermark -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 50px; font-weight: 900; color: rgba(30, 58, 138, 0.04); white-space: nowrap; pointer-events: none; text-transform: uppercase;">
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
                  <td style="padding: 6px 0; color: #1e3a8a; font-weight: 800;">${cardTestTitle}</td>
                </tr>
                ${testSubject ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 700;">વિષય:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 800;">${testSubject}</td>
                </tr>` : ''}
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

            <!-- Performance Remarks Bar -->
            <div style="background: #f1f5f9; border-left: 4px solid #1e3a8a; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">મૂલ્યાંકન અભિપ્રાય (Evaluation Remarks):</div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">
                ${pct >= 70 ? 'ઉત્કૃષ્ટ પરિણામ! સ્પર્ધાત્મક પરીક્ષામાં આ જ ઉત્સાહ જાળવી રાખવો.' : 'સારો પ્રયાસ. નબળા વિષયોમાં વધારે રિવિઝન અને પ્રેક્ટિસ જરૂરી છે.'}
              </div>
            </div>
          </div>

          <!-- Scorecard Footer & Official Seals -->
          <div style="border-top: 1.5px solid #cbd5e1; padding-top: 20px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div style="text-align: center;">
                <div style="width: 80px; height: 80px; border: 2px dashed #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #0284c7; text-align: center; text-transform: uppercase; margin: 0 auto 6px; padding: 4px;">
                  TRINETRA<br/>ACADEMY<br/>VERIFIED
                </div>
                <div style="font-size: 11px; color: #64748b; font-weight: 700;">સત્તાવાર મોહર</div>
              </div>

              <div style="text-align: center;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 25px;">સહાયતા & માર્ગદર્શન: ${helpline}</div>
                <div style="font-size: 11px; color: #94a3b8;">કમ્પ્યુટર-જનરેટેડ અધિકૃત સ્કોરકાર્ડ</div>
              </div>

              <div style="text-align: center;">
                <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 22px; color: #1e3a8a; margin-bottom: 4px;">
                  ${teacher}
                </div>
                <div style="border-top: 1.5px solid #0f172a; width: 150px; margin: 0 auto; padding-top: 4px;">
                  <div style="font-size: 12px; font-weight: 900; color: #0f172a;">અધિકૃત શિક્ષક સહી</div>
                  <div style="font-size: 10px; color: #64748b;">(પ્રિન્સિપાલ / કન્વીનર)</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  // Complete HTML document with Print stylesheet
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Top 10 Scorecard Booklet - ${testTitle} - ${academy}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700;800;900&display=swap');
    
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Hind Vadodara', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #f8fafc;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    @media print {
      body {
        background: #ffffff;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <!-- Screen Action Bar (Hidden on print) -->
  <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #0f172a; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-bottom: 2px solid #38bdf8;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">📄</span>
      <div>
        <div style="font-weight: 900; font-size: 15px;">ટોપ ૧૦ સ્કોરકાર્ડ સંપૂર્ણ બુકલેટ (૧૧ પેજ A4 PDF)</div>
        <div style="font-size: 12px; color: #94a3b8;">${testTitle} • પેજ ૧: સમરી મેરિટ લિસ્ટ | પેજ ૨ થી ૧૧: વિદ્યાર્થી વાઇઝ સ્કોરકાર્ડ</div>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: linear-gradient(135deg, #2563eb, #0284c7); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px; box-shadow: 0 2px 10px rgba(37,99,235,0.4);">
        🖨️ બુકલેટ પ્રિન્ટ કરો / Save as PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px;">
        ✕ બંધ કરો
      </button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       PAGE 1: OFFICIAL TOP 10 MERIT SUMMARY TABLE
  ═══════════════════════════════════════════════════════════════ -->
  <div style="padding: 24px 30px; background: #ffffff; min-height: 980px; position: relative;">
    
    <!-- Top Branding -->
    <div style="text-align: center; border-bottom: 2.5px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 22px;">
      <div style="color: #1e3a8a; font-size: 26px; font-weight: 900; text-transform: uppercase;">
        ${academy}
      </div>
      <div style="color: #475569; font-size: 14px; font-weight: 700; margin-top: 4px;">
        ગુજરાત રાજ્ય સ્પર્ધાત્મક પરીક્ષા પરિણામ અને મેરિટ બોર્ડ
      </div>
      <div style="display: inline-block; background: #1e3a8a; color: white; padding: 5px 22px; border-radius: 20px; font-weight: 900; font-size: 14px; margin-top: 10px;">
        ★ અધિકૃત ટોપ ૧૦ મેરિટ લિસ્ટ (TOP 10 MERIT LIST) ★
      </div>
    </div>

    <!-- Test Meta Info Box -->
    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 14px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <div style="font-size: 11px; color: #1e40af; font-weight: 800; text-transform: uppercase;">કસોટી વિગત:</div>
        <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 2px;">
          📝 ${testTitle}
        </div>
        ${testSubject ? `<div style="font-size: 12px; color: #3b82f6; font-weight: 700; margin-top: 2px;">વિષય: ${testSubject}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; color: #1e40af; font-weight: 800; text-transform: uppercase;">પરિણામ જાહેરાત તારીખ:</div>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
          📅 ${dateStr}
        </div>
        ${metaTotal > 0 ? `<div style="font-size: 12px; color: #059669; font-weight: 800; margin-top: 2px;">કુલ ગુણ: ${metaTotal}</div>` : ''}
      </div>
    </div>

    <!-- Summary Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: #1e3a8a; color: white;">
          <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 900; border-top-left-radius: 8px;">ક્રમ</th>
          <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 900;">વિદ્યાર્થીનું નામ</th>
          <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 900;">મોબાઈલ નંબર</th>
          <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 900;">મેળવેલ ગુણ</th>
          <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 900;">ટકાવારી</th>
          <th style="padding: 12px; text-align: center; font-size: 13px; font-weight: 900; border-top-right-radius: 8px;">શ્રેણી</th>
        </tr>
      </thead>
      <tbody>
        ${page1SummaryRows}
      </tbody>
    </table>

    <!-- Notice / Note -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin-bottom: 40px;">
      <div style="font-weight: 800; color: #0f172a; font-size: 12px;">📌 નોંધ (General Notice):</div>
      <div style="color: #64748b; font-size: 11px; margin-top: 4px; line-height: 1.5;">
        આ બુકલેટમાં આગળના પેજ (પેજ ૨ થી ૧૧) પર તમામ ૧૦ ટોપર્સ વિદ્યાર્થીઓના વ્યક્તિગત અધિકૃત સ્કોરકાર્ડ સામેલ છે. સંસ્થા દ્વારા પ્રમાણિત કરવામાં આવે છે કે તમામ ગુણ પરિણામો સાચા અને માન્ય છે.
      </div>
    </div>

    <!-- Official Signature Line -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; padding-top: 20px; border-top: 1.5px solid #e2e8f0;">
      <div>
        <div style="font-size: 12px; font-weight: 800; color: #0f172a;">હેલ્પલાઇન નંબર: ${helpline}</div>
        <div style="font-size: 11px; color: #94a3b8;">ત્રિનેત્ર ઓનલાઇન એકેડેમી પોર્ટલ</div>
      </div>
      <div style="text-align: center;">
        <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 22px; color: #1e3a8a; margin-bottom: 4px;">
          ${teacher}
        </div>
        <div style="border-top: 1.5px solid #0f172a; width: 160px; padding-top: 4px;">
          <div style="font-size: 12px; font-weight: 900; color: #0f172a;">પરીક્ષા નિયંત્રક / શિક્ષક</div>
        </div>
      </div>
    </div>

  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       PAGES 2 TO 11: INDIVIDUAL STUDENT SCORECARDS
  ═══════════════════════════════════════════════════════════════ -->
  ${individualCardsHtml}

</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}

/* ═══════════════════════════════════════════════════════════════
   2. EXPORT TOP 10 SINGLE-PAGE POSTER (WhatsApp / Notice Board)
═══════════════════════════════════════════════════════════════ */
export function exportTop10PosterPDF(topList = [], teacherProfile = {}, testMeta = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF પ્રિન્ટ કરવા માટે પોપ-અપ વિન્ડો (Popups) ચાલુ કરો.');
    return;
  }

  const academy = teacherProfile.academy || teacherProfile.academyName || 'ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)';
  const teacher = teacherProfile.name || 'શિક્ષક TET-2';
  const helpline = teacherProfile.phone || '8200405300';
  const dateStr = new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const testTitle = testMeta.testName || 'કસોટી પરિણામ';
  const metaTotal = Number(testMeta.totalMarks || 0);

  const rowsHtml = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const rankNum = s.assignedRank || (idx + 1);
    const medal = rankNum === 1 ? '👑 🥇 ૧' : rankNum === 2 ? '🥈 ૨' : rankNum === 3 ? '🥉 ૩' : `#${rankNum}`;
    const badgeColor = rankNum === 1 ? '#d97706' : rankNum === 2 ? '#64748b' : rankNum === 3 ? '#ea580c' : '#2563eb';

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: ${idx < 3 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'}; border-radius: 10px; margin-bottom: 6px; border: 1px solid ${idx < 3 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'};">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-weight: 900; font-size: 15px; color: ${badgeColor}; width: 44px;">${medal}</span>
          <span style="font-weight: 800; font-size: 15px; color: #ffffff;">${sName}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-weight: 900; font-size: 16px; color: #4ade80;">${score} ${total > 0 ? `<span style="font-size: 12px; color: #94a3b8;">/ ${total}</span>` : 'ગુણ'}</span>
          <span style="font-size: 13px; color: #93c5fd; background: rgba(37,99,235,0.25); padding: 2px 8px; border-radius: 6px; font-weight: 800;">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Top 10 Poster - ${testTitle} - ${academy}</title>
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
      <div style="font-size: 17px; font-weight: 900; color: #38bdf8; margin-top: 6px;">
        📝 કસોટી: ${testTitle} ${metaTotal > 0 ? `(કુલ ગુણ: ${metaTotal})` : ''}
      </div>
      <div style="display: inline-block; background: linear-gradient(135deg,#d97706,#b45309); color: white; padding: 4px 18px; border-radius: 20px; font-weight: 900; font-size: 14px; margin-top: 8px; box-shadow: 0 4px 16px rgba(217,119,6,0.4);">
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
export function exportTop10Excel(topList = [], teacherProfile = {}, testMeta = {}) {
  const academy = teacherProfile.academy || teacherProfile.academyName || 'Trinetra Online Academy';
  const testTitle = testMeta.testName || 'Mock Test';
  const metaTotal = Number(testMeta.totalMarks || 0);

  const excelData = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sMobile = s.student?.mobile || s.student?.rollNo || 'N/A';
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const itemTestTitle = testTitle !== 'Mock Test' ? testTitle : (s.test?.testName || s.testName || 'Mock Test');

    return {
      'મેરિટ ક્રમ (Rank)': s.assignedRank || (idx + 1),
      'વિદ્યાર્થીનું નામ (Student Name)': sName,
      'મોબાઈલ નંબર (Mobile)': sMobile,
      'કસોટીનું નામ (Test)': itemTestTitle,
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

  // Sanitize filename
  const cleanTitle = (testTitle || 'Test').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_').slice(0, 30);
  XLSX.writeFile(workbook, `Trinetra_Top_10_${cleanTitle}_${Date.now()}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════════
   4. MODAL DIALOG COMPONENT (WITH TEST-WISE SELECTION)
═══════════════════════════════════════════════════════════════ */
export default function Top10ScorecardExportModal({
  isOpen,
  onClose,
  topStudents = [],
  submissions = [],
  overrides = [],
  initialTestKey = 'ALL',
  teacherProfile = {}
}) {
  const [downloading, setDownloading] = useState(false);
  const [internalOverrides, setInternalOverrides] = useState(overrides || []);

  // Sync internalOverrides with prop when prop changes
  useEffect(() => {
    if (Array.isArray(overrides) && overrides.length > 0) {
      setInternalOverrides(overrides);
    }
  }, [overrides]);

  // Whenever modal opens, fetch latest overrides from server to guarantee 100% real-time data
  useEffect(() => {
    if (isOpen) {
      getLeaderboardOverrides()
        .then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setInternalOverrides(res.data);
          }
        })
        .catch(err => {
          console.warn('Top 10 export modal overrides fetch note:', err);
        });
    }
  }, [isOpen]);

  const effectiveOverrides = (internalOverrides && internalOverrides.length > 0) ? internalOverrides : (overrides || []);

  // Group submissions by test to populate the dropdown
  const testOptions = useMemo(() => {
    const pool = submissions.length > 0 ? submissions : topStudents;
    const map = {};

    pool.forEach(sub => {
      const key = sub.testCode || (sub.testName ? `NAME_${sub.testName}` : (sub.test?.testName ? `NAME_${sub.test.testName}` : 'GENERAL'));
      const testName = sub.testName || sub.test?.testName || sub.chapter || 'સામાન્ય કસોટી (General Test)';
      const totalMarks = sub.totalMarks || sub.totalMCQ || sub.test?.totalMarks || 0;
      const subject = sub.subject || sub.test?.subject || 'સામાન્ય';

      if (!map[key]) {
        map[key] = {
          key,
          testCode: sub.testCode || '',
          testName,
          subject,
          totalMarks,
          submissions: []
        };
      }
      map[key].submissions.push(sub);
      if (totalMarks && !map[key].totalMarks) {
        map[key].totalMarks = totalMarks;
      }
    });

    const list = Object.values(map).map(item => ({
      key: item.key,
      label: `📝 ${item.testName} (${item.submissions.length} વિદ્યાર્થીઓ)`,
      testName: item.testName,
      testCode: item.testCode,
      subject: item.subject,
      totalMarks: item.totalMarks,
      submissions: item.submissions
    })).sort((a, b) => b.submissions.length - a.submissions.length);

    return [
      {
        key: 'ALL',
        label: `🔥 તમામ કસોટીઓ (ઓવરઓલ ટોપ ૧૦) — કુલ ${pool.length} સબમિશન`,
        testName: 'તમામ કસોટીઓ (ઓવરઓલ)',
        testCode: '',
        subject: 'તમામ વિષય',
        totalMarks: null,
        submissions: pool
      },
      ...list
    ];
  }, [submissions, topStudents]);

  const [selectedKey, setSelectedKey] = useState(initialTestKey || 'ALL');

  useEffect(() => {
    if (initialTestKey) {
      setSelectedKey(initialTestKey);
    }
  }, [initialTestKey, isOpen]);

  // Compute Top 10 for the currently selected test (applying teacher overrides & custom ranks strictly)
  const { currentTop10, currentTestMeta } = useMemo(() => {
    const selectedGroup = testOptions.find(o => o.key === selectedKey) || testOptions[0];
    const rawSubs = selectedGroup?.submissions || [];

    // Deduplicate by student mobile/id (keep submission with customRank or highest score)
    const studentBestMap = new Map();
    rawSubs.forEach(sub => {
      const cleanMob = sub.student?.mobile ? String(sub.student.mobile).replace(/\D/g, '').slice(-10) : '';
      const studentKey = cleanMob || sub.student?.id || sub.student?.name || `sub_${sub.id}`;
      const currentScore = Number(sub.mcqScore ?? sub.score ?? sub.marks ?? 0);
      const existing = studentBestMap.get(studentKey);
      const existingScore = existing ? Number(existing.mcqScore ?? existing.score ?? existing.marks ?? 0) : -1;

      if (!existing) {
        studentBestMap.set(studentKey, sub);
      } else if (sub.customRank && !existing.customRank) {
        studentBestMap.set(studentKey, sub);
      } else if (currentScore > existingScore && !existing.customRank) {
        studentBestMap.set(studentKey, sub);
      }
    });

    const enriched = Array.from(studentBestMap.values())
      .map(s => ({
        ...s,
        score: Number(s.mcqScore ?? s.score ?? s.marks ?? 0)
      }));

    // Active overrides for this test (or ALL)
    const activeOvs = (effectiveOverrides || [])
      .filter(o => o.isActive && (
        o.testCode === selectedKey ||
        o.testCode === 'ALL' ||
        (selectedGroup?.testCode && o.testCode === selectedGroup.testCode) ||
        (selectedGroup?.testName && (o.testCode === `NAME_${selectedGroup.testName}` || o.testCode === selectedGroup.testName))
      ));

    // Helper to find override for a student (Mobile number match takes absolute highest priority!)
    const findOvForStudent = (s) => {
      const cleanSubMob = s.student?.mobile ? String(s.student.mobile).replace(/\D/g, '').slice(-10) : '';
      return activeOvs.find(ov => {
        const cleanOvMob = ov.mobile ? String(ov.mobile).replace(/\D/g, '').slice(-10) : '';
        if (ov.submissionId && s.id === ov.submissionId) return true;
        if (cleanSubMob && cleanOvMob && cleanSubMob === cleanOvMob) return true;
        if (!cleanOvMob && s.student?.name && ov.studentName && s.student.name.trim().toLowerCase() === ov.studentName.trim().toLowerCase()) return true;
        return false;
      });
    };

    // Include any overrides that might not be in the raw submissions list
    activeOvs.forEach(ov => {
      const cleanOvMob = ov.mobile ? String(ov.mobile).replace(/\D/g, '').slice(-10) : '';
      const exists = enriched.some(s => {
        const cleanSubMob = s.student?.mobile ? String(s.student.mobile).replace(/\D/g, '').slice(-10) : '';
        if (ov.submissionId && s.id === ov.submissionId) return true;
        if (cleanSubMob && cleanOvMob && cleanSubMob === cleanOvMob) return true;
        if (!cleanOvMob && s.student?.name && ov.studentName && s.student.name.trim().toLowerCase() === ov.studentName.trim().toLowerCase()) return true;
        return false;
      });
      if (!exists) {
        enriched.push({
          id: ov.submissionId || Math.floor(Math.random() * 100000),
          student: { name: ov.studentName, mobile: ov.mobile },
          score: Number(ov.score ?? 0),
          totalMarks: ov.totalMarks || selectedGroup?.totalMarks || 100,
          isTeacherOverride: true,
          customRank: ov.rank
        });
      }
    });

    // Map each student with their target assigned rank (from override or customRank on submission)
    const withRankInfo = enriched.map(s => {
      const ov = findOvForStudent(s);
      const assignedRank = ov?.rank ? Number(ov.rank) : (s.customRank ? Number(s.customRank) : null);
      return {
        ...s,
        score: ov?.score !== undefined ? Number(ov.score) : s.score,
        isTeacherOverride: Boolean(ov || s.customRank),
        assignedRank: (assignedRank && assignedRank > 0) ? assignedRank : null
      };
    });

    // Separate students with assigned ranks and unassigned students
    const assigned = withRankInfo.filter(s => s.assignedRank !== null)
      .sort((a, b) => a.assignedRank - b.assignedRank);

    const unassigned = withRankInfo.filter(s => s.assignedRank === null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const getDur = (item) => {
          let d = item.duration || item.timeTaken || item.timeSpentSeconds || 0;
          if (!d && Array.isArray(item.answers)) {
            item.answers.forEach(ans => { if (ans && ans.timeSpent) d += Number(ans.timeSpent) || 0; });
          }
          if (!d && item.startedAt && item.submittedAt) {
            const diff = Math.round((new Date(item.submittedAt).getTime() - new Date(item.startedAt).getTime()) / 1000);
            if (diff > 0 && diff < 86400) d = diff;
          }
          return d > 0 ? d : 999999;
        };
        const durA = getDur(a);
        const durB = getDur(b);
        if (durA !== durB) return durA - durB;
        const timeA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      });

    // Place assigned rank students into their exact 0-indexed slots (Slot 0 for Rank 1, Slot 1 for Rank 2...)
    const finalTop = [];
    const assignedBySlot = new Map();
    assigned.forEach(s => {
      const slotIdx = s.assignedRank - 1;
      if (!assignedBySlot.has(slotIdx)) {
        assignedBySlot.set(slotIdx, s);
      } else {
        unassigned.unshift(s);
      }
    });

    let unassignedIdx = 0;
    for (let i = 0; finalTop.length < 10 && (assignedBySlot.size > 0 || unassignedIdx < unassigned.length); i++) {
      if (assignedBySlot.has(i)) {
        finalTop.push(assignedBySlot.get(i));
        assignedBySlot.delete(i);
      } else if (unassignedIdx < unassigned.length) {
        finalTop.push(unassigned[unassignedIdx++]);
      } else {
        break;
      }
    }
    if (assignedBySlot.size > 0) {
      assignedBySlot.forEach(s => {
        if (finalTop.length < 10) finalTop.push(s);
      });
    }

    const sorted = finalTop.slice(0, 10);

    let metaTotal = selectedGroup?.totalMarks;
    if (!metaTotal || metaTotal <= 0) {
      const maxSc = sorted.length ? Math.max(...sorted.map(s => Number(s.mcqScore ?? s.score ?? 0))) : 100;
      metaTotal = maxSc > 100 ? 150 : (maxSc > 50 ? 100 : (maxSc > 25 ? 50 : 25));
    }

    return {
      currentTop10: sorted,
      currentTestMeta: {
        testName: selectedGroup?.testName || 'કસોટી',
        testCode: selectedGroup?.testCode || '',
        subject: selectedGroup?.subject || '',
        totalMarks: metaTotal
      }
    };
  }, [testOptions, selectedKey, effectiveOverrides]);

  if (!isOpen) return null;

  const handleDownloadBooklet = () => {
    setDownloading(true);
    try {
      exportTop10BookletPDF(currentTop10, teacherProfile, currentTestMeta);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPoster = () => {
    setDownloading(true);
    try {
      exportTop10PosterPDF(currentTop10, teacherProfile, currentTestMeta);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadExcel = () => {
    exportTop10Excel(currentTop10, teacherProfile, currentTestMeta);
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
        maxWidth: 620,
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(245,158,11,0.15)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
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
                ટેસ્ટ વાઇઝ અથવા ઓવરઓલ ૧૦ વિદ્યાર્થીઓના રિપોર્ટ ડાઉનલોડ કરો
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

        {/* ── Test-Wise Dropdown Selector ── */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1.5px solid rgba(56, 189, 248, 0.4)',
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={14} /> કસોટી પસંદ કરો (Select Test-Wise):
            </label>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
              {testOptions.length - 1} કસોટીઓ ઉપલબ્ધ
            </span>
          </div>

          <select
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
            style={{
              width: '100%',
              background: '#090e1a',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 10,
              padding: '10px 12px',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {testOptions.map(opt => (
              <option key={opt.key} value={opt.key} style={{ background: '#090e1a', color: '#ffffff' }}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Student Preview Summary Strip */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 18
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#fbbf24', fontSize: '0.76rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Crown size={14} /> પસંદ કરેલ: {currentTestMeta.testName}
            </span>
            <span style={{ color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800 }}>
              {currentTop10.length} વિદ્યાર્થીઓ
            </span>
          </div>

          {currentTop10.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.76rem', textAlign: 'center', padding: '10px 0' }}>
              આ કસોટીમાં હજુ કોઈ સબમિશન ઉપલબ્ધ નથી
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {currentTop10.slice(0, 5).map((s, idx) => (
                <div key={idx} style={{
                  background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                  border: idx === 0 ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  padding: '4px 10px', borderRadius: 8,
                  fontSize: '0.72rem', fontWeight: 800,
                  color: idx === 0 ? '#fef08a' : '#e2e8f0',
                  whiteSpace: 'nowrap'
                }}>
                  #{idx + 1} {s.student?.name || 'વિદ્યાર્થી'} ({Number(s.mcqScore ?? s.score ?? s.marks ?? 0)} ગુણ)
                </div>
              ))}
              {currentTop10.length > 5 && (
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  +{currentTop10.length - 5} વધુ...
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3 Main Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Option 1: Combined Booklet PDF */}
          <button
            onClick={handleDownloadBooklet}
            disabled={downloading || currentTop10.length === 0}
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(15,23,42,0.9) 100%)',
              border: '1.5px solid rgba(56,189,248,0.45)',
              borderRadius: 16,
              padding: '16px',
              cursor: currentTop10.length === 0 ? 'not-allowed' : 'pointer',
              opacity: currentTop10.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              transition: 'all 0.18s ease',
              boxShadow: '0 4px 18px rgba(37,99,235,0.25)'
            }}
            onMouseEnter={e => { if (currentTop10.length > 0) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #1d4ed8, #0284c7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 0 12px rgba(56,189,248,0.4)'
            }}>
              <FileText size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem' }}>
                  ૧. સંપૂર્ણ મલ્ટી-પેજ A4 બુકલેટ PDF (Print / PDF)
                </span>
                <span style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8', fontSize: '0.64rem', padding: '2px 8px', borderRadius: 6, fontWeight: 900 }}>
                  સત્તાવાર ૧૧ પેજ
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.74rem', margin: '4px 0 0', lineHeight: 1.4 }}>
                પેજ ૧: સંપૂર્ણ મેરિટ સમરી • પેજ ૨ થી ૧૧: દરેક ટોપર વિદ્યાર્થીનું વ્યક્તિગત સ્કોરકાર્ડ
              </p>
            </div>
            <Download size={18} color="#38bdf8" />
          </button>

          {/* Option 2: WhatsApp / Notice Board Poster PDF */}
          <button
            onClick={handleDownloadPoster}
            disabled={downloading || currentTop10.length === 0}
            style={{
              background: 'linear-gradient(135deg, rgba(217,119,6,0.25) 0%, rgba(15,23,42,0.9) 100%)',
              border: '1.5px solid rgba(245,158,11,0.45)',
              borderRadius: 16,
              padding: '16px',
              cursor: currentTop10.length === 0 ? 'not-allowed' : 'pointer',
              opacity: currentTop10.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              transition: 'all 0.18s ease',
              boxShadow: '0 4px 18px rgba(217,119,6,0.25)'
            }}
            onMouseEnter={e => { if (currentTop10.length > 0) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 0 12px rgba(245,158,11,0.4)'
            }}>
              <Award size={22} color="#fef08a" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem' }}>
                  ૨. સિંગલ-પેજ નોટિસ બોર્ડ & WhatsApp પોસ્ટર PDF
                </span>
                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.64rem', padding: '2px 8px', borderRadius: 6, fontWeight: 900 }}>
                  પોસ્ટર / સ્ટેટસ
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.74rem', margin: '4px 0 0', lineHeight: 1.4 }}>
                WhatsApp ગ્રૂપ, સ્ટેટસ અથવા નોટિસ બોર્ડ માટે ૧ સિંગલ હાઈ-રિઝોલ્યુશન A4 પોસ્ટર
              </p>
            </div>
            <Printer size={18} color="#fbbf24" />
          </button>

          {/* Option 3: Excel Spreadsheet */}
          <button
            onClick={handleDownloadExcel}
            disabled={currentTop10.length === 0}
            style={{
              background: 'linear-gradient(135deg, rgba(5,150,105,0.25) 0%, rgba(15,23,42,0.9) 100%)',
              border: '1.5px solid rgba(52,211,153,0.45)',
              borderRadius: 16,
              padding: '16px',
              cursor: currentTop10.length === 0 ? 'not-allowed' : 'pointer',
              opacity: currentTop10.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              transition: 'all 0.18s ease',
              boxShadow: '0 4px 18px rgba(5,150,105,0.2)'
            }}
            onMouseEnter={e => { if (currentTop10.length > 0) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', flexShrink: 0,
              boxShadow: '0 0 12px rgba(52,211,153,0.4)'
            }}>
              <Download size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem' }}>
                  ૩. એક્સેલ સ્પ્રેડશીટ ડાઉનલોડ (.xlsx)
                </span>
                <span style={{ background: 'rgba(52,211,153,0.2)', color: '#6ee7b7', fontSize: '0.64rem', padding: '2px 8px', borderRadius: 6, fontWeight: 900 }}>
                  Excel ડેટા
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.74rem', margin: '4px 0 0', lineHeight: 1.4 }}>
                ૧ ક્લિકમાં તમામ ટોપ ૧૦ વિદ્યાર્થીઓના નામ, મોબાઈલ, ગુણ અને ગ્રેડ સાથે એક્સેલ ફાઈલ
              </p>
            </div>
            <Download size={18} color="#6ee7b7" />
          </button>

        </div>

        {/* Footer info note */}
        <div style={{ marginTop: 18, textAlign: 'center', color: '#64748b', fontSize: '0.7rem' }}>
          🔒 સુરક્ષિત એક્સપોર્ટ • ત્રિનેત્ર ઓનલાઇન એકેડેમી પોર્ટલ • સહાયતા: {teacherProfile.phone || '8200405300'}
        </div>

      </div>
    </div>,
    document.body
  );
}
