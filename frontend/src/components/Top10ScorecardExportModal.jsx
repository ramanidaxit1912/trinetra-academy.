import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, Printer, Trophy, FileText, CheckCircle, Award, Users, Smartphone, ShieldCheck, Crown, Filter, Camera, ArrowLeft, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { getLeaderboardOverrides } from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS FOR SCORECARDS & POSTERS
═══════════════════════════════════════════════════════════════ */

// Shared helper to extract duration and finish time
export const getSubmissionTimeInfo = (s) => {
  let d = s?.duration || s?.timeTaken || s?.timeSpentSeconds || 0;
  if (!d && Array.isArray(s?.answers)) {
    s.answers.forEach(ans => { if (ans && ans.timeSpent) d += Number(ans.timeSpent) || 0; });
  }
  if (!d && s?.startedAt && s?.submittedAt) {
    const diff = Math.round((new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 1000);
    if (diff > 0 && diff < 86400) d = diff;
  }

  let durStr = '';
  if (d > 0 && d < 86400) {
    const mins = Math.floor(d / 60);
    const secs = d % 60;
    durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  let finishTimeStr = '';
  const ts = s?.submittedAt || s?.createdAt || s?.completedAt;
  if (ts) {
    try {
      const dObj = new Date(ts);
      if (!isNaN(dObj.getTime())) {
        finishTimeStr = dObj.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (e) {}
  }

  return {
    durationSeconds: d,
    durationStr: durStr,
    finishTimeStr: finishTimeStr
  };
};

// Vector QR Code SVG Helper for Certificate Authenticity
export const getSvgQrCode = (size = 64) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#ffffff" rx="6" stroke="#cbd5e1" stroke-width="1.5"/>
  <!-- Corner 1 -->
  <rect x="8" y="8" width="28" height="28" rx="4" stroke="#0f172a" stroke-width="4" fill="none"/>
  <rect x="16" y="16" width="12" height="12" rx="2" fill="#0f172a"/>
  <!-- Corner 2 -->
  <rect x="64" y="8" width="28" height="28" rx="4" stroke="#0f172a" stroke-width="4" fill="none"/>
  <rect x="72" y="16" width="12" height="12" rx="2" fill="#0f172a"/>
  <!-- Corner 3 -->
  <rect x="8" y="64" width="28" height="28" rx="4" stroke="#0f172a" stroke-width="4" fill="none"/>
  <rect x="16" y="72" width="12" height="12" rx="2" fill="#0f172a"/>
  <!-- Data Modules -->
  <rect x="42" y="12" width="6" height="6" fill="#0f172a"/>
  <rect x="52" y="12" width="6" height="6" fill="#0f172a"/>
  <rect x="42" y="24" width="6" height="6" fill="#0f172a"/>
  <rect x="52" y="32" width="6" height="6" fill="#0f172a"/>
  <rect x="12" y="44" width="6" height="6" fill="#0f172a"/>
  <rect x="22" y="44" width="6" height="6" fill="#0f172a"/>
  <rect x="32" y="44" width="6" height="6" fill="#0f172a"/>
  <rect x="42" y="44" width="16" height="16" rx="2" fill="#0284c7"/>
  <rect x="64" y="44" width="6" height="6" fill="#0f172a"/>
  <rect x="76" y="44" width="12" height="6" fill="#0f172a"/>
  <rect x="44" y="66" width="6" height="6" fill="#0f172a"/>
  <rect x="54" y="74" width="6" height="12" fill="#0f172a"/>
  <rect x="68" y="66" width="12" height="6" fill="#0f172a"/>
  <rect x="68" y="78" width="6" height="10" fill="#0f172a"/>
  <rect x="80" y="74" width="10" height="14" fill="#0f172a"/>
</svg>
`;

// Official Round Seal Stamp HTML Helper
export const getOfficialSealStampHtml = (size = 80) => `
<div style="width: ${size}px; height: ${size}px; border: 2px dashed #0284c7; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; color: #0284c7; text-align: center; text-transform: uppercase; margin: 0 auto 5px; padding: 4px; background: rgba(2,132,199,0.04); position: relative;">
  <span style="font-size: 13px; margin-bottom: 1px;">⭐</span>
  <span style="letter-spacing: 0.5px; line-height: 1.15; font-size: 8px;">TRINETRA<br/>ACADEMY<br/>VERIFIED</span>
  <span style="font-size: 7px; color: #0369a1; font-weight: 800; margin-top: 2px;">★ 2026 ★</span>
</div>
`;

/* ═══════════════════════════════════════════════════════════════
   1. EXPORT TOP 10 COMBINED MULTI-PAGE BOOKLET PDF (ROYAL EDITION)
═══════════════════════════════════════════════════════════════ */
export function exportTop10BookletPDF(topList = [], teacherProfile = {}, testMeta = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF પ્રિન્ટ કરવા માટે પોપ-અપ વિન્ડો (Popups) ચાલુ કરો.');
    return;
  }

  const academy = teacherProfile.academy || teacherProfile.academyName || 'ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)';
  const teacher = 'Sunil'; // Explicitly set to Sunil as requested
  const helpline = teacherProfile.phone || '8200405300';
  const dateStr = new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const testTitle = testMeta.testName || 'કસોટી પરિણામ';
  const testSubject = testMeta.subject || '';
  const metaTotal = Number(testMeta.totalMarks || 0);

  const top1 = topList[0];
  const highestScore = top1 ? Number(top1.mcqScore ?? top1.score ?? top1.marks ?? 0) : 0;
  const highestTotal = metaTotal > 0 ? metaTotal : (top1 ? Number(top1.totalMarks || top1.totalMCQ || (top1.test?.questionsCount ? Number(top1.test.questionsCount) : 0)) : 0);
  const highestPct = highestTotal > 0 ? Math.round((highestScore / highestTotal) * 100) : (highestScore > 0 ? 100 : 0);

  // Generate HTML for Page 1: Merit Summary Table Rows
  const page1SummaryRows = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sRoll = s.student?.mobile || s.student?.rollNo || `TR-${1000 + idx + 1}`;
    const sPhoto = s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const rankNum = s.assignedRank || (idx + 1);
    const timeInfo = getSubmissionTimeInfo(s);

    const medalPill = rankNum === 1 
      ? '<span style="background: #fef3c7; color: #b45309; padding: 3px 8px; border-radius: 12px; border: 1.5px solid #f59e0b; font-weight: 900; font-size: 13px;">👑 ૧</span>'
      : rankNum === 2 
        ? '<span style="background: #f1f5f9; color: #334155; padding: 3px 8px; border-radius: 12px; border: 1.5px solid #94a3b8; font-weight: 900; font-size: 13px;">🥈 ૨</span>'
        : rankNum === 3 
          ? '<span style="background: #ffedd5; color: #c2410c; padding: 3px 8px; border-radius: 12px; border: 1.5px solid #ea580c; font-weight: 900; font-size: 13px;">🥉 ૩</span>'
          : `<span style="background: #eff6ff; color: #1e3a8a; padding: 3px 8px; border-radius: 12px; border: 1px solid #bfdbfe; font-weight: 800; font-size: 12px;">#${rankNum}</span>`;

    const grade = pct >= 80 ? 'A+ (ઉત્કૃષ્ટ)' : pct >= 60 ? 'A (પ્રથમ વર્ગ)' : pct >= 40 ? 'B (સફળ)' : 'પ્રયાસ';
    const initial = (sName.trim()[0] || 'V').toUpperCase();

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 8px 6px; text-align: center;">
          ${medalPill}
        </td>
        <td style="padding: 8px 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 32px; border-radius: 6px; border: 1.5px solid ${rankNum === 1 ? '#d97706' : '#cbd5e1'}; overflow: hidden; flex-shrink: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${sPhoto ? `<img src="${sPhoto}" alt="${sName}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="color: #38bdf8; font-size: 12px; font-weight: 900;">${initial}</span>`}
            </div>
            <div>
              <div style="font-weight: 800; color: #0f172a; font-size: 13.5px; line-height: 1.2;">${sName}</div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 1px;">મેરિટ ટોપર #${rankNum}</div>
            </div>
          </div>
        </td>
        <td style="padding: 8px 10px; color: #475569; font-size: 12px; font-family: monospace; font-weight: 700;">
          ${sRoll}
        </td>
        <td style="padding: 8px 6px; text-align: center;">
          <div style="font-size: 11.5px; font-weight: 800; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 6px; display: inline-block;">
            ⏱️ ${timeInfo.durationStr || '-'}
          </div>
        </td>
        <td style="padding: 8px 6px; text-align: center;">
          <div style="font-weight: 900; color: #0f274a; font-size: 14px;">${score}</div>
          ${total > 0 ? `<div style="font-size: 10px; color: #64748b;">કુલ: ${total}</div>` : ''}
        </td>
        <td style="padding: 8px 10px; text-align: center;">
          <div style="font-weight: 900; color: #059669; font-size: 13.5px;">${pct}%</div>
          <div style="background: #e2e8f0; height: 4px; border-radius: 2px; overflow: hidden; margin-top: 2px; width: 70px; margin-left: auto; margin-right: auto;">
            <div style="background: ${pct >= 70 ? '#059669' : '#0284c7'}; width: ${pct}%; height: 100%;"></div>
          </div>
        </td>
        <td style="padding: 8px 6px; text-align: center;">
          <span style="font-weight: 800; color: #1e40af; font-size: 11.5px; background: #eff6ff; padding: 3px 8px; border-radius: 8px; border: 1px solid #dbeafe;">
            ${grade.split(' ')[0]}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Generate Individual School Award Certificates for Each Student (Pages 2 to 11)
  const individualCardsHtml = topList.slice(0, 10).map((s, idx) => {
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sRoll = s.student?.mobile || s.student?.rollNo || `TR-${1000 + idx + 1}`;
    const sPhoto = s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const cardTestTitle = testTitle !== 'કસોટી પરિણામ' ? testTitle : (s.test?.testName || s.testName || 'સ્પેશ્યલ મોક ટેસ્ટ');
    const rankNum = s.assignedRank || (idx + 1);
    const timeInfo = getSubmissionTimeInfo(s);

    const isRank1 = rankNum === 1;
    const isRank2 = rankNum === 2;
    const isRank3 = rankNum === 3;

    const rankTitle = isRank1 
      ? '૧ લો ક્રમ (1st State Topper - Gold Medalist)' 
      : isRank2 
        ? '૨ જો ક્રમ (2nd State Rank - Silver Medalist)' 
        : isRank3 
          ? '૩ જો ક્રમ (3rd State Rank - Bronze Medalist)' 
          : `મેરિટ ટોપર ક્રમ #${rankNum}`;

    const medalIcon = isRank1 ? '👑 🥇' : isRank2 ? '🥈' : isRank3 ? '🥉' : '🎖️';

    const bannerBg = isRank1
      ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
      : isRank2
        ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
        : isRank3
          ? 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)'
          : 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)';

    const bannerBorder = isRank1 ? '#d97706' : isRank2 ? '#64748b' : isRank3 ? '#ea580c' : '#0284c7';
    const bannerColor = isRank1 ? '#92400e' : isRank2 ? '#334155' : isRank3 ? '#9a3412' : '#0369a1';

    const grade = pct >= 80 ? 'A+ (ઉત્કૃષ્ટ - Outstanding)' : pct >= 60 ? 'A (પ્રથમ વર્ગ - Excellent)' : pct >= 40 ? 'B (સફળ - Qualified)' : 'પ્રયાસ - Participated';
    const initial = (sName.trim()[0] || 'V').toUpperCase();

    const remarkText = pct >= 80 
      ? 'રાજ્ય સ્તરે ઉત્કૃષ્ટ પ્રદર્શન બદલ સંસ્થા ગૌરવ અનુભવે છે. સ્પર્ધાત્મક પરીક્ષામાં આ જ તેજસ્વી પરિણામ જાળવી રાખવું.'
      : pct >= 60 
        ? 'ખૂબ ઉત્સાહજનક અને પ્રશંસનીય પરિણામ! થોડું વધારે રિવિઝન તમને પ્રથમ ક્રમ તરફ દોરી જશે.'
        : 'સારો પ્રયાસ! નિયમિત અભ્યાસ અને મોક ટેસ્ટથી આગામી પરીક્ષામાં ઘણો ઊંચો સ્કોર પ્રાપ્ત થશે.';

    return `
      <div class="page-break" style="padding-top: 4px;">
        <div style="border: 4px solid #0f274a; outline: 2px solid #d97706; outline-offset: -8px; border-radius: 14px; padding: 20px 24px; position: relative; background: #ffffff; min-height: 940px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
          
          <!-- Watermark -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 50px; font-weight: 900; color: rgba(15, 39, 74, 0.035); white-space: nowrap; pointer-events: none; text-transform: uppercase; letter-spacing: 2px;">
            ${academy}
          </div>

          <!-- Decorative Corner Accents -->
          <div style="position: absolute; top: 12px; left: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>
          <div style="position: absolute; top: 12px; right: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>
          <div style="position: absolute; bottom: 12px; left: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>
          <div style="position: absolute; bottom: 12px; right: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>

          <!-- Top Section -->
          <div>
            <!-- Certificate Top Header -->
            <div style="text-align: center; border-bottom: 2px solid #0f274a; padding-bottom: 12px; margin-bottom: 14px;">
              <div style="color: #d97706; font-size: 13px; font-weight: 800; letter-spacing: 3px; margin-bottom: 2px;">
                ★ ★ ★ ★ ★
              </div>
              <div style="color: #0f274a; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
                ${academy}
              </div>
              <div style="color: #475569; font-size: 12px; font-weight: 700; margin-top: 1px;">
                ગુજરાત રાજ્ય સ્પર્ધાત્મક પરીક્ષા મંડળ • શૈક્ષણિક ગુણવત્તા બોર્ડ
              </div>
              <div style="display: inline-block; background: linear-gradient(135deg, #0f274a 0%, #1e3a8a 100%); color: #ffffff; padding: 6px 28px; border-radius: 20px; font-weight: 900; font-size: 14px; margin-top: 8px; border: 1.5px solid #d97706; box-shadow: 0 2px 6px rgba(15,39,74,0.25); letter-spacing: 0.5px;">
                ✦ સન્માન પ્રમાણપત્ર (CERTIFICATE OF EXCELLENCE) ✦
              </div>
            </div>

            <!-- Certificate Serial Number & Date Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #64748b; font-weight: 800; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px; margin-bottom: 14px;">
              <div>પ્રમાણપત્ર ક્રમાંક: <span style="color: #0f274a; font-family: monospace;">TR-2026/TOP10/${1000 + idx + 1}</span></div>
              <div>નિર્ગમન તારીખ: <span style="color: #0f274a;">${dateStr}</span></div>
            </div>

            <!-- Official School Certificate Citation Paragraph (સત્તાવાર પ્રશસ્તિ પત્રક લખાણ) -->
            <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; text-align: center; box-shadow: inset 0 0 10px rgba(0,0,0,0.02);">
              <div style="font-size: 13.5px; color: #44403c; font-weight: 600; line-height: 1.75;">
                આથી અત્યંત ગૌરવ અને હર્ષ સાથે પ્રમાણિત કરવામાં આવે છે કે,<br/>
                કુમાર / કુમારી <span style="font-size: 21px; font-weight: 900; color: #0f274a; border-bottom: 2px dashed #0284c7; padding: 0 12px; display: inline-block; margin: 2px 0;">${sName}</span><br/>
                (રોલ નંબર / સંપર્ક: <strong style="font-family: monospace; color: #0284c7; font-size: 14px;">${sRoll}</strong>) એ સંસ્થા દ્વારા આયોજિત <strong style="color: #0f274a;">"${cardTestTitle}"</strong> ${testSubject ? `(વિષય: <strong>${testSubject}</strong>)` : ''} કસોટીમાં ઉત્કૃષ્ટ શૈક્ષણિક પ્રદર્શન દાખવીને સમગ્ર રાજ્ય / સંસ્થા કક્ષાએ
              </div>

              <!-- Rank Award Ribbon Badge -->
              <div style="margin: 8px 0;">
                <div style="display: inline-block; background: ${bannerBg}; border: 1.5px solid ${bannerBorder}; color: ${bannerColor}; padding: 6px 24px; border-radius: 24px; font-size: 15px; font-weight: 900; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                  ${medalIcon} ${rankTitle}
                </div>
              </div>

              <div style="font-size: 12.5px; color: #57534e; font-weight: 600; line-height: 1.5;">
                પ્રાપ્ત કરી ઉત્તીર્ણ થયેલ છે. તેમના આ વિશિષ્ટ પ્રદાન અને તેજસ્વી ભવિષ્ય માટે સંસ્થા હાર્દિક અભિનંદન અને ઉજ્જવળ કારકિર્દીની શુભકામનાઓ પાઠવે છે.
              </div>
            </div>

            <!-- Student Bio & Marksheet Dual Card -->
            <div style="display: grid; grid-template-columns: 110px 1fr; gap: 14px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; align-items: center;">
              
              <!-- Passport Studio Photo Frame -->
              <div style="width: 100px; height: 114px; border-radius: 10px; border: 2.5px solid ${isRank1 ? '#d97706' : '#0284c7'}; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 3px 10px rgba(0,0,0,0.15);">
                ${sPhoto ? `
                  <img src="${sPhoto}" alt="${sName}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="text-align: center; color: white;">
                    <div style="font-size: 36px; font-weight: 900; color: #38bdf8;">${initial}</div>
                    <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #94a3b8;">TOPPER</div>
                  </div>
                `}
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15,23,42,0.9); color: ${isRank1 ? '#fbbf24' : '#38bdf8'}; font-size: 9px; font-weight: 900; text-align: center; padding: 2px 0;">
                  ${isRank1 ? '👑 RANK 1' : `TOP #${rankNum}`}
                </div>
              </div>

              <!-- Academic Marksheet Grid -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 9.5px; color: #64748b; font-weight: 800; text-transform: uppercase;">કુલ ગુણ</div>
                  <div style="font-size: 16px; font-weight: 900; color: #0f274a; margin-top: 1px;">${total || score}</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 9.5px; color: #64748b; font-weight: 800; text-transform: uppercase;">મેળવેલ ગુણ</div>
                  <div style="font-size: 18px; font-weight: 900; color: #0284c7; margin-top: 1px;">${score}</div>
                </div>
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 9.5px; color: #64748b; font-weight: 800; text-transform: uppercase;">ટકાવારી દર</div>
                  <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 1px;">${pct}%</div>
                  <div style="background: #e2e8f0; height: 3px; border-radius: 2px; overflow: hidden; margin-top: 2px; width: 45px; margin-left: auto; margin-right: auto;">
                    <div style="background: ${pct >= 70 ? '#059669' : '#0284c7'}; width: ${pct}%; height: 100%;"></div>
                  </div>
                </div>
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 9.5px; color: #64748b; font-weight: 800; text-transform: uppercase;">સમયગાળો</div>
                  <div style="font-size: 14px; font-weight: 900; color: #0284c7; margin-top: 3px;">${timeInfo.durationStr || 'પૂર્ણ'}</div>
                </div>
              </div>

            </div>

            <!-- Remarks Line -->
            <div style="background: #f1f5f9; border-left: 4px solid #0f274a; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 11.5px; color: #334155; line-height: 1.4;">
              <strong style="color: #0f172a;">મૂલ્યાંકન પરિણામ:</strong> <span style="background: #0f274a; color: white; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; margin: 0 4px;">${grade}</span> ${remarkText}
            </div>
          </div>

          <!-- Official 3-Column Footer (Seal, QR, and Sunil Signature) -->
          <div style="border-top: 1.5px solid #cbd5e1; padding-top: 12px; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              
              <!-- Left: Convener Sign -->
              <div style="text-align: center; width: 140px;">
                <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 20px; color: #0f274a; margin-bottom: 2px;">
                  કન્વીનર TET
                </div>
                <div style="border-top: 1.5px solid #0f172a; width: 120px; margin: 0 auto; padding-top: 3px;">
                  <div style="font-size: 11px; font-weight: 900; color: #0f172a;">પરીક્ષા નિયંત્રક</div>
                  <div style="font-size: 9.5px; color: #64748b;">(કસોટી વિભાગ)</div>
                </div>
              </div>

              <!-- Center: Official Stamp & QR Code -->
              <div style="text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 2px;">
                  ${getOfficialSealStampHtml(68)}
                  ${getSvgQrCode(56)}
                </div>
                <div style="font-size: 9px; color: #0284c7; font-weight: 800;">સત્તાવાર ડિજિટલ પ્રમાણીકરણ • હેલ્પલાઇન: ${helpline}</div>
              </div>

              <!-- Right: Principal / Sunil Signature -->
              <div style="text-align: center; width: 150px;">
                <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 26px; color: #0f274a; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.5px;">
                  Sunil
                </div>
                <div style="border-top: 1.5px solid #0f172a; width: 130px; margin: 0 auto; padding-top: 3px;">
                  <div style="font-size: 11.5px; font-weight: 900; color: #0f172a;">આચાર્યશ્રી / સંચાલક</div>
                  <div style="font-size: 10px; color: #0284c7; font-weight: 800;">સુનિલ (Sunil)</div>
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
      margin: 8mm 10mm;
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
      <span style="font-size: 22px;">📑</span>
      <div>
        <div style="font-weight: 900; font-size: 15px; color: #ffffff;">ટોપ ૧૦ સ્કોરકાર્ડ સંપૂર્ણ બુકલેટ (૧૧ પેજ A4 PDF)</div>
        <div style="font-size: 12px; color: #94a3b8;">${testTitle} • પેજ ૧: સમરી મેરિટ લિસ્ટ | પેજ ૨ થી ૧૧: વિદ્યાર્થી વાઇઝ સન્માન પ્રમાણપત્ર</div>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: white; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px; box-shadow: 0 2px 10px rgba(2,132,199,0.4);">
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
  <div style="padding: 22px 24px; background: #ffffff; min-height: 980px; position: relative;">
    
    <div style="border: 4px solid #0f274a; outline: 2px solid #d97706; outline-offset: -8px; border-radius: 14px; padding: 22px 24px; background: #ffffff; min-height: 950px; position: relative; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
      
      <!-- Watermark -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 58px; font-weight: 900; color: rgba(15, 39, 74, 0.035); white-space: nowrap; pointer-events: none; text-transform: uppercase; letter-spacing: 2px;">
        ${academy}
      </div>

      <!-- Top Corner Accents -->
      <div style="position: absolute; top: 12px; left: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>
      <div style="position: absolute; top: 12px; right: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>
      <div style="position: absolute; bottom: 12px; left: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>
      <div style="position: absolute; bottom: 12px; right: 14px; color: #d97706; font-size: 15px; font-weight: 900;">⚜</div>

      <!-- Top Branding -->
      <div>
        <div style="text-align: center; border-bottom: 2px solid #0f274a; padding-bottom: 12px; margin-bottom: 16px;">
          <div style="color: #d97706; font-size: 13px; font-weight: 800; letter-spacing: 3px; margin-bottom: 2px;">
            ★ ★ ★ ★ ★
          </div>
          <div style="color: #0f274a; font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
            ${academy}
          </div>
          <div style="color: #475569; font-size: 13px; font-weight: 700; margin-top: 2px;">
            ગુજરાત રાજ્ય સ્પર્ધાત્મક પરીક્ષા પરિણામ અને ગુણવત્તા બોર્ડ
          </div>
          <div style="display: inline-block; background: linear-gradient(135deg, #0f274a 0%, #1e3a8a 100%); color: #ffffff; padding: 6px 26px; border-radius: 20px; font-weight: 900; font-size: 13.5px; margin-top: 8px; border: 1.5px solid #d97706; box-shadow: 0 2px 6px rgba(15,39,74,0.25);">
            🏆 અધિકૃત ટોપ ૧૦ સ્ટેટ મેરિટ પરિણામ પુસ્તિકા (STATE MERIT BOOKLET) 🏆
          </div>
        </div>

        <!-- 4-Grid Test Metadata & Highlights -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px;">
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 14px;">
            <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">કસોટી & વિષય:</div>
            <div style="font-size: 14.5px; font-weight: 900; color: #0f172a; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              📝 ${testTitle}
            </div>
            ${testSubject ? `<div style="font-size: 11px; color: #0284c7; font-weight: 700; margin-top: 1px;">વિષય: ${testSubject}</div>` : ''}
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; text-align: center;">
            <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">કુલ ગુણ</div>
            <div style="font-size: 18px; font-weight: 900; color: #0f274a; margin-top: 2px;">${metaTotal || highestScore}</div>
          </div>
          <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 10px; padding: 10px 12px; text-align: center;">
            <div style="font-size: 10px; color: #854d0e; font-weight: 800; text-transform: uppercase;">સર્વોચ્ચ સ્કોર</div>
            <div style="font-size: 18px; font-weight: 900; color: #b45309; margin-top: 2px;">${highestScore} (${highestPct}%)</div>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; text-align: center;">
            <div style="font-size: 10px; color: #64748b; font-weight: 800; text-transform: uppercase;">જાહેરાત તારીખ</div>
            <div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 4px;">📅 ${dateStr}</div>
          </div>
        </div>

        <!-- Summary Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #0f274a, #1e3a8a); color: white;">
              <th style="padding: 9px 6px; text-align: center; font-size: 12px; font-weight: 900; border-top-left-radius: 8px; width: 65px;">ક્રમ</th>
              <th style="padding: 9px 10px; text-align: left; font-size: 12px; font-weight: 900;">વિદ્યાર્થીનું નામ</th>
              <th style="padding: 9px 10px; text-align: left; font-size: 12px; font-weight: 900; width: 110px;">રોલ / સંપર્ક</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 12px; font-weight: 900; width: 85px;">સમયગાળો</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 12px; font-weight: 900; width: 85px;">મેળવેલ ગુણ</th>
              <th style="padding: 9px 8px; text-align: center; font-size: 12px; font-weight: 900; width: 110px;">ટકાવારી દર</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 12px; font-weight: 900; border-top-right-radius: 8px; width: 75px;">શ્રેણી</th>
            </tr>
          </thead>
          <tbody>
            ${page1SummaryRows}
          </tbody>
        </table>

        <!-- Notice / Note -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 11.5px;">📌 નોંધ (Official Statement):</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 3px; line-height: 1.45;">
            આ બુકલેટમાં આગળના પેજ (પેજ ૨ થી ૧૧) પર તમામ ૧૦ ટોપર્સ વિદ્યાર્થીઓના સત્તાવાર શાળા ગુણવત્તા પ્રમાણપત્ર સામેલ છે. પરિણામ સંસ્થા દ્વારા પ્રમાણિત છે.
          </div>
        </div>
      </div>

      <!-- Official Signature Line with QR and Stamp -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1.5px solid #e2e8f0;">
        <div style="width: 140px; text-align: center;">
          ${getOfficialSealStampHtml(72)}
          <div style="font-size: 10.5px; color: #64748b; font-weight: 700;">સત્તાવાર મોહર</div>
        </div>

        <div style="text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 4px;">
            ${getSvgQrCode(58)}
          </div>
          <div style="font-size: 9.5px; color: #0284c7; font-weight: 800;">સ્કેન કરીને પરિણામ ચકાસો</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">હેલ્પલાઇન: ${helpline}</div>
        </div>

        <div style="text-align: center; width: 150px;">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 26px; color: #0f274a; font-weight: 700; margin-bottom: 2px; letter-spacing: 0.5px;">
            Sunil
          </div>
          <div style="border-top: 1.5px solid #0f172a; width: 130px; margin: 0 auto; padding-top: 3px;">
            <div style="font-size: 11.5px; font-weight: 900; color: #0f172a;">આચાર્યશ્રી / સંચાલક</div>
            <div style="font-size: 10px; color: #0284c7; font-weight: 800;">સુનિલ (Sunil)</div>
          </div>
        </div>
      </div>

    </div>

  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       PAGES 2 TO 11: INDIVIDUAL STUDENT CERTIFICATES
  ═══════════════════════════════════════════════════════════════ -->
  ${individualCardsHtml}

</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}

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

  // Helper for generating High-End Student Photo / Royal Golden Avatar (Square Portrait Studio Frame)
  const getStudentAvatar = (s, rankNum, width = 96, height = 108) => {
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

    const borderRadius = isTopper1 ? '16px' : (isTopper2 || isTopper3 ? '14px' : '10px');
    const imgRadius = isTopper1 ? '13px' : (isTopper2 || isTopper3 ? '11px' : '8px');

    if (photo && (photo.startsWith('http') || photo.startsWith('data:'))) {
      return `
        <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
          ${isTopper1 ? `
            <div style="font-size: 32px; line-height: 1; margin-bottom: 4px; filter: drop-shadow(0 3px 8px rgba(245,158,11,0.95)); z-index: 5;">
              👑
            </div>
          ` : ''}
          <div style="width: ${width}px; height: ${height}px; border-radius: ${borderRadius}; padding: ${isTopper1 ? '3.5px' : '2.5px'}; background: ${ringGradient}; box-shadow: 0 0 25px ${glow}, 0 6px 18px rgba(0,0,0,0.6); flex-shrink: 0; display: inline-block;">
            <img src="${photo}" alt="${sName}" style="width: 100%; height: 100%; border-radius: ${imgRadius}; object-fit: cover; object-position: center top; display: block; background: #0f172a; border: 2px solid #0f172a;" />
          </div>
        </div>
      `;
    }

    return `
      <div style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
        ${isTopper1 ? `
          <div style="font-size: 32px; line-height: 1; margin-bottom: 4px; filter: drop-shadow(0 3px 8px rgba(245,158,11,0.95)); z-index: 5;">
            👑
          </div>
        ` : ''}
        <div style="width: ${width}px; height: ${height}px; border-radius: ${borderRadius}; padding: ${isTopper1 ? '3.5px' : '2.5px'}; background: ${ringGradient}; box-shadow: 0 0 25px ${glow}, 0 6px 18px rgba(0,0,0,0.6); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;">
          <div style="width: 100%; height: 100%; border-radius: ${imgRadius}; background: ${bg}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: ${Math.round(width * 0.42)}px; text-transform: uppercase;">
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
  const renderPodiumCard = (s, rankNum, medal, label, color, borderGlow, avatarW = 96, avatarH = 108) => {
    if (!s) {
      return `<div style="flex: 1; min-height: 250px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 18px;"></div>`;
    }
    const sName = s.student?.name || 'વિદ્યાર્થી';
    const sMobile = s.student?.mobile ? String(s.student.mobile).slice(0, 5) + '*****' : '';
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const isFirst = rankNum === 1;
    const timeInfo = getSubmissionTimeInfo(s);

    return `
      <div style="flex: ${isFirst ? '1.25' : '1'}; background: ${isFirst ? 'radial-gradient(130% 120% at 50% 0%, rgba(245,158,11,0.25) 0%, rgba(15,23,42,0.98) 100%)' : 'radial-gradient(130% 120% at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(15,23,42,0.96) 100%)'}; border: ${isFirst ? '2.5px solid #f59e0b' : `2px solid ${color}`}; border-radius: 20px; padding: ${isFirst ? '16px 12px' : '14px 10px'}; text-align: center; box-shadow: 0 12px 36px ${borderGlow}, inset 0 0 20px rgba(0,0,0,0.5); position: relative; ${isFirst ? 'transform: translateY(-10px); z-index: 2;' : ''}">
        
        <!-- Medal Badge Pill -->
        <div style="display: inline-block; background: ${isFirst ? 'linear-gradient(135deg, #f59e0b, #d97706)' : color}; color: ${isFirst ? '#0f172a' : '#ffffff'}; padding: ${isFirst ? '4px 16px' : '3px 12px'}; border-radius: 20px; font-weight: 900; font-size: ${isFirst ? '12.5px' : '11px'}; margin-bottom: 8px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
          ${medal} ${label}
        </div>

        <!-- Student Photo (Square Portrait Frame) -->
        <div style="margin: 2px 0 8px; display: flex; justify-content: center;">
          ${getStudentAvatar(s, rankNum, avatarW, avatarH)}
        </div>

        <!-- Student Name -->
        <div style="font-weight: 900; font-size: ${isFirst ? '17.5px' : '14.5px'}; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); letter-spacing: 0.3px;">
          ${sName}
        </div>

        ${sMobile ? `<div style="font-size: 10.5px; color: #94a3b8; font-family: monospace; margin-top: 3px; display: flex; align-items: center; justify-content: center; gap: 4px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <span style="color: #94a3b8; font-weight: 700;">${sMobile}</span>
        </div>` : ''}

        <!-- ⏱️ Test Finish Time & Duration Badge -->
        ${(timeInfo.durationStr || timeInfo.finishTimeStr) ? `
          <div style="margin-top: 5px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); padding: 2px 8px; border-radius: 8px; font-size: 10.5px; color: #38bdf8; font-weight: 800;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle;">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${timeInfo.durationStr ? `સમય: ${timeInfo.durationStr}` : ''}${timeInfo.durationStr && timeInfo.finishTimeStr ? ' • ' : ''}${timeInfo.finishTimeStr ? timeInfo.finishTimeStr : ''}</span>
          </div>
        ` : ''}

        <!-- Score & Percentage Badge -->
        <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.65); padding: 4px 12px; border-radius: 12px; border: 1.5px solid ${isFirst ? 'rgba(245,158,11,0.55)' : 'rgba(255,255,255,0.15)'}; box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
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
    const timeInfo = getSubmissionTimeInfo(s);

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: rgba(255,255,255,0.035); border-radius: 10px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.08);">
        
        <div style="display: flex; align-items: center; gap: 10px;">
          <!-- Rank Pill -->
          <div style="font-weight: 900; font-size: 12px; color: #38bdf8; width: 32px; height: 32px; background: rgba(56,189,248,0.12); border: 1.5px solid rgba(56,189,248,0.35); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
            #${rankNum}
          </div>

          <!-- Student DP / Avatar (Square Portrait) -->
          ${getStudentAvatar(s, rankNum, 42, 48)}

          <!-- Name & Mobile & Time -->
          <div style="text-align: left;">
            <div style="font-weight: 800; font-size: 13.5px; color: #ffffff;">${sName}</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 1px;">
              ${sMobile ? `<span style="font-size: 9.5px; color: #94a3b8; font-family: monospace; display: flex; align-items: center; gap: 2px;">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
                ${sMobile}
              </span>` : ''}
              ${(timeInfo.durationStr || timeInfo.finishTimeStr) ? `
                <span style="font-size: 9.5px; color: #38bdf8; font-weight: 700; display: flex; align-items: center; gap: 2px;">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  ${timeInfo.durationStr || timeInfo.finishTimeStr}
                </span>
              ` : ''}
            </div>
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
      <div style="display: flex; gap: 14px; align-items: flex-end; justify-content: center; max-width: 700px; margin: 0 auto;">
        ${renderPodiumCard(top2, 2, '🥈', '૨જો રેન્ક', '#cbd5e1', 'rgba(148,163,184,0.35)', 96)}
        ${renderPodiumCard(top1, 1, '🥇', '૧મો રેન્ક (Topper)', '#f59e0b', 'rgba(245,158,11,0.55)', 114)}
        ${renderPodiumCard(top3, 3, '🥉', '૩જો રેન્ક', '#ea580c', 'rgba(234,88,12,0.35)', 96)}
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
        <div style="color: #38bdf8; font-weight: 900; font-size: 12px; display: flex; align-items: center; gap: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>હેલ્પલાઇન: ${helpline}</span>
        </div>
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

                      {/* Photo / Avatar Preview (Square Portrait Studio Frame) */}
                      <div style={{ position: 'relative', width: isRank1 ? 84 : 72, height: isRank1 ? 96 : 82, marginBottom: 10 }}>
                        {photo ? (
                          <img
                            src={photo}
                            alt={sName}
                            style={{
                              width: '100%', height: '100%', borderRadius: isRank1 ? 14 : 12,
                              objectFit: 'cover', objectPosition: 'center top', border: `3px solid ${borderColor}`,
                              boxShadow: `0 0 16px ${borderColor}88`
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%', borderRadius: isRank1 ? 14 : 12,
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
                          <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#059669', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, border: '2px solid #0f172a', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                            ✓
                          </span>
                        )}
                      </div>

                      <div style={{ color: 'white', fontWeight: 900, fontSize: '0.84rem', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sName}
                      </div>
                      <div style={{ color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800, marginBottom: 2 }}>
                        {score} ગુણ
                      </div>
                      {(() => {
                        const d = s.duration || s.timeTaken || s.timeSpentSeconds || 0;
                        const mins = Math.floor(d / 60);
                        const secs = d % 60;
                        const timeStr = d > 0 ? (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`) : '';
                        return timeStr ? (
                          <div style={{ color: '#38bdf8', fontSize: '0.68rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 3 }}>
                            ⏱️ {timeStr}
                          </div>
                        ) : <div style={{ height: 6 }} />;
                      })()}

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

                          {/* Avatar Square Portrait */}
                          <div style={{ width: 34, height: 40, position: 'relative', flexShrink: 0 }}>
                            {photo ? (
                              <img
                                src={photo}
                                alt={sName}
                                style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover', objectPosition: 'center top', border: '1.5px solid #38bdf8' }}
                              />
                            ) : (
                              <div style={{
                                width: '100%', height: '100%', borderRadius: 8,
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
                            <div style={{ color: '#94a3b8', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{score} ગુણ</span>
                              {(() => {
                                const d = s.duration || s.timeTaken || s.timeSpentSeconds || 0;
                                const mins = Math.floor(d / 60);
                                const secs = d % 60;
                                return d > 0 ? <span style={{ color: '#38bdf8' }}>• ⏱️ {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}</span> : null;
                              })()}
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

            {/* Option 1: Combined 11-Page Booklet PDF */}
            <button
              onClick={handleDownloadBooklet}
              disabled={downloading || currentTop10.length === 0}
              style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(30,58,138,0.32) 50%, rgba(15,23,42,0.96) 100%)',
                border: '1.5px solid rgba(56,189,248,0.55)',
                borderRadius: 18,
                padding: '16px 18px',
                cursor: currentTop10.length === 0 ? 'not-allowed' : 'pointer',
                opacity: currentTop10.length === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                textAlign: 'left',
                transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 6px 24px rgba(14,165,233,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                if (currentTop10.length > 0) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = '#38bdf8';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.55)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(14,165,233,0.18), inset 0 1px 0 rgba(255,255,255,0.12)';
              }}
            >
              {/* Subtle Top Accent Highlight */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                background: 'linear-gradient(90deg, transparent, #38bdf8, #818cf8, transparent)'
              }} />

              {/* 3D Stacked Booklet Graphic Icon */}
              <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
                {/* Back page */}
                <div style={{
                  position: 'absolute', width: 36, height: 42, top: 0, right: 1,
                  background: 'rgba(56,189,248,0.22)', border: '1px solid rgba(56,189,248,0.4)',
                  borderRadius: 7, transform: 'rotate(7deg)'
                }} />
                {/* Middle page */}
                <div style={{
                  position: 'absolute', width: 37, height: 42, top: 2, right: 3,
                  background: 'rgba(30,58,138,0.65)', border: '1px solid rgba(56,189,248,0.5)',
                  borderRadius: 8, transform: 'rotate(3deg)'
                }} />
                {/* Front page */}
                <div style={{
                  position: 'absolute', width: 38, height: 42, top: 4, left: 0,
                  background: 'linear-gradient(135deg, #0284c7 0%, #1e3a8a 100%)',
                  border: '1.5px solid #38bdf8', borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', boxShadow: '0 4px 14px rgba(2,132,199,0.5)'
                }}>
                  <FileText size={20} color="#ffffff" />
                </div>
              </div>

              {/* Main Text & Badges */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
                  <span style={{ color: 'white', fontWeight: 900, fontSize: '0.96rem', letterSpacing: '0.2px' }}>
                    ૧. સંપૂર્ણ મલ્ટી-પેજ A4 બુકલેટ PDF (Print / PDF)
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <span style={{
                      background: 'rgba(56,189,248,0.22)', color: '#38bdf8',
                      border: '1px solid rgba(56,189,248,0.45)',
                      fontSize: '0.64rem', padding: '2px 8px', borderRadius: 6, fontWeight: 900
                    }}>
                      📑 સત્તાવાર ૧૧ પેજ
                    </span>
                    <span style={{
                      background: 'rgba(52,211,153,0.18)', color: '#34d399',
                      border: '1px solid rgba(52,211,153,0.35)',
                      fontSize: '0.64rem', padding: '2px 7px', borderRadius: 6, fontWeight: 900
                    }}>
                      🖨️ A4 Ready
                    </span>
                  </div>
                </div>

                <p style={{ color: '#cbd5e1', fontSize: '0.75rem', margin: '4px 0 5px', lineHeight: 1.45 }}>
                  <strong style={{ color: '#38bdf8' }}>પેજ ૧:</strong> સંપૂર્ણ મેરિટ સમરી • <strong style={{ color: '#fbbf24' }}>પેજ ૨ થી ૧૧:</strong> દરેક ટોપર વિદ્યાર્થીનું વ્યક્તિગત સ્કોરકાર્ડ
                </p>

                {/* Feature Micro-Badges */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: '0.66rem', color: '#94a3b8' }}>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle size={10} color="#38bdf8" /> સત્તાવાર મોહર & સહી
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle size={10} color="#34d399" /> કસોટી સમયગાળો
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle size={10} color="#fbbf24" /> વેરિફિકેશન QR કોડ
                  </span>
                </div>
              </div>

              {/* Right CTA Button */}
              <div style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                padding: '9px 13px', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 6,
                color: '#ffffff', fontWeight: 800, fontSize: '0.78rem',
                boxShadow: '0 4px 14px rgba(2,132,199,0.4)',
                border: '1px solid rgba(56,189,248,0.5)',
                flexShrink: 0
              }}>
                <Download size={15} />
                <span>ડાઉનલોડ</span>
              </div>
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
