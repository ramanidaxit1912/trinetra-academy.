const puppeteer = require('puppeteer-core');
const katex = require('katex');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const APP_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.bolton.unhnx';

// Helper: Format KaTeX math expressions within text
function formatMathHtml(text) {
  if (!text) return '';
  let str = String(text);

  // Replace $...$
  str = str.replace(/\$([^\$]+)\$/g, (match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false });
    } catch (e) {
      return match;
    }
  });

  // Replace \(...\)
  str = str.replace(/\\\((.*?)\\\)/g, (match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false });
    } catch (e) {
      return match;
    }
  });

  // If contains LaTeX command, render with KaTeX
  if (/\\(frac|sqrt|pm|times|div|le|ge|neq|alpha|beta|theta|pi)/.test(str)) {
    try {
      str = katex.renderToString(str, { throwOnError: false, displayMode: false });
    } catch (e) {}
  }

  // Replace common power patterns if not in LaTeX, e.g. x^2 -> x²
  str = str.replace(/\^2/g, '²')
           .replace(/\^3/g, '³')
           .replace(/\^4/g, '⁴')
           .replace(/\^5/g, '⁵')
           .replace(/\^n/g, 'ⁿ');

  return str;
}

// Helper: Check if string is an image source or tag
function isImgString(val) {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return s.startsWith('data:image/') ||
         s.startsWith('/uploads/') ||
         s.startsWith('uploads/') ||
         s.includes('<img') ||
         /\.(jpeg|jpg|png|gif|webp|svg)($|\?)/i.test(s);
}

// Helper: Convert any image string (Base64, relative uploads path, local filesystem path, or remote URL) to valid img src / Base64
function resolveImageSrc(imgStr) {
  if (!imgStr || typeof imgStr !== 'string') return '';
  const trimmed = imgStr.trim();
  if (!trimmed) return '';
  
  // If already base64 data url
  if (trimmed.startsWith('data:image/')) return trimmed;

  // Extract from HTML <img src="..."> tag if present
  const imgTagMatch = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTagMatch && imgTagMatch[1]) {
    return resolveImageSrc(imgTagMatch[1]);
  }

  // Remove leading slashes and extract filename
  const cleanPath = trimmed.replace(/^\/+/, '');
  const baseName = path.basename(cleanPath);

  // Check local filesystem paths
  const candidatePaths = [
    path.isAbsolute(trimmed) ? trimmed : null,
    path.join(__dirname, '..', cleanPath),
    path.join(__dirname, '../uploads', baseName),
    path.join(__dirname, '../../uploads', baseName),
    path.join(__dirname, '../../frontend/public', cleanPath),
    path.join(__dirname, '../../frontend/public/images', baseName),
    path.join(__dirname, '../../frontend/public/uploads', baseName),
    path.join(process.cwd(), cleanPath),
    path.join(process.cwd(), 'uploads', baseName)
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const ext = path.extname(p).toLowerCase().replace('.', '') || 'png';
        const mime = (ext === 'jpg' || ext === 'jpeg') ? 'jpeg' : (ext === 'svg' ? 'svg+xml' : ext);
        const data = fs.readFileSync(p).toString('base64');
        return `data:image/${mime};base64,${data}`;
      } catch (e) {}
    }
  }

  return trimmed;
}

// Helper: Get Base64 Data URL for an image file
function getImageBase64(relPath) {
  try {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(__dirname, '..', relPath);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(fullPath).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const data = fs.readFileSync(fullPath).toString('base64');
      return `data:image/${mime};base64,${data}`;
    }
  } catch (e) {}
  return null;
}

/**
 * Generate Royal Scorecard HTML Document matching PDF 2 format exactly
 */
