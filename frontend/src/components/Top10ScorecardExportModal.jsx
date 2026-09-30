import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, Printer, Trophy, FileText, CheckCircle, Award, Users, Smartphone, ShieldCheck, Crown, Filter, Camera, ArrowLeft, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
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
    const sPhoto = s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
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
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 24px; display: flex; align-items: center; gap: 20px;">
              ${sPhoto ? `
                <div style="width: 82px; height: 82px; border-radius: 12px; border: 2.5px solid #1e3a8a; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.12); background: #ffffff;">
                  <img src="${sPhoto}" alt="${sName}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              ` : ''}
              <table style="width: 100%; border-collapse: collapse; flex: 1;">
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

  // Helper for generating High-End Student Photo / Royal Golden Avatar
  const getStudentAvatar = (s, rankNum, size = 48) => {
    const sName = s?.student?.name || 'વિદ્યાર્થી';
    const photo = s?.photoUrl || s?.student?.photoUrl || s?.student?.photo || null;
    const initial = (sName.trim()[0] || '?').toUpperCase();
    const isTopper1 = rankNum === 1;
    const isTopper2 = rankNum === 2;
    const isTopper3 = rankNum === 3;

    const ringBorder = isTopper1 ? '#f59e0b' : isTopper2 ? '#cbd5e1' : isTopper3 ? '#ea580c' : '#38bdf8';
    const glow = isTopper1 ? 'rgba(245,158,11,0.75)' : isTopper2 ? 'rgba(203,213,225,0.45)' : isTopper3 ? 'rgba(234,88,12,0.45)' : 'rgba(56,189,248,0.3)';
    const ringGradient = isTopper1 
      ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #f59e0b 100%)' 
      : isTopper2 
        ? 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 50%, #cbd5e1 100%)' 
        : isTopper3 
          ? 'linear-gradient(135deg, #fed7aa 0%, #ea580c 50%, #c2410c 100%)' 
          : 'linear-gradient(135deg, #38bdf8, #1e3a8a)';
    const bg = isTopper1 
      ? 'linear-gradient(135deg, #d97706, #78350f)' 
      : isTopper2 
        ? 'linear-gradient(135deg, #64748b, #334155)' 
        : isTopper3 
          ? 'linear-gradient(135deg, #c2410c, #7c2d12)' 
          : 'linear-gradient(135deg, #1e3a8a, #0f172a)';

    if (photo && (photo.startsWith('http') || photo.startsWith('data:'))) {
      return `
        <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
          ${isTopper1 ? `
            <div style="font-size: ${Math.round(size * 0.34)}px; line-height: 1; margin-bottom: 3px; filter: drop-shadow(0 2px 6px rgba(245,158,11,0.95)); z-index: 5;">
              👑
            </div>
          ` : ''}
          <div style="width: ${size}px; height: ${size}px; border-radius: 50%; padding: ${isTopper1 ? '3.5px' : '2.5px'}; background: ${ringGradient}; box-shadow: 0 0 22px ${glow}, 0 4px 14px rgba(0,0,0,0.6); flex-shrink: 0; display: inline-block;">
            <img src="${photo}" alt="${sName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; object-position: center top; display: block; background: #0f172a;" />
          </div>
        </div>
      `;
    }

    return `
      <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
        ${isTopper1 ? `
          <div style="font-size: ${Math.round(size * 0.34)}px; line-height: 1; margin-bottom: 3px; filter: drop-shadow(0 2px 6px rgba(245,158,11,0.95)); z-index: 5;">
            👑
          </div>
        ` : ''}
        <div style="width: ${size}px; height: ${size}px; border-radius: 50%; padding: ${isTopper1 ? '3.5px' : '2.5px'}; background: ${ringGradient}; box-shadow: 0 0 22px ${glow}, 0 4px 14px rgba(0,0,0,0.6); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;">
          <div style="width: 100%; height: 100%; border-radius: 50%; background: ${bg}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${Math.round(size * 0.42)}px; text-transform: uppercase;">
            ${initial}
          </div>
        </div>
      </div>
    `;
  };

  const top1 = topList[0];
  const top2 = topList[1];
  const top3 = topList[2];
  const others = topList.slice(3, 10);

  // Helper for single podium card in Top 3
  const renderPodiumCard = (s, rankNum, medal, label, color, borderGlow, avatarSize = 76) => {
    if (!s) {
      return `<div style="flex: 1; min-height: 200px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px;"></div>`;
    }
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sMobile = s.student?.mobile ? String(s.student.mobile).slice(0, 5) + '*****' : '';
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const isFirst = rankNum === 1;

    return `
      <div style="flex: ${isFirst ? '1.25' : '1'}; background: ${isFirst ? 'radial-gradient(130% 120% at 50% 0%, rgba(245,158,11,0.22) 0%, rgba(15,23,42,0.96) 100%)' : 'radial-gradient(130% 120% at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(15,23,42,0.94) 100%)'}; border: ${isFirst ? '2.5px solid #f59e0b' : `2px solid ${color}`}; border-radius: 18px; padding: ${isFirst ? '16px 12px' : '14px 10px'}; text-align: center; box-shadow: 0 10px 30px ${borderGlow}, inset 0 0 15px rgba(0,0,0,0.4); position: relative; ${isFirst ? 'transform: translateY(-8px); z-index: 2;' : ''}">
        
        <!-- Medal Badge Pill -->
        <div style="display: inline-block; background: ${isFirst ? 'linear-gradient(135deg, #f59e0b, #d97706)' : color}; color: ${isFirst ? '#0f172a' : '#ffffff'}; padding: ${isFirst ? '4px 14px' : '3px 12px'}; border-radius: 20px; font-weight: 900; font-size: ${isFirst ? '12px' : '11px'}; margin-bottom: 8px; letter-spacing: 0.5px; box-shadow: 0 3px 10px rgba(0,0,0,0.5);">
          ${medal} ${label}
        </div>

        <!-- Student DP / Avatar (Big & Beautiful with Crown above, NOT overlapping face) -->
        <div style="margin: 2px 0 8px; display: flex; justify-content: center;">
          ${getStudentAvatar(s, rankNum, avatarSize)}
        </div>

        <!-- Student Name -->
        <div style="font-weight: 900; font-size: ${isFirst ? '17px' : '14px'}; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; text-shadow: 0 2px 6px rgba(0,0,0,0.7); letter-spacing: 0.3px;">
          ${sName}
        </div>

        ${sMobile ? `<div style="font-size: 10.5px; color: #94a3b8; font-family: monospace; margin-top: 3px; display: flex; align-items: center; justify-content: center; gap: 4px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <span style="color: #94a3b8; font-weight: 700;">${sMobile}</span>
        </div>` : ''}

        <!-- Score & Percentage Badge -->
        <div style="margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.55); padding: 4px 12px; border-radius: 12px; border: 1.5px solid ${isFirst ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.14)'}; box-shadow: 0 4px 14px rgba(0,0,0,0.4);">
          <span style="font-weight: 900; font-size: ${isFirst ? '17px' : '14.5px'}; color: #4ade80; text-shadow: 0 0 10px rgba(74,222,128,0.4);">
            ${score} ${total > 0 ? `<span style="font-size: 11px; color: #94a3b8; font-weight: 700;">/ ${total}</span>` : ''}
          </span>
          <span style="background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; padding: 2px 8px; border-radius: 6px; font-weight: 900; font-size: 11.5px; box-shadow: 0 2px 6px rgba(29,78,216,0.4);">
            ${pct}%
          </span>
        </div>

      </div>
    `;
  };

  // Rank 4 to 10 Rows with Student Photos & Avatars
  const otherRowsHtml = others.map((s, idx) => {
    const rankNum = s.assignedRank || (idx + 4);
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sMobile = s.student?.mobile ? String(s.student.mobile).slice(0, 5) + '*****' : '';
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: rgba(255,255,255,0.035); border-radius: 10px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.08);">
        
        <div style="display: flex; align-items: center; gap: 10px;">
          <!-- Rank Pill -->
          <div style="font-weight: 900; font-size: 12px; color: #38bdf8; width: 32px; height: 32px; background: rgba(56,189,248,0.12); border: 1.5px solid rgba(56,189,248,0.35); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            #${rankNum}
          </div>

          <!-- Student DP / Avatar -->
          ${getStudentAvatar(s, rankNum, 40)}

          <!-- Name & Mobile -->
          <div style="text-align: left;">
            <div style="font-weight: 800; font-size: 13.5px; color: #ffffff;">${sName}</div>
            ${sMobile ? `<div style="font-size: 9.5px; color: #94a3b8; font-family: monospace; display: flex; align-items: center; gap: 3px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <span>${sMobile}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- Score & Percentage -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 900; font-size: 14.5px; color: #4ade80;">
            ${score} ${total > 0 ? `<span style="font-size: 10.5px; color: #94a3b8;">/ ${total}</span>` : ''}
          </span>
          <span style="font-size: 11px; color: #93c5fd; background: rgba(37,99,235,0.25); padding: 2px 8px; border-radius: 6px; font-weight: 800;">
            ${pct}%
          </span>
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
    @page { size: A4; margin: 6mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Hind Vadodara', -apple-system, sans-serif;
      margin: 0;
      padding: 6px;
      background: #060913;
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
  <div class="no-print" style="position: fixed; top: 10px; right: 14px; z-index: 9999; display: flex; gap: 10px; background: #0f172a; padding: 8px 16px; border-radius: 10px; border: 1px solid #38bdf8; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
    <button onclick="window.print()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 900; font-size: 13px; cursor: pointer;">
      🖨️ પ્રિન્ટ / સેવ (Save High-Res Poster)
    </button>
  </div>

  <div style="border: 2.5px solid #f59e0b; border-radius: 20px; padding: 20px; background: radial-gradient(130% 120% at 50% 0%, #1e3a8a 0%, #0f172a 55%, #050811 100%); box-shadow: 0 0 40px rgba(245,158,11,0.25), inset 0 0 20px rgba(245,158,11,0.1); min-height: 97vh; display: flex; flex-direction: column; justify-content: space-between;">
    
    <!-- Top Header -->
    <div style="text-align: center; border-bottom: 1.5px solid rgba(245,158,11,0.3); padding-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="color: #fbbf24; font-size: 12px; font-weight: 800;">⚜️ ત્રિનેત્ર સ્પેશિયલ મેરિટ ⚜️</span>
        <span style="color: #60a5fa; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;">OFFICIAL MERIT POSTER</span>
        <span style="color: #fbbf24; font-size: 12px; font-weight: 800;">⚜️ TET-2 સ્પેશિયલ ⚜️</span>
      </div>

      <h1 style="color: #ffffff; margin: 2px 0 0; font-size: 26px; font-weight: 900; letter-spacing: 0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">
        ${academy}
      </h1>

      <div style="font-size: 15px; font-weight: 900; color: #38bdf8; margin-top: 4px;">
        📝 કસોટી: ${testTitle} ${metaTotal > 0 ? `(કુલ ગુણ: ${metaTotal})` : ''}
      </div>

      <div style="display: inline-block; background: linear-gradient(135deg,#f59e0b,#b45309); color: #0f172a; padding: 3px 18px; border-radius: 20px; font-weight: 900; font-size: 13px; margin-top: 6px; box-shadow: 0 4px 14px rgba(245,158,11,0.4);">
        👑 ટોચના ૧૦ વિજેતાઓ (TOP 10 RANKERS)
      </div>

      <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">
        📅 કસોટી તારીખ: ${dateStr} • 👨‍🏫 માર્ગદર્શક: ${teacher}
      </div>
    </div>

    <!-- 🏆 3D WINNERS PODIUM (TOP 3 SPOTLIGHT STAGE) -->
    <div style="margin: 12px 0 12px;">
      <div style="display: flex; gap: 12px; align-items: flex-end; justify-content: center; max-width: 680px; margin: 0 auto;">
        ${renderPodiumCard(top2, 2, '🥈', '૨જો રેન્ક', '#cbd5e1', 'rgba(148,163,184,0.35)', 76)}
        ${renderPodiumCard(top1, 1, '🥇', '૧મો રેન્ક (Topper)', '#f59e0b', 'rgba(245,158,11,0.55)', 92)}
        ${renderPodiumCard(top3, 3, '🥉', '૩જો રેન્ક', '#ea580c', 'rgba(234,88,12,0.35)', 76)}
      </div>
    </div>

    <!-- 📜 RANK 4 TO 10 LIST -->
    <div style="margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding: 0 4px;">
        <span style="font-size: 11.5px; font-weight: 900; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">
          🎖️ મેરિટ ક્રમ ૪ થી ૧૦ (Rank 4 to 10 Achievers)
        </span>
        <span style="font-size: 10.5px; color: #94a3b8;">
          ફોટો / ડીજિટલ બેજ સાથે
        </span>
      </div>
      ${otherRowsHtml}
    </div>

    <!-- Bottom Motivational Strip & Verified Seal -->
    <div style="border-top: 1.5px solid rgba(245,158,11,0.3); padding-top: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div>
        <div style="color: #fbbf24; font-weight: 900; font-size: 12px;">"મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી!"</div>
        <div style="color: #94a3b8; font-size: 10.5px; margin-top: 1px;">સફળતા પ્રાપ્ત કરનાર તમામ વિદ્યાર્થીઓને ખૂબ ખૂબ અભિનંદન 💐</div>
      </div>

      <!-- Verified Seal -->
      <div style="background: rgba(245,158,11,0.12); border: 1.5px solid #f59e0b; padding: 4px 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 10.5px; font-weight: 900; color: #fbbf24; letter-spacing: 1px;">
          ★ VERIFIED MERIT ★
        </div>
        <div style="font-size: 9px; color: #cbd5e1;">ત્રિનેત્ર સત્તાવાર પરિણામ</div>
      </div>

      <div style="text-align: right;">
        <div style="color: #38bdf8; font-weight: 900; font-size: 12px;">📞 હેલ્પલાઇન: ${helpline}</div>
        <div style="color: #64748b; font-size: 10px; font-family: monospace;">www.trinetraonline.in</div>
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
  const [showPhotoStep, setShowPhotoStep] = useState(false);

  // Student photos state persisted across sessions
  const [studentPhotos, setStudentPhotos] = useState(() => {
    try {
      const saved = localStorage.getItem('trinetra_poster_student_photos');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    if (!isOpen) {
      setShowPhotoStep(false);
    }
  }, [isOpen]);

  const getStudentKey = (s) => {
    const cleanMob = s?.student?.mobile ? String(s.student.mobile).replace(/\D/g, '').slice(-10) : '';
    return cleanMob || s?.student?.id || s?.student?.name || `sub_${s?.id || Math.random()}`;
  };

  const handlePhotoSelect = (studentKey, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('કૃપા કરીને માન્ય ફોટો ફાઇલ (JPG, PNG) પસંદ કરો.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 360;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        setStudentPhotos(prev => {
          const next = { ...prev, [studentKey]: dataUrl };
          try {
            localStorage.setItem('trinetra_poster_student_photos', JSON.stringify(next));
          } catch (err) {
            console.warn('Storage quota note:', err);
          }
          return next;
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (studentKey) => {
    setStudentPhotos(prev => {
      const next = { ...prev };
      delete next[studentKey];
      try {
        localStorage.setItem('trinetra_poster_student_photos', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

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
      const enriched = currentTop10.map(s => {
        const key = getStudentKey(s);
        return {
          ...s,
          photoUrl: studentPhotos[key] || s.photoUrl || s.student?.photoUrl || s.student?.photo || null
        };
      });
      exportTop10BookletPDF(enriched, teacherProfile, currentTestMeta);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPoster = (includeCustomPhotos = true) => {
    setDownloading(true);
    try {
      const enriched = currentTop10.map(s => {
        const key = getStudentKey(s);
        return {
          ...s,
          photoUrl: (includeCustomPhotos && studentPhotos[key]) 
            ? studentPhotos[key] 
            : (s.photoUrl || s.student?.photoUrl || s.student?.photo || null)
        };
      });
      exportTop10PosterPDF(enriched, teacherProfile, currentTestMeta);
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
        maxWidth: showPhotoStep ? 720 : 620,
        boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(245,158,11,0.15)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto',
        transition: 'max-width 0.25s ease'
      }}>
        
        {/* ═══════════════════════════════════════════════════════════
            VIEW A: PHOTO UPLOAD STEP (FOR WHATSAPP POSTER)
        ═══════════════════════════════════════════════════════════ */}
        {showPhotoStep ? (
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setShowPhotoStep(false)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#cbd5e1',
                    borderRadius: 10,
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  <ArrowLeft size={16} /> પાછા જાઓ
                </button>
                <div>
                  <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📸 વિદ્યાર્થીઓના ફોટા અપલોડ કરો
                  </h2>
                  <p style={{ color: '#fbbf24', fontSize: '0.72rem', margin: '2px 0 0', fontWeight: 700 }}>
                    {currentTestMeta.testName} • WhatsApp & નોટિસ બોર્ડ પોસ્ટર સેટઅપ
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
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Instruction Banner */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <Sparkles size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.75rem', color: '#fef3c7', lineHeight: 1.4 }}>
                <strong>પોસ્ટર સુવિધા:</strong> અહીંથી વિદ્યાર્થીઓનો ફોટો અપલોડ કરી શકો છો. તે WhatsApp પોસ્ટરમાં રિયલ ફોટો તરીકે 3D પોડિયમ પર દેખાશે. જો કોઈ વિદ્યાર્થીનો ફોટો ન હોય તો આપમેળે રોયલ ગોલ્ડન બેજ ડિસ્પ્લે થશે.
              </div>
            </div>

            {/* Top 3 Podium Winners Cards */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.5px' }}>
                🏆 ટોપ ૩ વિજેતાઓ (3D Podium Rankers):
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {[0, 1, 2].map((idx) => {
                  const s = currentTop10[idx];
                  if (!s) return null;
                  const rankNum = idx + 1;
                  const key = getStudentKey(s);
                  const photo = studentPhotos[key] || s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
                  const sName = s.student?.name || 'વિદ્યાર્થી';
                  const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
                  const isRank1 = rankNum === 1;
                  const isRank2 = rankNum === 2;
                  const borderColor = isRank1 ? '#f59e0b' : isRank2 ? '#94a3b8' : '#ea580c';
                  const bgGrad = isRank1 
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(15,23,42,0.92) 100%)' 
                    : isRank2 
                      ? 'linear-gradient(135deg, rgba(148,163,184,0.16) 0%, rgba(15,23,42,0.92) 100%)' 
                      : 'linear-gradient(135deg, rgba(234,88,12,0.16) 0%, rgba(15,23,42,0.92) 100%)';
                  const medal = isRank1 ? '🥇 ૧મો રેન્ક' : isRank2 ? '🥈 ૨જો રેન્ક' : '🥉 ૩જો રેન્ક';

                  return (
                    <div key={key} style={{
                      background: bgGrad,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: 14,
                      padding: '14px 10px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                      boxShadow: `0 4px 16px ${borderColor}22`
                    }}>
                      {isRank1 && (
                        <div style={{ fontSize: '20px', lineHeight: 1, marginBottom: 2, filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.8))' }}>
                          👑
                        </div>
                      )}

                      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: borderColor, marginBottom: 8 }}>
                        {medal}
                      </div>

                      {/* Photo / Avatar Preview (Larger & Attractive) */}
                      <div style={{ position: 'relative', width: isRank1 ? 82 : 70, height: isRank1 ? 82 : 70, marginBottom: 10 }}>
                        {photo ? (
                          <img
                            src={photo}
                            alt={sName}
                            style={{
                              width: '100%', height: '100%', borderRadius: '50%',
                              objectFit: 'cover', objectPosition: 'center top', border: `3px solid ${borderColor}`,
                              boxShadow: `0 0 16px ${borderColor}88`
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%', borderRadius: '50%',
                            background: isRank1 ? 'linear-gradient(135deg, #d97706, #78350f)' : 'linear-gradient(135deg, #1e3a8a, #0f172a)',
                            border: `3px solid ${borderColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 900, fontSize: isRank1 ? '1.8rem' : '1.5rem',
                            boxShadow: `0 0 16px ${borderColor}66`
                          }}>
                            {(sName.trim()[0] || '?').toUpperCase()}
                          </div>
                        )}
                        {photo && (
                          <span style={{ position: 'absolute', bottom: 0, right: 0, background: '#059669', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, border: '2px solid #0f172a', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                            ✓
                          </span>
                        )}
                      </div>

                      <div style={{ color: 'white', fontWeight: 900, fontSize: '0.84rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sName}
                      </div>
                      <div style={{ color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800, marginBottom: 10 }}>
                        {score} ગુણ
                      </div>

                      {/* Upload & Remove buttons */}
                      <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center' }}>
                        <label style={{
                          background: isRank1 ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.1)',
                          border: isRank1 ? 'none' : '1px solid rgba(255,255,255,0.2)',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          padding: '6px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: isRank1 ? '0 2px 10px rgba(217,119,6,0.4)' : 'none'
                        }}>
                          <Camera size={13} />
                          {photo ? 'બદલો' : 'ફોટો અપલોડ'}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handlePhotoSelect(key, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                        {photo && (
                          <button
                            onClick={() => handleRemovePhoto(key)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              borderRadius: 8,
                              padding: '6px 9px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="ફોટો હટાવો"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rank 4 to 10 Achievers List */}
            {currentTop10.length > 3 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                  🎖️ રેન્ક ૪ થી ૧૦ વિદ્યાર્થીઓ (વૈકલ્પિક ફોટો):
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {currentTop10.slice(3, 10).map((s, idx) => {
                    const rankNum = idx + 4;
                    const key = getStudentKey(s);
                    const photo = studentPhotos[key] || s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
                    const sName = s.student?.name || 'વિદ્યાર્થી';
                    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);

                    return (
                      <div key={key} style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 10,
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{
                            background: 'rgba(56,189,248,0.15)', color: '#38bdf8',
                            fontSize: '0.7rem', fontWeight: 900, width: 22, height: 22,
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0
                          }}>
                            #{rankNum}
                          </span>

                          {/* Avatar Circle */}
                          <div style={{ width: 34, height: 34, position: 'relative', flexShrink: 0 }}>
                            {photo ? (
                              <img
                                src={photo}
                                alt={sName}
                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #38bdf8' }}
                              />
                            ) : (
                              <div style={{
                                width: '100%', height: '100%', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #1e3a8a, #0f172a)',
                                border: '1.5px solid rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 800, fontSize: '0.8rem'
                              }}>
                                {(sName.trim()[0] || '?').toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'white', fontWeight: 800, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sName}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                              {score} ગુણ
                            </div>
                          </div>
                        </div>

                        {/* Upload & Remove */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <label style={{
                            background: photo ? 'rgba(5, 150, 105, 0.25)' : 'rgba(255,255,255,0.08)',
                            border: photo ? '1px solid rgba(5, 150, 105, 0.45)' : '1px solid rgba(255,255,255,0.15)',
                            color: photo ? '#6ee7b7' : '#cbd5e1',
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '4px 8px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Camera size={11} />
                            {photo ? 'બદલો' : 'ફોટો'}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                handlePhotoSelect(key, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                        {photo && (
                          <button
                            onClick={() => handleRemovePhoto(key)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              borderRadius: 6,
                              padding: '4px 6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="હટાવો"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <button
              onClick={() => setShowPhotoStep(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94a3b8',
                padding: '9px 14px',
                borderRadius: 10,
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              ← પાછા જાઓ
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleDownloadPoster(false)}
                disabled={downloading}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  padding: '9px 14px',
                  borderRadius: 10,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⏩ ફોટા વગર સીધું ડાઉનલોડ
              </button>

              <button
                onClick={() => handleDownloadPoster(true)}
                disabled={downloading}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                  border: 'none',
                  color: '#0f172a',
                  padding: '9px 20px',
                  borderRadius: 10,
                  fontSize: '0.84rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(245,158,11,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Printer size={16} color="#0f172a" />
                {downloading ? 'જનરેટ થઈ રહ્યું છે...' : '🖨️ ફોટા સાથે પોસ્ટર બનાવો (PDF)'}
              </button>
            </div>
          </div>

        </div>
      ) : (

        /* ═══════════════════════════════════════════════════════════
            VIEW B: MAIN 3 OPTIONS SELECTION
        ═══════════════════════════════════════════════════════════ */
        <div>
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
              onClick={() => setShowPhotoStep(true)}
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
                    📸 ફોટો અપલોડ & 3D પોડિયમ
                  </span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.74rem', margin: '4px 0 0', lineHeight: 1.4 }}>
                  વિદ્યાર્થીઓના ફોટા અપલોડ કરો અને WhatsApp સ્ટેટસ/ગ્રૂપ માટે 3D પોડિયમ પોસ્ટર બનાવો
                </p>
              </div>
              <Camera size={18} color="#fbbf24" />
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
      )}

      </div>
    </div>,
    document.body
  );
}
