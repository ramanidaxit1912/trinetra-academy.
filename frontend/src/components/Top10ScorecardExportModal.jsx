import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { X, Download, Edit3, Printer, Trophy, FileText, CheckCircle, Award, Users, Smartphone, ShieldCheck, Crown, Filter, Camera, ArrowLeft, Trash2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { getLeaderboardOverrides } from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS FOR SCORECARDS & POSTERS
═══════════════════════════════════════════════════════════════ */

// Helper to ensure student names in certificates connect elegantly with cursive script font (like "Sunil Radadiya")
export const formatStudentNameForCertificate = (name) => {
  if (!name) return 'વિદ્યાર્થી';
  const str = String(name).trim();
  if (/[a-zA-Z]/.test(str)) {
    return str.replace(/\b[a-zA-Z]+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return str;
};

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
// Rosette Medal SVG Helper matching user's reference image
export const getRosetteMedalSvg = (rankNum = 1) => {
  const isFirst = rankNum === 1;
  const rankLabel = rankNum === 1 ? '1' : rankNum === 2 ? '2' : rankNum === 3 ? '3' : `${rankNum}`;
  
  return `
  <svg width="112" height="142" viewBox="0 0 120 155" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldMedalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="35%" stop-color="#f59e0b" />
        <stop offset="70%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#92400e" />
      </linearGradient>
      <linearGradient id="ribbonTailGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#b45309" />
      </linearGradient>
      <filter id="medalShadow" x="-15%" y="-15%" width="130%" height="135%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>

    <!-- Ribbon Streamers / Tails with notched ends -->
    <!-- Left Tail -->
    <path d="M44,72 L22,144 L44,132 L60,144 L50,72 Z" fill="url(#ribbonTailGrad)" stroke="#92400e" stroke-width="1.5" filter="url(#medalShadow)"/>
    <!-- Right Tail -->
    <path d="M68,72 L58,144 L74,132 L96,144 L76,72 Z" fill="url(#ribbonTailGrad)" stroke="#92400e" stroke-width="1.5" filter="url(#medalShadow)"/>

    <!-- Scalloped Rosette Outer Medallion -->
    <circle cx="59" cy="54" r="45" fill="url(#goldMedalGrad)" filter="url(#medalShadow)" stroke="#b45309" stroke-width="2"/>
    <circle cx="59" cy="54" r="40" fill="none" stroke="#fef08a" stroke-width="2" stroke-dasharray="3 3"/>

    <!-- Deep Navy Center Circle -->
    <circle cx="59" cy="54" r="33" fill="#0b1736" stroke="#f59e0b" stroke-width="2.5"/>

    <!-- Laurel Wreath (Left & Right Leaves) -->
    <!-- Left Leaves -->
    <path d="M37,54 C37,67 45,74 53,76 C47,72 42,66 42,54 C42,44 47,38 53,34 C45,37 37,43 37,54 Z" fill="#fef08a" opacity="0.9"/>
    <ellipse cx="43" cy="44" rx="3.5" ry="2" transform="rotate(-30 43 44)" fill="#fef08a"/>
    <ellipse cx="41" cy="54" rx="3.5" ry="2" fill="#fef08a"/>
    <ellipse cx="43" cy="64" rx="3.5" ry="2" transform="rotate(30 43 64)" fill="#fef08a"/>

    <!-- Right Leaves -->
    <path d="M81,54 C81,67 73,74 65,76 C71,72 76,66 76,54 C76,44 71,38 65,34 C73,37 81,43 81,54 Z" fill="#fef08a" opacity="0.9"/>
    <ellipse cx="75" cy="44" rx="3.5" ry="2" transform="rotate(30 75 44)" fill="#fef08a"/>
    <ellipse cx="77" cy="54" rx="3.5" ry="2" fill="#fef08a"/>
    <ellipse cx="75" cy="64" rx="3.5" ry="2" transform="rotate(-30 75 64)" fill="#fef08a"/>

    <!-- Big Center Number -->
    <text x="59" y="65" font-family="'Times New Roman', serif, Georgia" font-size="${rankLabel.length > 1 ? '28' : '36'}" font-weight="900" fill="#fef08a" text-anchor="middle" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.6))">
      ${rankLabel}
    </text>
  </svg>
  `;
};

// Best Award Laurel Wreath Badge (as shown in reference image bottom)
export const APPROVED_STAMP_BASE64 = "data:image/png;base64,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";

export const getBestAwardBadgeSvg = (year = '2026') => `
<svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldAwardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="50%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
  </defs>
  <!-- Laurel Left Branch -->
  <path d="M25,50 C25,68 36,80 50,86 C40,81 33,70 33,50 C33,35 40,24 50,19 C36,25 25,37 25,50 Z" fill="url(#goldAwardGrad)"/>
  <ellipse cx="32" cy="34" rx="4" ry="2" transform="rotate(-35 32 34)" fill="url(#goldAwardGrad)"/>
  <ellipse cx="28" cy="50" rx="4" ry="2" fill="url(#goldAwardGrad)"/>
  <ellipse cx="32" cy="66" rx="4" ry="2" transform="rotate(35 32 66)" fill="url(#goldAwardGrad)"/>
  <!-- Laurel Right Branch -->
  <path d="M75,50 C75,68 64,80 50,86 C60,81 67,70 67,50 C67,35 60,24 50,19 C64,25 75,37 75,50 Z" fill="url(#goldAwardGrad)"/>
  <ellipse cx="68" cy="34" rx="4" ry="2" transform="rotate(35 68 34)" fill="url(#goldAwardGrad)"/>
  <ellipse cx="72" cy="50" rx="4" ry="2" fill="url(#goldAwardGrad)"/>
  <ellipse cx="68" cy="66" rx="4" ry="2" transform="rotate(-35 68 66)" fill="url(#goldAwardGrad)"/>
  <!-- Center Star & Text -->
  <text x="50" y="38" font-size="12" fill="#d97706" text-anchor="middle">★</text>
  <text x="50" y="52" font-family="'Times New Roman', Georgia, serif" font-size="10" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">BEST</text>
  <text x="50" y="63" font-family="'Times New Roman', Georgia, serif" font-size="9" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">AWARD</text>
  <text x="50" y="74" font-family="monospace" font-size="8" font-weight="900" fill="#d97706" text-anchor="middle">${year}</text>
</svg>
`;

export function exportTop10BookletPDF(topList = [], teacherProfile = {}, testMeta = {}, customSettings = {}) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('PDF પ્રિન્ટ કરવા માટે પોપ-અપ વિન્ડો (Popups) ચાલુ કરો.');
    return;
  }

  const origin = window.location.origin;
  const logoUrl = origin + '/trinetra-logo.png';
  const approvedStampUrl = origin + '/approved-stamp.png';
  const academy = customSettings.academy || teacherProfile.academy || teacherProfile.academyName || 'ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)';
  const convenerName = customSettings.convenerName || 'Dixit Ramani';
  const principalName = customSettings.principalName || 'Sunil Sir';
  const helpline = teacherProfile.phone || '8200405300';
  const dateStr = new Date().toLocaleDateString('gu-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const testTitle = testMeta.testName || 'કસોટી પરિણામ';
  const testSubject = testMeta.subject || '';
  const metaTotal = Number(testMeta.totalMarks || 0);

  const top1 = topList[0];
  const highestScore = top1 ? Number(top1.mcqScore ?? top1.score ?? top1.marks ?? 0) : 0;
  const highestTotal = metaTotal > 0 ? metaTotal : (top1 ? Number(top1.totalMarks || top1.totalMCQ || (top1.test?.questionsCount ? Number(top1.test.questionsCount) : 0)) : 0);
  const highestPct = highestTotal > 0 ? Math.round((highestScore / highestTotal) * 100) : (highestScore > 0 ? 100 : 0);

  // Generate HTML for Page 1: Merit Summary Table Rows (A4 Landscape Layout)
  const page1SummaryRows = topList.slice(0, 10).map((s, idx) => {
    const rawName = s.student?.name || 'વિદ્યાર્થી';
    const sName = formatStudentNameForCertificate(rawName);
    const sRoll = s.student?.mobile || s.student?.rollNo || `TR-${1000 + idx + 1}`;
    const sPhoto = s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
    const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);
    const total = metaTotal > 0 ? metaTotal : Number(s.totalMarks || s.totalMCQ || (s.test?.questionsCount ? Number(s.test.questionsCount) : 0));
    const pct = total > 0 ? Math.round((score / total) * 100) : (score > 0 ? 100 : 0);
    const rankNum = s.assignedRank || (idx + 1);
    const timeInfo = getSubmissionTimeInfo(s);

    const medalPill = rankNum === 1 
      ? '<span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 12px; border: 1.5px solid #f59e0b; font-weight: 900; font-size: 12.5px;">👑 ૧</span>'
      : rankNum === 2 
        ? '<span style="background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 12px; border: 1.5px solid #94a3b8; font-weight: 900; font-size: 12.5px;">🥈 ૨</span>'
        : rankNum === 3 
          ? '<span style="background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 12px; border: 1.5px solid #ea580c; font-weight: 900; font-size: 12.5px;">🥉 ૩</span>'
          : `<span style="background: #eff6ff; color: #1e3a8a; padding: 2px 8px; border-radius: 12px; border: 1.5px solid #bfdbfe; font-weight: 800; font-size: 11.5px;">#${rankNum}</span>`;

    const grade = pct >= 80 ? 'A+ (ઉત્કૃષ્ટ)' : pct >= 60 ? 'A (પ્રથમ)' : pct >= 40 ? 'B (સફળ)' : 'પ્રયાસ';
    const initial = (sName.trim()[0] || 'V').toUpperCase();

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 6px; text-align: center;">
          ${medalPill}
        </td>
        <td style="padding: 6px 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 32px; border-radius: 5px; border: 1.5px solid ${rankNum === 1 ? '#d97706' : '#cbd5e1'}; overflow: hidden; flex-shrink: 0; background: #0f172a; display: flex; align-items: center; justify-content: center;">
              ${sPhoto ? `<img src="${sPhoto}" alt="${sName}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="color: #38bdf8; font-size: 12px; font-weight: 900;">${initial}</span>`}
            </div>
            <div>
              <div style="font-weight: 800; color: #0f172a; font-size: 13px; line-height: 1.2;">${sName}</div>
              <div style="font-size: 10px; color: #64748b;">મેરિટ ટોપર #${rankNum}</div>
            </div>
          </div>
        </td>
        <td style="padding: 6px 10px; color: #475569; font-size: 11.5px; font-family: monospace; font-weight: 700;">
          ${sRoll}
        </td>
        <td style="padding: 6px; text-align: center;">
          <div style="font-size: 11px; font-weight: 800; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 2px 6px; border-radius: 6px; display: inline-block;">
            ⏱️ ${timeInfo.durationStr || '-'}
          </div>
        </td>
        <td style="padding: 6px; text-align: center;">
          <div style="font-weight: 900; color: #0f274a; font-size: 13px;">${score}</div>
          ${total > 0 ? `<div style="font-size: 9.5px; color: #64748b;">કુલ: ${total}</div>` : ''}
        </td>
        <td style="padding: 6px 10px; text-align: center;">
          <div style="font-weight: 900; color: #059669; font-size: 12.5px;">${pct}%</div>
          <div style="background: #e2e8f0; height: 3px; border-radius: 2px; overflow: hidden; margin-top: 2px; width: 60px; margin-left: auto; margin-right: auto;">
            <div style="background: ${pct >= 70 ? '#059669' : '#0284c7'}; width: ${pct}%; height: 100%;"></div>
          </div>
        </td>
        <td style="padding: 6px; text-align: center;">
          <span style="font-weight: 800; color: #1e40af; font-size: 11px; background: #eff6ff; padding: 2px 7px; border-radius: 6px; border: 1px solid #dbeafe;">
            ${grade.split(' ')[0]}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Generate Individual School Award Certificates (Pages 2 to 11)
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
    const rankTitle = isRank1 
      ? '૧ લો ક્રમ (1st State Topper - Gold Medalist)' 
      : rankNum === 2 
        ? '૨ જો ક્રમ (2nd State Rank - Silver Medalist)' 
        : rankNum === 3 
          ? '૩ જો ક્રમ (3rd State Rank - Bronze Medalist)' 
          : `મેરિટ ટોપર ક્રમ #${rankNum}`;

    const grade = pct >= 80 ? 'A+ (ઉત્કૃષ્ટ - Outstanding)' : pct >= 60 ? 'A (પ્રથમ વર્ગ - Excellent)' : pct >= 40 ? 'B (સફળ - Qualified)' : 'પ્રયાસ - Participated';
    const initial = (sName.trim()[0] || 'V').toUpperCase();

    return `
      <div class="page-break" style="padding: 8px;">
        <!-- Luxury Award Certificate Container (Landscape A4: 100% × 650px) -->
        <div style="width: 100%; height: 650px; border-radius: 16px; position: relative; background: radial-gradient(circle at 75% 25%, rgba(245,158,11,0.03) 0%, transparent 60%), #ffffff; box-shadow: 0 4px 25px rgba(0,0,0,0.08); overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid #e2e8f0;">
          
          <!-- TOP ELEGANT CURVED WAVES (Flatter curve ensuring CERTIFICATE starts cleanly below yellow border) -->
          <div style="position: absolute; top: 0; left: 0; right: 0; height: 60px; pointer-events: none; z-index: 1;">
            <svg viewBox="0 0 1000 60" style="width: 100%; height: 100%; display: block;" preserveAspectRatio="none">
              <defs>
                <linearGradient id="topGoldWave${idx}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#b45309" />
                  <stop offset="25%" stop-color="#f59e0b" />
                  <stop offset="50%" stop-color="#fef08a" />
                  <stop offset="75%" stop-color="#f59e0b" />
                  <stop offset="100%" stop-color="#b45309" />
                </linearGradient>
              </defs>
              <!-- Deep Navy Wave (Stays well above CERTIFICATE) -->
              <path d="M0,0 L1000,0 L1000,28 C820,38 600,14 350,30 C210,40 100,50 0,42 Z" fill="#0b1736" />
              <!-- Rich Gold Wave Underneath (Ends cleanly at Y ~ 42px) -->
              <path d="M0,42 C100,50 210,40 350,30 C600,14 820,38 1000,28 L1000,38 C820,48 600,24 350,40 C210,50 100,60 0,52 Z" fill="url(#topGoldWave${idx})" />
            </svg>
          </div>

          <!-- Top-Left Official Trinetra Logo & TET/TAT Tagline (Enlarged as requested) -->
          <div style="position: absolute; top: 8px; left: 24px; display: flex; align-items: center; gap: 14px; z-index: 5;">
            <!-- Real Trinetra Logo Image (Enlarged to 60px) -->
            <div style="width: 60px; height: 60px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4); border: 2.5px solid #f59e0b; overflow: hidden; flex-shrink: 0; padding: 3px;">
              <img src="${logoUrl}" alt="Trinetra Logo" onerror="this.onerror=null; this.src='/trinetra-logo.png';" style="width: 100%; height: 100%; object-fit: contain;" />
            </div>
            <div>
              <div style="color: #ffffff; font-weight: 900; font-size: 20px; text-transform: uppercase; letter-spacing: 0.8px; text-shadow: 0 2px 4px rgba(0,0,0,0.6); line-height: 1.2;">
                ${academy}
              </div>
              <!-- Line requested by user: TET / TAT PARIKSHA NI TAYARI KARVATI VISHWASU SANSTHA (Enlarged to 13px) -->
              <div style="color: #fde047; font-size: 13px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase; text-shadow: 0 1px 3px rgba(0,0,0,0.6); margin-top: 2px;">
                TET / TAT પરીક્ષાની તૈયારી કરાવતી વિશ્વાસુ સંસ્થા
              </div>
            </div>
          </div>

          <!-- MAIN BODY: Left Sash with Large Student Photo & Rosette Medal -->
          <div style="display: flex; height: 100%; position: relative; z-index: 2;">
            
            <!-- LEFT VERTICAL SASH WITH LARGE STUDIO PHOTO & MEDAL (Positioned precisely in the user's blue box with rank below) -->
            <div style="width: 200px; margin-left: 20px; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 135px;">
              
              <!-- Navy Ribbon Sash Running Top-to-Bottom -->
              <div style="position: absolute; top: -10px; bottom: 0; width: 146px; background: linear-gradient(180deg, #0b1736 0%, #0f274a 100%); border-left: 3.5px solid #f59e0b; border-right: 3.5px solid #f59e0b; box-shadow: 2px 8px 24px rgba(0,0,0,0.25); z-index: 1;">
                <!-- Inner Gold Pinstripes -->
                <div style="position: absolute; inset: 0; border-left: 1px solid rgba(254,240,138,0.7); border-right: 1px solid rgba(254,240,138,0.7); margin: 0 3px;"></div>
              </div>

              <!-- Student Studio Passport Photo (Fitted precisely inside user-drawn blue box) -->
              <div style="position: relative; z-index: 3; margin-bottom: 8px;">
                <div style="width: 132px; height: 156px; border-radius: 14px; border: 3px solid #f59e0b; overflow: hidden; background: #0b1736; box-shadow: 0 8px 24px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; position: relative;">
                  ${sPhoto ? `
                    <img src="${sPhoto}" alt="${sName}" style="width: 100%; height: 100%; object-fit: cover; object-position: center top;" />
                  ` : `
                    <div style="text-align: center; color: white;">
                      <div style="font-size: 46px; font-weight: 900; color: #38bdf8;">${initial}</div>
                      <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #94a3b8;">TOPPER</div>
                    </div>
                  `}
                  <!-- Floating Rank Pill on Photo -->
                  <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(11,23,54,0.95); color: ${isRank1 ? '#fbbf24' : '#38bdf8'}; font-size: 10.5px; font-weight: 900; text-align: center; padding: 4px 0; letter-spacing: 0.5px; border-top: 1px solid rgba(245,158,11,0.5);">
                    ${isRank1 ? '👑 RANK 1' : `TOP #${rankNum}`}
                  </div>
                </div>
              </div>

              <!-- Grand 3D Gold Rosette Medal (Sitting right BELOW the photo as requested: "rank teni nice") -->
              <div style="position: relative; z-index: 4; margin-top: 2px;">
                ${getRosetteMedalSvg(rankNum)}
              </div>
            </div>

            <!-- RIGHT CONTENT AREA: Centered and balanced to eliminate empty white space -->
            <div style="flex: 1; padding: 20px 36px 14px 22px; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
              
              <!-- Certificate Title Block (Starts cleanly BELOW the yellow wave border) -->
              <div style="margin-top: 50px;">
                <div style="font-family: 'Times New Roman', Georgia, serif; font-size: 38px; font-weight: 900; color: #0b1736; letter-spacing: 4px; text-transform: uppercase; line-height: 1;">
                  CERTIFICATE
                </div>
                <div style="font-family: 'Times New Roman', Georgia, serif; font-size: 13px; font-weight: 800; color: #d97706; letter-spacing: 4px; text-transform: uppercase; margin-top: 3px;">
                  OF APPRECIATION & EXCELLENCE
                </div>
              </div>

              <!-- CENTER/MIDDLE SECTION: Recipient Name & Large Citation Paragraph (Centered to eliminate white space!) -->
              <div style="margin: auto 0; padding: 8px 0;">
                <!-- Subtitle Line -->
                <div style="font-size: 13.5px; color: #475569; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                  આ સન્માન પ્રમાણપત્ર ગૌરવપૂર્વક એનાયત કરવામાં આવે છે
                </div>

                <!-- Big Student Recipient Name (Consistent Script Font Across All Certificates!) -->
                <div style="margin: 6px 0 8px;">
                  <span class="certificate-student-name" style="font-family: 'Brush Script MT', 'Dancing Script', 'Playfair Display', cursive, serif; font-size: 54px; font-weight: 800; color: #0b1736; letter-spacing: 0.5px; line-height: 1.1; text-shadow: 0 1px 2px rgba(0,0,0,0.12); display: inline-block;">
                    ${sName}
                  </span>
                </div>

                <!-- Elegant Center Accent Divider -->
                <div style="width: 72%; height: 2px; background: linear-gradient(90deg, transparent, #0b1736 15%, #d97706 50%, #0b1736 85%, transparent); margin: 0 auto 16px;"></div>

                <!-- Dignified Citation Paragraph (Enlarged font 16.5px with 1.85 line height to beautifully fill the middle space!) -->
                <div style="max-width: 720px; margin: 0 auto; font-size: 16.5px; color: #1e293b; line-height: 1.85; font-weight: 500;">
                  જેમણે <strong>${academy}</strong> દ્વારા આયોજિત <strong>"${cardTestTitle}"</strong> ${testSubject ? `(વિષય: <strong>${testSubject}</strong>)` : ''} કસોટીમાં અસાધારણ શૈક્ષણિક ગુણવત્તા અને ઉત્કૃષ્ટ પરિણામ દર્શાવી સમગ્ર કક્ષામાં 
                  <strong style="color: #92400e; font-weight: 900; background: #fef3c7; padding: 4px 12px; border-radius: 6px; border: 1.5px solid #f59e0b; font-size: 16.5px; display: inline-block; margin: 2px 0;">${rankTitle}</strong> 
                  પ્રાપ્ત કરેલ છે. તેમના આ તેજસ્વી પ્રદર્શન અને સતત પ્રગતિ માટે સંસ્થા ગૌરવપૂર્વક આ પ્રમાણપત્ર અર્પણ કરે છે.
                </div>

                <!-- 4 Performance Metric Badges (Enlarged and positioned nicely below citation) -->
                <div style="display: flex; justify-content: center; gap: 12px; margin-top: 18px;">
                  <span style="background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 7px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 800; color: #0f172a; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    🎯 મેળવેલ ગુણ: <strong style="color: #0284c7; font-size: 15px;">${score}</strong> ${total > 0 ? `/ ${total}` : ''}
                  </span>
                  <span style="background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 7px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 800; color: #0f172a; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    📊 ચોકસાઈ દર: <strong style="color: #059669; font-size: 15px;">${pct}%</strong>
                  </span>
                  <span style="background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 7px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 800; color: #0f172a; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    ⏱️ સમયગાળો: <strong style="color: #0284c7; font-size: 15px;">${timeInfo.durationStr || 'પૂર્ણ'}</strong>
                  </span>
                  <span style="background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 7px 16px; border-radius: 10px; font-size: 13.5px; font-weight: 800; color: #0f172a; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    🏅 શ્રેણી: <strong style="color: #d97706; font-size: 15px;">${grade.split(' ')[0]}</strong>
                  </span>
                </div>
              </div>

              <!-- BOTTOM ROW: Left (Dixit Ramani), Official APPROVED Stamp, Center (Best Award + QR), Right (Sunil Sir) -->
              <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6px; border-top: 1.5px solid #cbd5e1; margin-top: auto;">
                
                <!-- Left Signature: Convener Dixit Ramani -->
                <div style="text-align: center; width: 155px;">
                  <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 26px; color: #0b1736; font-weight: 700; margin-bottom: 2px;">
                    ${convenerName}
                  </div>
                  <div style="border-top: 1.5px solid #0f172a; width: 145px; margin: 0 auto; padding-top: 3px;">
                    <div style="font-size: 11.5px; font-weight: 900; color: #0f172a;">પરીક્ષા કન્વીનર</div>
                    <div style="font-size: 9.5px; color: #0284c7; font-weight: 800;">દિક્ષિત રામાણી (${convenerName})</div>
                  </div>
                </div>

                <!-- Official Red Circular APPROVED Rubber Stamp (Requested from user reference image) -->
                <div style="display: flex; align-items: center; justify-content: center; margin: 0 4px;">
                  <img 
                    src="${approvedStampUrl}" 
                    alt="Official Approved Stamp" 
                    onerror="this.onerror=null; this.src=APPROVED_STAMP_BASE64;" 
                    style="width: 74px; height: 74px; object-fit: contain; transform: rotate(-12deg); filter: drop-shadow(0 2px 5px rgba(220,38,38,0.3));" 
                  />
                </div>

                <!-- Center: Enhanced Attractive BEST AWARD 2026 Medallion + QR Code -->
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                  ${getBestAwardBadgeSvg('2026')}
                  <div style="display: flex; flex-direction: column; align-items: center;">
                    ${getSvgQrCode(44)}
                    <div style="font-size: 8px; color: #0284c7; font-weight: 900; margin-top: 2px;">VERIFIED</div>
                  </div>
                </div>

                <!-- Right Signature: Principal Sunil Sir -->
                <div style="text-align: center; width: 165px;">
                  <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 28px; color: #0b1736; font-weight: 700; margin-bottom: 2px;">
                    ${principalName}
                  </div>
                  <div style="border-top: 1.5px solid #0f172a; width: 150px; margin: 0 auto; padding-top: 3px;">
                    <div style="font-size: 12px; font-weight: 900; color: #0f172a;">આચાર્યશ્રી / સંચાલક</div>
                    <div style="font-size: 10px; color: #0284c7; font-weight: 800;">સુનિલ સર (${principalName})</div>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      </div>
    `;
  }).join('');

  // Complete HTML document with Print stylesheet (A4 Landscape)
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Top 10 Scorecard Booklet - ${testTitle} - ${academy}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Hind+Vadodara:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@1,700;1,900&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Hind+Vadodara:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@1,700;1,900&display=swap');
    
    .certificate-student-name {
      font-family: 'Brush Script MT', 'Dancing Script', 'Playfair Display', cursive, serif !important;
      font-size: 54px !important;
      font-weight: 800 !important;
      color: #0b1736 !important;
      letter-spacing: 0.5px !important;
      line-height: 1.1 !important;
      text-shadow: 0 1px 2px rgba(0,0,0,0.12) !important;
      text-transform: capitalize !important;
    }
    
    @page {
      size: A4 landscape;
      margin: 6mm 8mm;
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
      background: #f1f5f9;
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
  <div class="no-print" style="position: sticky; top: 0; z-index: 9999; background: #0b1736; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-bottom: 2px solid #f59e0b;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 22px;">🏆</span>
      <div>
        <div style="font-weight: 900; font-size: 15px; color: #ffffff;">ટોપ ૧૦ સંપૂર્ણ સન્માન પ્રમાણપત્ર બુકલેટ (A4 Landscape PDF)</div>
        <div style="font-size: 12px; color: #94a3b8;">${testTitle} • પેજ ૧: સંપૂર્ણ મેરિટ સમરી | પેજ ૨ થી ૧૧: દરેક ટોપરનું રોયલ એવોર્ડ સર્ટિફિકેટ</div>
      </div>
    </div>

    <div style="display: flex; gap: 10px;">
      <button onclick="window.print()" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0b1736; border: none; padding: 10px 22px; border-radius: 8px; font-weight: 900; cursor: pointer; font-size: 14px; box-shadow: 0 2px 10px rgba(245,158,11,0.4);">
        🖨️ પ્રમાણપત્ર બુકલેટ પ્રિન્ટ કરો / Save as PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px;">
        ✕ બંધ કરો
      </button>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════
       PAGE 1: OFFICIAL TOP 10 MERIT SUMMARY TABLE (LANDSCAPE A4)
  ═══════════════════════════════════════════════════════════════ -->
  <div style="padding: 8px;">
    
    <div style="width: 100%; height: 650px; border-radius: 16px; border: 3px solid #0b1736; outline: 1.5px solid #d97706; outline-offset: -7px; background: #ffffff; padding: 14px 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
      
      <!-- Top Branding with Logo (Enlarged as requested) -->
      <div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 16px; border-bottom: 2px solid #0b1736; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="width: 58px; height: 58px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 2.5px solid #f59e0b; overflow: hidden; padding: 3px; flex-shrink: 0;">
            <img src="${logoUrl}" alt="Trinetra Logo" onerror="this.onerror=null; this.src='/trinetra-logo.png';" style="width: 100%; height: 100%; object-fit: contain;" />
          </div>
          <div style="text-align: left;">
            <div style="color: #0b1736; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.6px; line-height: 1.2;">
              ${academy}
            </div>
            <div style="color: #1e3a8a; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
              TET / TAT પરીક્ષાની તૈયારી કરાવતી વિશ્વાસુ સંસ્થા
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 8px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #0b1736 0%, #1e3a8a 100%); color: #ffffff; padding: 4px 22px; border-radius: 20px; font-weight: 900; font-size: 12.5px; border: 1.5px solid #d97706; box-shadow: 0 2px 6px rgba(11,23,54,0.25);">
            🏆 અધિકૃત ટોપ ૧૦ સ્ટેટ મેરિટ પરિણામ પુસ્તિકા (STATE MERIT BOOKLET) 🏆
          </div>
        </div>

        <!-- 4-Grid Test Metadata & Highlights -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 6px 12px;">
            <div style="font-size: 9px; color: #64748b; font-weight: 800; text-transform: uppercase;">કસોટી & વિષય:</div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              📝 ${testTitle}
            </div>
            ${testSubject ? `<div style="font-size: 10px; color: #0284c7; font-weight: 700;">વિષય: ${testSubject}</div>` : ''}
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; font-weight: 800; text-transform: uppercase;">કુલ ગુણ</div>
            <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 1px;">${metaTotal || highestScore}</div>
          </div>
          <div style="background: #fefce8; border: 1.5px solid #fde047; border-radius: 8px; padding: 6px 10px; text-align: center;">
            <div style="font-size: 9px; color: #854d0e; font-weight: 800; text-transform: uppercase;">સર્વોચ્ચ સ્કોર</div>
            <div style="font-size: 15px; font-weight: 900; color: #b45309; margin-top: 1px;">${highestScore} (${highestPct}%)</div>
          </div>
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; text-align: center;">
            <div style="font-size: 9px; color: #64748b; font-weight: 800; text-transform: uppercase;">જાહેરાત તારીખ</div>
            <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 2px;">📅 ${dateStr}</div>
          </div>
        </div>

        <!-- Summary Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #0b1736, #1e3a8a); color: white;">
              <th style="padding: 6px 5px; text-align: center; font-size: 11px; font-weight: 900; border-top-left-radius: 6px; width: 55px;">ક્રમ</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; font-weight: 900;">વિદ્યાર્થીનું નામ</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 11px; font-weight: 900; width: 110px;">રોલ / સંપર્ક</th>
              <th style="padding: 6px 5px; text-align: center; font-size: 11px; font-weight: 900; width: 85px;">સમયગાળો</th>
              <th style="padding: 6px 5px; text-align: center; font-size: 11px; font-weight: 900; width: 85px;">મેળવેલ ગુણ</th>
              <th style="padding: 6px 6px; text-align: center; font-size: 11px; font-weight: 900; width: 100px;">ટકાવારી દર</th>
              <th style="padding: 6px 5px; text-align: center; font-size: 11px; font-weight: 900; border-top-right-radius: 6px; width: 75px;">શ્રેણી</th>
            </tr>
          </thead>
          <tbody>
            ${page1SummaryRows}
          </tbody>
        </table>
      </div>

      <!-- Official Signature Line with Stamp and QR (All in ONE single flex line!) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6px; border-top: 1.5px solid #e2e8f0; width: 100%;">
        
        <!-- Left: Exam Convener Dixit Ramani -->
        <div style="text-align: center; width: 165px;">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 24px; color: #0b1736; font-weight: 700; margin-bottom: 2px;">
            ${convenerName}
          </div>
          <div style="border-top: 1.5px solid #0f172a; width: 150px; margin: 0 auto; padding-top: 2px;">
            <div style="font-size: 11.5px; font-weight: 900; color: #0f172a;">પરીક્ષા કન્વીનર</div>
            <div style="font-size: 9.5px; color: #0284c7; font-weight: 800;">દિક્ષિત રામાણી (${convenerName})</div>
          </div>
        </div>

        <!-- Center: Official Red APPROVED Rubber Stamp & QR Verification -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 14px;">
          <img 
            src="${approvedStampUrl}" 
            alt="Official Approved Stamp" 
            onerror="this.onerror=null; this.src=APPROVED_STAMP_BASE64;" 
            style="width: 58px; height: 58px; object-fit: contain; transform: rotate(-10deg); filter: drop-shadow(0 2px 4px rgba(220,38,38,0.3));" 
          />
          <div style="text-align: center;">
            ${getSvgQrCode(46)}
            <div style="font-size: 8.5px; color: #0284c7; font-weight: 800; margin-top: 2px;">સ્કેન કરીને પરિણામ ચકાસો</div>
          </div>
        </div>

        <!-- Right: Principal Sunil Sir -->
        <div style="text-align: center; width: 165px;">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 26px; color: #0b1736; font-weight: 700; margin-bottom: 2px;">
            ${principalName}
          </div>
          <div style="border-top: 1.5px solid #0f172a; width: 150px; margin: 0 auto; padding-top: 2px;">
            <div style="font-size: 11.5px; font-weight: 900; color: #0f172a;">આચાર્યશ્રી / સંચાલક</div>
            <div style="font-size: 9.5px; color: #0284c7; font-weight: 800;">સુનિલ સર (${principalName})</div>
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

  // Teacher custom student names & signature state
  const [customStudentNames, setCustomStudentNames] = useState(() => {
    try {
      const saved = localStorage.getItem('trinetra_poster_student_names');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [customConvenerName, setCustomConvenerName] = useState(() => {
    return localStorage.getItem('trinetra_custom_convener_name') || 'Dixit Ramani';
  });

  const [customPrincipalName, setCustomPrincipalName] = useState(() => {
    return localStorage.getItem('trinetra_custom_principal_name') || 'Sunil Sir';
  });

  const [showEditNamesPanel, setShowEditNamesPanel] = useState(false);

  const handleStudentNameChange = (studentKey, newName) => {
    setCustomStudentNames(prev => {
      const next = { ...prev, [studentKey]: newName };
      try {
        localStorage.setItem('trinetra_poster_student_names', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

  const handleConvenerNameChange = (name) => {
    setCustomConvenerName(name);
    try {
      localStorage.setItem('trinetra_custom_convener_name', name);
    } catch (err) {}
  };

  const handlePrincipalNameChange = (name) => {
    setCustomPrincipalName(name);
    try {
      localStorage.setItem('trinetra_custom_principal_name', name);
    } catch (err) {}
  };

  const handleResetAllStudentNames = () => {
    if (window.confirm('શું તમે બધા વિદ્યાર્થીઓના નામ મૂળ સબમિશન મુજબ રીસેટ કરવા માંગો છો?')) {
      setCustomStudentNames({});
      try {
        localStorage.removeItem('trinetra_poster_student_names');
      } catch (err) {}
    }
  };

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
        const customName = customStudentNames[key];
        const finalName = (customName && customName.trim()) ? customName.trim() : (s.student?.name || 'વિદ્યાર્થી');
        return {
          ...s,
          student: {
            ...s.student,
            name: finalName
          },
          photoUrl: studentPhotos[key] || s.photoUrl || s.student?.photoUrl || s.student?.photo || null
        };
      });
      exportTop10BookletPDF(enriched, teacherProfile, currentTestMeta, {
        convenerName: customConvenerName,
        principalName: customPrincipalName
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPoster = (includeCustomPhotos = true) => {
    setDownloading(true);
    try {
      const enriched = currentTop10.map(s => {
        const key = getStudentKey(s);
        const customName = customStudentNames[key];
        const finalName = (customName && customName.trim()) ? customName.trim() : (s.student?.name || 'વિદ્યાર્થી');
        return {
          ...s,
          student: {
            ...s.student,
            name: finalName
          },
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
    const enriched = currentTop10.map(s => {
      const key = getStudentKey(s);
      const customName = customStudentNames[key];
      const finalName = (customName && customName.trim()) ? customName.trim() : (s.student?.name || 'વિદ્યાર્થી');
      return {
        ...s,
        student: {
          ...s.student,
          name: finalName
        }
      };
    });
    exportTop10Excel(enriched, teacherProfile, currentTestMeta);
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

          {/* ── TEACHER NAME & SIGNATURE EDITING FEATURE ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1.5px solid rgba(245, 158, 11, 0.45)',
            borderRadius: 16,
            padding: '12px 16px',
            marginBottom: 16,
            boxShadow: '0 4px 18px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={18} color="#fbbf24" />
                </div>
                <div>
                  <div style={{ color: '#fef3c7', fontWeight: 900, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>શિક્ષક સ્પેશિયલ: નામ & સહીઓ એડિટ કરો</span>
                    <span style={{ background: '#059669', color: '#ffffff', fontSize: '0.62rem', padding: '1px 6px', borderRadius: 4, fontWeight: 900 }}>નવું</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.71rem' }}>
                    વિદ્યાર્થીઓના નામ સુધારો, ફોટો અપલોડ કરો અથવા કન્વીનર/આચાર્યનું નામ બદલો
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditNamesPanel(!showEditNamesPanel)}
                style={{
                  background: showEditNamesPanel ? 'rgba(239, 68, 68, 0.25)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: showEditNamesPanel ? '1px solid #f87171' : 'none',
                  color: showEditNamesPanel ? '#f87171' : '#0f172a',
                  padding: '7px 14px',
                  borderRadius: 9,
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: showEditNamesPanel ? 'none' : '0 2px 10px rgba(245, 158, 11, 0.35)'
                }}
              >
                <Edit3 size={14} />
                {showEditNamesPanel ? '✕ એડિટર બંધ કરો' : '✏️ નામ & સહી એડિટ કરો'}
              </button>
            </div>

            {showEditNamesPanel && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Signatures Edit Row */}
                <div style={{ marginBottom: 14, background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 900, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                    🖋️ પ્રમાણપત્ર પર સત્તાવાર સહીઓ (Authority Signatures):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, marginBottom: 3 }}>
                        પરીક્ષા કન્વીનર નામ:
                      </label>
                      <input
                        type="text"
                        value={customConvenerName}
                        onChange={e => handleConvenerNameChange(e.target.value)}
                        placeholder="Dixit Ramani"
                        style={{
                          width: '100%',
                          background: '#090e1a',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, marginBottom: 3 }}>
                        આચાર્યશ્રી / સંચાલક નામ:
                      </label>
                      <input
                        type="text"
                        value={customPrincipalName}
                        onChange={e => handlePrincipalNameChange(e.target.value)}
                        placeholder="Sunil Sir"
                        style={{
                          width: '100%',
                          background: '#090e1a',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          color: '#ffffff',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Top 10 Student Names Editor List */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🎓 ટોપ ૧૦ વિદ્યાર્થીઓના નામ સુધારો (સર્ટિફિકેટ & લિસ્ટ માટે):
                    </div>
                    {Object.keys(customStudentNames).length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAllStudentNames}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        રીસેટ (મૂળ નામ)
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
                    {currentTop10.map((s, idx) => {
                      const key = getStudentKey(s);
                      const currentName = customStudentNames[key] !== undefined ? customStudentNames[key] : (s.student?.name || '');
                      const photo = studentPhotos[key] || s.photoUrl || s.student?.photoUrl || s.student?.photo || null;
                      const rankNum = idx + 1;
                      const score = Number(s.mcqScore ?? s.score ?? s.marks ?? 0);

                      return (
                        <div key={key} style={{
                          background: 'rgba(15, 23, 42, 0.75)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10,
                          padding: '7px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <span style={{
                            background: rankNum === 1 ? '#f59e0b' : rankNum === 2 ? '#94a3b8' : rankNum === 3 ? '#ea580c' : '#1e3a8a',
                            color: rankNum <= 3 ? '#0f172a' : '#ffffff',
                            fontSize: '0.68rem',
                            fontWeight: 900,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {rankNum}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input
                              type="text"
                              value={currentName}
                              onChange={e => handleStudentNameChange(key, e.target.value)}
                              placeholder="વિદ્યાર્થીનું નામ દાખલ કરો"
                              style={{
                                width: '100%',
                                background: '#090e1a',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 6,
                                padding: '5px 8px',
                                color: '#ffffff',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                outline: 'none'
                              }}
                            />
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
                              {score} ગુણ {customStudentNames[key] && <span style={{ color: '#34d399' }}>• એડિટ થયેલ</span>}
                            </div>
                          </div>

                          {/* Quick Photo Upload Button */}
                          <label style={{
                            background: photo ? 'rgba(5, 150, 105, 0.25)' : 'rgba(255,255,255,0.08)',
                            border: photo ? '1px solid rgba(5, 150, 105, 0.45)' : '1px solid rgba(255,255,255,0.15)',
                            color: photo ? '#6ee7b7' : '#cbd5e1',
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            padding: '5px 7px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            flexShrink: 0
                          }} title={photo ? 'ફોટો બદલો' : 'ફોટો અપલોડ કરો'}>
                            <Camera size={11} />
                            {photo ? '✓ ફોટો' : '+ ફોટો'}
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
                        </div>
                      );
                    })}
                  </div>
                </div>
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