async function buildScorecardHTML({ submission = {}, review = [], student = {}, marketingItems = [] }) {
  const studentName = student.name || submission.student?.name || 'વિદ્યાર્થી';
  const studentMobile = student.mobile || submission.student?.mobile || '';
  const testName = submission.testName || 'કસોટી';
  const subject = submission.subject || 'સામાન્ય';
  const testCode = submission.testCode || 'TEST-CHU5C';
  const examDate = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleDateString('gu-IN')
    : new Date().toLocaleDateString('gu-IN');

  // Calculate True Evaluation Score
  let score = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  review.forEach(item => {
    const q = item.question || item;
    const qMarks = Number(q.marks) || 1;
    const qNeg = Number(q.negativeMarking) || 0;
    totalMarks += qMarks;

    if (item.isCorrect === true) {
      score += qMarks;
      correctCount++;
    } else if (item.isCorrect === false) {
      score -= qNeg;
      wrongCount++;
    } else {
      skippedCount++;
    }
  });

  score = Math.max(0, Math.min(totalMarks, score));
  if (submission.teacherMarks) {
    score = Math.min(totalMarks, score + Number(submission.teacherMarks));
  }

  const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const isPass = pct >= 50;
  const gradeColor = isPass ? '#15803d' : '#b91c1c';

  // ── 1. Speed & Accuracy Analytics Calculations (Feature #8) ──
  let totalSecondsSpent = 0;
  review.forEach(item => {
    totalSecondsSpent += Number(item.timeSpent) || 0;
  });
  if (totalSecondsSpent === 0) totalSecondsSpent = Math.max(30, review.length * 45);
  const avgSecondsPerQ = review.length > 0 ? Math.round(totalSecondsSpent / review.length) : 45;
  const accuracyRate = (correctCount + wrongCount) > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : pct;
  const durationMin = Math.floor(totalSecondsSpent / 60);
  const durationSec = totalSecondsSpent % 60;
  const durationFormatted = durationMin > 0 ? `${durationMin} મિનિટ ${durationSec} સે.` : `${durationSec} સેકન્ડ`;
  const speedRating = avgSecondsPerQ <= 45 ? '⚡ સુપર ફાસ્ટ & સચોટ' : avgSecondsPerQ <= 75 ? '🎯 સારો સ્પીડ રેટ' : '⏱️ મધ્યમ સ્પીડ';

  // ── 2. Sunil Sir's Personalized Motivational Note (Feature #9) ──
  let motivationalQuote = '';
  let quoteBadge = '';
  let quoteBorder = '';
  let quoteBg = '';
  if (pct >= 80) {
    quoteBadge = '👑 ઉત્કૃષ્ટ પરિણામ (Distinction Ranker)';
    quoteBorder = '#d97706';
    quoteBg = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
    motivationalQuote = '🌟 અદ્ભુત અને ગૌરવશાળી પરિણામ! તમારું સરકારી શિક્ષક બનવાનું લક્ષ્ય હવે બિલકુલ નજીક છે. આ જ સમર્પણ અને ઉત્સાહ સાથે આગળ વધો, અંતિમ સફળતા તમારી જ રહેશે! — સુનિલ સર (સંસ્થાપક & ડિરેક્ટર)';
  } else if (pct >= 60) {
    quoteBadge = '🟢 પ્રથમ વર્ગ (First Class)';
    quoteBorder = '#10b981';
    quoteBg = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
    motivationalQuote = '👍 ખૂબ સરસ પ્રયાસ! થોડી વધુ મહેનત અને નિયમિત મોક ટેસ્ટ પ્રેક્ટિસથી તમે ચોક્કસ ટોપ ૧૦ રેન્કમાં સ્થાન મેળવશો. અમારી શુભેચ્છાઓ હંમેશા તમારી સાથે છે! — સુનિલ સર';
  } else {
    quoteBadge = '💪 સુધારા માટે પ્રોત્સાહન (Keep Practicing)';
    quoteBorder = '#6366f1';
    quoteBg = 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)';
    motivationalQuote = '💪 નિરાશ થશો નહીં! દરેક ભૂલ એ શીખવાની એક નવી તક છે. જ્યાં ભૂલો થઈ છે તે પ્રશ્નોનું પુનરાવર્તન કરો અને સોલ્યુશન સમજો. અમે તમારી સફળતા સુધી સતત તમારી સાથે છીએ! — સુનિલ સર';
  }

  // Read KaTeX CSS
  let katexCss = '';
  try {
    const katexPath = require.resolve('katex/dist/katex.min.css');
    katexCss = fs.readFileSync(katexPath, 'utf8');
  } catch (e) {}

  // Generate real scannable QR Code Data URL for Play Store App URL
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(APP_PLAY_STORE_URL, {
      margin: 1,
      width: 200,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (e) {}

  // Resolve Logo Base64
  let logoDataUrl = getImageBase64('../frontend/public/images/logo.jpg') || 
                    getImageBase64('../frontend/public/logo.png') || 
                    getImageBase64('uploads/logo.jpg');

  // Process ONLY teacher marketing items / posters that are made live for PDF
  const renderedPosters = [];
  if (Array.isArray(marketingItems) && marketingItems.length > 0) {
    marketingItems.forEach(item => {
      // Must be active and explicitly enabled for PDF
      if (item.isActive === false || item.showInPdf === false) return;

      let imgUrl = item.imageUrl || item.image;
      let b64 = resolveImageSrc(imgUrl);
      if (b64 || item.title) {
        renderedPosters.push({
          title: item.title || '',
          subtitle: item.subtitle || '',
          price: item.price || '',
          oldPrice: item.oldPrice || '',
          badge: item.badge || '',
          tagColor: item.tagColor || '#f59e0b',
          couponCode: item.couponCode || '',
          imageDataUrl: b64
        });
      }
    });
  }

  // Display EXACTLY and ONLY the posters the teacher has set live
  const displayPosters = renderedPosters;

  // Resolve Green Arrow Image Base64
  let greenArrowDataUrl = getImageBase64('../frontend/public/images/click_here_arrow_green.png') || 
                          getImageBase64('../frontend/public/images/click_here_arrow_transparent.png') || 
                          getImageBase64('../frontend/public/images/click_here_arrow.jpg');

  // Load local Gujarati fonts as Base64 for 100% offline instant rendering
  let fontRegularB64 = '';
  let fontBoldB64 = '';
  try {
    const regPath = path.join(__dirname, '../fonts/HindVadodara-Regular.ttf');
    const boldPath = path.join(__dirname, '../fonts/HindVadodara-Bold.ttf');
    if (fs.existsSync(regPath)) fontRegularB64 = fs.readFileSync(regPath).toString('base64');
    if (fs.existsSync(boldPath)) fontBoldB64 = fs.readFileSync(boldPath).toString('base64');
  } catch (e) {}

  // Helper to render a question card with full image and diagram support
  const renderQuestionCard = (item, idx) => {
    const q = item.question || item;
    const qNum = idx + 1;
    const qText = formatMathHtml(q.text || q.questionText || `પ્રશ્ન ${qNum}`);
    const studentAns = (item.studentAnswer || '').toUpperCase().trim();
    const correctOpt = (q.correctOpt || 'A').toUpperCase().trim();
    const isCorrect = item.isCorrect;
    const isSkipped = item.isSkipped || !studentAns || studentAns === 'E';
    const isDesc = (q.type === 'descriptive');

    let statusBadge = '';
    if (isDesc) {
      statusBadge = '<span class="q-status-badge status-skipped" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">📝 વર્ણાત્મક</span>';
    } else if (isCorrect === true) {
      statusBadge = '<span class="q-status-badge status-correct">✓ સાચો (+1 ગુણ)</span>';
    } else if (isCorrect === false) {
      statusBadge = '<span class="q-status-badge status-wrong">✕ ખોટો (0 ગુણ)</span>';
    } else {
      statusBadge = '<span class="q-status-badge status-skipped">⊘ છોડેલ (0 ગુણ)</span>';
    }

    // Resolve Question Diagram / Photo
    const rawQImg = q.image || q.imageUrl || '';
    const qImgSrc = resolveImageSrc(rawQImg);

    // Resolve Student Uploaded Answer Sheet Photo (for descriptive questions)
    const studentPhotoSrc = resolveImageSrc(item.studentUploadedPhoto || submission.photoUrl || '');

    return `
    <div class="question-card">
      <div class="q-header">
        <div style="display: flex; align-items: baseline; gap: 8px; flex: 1;">
          <span class="q-num-label">પ્રશ્ન ${qNum}</span>
          <span class="q-text">${qText}</span>
        </div>
        ${statusBadge}
      </div>

      ${qImgSrc ? `
        <div style="margin: 6px 0 8px; text-align: center; padding: 6px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <img src="${qImgSrc}" style="max-height: 130px; max-width: 95%; object-fit: contain; border-radius: 6px;" alt="Question Diagram" />
        </div>
      ` : ''}

      ${!isDesc ? `
        <div class="options-grid">
          ${['A', 'B', 'C', 'D'].map(k => {
            const rawOptVal = q['option' + k] || q['opt' + k] || '';
            const rawOptImg = q['option' + k + '_img'] || q['opt' + k + '_img'] || (isImgString(rawOptVal) ? rawOptVal : '');
            const optImgSrc = resolveImageSrc(rawOptImg);
            const optText = isImgString(rawOptVal) ? '' : formatMathHtml(rawOptVal);

            const isThisCorrect = (k === correctOpt);
            const isThisSelectedWrong = (k === studentAns && !isCorrect);
            const isThisSelectedRight = (k === studentAns && isCorrect);

            let optClass = 'opt-box';
            let labelBadge = '';

            if (isThisSelectedRight) {
              optClass += ' opt-correct';
              labelBadge = '<span style="font-size: 8.5px; font-weight: 900; color: #15803d;">[✓ સાચો]</span>';
            } else if (isThisCorrect) {
              optClass += ' opt-correct';
              labelBadge = '<span style="font-size: 8.5px; font-weight: 900; color: #15803d;">[✓ સાચો જવાબ]</span>';
            } else if (isThisSelectedWrong) {
              optClass += ' opt-wrong-selected';
              labelBadge = '<span style="font-size: 8.5px; font-weight: 900; color: #b91c1c;">[✕ પસંદ કરેલ]</span>';
            }

            return `
              <div class="${optClass}" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span><strong>${k}.</strong> ${optText}</span>
                  ${labelBadge}
                </div>
                ${optImgSrc ? `
                  <div style="margin-top: 3px; width: 100%; text-align: center;">
                    <img src="${optImgSrc}" style="max-height: 55px; max-width: 90%; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1;" alt="Option ${k}" />
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="background: #fffbeb; border: 1px dashed #f59e0b; border-radius: 6px; padding: 6px 10px; font-size: 11px; color: #92400e; margin: 6px 0;">
          📝 વર્ણાત્મક પ્રશ્ન (Descriptive Written Answer)
        </div>
        ${studentPhotoSrc ? `
          <div style="margin: 6px 0; text-align: center; padding: 6px; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div style="font-size: 10px; font-weight: 800; color: #334155; margin-bottom: 4px;">📸 વિદ્યાર્થી દ્વારા અપલોડ કરેલ ઉત્તરવહી:</div>
            <img src="${studentPhotoSrc}" style="max-height: 180px; max-width: 95%; object-fit: contain; border-radius: 6px;" alt="Answer Sheet" />
          </div>
        ` : ''}
      `}

      <div class="q-footer-strip">
        <div>
          <strong>📌 તમારો ઉત્તર:</strong> 
          <span style="font-weight: 800; color: ${isCorrect ? '#15803d' : isCorrect === false ? '#b91c1c' : '#854d0e'};">
            ${isSkipped ? 'અનુત્તર (Skipped)' : studentAns}
          </span>
        </div>
        ${!isSkipped ? `<div><strong>⏱️ લીધેલ સમય:</strong> ${item.timeSpent ? item.timeSpent + 's' : '2s'}</div>` : '<div></div>'}
        <div><strong>✅ સાચો ઉત્તર:</strong> <span style="font-weight: 800; color: #15803d;">${correctOpt}. ${formatMathHtml(q['option' + correctOpt] || q['opt' + correctOpt] || '')}</span></div>
      </div>

      ${q.answerHint ? `
        <div style="margin-top: 5px; font-size: 10px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 8px;">
          💡 <strong>સમજૂતી (Explanation):</strong> ${formatMathHtml(q.answerHint)}
        </div>
      ` : ''}
    </div>
    `;
  };

  // Smart dynamic question pagination: adjusts items per page based on whether questions have images
  const questionPages = [];
  let pageIdx = 0;
  let qIdx = 0;

  while (qIdx < review.length) {
    const isFirstPage = (pageIdx === 0);
    // If the entire test has 1-3 questions, keep them all on Page 1 together with the signature footer!
    let maxWeight = isFirstPage ? (review.length <= 3 ? 5.5 : 3.8) : 4.8;
    let currentWeight = 0;
    const pageItems = [];

    while (qIdx < review.length) {
      const curItem = review[qIdx];
      const curQ = curItem.question || curItem;
      const hasImg = Boolean(curQ.image || curQ.imageUrl || curQ.optionA_img || curQ.optionB_img || curItem.studentUploadedPhoto);
      const itemWeight = hasImg ? 1.3 : 0.8;

      if (pageItems.length > 0 && (currentWeight + itemWeight > maxWeight)) {
        // Only break to a new page if more than 1 item remains or if page has at least 3 items
        const remaining = review.length - qIdx;
        if (remaining > 1 || pageItems.length >= 4) {
          break;
        }
      }

      pageItems.push(curItem);
      currentWeight += itemWeight;
      qIdx++;
    }

    const isLastPage = (qIdx >= review.length);
    questionPages.push({
      items: pageItems,
      startIndex: qIdx - pageItems.length,
      isFirst: isFirstPage,
      isLast: isLastPage
    });
    pageIdx++;
  }

  return `<!DOCTYPE html>
<html lang="gu">
<head>
  <meta charset="UTF-8">
  <title>Trinetra Scorecard - ${testName} - ${studentName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
  <style>
    ${fontRegularB64 ? `
      @font-face {
        font-family: 'Hind Vadodara';
        font-weight: 400;
        src: url(data:font/truetype;charset=utf-8;base64,${fontRegularB64}) format('truetype');
      }
    ` : ''}
    ${fontBoldB64 ? `
      @font-face {
        font-family: 'Hind Vadodara';
        font-weight: 700;
        src: url(data:font/truetype;charset=utf-8;base64,${fontBoldB64}) format('truetype');
      }
      @font-face {
        font-family: 'Hind Vadodara';
        font-weight: 800;
        src: url(data:font/truetype;charset=utf-8;base64,${fontBoldB64}) format('truetype');
      }
      @font-face {
        font-family: 'Hind Vadodara';
        font-weight: 900;
        src: url(data:font/truetype;charset=utf-8;base64,${fontBoldB64}) format('truetype');
      }
    ` : ''}

    ${katexCss}

    @page {
      size: A4;
      margin: 8mm 8mm 8mm 8mm;
    }

    * { box-sizing: border-box; }
    body {
      font-family: 'Hind Vadodara', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Royal Golden & Navy Border on EVERY Page ── */
    .pdf-page-frame {
      border: 2.5px solid #d97706;
      outline: 1.2px solid #1e3a8a;
      outline-offset: -5px;
      border-radius: 14px;
      padding: 16px 18px;
      background: #ffffff;
      min-height: 1040px;
      box-sizing: border-box;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }
    .pdf-page-frame:last-child {
      page-break-after: avoid;
    }

    /* ── Subtle 3D Royal Watermark (Feature #1) ── */
    .watermark-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-24deg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0.04;
      pointer-events: none;
      z-index: 0;
      width: 500px;
      text-align: center;
    }
    .watermark-bg img {
      width: 140px;
      height: 140px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .watermark-text {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    /* ── Speed & Accuracy Analytics Gauge (Feature #8) ── */
    .speed-meter-strip {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 14px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .speed-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #334155;
    }
    .speed-item strong {
      color: #0f172a;
      font-weight: 900;
    }
    .speed-badge {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 900;
      white-space: nowrap;
    }

    /* ── Sunil Sir's Motivational Quote Box (Feature #9) ── */
    .motivational-box {
      border-radius: 10px;
      padding: 10px 14px;
      margin-top: 10px;
      margin-bottom: 10px;
      position: relative;
      text-align: left;
    }
    .motivational-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .motivational-title {
      font-size: 11px;
      font-weight: 900;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .motivational-text {
      font-size: 11.5px;
      line-height: 1.45;
      color: #1e293b;
      font-weight: 700;
      font-style: italic;
    }

    /* ── Header ── */
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .logo-badge {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid #d97706;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(217,119,6,0.2);
      flex-shrink: 0;
    }
    .logo-badge img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .gold-seal-badge {
      width: 62px;
      height: 62px;
      border-radius: 50%;
      border: 2px dashed #d97706;
      background: #fffbeb;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      box-shadow: 0 4px 12px rgba(217,119,6,0.25);
      flex-shrink: 0;
    }

    /* ── Meta Strip ── */
    .meta-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 11.5px;
      gap: 6px;
    }

    /* ── 4 Key Metric Cards ── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .metric-card {
      background: #ffffff;
      border: 1.5px solid #0f172a;
      border-radius: 10px;
      padding: 10px 8px;
      text-align: center;
    }
    .metric-title {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 700;
    }
    .metric-val {
      font-size: 18px;
      font-weight: 900;
      margin: 2px 0 1px;
    }
    .metric-sub {
      font-size: 9.5px;
      color: #64748b;
    }

    /* ── Section Title ── */
    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      font-weight: 800;
      color: #1e3a8a;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* ── Question Card ── */
    .question-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .q-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .q-num-label {
      font-size: 11.5px;
      font-weight: 800;
      color: #64748b;
      white-space: nowrap;
    }
    .q-text {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.4;
    }
    .q-status-badge {
      font-size: 10px;
      font-weight: 900;
      padding: 2.5px 8px;
      border-radius: 16px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .status-correct { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .status-wrong { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    .status-skipped { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    /* ── 2x2 Options Grid ── */
    .options-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin: 8px 0 6px;
    }
    .opt-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
    }
    .opt-box.opt-correct {
      border: 1.5px solid #22c55e;
      background: #f0fdf4;
      font-weight: 800;
      color: #15803d;
    }
    .opt-box.opt-wrong-selected {
      border: 1.5px solid #ef4444;
      background: #fef2f2;
      font-weight: 800;
      color: #b91c1c;
    }

    /* ── Question Footer Strip ── */
    .q-footer-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px dashed #e2e8f0;
      padding-top: 6px;
      margin-top: 4px;
      font-size: 10px;
      color: #475569;
    }

    /* ── Signature & Stamp Footer ── */
    .cert-footer-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 16px;
      margin-top: 12px;
      background: #f8fafc;
    }
    .sunil-sig {
      font-family: 'Great Vibes', 'Brush Script MT', 'Dancing Script', 'Segoe Script', cursive;
      font-size: 32px;
      color: #1e3a8a;
      line-height: 1;
      font-weight: 700;
    }

    /* ── Brochure Section Matching Screenshot Exactly ── */
    .brochure-posters-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin: 10px 0 12px;
      align-items: stretch;
    }
    .brochure-poster-card {
      border: 2px solid #1e3a8a;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 6px 18px rgba(30,58,138,0.15);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
    .brochure-poster-img {
      width: 100%;
      height: auto;
      max-height: 290px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }

    /* ── VIP Cyber Emerald App Banner ── */
    .vip-banner-container {
      border: 2.5px solid #22c55e;
      outline: 2px solid #1e3a8a;
      border-radius: 14px;
      background: linear-gradient(135deg, #070d1a 0%, #0f1f4b 50%, #070d1a 100%);
      overflow: hidden;
      box-shadow: 0 8px 26px rgba(0,0,0,0.4), 0 0 16px rgba(34,197,94,0.35);
      box-sizing: border-box;
      padding: 10px 14px;
      margin-bottom: 8px;
    }
    .vip-banner-flex {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .vip-left-info {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-align: left;
    }
    .vip-chips-row {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }
    .vip-right-visuals {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
  </style>
</head>
<body>

  <!-- ── EVALUATION PAGES (Exact Golden Borders on Every Page) ── -->
  ${questionPages.map((pg, pageIdx) => {
    return `
    <div class="pdf-page-frame">
      <!-- ── Subtle 3D Royal Watermark (Feature #1) ── -->
      <div class="watermark-bg">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Watermark Logo" />` : ''}
        <div class="watermark-text">TRINETRA ACADEMY</div>
      </div>

      <div>
        ${pg.isFirst ? `
          <!-- ── 1. HEADER (Page 1) ── -->
          <div class="header-bar">
            <div class="logo-badge">
              ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" />` : `<span style="font-size: 24px; font-weight: 900; color: #1e3a8a;">🏛️</span>`}
            </div>

            <div style="text-align: center; flex: 1; padding: 0 10px;">
              <div style="font-size: 9.5px; font-weight: 900; color: #d97706; letter-spacing: 1.5px; text-transform: uppercase;">★ OFFICIAL EVALUATION SCORECARD & ANSWER SHEET ★</div>
              <h1 style="margin: 2px 0 0; color: #1e3a8a; font-size: 21px; font-weight: 900; letter-spacing: 0.3px;">
                🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી
              </h1>
              <div style="font-size: 10.5px; font-weight: 800; color: #15803d; margin-top: 2px;">
                ✨ મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆
              </div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">
                અધિકૃત વિદ્યાર્થી મૂલ્યાંકન પત્રક & વિગતવાર સોલ્યુશન્સ (Official Answer Key & Solutions)
              </div>
            </div>

            <div class="gold-seal-badge">
              <div style="font-size: 16px; line-height: 1;">🎖️</div>
              <div style="font-size: 7px; font-weight: 900; color: #92400e; letter-spacing: 0.5px; margin-top: 1px;">VERIFIED</div>
              <div style="font-size: 6.5px; font-weight: 800; color: #1e3a8a;">TRINETRA</div>
              <div style="font-size: 6px; color: #b45309; font-weight: 900;">CERTIFIED</div>
            </div>
          </div>

          <!-- ── 2. METADATA STRIP (Page 1) ── -->
          <div class="meta-strip">
            <div><span style="color:#64748b;">વિદ્યાર્થી:</span> <strong style="color:#1e3a8a;">${studentName}</strong></div>
            <div><span style="color:#64748b;">મોબાઈલ:</span> <strong>${studentMobile}</strong></div>
            <div><span style="color:#64748b;">કસોટી ક્રમ:</span> <strong style="color:#d97706;">${testCode}</strong></div>
            <div><span style="color:#64748b;">તારીખ:</span> <strong>${examDate}</strong></div>
          </div>

          <!-- ── 3. 4 KEY PERFORMANCE STAT CARDS (Page 1) ── -->
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-title">કસોટીનું નામ & વિષય</div>
              <div class="metric-val" style="font-size: 13px; color: #1e3a8a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${testName}</div>
              <div class="metric-sub">${subject}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">મેળવેલ ગુણ / કુલ ગુણ</div>
              <div class="metric-val" style="color: ${gradeColor};">${score} / ${totalMarks}</div>
              <div class="metric-sub">કુલ પ્રશ્નો: ${review.length}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">ટકાવારી (Percentage)</div>
              <div class="metric-val" style="color: ${gradeColor};">${pct}%</div>
              <div class="metric-sub" style="color: #15803d; font-weight: 700;">ચકાસાયેલ ગુણ</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">મૂલ્યાંકન પરિણામ</div>
              <div class="metric-val" style="font-size: 12.5px; color: ${isPass ? '#15803d' : '#b91c1c'};">
                ${isPass ? '🟢 પાસ' : '🔴 સુધારાની જરૂર'}
              </div>
              <div class="metric-sub">${isPass ? 'ઉત્કૃષ્ટ પ્રયાસ' : 'Needs Practice'}</div>
            </div>
          </div>

          <!-- ── 4. SPEED & ACCURACY GAUGE STRIP (Feature #8) ── -->
          <div class="speed-meter-strip">
            <div class="speed-item">
              <span style="font-size: 14px;">⚡</span>
              <div>
                <span style="color:#64748b; font-size:9.5px; display:block;">સરેરાશ સ્પીડ (Avg Speed)</span>
                <strong>${avgSecondsPerQ} સેકન્ડ / પ્રશ્ન</strong>
              </div>
            </div>

            <div class="speed-item">
              <span style="font-size: 14px;">🎯</span>
              <div>
                <span style="color:#64748b; font-size:9.5px; display:block;">ચોકસાઈ દર (Accuracy Rate)</span>
                <strong style="color:${accuracyRate >= 70 ? '#15803d' : '#b91c1c'};">${accuracyRate}%</strong>
              </div>
            </div>

            <div class="speed-item">
              <span style="font-size: 14px;">⏱️</span>
              <div>
                <span style="color:#64748b; font-size:9.5px; display:block;">કુલ સમય (Exam Duration)</span>
                <strong>${durationFormatted}</strong>
              </div>
            </div>

            <div class="speed-badge">
              ${speedRating}
            </div>
          </div>

          <div class="section-title">
            <span>📝 તમામ પ્રશ્નો અને ઉત્તરોની વિગતવાર ચકાસણી (Question-wise Solutions):</span>
            <span style="font-size: 10.5px; color: #64748b;">કુલ પ્રશ્નો: ${review.length}</span>
          </div>
        ` : `
          <!-- Page Header Strip for Subsequent Pages -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
            <div style="font-size: 10px; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 4px;">
              🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી | <span style="color:#d97706;">${testName}</span>
            </div>
            <div style="font-size: 9.5px; color: #64748b; font-weight: 700;">
              વિદ્યાર્થી: <strong>${studentName}</strong> | પેજ ${pageIdx + 1}
            </div>
          </div>
        `}

        <!-- Questions in this Page -->
        ${pg.items.map((item, localIdx) => renderQuestionCard(item, pg.startIndex + localIdx)).join('')}
      </div>

      ${pg.isLast ? `
        <!-- ── Sunil Sir's Personalized Motivational Note (Feature #9) ── -->
        <div class="motivational-box" style="background: ${quoteBg}; border: 1.5px solid ${quoteBorder};">
          <div class="motivational-header">
            <div class="motivational-title">
              <span>👨‍🏫 સુનિલ સરનો પ્રેરણાદાયી સંદેશ (Director's Personal Note):</span>
            </div>
            <span style="background: #ffffff; color: ${quoteBorder}; border: 1px solid ${quoteBorder}; font-size: 8.5px; font-weight: 900; padding: 2px 7px; border-radius: 10px;">
              ${quoteBadge}
            </span>
          </div>
          <div class="motivational-text">
            "${motivationalQuote}"
          </div>
        </div>

        <!-- ── 5. OFFICIAL SIGNATURE & STAMP FOOTER (Exact 1:1 match to screenshot) ── -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1.5px dashed #cbd5e1; padding-top: 12px; margin-top: 8px; page-break-inside: avoid; position: relative;">
          
          <!-- Left Corner Diamond -->
          <div style="position: absolute; left: 0; bottom: -4px; color: #d97706; font-size: 16px; font-weight: 900;">
            ❖
          </div>

          <!-- Left Info Column -->
          <div style="text-align: left; padding-left: 18px;">
            <div style="font-size: 12.5px; font-weight: 900; color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
              🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી અધિકૃત મૂલ્યાંકન પત્રક
            </div>
            <div style="font-size: 10px; color: #334155; margin-top: 4px; font-weight: 700;">
              📞 હેલ્પલાઇન: <strong style="color:#0f172a;">8200405300</strong> • 🌐 <a href="https://trinetraacademy.in" target="_blank" style="color:#0284c7; text-decoration:none;">trinetraacademy.in</a>
            </div>
            <div style="font-size: 10px; font-weight: 800; color: #15803d; margin-top: 3px;">
              ✓ ડિજિટલ ચકાસાયેલ ઉત્તરવહી
            </div>
          </div>

          <!-- Center: Official Seal Stamp Badge -->
          <div style="display: flex; align-items: center; justify-content: center;">
            <div style="border: 2px dashed #f59e0b; border-radius: 50%; padding: 3px; background: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
              <div style="border: 3px solid #1e3a8a; border-radius: 50%; width: 96px; height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ffffff; text-align: center; box-sizing: border-box; padding: 4px;">
                <div style="width: 30px; height: 30px; border-radius: 50%; overflow: hidden; margin-bottom: 2px;">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="font-size:16px;">🏛️</span>`}
                </div>
                <div style="font-size: 8px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.4px; line-height: 1.1;">TRINETRA ACADEMY</div>
                <div style="font-size: 7px; font-weight: 900; color: #d97706; letter-spacing: 0.3px; margin-top: 1px;">★ OFFICIAL SEAL ★</div>
              </div>
            </div>
          </div>

          <!-- Right: Sunil Sir Signature Block -->
          <div style="text-align: center; min-width: 240px; padding-right: 18px;">
            <div style="font-family: 'Great Vibes', 'Brush Script MT', 'Dancing Script', 'Segoe Script', cursive; font-size: 42px; font-weight: 900; color: #1e3a8a; font-style: italic; line-height: 1; letter-spacing: 1px;">
              Sunil Sir
            </div>
            <div style="height: 2px; background: #1e3a8a; width: 100%; margin: 5px auto 5px; border-radius: 2px;"></div>
            <div style="font-size: 14px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.2px;">
              સુનિલ સર (Sunil Sir)
            </div>
            <div style="font-size: 11px; font-weight: 800; color: #d97706; margin-top: 1px;">
              સંસ્થાપક & ડિરેક્ટર (Founder & Director)
            </div>
          </div>

          <!-- Right Corner Diamond -->
          <div style="position: absolute; right: 0; bottom: -4px; color: #d97706; font-size: 16px; font-weight: 900;">
            ❖
          </div>

        </div>
      ` : `
        <div style="text-align: right; font-size: 8.5px; color: #94a3b8; padding-top: 4px;">
          Trinetra Online Academy • Evaluation Sheet
        </div>
      `}
    </div>
    `;
  }).join('')}

  <!-- ── 6. MARKETING BROCHURE PAGE (Full-Page Hero Poster + Unified Cyber App Banner) ── -->
  <div class="pdf-page-frame" style="text-align: center; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box; padding: 12px 16px;">
    <!-- ── Subtle 3D Royal Watermark (Feature #1) ── -->
    <div class="watermark-bg">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Watermark Logo" />` : ''}
      <div class="watermark-text">TRINETRA ACADEMY</div>
    </div>
    
    <!-- ── TOP: Brand Header ── -->
    <div style="flex-shrink: 0; margin-bottom: 4px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #d97706; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="font-size:16px;">🏛️</span>`}
        </div>
        <div>
          <h2 style="margin: 0; font-size: 16px; font-weight: 900; color: #1e3a8a; line-height: 1.2;">
            🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)
          </h2>
          <div style="font-size: 10px; font-weight: 800; color: #d97706; margin-top: 1px;">
            🌟 વિશેષ ટેસ્ટ સિરીઝ, લાઈવ બેચ & સ્પેશિયલ કોર્સ બ્રોશર 🌟
          </div>
        </div>
      </div>
    </div>

    <!-- ── CENTER HERO: Full Size Teacher Poster(s) ── -->
    <div style="flex: 1 1 auto; display: flex; align-items: center; justify-content: center; margin: 4px 0; min-height: 0; width: 100%;">
      ${displayPosters.length === 1 ? `
        <div style="width: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
          ${displayPosters[0].imageDataUrl ? `
            <img src="${displayPosters[0].imageDataUrl}" style="max-height: 720px; max-width: 100%; width: 100%; height: auto; object-fit: contain; display: block; border-radius: 8px;" alt="${displayPosters[0].title}" />
          ` : `
            <div style="padding: 40px; font-weight: 900; color: #1e3a8a; font-size: 18px;">${displayPosters[0].title}</div>
          `}
        </div>
      ` : displayPosters.length > 1 ? `
        <div class="brochure-posters-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%; margin: 0 auto; align-items: center;">
          ${displayPosters.map((p, idx) => `
            <div key="poster-${idx}" style="display: flex; align-items: center; justify-content: center; width: 100%;">
              ${p.imageDataUrl ? `
                <img src="${p.imageDataUrl}" style="max-height: 480px; max-width: 100%; width: 100%; object-fit: contain; display: block; border-radius: 8px;" alt="${p.title}" />
              ` : `
                <div style="padding: 20px; font-weight: 800; color: #1e3a8a;">${p.title}</div>
              `}
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="width: 100%; padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px dashed #16a34a; border-radius: 12px; text-align: center;">
          <div style="font-size: 15px; font-weight: 900; color: #15803d;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી - શિક્ષણ સેવા તૈયારી મંચ</div>
          <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 4px;">TET-1, TET-2, TAT (Sec/Higher Sec) & શૈક્ષણિક ભરતી સ્પેશિયલ ઓનલાઈન મોક ટેસ્ટ સિરીઝ</div>
        </div>
      `}
    </div>

    <!-- ── BOTTOM STACK: App Banner + Social Media + Helpline Slogan ── -->
    <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 5px; margin-top: 4px;">
      
      <!-- VIP Cyber Emerald App Download Banner -->
      <div class="vip-banner-container" style="padding: 6px 12px; margin-bottom: 0;">
        <div class="vip-banner-flex">
          
          <!-- Left info -->
          <div class="vip-left-info" style="gap: 3px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
              <span style="background: linear-gradient(135deg, #15803d, #22c55e); color: #ffffff; font-size: 7px; font-weight: 900; padding: 1.5px 5px; border-radius: 4px; text-transform: uppercase;">⭐ OFFICIAL APP</span>
              <span style="color: #4ade80; font-size: 11.5px; font-weight: 900;">📲 ત્રિનેત્ર એકેડેમી Android App</span>
              <span style="color: #fbbf24; font-size: 8px; font-weight: 800;">(⭐⭐⭐⭐⭐ 4.9★ • 10K+ Students)</span>
            </div>

            <div class="vip-chips-row" style="gap: 4px;">
              <span style="background: rgba(34,197,94,0.18); border: 1px solid #22c55e; color: #86efac; font-size: 7px; font-weight: 800; padding: 1px 5px; border-radius: 12px;">✓ લાઈવ & રેકોર્ડેડ ક્લાસ</span>
              <span style="background: rgba(56,189,248,0.18); border: 1px solid #38bdf8; color: #7dd3fc; font-size: 7px; font-weight: 800; padding: 1px 5px; border-radius: 12px;">✓ ૫૦૦૦+ પ્રશ્નો મોક ટેસ્ટ</span>
              <span style="background: rgba(245,158,11,0.18); border: 1px solid #f59e0b; color: #fde68a; font-size: 7px; font-weight: 800; padding: 1px 5px; border-radius: 12px;">✓ PDF મટીરીયલ</span>
            </div>

            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: block; margin-top: 1px;">
              <div style="background: rgba(0,0,0,0.55); border-radius: 6px; padding: 3px 8px; display: flex; align-items: center; justify-content: space-between; gap: 6px; border: 1px solid rgba(255,255,255,0.15);">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <div style="background: #ffffff; border-radius: 3px; padding: 1.5px 4px; display: flex; align-items: center; gap: 3px;">
                    <span style="font-size: 8px; color: #2563eb;">▶</span>
                    <div style="text-align: left; line-height: 1;">
                      <div style="font-size: 4px; font-weight: 800; color: #64748b;">GET IT ON</div>
                      <div style="font-size: 6.5px; font-weight: 900; color: #0f172a;">Google Play</div>
                    </div>
                  </div>
                  <div style="color: #ffffff; font-size: 8.5px; font-weight: 800;">
                    Trinetra online <span style="color: #38bdf8;">Download Our App</span>
                  </div>
                </div>
                <div style="font-size: 7.5px; color: #4ade80; font-weight: 800; text-decoration: underline;">
                  play.google.com ➔
                </div>
              </div>
            </a>
          </div>

          <!-- Center Glowing Arrow with Real Asset Image (Clickable App Link) -->
          <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin: 0 4px;">
            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: inline-block;">
              ${greenArrowDataUrl ? `
                <img src="${greenArrowDataUrl}" style="height: 46px; width: auto; max-width: 120px; object-fit: contain; display: block;" alt="Click Here to Download App" />
              ` : `
                <svg width="90" height="36" viewBox="0 0 105 42" fill="none">
                  <path d="M4 21H80M80 21L64 8M80 21L64 34" stroke="#00ff87" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
                  <text x="6" y="16" fill="#00ff87" font-size="12" font-weight="900">CLICK</text>
                  <text x="6" y="32" fill="#00ff87" font-size="12" font-weight="900">HERE</text>
                </svg>
              `}
            </a>
          </div>

          <!-- Right Visuals (Phone + QR Code) -->
          <div class="vip-right-visuals" style="gap: 6px;">
            
            <!-- Phone mockup (Clickable App Link) -->
            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: block;">
              <div style="border: 2px solid #0f172a; outline: 1px solid #22c55e; border-radius: 10px; width: 50px; height: 76px; background: #ffffff; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: space-between; padding: 2px; box-sizing: border-box; flex-shrink: 0;">
                <div style="font-size: 5px; font-weight: 900; color: #1e3a8a; line-height: 1.1;">Download<br/>App</div>
                <div style="width: 17px; height: 17px; border-radius: 50%; border: 1px solid #d97706; margin: 0 auto; overflow: hidden;">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="font-size:9px;">🏛️</span>`}
                </div>
                <div style="font-size: 4.5px; font-weight: 900; color: #0f172a;">Trinetra Online</div>
                <div style="background: #15803d; color: #ffffff; font-size: 4px; font-weight: 900; padding: 1px; border-radius: 2px;">⬇ GET APP</div>
              </div>
            </a>

            <!-- QR Code Frame (Clickable App Link & Real Scannable QR Code) -->
            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: block;">
              <div style="background: #ffffff; padding: 2.5px 3.5px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,0.25); border: 1.5px solid #22c55e; flex-shrink: 0;">
                ${qrDataUrl ? `
                  <img src="${qrDataUrl}" style="width: 44px; height: 44px; display: block; border-radius: 2px; margin: 0 auto;" alt="App QR Code" />
                ` : `
                  <div style="width:44px; height:44px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:6px; color:#64748b;">QR</div>
                `}
                <div style="font-size: 5px; font-weight: 900; color: #1e3a8a; margin-top: 1px; white-space: nowrap;">📷 SCAN ME</div>
              </div>
            </a>

          </div>

        </div>
      </div>

      <!-- ── Interactive Social Media Strip (Feature #10) ── -->
      <div style="padding: 4px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
        <div style="font-size: 9.5px; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 3px;">
          🌐 સત્તાવાર ચેનલ સાથે જોડાવો:
        </div>
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <a href="https://youtube.com/@trinetra_academy100?si=o40zQ7nNp8bMptcU" target="_blank" style="background: #ef4444; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            ▶ YouTube
          </a>
          <a href="https://t.me/Trinetra_Online" target="_blank" style="background: #0284c7; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            ✈ Telegram
          </a>
          <a href="https://www.instagram.com/trinetra_online_academy?igsh=d2JqYmE4eWNsNmts" target="_blank" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            📷 Instagram
          </a>
          <a href="https://wa.me/918200405300" target="_blank" style="background: #16a34a; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            💬 WhatsApp
          </a>
          <a href="https://trinetraacademy.in" target="_blank" style="background: #1e3a8a; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
            🌐 Website
          </a>
        </div>
      </div>

      <!-- Bottom Center Slogan -->
      <div style="padding-top: 3px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 9.5px; font-weight: 800; color: #1e3a8a;">
          🎯 મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆
        </div>
        <div style="font-size: 8.5px; color: #64748b;">
          Helpline: <strong>8200405300</strong> • <strong>trinetraacademy.in</strong>
        </div>
      </div>

    </div>

  </div>

</body>
</html>`;
}

/**
 * Generate PDF Buffer using Puppeteer and Chrome
 */
async function generateScorecardPDFBuffer(data) {
  let browser = null;
  try {
    const html = await buildScorecardHTML(data);

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        bottom: '12mm',
        left: '10mm',
        right: '10mm'
      }
    });

    await browser.close();
    browser = null;

    return Buffer.from(pdfBuffer);
  } catch (err) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
    console.error('Puppeteer PDF Generation Error:', err);
    throw err;
  }
}

/**
 * Stream PDF for direct download route
 */
function generateScorecardPDF(data) {
  const { Readable } = require('stream');
  const stream = new Readable({ read() {} });

  generateScorecardPDFBuffer(data)
    .then(buffer => {
      stream.push(buffer);
      stream.push(null);
    })
    .catch(err => {
      stream.destroy(err);
    });

  return stream;
}

module.exports = {
  generateScorecardPDF,
  generateScorecardPDFBuffer,
  generatePragatiReportPDFBuffer
};

/**
 * Build Pragati Card (Progress Report) HTML for Puppeteer
 * Matches the client-side StudentDashboard handlePrintProgressReport + Royal Scorecard brochure
 */
async function buildPragatiReportHTML({ student, submissions, marketingItems = [] }) {
  // Generate real scannable QR Code Data URL for Play Store App URL
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(APP_PLAY_STORE_URL, {
      margin: 1,
      width: 200,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (e) {}

  // Resolve Logo Base64
  let logoDataUrl = getImageBase64('../frontend/public/images/logo.jpg') || 
                    getImageBase64('../frontend/public/logo.png') || 
                    getImageBase64('uploads/logo.jpg');

  // Resolve Green Arrow Image Base64
  let greenArrowDataUrl = getImageBase64('../frontend/public/images/click_here_arrow_green.png') || 
                          getImageBase64('../frontend/public/images/click_here_arrow_transparent.png') || 
                          getImageBase64('../frontend/public/images/click_here_arrow.jpg');

  // Compute stats same as frontend
  let sumScore = 0, sumTotal = 0, maxPct = 0;
  submissions.forEach(s => {
    const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
    const totalM = Number(s.totalMarks) > 0 ? Number(s.totalMarks) : Number(s.totalMCQ) > 0 ? Number(s.totalMCQ) : 20;
    const clamped = Math.min(totalM, Math.max(0, score));
    const pct = Math.min(100, Math.max(0, Math.round((clamped / totalM) * 100)));
    sumScore += clamped; sumTotal += totalM;
    if (pct > maxPct) maxPct = pct;
  });
  const avgScore = sumTotal > 0 ? Math.min(100, Math.max(0, Math.round((sumScore / sumTotal) * 100))) : 0;
  const totalTests = submissions.length;

  // Accuracy
  let totalMCQ = 0, correctMCQ = 0;
  submissions.forEach(s => { totalMCQ += (s.totalMCQ || 0); correctMCQ += (s.mcqScore || 0); });
  const accuracy = totalMCQ > 0 ? Math.round((correctMCQ / totalMCQ) * 100) : 0;

  // Grade
  const overallGrade = avgScore >= 90 ? 'A+ (ટોપર)' : avgScore >= 75 ? 'A (ઉત્કૃષ્ટ)' : avgScore >= 60 ? 'B (સક્ષમ)' : 'C (સુધારણા)';
  const gradeColor = avgScore >= 75 ? '#15803d' : avgScore >= 60 ? '#b45309' : '#b91c1c';

  // Subject analytics
  const subjectMap = {};
  submissions.forEach(s => {
    const sub = s.subject || 'સામાન્ય';
    if (!subjectMap[sub]) subjectMap[sub] = { subject: sub, count: 0, totalScore: 0, totalMax: 0 };
    const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
    const totalM = Number(s.totalMarks) > 0 ? Number(s.totalMarks) : Number(s.totalMCQ) > 0 ? Number(s.totalMCQ) : 20;
    subjectMap[sub].count++;
    subjectMap[sub].totalScore += Math.min(totalM, Math.max(0, score));
    subjectMap[sub].totalMax += totalM;
  });
  const subjectAnalytics = Object.values(subjectMap).map(m => ({
    ...m,
    pct: m.totalMax > 0 ? Math.min(100, Math.max(0, Math.round((m.totalScore / m.totalMax) * 100))) : 0
  }));

  // Test trend data (chronological oldest to newest)
  const reversed = [...submissions].reverse();
  const testTrendData = reversed.map((s, idx) => {
    const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
    const total = Number(s.totalMarks || s.totalMCQ || 20) || 20;
    const pct = Math.min(100, Math.max(0, total > 0 ? Math.round((score / total) * 100) : 0));
    return { testNum: idx + 1, testName: s.testName || 'ટ', score, total, percentage: pct };
  });

  // Bar chart SVG
  const svgWidth = Math.max(460, 45 + testTrendData.length * 65);
  const chartBars = testTrendData.map((d, i) => {
    const clamped = Math.min(100, Math.max(0, d.percentage || 0));
    const barH = Math.max(8, (clamped / 100) * 115);
    const y = 135 - barH;
    const x = 30 + i * 65;
    const barColor = clamped >= 70 ? '#16a34a' : clamped >= 50 ? '#d97706' : '#dc2626';
    const badgeBg = clamped >= 70 ? '#dcfce7' : clamped >= 50 ? '#fef3c7' : '#fee2e2';
    const badgeColor = clamped >= 70 ? '#15803d' : clamped >= 50 ? '#b45309' : '#b91c1c';
    return `
      <g>
        <rect x="${x - 2}" y="${y - 20}" width="42" height="15" rx="4" fill="${badgeBg}" stroke="${barColor}" stroke-width="0.8" />
        <text x="${x + 19}" y="${y - 9}" text-anchor="middle" font-size="9.5" font-weight="900" fill="${badgeColor}">${clamped}%</text>
        <rect x="${x}" y="${y}" width="38" height="${barH}" rx="4" fill="${barColor}" />
        <text x="${x + 19}" y="152" text-anchor="middle" font-size="10.5" font-weight="800" fill="#1e293b">T${d.testNum}</text>
        <text x="${x + 19}" y="164" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">${(d.testName || '').substring(0, 8)}</text>
      </g>`;
  }).join('');

  const certNumber = `TRN-${Math.floor(100000 + Math.random() * 900000)}`;

  // Posters for brochure
  const displayPosters = [];
  if (Array.isArray(marketingItems) && marketingItems.length > 0) {
    for (const item of marketingItems) {
      if (item.isActive !== false && item.showInPdf !== false && (item.imageUrl || item.image)) {
        const imgPath = item.imageUrl || item.image;
        const imgDataUrl = resolveImageSrc(imgPath);
        if (imgDataUrl) displayPosters.push({ ...item, imageDataUrl: imgDataUrl });
      }
      if (displayPosters.length >= 2) break;
    }
  }

  return `<!DOCTYPE html>
<html lang="gu">
<head>
  <meta charset="UTF-8">
  <title>Trinetra Progress Report - ${student.name}</title>
  <style>
    @page { size: A4; margin: 8mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 0; color: #0f172a; max-width: 840px; margin: 0 auto; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    
    .watermark-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-24deg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0.04;
      pointer-events: none;
      z-index: 0;
      width: 500px;
      text-align: center;
    }
    .watermark-bg img {
      width: 140px;
      height: 140px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .watermark-text {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .certificate-wrapper {
      border: 3.5px solid #1e3a8a;
      outline: 2px solid #d97706;
      outline-offset: 4px;
      border-radius: 14px;
      padding: 16px 20px;
      background: #ffffff;
      position: relative;
      page-break-after: always;
      margin-bottom: 12px;
    }
    .corner-ornament { position: absolute; width: 22px; height: 22px; color: #d97706; font-size: 18px; font-weight: 900; line-height: 1; }
    .corner-tl { top: 6px; left: 8px; } .corner-tr { top: 6px; right: 8px; }
    .corner-bl { bottom: 6px; left: 8px; } .corner-br { bottom: 6px; right: 8px; }
    
    .cert-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; gap: 12px; }
    .gold-seal-badge { width: 78px; height: 78px; border-radius: 50%; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fef3c7 100%); border: 2.5px dashed #b45309; box-shadow: 0 4px 12px rgba(217,119,6,0.25); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex-shrink: 0; padding: 4px; }
    
    .meta-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0; }
    .stat-card { background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 3.5px solid #1e3a8a; border-radius: 8px; padding: 9px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .stat-num { font-size: 19px; font-weight: 900; color: #1e3a8a; margin-top: 2px; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-size: 12.5px; }
    th { background: #f1f5f9; color: #1e3a8a; font-weight: 900; }
    
    .chart-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin: 12px 0; }

    /* ── PDF Page Frame for Brochure ── */
    .pdf-page-frame {
      border: 3.5px solid #1e3a8a;
      outline: 2px solid #d97706;
      outline-offset: 4px;
      border-radius: 14px;
      padding: 12px 16px;
      background: #ffffff;
      position: relative;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      min-height: 1000px;
    }

    /* ── VIP Cyber Emerald App Banner ── */
    .vip-banner-container {
      border: 2.5px solid #22c55e;
      outline: 2px solid #1e3a8a;
      border-radius: 14px;
      background: linear-gradient(135deg, #070d1a 0%, #0f1f4b 50%, #070d1a 100%);
      overflow: hidden;
      box-shadow: 0 8px 26px rgba(0,0,0,0.4), 0 0 16px rgba(34,197,94,0.35);
      box-sizing: border-box;
      padding: 6px 12px;
    }
    .vip-banner-flex {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .vip-left-info {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 3px;
      text-align: left;
    }
    .vip-chips-row {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .vip-right-visuals {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  
  <!-- ── 1. CERTIFICATE PAGE ── -->
  <div class="certificate-wrapper">
    <!-- Watermark -->
    <div class="watermark-bg">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Watermark Logo" />` : ''}
      <div class="watermark-text">TRINETRA ACADEMY</div>
    </div>

    <div class="corner-ornament corner-tl">❖</div>
    <div class="corner-ornament corner-tr">❖</div>
    <div class="corner-ornament corner-bl">❖</div>
    <div class="corner-ornament corner-br">❖</div>

    <!-- Header -->
    <div class="cert-header">
      <div style="width:58px; height:58px; border-radius:50%; border:2.5px solid #d97706; overflow:hidden; background:white; flex-shrink:0; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 10px rgba(217,119,6,0.2);">
        ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Logo" />` : `<span style="font-size:24px;">🏛️</span>`}
      </div>
      <div style="text-align:center; flex:1; padding:0 10px;">
        <div style="font-size:10.5px; font-weight:800; color:#d97706; letter-spacing:1px; text-transform:uppercase;">★ OFFICIAL ACADEMIC PROGRESS CERTIFICATE ★</div>
        <h1 style="margin:2px 0 0; color:#1e3a8a; font-size:20px; font-weight:900;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી</h1>
        <div style="font-size:10.5px; font-weight:800; color:#15803d; margin-top:1px;">✨ મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆</div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">TET-1 • TET-2 • TAT-S • TAT-HS • GPSC સ્પેશિયલ મોક ટેસ્ટ સિરીઝ મૂલ્યાંકન અહેવાલ</div>
      </div>
      <div class="gold-seal-badge">
        <div style="font-size:18px; line-height:1;">🎖️</div>
        <div style="font-size:8px; font-weight:900; color:#92400e; letter-spacing:0.5px; margin-top:2px;">VERIFIED</div>
        <div style="font-size:7.5px; font-weight:800; color:#1e3a8a;">TRINETRA</div>
        <div style="font-size:7px; color:#b45309; font-weight:900;">CERTIFIED</div>
      </div>
    </div>

    <!-- Student Info Strip -->
    <div class="meta-strip">
      <div><span style="color:#64748b;">વિદ્યાર્થી:</span> <strong style="color:#1e3a8a;">${student.name || 'વિદ્યાર્થી'}</strong></div>
      <div><span style="color:#64748b;">મોબાઈલ:</span> <strong>${student.mobile || '-'}</strong></div>
      <div><span style="color:#64748b;">સર્ટિ. ક્રમ:</span> <strong style="color:#d97706;">${certNumber}</strong></div>
      <div><span style="color:#64748b;">તારીખ:</span> <strong>${new Date().toLocaleDateString('gu-IN')}</strong></div>
    </div>

    <!-- 4 Stat Cards -->
    <div class="grid4">
      <div class="stat-card">
        <div style="font-size:11px; color:#64748b; font-weight:700;">કુલ કસોટીઓ</div>
        <div class="stat-num">${totalTests}</div>
      </div>
      <div class="stat-card">
        <div style="font-size:11px; color:#64748b; font-weight:700;">સરેરાશ સ્કોર</div>
        <div class="stat-num" style="color:${gradeColor};">${avgScore}%</div>
      </div>
      <div class="stat-card">
        <div style="font-size:11px; color:#64748b; font-weight:700;">ચોકસાઈ દર</div>
        <div class="stat-num">${accuracy}%</div>
      </div>
      <div class="stat-card" style="border-top-color:#d97706;">
        <div style="font-size:11px; color:#d97706; font-weight:800;">પરફ. ગ્રેડ</div>
        <div class="stat-num" style="font-size:15px; color:${gradeColor};">${overallGrade}</div>
      </div>
    </div>

    <!-- Bar Chart -->
    ${testTrendData.length > 0 ? `
      <div class="chart-box">
        <div style="font-weight:900; font-size:13px; color:#1e3a8a; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
          <span>📊 કસોટી-દર-કસોટી સ્કોર બાર ચાર્ટ (Test Progression Bar Chart)</span>
          <span style="font-size:10px; color:#64748b; font-weight:normal;">(ગુણ ટકાવારી %)</span>
        </div>
        <div style="width:100%; overflow-x:auto;">
          <svg width="100%" height="175" viewBox="0 0 ${svgWidth} 175" style="overflow:visible;">
            <line x1="25" y1="20" x2="${svgWidth - 10}" y2="20" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
            <text x="5" y="24" font-size="9" fill="#94a3b8" font-weight="700">100%</text>
            <line x1="25" y1="78" x2="${svgWidth - 10}" y2="78" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
            <text x="5" y="82" font-size="9" fill="#94a3b8" font-weight="700">50%</text>
            <line x1="25" y1="135" x2="${svgWidth - 10}" y2="135" stroke="#cbd5e1" stroke-width="1.5" />
            <text x="5" y="139" font-size="9" fill="#94a3b8" font-weight="700">0%</text>
            ${chartBars}
          </svg>
        </div>
      </div>
    ` : ''}

    <!-- Subject Table -->
    <h3 style="color:#1e3a8a; margin:10px 0 4px; font-size:13px; font-weight:900; display:flex; align-items:center; justify-content:space-between;">
      <span>📚 વિષયવાર પ્રગતિ અને ગુણ વિશ્લેષણ:</span>
      <span style="font-size:10.5px; color:#d97706; font-weight:800;">કુલ વિષયો: ${subjectAnalytics.length}</span>
    </h3>
    <table>
      <thead>
        <tr>
          <th>વિષય</th><th>કુલ પ.</th><th>ગુણ</th><th>ટકા</th><th>સ્થિતિ</th>
        </tr>
      </thead>
      <tbody>
        ${subjectAnalytics.map(s => `
          <tr>
            <td><strong>📚 ${s.subject}</strong></td>
            <td>${s.count}</td>
            <td>${s.totalScore}/${s.totalMax}</td>
            <td><strong style="color:${s.pct >= 70 ? '#166534' : s.pct >= 50 ? '#b45309' : '#991b1b'};">${s.pct}%</strong></td>
            <td><span style="font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px; background:${s.pct >= 70 ? '#dcfce7' : s.pct >= 50 ? '#fef3c7' : '#fee2e2'}; color:${s.pct >= 70 ? '#166534' : s.pct >= 50 ? '#b45309' : '#991b1b'};">${s.pct >= 70 ? '🟢 સબળ' : s.pct >= 50 ? '🟡 સરેરાશ' : '🔴 મહેનત'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Signature Footer -->
    <div style="margin-top:14px; border-top:1.5px dashed #cbd5e1; padding-top:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="flex:1; min-width:160px;">
        <div style="font-weight:900; color:#1e3a8a; font-size:12px;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી</div>
        <div style="font-size:10px; color:#64748b; margin-top:1px;">📞 <strong style="color:#1e40af;">8200405300</strong> | 🌐 <strong style="color:#2563eb;">trinetraacademy.in</strong></div>
        <div style="font-size:9.5px; color:#059669; font-weight:800; margin-top:1px;">✓ ડિજિટલ રીતે પ્રમાણિત મૂલ્યાંકન અહેવાલ</div>
      </div>
      <div style="display:flex; align-items:center; justify-content:center; margin:0 10px;">
        <div style="width:70px; height:70px; border-radius:50%; border:2px solid #1e3a8a; outline:1.5px dashed #d97706; outline-offset:2px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:radial-gradient(circle, #eff6ff 0%, #ffffff 100%); transform:rotate(-5deg);">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:22px; height:22px; border-radius:50%; object-fit:cover; border:1px solid #1e3a8a;" />` : '<span>🏛️</span>'}
          <div style="font-size:6px; font-weight:900; color:#1e3a8a; margin-top:1px;">TRINETRA</div>
          <div style="font-size:5.5px; font-weight:800; color:#d97706;">★ SEAL ★</div>
        </div>
      </div>
      <div style="text-align:center; min-width:150px;">
        <div style="font-family:'Brush Script MT',cursive; font-size:26px; font-weight:700; color:#1e3a8a; transform:rotate(-3deg); line-height:1;">Sunil Sir</div>
        <div style="border-top:1.5px solid #1e3a8a; margin-top:4px; padding-top:3px;">
          <div style="font-weight:900; font-size:11px; color:#1e3a8a;">સુનિલ સર (Sunil Sir)</div>
          <div style="font-size:9px; color:#d97706; font-weight:800;">Founder & Director</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 2. EXACT SCORECARD BROCHURE PAGE (Full Hero Poster + VIP App Banner + Social Links) ── -->
  <div class="pdf-page-frame" style="text-align: center; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box; padding: 12px 16px;">
    <!-- Watermark -->
    <div class="watermark-bg">
      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Watermark Logo" />` : ''}
      <div class="watermark-text">TRINETRA ACADEMY</div>
    </div>
    
    <!-- TOP: Brand Header -->
    <div style="flex-shrink: 0; margin-bottom: 4px;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid #d97706; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="font-size:16px;">🏛️</span>`}
        </div>
        <div>
          <h2 style="margin: 0; font-size: 16px; font-weight: 900; color: #1e3a8a; line-height: 1.2;">
            🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)
          </h2>
          <div style="font-size: 10px; font-weight: 800; color: #d97706; margin-top: 1px;">
            🌟 વિશેષ ટેસ્ટ સિરીઝ, લાઈવ બેચ & સ્પેશિયલ કોર્સ બ્રોશર 🌟
          </div>
        </div>
      </div>
    </div>

    <!-- CENTER HERO: Full Size Teacher Poster(s) -->
    <div style="flex: 1 1 auto; display: flex; align-items: center; justify-content: center; margin: 4px 0; min-height: 0; width: 100%;">
      ${displayPosters.length === 1 ? `
        <div style="width: 100%; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
          ${displayPosters[0].imageDataUrl ? `
            <img src="${displayPosters[0].imageDataUrl}" style="max-height: 720px; max-width: 100%; width: 100%; height: auto; object-fit: contain; display: block; border-radius: 8px;" alt="${displayPosters[0].title}" />
          ` : `
            <div style="padding: 40px; font-weight: 900; color: #1e3a8a; font-size: 18px;">${displayPosters[0].title}</div>
          `}
        </div>
      ` : displayPosters.length > 1 ? `
        <div class="brochure-posters-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%; margin: 0 auto; align-items: center;">
          ${displayPosters.map((p, idx) => `
            <div key="poster-${idx}" style="display: flex; align-items: center; justify-content: center; width: 100%;">
              ${p.imageDataUrl ? `
                <img src="${p.imageDataUrl}" style="max-height: 480px; max-width: 100%; width: 100%; object-fit: contain; display: block; border-radius: 8px;" alt="${p.title}" />
              ` : `
                <div style="padding: 20px; font-weight: 800; color: #1e3a8a;">${p.title}</div>
              `}
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="width: 100%; padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px dashed #16a34a; border-radius: 12px; text-align: center;">
          <div style="font-size: 15px; font-weight: 900; color: #15803d;">🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી - શિક્ષણ સેવા તૈયારી મંચ</div>
          <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 4px;">TET-1, TET-2, TAT (Sec/Higher Sec) & શૈક્ષણિક ભરતી સ્પેશિયલ ઓનલાઈન મોક ટેસ્ટ સિરીઝ</div>
        </div>
      `}
    </div>

    <!-- BOTTOM STACK: App Banner + Social Media + Helpline Slogan -->
    <div style="flex-shrink: 0; display: flex; flex-direction: column; gap: 5px; margin-top: 4px;">
      
      <!-- VIP Cyber Emerald App Download Banner -->
      <div class="vip-banner-container" style="padding: 6px 12px; margin-bottom: 0;">
        <div class="vip-banner-flex">
          
          <!-- Left info -->
          <div class="vip-left-info" style="gap: 3px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
              <span style="background: linear-gradient(135deg, #15803d, #22c55e); color: #ffffff; font-size: 7px; font-weight: 900; padding: 1.5px 5px; border-radius: 4px; text-transform: uppercase;">⭐ OFFICIAL APP</span>
              <span style="color: #4ade80; font-size: 11.5px; font-weight: 900;">📲 ત્રિનેત્ર એકેડેમી Android App</span>
              <span style="color: #fbbf24; font-size: 8px; font-weight: 800;">(⭐⭐⭐⭐⭐ 4.9★ • 10K+ Students)</span>
            </div>

            <div class="vip-chips-row" style="gap: 4px;">
              <span style="background: rgba(34,197,94,0.18); border: 1px solid #22c55e; color: #86efac; font-size: 7px; font-weight: 800; padding: 1px 5px; border-radius: 12px;">✓ લાઈવ & રેકોર્ડેડ ક્લાસ</span>
              <span style="background: rgba(56,189,248,0.18); border: 1px solid #38bdf8; color: #7dd3fc; font-size: 7px; font-weight: 800; padding: 1px 5px; border-radius: 12px;">✓ ૫૦૦૦+ પ્રશ્નો મોક ટેસ્ટ</span>
              <span style="background: rgba(245,158,11,0.18); border: 1px solid #f59e0b; color: #fde68a; font-size: 7px; font-weight: 800; padding: 1px 5px; border-radius: 12px;">✓ PDF મટીરીયલ</span>
            </div>

            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: block; margin-top: 1px;">
              <div style="background: rgba(0,0,0,0.55); border-radius: 6px; padding: 3px 8px; display: flex; align-items: center; justify-content: space-between; gap: 6px; border: 1px solid rgba(255,255,255,0.15);">
                <div style="display: flex; align-items: center; gap: 5px;">
                  <div style="background: #ffffff; border-radius: 3px; padding: 1.5px 4px; display: flex; align-items: center; gap: 3px;">
                    <span style="font-size: 8px; color: #2563eb;">▶</span>
                    <div style="text-align: left; line-height: 1;">
                      <div style="font-size: 4px; font-weight: 800; color: #64748b;">GET IT ON</div>
                      <div style="font-size: 6.5px; font-weight: 900; color: #0f172a;">Google Play</div>
                    </div>
                  </div>
                  <div style="color: #ffffff; font-size: 8.5px; font-weight: 800;">
                    Trinetra online <span style="color: #38bdf8;">Download Our App</span>
                  </div>
                </div>
                <div style="font-size: 7.5px; color: #4ade80; font-weight: 800; text-decoration: underline;">
                  play.google.com ➔
                </div>
              </div>
            </a>
          </div>

          <!-- Center Glowing Arrow with Real Asset Image -->
          <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin: 0 4px;">
            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: inline-block;">
              ${greenArrowDataUrl ? `
                <img src="${greenArrowDataUrl}" style="height: 46px; width: auto; max-width: 120px; object-fit: contain; display: block;" alt="Click Here to Download App" />
              ` : `
                <svg width="90" height="36" viewBox="0 0 105 42" fill="none">
                  <path d="M4 21H80M80 21L64 8M80 21L64 34" stroke="#00ff87" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
                  <text x="6" y="16" fill="#00ff87" font-size="12" font-weight="900">CLICK</text>
                  <text x="6" y="32" fill="#00ff87" font-size="12" font-weight="900">HERE</text>
                </svg>
              `}
            </a>
          </div>

          <!-- Right Visuals (Phone + QR Code) -->
          <div class="vip-right-visuals" style="gap: 6px;">
            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: block;">
              <div style="border: 2px solid #0f172a; outline: 1px solid #22c55e; border-radius: 10px; width: 50px; height: 76px; background: #ffffff; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: space-between; padding: 2px; box-sizing: border-box; flex-shrink: 0;">
                <div style="font-size: 5px; font-weight: 900; color: #1e3a8a; line-height: 1.1;">Download<br/>App</div>
                <div style="width: 17px; height: 17px; border-radius: 50%; border: 1px solid #d97706; margin: 0 auto; overflow: hidden;">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="font-size:9px;">🏛️</span>`}
                </div>
                <div style="font-size: 4.5px; font-weight: 900; color: #0f172a;">Trinetra Online</div>
                <div style="background: #15803d; color: #ffffff; font-size: 4px; font-weight: 900; padding: 1px; border-radius: 2px;">⬇ GET APP</div>
              </div>
            </a>

            <a href="${APP_PLAY_STORE_URL}" target="_blank" style="text-decoration: none; display: block;">
              <div style="background: #ffffff; padding: 2.5px 3.5px; border-radius: 8px; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,0.25); border: 1.5px solid #22c55e; flex-shrink: 0;">
                ${qrDataUrl ? `
                  <img src="${qrDataUrl}" style="width: 44px; height: 44px; display: block; border-radius: 2px; margin: 0 auto;" alt="App QR Code" />
                ` : `
                  <div style="width:44px; height:44px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:6px; color:#64748b;">QR</div>
                `}
                <div style="font-size: 5px; font-weight: 900; color: #1e3a8a; margin-top: 1px; white-space: nowrap;">📷 SCAN ME</div>
              </div>
            </a>
          </div>

        </div>
      </div>

      <!-- Social Media Strip -->
      <div style="padding: 4px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
        <div style="font-size: 9.5px; font-weight: 800; color: #1e3a8a; display: flex; align-items: center; gap: 3px;">
          🌐 સત્તાવાર ચેનલ સાથે જોડાવો:
        </div>
        <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
          <a href="https://youtube.com/@trinetra_academy100?si=o40zQ7nNp8bMptcU" target="_blank" style="background: #ef4444; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">▶ YouTube</a>
          <a href="https://t.me/Trinetra_Online" target="_blank" style="background: #0284c7; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">✈ Telegram</a>
          <a href="https://www.instagram.com/trinetra_online_academy?igsh=d2JqYmE4eWNsNmts" target="_blank" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">📷 Instagram</a>
          <a href="https://wa.me/918200405300" target="_blank" style="background: #16a34a; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">💬 WhatsApp</a>
          <a href="https://trinetraacademy.in" target="_blank" style="background: #1e3a8a; color: white; padding: 2.5px 7px; border-radius: 5px; font-size: 8.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">🌐 Website</a>
        </div>
      </div>

      <!-- Bottom Slogan -->
      <div style="padding-top: 3px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 9.5px; font-weight: 800; color: #1e3a8a;">
          🎯 મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆
        </div>
        <div style="font-size: 8.5px; color:#64748b;">
          Helpline: <strong>8200405300</strong> • <strong>trinetraacademy.in</strong>
        </div>
      </div>

    </div>

  </div>

</body>
</html>`;
}

/**
 * Generate Pragati Report (Progress Certificate) PDF buffer using Puppeteer
 */
async function generatePragatiReportPDFBuffer(data) {
  let browser = null;
  try {
    const html = await buildPragatiReportHTML(data);

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 18000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });

    await browser.close();
    browser = null;
    return Buffer.from(pdfBuffer);
  } catch (err) {
    if (browser) { try { await browser.close(); } catch(e) {} }
    console.error('Pragati Report PDF Error:', err);
    throw err;
  }
}


