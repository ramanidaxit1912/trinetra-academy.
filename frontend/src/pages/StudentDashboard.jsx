import { formatMathText } from '../utils/mathFormatter';

// ─── Smart Indian Mobile & Advanced Anti-Fake Combinations Filter ──
function validateIndianMobile(rawMobile) {
  if (!rawMobile) return { isValid: false, message: 'કૃપા કરીને ૧૦ આંકડાનો મોબાઈલ નંબર દાખલ કરો.' };
  const cleaned = String(rawMobile).replace(/\D/g, '').replace(/^(91|0)/, '');
  if (cleaned.length !== 10) {
    return { isValid: false, message: 'કૃપા કરીને પૂરા ૧૦ આંકડાનો મોબાઈલ નંબર દાખલ કરો.' };
  }
  if (!/^[6-9]/.test(cleaned)) {
    return { isValid: false, message: 'ભારતીય મોબાઈલ નંબર ૬, ૭, ૮ કે ૯ થી જ શરૂ થવો જોઈએ.' };
  }

  // 1. Minimum 4 distinct digits required (blocks 6556666555, 9898989898, 9191919191, etc.)
  const uniqueDigits = new Set(cleaned.split(''));
  if (uniqueDigits.size < 4) {
    return { isValid: false, message: 'આ ડમી કોમ્બિનેશન અમાન્ય છે. તમારો સાચો નંબર લખો.' };
  }

  // 2. No single digit should repeat 6 or more times
  const counts = {};
  for (const d of cleaned) counts[d] = (counts[d] || 0) + 1;
  if (Object.values(counts).some(c => c >= 6)) {
    return { isValid: false, message: 'આ ડમી નંબર અમાન્ય છે. તમારો સાચો વ્યક્તિગત નંબર લખો.' };
  }

  // 3. No 5 identical digits in a row (e.g. 99999, 66666)
  if (/(\d)\1{4,}/.test(cleaned)) {
    return { isValid: false, message: 'આ ડમી નંબર અમાન્ય છે. સળંગ રિપીટ થતા આંકડા માન્ય નથી.' };
  }

  // 4. No 2-digit alternating repeating pattern (e.g. 9898989898, 6565656565)
  if (/^(\d{2})\1{4}$/.test(cleaned)) {
    return { isValid: false, message: 'આ ડમી પેટર્ન અમાન્ય છે. તમારો સાચો નંબર લખો.' };
  }

  // 5. Common dummy sequences
  const dummySequences = ['1234567890', '9876543210', '0123456789', '9876501234', '0987654321', '1122334455', '5544332211'];
  if (dummySequences.includes(cleaned)) {
    return { isValid: false, message: 'આ ડમી નંબર અમાન્ય છે. તમારો સાચો વ્યક્તિગત નંબર લખો.' };
  }

  return { isValid: true, cleaned, message: '✓ માન્ય મોબાઈલ નંબર' };
}

// ─── Student Name Anti-Fake Check ─────────────────────────────
function validateStudentName(rawName) {
  if (!rawName || rawName.trim().length < 3) {
    return { isValid: false, message: 'કૃપા કરીને તમારું સાચું પૂરું નામ લખો (ઓછામાં ઓછા 3 અક્ષર).' };
  }
  const cleanName = rawName.trim().toLowerCase().replace(/\s/g, '');
  if (new Set(cleanName.split('')).size <= 1) {
    return { isValid: false, message: 'કૃપા કરીને તમારું સાચું પૂરું નામ લખો (ફેક અક્ષરો માન્ય નથી).' };
  }
  return { isValid: true, cleanName: rawName.trim() };
}

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useStore } from '../store/useStore';
import { downloadHtmlAsPdf } from '../utils/pdfDownloader';
import { AchievementBadges, ConfettiCanvas } from '../components/ConfettiBadges';
import {
  sendOTP, verifyOTP, getQuestions, getMySubmissions, getStudentHistoryByMobile,
  getSubmissionReview, getLeaderboard, getTestWiseLeaderboard, getMaterials, getMarketingItems,
  sendWhatsAppScorecard,
  sendPragatiWhatsApp
} from '../services/api';
import { LeaderboardUI } from '../components/Leaderboard';
import {
  GraduationCap, Play, Eye, Award, CheckCircle, XCircle, Clock,
  BookOpen, BarChart2, ArrowRight, RefreshCw, FileText, Image as ImageIcon,
  Check, X, AlertCircle, LogOut, ChevronRight, Download, Sparkles,
  Phone, MessageSquare, HelpCircle, FileCheck, Send, ExternalLink, Bookmark,
  Search, SlidersHorizontal, TrendingUp, CheckCircle2, Smartphone
} from 'lucide-react';



const playAppUrl = 'https://play.google.com/store/apps/details?id=co.bolton.unhnx';

/* ─── Build Royal Spotlight Marketing Brochure with App Link & QR Code ───── */
function buildMarketingBrochureHtml(marketingItems = []) {
  if (!marketingItems || marketingItems.length === 0) return '';
  
  // Deduplicate posters with identical imageUrl
  const seenUrls = new Set();
  const uniqueItems = [];
  marketingItems.forEach(item => {
    const url = item.imageUrl || item.image;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniqueItems.push(item);
    }
  });

  const displayItems = (uniqueItems.length > 0 ? uniqueItems : marketingItems).slice(0, 4);
  const origin = window.location.origin;
  const logoUrl = `${origin}/images/logo.jpg`;
  const playAppUrl = 'https://play.google.com/store/apps/details?id=co.bolton.unhnx';

  return `
    <div class="brochure-page" style="page-break-before: always; break-before: page; page-break-inside: avoid; break-inside: avoid; margin-top: 14px; position: relative; z-index: 2; background: #ffffff; box-sizing: border-box;">
      
      <!-- 👑 ROYAL NAVY-GOLD OUTER CERTIFIED BROCHURE FRAME 👑 -->
      <div class="brochure-outer-frame" style="border: 3px solid #1e3a8a; outline: 2px solid #d97706; outline-offset: 4px; border-radius: 14px; padding: 14px 18px; background: #ffffff; box-sizing: border-box; position: relative;">
        
        <!-- Royal Header -->
        <div class="brochure-header-box" style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 3px; flex-wrap: wrap;">
            <div style="width: 38px; height: 38px; border-radius: 50%; border: 2px solid #d97706; overflow: hidden; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 8px rgba(217,119,6,0.25);">
              <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=TA&background=1e3a8a&color=fff'" alt="Logo" />
            </div>
            <div>
              <div style="font-size: 18px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.2px;">
                🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી (Trinetra Online Academy)
              </div>
            </div>
          </div>
          <div style="font-size: 11.5px; font-weight: 800; color: #d97706; letter-spacing: 0.5px;">
            🌟 વિશેષ ટેસ્ટ સિરીઝ, લાઈવ બેચ & સ્પેશિયલ કોર્સ બ્રોશર 🌟
          </div>
          <div style="font-size: 10px; color: #475569; margin-top: 2px;">
            📞 WhatsApp / Call: <strong style="color: #1e3a8a; font-size: 11px;">8200405300</strong> &nbsp;|&nbsp; 🌐 <strong style="color: #2563eb;">trinetraacademy.in</strong>
          </div>
        </div>

        <!-- 🌟 POSTERS GRID: LAPTOP 2-COLS, MOBILE 1-COL 🌟 -->
        <div class="brochure-posters-grid" style="display: flex; align-items: center; justify-content: center; width: 100%; margin: 8px 0;">
          ${displayItems.map((p) => {
            const rawImg = p.imageUrl || p.image;
            const fullImg = rawImg ? (rawImg.startsWith('http') ? rawImg : `${origin}${rawImg}`) : null;
            const isSingle = displayItems.length === 1;
            const posterMaxHeight = isSingle ? '680px' : displayItems.length === 2 ? '440px' : '260px';

            return `
              <div class="brochure-poster-item" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; page-break-inside: avoid; break-inside: avoid;">
                ${fullImg ? `
                  <div style="position: relative; border-radius: 8px; overflow: hidden; background: #ffffff; width: 100%; text-align: center; display: flex; align-items: center; justify-content: center;">
                    <img src="${fullImg}" class="brochure-poster-img" style="max-height: ${posterMaxHeight}; max-width: 100%; width: 100%; height: auto; object-fit: contain; display: block; margin: 0 auto; border-radius: 8px;" alt="${p.title || 'Course Poster'}" />
                  </div>
                ` : `
                  <div style="color: #64748b; font-size: 13px; font-weight: 800; padding: 24px; text-align: center; border: 2px dashed #cbd5e1; border-radius: 10px; width: 100%;">
                    ${p.title || 'સ્પેશિયલ કોર્સ પોસ્ટર'}
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>

        <!-- 📲 👑 DUAL-OPTIMIZED (LAPTOP WIDE HORIZONTAL & MOBILE ADAPTIVE) VIP APP BANNER 👑 📲 -->
        <style>
          @keyframes greenArrowPulse {
            0%, 100% {
              filter: drop-shadow(0 0 4px #059669) drop-shadow(0 0 10px #10b981);
              transform: scale(0.96);
              opacity: 0.82;
            }
            50% {
              filter: drop-shadow(0 0 16px #6ee7b7) drop-shadow(0 0 28px #00ff87) drop-shadow(0 0 40px #22c55e);
              transform: scale(1.05);
              opacity: 1;
            }
          }
          .green-pulsing-arrow {
            animation: greenArrowPulse 1.6s infinite ease-in-out;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          /* Default Desktop / Laptop (Wide Horizontal 3-Section Layout) */
          .brochure-posters-grid {
            display: grid;
            grid-template-columns: ${displayItems.length === 1 ? '1fr' : 'repeat(2, 1fr)'};
            gap: 14px;
            margin-bottom: 12px;
            justify-items: center;
            align-items: center;
          }

          .vip-banner-container {
            border: 2.5px solid #22c55e;
            outline: 2px solid #1e3a8a;
            border-radius: 14px;
            background: linear-gradient(135deg, #070d1a 0%, #0f1f4b 50%, #070d1a 100%);
            overflow: hidden;
            margin-bottom: 12px;
            box-shadow: 0 8px 26px rgba(0,0,0,0.4), 0 0 16px rgba(34,197,94,0.35);
            box-sizing: border-box;
            padding: 10px 14px;
          }

          .vip-banner-flex {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .vip-left-info {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 220px;
          }

          .vip-arrow-wrapper {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin: 0 4px;
          }

          .vip-arrow-img {
            height: 62px;
            width: auto;
            max-width: 200px;
            object-fit: contain;
            display: block;
          }

          .vip-right-visuals {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }

          .vip-phone-frame {
            border: 3.5px solid #0f172a;
            outline: 1.5px solid #22c55e;
            border-radius: 16px;
            width: 70px;
            height: 110px;
            background: #ffffff;
            text-align: center;
            box-shadow: 0 6px 18px rgba(0,0,0,0.4), 0 0 14px rgba(34,197,94,0.35);
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 4px 3px 4px 3px;
            box-sizing: border-box;
            flex-shrink: 0;
          }

          .vip-qr-frame {
            background: #ffffff;
            padding: 4px 6px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 14px rgba(0,0,0,0.3);
            border: 2px solid #22c55e;
            flex-shrink: 0;
          }

          .vip-qr-img {
            width: 64px;
            height: 64px;
            display: block;
            border-radius: 4px;
            margin: 0 auto;
          }

          /* 📱 Responsive Adaptations for Mobile Phones (<= 680px) 📱 */
          @media (max-width: 680px) {
            .brochure-outer-frame {
              padding: 10px 8px !important;
              outline-offset: 2px !important;
            }
            .brochure-posters-grid {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }
            .brochure-poster-img {
              max-height: 280px !important;
            }
            .vip-banner-container {
              padding: 10px 8px !important;
            }
            .vip-banner-flex {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 8px !important;
            }
            .vip-left-info {
              width: 100% !important;
              text-align: center !important;
              align-items: center !important;
            }
            .vip-header-title-row {
              justify-content: center !important;
            }
            .vip-chips-row {
              justify-content: center !important;
            }
            .vip-mobile-visuals-row {
              display: flex !important;
              align-items: center !important;
              justify-content: space-around !important;
              gap: 6px !important;
              margin: 4px 0 !important;
              width: 100% !important;
            }
            .vip-arrow-img {
              height: 44px !important;
              max-width: 115px !important;
            }
            .vip-phone-frame {
              width: 58px !important;
              height: 94px !important;
            }
            .vip-qr-frame {
              padding: 3px 4px !important;
            }
            .vip-qr-img {
              width: 48px !important;
              height: 48px !important;
            }
          }
        </style>

        <div class="vip-banner-container">
          <div class="vip-banner-flex">
            
            <!-- Left Section: App Titles + 4.9★ Trust Badge + Features + Play Store (Wide on Laptop) -->
            <div class="vip-left-info">
              
              <!-- Top Row: Badge & Main Title -->
              <div class="vip-header-title-row" style="display: flex; align-items: center; gap: 7px; flex-wrap: wrap;">
                <span style="background: linear-gradient(135deg, #15803d, #22c55e); color: #ffffff; font-size: 8.5px; font-weight: 900; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(34,197,94,0.4);">⭐ OFFICIAL APP</span>
                <span style="color: #4ade80; font-size: 13.5px; font-weight: 900; letter-spacing: 0.2px; text-shadow: 0 2px 8px rgba(74,222,128,0.3);">📲 ત્રિનેત્ર એકેડેમી Android App</span>
                <span style="color: #fbbf24; font-size: 9.5px; font-weight: 800;">(⭐⭐⭐⭐⭐ 4.9★ • 10K+ Students)</span>
              </div>

              <!-- Subtitle & 3 Highlights Chips -->
              <div class="vip-chips-row" style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 1px;">
                <span style="background: rgba(34,197,94,0.18); border: 1px solid #22c55e; color: #86efac; font-size: 8px; font-weight: 800; padding: 2px 6px; border-radius: 12px;">✓ લાઈવ & રેકોર્ડેડ ક્લાસ</span>
                <span style="background: rgba(56,189,248,0.18); border: 1px solid #38bdf8; color: #7dd3fc; font-size: 8px; font-weight: 800; padding: 2px 6px; border-radius: 12px;">✓ ૫૦૦૦+ પ્રશ્નો મોક ટેસ્ટ</span>
                <span style="background: rgba(245,158,11,0.18); border: 1px solid #f59e0b; color: #fde68a; font-size: 8px; font-weight: 800; padding: 2px 6px; border-radius: 12px;">✓ PDF મટીરીયલ</span>
              </div>

              <!-- Google Play Strip (Clickable) -->
              <a href="${playAppUrl}" target="_blank" rel="noreferrer" title="Google Play Store માં ખોલો" style="text-decoration: none; display: block; cursor: pointer; margin-top: 2px; width: 100%;">
                <div style="background: rgba(0,0,0,0.55); border-radius: 8px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid rgba(255,255,255,0.15);">
                  <div style="display: flex; align-items: center; gap: 7px;">
                    <div style="background: #ffffff; border-radius: 4px; padding: 2px 5px; display: flex; align-items: center; gap: 3px;">
                      <span style="font-size: 11px; color: #2563eb;">▶</span>
                      <div style="text-align: left; line-height: 1;">
                        <div style="font-size: 5.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">GET IT ON</div>
                        <div style="font-size: 8.5px; font-weight: 900; color: #0f172a;">Google Play</div>
                      </div>
                    </div>
                    <div style="color: #ffffff; font-size: 10px; font-weight: 800;">
                      Trinetra online <span style="color: #38bdf8;">Download Our App</span>
                    </div>
                  </div>
                  <div style="font-size: 8.5px; color: #4ade80; font-weight: 800; text-decoration: underline;">
                    play.google.com ➔
                  </div>
                </div>
              </a>

            </div>

            <!-- Middle on Laptop (or Showcase on Mobile): CLICK HERE Arrow -->
            <div class="vip-arrow-wrapper">
              <a href="${playAppUrl}" target="_blank" rel="noreferrer" title="એપ્લિકેશન ડાઉનલોડ કરવા CLICK HERE પર ક્લિક કરો" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
                <div class="green-pulsing-arrow" style="filter: drop-shadow(0 0 12px #00ff87) drop-shadow(0 0 22px #22c55e);">
                  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAIvCAYAAADqN6laAAJJdElEQVR4AezBW5Nd52Hm9//zvmvtvbtBkBRFiT6MPZJsCbe5zFUmU5OJ5LEnc5H7eJzYlRrPJBeGJdnx2OyusSxLFsbHzzK2Tq5KVSq5yBcwJdsUo7JsS6R4AtC9917rfYK1tggQpyYBECTQ/fx+GscRSdxKEhPbPEySeJhscxJJnEW2mUgiTi/bnEQSEY8q25xEEg/CNieRREQ8HLY5iSQiHle2mUgi4la2OYkkHqbCHUgiIiIiIiIiIk6PThInkcTjTBIRZ5UkIh5XkniYJBERHwxJREScRZL4IBVuIYmIiIiIiIiIOF0KEREREREREXHqFd5GEhERERERERFx+hQiIiIiIiIi4tQrRERERERERMSp10kizh5JRERERETEe0sSEY+qQkRERERERESceoWIiIiIiIiIOPUKEREREREREXHqFdvYJiIiIiIiIiJOr8KP2MY2EREREREREXH6dMQHyjYnkURERERERETEgypERERERERExKnXcQvbSCLeH5KIiIiIiIiIeNgKEREREREREXHqFSIiIiIiIiLi1CtERERERERExKlXiIiIiIiIiIhTrxARERERERERp15HREREnDm2OYkkIuL+2OYkkoiI+CAUIiIiIiIiIuLU63gHtplIIiIiIk4HScTDY5uJJOLskURE3B/bTCQR771CRERERERERJx6hYiIiIiIiIg49QoRERERERERceoVIiIiIiIiIuLUK0RERERERETEqVeIiIiIiIiIiFOvEBERERERERGnXkdEREREvKckERER904S8fAUIiIiIiIiIuLUK0RERERERETEqVeIiIiIiIiIiFOvEBERERERERGnXiEiIiIiIiIiTr1CRERERERERJx6hYiIiIiIiIg49ToiIiIiIiJ+xDYnkUREPJ4KEREREREREXHqdURERERERPyIJCLidCpERERERERExKlXiIiIiIiIiIhTrxARERERERERp15HRJxatjmJJCIiIiIi4mwoRERERERERMSp1/EOJBERjydJREREvNd+CBTg6TaChAejUmj1mNEjvZ+gjeAKrcG6bqiqrFgjRPMeE2vDTmNSxxWzLSCgAIKx22KbIwljnmRBRETcu0JERERExD2ogIDWGm4NSQzbLUMbkMTx0YZS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7oFVhQdbMHzrdKCUwtAV1qsVf+p7DlYHrA5GGkLdIdstfPev/pKJGBgYuDEegGC7XjProd+adTdA17HZGHNM5QaTrplZ2TLZ6haTNS832yyRxHVmm8uQxMvMNkskEddXISIiIiLiOWo0VnVFLTCOcLAGPjmFo5733/qZSimUWrDh5MRsVhseGz0iQdcxGxv0Y09XOhBgMKZvPRRYH1QoBfc9xggRERFnU2uNiSSugm0mkoj4PNtchiTi+rLNEknExdlmIomz2OZJkrhObPNVSGIf2WaJJOL6ss1lSCLiWWyzRBJxcbZZIol4eRUiIiIiIiIiYu91REREXJIkrhtJLLFNRETEy0YSsb8KERERlyCJiIiIiHjxdURERFyAJCIiziKJJbaJiIivXyEiIiIiIiIi9l5HRFwZ2yyRxHVmmyWSiGezzRJJRERExMvFNkskEXFRhYiIiIiIiIjYex2P2OYxSTwvkthntlkiiX1mm6skiX1mmyWSWGKbJZJ4kUliiW2WSGKJbZZI4mUmiaskiZeZbZZI4ipJ4jqRxD6xzRJJLLHNZUjiZWab68w2lyGJJbZZIokXmW0uQxL7TBKXYZslkojrqxARERERERERe68jLkUS8WySiKsjiXg2SUTE1ZNEPE0S8WySiIuTRMSzSCLiWQoRERERFySJiIiIeDl0RERERJyTJCIiIuLl0hERV0YSS2wTzyaJiIuSRER8MyQRcVGSiIir0RERz2SbJZKIiIuxzRJJRETEi8c2SyQRES+mQkRERERERETsvY6IS5DEPpPEVZJEvHxsM5FEXJwkIl5Ukoi4KEnsM0lchiQi4ptRiIiIiIiIiIi9V4iIiIiIiIiIvVeIiIiIiIiIiL1XiIiIiIiIiIi9V4iIiIiIiIiIvVeIiIiIiIiIiL1XiIiIiIiIiIi910kiIiK+OklERERERLxsChERERERERGx9woRERERERERsfc62yyRRERERERERES83AoRERERERERsfcKEREREREREbH3Or6EbZZIIiIi4vNss0QSEREREfH1KURERERERETE3ut4giQiIiKeB0lERERExIujEBERERERERF7rxARERERERERe6/wBNtERERERERExP4pfI5tIiIiIiIiImK/dJzBNo9JIiIiIiIiIiJebh0REdeUbZZIIiIivn62WSKJ68w2SyQREXGWQkRERERERETsvY5HJBERsQ9sM5HEEklERMSLRxLxbJKIiLiIQkRERERERETsvUJERERERERE7L1CREREREREROy9QkRERERERETsvUJERERERERE7L1CREREREREROy9QkRERERERETsvY5HbPOYJCLim2ebJZKIL5JERERERMTXzTYTSbyIChERERERERGx9zoi4oUliYiIiIiIiOehEBERERERERF7rxARERERERERe68QEREREREREXuvEBERERERERF7rxARERERERERe6+TRMTLyjYTScSLxzYTSUR8nm0mkrhObDORREREXD+2mUgi9o8kXmSFiIiIiIiIiNh7hYiIiIiIiIjYe4WIiIiIiIiI2Hsd15xtJpKI+LrY5kmSiIivh20mkoiI87HNRBJLbDORRJyfbSaSeBnZZiKJiJeNbSaS2EcdMbPNRBIRV8U2Z7HNRBIRcTVsExEXY5uLsM1EEnF+tplI4mVkm4kkIl42tplIYp90tlkiiSW2WSKJJbZ5kdkmnk0SS2yzRBJXyTZLJLHENpchicuwzRJJ7DPbLJHEEtsskcQS28Q3xzZLJHGd2WaJJL5JtlkiicuwzVWSxBLbLJHEEttchiSW2GaJJC7DNpdhm7g428Sz2eYqSWKJbS7DNkskcRm2uQxJLLHNEklchm3i2Wyz5P8Dl93HHBEG6RwAAAAASUVORK5CYII=" class="vip-arrow-img" alt="CLICK HERE ➔" />
                </div>
              </a>
            </div>

            <!-- Right on Laptop (or Showcase on Mobile): Phone Mockup + QR Code -->
            <div class="vip-right-visuals">
              
              <!-- Realistic Smartphone Mockup -->
              <a href="${playAppUrl}" target="_blank" rel="noreferrer" title="એપ ઇન્સ્ટોલ કરવા ફોન પર ટચ કરો" style="text-decoration: none; display: block; cursor: pointer; flex-shrink: 0;">
                <div class="vip-phone-frame">
                  <div style="width: 20px; height: 3px; background: #0f172a; border-radius: 3px; margin: 0 auto;"></div>
                  <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div style="font-size: 7.5px; font-weight: 900; color: #b91c1c; line-height: 1.05; margin-bottom: 2px;">
                      Download<br/>Our App
                    </div>
                    <div style="width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #22c55e; overflow: hidden; margin: 1px auto; background: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(34,197,94,0.25);">
                      <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain;" alt="Logo" />
                    </div>
                    <div style="font-size: 6px; font-weight: 900; color: #1e3a8a; margin-top: 1px;">
                      Trinetra Online
                    </div>
                  </div>
                  <div style="background: #004d40; border: 1px solid #22c55e; color: #ffffff; font-size: 5.8px; font-weight: 900; padding: 2px 3px; border-radius: 8px; margin: 0 auto; width: 92%; display: flex; align-items: center; justify-content: center; gap: 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.2);">
                    <span>⬇</span> DOWNLOAD
                  </div>
                  <div style="width: 16px; height: 2px; background: #cbd5e1; border-radius: 2px; margin: 2px auto 0 auto;"></div>
                </div>
              </a>

              <!-- Scannable QR Code Card -->
              <a href="${playAppUrl}" target="_blank" rel="noreferrer" title="QR Code પર ક્લિક કરીને સીધું એપ પેજ ખોલો" style="text-decoration: none; display: block; cursor: pointer; flex-shrink: 0;">
                <div class="vip-qr-frame">
                  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEX///8AAABVwtN+AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAB2klEQVRYhc2YMbLCMAxExaRI6SNwlFyMiZPJxXyUHCFlCg/6u1Jg4PfYchPQSyEsa7VGpNFKinXIcORTMj8/5e6hZmQRhKfhuKkuqVQkdbdQBLKqbge+z4xMeuC5qQYiiGTdkX1NegYjUuWm+yMh8v/39CRe7ZqeVmXV9fw+B78ndvBx3uYRuZWaQD67pCe5FhpBhPvG59fqSJg1alhtZ5V96tlHIPwkPGfUN1T93a8RSGZfFtM3ppqWEb/Csu5PuIPib1RWXU1TpCFBRKli88ieYG571hKC8Jwha9sn9IKpP0LX1OxNWEP055PKWhAZMQX4ZgCi1NoJ2mFVxxsjZGSSCERurLaYrg2stuqeLetmJFNcoRCc29YJyDUVU4reBJPo7cUwv1lTUNPe7gQaAvWi3znZEwM1d3ipS2cCv7MP10THZPqodgBy9cLhR8+8f/Vq9ycLNWPy+wjvJ9AQ8Vnfjtitg288mNNM9VcJQVhTLe53UEvzjZzjAYgv1DSbw6e/9r4NQN7+mhpC7cCE3+jJIhDfSfpE6wFoL4aEtiTr5b3M73BSMVfzFFGIqX1mtrM5/VCEN0r+J5DsRnmpf2/iLgNjnRNK7LkkjUG8F14aYtOgitQIpNH6A7FlJoNzUKO3AAAAAElFTkSuQmCC" class="vip-qr-img" alt="App QR Code" />
                  <div style="font-size: 6.8px; font-weight: 900; color: #1e3a8a; margin-top: 3px; white-space: nowrap;">📷 SCAN TO INSTALL</div>
                </div>
              </a>

            </div>

          </div>
        </div>

        <!-- Compact Footer -->
        <div style="text-align: center; border-top: 1.5px dashed #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b;">
          <div style="font-weight: 800; color: #1e3a8a; font-size: 11px;">
            🎯 મહેનત તમારી, માર્ગદર્શન અમારું — સફળતા તમારી! 🏆
          </div>
          <div style="margin-top: 2px;">
            સરકારી શિક્ષક ભરતી પરીક્ષા માર્ગદર્શન કેન્દ્ર • Helpline: <strong>8200405300</strong> • Website: <strong>trinetraacademy.in</strong>
          </div>
        </div>

      </div>
    </div>
  `;
}

const isImg = (val) => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return (
    s.startsWith('data:image/') ||
    s.startsWith('blob:') ||
    s.includes(';base64,') ||
    /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(s) ||
    /^https?:\/\/.*\.(png|jpg|jpeg|gif|webp|svg)/i.test(s) ||
    s.startsWith('<img')
  );
};

const extractImgSrc = (val) => {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (s.startsWith('<img')) {
    const m = s.match(/src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }
  return s;
};

// Circular Radial Gauge for visually stunning score presentation
function CircularScoreGauge({ score, total, percentage }) {
  const pct = Math.min(100, Math.max(0, percentage || 0));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  let strokeColor = '#ef4444'; // Red <45%
  let bgTrackColor = '#fee2e2';
  let statusEmoji = '📖';

  if (pct >= 85) {
    strokeColor = '#059669'; // Emerald Green
    bgTrackColor = '#dcfce7';
    statusEmoji = '👑';
  } else if (pct >= 65) {
    strokeColor = '#2563eb'; // Royal Blue
    bgTrackColor = '#dbeafe';
    statusEmoji = '🌟';
  } else if (pct >= 45) {
    strokeColor = '#d97706'; // Amber Orange
    bgTrackColor = '#fef3c7';
    statusEmoji = '🎯';
  }

  return (
    <div style={{ position: 'relative', width: 78, height: 78, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="78" height="78" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background Track Circle */}
        <circle
          cx="39"
          cy="39"
          r={radius}
          stroke={bgTrackColor}
          strokeWidth="6.5"
          fill="transparent"
        />
        {/* Animated Score Progress Arc */}
        <circle
          cx="39"
          cy="39"
          r={radius}
          stroke={strokeColor}
          strokeWidth="6.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      {/* Center Percentage & Score */}
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: strokeColor, marginTop: 1 }}>{score}/{total}</span>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'live',            label: 'લાઈવ કસોટીઓ',             icon: '🔴' },
  { id: 'results',         label: 'મારી કસોટીઓ & રિઝલ્ટ',    icon: '📜', hasBadge: true },
  { id: 'analytics',       label: 'પ્રગતિ એનાલિટિક્સ',       icon: '📊' },
  { id: 'leaderboard',     label: 'લીડરબોર્ડ',               icon: '🏆' },
  { id: 'materials',       label: 'સ્ટડી મટીરીયલ',           icon: '📁' },
  { id: 'teacher_support', label: 'શિક્ષક સહાય',              icon: '💭' },
];

// Sample Study Materials for competitive exam students
const STUDY_MATERIALS = [
  {
    id: 1,
    title: 'TET-2 / TAT વિજ્ઞાન અને ટેકનોલોજી મોડેલ પેપર (PDF)',
    subject: 'વિજ્ઞાન (Science)',
    size: '2.4 MB',
    type: 'Model Paper',
    description: 'ધોરણ ૬ થી ૮ વિજ્ઞાનના તમામ મહત્વપૂર્ણ પ્રકરણોના MCQ અને જવાબો.',
    tag: 'TET-2 Special'
  },
  {
    id: 2,
    title: 'ગુજરાતી વ્યાકરણ & સાહિત્ય શોર્ટ નોટ્સ',
    subject: 'ગુજરાતી (Gujarati)',
    size: '1.8 MB',
    type: 'Revision Notes',
    description: 'સંધિ, સમાસ, અલંકાર, છંદ અને સાહિત્યકારોની યાદી ૧૦ મિનિટમાં રિવિઝન માટે.',
    tag: 'Quick Revision'
  },
  {
    id: 3,
    title: 'શૈક્ષણિક મનોવિજ્ઞાન અને બાળવિકાસ (Child Pedagogy)',
    subject: 'મનોવિજ્ઞાન (Psychology)',
    size: '3.1 MB',
    type: 'Theory Notes',
    description: 'પિયાજે, વાયગોત્સ્કી અને કોહલબર્ગના સિદ્ધાંતોનું ગુજરાતીમાં વિશ્લેષણ.',
    tag: 'Must Read'
  },
  {
    id: 4,
    title: 'ગણિત શોર્ટકટ ટ્રીક્સ & સૂત્રોની બુકલેટ',
    subject: 'ગણિત (Maths)',
    size: '1.5 MB',
    type: 'Formula Sheet',
    description: 'ટકાવારી, સાદું વ્યાજ, નફો-ખોટ અને ક્ષેત્રફળના ઝડપી દાખલા ગણવાની રીતો.',
    tag: 'Formulas'
  },
  {
    id: 5,
    title: 'સામાન્ય જ્ઞાન & કરંટ અફેર્સ (Gujarat Special)',
    subject: 'સામાન્ય જ્ઞાન (GK)',
    size: '2.8 MB',
    type: 'Current Affairs',
    description: 'ગુજરાતનો ઇતિહાસ, ભૂગોળ અને બંધારણના અગત્યના ૨૦૦ પ્રશ્નો.',
    tag: 'General Knowledge'
  },
];

export default function StudentDashboard() {
  const { user, loginStudent, logout, startExam } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Authentication state for unlogged students
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'otp'
  const [mobile, setMobile]     = useState('');
  const [name, setName]         = useState('');
  const [otp, setOtp]           = useState('');
  const [devOtp, setDevOtp]     = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [authError, setAuthError]     = useState('');
  const [isThorAnimating, setIsThorAnimating] = useState(false);
  const [isOtpSuccessAnimating, setIsOtpSuccessAnimating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 🔒 Cinematic Student Logout & Redirect
  const handleAnimatedLogout = () => {
    setIsLoggingOut(true);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      }
    } catch (e) {}

    setTimeout(() => {
      logout();
      window.location.href = '/';
    }, 1550);
  };
  // ─── 🔊 Web Audio API Procedural Sound Synthesizer (No external audio files needed!) ──
  const playCinematicSound = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'sparkle') {
        // ✨ Wwoosh & High Chime Sparkle Sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.35); // D6
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'supernova') {
        // 💥 Deep Cosmic Bass Boom + Victory Chimes (Forte)
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = 'triangle';
        bass.frequency.setValueAtTime(150, ctx.currentTime);
        bass.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
        bassGain.gain.setValueAtTime(0.35, ctx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        bass.connect(bassGain);
        bassGain.connect(ctx.destination);
        bass.start();
        bass.stop(ctx.currentTime + 0.9);

        // Major Triad Arpeggio Chime (C - E - G - C)
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const chime = ctx.createOscillator();
          const chimeGain = ctx.createGain();
          chime.type = 'sine';
          chime.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          chimeGain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
          chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
          chime.connect(chimeGain);
          chimeGain.connect(ctx.destination);
          chime.start(ctx.currentTime + i * 0.12);
          chime.stop(ctx.currentTime + i * 0.12 + 0.6);
        });
      } else if (type === 'slide_whoosh') {
        // 📄 PowerPoint Smooth Paper Slide Whoosh Sound FX
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.28);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch (e) {
      console.warn('Audio FX error:', e);
    }
  };

  // 3D Tilt Card State
  const [tiltStyle, setTiltStyle] = useState({ transform: 'rotateX(0deg) rotateY(0deg)' });
  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotateX = -(y / (rect.height / 2)) * 6; // Max 6 deg tilt
    const rotateY = (x / (rect.width / 2)) * 6;
    setTiltStyle({ transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)` });
  };
  const handleCardMouseLeave = () => {
    setTiltStyle({ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)' });
  };

  // Cursor Star Particle Trail State
  const [cursorDots, setCursorDots] = useState([]);
  const handleGlobalMouseMove = (e) => {
    if (Math.random() > 0.4) return; // Throttled for ultra smooth 60fps
    const newDot = {
      id: Date.now() + Math.random(),
      x: e.clientX,
      y: e.clientY,
      size: Math.floor(Math.random() * 8) + 6,
      color: ['#fbbf24', '#38bdf8', '#ffffff', '#f59e0b', '#34d399'][Math.floor(Math.random() * 5)]
    };
    setCursorDots(prev => [...prev.slice(-15), newDot]);
  };

  // Dashboard state
  const [activeTab, setActiveTab]         = useState(() => searchParams.get('tab') || 'live');
  const [liveTests, setLiveTests]         = useState([]);
  const [submissions, setSubmissions]     = useState([]);
  const [leaderboard, setLeaderboard]     = useState([]);
  const [testWiseLeaderboard, setTestWiseLeaderboard] = useState([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  // Results tab Search, Subject Filter & Sorting
  const [resultSearch, setResultSearch]               = useState('');
  const [resultSubjectFilter, setResultSubjectFilter] = useState('all');
  const [resultSortBy, setResultSortBy]               = useState('latest'); // 'latest' | 'score_high' | 'score_low'
  const [downloadPopup, setDownloadPopup]             = useState(null); // { filename, type } or null
  const [downloadingScorecardId, setDownloadingScorecardId] = useState(null);
  const [sendingWaSubId, setSendingWaSubId]           = useState(null);
  const [waModalSub, setWaModalSub]                   = useState(null);
  const [waTargetMobile, setWaTargetMobile]           = useState('');
  const [waSuccessModal, setWaSuccessModal]           = useState(null);
  const [sendingPragatiWa, setSendingPragatiWa]       = useState(false);

  // Extract unique subjects from student's submissions
  const uniqueSubjects = useMemo(() => {
    const set = new Set(submissions.map(s => s.subject).filter(Boolean));
    return Array.from(set);
  }, [submissions]);

  // Filtered & Sorted Submissions for Results Tab
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const matchSubj = resultSubjectFilter === 'all' || sub.subject === resultSubjectFilter;
      const q = resultSearch.trim().toLowerCase();
      const matchSearch = !q ||
        (sub.testName || '').toLowerCase().includes(q) ||
        (sub.subject || '').toLowerCase().includes(q) ||
        (sub.testCode || '').toLowerCase().includes(q);
      return matchSubj && matchSearch;
    }).sort((a, b) => {
      const scoreA = (a.mcqScore || 0) + (a.teacherMarks || 0);
      const totalA = a.totalMarks || (a.totalMCQ || 1);
      const pctA = totalA > 0 ? (scoreA / totalA) * 100 : 0;

      const scoreB = (b.mcqScore || 0) + (b.teacherMarks || 0);
      const totalB = b.totalMarks || (b.totalMCQ || 1);
      const pctB = totalB > 0 ? (scoreB / totalB) * 100 : 0;

      if (resultSortBy === 'score_high') return pctB - pctA;
      if (resultSortBy === 'score_low') return pctA - pctB;
      return new Date(b.submittedAt) - new Date(a.submittedAt);
    });
  }, [submissions, resultSubjectFilter, resultSearch, resultSortBy]);

  // Sync tab if URL search parameter changes
  
  // OTP Cooldown Countdown Timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);
  
  useEffect(() => {
    if (user) {
      loadDashboardData();
    } else {
      setLoadingData(false);
    }
  }, [user]);

  // Review modal state
  const [reviewSubId, setReviewSubId]     = useState(null);
  const [reviewData, setReviewData]       = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);

  // Photo / Checked sheet preview modal
  const [previewPhotoSub, setPreviewPhotoSub] = useState(null);

  // Teacher support inquiry form state
  const [doubtText, setDoubtText]         = useState('');
  const [doubtSubject, setDoubtSubject]   = useState('સામાન્ય શંકા (General)');
  const [doubtSent, setDoubtSent]         = useState(false);

  // Study Materials State & PowerPoint 3D Slide Deck Viewer
  const [materialsList, setMaterialsList] = useState([]);
  const [marketingList, setMarketingList] = useState([]);
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialSubjectFilter, setMaterialSubjectFilter] = useState('ALL');
  const [pptModalItem, setPptModalItem] = useState(null);
  const [pptSlideIndex, setPptSlideIndex] = useState(0);
  const [pptSlideDirection, setPptSlideDirection] = useState('next'); // 'next' | 'prev'

  // Load dashboard data when student is logged in
  const loadDashboardData = async (silent = false) => {
    if (!silent && liveTests.length === 0) setLoadingData(true);
    try {
      // 1. Fetch live tests & marketing in parallel
      const [mktRes, qRes] = await Promise.all([
        getMarketingItems({ type: 'POSTER' }).catch(() => ({ data: [] })),
        getQuestions().catch(() => ({ data: [] }))
      ]);
      setMarketingList(Array.isArray(mktRes?.data) ? mktRes.data : []);
      const rawQs = Array.isArray(qRes?.data) ? qRes.data : [];

      // Group active questions by testCode
      const groups = {};
      rawQs.forEach(q => {
        const key = q.testCode || (q.chapter ? `CHAPTER-${q.chapter}` : 'DEFAULT-TEST');
        if (!groups[key]) {
          groups[key] = {
            testCode:    key,
            testName:    q.testName || q.chapter || 'સામાન્ય કસોટી (Live Test)',
            subject:     q.subject  || 'General',
            timeLimit:   q.timeLimit || 60,
            scheduledAt: q.scheduledAt || null,
            questions:   [],
            totalMarks:  0,
            mcqCount:    0,
            descCount:   0
          };
        }
        groups[key].questions.push(q);
        groups[key].totalMarks += (q.marks || 1);
        if (q.type === 'mcq') groups[key].mcqCount++;
        else groups[key].descCount++;
      });
      setLiveTests(Object.values(groups));

      // 2. Fetch past submissions, leaderboard, materials in parallel
      const [subRes, lbRes, twRes, matRes] = await Promise.all([
        getMySubmissions().catch(() => ({ data: [] })),
        getLeaderboard().catch(() => ({ data: [] })),
        getTestWiseLeaderboard().catch(() => ({ data: [] })),
        getMaterials().catch(() => ({ data: { data: [] } }))
      ]);

      let subData = Array.isArray(subRes?.data) ? subRes.data : [];
      if (subData.length === 0 && user?.mobile) {
        try {
          const mobileRes = await getStudentHistoryByMobile(user.mobile);
          subData = Array.isArray(mobileRes?.data) ? mobileRes.data : [];
        } catch (e) {}
      }
      setSubmissions(subData);
      setLeaderboard(Array.isArray(lbRes?.data) ? lbRes.data : []);
      setTestWiseLeaderboard(Array.isArray(twRes?.data) ? twRes.data : []);
      setMaterialsList(Array.isArray(matRes?.data?.data) ? matRes.data.data : []);
    } catch (e) {
      console.warn('Student data load error:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData(true);
    setRefreshing(false);
  };

  // ─── Step 1: Send OTP ───────────────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setAuthError('');
    const valResult = validateIndianMobile(mobile);
    if (!valResult.isValid) {
      setAuthError(valResult.message);
      return;
    }
    const nameVal = validateStudentName(name);
    if (!nameVal.isValid) {
      setAuthError(nameVal.message);
      return;
    }
    setAuthLoading(true);
    try {
      const res = await sendOTP(valResult.cleaned, name);
      if (res.data.devOtp) setDevOtp(res.data.devOtp);
      
      // ⚡ TRIGGER STAR FLOW ANIMATION & SPARKLE SOUND ⚡
      playCinematicSound('sparkle');
      setIsThorAnimating(true);
      setTimeout(() => {
        setAuthMode('otp');
        setIsThorAnimating(false);
        setOtpCooldown(60);
      }, 1250);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'OTP મોકલવામાં ભૂલ.');
    }
    setAuthLoading(false);
  };

  // ─── Step 2: Verify OTP -> Trigger Shatter Vault Doors & Dimensional Warp ───
  const [isVaultOpening, setIsVaultOpening] = useState(false);
  const [showWarpDashboard, setShowWarpDashboard] = useState(false);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await verifyOTP(mobile, name, otp);
      
      // 🌟 Trigger Shatter Vault Doors & Dimensional Warp Sequence
      setIsVaultOpening(true);

      // Play high-tech audio effect via AudioContext
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
      } catch (err) {}

      setTimeout(() => {
        loginStudent(res.data.student, res.data.token);
        setIsVaultOpening(false);
        setShowWarpDashboard(true);
      }, 1250);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'OTP ખોટો છે.');
      setAuthLoading(false);
    }
  };

  // ─── Launch Exam Directly from Live Tab ────────────────────
  const handleStartExam = (testQuestions) => {
    const firstQ = testQuestions && testQuestions[0];
    const tCode = firstQ?.testCode;
    const isAlreadyDone = tCode && submissions.some(s => s.testCode === tCode);
    if (isAlreadyDone) {
      alert('⚠️ તમે આ કસોટી અગાઉ આપી ચૂક્યા છો! એક કસોટી એક જ વાર આપી શકાય છે.');
      setActiveTab('results');
      return;
    }
    startExam(testQuestions);
    navigate('/exam');
  };

  // ─── Open Question Review / Solution Modal ─────────────────
  const handleOpenReview = async (subId) => {
    setReviewSubId(subId);
    setLoadingReview(true);
    setReviewData(null);
    try {
      const res = await getSubmissionReview(subId);
      setReviewData(res.data);
    } catch (e) {
      console.error('Review load error:', e);
    }
    setLoadingReview(false);
  };

  // ─── Direct PDF Download (Backend Attachment — 100% Zero Redirect, No New Tab) ───
  const handlePrintScorecard = (sub) => {
    if (!sub?.id || downloadingScorecardId) return;
    setDownloadingScorecardId(sub.id);
    try {
      showToast?.('⏳ PDF ડાઉનલોડ શરૂ થઈ રહ્યું છે...', 'info');

      const safeTestName = (sub.testName || 'Scorecard').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      const safeStudentName = (sub.student?.name || user?.name || '').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      const filename = `Trinetra_${safeTestName}_${safeStudentName}.pdf`;
      const downloadUrl = `/api/submissions/${sub.id}/pdf`;

      // 1. Direct Anchor Download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // 2. Invisible iFrame Fallback (Guaranteed download on mobile browsers without page unload)
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);

      setTimeout(() => {
        try { document.body.removeChild(link); } catch(e) {}
        try { document.body.removeChild(iframe); } catch(e) {}
      }, 10000);

      // 3. Show green success popup on the current page
      setDownloadPopup({ filename, type: 'scorecard' });
      setTimeout(() => setDownloadPopup(null), 5000);
      showToast?.('✅ PDF ડાઉનલોડ શરૂ થઈ ગયું!', 'success');
    } catch (err) {
      console.error('Scorecard PDF download error:', err);
      showToast?.('PDF ડાઉનલોડ કરવામાં ભૂલ આવી. ફરી પ્રયાસ કરો.', 'error');
    } finally {
      setTimeout(() => setDownloadingScorecardId(null), 1200);
    }
  };

  // ─── 📲 Direct WhatsApp PDF Send (From Teacher's Phone to Student's WhatsApp) ───
  const handleInitiateWhatsAppSend = (sub) => {
    const rawMobile = (user?.mobile && user.mobile !== '9999999999' && user.mobile.length === 10)
      ? user.mobile
      : ((sub.student?.mobile && sub.student.mobile !== '9999999999' && sub.student.mobile.length === 10) ? sub.student.mobile : '');

    if (rawMobile && rawMobile.length === 10 && /^[6-9]/.test(rawMobile)) {
      // Auto send directly if valid 10-digit number is known
      handleExecuteWhatsAppSend(sub, rawMobile);
    } else {
      // Prompt modal if number is unknown or dummy
      setWaTargetMobile(rawMobile || '');
      setWaModalSub(sub);
    }
  };

  const handleExecuteWhatsAppSend = async (sub, customMobile) => {
    if (!sub?.id || sendingWaSubId) return;

    const rawTarget = customMobile || waTargetMobile || sub.student?.mobile || user?.mobile || '';
    const cleanMobile = String(rawTarget).replace(/\D/g, '').replace(/^(91|0)/, '');

    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
      alert('⚠️ કૃપા કરીને માન્ય ૧૦-અંકનો WhatsApp મોબાઈલ નંબર દાખલ કરો.');
      return;
    }

    setSendingWaSubId(sub.id);
    try {
      const targetName = user?.name || sub.student?.name || 'વિદ્યાર્થી';

      const res = await sendWhatsAppScorecard(sub.id, {
        mobile: cleanMobile,
        studentName: targetName
      });

      if (res.data?.success) {
        setWaModalSub(null);

        // Sound effect
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
            osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1.0);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.0);
          }
        } catch (e) {}

        // Trigger Grand Popup
        setWaSuccessModal({
          testName: sub.testName || 'કસોટી',
          mobile: cleanMobile,
          studentName: targetName,
          filename: `Trinetra_${(sub.testName || 'Scorecard').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_')}.pdf`
        });
      }
    } catch (err) {
      console.error('Send WhatsApp Scorecard Error:', err);
      const isOffline = err.response?.data?.isOffline;
      const errMsg = err.response?.data?.error || 'WhatsApp પર PDF મોકલવામાં ભૂલ આવી.';
      if (isOffline) {
        alert('⚠️ એકેડેમીનું WhatsApp હાલ ઑફલાઇન છે. કૃપા કરીને થોડીવાર પછી પ્રયાસ કરો.');
      } else {
        alert(`❌ ${errMsg}`);
      }
    } finally {
      setSendingWaSubId(null);
    }
  };


  // ─── Student Overall Statistics (Strict 0% to 100% Range) ───────────────────────────
  const stats = useMemo(() => {
    if (!submissions.length) {
      return { totalTests: 0, avgScore: 0, highestScore: 0, totalMarksObtained: 0 };
    }
    const total = submissions.length;
    let sumScore = 0;
    let sumTotal = 0;
    let maxPct = 0;

    submissions.forEach(s => {
      const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
      const totalM = Number(s.totalMarks) > 0 
        ? Number(s.totalMarks) 
        : Number(s.totalMCQ) > 0 
          ? Number(s.totalMCQ) 
          : 20;
      const clampedScore = Math.min(totalM, Math.max(0, score));
      const pct = Math.min(100, Math.max(0, Math.round((clampedScore / totalM) * 100)));
      sumScore += clampedScore;
      sumTotal += totalM;
      if (pct > maxPct) maxPct = pct;
    });

    const rawAvg = sumTotal > 0 ? Math.round((sumScore / sumTotal) * 100) : 0;
    const avg = Math.min(100, Math.max(0, rawAvg));
    return {
      totalTests: total,
      avgScore: avg,
      highestScore: Math.min(100, Math.max(0, maxPct)),
      totalMarksObtained: sumScore
    };
  }, [submissions]);

  // ─── Subject Analytics Breakdown (Strict 0% to 100%) ──────────────────────────
  const subjectAnalytics = useMemo(() => {
    const map = {};
    submissions.forEach(s => {
      const sub = s.subject || 'સામાન્ય';
      if (!map[sub]) map[sub] = { subject: sub, count: 0, totalScore: 0, totalMax: 0 };
      const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
      const totalM = Number(s.totalMarks) > 0 ? Number(s.totalMarks) : Number(s.totalMCQ) > 0 ? Number(s.totalMCQ) : 20;
      map[sub].count++;
      map[sub].totalScore += Math.min(totalM, Math.max(0, score));
      map[sub].totalMax += totalM;
    });
    return Object.values(map).map(m => ({
      ...m,
      pct: m.totalMax > 0 ? Math.min(100, Math.max(0, Math.round((m.totalScore / m.totalMax) * 100))) : 0
    }));
  }, [submissions]);

  // ─── Test-by-Test Score Progression Graph Data ───────────
  const testTrendData = useMemo(() => {
    if (!submissions.length) return [];
    // chronological order (oldest to newest)
    const reversed = [...submissions].reverse();
    return reversed.map((s, idx) => {
      const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
      const total = Number(s.totalMarks || s.totalMCQ || 20) || 20;
      const rawPct = total > 0 ? Math.round((score / total) * 100) : 0;
      const pct = Math.min(100, Math.max(0, rawPct));
      return {
        testNum: idx + 1,
        testCode: s.testCode,
        testName: s.testName || 'કસોટી ' + (idx + 1),
        subject: s.subject || 'સામાન્ય',
        score,
        total,
        percentage: pct,
        date: new Date(s.submittedAt).toLocaleDateString('gu-IN', { day: 'numeric', month: 'short' })
      };
    });
  }, [submissions]);

  // ─── Accuracy & Question Breakdown Metrics ──────────────
  const accuracyMetrics = useMemo(() => {
    let totalMCQ = 0;
    let correctMCQ = 0;
    submissions.forEach(s => {
      totalMCQ += (s.totalMCQ || 0);
      correctMCQ += (s.mcqScore || 0);
    });
    const wrongMCQ = Math.max(0, totalMCQ - correctMCQ);
    const accuracy = totalMCQ > 0 ? Math.round((correctMCQ / totalMCQ) * 100) : 0;
    return { totalMCQ, correctMCQ, wrongMCQ, accuracy };
  }, [submissions]);

  // ─── Print Full Academic Progress Report: Option 1 Gold Certificate & Seal ───
  const handlePrintProgressReport = async () => {
    // Open print window synchronously on user click so mobile & desktop browsers NEVER block it!
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      try {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Trinetra Progress Report - PDF Loading...</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
              .spinner { width: 44px; height: 44px; border: 4px solid rgba(255,255,255,0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h2 style="margin: 0 0 8px; font-size: 1.25rem;">વિદ્યાર્થી પ્રગતિ રિપોર્ટ તૈયાર થઈ રહ્યો છે...</h2>
            <p style="color: #94a3b8; font-size: 0.9rem; margin: 0;">કૃપા કરીને થોડી ક્ષણ રાહ જુઓ. PDF પ્રિન્ટ ડાયલોગ આપમેળે ખૂલશે.</p>
          </body>
          </html>
        `);
      } catch (e) {}
    }

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
    const logoUrl = `${origin}/images/logo.jpg`;
    const certNumber = `TRN-${Math.floor(100000 + Math.random() * 900000)}`;

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

      return `
        <g>
          <!-- Score Pill Background -->
          <rect x="${x - 2}" y="${y - 20}" width="42" height="15" rx="4" fill="${badgeBg}" stroke="${barColor}" stroke-width="0.8" />
          <!-- Score % on top of bar -->
          <text x="${x + 19}" y="${y - 9}" text-anchor="middle" font-size="9.5" font-weight="900" fill="${badgeColor}">${clamped}%</text>
          <!-- Vertical Bar Pillar with 3D Gloss -->
          <rect x="${x}" y="${y}" width="38" height="${barH}" rx="4" fill="${barColor}" />
          <!-- Test label below bar -->
          <text x="${x + 19}" y="152" text-anchor="middle" font-size="10.5" font-weight="800" fill="#1e293b">T${d.testNum}</text>
          <text x="${x + 19}" y="164" text-anchor="middle" font-size="8.5" font-weight="600" fill="#64748b">${(d.testName || '').substring(0, 8)}</text>
        </g>
      `;
    }).join('');

    const svgBarChartWidth = Math.max(460, 45 + testTrendData.length * 65);

    const html = `<!DOCTYPE html>
    <html lang="gu">
    <head>
      <meta charset="UTF-8">
      <title>Trinetra Academy - Official Academic Certificate & Progress Report - ${user?.name}</title>
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
            <img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=TA&background=1e3a8a&color=fff'" alt="Logo" />
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
        </div>
        </div>

        <!-- Student Metadata Strip -->
        <div class="meta-strip">
          <div><span style="color:#64748b;">વિદ્યાર્થી:</span> <strong style="color:#1e3a8a;">${user?.name}</strong></div>
          <div><span style="color:#64748b;">મોબાઈલ:</span> <strong>${user?.mobile}</strong></div>
          <div><span style="color:#64748b;">સર્ટિફિકેટ ક્રમ:</span> <strong style="color:#d97706;">${certNumber}</strong></div>
          <div><span style="color:#64748b;">તારીખ:</span> <strong>${new Date().toLocaleDateString('gu-IN')}</strong></div>
        </div>

        <!-- 4 Golden Key Metric Cards -->
        <div class="grid">
          <div class="stat-card">
            <div style="font-size:11px; color:#64748b; font-weight:700;">કુલ કસોટીઓ</div>
            <div class="stat-num">${stats.totalTests}</div>
          </div>
          <div class="stat-card">
            <div style="font-size:11px; color:#64748b; font-weight:700;">સરેરાશ સ્કોર</div>
            <div class="stat-num" style="color:${gradeColor};">${stats.avgScore}%</div>
          </div>
          <div class="stat-card">
            <div style="font-size:11px; color:#64748b; font-weight:700;">ચોકસાઈ દર</div>
            <div class="stat-num">${accuracyMetrics.accuracy}%</div>
          </div>
          <div class="stat-card" style="border-top-color: #d97706;">
            <div style="font-size:11px; color:#d97706; font-weight:800;">પરફોર્મન્સ ગ્રેડ</div>
            <div class="stat-num" style="font-size:16px; color:${gradeColor};">${overallGrade}</div>
          </div>
        </div>

        <!-- 📊 TEST PROGRESSION BAR CHART -->
        ${testTrendData.length > 0 ? `
          <div class="chart-box">
            <div style="font-weight: 900; font-size: 13px; color: #1e3a8a; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
              <span>📊 કસોટી-દર-કસોટી સ્કોર બાર ચાર્ટ (Test Progression Bar Chart)</span>
              <span style="font-size: 10px; color: #64748b; font-weight: normal;">(ગુણ ટકાવારી %)</span>
            </div>
            <div style="width: 100%; overflow-x: auto;">
              <svg width="100%" height="175" viewBox="0 0 ${svgBarChartWidth} 175" style="overflow: visible;">
                <!-- Grid lines -->
                <line x1="25" y1="20" x2="${svgBarChartWidth - 10}" y2="20" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
                <text x="5" y="24" font-size="9" fill="#94a3b8" font-weight="700">100%</text>
                <line x1="25" y1="78" x2="${svgBarChartWidth - 10}" y2="78" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />
                <text x="5" y="82" font-size="9" fill="#94a3b8" font-weight="700">50%</text>
                <line x1="25" y1="135" x2="${svgBarChartWidth - 10}" y2="135" stroke="#cbd5e1" stroke-width="1.5" />
                <text x="5" y="139" font-size="9" fill="#94a3b8" font-weight="700">0%</text>
                
                <!-- Bars -->
                ${chartBars}
              </svg>
            </div>
          </div>
        ` : ''}

        <!-- 📚 SUBJECT ANALYSIS TABLE -->
        <h3 style="color: #1e3a8a; margin: 12px 0 6px 0; font-size: 13.5px; font-weight: 900; display:flex; align-items:center; justify-content:space-between;">
          <span>📚 વિષયવાર પ્રગતિ અને ગુણ વિશ્લેષણ:</span>
          <span style="font-size:11px; color:#d97706; font-weight:800;">કુલ વિષયો: ${subjectAnalytics.length}</span>
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
            ${subjectAnalytics.map(s => `
              <tr>
                <td><strong>📚 ${s.subject}</strong></td>
                <td>${s.count} કસોટીઓ</td>
                <td>${s.totalScore}/${s.totalMax}</td>
                <td><strong style="color:${s.pct >= 70 ? '#166534' : s.pct >= 50 ? '#b45309' : '#991b1b'};">${s.pct}%</strong></td>
                <td>
                  <span style="font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px; background:${s.pct >= 70 ? '#dcfce7' : s.pct >= 50 ? '#fef3c7' : '#fee2e2'}; color:${s.pct >= 70 ? '#166534' : s.pct >= 50 ? '#b45309' : '#991b1b'};">
                    ${s.pct >= 70 ? '🟢 સબળ (Strong)' : s.pct >= 50 ? '🟡 સરેરાશ (Average)' : '🔴 મહેનત જરૂરી'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- 🎖️ OFFICIAL SIGNATURE & ACADEMY STAMP (SUNIL SIR & TRINETRA LOGO) 🎖️ -->
        <div style="margin-top: 18px; border-top: 1.5px dashed #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #475569; flex-wrap: wrap; gap: 10px;">
          
          <!-- Left: Academy Verification Text -->
          <div style="flex: 1; min-width: 180px;">
            <div style="font-weight: 900; color: #1e3a8a; font-size: 12px; display: flex; align-items: center; gap: 4px;">
              <span>🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી</span>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              📞 હેલ્પલાઇન: <strong style="color: #1e40af;">8200405300</strong> &nbsp;|&nbsp; 🌐 <strong style="color: #2563eb;">trinetraacademy.in</strong>
            </div>
            <div style="font-size: 9.5px; color: #059669; font-weight: 800; margin-top: 2px;">
              ✓ ડિજિટલ રીતે પ્રમાણિત અને માન્ય મૂલ્યાંકન અહેવાલ
            </div>
          </div>

          <!-- Center: Official Circular Academy Stamp with Logo -->
          <div style="display: flex; align-items: center; justify-content: center; margin: 0 10px;">
            <div style="width: 76px; height: 76px; border-radius: 50%; border: 2px solid #1e3a8a; outline: 1.5px dashed #d97706; outline-offset: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: radial-gradient(circle, #eff6ff 0%, #ffffff 100%); transform: rotate(-5deg); box-shadow: 0 2px 8px rgba(30,58,138,0.12); padding: 2px;">
              <img src="${logoUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid #1e3a8a;" onerror="this.src='https://ui-avatars.com/api/?name=TA&background=1e3a8a&color=fff'" alt="Logo" />
              <div style="font-size: 6.5px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.2px; margin-top: 1px;">TRINETRA ACADEMY</div>
              <div style="font-size: 6px; font-weight: 800; color: #d97706;">★ OFFICIAL SEAL ★</div>
            </div>
          </div>

          <!-- Right: Sunil Sir Official Cursive Signature -->
          <div style="text-align: center; min-width: 160px;">
            <div style="font-family: 'Brush Script MT', 'Dancing Script', 'Segoe Script', cursive; font-size: 27px; font-weight: 700; color: #1e3a8a; transform: rotate(-3deg); line-height: 1; letter-spacing: 0.5px;">
              Sunil Sir
            </div>
            <div style="border-top: 1.5px solid #1e3a8a; margin-top: 4px; padding-top: 3px;">
              <div style="font-weight: 900; font-size: 11.5px; color: #1e3a8a;">સુનિલ સર (Sunil Sir)</div>
              <div style="font-size: 9.5px; color: #d97706; font-weight: 800;">સંસ્થાપક & મુખ્ય ફેકલ્ટી (Founder & Director)</div>
              <div style="font-size: 8.5px; color: #64748b;">ત્રિનેત્ર ઓનલાઇન એકેડેમી</div>
            </div>
          </div>

        </div>

      </div>

      <!-- 🖼️ EXACT SCORECARD MARKETING BROCHURE PAGE -->
      ${buildMarketingBrochureHtml(activeMarketing)}

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
    </html>`;

    // ── Write HTML to print window & trigger PDF print ──
    try {
      const filename = `Trinetra_Progress_Report_${(user?.name || '').replace(/\s+/g, '_')}.pdf`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);

      if (printWindow && !printWindow.closed) {
        printWindow.location.href = blobUrl;
      } else {
        const win = window.open(blobUrl, '_blank');
        if (win) win.location.href = blobUrl;
      }

      // ✅ Show success download popup
      setDownloadPopup({ filename, type: 'progress' });
      setTimeout(() => setDownloadPopup(null), 5000);
    } catch (err) {
      console.error('Progress report PDF print error:', err);
      if (printWindow && !printWindow.closed) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }
    }
  };

  // ─── 📲 Send Pragati Report (Progress Card) via WhatsApp ───────────────────
  const handleSendPragatiWhatsApp = async () => {
    if (sendingPragatiWa || !submissions.length) return;

    const rawMobile = user?.mobile || '';
    const cleanMobile = String(rawMobile).replace(/\D/g, '').replace(/^(91|0)/, '');

    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
      alert('⚠️ માન્ય WhatsApp નંબર ખાતામાં નોંધાયેલ નથી. Admin ને સંપર્ક કરો.');
      return;
    }

    setSendingPragatiWa(true);
    try {
      const res = await sendPragatiWhatsApp({
        studentId: user.id,
        studentName: user.name,
        mobile: cleanMobile
      });

      if (res.data?.success) {
        // Reuse the same grand success popup as Scorecard WhatsApp
        setWaSuccessModal({
          testName: '📊 પ્રગતિ રિપોર્ટ (Pragati Card)',
          mobile: cleanMobile,
          studentName: user.name,
          filename: `Trinetra_Pragati_Report_${(user.name || '').replace(/\s+/g, '_')}.pdf`
        });
      }
    } catch (err) {
      const isOffline = err.response?.data?.isOffline;
      const errMsg = err.response?.data?.error || 'WhatsApp પર Pragati Card મોકલવામાં ભૂલ.';
      if (isOffline) {
        alert('⚠️ એકેડેમીનું WhatsApp હાલ ઑફલાઇન છે. કૃપા કરીને થોડીવાર પછી ફરી પ્રયાસ કરો.');
      } else {
        alert(`❌ ${errMsg}`);
      }
    } finally {
      setSendingPragatiWa(false);
    }
  };

  // ─── Download Material handler ─────────────────────────────
  const handleDownloadMaterial = async (m) => {
    const docHtml = `<!DOCTYPE html>
    <html lang="gu">
    <head>
      <meta charset="UTF-8">
      <title>${m.title} - Trinetra Online Academy</title>
      <style>
        body { font-family: 'Hind Vadodara', sans-serif, system-ui; padding: 24px; color: #0f172a; max-width: 750px; margin: 0 auto; background: #ffffff; }
        .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 20px; }
        .box { background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 16px; border-radius: 12px; margin-bottom: 20px; }
        .content-item { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="color: #1e3a8a; margin: 0;">🏛️ ત્રિનેત્ર ઓનલાઈન એકેડેમી</h1>
        <div style="font-size: 14px; color: #64748b; margin-top: 4px;">સ્પર્ધાત્મક પરીક્ષા મટીરીયલ • Helpline: 8200405300</div>
      </div>
      <div class="box">
        <h2 style="margin: 0 0 6px; color: #1e3a8a;">${m.title}</h2>
        <div style="font-size: 14px; color: #475569;">વિષય: <strong>${m.subject}</strong> | પ્રકાર: <strong>${m.type}</strong> | કદ: <strong>${m.size}</strong></div>
      </div>
      <div style="line-height: 1.8; font-size: 15px;">
        <p>${m.description}</p>
        <div class="content-item"><strong>મુખ્ય મુદ્દાઓ (Key Concepts):</strong><br>૧. પરીક્ષા પદ્ધતિ અને બ્લુપ્રિન્ટ મુજબ તૈયારી.<br>૨. સમય મર્યાદામાં સચોટ જવાબો આપવાની ટેકનિક.<br>૩. અગાઉના વર્ષોના પ્રશ્નપત્રોનું વિશ્લેષણ.</div>
        <div class="content-item"><strong>સુવર્ણ સલાહ:</strong> રોજેરોજ નિયમિત મોક ટેસ્ટ આપો અને ભૂલોનું રિવિઝન કરો.</div>
      </div>
    </body>
    </html>`;
    try {
      const filename = `${m.title.replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_')}.pdf`;
      showToast?.('⏳ મટીરીયલ PDF ડાઉનલોડ થઈ રહ્યું છે...', 'info');
      await downloadHtmlAsPdf(docHtml, filename);

      setDownloadPopup({ filename, type: 'material' });
      setTimeout(() => setDownloadPopup(null), 5000);
    } catch (err) {
      console.error('Material download error:', err);
      showToast?.('મટીરીયલ ડાઉનલોડ કરવામાં ભૂલ આવી.', 'error');
    }
  };

  // ─── Send WhatsApp Doubt to Teacher ───────────────────────
  const handleSendWhatsAppDoubt = (e) => {
    e.preventDefault();
    if (!doubtText.trim()) return;
    const msg = `નમસ્તે સર, હું ત્રિનેત્ર એકેડેમીનો વિદ્યાર્થી ${user?.name || ''} (${user?.mobile || ''}) છું.%0A%0A*વિષય:* ${doubtSubject}%0A*શંકા / પ્રશ્ન:* ${encodeURIComponent(doubtText)}`;
    window.open(`https://wa.me/918200405300?text=${msg}`, '_blank');
    setDoubtSent(true);
    setDoubtText('');
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER: UNLOGGED STUDENT LOGIN SCREEN (CONCEPT 3: MINIMAL SMART CARD)
  // ─────────────────────────────────────────────────────────────
  if (!user || (!user.mobile && !user.id)) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0b1329 0%, #0f172a 50%, #1e293b 100%)', display: 'flex', flexDirection: 'column' }}>
        <Navbar />

        <div
          className="student-login-container"
          onMouseMove={handleGlobalMouseMove}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(20px, 4vw, 40px) 16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* 🖱️ 3. INTERACTIVE CURSOR STAR GLOW TRAIL 🖱️ */}
          {cursorDots.map((cd) => (
            <div
              key={cd.id}
              className="cursor-star-dot"
              style={{
                left: cd.x,
                top: cd.y,
                width: cd.size,
                height: cd.size,
                background: cd.color,
                boxShadow: `0 0 10px ${cd.color}`
              }}
            />
          ))}

          {/* 💥 FULLSCREEN GRAND LOGO SHATTER, 3RD EYE BEAM & CONFETTI OVERLAY 💥 */}
          {isOtpSuccessAnimating && (
            <>
              {/* 🎉 2. GOLDEN VICTORY CONFETTI & FIREWORKS SHOWER 🎉 */}
              {[
                { left: '8%',  cfx: '-60px', w: 10, h: 18, color: '#fbbf24', delay: '0s' },
                { left: '16%', cfx: '40px',  w: 12, h: 14, color: '#38bdf8', delay: '0.1s' },
                { left: '25%', cfx: '-50px', w: 8,  h: 20, color: '#22c55e', delay: '0.05s' },
                { left: '34%', cfx: '70px',  w: 14, h: 14, color: '#f59e0b', delay: '0.2s' },
                { left: '42%', cfx: '-40px', w: 10, h: 16, color: '#ec4899', delay: '0.15s' },
                { left: '50%', cfx: '60px',  w: 12, h: 18, color: '#ffffff', delay: '0s' },
                { left: '58%', cfx: '-70px', w: 9,  h: 22, color: '#fbbf24', delay: '0.1s' },
                { left: '67%', cfx: '50px',  w: 11, h: 15, color: '#38bdf8', delay: '0.25s' },
                { left: '76%', cfx: '-60px', w: 13, h: 14, color: '#22c55e', delay: '0.08s' },
                { left: '85%', cfx: '45px',  w: 10, h: 18, color: '#f59e0b', delay: '0.18s' },
                { left: '92%', cfx: '-55px', w: 12, h: 16, color: '#a855f7', delay: '0.12s' },
                { left: '12%', cfx: '65px',  w: 9,  h: 20, color: '#ffffff', delay: '0.22s' },
                { left: '48%', cfx: '-35px', w: 14, h: 14, color: '#fbbf24', delay: '0.3s' },
                { left: '80%', cfx: '55px',  w: 11, h: 19, color: '#38bdf8', delay: '0.05s' },
              ].map((cf, idx) => (
                <div
                  key={`confetti-${idx}`}
                  className="victory-confetti-item"
                  style={{
                    left: cf.left,
                    width: cf.w,
                    height: cf.h,
                    background: cf.color,
                    boxShadow: `0 0 10px ${cf.color}`,
                    animationDelay: cf.delay,
                    '--cfx': cf.cfx
                  }}
                />
              ))}

              <div className="fullscreen-shatter-overlay">
                <div className="grand-blast-ring" />
                
                {/* 👁️ 4. TRINETRA 3RD EYE DIVINE LASER BEAM 👁️ */}
                <div className="third-eye-laser-beam" />

                {/* Massive 360° Star Shatter Pieces */}
                {[
                  { gx: '-180px', gy: '-160px', grot: '120deg', size: 28, bg: '#fbbf24' },
                  { gx: '190px',  gy: '-150px', grot: '-140deg', size: 26, bg: '#f97316' },
                  { gx: '-210px', gy: '140px',  grot: '180deg', size: 30, bg: '#ffffff' },
                  { gx: '220px',  gy: '150px',  grot: '-200deg', size: 28, bg: '#fbbf24' },
                  { gx: '0px',    gy: '-240px', grot: '90deg',  size: 32, bg: '#f59e0b' },
                  { gx: '0px',    gy: '230px',  grot: '-90deg', size: 30, bg: '#38bdf8' },
                  { gx: '-240px', gy: '0px',    grot: '150deg', size: 28, bg: '#ffffff' },
                  { gx: '240px',  gy: '0px',    grot: '-150deg', size: 26, bg: '#f97316' },
                  { gx: '-140px', gy: '-220px', grot: '60deg',  size: 24, bg: '#fbbf24' },
                  { gx: '150px',  gy: '-210px', grot: '-75deg', size: 26, bg: '#f59e0b' },
                  { gx: '-160px', gy: '210px',  grot: '135deg', size: 26, bg: '#38bdf8' },
                  { gx: '160px',  gy: '220px',  grot: '-120deg', size: 28, bg: '#ffffff' },
                  { gx: '-110px', gy: '-90px',  grot: '45deg',  size: 22, bg: '#fbbf24' },
                  { gx: '110px',  gy: '-85px',  grot: '-45deg', size: 24, bg: '#f97316' },
                  { gx: '-120px', gy: '80px',   grot: '90deg',  size: 22, bg: '#38bdf8' },
                  { gx: '120px',  gy: '90px',   grot: '-90deg', size: 24, bg: '#ffffff' },
                ].map((gp, idx) => (
                  <div
                    key={`grand-shard-${idx}`}
                    className="grand-shatter-piece"
                    style={{
                      width: gp.size,
                      height: gp.size,
                      marginLeft: -(gp.size / 2),
                      marginTop: -(gp.size / 2),
                      background: `radial-gradient(circle, #ffffff 20%, ${gp.bg} 85%)`,
                      '--gx': gp.gx,
                      '--gy': gp.gy,
                      '--grot': gp.grot
                    }}
                  />
                ))}

                <div className="grand-logo-center">
                  <img src="/images/logo.jpg" alt="Trinetra Academy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>

                <div style={{ marginTop: 24, fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', textShadow: '0 0 20px rgba(251,191,36,0.8)', letterSpacing: '0.5px' }}>
                  🎉 ત્રિનેત્ર એકેડેમીમાં આપનું સ્વાગત છે!
                </div>
              </div>
            </>
          )}
          {/* Ambient Lighting Glows (Smooth 60FPS Floating) */}
          <div className="ambient-orb-1" style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, rgba(0,0,0,0) 70%)', top: '8%', left: '12%', pointerEvents: 'none' }} />
          <div className="ambient-orb-2" style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, rgba(0,0,0,0) 70%)', bottom: '8%', right: '12%', pointerEvents: 'none' }} />

          {/* 🌌 DENSE FLOATING STARS & FAST GLOWING PARTICLES 🌌 */}
          {[
            { top: '95%', left: '5%', size: 4, delay: '0s', dur: '5s', color: '#38bdf8' },
            { top: '90%', left: '12%', size: 3, delay: '1.2s', dur: '6s', color: '#ffffff' },
            { top: '98%', left: '20%', size: 5, delay: '0.4s', dur: '4.5s', color: '#fbbf24' },
            { top: '92%', left: '28%', size: 3, delay: '2.5s', dur: '7s', color: '#34d399' },
            { top: '95%', left: '35%', size: 4, delay: '1.8s', dur: '5.5s', color: '#60a5fa' },
            { top: '99%', left: '42%', size: 3, delay: '0.8s', dur: '6.5s', color: '#ffffff' },
            { top: '94%', left: '50%', size: 5, delay: '2.2s', dur: '4.8s', color: '#a78bfa' },
            { top: '97%', left: '58%', size: 3, delay: '3.1s', dur: '5.8s', color: '#38bdf8' },
            { top: '91%', left: '65%', size: 4, delay: '1.5s', dur: '6.2s', color: '#fde68a' },
            { top: '96%', left: '72%', size: 3, delay: '0.2s', dur: '5.2s', color: '#ffffff' },
            { top: '93%', left: '80%', size: 5, delay: '2.7s', dur: '4.6s', color: '#34d399' },
            { top: '98%', left: '88%', size: 4, delay: '1.1s', dur: '5.9s', color: '#60a5fa' },
            { top: '90%', left: '94%', size: 3, delay: '3.5s', dur: '6.8s', color: '#f472b6' },
            { top: '85%', left: '15%', size: 4, delay: '2.1s', dur: '5.4s', color: '#38bdf8' },
            { top: '88%', left: '84%', size: 3, delay: '0.9s', dur: '4.9s', color: '#ffffff' },
            { top: '92%', left: '48%', size: 4, delay: '3.8s', dur: '5.7s', color: '#fbbf24' },
          ].map((p, idx) => (
            <div
              key={`particle-${idx}`}
              className="particle-star"
              style={{
                width: p.size,
                height: p.size,
                top: p.top,
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.dur,
                background: `radial-gradient(circle, #ffffff 20%, ${p.color} 70%, transparent 100%)`,
                boxShadow: `0 0 12px ${p.color}`
              }}
            />
          ))}

          {/* 🎓🔬📐 6. FLOATING ACADEMIC EXAM, SCIENCE & MATH BACKGROUND MOTIONS 📐🔬🎓 */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            
            {/* 1. Exam: GPSC / TET-2 Gujarati Grammar Sandhi */}
            <div className="floating-equation-item" style={{ top: '8%', left: '5%', color: 'rgba(56, 189, 248, 0.55)', fontSize: 'clamp(0.9rem, 1.8vw, 1.3rem)', animation: 'floatFormulaDrift1 19s ease-in-out infinite' }}>
              📚 સંધિ: સત્ + જન = સજ્જન  •  નિઃ + રસ = નીરસ
            </div>

            {/* 2. Math: LCM / HCF Rule */}
            <div className="floating-equation-item" style={{ top: '15%', right: '7%', color: 'rgba(250, 204, 21, 0.55)', fontSize: 'clamp(0.95rem, 1.9vw, 1.35rem)', animation: 'floatFormulaDrift2 21s ease-in-out infinite' }}>
              📐 ગુ.સા.અ. × લ.સા.અ. = સંખ્યાઓનો ગુણાકાર
            </div>

            {/* 3. Competitive Exam: Constitution Article */}
            <div className="floating-equation-item" style={{ bottom: '15%', left: '5%', color: 'rgba(52, 211, 153, 0.55)', fontSize: 'clamp(0.9rem, 1.8vw, 1.3rem)', animation: 'floatFormulaDrift3 23s ease-in-out infinite' }}>
              🏛️ બંધારણ: અનુચ્છેદ ૫૧(A) - મૂળભૂત ફરજો
            </div>

            {/* 4. Science: Photosynthesis & Oxygen */}
            <div className="floating-equation-item" style={{ bottom: '12%', right: '6%', color: 'rgba(167, 139, 250, 0.55)', fontSize: 'clamp(0.9rem, 1.7vw, 1.3rem)', animation: 'floatFormulaDrift4 25s ease-in-out infinite' }}>
              🧪 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (પ્રકાશસંશ્લેષણ)
            </div>

            {/* 5. Math: Profit & Loss Percentage */}
            <div className="floating-equation-item" style={{ top: '42%', left: '3%', color: 'rgba(96, 165, 250, 0.48)', fontSize: 'clamp(0.9rem, 1.7vw, 1.3rem)', animation: 'floatFormulaDrift5 20s ease-in-out infinite' }}>
              💰 નફો % = (નફો × ૧૦૦) / મૂળકિંમત
            </div>

            {/* 6. Science: Einstein Mass-Energy & Newton */}
            <div className="floating-equation-item" style={{ top: '48%', right: '4%', color: 'rgba(244, 114, 182, 0.52)', fontSize: 'clamp(0.95rem, 1.8vw, 1.35rem)', animation: 'floatFormulaDrift1 22s ease-in-out infinite' }}>
              ⚡ E = mc²  •  ⚛️ F = ma  |  V = I × R
            </div>

            {/* 7. Exam: Chhand Matra */}
            <div className="floating-equation-item" style={{ top: '4%', left: '42%', transform: 'translateX(-50%)', color: 'rgba(125, 211, 252, 0.45)', fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)', animation: 'floatFormulaDrift2 24s ease-in-out infinite' }}>
              📖 છંદ: મંદાક્રાન્તા (૧૭ અક્ષર: મ ભ ન ત ત ગા ગા)
            </div>

            {/* 8. Math: Simple Interest Formula */}
            <div className="floating-equation-item" style={{ bottom: '4%', left: '48%', transform: 'translateX(-50%)', color: 'rgba(253, 224, 71, 0.5)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift3 22s ease-in-out infinite' }}>
              🎯 સાદું વ્યાજ: I = (P × R × N) / 100
            </div>

            {/* 9. Physics: Kinetic Energy & Speed */}
            <div className="floating-equation-item" style={{ top: '26%', left: '10%', color: 'rgba(74, 222, 128, 0.5)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift4 21s ease-in-out infinite' }}>
              🚀 ગતિઊર્જા: KE = ½mv²  •  v = u + at
            </div>

            {/* 10. Motivational Floating Gold Tag */}
            <div className="floating-equation-item" style={{ top: '32%', right: '9%', color: 'rgba(253, 224, 71, 0.55)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift5 23s ease-in-out infinite' }}>
              🏆 તમારી મહેનત + અમારું માર્ગદર્શન = ૧૦૦% સફળતા 🎯
            </div>

            {/* 11. Math: Pythagoras & Trig */}
            <div className="floating-equation-item" style={{ bottom: '24%', left: '9%', color: 'rgba(251, 146, 60, 0.48)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift1 26s ease-in-out infinite' }}>
              🔺 કર્ણ² = પાયો² + વેધ²  |  sin²θ + cos²θ = 1
            </div>

            {/* 12. Biology: DNA & Respiration */}
            <div className="floating-equation-item" style={{ bottom: '30%', right: '8%', color: 'rgba(56, 189, 248, 0.5)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift2 20s ease-in-out infinite' }}>
              🧬 DNA: A=T, G≡C  •  C₆H₁₂O₆ + 6O₂ → 38 ATP
            </div>

            {/* 13. Visual Mini Bar Chart & Growth Vector */}
            <div className="floating-visual-graph" style={{ top: '22%', left: '18%', animation: 'floatFormulaDrift1 25s ease-in-out infinite' }}>
              <svg width="105" height="70" viewBox="0 0 110 75" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(56,189,248,0.4))' }}>
                <line x1="10" y1="65" x2="100" y2="65" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                <rect x="18" y="38" width="12" height="27" rx="3" fill="rgba(56,189,248,0.4)" />
                <rect x="36" y="24" width="12" height="41" rx="3" fill="rgba(99,102,241,0.5)" />
                <rect x="54" y="44" width="12" height="21" rx="3" fill="rgba(234,179,8,0.4)" />
                <rect x="72" y="15" width="12" height="50" rx="3" fill="rgba(34,197,94,0.5)" />
                <path d="M 24 38 L 42 24 L 60 44 L 78 15 L 96 10" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" fill="none" />
                <circle cx="78" cy="15" r="3.5" fill="#4ade80" />
              </svg>
            </div>

            {/* 14. Visual Rotating Bohr Atomic Orbit */}
            <div className="floating-visual-graph" style={{ top: '7%', right: '18%', animation: 'floatFormulaDrift2 24s ease-in-out infinite' }}>
              <div style={{ position: 'relative', width: 65, height: 65, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle, #facc15 0%, #ca8a04 100%)', boxShadow: '0 0 14px #eab308' }} />
                <div style={{ position: 'absolute', width: 60, height: 24, borderRadius: '50%', border: '1.5px solid rgba(56,189,248,0.6)', animation: 'spinOrbitSlow 8s linear infinite' }} />
                <div style={{ position: 'absolute', width: 60, height: 24, borderRadius: '50%', border: '1.5px solid rgba(244,114,182,0.55)', transform: 'rotate(60deg)', animation: 'spinOrbitSlow 10s linear infinite reverse' }} />
                <div style={{ position: 'absolute', width: 60, height: 24, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.55)', transform: 'rotate(120deg)', animation: 'spinOrbitSlow 12s linear infinite' }} />
              </div>
            </div>

            {/* 15. Normal Distribution Bell Curve Diagram */}
            <div className="floating-visual-graph" style={{ bottom: '8%', left: '15%', animation: 'floatFormulaDrift5 26s ease-in-out infinite' }}>
              <svg width="115" height="60" viewBox="0 0 120 65" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.4))' }}>
                <line x1="5" y1="58" x2="115" y2="58" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                <path d="M 10 58 C 35 58, 42 12, 60 12 C 78 12, 85 58, 110 58" stroke="rgba(74,222,128,0.7)" strokeWidth="2.5" fill="rgba(34,197,94,0.08)" />
                <text x="80" y="50" fill="rgba(74,222,128,0.7)" fontSize="8">Top Rankers Curve</text>
              </svg>
            </div>

            {/* 16. DNA Double Helix */}
            <div className="floating-visual-graph" style={{ top: '2%', left: '15%', animation: 'floatFormulaDrift3 22s ease-in-out infinite' }}>
              <svg width="85" height="30" viewBox="0 0 90 35" fill="none" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.45))' }}>
                <path d="M 5 8 Q 25 28 45 8 T 85 8" stroke="#34d399" strokeWidth="2" fill="none" />
                <path d="M 5 28 Q 25 8 45 28 T 85 28" stroke="#38bdf8" strokeWidth="2" fill="none" />
              </svg>
            </div>

          </div>

          {/* 🪐 5. 3D GYROSCOPE TILT CARD PHYSICS 🪐 */}
          <div
            className={`login-card-animated tilt-3d-card ${isVaultOpening ? 'vault-door-left-anim' : ''}`}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={{
              maxWidth: 455,
              width: '100%',
              position: 'relative',
              zIndex: 1,
              boxShadow: isVaultOpening
                ? '0 0 80px rgba(34, 197, 94, 0.8), 0 0 120px rgba(234, 179, 8, 0.5)'
                : undefined,
              ...(isVaultOpening ? {} : tiltStyle)
            }}
          >

            {/* 🌟 360° CYBER NEON RUNNING LASER LIGHT BORDER 🌟 */}
            <div className="cyber-neon-card-wrapper">
              <div style={{
                position: 'relative',
                zIndex: 1,
                padding: 'clamp(24px, 4vw, 36px)',
                borderRadius: 21,
                background: '#ffffff'
              }}>

              {/* Logo & Header with Cosmic Shooting Star Stream & Flowing Transition */}
              <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
                
                {/* 🌟 COSMIC SHOOTING STAR RIVER STREAM & FUSION SHOCKWAVE 🌟 */}
                {isThorAnimating && (
                  <>
                    <div className="star-fusion-ring" />
                    
                    {/* Flowing Laser Tail Streaks */}
                    {[
                      { rot: '25deg' },
                      { rot: '-45deg' },
                      { rot: '110deg' },
                      { rot: '-135deg' }
                    ].map((tl, idx) => (
                      <div key={`trail-${idx}`} className="star-trail-line" style={{ '--rot': tl.rot }} />
                    ))}

                    {/* 3-Point River Flowing Star Pieces */}
                    {[
                      { p1x: '-60px', p1y: '-40px', p2x: '90px',  p2y: '-20px', p3x: '30px',  p3y: '45px',  size: 14, bg: '#fbbf24' },
                      { p1x: '65px',  p1y: '-50px', p2x: '-80px', p2y: '-10px', p3x: '-40px', p3y: '50px',  size: 16, bg: '#f97316' },
                      { p1x: '-80px', p1y: '20px',  p2x: '60px',  p2y: '30px',  p3x: '15px',  p3y: '-55px', size: 13, bg: '#ffffff' },
                      { p1x: '75px',  p1y: '35px',  p2x: '-70px', p2y: '40px',  p3x: '-35px', p3y: '-45px', size: 15, bg: '#fbbf24' },
                      { p1x: '0px',   p1y: '-80px', p2x: '100px', p2y: '10px',  p3x: '-50px', p3y: '30px',  size: 17, bg: '#f59e0b' },
                      { p1x: '0px',   p1y: '75px',  p2x: '-90px', p2y: '-30px', p3x: '45px',  p3y: '-25px', size: 14, bg: '#38bdf8' },
                      { p1x: '-50px', p1y: '-70px', p2x: '70px',  p2y: '-50px', p3x: '20px',  p3y: '60px',  size: 15, bg: '#ffffff' },
                      { p1x: '55px',  p1y: '-65px', p2x: '-60px', p2y: '55px',  p3x: '-25px', p3y: '-60px', size: 13, bg: '#f97316' },
                      { p1x: '-65px', p1y: '60px',  p2x: '85px',  p2y: '-40px', p3x: '35px',  p3y: '20px',  size: 16, bg: '#fbbf24' },
                      { p1x: '70px',  p1y: '65px',  p2x: '-75px', p2y: '-45px', p3x: '-45px', p3y: '15px',  size: 14, bg: '#f59e0b' },
                      { p1x: '-90px', p1y: '0px',   p2x: '50px',  p2y: '70px',  p3x: '40px',  p3y: '-50px', size: 15, bg: '#ffffff' },
                      { p1x: '90px',  p1y: '0px',   p2x: '-50px', p2y: '-70px', p3x: '-30px', p3y: '50px',  size: 14, bg: '#38bdf8' },
                    ].map((sp, idx) => (
                      <div
                        key={`star-flow-${idx}`}
                        className="star-stream-piece"
                        style={{
                          width: sp.size,
                          height: sp.size,
                          marginLeft: -(sp.size / 2),
                          marginTop: -(sp.size / 2),
                          background: `radial-gradient(circle, #ffffff 15%, ${sp.bg} 85%)`,
                          '--p1x': sp.p1x,
                          '--p1y': sp.p1y,
                          '--p2x': sp.p2x,
                          '--p2y': sp.p2y,
                          '--p3x': sp.p3x,
                          '--p3y': sp.p3y
                        }}
                      />
                    ))}
                  </>
                )}

                <div
                  className={`${isThorAnimating ? 'cosmic-star-logo-animating' : ''} ${isVaultOpening ? 'vault-logo-supernova-anim' : ''}`}
                  style={{
                    width: 68, height: 68, borderRadius: 18,
                    background: '#ffffff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 10,
                    boxShadow: isVaultOpening
                      ? '0 0 50px #22c55e, 0 0 80px #eab308'
                      : isThorAnimating
                      ? '0 0 45px #fbbf24, 0 0 70px #f97316'
                      : '0 8px 24px rgba(37,99,235,0.25)',
                    border: isVaultOpening
                      ? '2.5px solid #22c55e'
                      : isThorAnimating
                      ? '2px solid #fbbf24'
                      : '1.5px solid #e2e8f0',
                    overflow: 'hidden', padding: 4,
                    transition: 'all 0.3s'
                  }}
                >
                  <img src="/trinetra-logo.png" alt="Trinetra Online Academy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                
                <h2 style={{ fontSize: '1.38rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
                  {isVaultOpening ? '🔓 ACCESS GRANTED: વૉલ્ટ અનલોક થઈ રહ્યું છે...' : authMode === 'login' ? 'વિદ્યાર્થી પ્રવેશ (Student Login)' : '🔐 સુરક્ષિત OTP ચકાસણી'}
                </h2>
                <p style={{ color: isVaultOpening ? '#16a34a' : isThorAnimating ? '#ea580c' : '#64748b', fontSize: '0.84rem', margin: 0, fontWeight: 700, transition: 'color 0.2s' }}>
                  {isVaultOpening
                    ? '✨ BIOMETRIC VERIFIED: ડેશબોર્ડ ખૂલી રહ્યું છે...'
                    : isThorAnimating
                    ? '✨ તારાઓનો પ્રવાહ શરૂ... OTP મોકલાઈ રહ્યો છે!'
                    : authMode === 'login'
                    ? 'તમારા મોબાઈલ નંબર દ્વારા સુરક્ષિત પ્રવેશ કરો'
                    : 'મોબાઈલ પર આવેલ ૬-અંકનો OTP દાખલ કરો'}
                </p>
              </div>

              {authMode === 'login' ? (
                <form onSubmit={handleSendOTP}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b', display: 'block', marginBottom: 6 }}>
                      👤 તમારું પૂરું નામ (Full Name) *
                    </label>
                    <input
                      className="input-field rgb-input-field"
                      placeholder="દા.ત. મહેશ પટેલ..."
                      value={name}
                      onChange={e => setName(e.target.value)}
                      style={{ fontSize: '0.96rem', padding: '12px 14px', borderRadius: 10 }}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontWeight: 800, fontSize: '0.86rem', color: '#1e293b', display: 'block', marginBottom: 6 }}>
                      📱 મોબાઈલ નંબર (10 Digits Mobile) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                      <div style={{ background: '#f1f5f9', border: '1.8px solid #cbd5e1', borderRadius: 10, padding: '11px 12px', fontWeight: 800, color: '#334155', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span>🇮🇳</span> +91
                      </div>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          className="input-field rgb-input-field"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="9876543210"
                          value={mobile}
                          onChange={e => {
                            const cleaned = e.target.value.replace(/\D/g, '').replace(/^(91|0)/, '').slice(0, 10);
                            setMobile(cleaned);
                            if (authError) setAuthError('');
                          }}
                          style={{
                            fontSize: '1rem',
                            letterSpacing: '1px',
                            fontWeight: 700,
                            padding: '12px 14px',
                            paddingRight: mobile.length === 10 ? 38 : 12,
                            borderRadius: 10,
                            background: mobile.length === 10
                              ? validateIndianMobile(mobile).isValid ? '#f0fdf4' : '#fef2f2'
                              : '#ffffff',
                            width: '100%',
                            transition: 'all 0.25s',
                            boxShadow: mobile.length === 10 && validateIndianMobile(mobile).isValid ? '0 0 14px rgba(34,197,94,0.4)' : 'none'
                          }}
                          required
                        />
                        {mobile.length === 10 && validateIndianMobile(mobile).isValid && (
                          <span className="checkmark-pop" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontWeight: 900, fontSize: '1.15rem' }}>
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                    {mobile.length > 0 && mobile.length === 10 && !validateIndianMobile(mobile).isValid && (
                      <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: 4, fontWeight: 700 }}>
                        ⚠️ {validateIndianMobile(mobile).message}
                      </div>
                    )}
                  </div>

                  {authError && <p style={{ color: '#ef4444', fontSize: '0.86rem', marginBottom: 14, fontWeight: 700 }}>{authError}</p>}

                  <button type="submit" className="btn-primary btn-shimmer-effect" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '1rem', borderRadius: 10, boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }} disabled={authLoading}>
                    {authLoading ? '⏳ મોકલી રહ્યું છે...' : '📱 OTP મેળવો અને પ્રવેશ કરો →'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 16, textAlign: 'center', color: '#15803d', fontSize: '0.88rem', fontWeight: 700 }}>
                    📲 +91 {mobile} પર 6-અંકનો OTP મોકલ્યો છે
                  </div>

                  {devOtp && (
                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', marginBottom: 16, fontSize: '0.84rem', color: '#92400e', fontWeight: 800, textAlign: 'center' }}>
                      🔧 Dev Mode OTP: <strong style={{ letterSpacing: '2px', fontSize: '1rem' }}>{devOtp}</strong>
                    </div>
                  )}

                  {/* 🌟 MODERN 6-BOX SPLIT OTP INPUT WITH RGB BORDER 🌟 */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontWeight: 800, fontSize: '0.84rem', color: '#334155', display: 'block', marginBottom: 8, textAlign: 'center' }}>
                      ૬-અંકનો સુરક્ષિત OTP દાખલ કરો
                    </label>
                    <div className="otp-boxes-container" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <input
                          key={index}
                          id={`otp-box-${index}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={otp[index] || ''}
                          className={`rgb-otp-box ${otp[index] ? 'rgb-otp-box-active' : ''}`}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            const newOtpArr = (otp || '').split('');
                            newOtpArr[index] = val;
                            const combined = newOtpArr.join('').slice(0, 6);
                            setOtp(combined);
                            if (val && index < 5) {
                              document.getElementById(`otp-box-${index + 1}`)?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otp[index] && index > 0) {
                              document.getElementById(`otp-box-${index - 1}`)?.focus();
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                            setOtp(pasteData);
                            const nextFocus = Math.min(pasteData.length, 5);
                            document.getElementById(`otp-box-${nextFocus}`)?.focus();
                          }}
                          style={{
                            width: 44,
                            height: 50,
                            textAlign: 'center',
                            fontSize: '1.4rem',
                            fontWeight: 900,
                            borderRadius: 10,
                            background: otp[index] ? '#eff6ff' : '#f8fafc',
                            color: '#1e3a8a',
                            outline: 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {authError && <p style={{ color: '#ef4444', fontSize: '0.88rem', marginBottom: 14, fontWeight: 700 }}>{authError}</p>}

                  <button type="submit" className="btn-primary btn-shimmer-effect" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '1rem', borderRadius: 10, boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }} disabled={authLoading || (otp?.length !== 6)}>
                    {authLoading ? '⏳ ચકાસી રહ્યું છે...' : '✅ Verify & Dashboard ખોલો'}
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: '0.86rem' }}>
                    <button type="button" onClick={() => setAuthMode('login')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700 }}>
                      ← નંબર બદલો
                    </button>
                    
                    {otpCooldown > 0 ? (
                      <span style={{ color: '#b45309', fontWeight: 800, background: '#fef3c7', padding: '3px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                        ⏱️ {otpCooldown}s પછી Resend
                      </span>
                    ) : (
                      <button type="button" onClick={handleSendOTP} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 800 }}>
                        🔄 ફરીથી OTP મોકલો
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* 📞 DIRECT WHATSAPP HELPLINE SUPPORT BUTTON 📞 */}
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
                  કોઈ મુશ્કેલી કે પ્રશ્ન છે? સીધો સંપર્ક કરો:
                </div>
                <a
                  href="https://wa.me/918200405300?text=નમસ્તે%20Trinetra%20Academy,%20મને%20Student%20Login%20કરવામાં%20સહાય%20જોઈએ%20છે."
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(34,197,94,0.15)'
                  }}
                >
                  💬 WhatsApp Support: <strong style={{ color: '#16a34a' }}>8200405300</strong>
                </a>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

  // ─────────────────────────────────────────────────────────────
  // RENDER: FULL LOGGED IN STUDENT DASHBOARD
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={showWarpDashboard ? 'dimensional-warp-entry' : ''} style={{ minHeight: '100vh', background: '#f8fafc' }}>
      
      {/* 🔒 Cinematic Student Vault Lockdown & Homepage Transition Overlay */}
      {isLoggingOut && typeof document !== 'undefined' && createPortal(
        <div className="vault-logout-overlay">
          <div className="vault-logout-logo-box" style={{ textAlign: 'center' }}>
            <div
              className="teacher-cyber-shield"
              style={{
                width: 90,
                height: 90,
                background: '#ffffff',
                padding: 8,
                borderRadius: 28,
                boxShadow: '0 0 50px rgba(234,179,8,0.7), 0 0 90px rgba(56,189,248,0.4)',
                border: '2.5px solid #eab308'
              }}
            >
              <div className="teacher-shield-ring" />
              <div className="teacher-shield-ring-reverse" />
              <img
                src="/trinetra-logo.png"
                alt="Trinetra Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 20
                }}
              />
            </div>
            
            <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.4rem', marginTop: 16, letterSpacing: '-0.02em', textShadow: '0 0 20px rgba(255,255,255,0.4)' }}>
              🔒 સુરક્ષિત લોગઆઉટ થઈ રહ્યું છે...
            </h2>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>
              હોમ પેજ પર પુનઃદિશામાન (Redirecting to Home) ➔
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Show Navbar on Desktop, Hide on Phone when student is logged in */}
      <div className="student-desktop-navbar">
        <Navbar />
      </div>

      {/* ── TOP HERO PROFILE HEADER (DESKTOP ONLY - TEACHER DASHBOARD THEME) ── */}
      <div className="student-hero-banner" style={{ background: 'linear-gradient(135deg,#0b1329 0%,#0f172a 40%,#1e3a8a 75%,#312e81 100%)', color: 'white', padding: 'clamp(20px,3.5vw,32px) 16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        {/* Glowing ambient blur circles */}
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', top: -80, right: -40, filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(245,158,11,0.08)', bottom: -40, left: 80, filter: 'blur(40px)' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg,#38bdf8,#2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900, boxShadow: '0 8px 24px rgba(37,99,235,0.4)', border: '2px solid rgba(255,255,255,0.2)' }}>
                {(user?.name || 'S')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 'clamp(1.2rem,2.8vw,1.6rem)', fontWeight: 900, margin: 0, color: 'white' }}>
                    નમસ્તે, {user?.name || 'વિદ્યાર્થી'} 👋
                  </h1>
                  <span style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac', border: '1px solid rgba(34,197,94,0.35)', fontSize: '0.72rem', fontWeight: 800, padding: '2px 9px', borderRadius: 20 }}>
                    🎓 Active Student
                  </span>
                </div>
                <div style={{ color: '#93c5fd', fontSize: '0.82rem', marginTop: 3 }}>
                  📱 {user?.mobile} • ત્રિનેત્ર ઓનલાઈન એકેડેમી TET/TAT પોર્ટલ
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={handleRefresh} disabled={refreshing}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)' }}>
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> રીફ્રેશ
              </button>
              <button onClick={handleAnimatedLogout}
                style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          </div>

          {/* ── 4 KEY PERFORMANCE METRICS (TEACHER DASHBOARD CARDS) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            {[
              { label: 'સરેરાશ સ્કોર (Avg. %)', val: `${stats.avgScore}%`, emoji: '🎯', grad: 'linear-gradient(135deg,rgba(59,130,246,0.25),rgba(37,99,235,0.15))', border: 'rgba(59,130,246,0.35)', color: '#60a5fa' },
              { label: 'આપેલી પરીક્ષાઓ (Tests)', val: stats.totalTests, emoji: '📝', grad: 'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(5,150,105,0.15))', border: 'rgba(16,185,129,0.35)', color: '#34d399' },
              { label: 'શ્રેષ્ઠ સ્કોર (Highest)', val: `${stats.highestScore}%`, emoji: '🏆', grad: 'linear-gradient(135deg,rgba(245,158,11,0.25),rgba(217,119,6,0.15))', border: 'rgba(245,158,11,0.35)', color: '#fbbf24' },
              { label: 'કુલ મેળવેલ ગુણ (Marks)', val: stats.totalMarksObtained, emoji: '💯', grad: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(147,51,234,0.15))', border: 'rgba(168,85,247,0.35)', color: '#c084fc' },
            ].map((m, i) => (
              <div key={i} style={{ background: m.grad, border: `1px solid ${m.border}`, borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{m.label}</span>
                  <span style={{ fontSize: '1.2rem' }}>{m.emoji}</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{m.val}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── COMPACT TOP HEADER (PHONE VIEW ONLY - TEACHER DASHBOARD DARK THEME) ── */}
      <div className="student-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#38bdf8,#2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 900, boxShadow: '0 4px 12px rgba(37,99,235,0.4)' }}>
            {(user?.name || 'S')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
              {user?.name || 'વિદ્યાર્થી'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800 }}>
              {TABS.find(t => t.id === activeTab)?.icon} {TABS.find(t => t.id === activeTab)?.label}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleRefresh} disabled={refreshing} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', padding: '6px 10px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
            🔄
          </button>
          <button onClick={handleAnimatedLogout} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', padding: '6px 10px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>

      {/* ── EXACT USER MATCHING TAB NAVIGATION STRIP (DESKTOP ONLY - TEACHER DARK NAV) ── */}
      <div className="student-desktop-tabs" style={{ background: '#0b1329', borderBottom: '1.5px solid rgba(255,255,255,0.12)', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 6px 24px rgba(0,0,0,0.35)', width: '100%' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 12px', display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 6 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={isActive ? 'rgb-glow-tab-active' : ''}
                style={{
                  background: isActive
                    ? 'linear-gradient(#0b1329, #0b1329) padding-box, linear-gradient(135deg, #22c55e 0%, #eab308 25%, #ef4444 50%, #a855f7 75%, #38bdf8 100%) border-box'
                    : 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  border: isActive ? '2px solid transparent' : '2px solid transparent',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontWeight: isActive ? 900 : 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 18px rgba(56,189,248,0.45), 0 0 10px rgba(34,197,94,0.35)' : 'none',
                  fontFamily: 'Hind Vadodara, sans-serif'
                }}>
                <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.hasBadge && (
                  <span style={{
                    background: isActive ? '#38bdf8' : '#334155',
                    color: isActive ? '#0b1329' : '#e2e8f0',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    padding: '2px 7px',
                    borderRadius: 20
                  }}>
                    {submissions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div className="student-main-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 16px 60px' }}>

        {/* ── LIVE NOTIFICATION BANNER FOR UPDATED MARKS (SHOW ONLY IN RESULTS TAB) ── */}
        {(() => {
          if (activeTab !== 'results') return null;
          const updatedKeySubmissions = submissions.filter(s => s.remarks && (s.remarks.includes('Answer Key') || s.remarks.includes('પુનઃ') || s.remarks.includes('સુધારેલ')));
          if (updatedKeySubmissions.length === 0) return null;
          return (
            <div style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.14), rgba(37,99,235,0.12))',
              border: '1.5px solid rgba(124,58,237,0.35)',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 8px 24px rgba(124,58,237,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', boxShadow: '0 4px 14px rgba(124,58,237,0.35)', flexShrink: 0 }}>
                  🔔
                </div>
                <div>
                  <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>સૂચના: તમારી કસોટીના ગુણ અપડેટ થયા છે!</span>
                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: 20, border: '1px solid #86efac' }}>
                      ✓ Updated Marks
                    </span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '0.84rem', marginTop: 3 }}>
                    શિક્ષક દ્વારા Answer Key સુધારા બાદ તમારા નવા ગુણ ગણાઈ ચૂક્યા છે: <strong>{updatedKeySubmissions.map(s => `${s.testName || s.subject} (${(s.mcqScore || 0) + (Number(s.teacherMarks) || 0)}/${s.totalMarks || s.totalMCQ || 20})`).join(', ')}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('results')}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg,#7c3aed,#9333ea)',
                  padding: '9px 18px',
                  fontSize: '0.86rem',
                  border: 'none',
                  borderRadius: 9,
                  color: 'white',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                📜 સુધારેલ રિઝલ્ટ જુઓ →
              </button>
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════
            TAB 1: 🔴 લાઈવ કસોટીઓ (ULTRA ATTRACTIVE & RESPONSIVE)
        ═══════════════════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <div className="animate-fade-in">
            {/* 👑 VIP Header Banner */}
            <div className="live-header-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.45rem',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
                  flexShrink: 0,
                  position: 'relative'
                }}>
                  🔴
                  <span style={{
                    position: 'absolute',
                    top: -2, right: -2,
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: '#22c55e',
                    border: '2px solid #ffffff',
                    animation: 'pulse 1.5s infinite'
                  }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.18rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
                      લાઈવ કસોટી કેન્દ્ર (Live Exams)
                    </h2>
                    <span style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', color: '#86efac', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                      {liveTests.length} કસોટીઓ સક્રિય
                    </span>
                  </div>
                  <p style={{ color: '#93c5fd', fontSize: '0.78rem', margin: '2px 0 0', fontWeight: 600 }}>
                    શિક્ષકે સક્રિય કરેલી પરીક્ષાઓ અહીંથી સીધી આપી શકાય છે
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="live-refresh-btn"
                  title="નવી કસોટીઓ ચેક કરવા રીફ્રેશ કરો">
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                  <span>{refreshing ? 'રીફ્રેશ થઈ રહ્યું છે...' : 'રીફ્રેશ કરો'}</span>
                </button>
              </div>
            </div>

            {loadingData && liveTests.length === 0 ? (
              <div className="card" style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: 'white',
                borderRadius: 18,
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{
                  display: 'inline-block',
                  width: 44,
                  height: 44,
                  border: '4px solid #bfdbfe',
                  borderTopColor: '#2563eb',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  marginBottom: 14
                }} />
                <h3 style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.15rem', margin: '0 0 4px' }}>
                  🔴 લાઈવ કસોટીઓ લોડ થઈ રહી છે...
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                  કૃપા કરીને થોડી ક્ષણ રાહ જુઓ...
                </p>
              </div>
            ) : liveTests.length === 0 ? (
              <div className="card" style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                border: '1.5px solid #e2e8f0',
                borderRadius: 18,
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.4rem',
                  margin: '0 auto 16px',
                  boxShadow: '0 4px 16px rgba(37,99,235,0.15)'
                }}>
                  ⏳
                </div>
                <h3 style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.2rem', margin: '0 0 6px' }}>
                  હાલ કોઈ કસોટી લાઈવ નથી!
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: 420, margin: '0 auto 20px', lineHeight: 1.5 }}>
                  શિક્ષક નવી કસોટી લાઈવ કરશે એટલે તરત જ અહીં જોવા મળશે. થોડીવાર પછી નીચેના બટનથી રીફ્રેશ કરો.
                </p>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    padding: '11px 22px',
                    borderRadius: 12,
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(37,99,235,0.3)'
                  }}>
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> રીફ્રેશ કરીને ચેક કરો
                </button>
              </div>
            ) : (
              <div className="live-test-grid">
                {liveTests.map(t => {
                  const alreadyDone = submissions.some(s => s.testCode === t.testCode);

                  return (
                    <div
                      key={t.testCode}
                      className={`card live-test-card ${alreadyDone ? 'live-test-card-done' : 'live-test-card-active'} animate-fade-in`}>
                      {/* Top ambient glow strip */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 5,
                        background: alreadyDone ? '#94a3b8' : 'linear-gradient(90deg, #22c55e, #10b981, #3b82f6)'
                      }} />

                      <div>
                        {/* Status badge & Test ID */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                          {alreadyDone ? (
                            <span style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              fontSize: '0.74rem',
                              fontWeight: 900,
                              padding: '4px 12px',
                              borderRadius: 20,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              border: '1px solid #86efac'
                            }}>
                              ✓ પૂર્ણ થયેલ (Completed)
                            </span>
                          ) : (
                            <span style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 900,
                              padding: '4px 12px',
                              borderRadius: 20,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 3px 10px rgba(239,68,68,0.35)'
                            }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffffff', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                              🔴 LIVE NOW
                            </span>
                          )}
                          <span style={{
                            background: '#f8fafc',
                            color: '#1e3a8a',
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                            fontWeight: 900,
                            padding: '3px 9px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1'
                          }}>
                            ID: {t.testCode}
                          </span>
                        </div>

                        {/* Test Title */}
                        <h3 style={{
                          fontSize: '1.18rem',
                          fontWeight: 900,
                          color: '#0f172a',
                          margin: '0 0 10px',
                          lineHeight: 1.35
                        }}>
                          {t.testName}
                        </h3>

                        {/* Subject & Time Pills */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          <span style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 8,
                            border: '1px solid #bfdbfe'
                          }}>
                            📚 {t.subject}
                          </span>
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 8,
                            border: '1px solid #fde68a'
                          }}>
                            ⏱️ {t.timeLimit} મિનિટ
                          </span>
                        </div>

                        {/* 3-Box Stats Strip */}
                        <div className="live-card-stats-strip">
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700 }}>પ્રશ્નો</div>
                            <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '1rem', marginTop: 1 }}>📋 {t.questions.length}</div>
                          </div>
                          <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                            <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700 }}>કુલ ગુણ</div>
                            <div style={{ color: '#2563eb', fontWeight: 900, fontSize: '1rem', marginTop: 1 }}>💯 {t.totalMarks}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700 }}>પ્રકાર</div>
                            <div style={{ color: '#059669', fontWeight: 900, fontSize: '0.82rem', marginTop: 2 }}>{t.mcqCount}M + {t.descCount}D</div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      {alreadyDone ? (
                        <button
                          onClick={() => {
                            setActiveTab('results');
                            setResultSearch(t.testCode || t.testName);
                          }}
                          className="live-result-btn">
                          📊 તમારું પરિણામ જુઓ (View Result) →
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartExam(t.questions)}
                          className="live-start-btn">
                          <Play size={18} fill="white" /> 🚀 કસોટી શરૂ કરો (Start Test)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 2: 📜 મારી કસોટીઓ & રિઝલ્ટ (ULTRA ATTRACTIVE UI)
        ═══════════════════════════════════════════════════════ */}
        {activeTab === 'results' && (
          <div className="animate-fade-in">

            {/* 👑 1. ULTRA-LUXURY VIP RESULTS SUMMARY BANNER WITH 360° ANIMATED NEON RAINBOW BORDER */}
            <div className="vip-result-neon-box">
              <div className="vip-result-neon-inner">
                {/* Background ambient light orbs */}
                <div style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -40, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

                {/* Title & Centered Performance Level */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, marginBottom: 14, position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <span style={{ fontSize: '1.3rem' }}>📜</span>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.01em' }}>
                        મારી કસોટીઓ & પરિણામ
                      </h2>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.76rem', margin: '2px 0 0', fontWeight: 600 }}>
                      પર્ફોર્મન્સ ટ્રેકિંગ અને વિગતવાર સોલ્યુશન
                    </p>
                  </div>

                  {/* Centered Performance Pill */}
                  <div style={{
                    background: stats.avgScore >= 80 ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15))' : stats.avgScore >= 60 ? 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(37,99,235,0.15))' : 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15))',
                    border: `1.5px solid ${stats.avgScore >= 80 ? '#10b981' : stats.avgScore >= 60 ? '#3b82f6' : '#f59e0b'}`,
                    padding: '7px 18px',
                    borderRadius: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: `0 4px 16px ${stats.avgScore >= 80 ? 'rgba(16,185,129,0.3)' : stats.avgScore >= 60 ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`
                  }}>
                    <span style={{ fontSize: '1.3rem' }}>{stats.avgScore >= 80 ? '👑' : stats.avgScore >= 60 ? '🌟' : '🎯'}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.62rem', color: '#cbd5e1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>પરફોર્મન્સ લેવલ</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: stats.avgScore >= 80 ? '#34d399' : stats.avgScore >= 60 ? '#60a5fa' : '#fbbf24' }}>
                        {stats.avgScore >= 80 ? 'સુવર્ણ ટોપર (Topper)' : stats.avgScore >= 60 ? 'સ્ટાર પરફોર્મર (Star)' : 'પ્રેક્ટિસ મોડ (Need Revision)'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 VIP Glass Cards with Glowing Circular Rings in One Responsive Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, position: 'relative', zIndex: 1 }}>
                  
                  {/* 1. Average Score Card with Glowing Cyan Circular Radial Ring */}
                  {(() => {
                    const avgVal = Math.min(100, Math.max(0, stats.avgScore || 0));
                    const r = 21;
                    const circ = 2 * Math.PI * r;
                    const offset = circ - (avgVal / 100) * circ;
                    return (
                      <div style={{
                        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 58, 138, 0.4) 100%)',
                        padding: '10px 4px',
                        borderRadius: 14,
                        border: '1.5px solid rgba(56, 189, 248, 0.35)',
                        textAlign: 'center',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.35), 0 0 10px rgba(56, 189, 248, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 0
                      }}>
                        <div style={{ fontSize: '0.62rem', color: '#93c5fd', fontWeight: 800, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          🎯 સરેરાશ
                        </div>
                        
                        {/* Circular Ring */}
                        <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="54" height="54" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="27" cy="27" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" fill="none" />
                            <circle
                              cx="27" cy="27" r={r}
                              stroke="#38bdf8"
                              strokeWidth="4.5"
                              strokeDasharray={circ}
                              strokeDashoffset={offset}
                              strokeLinecap="round"
                              fill="none"
                              style={{ filter: 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.8))', transition: 'stroke-dashoffset 1s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#38bdf8', lineHeight: 1 }}>{avgVal}%</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.56rem', color: '#64748b', marginTop: 4, fontWeight: 700 }}>Avg Score</div>
                      </div>
                    );
                  })()}

                  {/* 2. Highest Score Card with Glowing Gold Circular Radial Ring */}
                  {(() => {
                    const highVal = Math.min(100, Math.max(0, stats.highestScore || 0));
                    const r = 21;
                    const circ = 2 * Math.PI * r;
                    const offset = circ - (highVal / 100) * circ;
                    return (
                      <div style={{
                        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(120, 53, 15, 0.4) 100%)',
                        padding: '10px 4px',
                        borderRadius: 14,
                        border: '1.5px solid rgba(251, 191, 36, 0.35)',
                        textAlign: 'center',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.35), 0 0 10px rgba(251, 191, 36, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 0
                      }}>
                        <div style={{ fontSize: '0.62rem', color: '#fde68a', fontWeight: 800, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          🏆 સર્વોચ્ચ
                        </div>
                        
                        {/* Circular Ring */}
                        <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="54" height="54" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="27" cy="27" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" fill="none" />
                            <circle
                              cx="27" cy="27" r={r}
                              stroke="#fbbf24"
                              strokeWidth="4.5"
                              strokeDasharray={circ}
                              strokeDashoffset={offset}
                              strokeLinecap="round"
                              fill="none"
                              style={{ filter: 'drop-shadow(0 0 5px rgba(251, 191, 36, 0.8))', transition: 'stroke-dashoffset 1s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>{highVal}%</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.56rem', color: '#64748b', marginTop: 4, fontWeight: 700 }}>Best Mark</div>
                      </div>
                    );
                  })()}

                  {/* 3. Accuracy & Precision Card with Glowing Purple Circular Radial Ring */}
                  {(() => {
                    const accVal = Math.min(100, Math.max(0, accuracyMetrics.accuracy || stats.avgScore || 0));
                    const r = 21;
                    const circ = 2 * Math.PI * r;
                    const offset = circ - (accVal / 100) * circ;
                    return (
                      <div style={{
                        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(109, 40, 217, 0.4) 100%)',
                        padding: '10px 4px',
                        borderRadius: 14,
                        border: '1.5px solid rgba(192, 132, 252, 0.35)',
                        textAlign: 'center',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.35), 0 0 10px rgba(192, 132, 252, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 0
                      }}>
                        <div style={{ fontSize: '0.62rem', color: '#e9d5ff', fontWeight: 800, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          🎯 ચોકસાઈ
                        </div>
                        
                        {/* Circular Ring */}
                        <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="54" height="54" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="27" cy="27" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" fill="none" />
                            <circle
                              cx="27" cy="27" r={r}
                              stroke="#c084fc"
                              strokeWidth="4.5"
                              strokeDasharray={circ}
                              strokeDashoffset={offset}
                              strokeLinecap="round"
                              fill="none"
                              style={{ filter: 'drop-shadow(0 0 5px rgba(192, 132, 252, 0.8))', transition: 'stroke-dashoffset 1s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#c084fc', lineHeight: 1 }}>{accVal}%</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.56rem', color: '#64748b', marginTop: 4, fontWeight: 700 }}>Accuracy</div>
                      </div>
                    );
                  })()}

                  {/* 4. Total Tests Card with Glowing Emerald Circular Radial Ring */}
                  {(() => {
                    const testsCount = submissions.length || 0;
                    const targetTests = Math.max(10, testsCount);
                    const r = 21;
                    const circ = 2 * Math.PI * r;
                    const offset = circ - Math.min(1, (testsCount / targetTests)) * circ;
                    return (
                      <div style={{
                        background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(6, 78, 59, 0.4) 100%)',
                        padding: '10px 4px',
                        borderRadius: 14,
                        border: '1.5px solid rgba(52, 211, 153, 0.35)',
                        textAlign: 'center',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.35), 0 0 10px rgba(52, 211, 153, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 0
                      }}>
                        <div style={{ fontSize: '0.62rem', color: '#a7f3d0', fontWeight: 800, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          📝 કસોટી
                        </div>
                        
                        {/* Circular Ring */}
                        <div style={{ position: 'relative', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="54" height="54" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="27" cy="27" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" fill="none" />
                            <circle
                              cx="27" cy="27" r={r}
                              stroke="#34d399"
                              strokeWidth="4.5"
                              strokeDasharray={circ}
                              strokeDashoffset={testsCount > 0 ? offset : circ}
                              strokeLinecap="round"
                              fill="none"
                              style={{ filter: 'drop-shadow(0 0 5px rgba(52, 211, 153, 0.8))', transition: 'stroke-dashoffset 1s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>{testsCount}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.56rem', color: '#64748b', marginTop: 4, fontWeight: 700 }}>Finished</div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>

            {/* 🎖️ 2. ACHIEVEMENT BADGES SUMMARY */}
            <AchievementBadges
              score={stats.totalMarksObtained}
              totalMarks={submissions.reduce((s, sub) => s + (sub.totalMarks || sub.totalMCQ || 1), 0) || 1}
              avgTimePerQ={28}
              totalSubmissions={submissions.length}
            />

            {/* 🔍 3. SEARCH & SUBJECT FILTER BAR */}
            <div className="card" style={{ padding: '14px 16px', marginBottom: 16, background: 'white', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                
                {/* Search Box */}
                <div style={{ position: 'relative', flex: '1 1 240px' }}>
                  <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={resultSearch}
                    onChange={(e) => setResultSearch(e.target.value)}
                    placeholder="કસોટીનું નામ કે વિષય શોધો..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {resultSearch && (
                    <button
                      onClick={() => setResultSearch('')}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.85rem' }}>
                      ✕
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <SlidersHorizontal size={14} /> ક્રમ:
                  </span>
                  <select
                    value={resultSortBy}
                    onChange={(e) => setResultSortBy(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 9,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#f8fafc',
                      cursor: 'pointer'
                    }}>
                    <option value="latest">⏱️ સૌથી તાજેતર (Latest)</option>
                    <option value="score_high">🏆 સૌથી વધુ ગુણ (Highest)</option>
                    <option value="score_low">📉 સૌથી ઓછા ગુણ (Lowest)</option>
                  </select>
                </div>
              </div>

              {/* Subject Filter Pills */}
              {uniqueSubjects.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', overflowX: 'auto', paddingBottom: 4 }}>
                  <button
                    onClick={() => setResultSubjectFilter('all')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: resultSubjectFilter === 'all' ? '1.5px solid #1e3a8a' : '1px solid #e2e8f0',
                      background: resultSubjectFilter === 'all' ? '#1e3a8a' : '#f8fafc',
                      color: resultSubjectFilter === 'all' ? 'white' : '#475569',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}>
                    📚 બધા વિષયો ({submissions.length})
                  </button>
                  {uniqueSubjects.map(subj => {
                    const count = submissions.filter(s => s.subject === subj).length;
                    const isActive = resultSubjectFilter === subj;
                    return (
                      <button
                        key={subj}
                        onClick={() => setResultSubjectFilter(subj)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 20,
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          border: isActive ? '1.5px solid #1e3a8a' : '1px solid #e2e8f0',
                          background: isActive ? '#1e3a8a' : '#f8fafc',
                          color: isActive ? 'white' : '#475569',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}>
                        {subj} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 📇 4. RESULT CARDS LIST (CLEAN, MODERN, LUXURY MOBILE-OPTIMIZED) */}
            {filteredSubmissions.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', background: 'white' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
                <h3 style={{ color: '#0f172a', fontWeight: 800 }}>કોઈ પરિણામ મળ્યું નથી</h3>
                <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 16 }}>
                  {resultSearch || resultSubjectFilter !== 'all' ? 'તમારા સર્ચ કે ફિલ્ટર અનુસાર કોઈ કસોટી નથી.' : 'તમે હજુ સુધી કોઈ પરીક્ષા આપી નથી.'}
                </p>
                {resultSearch || resultSubjectFilter !== 'all' ? (
                  <button onClick={() => { setResultSearch(''); setResultSubjectFilter('all'); }} className="btn-primary" style={{ display: 'inline-flex' }}>
                    🔄 ફિલ્ટર રીસેટ કરો
                  </button>
                ) : (
                  <button onClick={() => setActiveTab('live')} className="btn-primary" style={{ display: 'inline-flex' }}>
                    🔴 Live કસોટીઓ જુઓ →
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredSubmissions.map(sub => {
                  const score = (sub.mcqScore || 0) + (sub.teacherMarks || 0);
                  const total = sub.totalMarks || (sub.totalMCQ || 1);
                  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
                  const isGraded = sub.teacherMarks !== null && sub.teacherMarks !== undefined;
                  const hasPhoto = !!sub.photoUrl;

                  const isTopper = pct >= 85;
                  const isPass = pct >= 50;

                  return (
                    <div
                      key={sub.id}
                      className="card result-card-item animate-fade-in"
                      style={{
                        padding: '16px 16px',
                        background: isTopper 
                          ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' 
                          : isPass 
                            ? 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)' 
                            : '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderLeft: `5px solid ${isTopper ? '#10b981' : isPass ? '#2563eb' : '#ef4444'}`,
                        borderRadius: 14,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}>
                      
                      {/* Top Meta Line: Subject + Test ID on left, Date & Distinction on right */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                            📚 {sub.subject || 'કસોટી'}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 6 }}>
                            ID: {sub.testCode}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: isTopper ? '#dcfce7' : isPass ? '#eff6ff' : '#fee2e2',
                            color: isTopper ? '#166534' : isPass ? '#1e40af' : '#991b1b',
                            border: `1px solid ${isTopper ? '#86efac' : isPass ? '#bfdbfe' : '#fca5a5'}`
                          }}>
                            {isTopper ? '👑 ઉત્કૃષ્ટ' : isPass ? '🌟 પાસ' : '📖 વધુ મહેનત'}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={11} /> {new Date(sub.submittedAt).toLocaleDateString('gu-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Middle: Test Name + Accuracy Snapshot Chips */}
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', lineHeight: 1.35 }}>
                          {sub.testName}
                        </h3>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                            🟢 {sub.correctCount != null ? sub.correctCount : (sub.mcqScore || 0)} સાચા
                          </span>
                          {sub.totalMCQ > 0 && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                              🔴 {sub.wrongCount != null ? sub.wrongCount : Math.max(0, (sub.totalMCQ || 0) - (sub.mcqScore || 0))} ખોટા
                            </span>
                          )}
                          {Number(sub.negativeMarks) > 0 && (
                            <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #f87171', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                              ➖ નેગેટિવ કપાત: -{sub.negativeMarks}
                            </span>
                          )}
                          {hasPhoto && (
                            <span style={{ background: isGraded ? '#dbeafe' : '#fef3c7', color: isGraded ? '#1e40af' : '#92400e', border: `1px solid ${isGraded ? '#bfdbfe' : '#fde68a'}`, padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                              {isGraded ? `📝 વર્ણાત્મક: +${sub.teacherMarks}` : '⏳ શિક્ષક તપાસણી'}
                            </span>
                          )}
                        </div>

                        {sub.remarks && (
                          <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 10px', fontSize: '0.76rem', color: '#92400e', fontWeight: 700, lineHeight: 1.4 }}>
                            👨‍🏫 {sub.remarks}
                          </div>
                        )}
                      </div>

                      {/* Full-Width Score & Progress Banner */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0', borderRadius: 12, padding: '8px 14px', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CircularScoreGauge score={score} total={total} percentage={pct} />
                          <div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>મેળવેલ ગુણ</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#1e3a8a', lineHeight: 1.1 }}>{score} / {total}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>પરિણામ સ્થિતિ</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isPass ? '#16a34a' : '#dc2626', marginTop: 1 }}>
                            {isPass ? '🟢 પાસ (Passed)' : '🔴 વધુ પ્રેક્ટિસ જરૂરી'}
                          </div>
                        </div>
                      </div>

                      {/* Full Touch Action Buttons Strip (Clean Single Icons) */}
                      <div className="result-card-actions" style={{ display: 'flex', gap: 8, marginTop: 2, paddingTop: 8, borderTop: '1px dashed #e2e8f0', width: '100%' }}>
                        
                        <button 
                          onClick={() => handleOpenReview(sub.id)}
                          style={{
                            flex: 1,
                            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 12px',
                            borderRadius: 10,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                            transition: 'all 0.15s ease'
                          }}>
                          <Eye size={15} /> સોલ્યુશન જુઓ
                        </button>

                        <button 
                          onClick={() => handleInitiateWhatsAppSend(sub)}
                          disabled={sendingWaSubId === sub.id}
                          style={{
                            flex: 1,
                            background: sendingWaSubId === sub.id ? 'linear-gradient(135deg, #475569 0%, #334155 100%)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 12px',
                            borderRadius: 10,
                            fontWeight: 800,
                            cursor: sendingWaSubId === sub.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.82rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                            transition: 'all 0.15s ease'
                          }}>
                          {sendingWaSubId === sub.id ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" /> મોકલાઈ રહ્યું છે...
                            </>
                          ) : (
                            <>
                              <Smartphone size={15} /> WhatsApp PDF મેળવો
                            </>
                          )}
                        </button>

                        {hasPhoto && (
                          <button 
                            onClick={() => setPreviewPhotoSub(sub)}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '10px 10px',
                              borderRadius: 10,
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4
                            }}>
                            <ImageIcon size={14} /> ઉત્તરવહી
                          </button>
                        )}

                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 3: 📊 પ્રગતિ એનાલિટિક્સ & ગ્રાફ્સ (GRAPHS & CHARTS)
        ═══════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (() => {
          const avgPercentage = testTrendData.length > 0
            ? Math.round(testTrendData.reduce((acc, t) => acc + (t.percentage || 0), 0) / testTrendData.length)
            : 0;
          const performanceGrade = avgPercentage >= 80 ? 'A+ (ઉત્કૃષ્ટ)' : avgPercentage >= 70 ? 'A (ખૂબ સરસ)' : avgPercentage >= 50 ? 'B (સરેરાશ)' : 'C (સુધારણા જરૂર)';

          return (
            <div className="animate-fade-in">
              {/* 👑 VIP Header Banner */}
              <div className="pragati-header-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.45rem',
                    boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
                    flexShrink: 0
                  }}>
                    📈
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.18rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
                      પ્રગતિ એનાલિટિક્સ & પરફોર્મન્સ હબ
                    </h2>
                    <p style={{ color: '#93c5fd', fontSize: '0.78rem', margin: '2px 0 0', fontWeight: 600 }}>
                      કસોટી સ્કોર ટ્રેન્ડ, વિષયવાર પર્સેન્ટેજ અને એક્યુરેસીનું સ્માર્ટ વિશ્લેષણ
                    </p>
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleSendPragatiWhatsApp}
                    disabled={sendingPragatiWa || !submissions.length}
                    className="pragati-wa-btn"
                    style={{
                      opacity: sendingPragatiWa ? 0.75 : 1,
                      cursor: sendingPragatiWa ? 'not-allowed' : 'pointer'
                    }}>
                    {sendingPragatiWa
                      ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> ⏳ WhatsApp પર મોકલી રહ્યા...</>
                      : <>📲 WhatsApp માં મેળવો</>
                    }
                  </button>
                </div>
              </div>

              {submissions.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', background: 'white' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📊</div>
                  <h3 style={{ color: '#0f172a', fontWeight: 800 }}>કોઈ ગ્રાફ ડેટા ઉપલબ્ધ નથી</h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 16 }}>
                    તમે પરીક્ષા આપશો એટલે તરત જ તમારો લાઈવ સ્કોર ગ્રાફ અહીં જનરેટ થઈ જશે!
                  </p>
                  <button onClick={() => setActiveTab('live')} className="btn-primary" style={{ display: 'inline-flex' }}>
                    🔴 Live કસોટી આપો →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* ── ⚡ 4 Quick Summary Stat Cards (Desktop 4 in row, Mobile 2x2 Grid) ── */}
                  <div className="pragati-stats-grid">
                    <div className="card pragati-stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', border: '1.5px solid #bfdbfe' }}>
                      <div className="stat-icon-wrap" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                        📊
                      </div>
                      <div>
                        <div className="stat-label" style={{ color: '#1e40af' }}>કુલ કસોટીઓ</div>
                        <div className="stat-value">{submissions.length} ટેસ્ટ</div>
                      </div>
                    </div>

                    <div className="card pragati-stat-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', border: '1.5px solid #bbf7d0' }}>
                      <div className="stat-icon-wrap" style={{ background: '#dcfce7', color: '#15803d' }}>
                        ⭐
                      </div>
                      <div>
                        <div className="stat-label" style={{ color: '#15803d' }}>સરેરાશ ટકાવારી</div>
                        <div className="stat-value">{avgPercentage}%</div>
                      </div>
                    </div>

                    <div className="card pragati-stat-card" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)', border: '1.5px solid #e9d5ff' }}>
                      <div className="stat-icon-wrap" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                        🎯
                      </div>
                      <div>
                        <div className="stat-label" style={{ color: '#7e22ce' }}>ચોકસાઈ (Accuracy)</div>
                        <div className="stat-value">{accuracyMetrics.accuracy}%</div>
                      </div>
                    </div>

                    <div className="card pragati-stat-card" style={{ background: 'linear-gradient(135deg, #fefce8 0%, #ffffff 100%)', border: '1.5px solid #fef08a' }}>
                      <div className="stat-icon-wrap" style={{ background: '#fef9c3', color: '#a16207' }}>
                        🏆
                      </div>
                      <div>
                        <div className="stat-label" style={{ color: '#a16207' }}>પરફોર્મન્સ ગ્રેડ</div>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>{performanceGrade.split(' ')[0]}</div>
                      </div>
                    </div>
                  </div>

                  {/* ── 📊 1. MODERN VERTICAL BAR CHART: NO HORIZONTAL SCROLL ON MOBILE ── */}
                  <div className="card pragati-chart-card animate-fade-in">
                  
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '1.25rem' }}>📊</span>
                      <div>
                        <h3 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                          કસોટી-દર-કસોટી સ્કોર બાર ચાર્ટ (Score Bar Chart)
                        </h3>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1 }}>
                          તમારા મેળવેલ ગુણ અને ટકાવારીની સરખામણી (%):
                        </div>
                      </div>
                    </div>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
                      {testTrendData.length} કસોટીઓ
                    </span>
                  </div>

                  {/* 100% Fluid Responsive Bar Chart Area (Zero Horizontal Scroll on Phone) */}
                  <div style={{ width: '100%', boxSizing: 'border-box' }}>
                    
                    {/* Grid & Bars Container */}
                    <div style={{ display: 'flex', height: 210, position: 'relative', width: '100%' }}>
                      
                      {/* Left Y-Axis Grid Labels */}
                      <div style={{ width: 34, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: 6, textAlign: 'right', userSelect: 'none', height: 160, flexShrink: 0 }}>
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#15803d' }}>100%</span>
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8' }}>75%</span>
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8' }}>50%</span>
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#94a3b8' }}>25%</span>
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#b91c1c' }}>0%</span>
                      </div>

                      {/* Plot Area with Horizontal Grid Lines */}
                      <div style={{ flex: 1, position: 'relative', height: 160, borderLeft: '1.5px solid #cbd5e1', borderBottom: '2px solid #64748b', minWidth: 0 }}>
                        
                        {/* 5 Reference Grid Lines */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }} />
                        <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderTop: '1px dashed #f1f5f9' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #cbd5e1' }} />
                        <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderTop: '1px dashed #f1f5f9' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid #94a3b8' }} />

                        {/* Fluid Bars Row */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 4px' }}>
                          {testTrendData.map((d, i) => {
                            const clamped = Math.min(100, Math.max(0, d.percentage || 0));
                            // Bar height in pixels (max 150px for 100%)
                            const barHeight = Math.max(6, (clamped / 100) * 150);
                            const isGreen = clamped >= 70;
                            const isAmber = clamped >= 50 && clamped < 70;
                            const barColor = isGreen
                              ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                              : isAmber
                                ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                                : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)';
                            const badgeBg = isGreen ? '#dcfce7' : isAmber ? '#fef3c7' : '#fee2e2';
                            const badgeText = isGreen ? '#15803d' : isAmber ? '#b45309' : '#b91c1c';
                            const badgeBorder = isGreen ? '#86efac' : isAmber ? '#fde68a' : '#fca5a5';

                            const barWidth = testTrendData.length <= 4 ? 34 : testTrendData.length <= 6 ? 26 : 18;

                            return (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  flex: 1,
                                  maxWidth: 68,
                                  minWidth: 0,
                                  height: '100%',
                                  justifyContent: 'flex-end',
                                  position: 'relative'
                                }}
                              >
                                {/* Floating Top Score Pill */}
                                <div
                                  style={{
                                    marginBottom: 4,
                                    background: badgeBg,
                                    color: badgeText,
                                    border: `1px solid ${badgeBorder}`,
                                    borderRadius: 6,
                                    padding: '1px 4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 900,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                                    textAlign: 'center',
                                    lineHeight: 1.15
                                  }}
                                >
                                  <div>{clamped}%</div>
                                  <div style={{ fontSize: '0.58rem', opacity: 0.85 }}>{d.score}/{d.total}</div>
                                </div>

                                {/* Vertical Pillar Bar */}
                                <div
                                  style={{
                                    width: `${barWidth}px`,
                                    height: `${barHeight}px`,
                                    background: barColor,
                                    borderRadius: '6px 6px 2px 2px',
                                    boxShadow: isGreen
                                      ? '0 3px 10px rgba(16,185,129,0.3)'
                                      : isAmber
                                        ? '0 3px 10px rgba(245,158,11,0.3)'
                                        : '0 3px 10px rgba(239,68,68,0.3)',
                                    transition: 'height 0.8s ease',
                                    cursor: 'pointer',
                                    position: 'relative'
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    </div>

                    {/* X-Axis Labels Row (Fluid alignment under bars) */}
                    <div style={{ display: 'flex', marginLeft: 34, padding: '8px 4px 0', justifyContent: 'space-around' }}>
                      {testTrendData.map((d, i) => (
                        <div key={i} style={{ flex: 1, maxWidth: 68, minWidth: 0, textAlign: 'center' }}>
                          <div
                            style={{
                              background: '#f1f5f9',
                              color: '#1e293b',
                              fontWeight: 900,
                              fontSize: '0.72rem',
                              padding: '1px 6px',
                              borderRadius: 5,
                              display: 'inline-block',
                              border: '1px solid #cbd5e1'
                            }}
                          >
                            T{d.testNum}
                          </div>
                          <div
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#334155',
                              marginTop: 2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              width: '100%'
                            }}
                            title={d.testName}
                          >
                            {d.testName || 'કસોટી ' + d.testNum}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: 1 }}>
                            {d.date}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Bottom Chart Legend Bar */}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9', fontSize: '0.72rem', fontWeight: 800 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981' }} />
                      <span style={{ color: '#166534' }}>૭૦%+ (ઉત્કૃષ્ટ)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b' }} />
                      <span style={{ color: '#b45309' }}>૫૦%-૬૯% (સરેરાશ)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} />
                      <span style={{ color: '#991b1b' }}>૫૦%થી ઓછા</span>
                    </div>
                  </div>

                </div>

                {/* ── 🥧 2. SUBJECT DISTRIBUTION PIE CHART WITH DIRECT LABELS & LEGENDS ── */}
                <div className="card pragati-chart-card animate-fade-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.4rem' }}>🥧</span>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                          વિષયવાર ગુણ વિતરણ પાઈ ચાર્ટ (Subject Distribution)
                        </h3>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                          તમારી કસોટીઓ અને ગુણમાં દરેક વિષયનો હિસ્સો (% Share of Subjects):
                        </div>
                      </div>
                    </div>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>
                      {subjectAnalytics.length} વિષયો વિશ્લેષિત
                    </span>
                  </div>

                  {(() => {
                    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ea580c', '#6366f1'];
                    const totalWeight = subjectAnalytics.reduce((sum, s) => sum + (s.count || 1), 0) || 1;

                    let currentPercent = 0;
                    let cumulativeAngle = 0;
                    const gradientSegments = [];

                    const slices = subjectAnalytics.map((sub, idx) => {
                      const count = sub.count || 1;
                      const pct = Math.max(1, Math.round((count / totalWeight) * 100));
                      const color = colors[idx % colors.length];

                      const startP = currentPercent;
                      const endP = idx === subjectAnalytics.length - 1 ? 100 : Math.min(100, currentPercent + (count / totalWeight) * 100);
                      currentPercent = endP;

                      gradientSegments.push(`${color} ${startP.toFixed(1)}% ${endP.toFixed(1)}%`);

                      const sliceAngle = (count / totalWeight) * 360;
                      const midAngle = cumulativeAngle + sliceAngle / 2;
                      cumulativeAngle += sliceAngle;

                      // Position for label tag around the pie
                      const rad = Math.PI / 180;
                      const labelRadius = 90; // distance from center (140, 140)
                      const labelX = 140 + labelRadius * Math.cos((-90 + midAngle) * rad);
                      const labelY = 140 + labelRadius * Math.sin((-90 + midAngle) * rad);

                      return {
                        subject: sub.subject,
                        count: sub.count,
                        score: sub.totalScore,
                        max: sub.totalMax,
                        pct,
                        color,
                        scorePct: sub.pct,
                        labelX,
                        labelY,
                        midAngle
                      };
                    });

                    const conicStyle = gradientSegments.length > 0
                      ? `conic-gradient(${gradientSegments.join(', ')})`
                      : '#2563eb';

                    return (
                      <div>
                        {/* Top: Donut Chart with Floating Slice Labels */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                          <div style={{ position: 'relative', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            
                            {/* Main Conic Donut Circle */}
                            <div style={{
                              width: 210, height: 210,
                              borderRadius: '50%',
                              background: conicStyle,
                              boxShadow: '0 10px 28px rgba(0,0,0,0.12), inset 0 0 0 3px rgba(255,255,255,0.9)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              position: 'relative'
                            }}>
                              {/* Inner White Cutout */}
                              <div style={{
                                width: 110, height: 110,
                                borderRadius: '50%',
                                background: '#ffffff',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                textAlign: 'center'
                              }}>
                                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e3a8a', lineHeight: 1.1 }}>
                                  {subjectAnalytics.length}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 800, marginTop: 2 }}>
                                  વિષયો
                                </div>
                              </div>
                            </div>

                            {/* Direct Slice Labels / Tags Floating Around the Donut */}
                            {slices.map((s, i) => (
                              <div
                                key={i}
                                style={{
                                  position: 'absolute',
                                  left: s.labelX,
                                  top: s.labelY,
                                  transform: 'translate(-50%, -50%)',
                                  background: 'rgba(255, 255, 255, 0.95)',
                                  border: `1.5px solid ${s.color}`,
                                  boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
                                  padding: '3px 8px',
                                  borderRadius: 20,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  whiteSpace: 'nowrap',
                                  zIndex: 10,
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  color: '#0f172a'
                                }}
                              >
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                <span>{s.subject}</span>
                                <span style={{ color: s.color, fontWeight: 900 }}>({s.pct}%)</span>
                              </div>
                            ))}

                          </div>
                        </div>

                        {/* Bottom: Detailed Color-Coded Subject Cards Matrix */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: 12,
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: 18
                        }}>
                          {slices.map((s, i) => (
                            <div
                              key={i}
                              style={{
                                background: '#f8fafc',
                                border: `1.5px solid ${s.color}30`,
                                borderLeft: `4px solid ${s.color}`,
                                borderRadius: 10,
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                                  📚 {s.subject}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                                  {s.count} કસોટી(ઓ) • મેળવેલ ગુણ: {s.score}/{s.max}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color }}>
                                  {s.pct}%
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 800 }}>
                                  {s.scorePct}% સ્કોર
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                      </div>
                    );
                  })()}
                </div>

                {/* ── 2. TWO-COLUMN: SUBJECT MASTERY BARS & ACCURACY GAUGE ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
                  
                  {/* Left: Subject-wise Vertical Bar Comparison Chart */}
                  <div className="card" style={{ padding: 22, background: 'white', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <span style={{ fontSize: '1.2rem' }}>📊</span>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                        વિષયવાર ગુણ સરખામણી (Subject Comparison)
                      </h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {subjectAnalytics.map((sub, i) => {
                        const isHigh = sub.pct >= 70;
                        const isMed = sub.pct >= 50 && sub.pct < 70;
                        const gradColor = isHigh ? 'linear-gradient(90deg,#059669,#10b981)' : isMed ? 'linear-gradient(90deg,#d97706,#f59e0b)' : 'linear-gradient(90deg,#dc2626,#ef4444)';

                        return (
                          <div key={i}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                                📚 {sub.subject}
                              </span>
                              <span style={{ fontSize: '0.92rem', fontWeight: 900, color: isHigh ? '#15803d' : isMed ? '#b45309' : '#b91c1c' }}>
                                {sub.pct}% <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>({sub.totalScore}/{sub.totalMax} ગુણ)</span>
                              </span>
                            </div>
                            <div style={{ height: 12, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ width: `${sub.pct}%`, height: '100%', background: gradColor, borderRadius: 10, transition: 'width 0.8s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Accuracy & Overall Performance Gauge */}
                  <div className="card" style={{ padding: 22, background: 'white', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <span style={{ fontSize: '1.2rem' }}>🎯</span>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                          ચોકસાઈ દર (Accuracy & Precision Rate)
                        </h3>
                      </div>

                      {/* Donut Metric Display */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0' }}>
                        <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="140" height="140" viewBox="0 0 140 140">
                            <circle cx="70" cy="70" r="54" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                            <circle cx="70" cy="70" r="54" fill="none" stroke="#2563eb" strokeWidth="12"
                              strokeDasharray={`${(accuracyMetrics.accuracy / 100) * 339.29} 339.29`}
                              strokeDashoffset="0"
                              strokeLinecap="round"
                              transform="rotate(-90 70 70)"
                              style={{ transition: 'stroke-dasharray 1s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1e3a8a' }}>
                              {accuracyMetrics.accuracy}%
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>
                              Accuracy
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#f8fafc', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>✓ સાચા જવાબો</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#15803d' }}>{accuracyMetrics.correctMCQ}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 700 }}>✕ ખોટા જવાબો</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#b91c1c' }}>{accuracyMetrics.wrongMCQ}</div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── 3. STRENGTH & FOCUS RECOMMENDATIONS MATRIX ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
                  
                  {/* Strong Subjects */}
                  <div className="card" style={{ padding: 18, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>🌟</span>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#166534' }}>
                        તમારા મજબૂત વિષયો (Strong Areas)
                      </h4>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#15803d', lineHeight: 1.6 }}>
                      {subjectAnalytics.filter(s => s.pct >= 65).length > 0 ? (
                        subjectAnalytics.filter(s => s.pct >= 65).map((s, idx) => (
                          <div key={idx}>• <strong>{s.subject} ({s.pct}%):</strong> ઉત્કૃષ્ટ પકડ છે, આ વિષયમાં ઝડપ વધારો!</div>
                        ))
                      ) : (
                        <div>નિયમિત ટેસ્ટ આપવાથી તમારા મજબૂત વિષયોનું લિસ્ટ અહીં દેખાશે.</div>
                      )}
                    </div>
                  </div>

                  {/* Needs Improvement */}
                  <div className="card" style={{ padding: 18, background: '#fffbeb', border: '1.5px solid #fde68a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>💡</span>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 900, color: '#92400e' }}>
                        વધુ ધ્યાન આપવા જેવો વિષય (Focus Areas)
                      </h4>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#b45309', lineHeight: 1.6 }}>
                      {subjectAnalytics.filter(s => s.pct < 65).length > 0 ? (
                        subjectAnalytics.filter(s => s.pct < 65).map((s, idx) => (
                          <div key={idx}>• <strong>{s.subject} ({s.pct}%):</strong> આ વિષયના પ્રકરણોનું રિવિઝન કરી ફરી મોક ટેસ્ટ આપો.</div>
                        ))
                      ) : (
                        <div>તમામ વિષયોમાં તમારું પ્રદર્શન ઘણું સારું છે! અભિનંદન!</div>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        );
      })()}

        {/* ═══════════════════════════════════════════════════════
            TAB 4: 🏆 લીડરબોર્ડ (ULTRA-ATTRACTIVE VIP UI)
        ═══════════════════════════════════════════════════════ */}
        {activeTab === 'leaderboard' && (
          <div className="animate-fade-in">
            {/* 👑 VIP Leaderboard Header Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0b1329 0%, #1e293b 50%, #1e3a8a 100%)',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 16,
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 8px 24px rgba(11,19,41,0.3), 0 0 16px rgba(245,158,11,0.15)',
              border: '1px solid rgba(255,255,255,0.12)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Background ambient gold orb */}
              <div style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 130,
                height: 130,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                  flexShrink: 0,
                  border: '1.5px solid rgba(255,255,255,0.3)'
                }}>
                  🏆
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.22rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
                      ટેસ્ટ-wise લીડરબોર્ડ (Leaderboard)
                    </h2>
                    <span style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.2))',
                      border: '1px solid #f59e0b',
                      color: '#fef08a',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12
                    }}>
                      ⭐ ટોપ રેન્કર્સ
                    </span>
                  </div>
                  <p style={{ color: '#93c5fd', fontSize: '0.78rem', margin: '2px 0 0', fontWeight: 600 }}>
                    કસોટી પસંદ કરી ટોચના તેજસ્વી વિદ્યાર્થીઓનું પરિણામ જુઓ
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative', zIndex: 1 }}>
                <span style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(4px)'
                }}>
                  🎯 {testWiseLeaderboard.length} કસોટીઓ ઉપલબ્ધ
                </span>
              </div>
            </div>

            <LeaderboardUI
              tests={testWiseLeaderboard}
              loading={loadingData}
              currentUserName={user?.name}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 5: 📁 સ્ટડી મટીરીયલ (ULTRA-MODERN DYNAMIC UI)
        ═══════════════════════════════════════════════════════ */}
        {activeTab === 'materials' && (() => {
          const displayList = materialsList.length > 0 ? materialsList : STUDY_MATERIALS;
          const distinctSubjects = Array.from(new Set(displayList.map(m => m.subject).filter(Boolean)));
          const modelPapersCount = displayList.filter(m => m.fileType === 'Model Paper' || m.type === 'PDF Paper').length;
          const specialTagCount = displayList.filter(m => Boolean(m.tag)).length;

          const getStudentSubjectMeta = (subject = '', type = '') => {
            const sub = (subject || '').toLowerCase();
            if (sub.includes('વિજ્ઞાન') || sub.includes('science')) {
              return {
                icon: '🔬',
                bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                border: '1.5px solid #86efac',
                badgeBg: '#dcfce7',
                badgeColor: '#166534',
                badgeBorder: '#bbf7d0',
                accentColor: '#15803d',
                btnGrad: 'linear-gradient(135deg, #059669, #10b981)'
              };
            }
            if (sub.includes('ગણિત') || sub.includes('math')) {
              return {
                icon: '📐',
                bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
                border: '1.5px solid #93c5fd',
                badgeBg: '#dbeafe',
                badgeColor: '#1e40af',
                badgeBorder: '#bfdbfe',
                accentColor: '#1d4ed8',
                btnGrad: 'linear-gradient(135deg, #1d4ed8, #2563eb)'
              };
            }
            if (sub.includes('ગુજરાતી') || sub.includes('ભાષા') || sub.includes('guj')) {
              return {
                icon: '📖',
                bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
                border: '1.5px solid #fde68a',
                badgeBg: '#fef3c7',
                badgeColor: '#92400e',
                badgeBorder: '#fde68a',
                accentColor: '#b45309',
                btnGrad: 'linear-gradient(135deg, #d97706, #f59e0b)'
              };
            }
            if (sub.includes('સામ') || sub.includes('સામાજિક') || sub.includes('social') || sub.includes('gk')) {
              return {
                icon: '🌍',
                bgGradient: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)',
                border: '1.5px solid #99f6e4',
                badgeBg: '#ccfbf1',
                badgeColor: '#115e59',
                badgeBorder: '#99f6e4',
                accentColor: '#0f766e',
                btnGrad: 'linear-gradient(135deg, #0d9488, #14b8a6)'
              };
            }
            if (type === 'Model Paper' || sub.includes('tet') || sub.includes('tat')) {
              return {
                icon: '📋',
                bgGradient: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)',
                border: '1.5px solid #d8b4fe',
                badgeBg: '#f3e8ff',
                badgeColor: '#6b21a8',
                badgeBorder: '#e9d5ff',
                accentColor: '#7e22ce',
                btnGrad: 'linear-gradient(135deg, #7e22ce, #a855f7)'
              };
            }
            return {
              icon: '📁',
              bgGradient: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
              border: '1.5px solid #cbd5e1',
              badgeBg: '#e2e8f0',
              badgeColor: '#334155',
              badgeBorder: '#cbd5e1',
              accentColor: '#2563eb',
              btnGrad: 'linear-gradient(135deg, #2563eb, #38bdf8)'
            };
          };

          const filtered = displayList.filter(mat => {
            const search = materialSearch.trim().toLowerCase();
            const matchesSearch = !search ||
              mat.title?.toLowerCase().includes(search) ||
              mat.subject?.toLowerCase().includes(search) ||
              mat.tag?.toLowerCase().includes(search);
            const matchesSub = materialSubjectFilter === 'ALL' || mat.subject === materialSubjectFilter;
            return matchesSearch && matchesSub;
          });

          return (
            <div className="animate-fade-in">
              {/* Header Title Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 16,
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                boxShadow: '0 6px 20px rgba(11,19,41,0.25)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    boxShadow: '0 4px 12px rgba(56,189,248,0.3)',
                    flexShrink: 0
                  }}>
                    📁
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.18rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
                      સ્ટડી મટીરીયલ અને મોડેલ પેપર્સ
                    </h2>
                    <p style={{ color: '#93c5fd', fontSize: '0.78rem', margin: '2px 0 0', fontWeight: 600 }}>
                      TET-1 / TET-2 / TAT માટેના મહત્વપૂર્ણ PDF પુસ્તકો & શોર્ટ નોટ્સ
                    </p>
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  color: '#fde047',
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: '1px solid rgba(253,224,71,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  ✨ <span>{filtered.length} ફાઇલો ઉપલબ્ધ</span>
                </div>
              </div>

              {/* ── 3 Quick Stats Mini Cards (Responsive Mobile 3-in-Row) ── */}
              <div className="material-stats-grid">
                <div className="card material-stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', border: '1.5px solid #bfdbfe' }}>
                  <div className="stat-icon-wrap" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                    📁
                  </div>
                  <div>
                    <div className="stat-label" style={{ color: '#1e40af' }}>કુલ સાહિત્ય</div>
                    <div className="stat-value">{displayList.length} PDFs</div>
                  </div>
                </div>

                <div className="card material-stat-card" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)', border: '1.5px solid #e9d5ff' }}>
                  <div className="stat-icon-wrap" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                    📋
                  </div>
                  <div>
                    <div className="stat-label" style={{ color: '#6b21a8' }}>મોડેલ પેપર્સ</div>
                    <div className="stat-value">{modelPapersCount} સેટ</div>
                  </div>
                </div>

                <div className="card material-stat-card" style={{ background: 'linear-gradient(135deg, #fefce8 0%, #ffffff 100%)', border: '1.5px solid #fef08a' }}>
                  <div className="stat-icon-wrap" style={{ background: '#fef9c3', color: '#854d0e' }}>
                    ⭐
                  </div>
                  <div>
                    <div className="stat-label" style={{ color: '#854d0e' }}>IMP નોટ્સ</div>
                    <div className="stat-value">{specialTagCount} ફાઇલો</div>
                  </div>
                </div>
              </div>

              {/* ── Search & Horizontal Carousel Pills ── */}
              <div className="card" style={{ padding: '12px 14px', marginBottom: 16, background: 'white', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '9px 14px', borderRadius: 12, border: '1.5px solid #e2e8f0' }}>
                  <Search size={17} color="#64748b" />
                  <input
                    type="text"
                    placeholder="મટીરીયલ અથવા વિષય શોધો..."
                    value={materialSearch}
                    onChange={e => setMaterialSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.88rem', color: '#0f172a', background: 'transparent' }}
                  />
                  {materialSearch && (
                    <button
                      onClick={() => setMaterialSearch('')}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}>
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Scrollable Pills Carousel */}
                <div className="material-pill-carousel">
                  <button
                    onClick={() => setMaterialSubjectFilter('ALL')}
                    className={`material-pill-btn ${materialSubjectFilter === 'ALL' ? 'active' : ''}`}
                    style={{
                      background: materialSubjectFilter === 'ALL' ? 'linear-gradient(135deg, #1e3a8a, #2563eb)' : '#f1f5f9',
                      color: materialSubjectFilter === 'ALL' ? 'white' : '#475569',
                      borderColor: materialSubjectFilter === 'ALL' ? '#2563eb' : '#e2e8f0'
                    }}>
                    🌟 તમામ ({displayList.length})
                  </button>
                  {distinctSubjects.map(sub => {
                    const isActive = materialSubjectFilter === sub;
                    const meta = getStudentSubjectMeta(sub);
                    return (
                      <button
                        key={sub}
                        onClick={() => setMaterialSubjectFilter(sub)}
                        className={`material-pill-btn ${isActive ? 'active' : ''}`}
                        style={{
                          background: isActive ? meta.btnGrad : '#f1f5f9',
                          color: isActive ? 'white' : '#334155',
                          borderColor: isActive ? meta.accentColor : '#e2e8f0'
                        }}>
                        <span>{meta.icon}</span> {sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Material Cards Grid */}
              {filtered.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', background: 'white', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>🔍</div>
                  <h3 style={{ color: '#0f172a', fontWeight: 800, marginBottom: 4 }}>કોઈ મટીરીયલ મળ્યું નથી</h3>
                  <p style={{ color: '#64748b', fontSize: '0.84rem' }}>સર્ચ રીસેટ કરો અથવા અન્ય વિષય પસંદ કરો.</p>
                </div>
              ) : (
                <div className="material-grid">
                  {filtered.map(mat => {
                    const downloadUrl = mat.fileUrl || mat.linkUrl;
                    const sizeLabel = mat.fileSize || mat.size || 'PDF Document';
                    const typeLabel = mat.fileType || mat.type || 'PDF';
                    const meta = getStudentSubjectMeta(mat.subject, mat.fileType || mat.type);

                    return (
                      <div
                        key={mat.id}
                        className="card material-card-pro animate-fade-in"
                        style={{
                          background: meta.bgGradient,
                          border: meta.border,
                          boxShadow: '0 4px 18px rgba(0,0,0,0.06)'
                        }}>
                        <div>
                          {/* Top Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                background: meta.badgeBg,
                                color: meta.badgeColor,
                                border: `1px solid ${meta.badgeBorder}`,
                                fontSize: '0.74rem',
                                fontWeight: 900,
                                padding: '3px 9px',
                                borderRadius: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <span>{meta.icon}</span> {typeLabel}
                              </span>
                              {mat.tag && (
                                <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 8, border: '1px solid #fde68a' }}>
                                  🏷️ {mat.tag}
                                </span>
                              )}
                            </div>

                            <span style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 800, background: 'rgba(255,255,255,0.85)', padding: '2.5px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.06)' }}>
                              💾 {sizeLabel}
                            </span>
                          </div>

                          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px', lineHeight: 1.4 }}>
                            {mat.title}
                          </h3>

                          <div style={{ color: meta.accentColor, fontSize: '0.8rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{meta.icon} વિષય:</span> {mat.subject || 'સામાન્ય જ્ઞાન'}
                          </div>

                          {mat.description && (
                            <p style={{ color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45, margin: '0 0 12px' }}>
                              {mat.description}
                            </p>
                          )}
                        </div>

                        {/* Actions: Get in App */}
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
                          {/* ── Get in App ── */}
                          <a
                            href={playAppUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="material-glow-btn"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              padding: '11px 16px',
                              fontSize: '0.92rem',
                              gap: 8,
                              textDecoration: 'none',
                              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                              color: 'white',
                              borderRadius: 12,
                              fontWeight: 900,
                              display: 'inline-flex',
                              alignItems: 'center',
                              boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                              transition: 'all 0.15s ease',
                              boxSizing: 'border-box'
                            }}>
                            <Smartphone size={17} /> 📱 એપ્લિકેશનમાં મેળવો (Get in App)
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════
            TAB 6: 💭 શિક્ષક સહાય (TEACHER SUPPORT)
        ═══════════════════════════════════════════════════════ */}
        {activeTab === 'teacher_support' && (
          <div className="animate-fade-in">
            {/* 👑 VIP Header Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0b1329 0%, #1e3a8a 60%, #1d4ed8 100%)',
              borderRadius: 16,
              padding: '18px 20px',
              marginBottom: 16,
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 8px 24px rgba(11,19,41,0.3)',
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                  flexShrink: 0
                }}>
                  👨‍🏫
                </div>
                <div>
                  <h2 style={{ fontSize: '1.22rem', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '0.2px' }}>
                    શિક્ષક સહાય & લાઈવ શંકા નિવારણ
                  </h2>
                  <p style={{ color: '#93c5fd', fontSize: '0.8rem', margin: '2px 0 0', fontWeight: 600 }}>
                    સુનિલ સર અને વિષય નિષ્ણાતો સાથે સીધો સંપર્ક કરી શંકાનું સમાધાન મેળવો
                  </p>
                </div>
              </div>
              <div style={{
                background: 'rgba(34,197,94,0.18)',
                border: '1px solid #22c55e',
                color: '#86efac',
                fontSize: '0.78rem',
                fontWeight: 900,
                padding: '6px 14px',
                borderRadius: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e', animation: 'pulse 1.5s infinite' }} />
                <span>લાઈવ સપોર્ટ એક્ટિવ</span>
              </div>
            </div>

            {/* ── 3 Quick Action Helpline Cards ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
              marginBottom: 18
            }}>
              {/* 1. Direct Call Card */}
              <a
                href="tel:8200405300"
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.08)',
                  transition: 'all 0.2s ease'
                }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(37,99,235,0.3)'
                }}>
                  <Phone size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>ડાયરેક્ટ કૉલ (Helpline)</div>
                  <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#1e3a8a', letterSpacing: '0.3px' }}>8200405300</div>
                  <div style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 800, marginTop: 1 }}>📞 1-ટેપ કૉલ કરો</div>
                </div>
              </a>

              {/* 2. WhatsApp Chat Card */}
              <a
                href="https://wa.me/918200405300?text=નમસ્તે%20સર,%20મને%20કસોટી%20અંગે%20માર્ગદર્શન%20જોઈએ%20છે."
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.08)',
                  transition: 'all 0.2s ease'
                }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(16,185,129,0.3)'
                }}>
                  <MessageSquare size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>WhatsApp ઈન્સ્ટન્ટ ચેટ</div>
                  <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#15803d', letterSpacing: '0.3px' }}>+91 8200405300</div>
                  <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 800, marginTop: 1 }}>⚡ ઝડપી પ્રત્યુત્તર મળશે</div>
                </div>
              </a>

              {/* 3. Telegram Channel Card */}
              <a
                href="https://t.me/Trinetra_Online"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
                  border: '1.5px solid #bae6fd',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(2,132,199,0.08)',
                  transition: 'all 0.2s ease'
                }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(2,132,199,0.3)'
                }}>
                  <Send size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>સત્તાવાર Telegram</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0369a1', letterSpacing: '0.2px' }}>@Trinetra_Online</div>
                  <div style={{ fontSize: '0.68rem', color: '#0284c7', fontWeight: 800, marginTop: 1 }}>📢 રોજ નવા IMP પ્રશ્નો & PDF</div>
                </div>
              </a>

              {/* 4. YouTube Channel Card */}
              <a
                href="https://youtube.com/@trinetra_academy100?si=o40zQ7nNp8bMptcU"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
                  border: '1.5px solid #fecaca',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.08)',
                  transition: 'all 0.2s ease'
                }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(239,68,68,0.3)',
                  fontSize: '1.2rem',
                  fontWeight: 900
                }}>
                  ▶
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>સત્તાવાર YouTube ચેનલ</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#b91c1c', letterSpacing: '0.2px' }}>@trinetra_academy100</div>
                  <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 800, marginTop: 1 }}>🎥 વિડીયો લેક્ચર્સ & સોલ્યુશન</div>
                </div>
              </a>

              {/* 5. Instagram Page Card */}
              <a
                href="https://www.instagram.com/trinetra_online_academy?igsh=d2JqYmE4eWNsNmts"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #fdf2f8 0%, #ffffff 100%)',
                  border: '1.5px solid #fbcfe8',
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(236,72,153,0.08)',
                  transition: 'all 0.2s ease'
                }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(236,72,153,0.3)',
                  fontSize: '1.15rem'
                }}>
                  📷
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>સત્તાવાર Instagram</div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#9d174d', letterSpacing: '0.2px' }}>@trinetra_online_academy</div>
                  <div style={{ fontSize: '0.68rem', color: '#db2777', fontWeight: 800, marginTop: 1 }}>📸 ડેઇલી ક્વિઝ & શોર્ટ ટિપ્સ</div>
                </div>
              </a>
            </div>

            {/* ── Main Two Column Grid: Support Hours + Ask Doubt Form ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 16
            }}>
              {/* Left Column: Director Bio & Timings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Director Profile Card */}
                <div className="card" style={{
                  padding: '18px 20px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      border: '2.5px solid #d97706',
                      padding: 2,
                      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.6rem',
                      boxShadow: '0 4px 10px rgba(217,119,6,0.25)',
                      flexShrink: 0
                    }}>
                      🎓
                    </div>
                    <div>
                      <div style={{ fontSize: '1.12rem', fontWeight: 900, color: '#1e3a8a' }}>
                        સુનિલ સર (Sunil Sir)
                      </div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d97706' }}>
                        Founder & Director • Trinetra Academy
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>
                        TET / TAT & શૈક્ષણિક ભરતી માર્ગદર્શક
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: '0.8rem',
                    color: '#1e40af',
                    lineHeight: 1.5,
                    fontStyle: 'italic'
                  }}>
                    💬 "તમારી કોઈપણ શંકા કે મુશ્કેલી હોય તો સંકોચ વિના પૂછો. તમારી સફળતા એ જ અમારું લક્ષ્ય છે!"
                  </div>
                </div>

                {/* Support Hours Card */}
                <div className="card" style={{
                  padding: '16px 18px',
                  background: 'white',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#0f172a',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    marginBottom: 10,
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: 8
                  }}>
                    <Clock size={16} color="#d97706" /> ⏰ સહાય સમયપત્રક (Support Timings)
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8fafc', borderRadius: 8 }}>
                      <span style={{ color: '#475569', fontWeight: 700 }}>📅 સોમવાર - શનિવાર</span>
                      <strong style={{ color: '#1e3a8a' }}>સવારે ૯:૦૦ થી રાત્રે ૮:૦૦</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #dcfce7' }}>
                      <span style={{ color: '#166534', fontWeight: 800 }}>🏆 રવિવાર મોક ટેસ્ટ</span>
                      <strong style={{ color: '#15803d' }}>સવારે ૮:૦૦ થી રાત્રે ૧૦:૦૦</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fefce8', borderRadius: 8 }}>
                      <span style={{ color: '#854d0e', fontWeight: 700 }}>⚡ પ્રત્યુત્તર સમય</span>
                      <strong style={{ color: '#b45309' }}>૧૫ - ૩૦ મિનિટમાં</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Ask Doubt Form */}
              <div className="card" style={{
                padding: '18px 20px',
                background: 'white',
                border: '2px solid #bfdbfe',
                borderRadius: 16,
                boxShadow: '0 6px 20px rgba(37,99,235,0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.3rem' }}>✍️</span>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 900, color: '#1e3a8a', margin: 0 }}>
                    શિક્ષકને શંકા પૂછો (Ask Doubt)
                  </h3>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 14px' }}>
                  પ્રશ્ન લખો — તે વિગતવાર સીધો શિક્ષકના WhatsApp પર પહોંચી જશે.
                </p>

                {doubtSent && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: 12,
                    padding: '10px 14px',
                    marginBottom: 14,
                    color: '#15803d',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <CheckCircle2 size={18} color="#16a34a" /> તમારો પ્રશ્ન શિક્ષકને WhatsApp પર મોકલાઈ ગયો છે!
                  </div>
                )}

                <form onSubmit={handleSendWhatsAppDoubt}>
                  {/* Subject Dropdown */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontWeight: 800, fontSize: '0.8rem', color: '#334155', display: 'block', marginBottom: 4 }}>
                      વિષય પસંદ કરો (Subject):
                    </label>
                    <select
                      className="input-field"
                      value={doubtSubject}
                      onChange={e => setDoubtSubject(e.target.value)}
                      style={{
                        padding: '10px 12px',
                        fontSize: '0.86rem',
                        fontWeight: 700,
                        borderRadius: 10,
                        border: '1.5px solid #cbd5e1',
                        minHeight: 44
                      }}>
                      <option value="સામાન્ય શંકા (General)">🌟 સામાન્ય શંકા (General)</option>
                      <option value="વિજ્ઞાન (Science)">🔬 વિજ્ઞાન (Science)</option>
                      <option value="ગુજરાતી (Gujarati)">📖 ગુજરાતી વ્યાકરણ & સાહિત્ય</option>
                      <option value="ગણિત (Maths)">📐 ગણિત & રીઝનીંગ</option>
                      <option value="મનોવિજ્ઞાન (Psychology)">🧠 બાળ વિકાસ & મનોવિજ્ઞાન</option>
                      <option value="કસોટી અંગે પ્રશ્ન (Exam Doubt)">📋 કસોટી પ્રશ્ન સોલ્યુશન શંકા</option>
                    </select>
                  </div>

                  {/* Quick Preset Suggestion Chips */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: 5 }}>
                      💡 ઝડપી પ્રશ્ન સૂચનો (Quick Suggestions):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        'પ્રશ્ન નં. માં સાચો જવાબ સમજાવો',
                        'આ વિષયની તૈયારી કઈ રીતે કરવી?',
                        'મોક ટેસ્ટ સ્કોર સુધારવા ટિપ્સ આપો'
                      ].map((chipText) => (
                        <button
                          key={chipText}
                          type="button"
                          onClick={() => setDoubtText(prev => prev ? `${prev}\n${chipText}` : chipText)}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: 14,
                            padding: '4px 9px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}>
                          + {chipText}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Textarea */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontWeight: 800, fontSize: '0.8rem', color: '#334155', display: 'block', marginBottom: 4 }}>
                      તમારો પ્રશ્ન અથવા શંકા અહીં લખો *
                    </label>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="દા.ત. સર, વિજ્ઞાનના ટેસ્ટમાં પ્રશ્ન નં. ૪ ના સોલ્યુશન અંગે માર્ગદર્શન આપશો..."
                      value={doubtText}
                      onChange={e => setDoubtText(e.target.value)}
                      required
                      style={{
                        padding: '10px 12px',
                        fontSize: '0.86rem',
                        borderRadius: 10,
                        border: '1.5px solid #cbd5e1',
                        lineHeight: 1.4,
                        minHeight: 80
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '12px 16px',
                      fontSize: '0.92rem',
                      fontWeight: 900,
                      gap: 8,
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      borderRadius: 12,
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                      cursor: 'pointer'
                    }}>
                    <MessageSquare size={17} /> 💬 શિક્ષકને WhatsApp પર મોકલો →
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DETAILED QUESTION SOLUTION REVIEW (PORTALED)
      ───────────────────────────────────────────────────────────── */}
      {reviewSubId && typeof document !== 'undefined' && createPortal(
        <div className="student-modal-backdrop">
          <div className="student-modal-box animate-fade-in">
            
            {/* Modal Header */}
            <div className="student-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
                  🔍 વિગતવાર પ્રશ્નવાર સોલ્યુશન (Test Solutions)
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#bfdbfe', marginTop: 2 }}>
                  {reviewData?.submission?.testName} • {reviewData?.submission?.subject}
                </div>
              </div>
              <button onClick={() => setReviewSubId(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontWeight: 900, fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            {/* Modal Body: Question Review List */}
            <div className="student-modal-body">
              {loadingReview ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  ⏳ સોલ્યુશન લોડ થઈ રહ્યું છે...
                </div>
              ) : !reviewData?.review?.length ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                  પ્રશ્ન વિગતો ઉપલબ્ધ નથી.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviewData.review.map((item, idx) => {
                    const q = item.question;
                    const isCorrect = item.isCorrect;
                    const studentAns = item.studentAnswer;
                    const isSkipped = item.isSkipped || !studentAns || studentAns === 'E';
                    const isTatExam = (reviewData?.submission?.testName || '').toUpperCase().includes('TAT') || (q.optionE || q.optionE_img);

                    return (
                      <div key={q.id || idx} style={{
                        border: `1.5px solid ${isCorrect === true ? '#86efac' : isSkipped ? '#cbd5e1' : '#fca5a5'}`,
                        borderRadius: 12, padding: 16,
                        background: isCorrect === true ? '#f0fdf4' : isSkipped ? '#f8fafc' : '#fef2f2'
                      }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 900, color: '#1e3a8a', fontSize: '0.88rem' }}>
                              પ્રશ્ન #{idx + 1} ({q.type === 'mcq' ? 'MCQ' : 'Descriptive'})
                            </span>
                            {item.timeSpent > 0 && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: item.timeSpent <= 30 ? '#dcfce7' : item.timeSpent <= 60 ? '#fef3c7' : '#fee2e2', color: item.timeSpent <= 30 ? '#166534' : item.timeSpent <= 60 ? '#92400e' : '#991b1b' }}>
                                ⏱️ {item.timeSpent}s {item.timeSpent <= 30 ? '⚡' : ''}
                              </span>
                            )}
                          </div>

                          <div>
                            {isCorrect === true ? (
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
                                ✓ સાચો જવાબ (+{q.marks || 1})
                              </span>
                            ) : isSkipped ? (
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                ⏭️ છોડેલો પ્રશ્ન (Skipped / 0 ગુણ)
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                ✕ ખોટો જવાબ {Number(q.negativeMarking) > 0 ? `(-${q.negativeMarking})` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question Text */}
                        <div
                          style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: 10, lineHeight: 1.5 }}
                          dangerouslySetInnerHTML={{ __html: formatMathText(q.text) }}
                        />

                        {/* Question Image if present */}
                        {(q.image || q.imageUrl) && (
                          <div style={{ margin: '8px 0 12px', textAlign: 'center' }}>
                            <img src={q.image || q.imageUrl} alt="diagram" style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8, border: '1px solid #cbd5e1' }} />
                          </div>
                        )}

                        {/* Options list for MCQ (Supports A, B, C, D, E) */}
                        {q.type === 'mcq' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 6, marginBottom: 10 }}>
                            {['A', 'B', 'C', 'D', 'E'].map(opt => {
                              const rawOpt = q[`option${opt}`] || q[`opt${opt}`];
                              const rawImg = q[`option${opt}_img`] || q[`opt${opt}_img`];
                              const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                              let optText = isImg(rawOpt) ? '' : rawOpt;
                              if (opt === 'E' && !optText && !optImg && isTatExam) {
                                optText = 'ઉત્તર આપવા માંગતા નથી (Not Attempted / Skip)';
                              }
                              if (!optText && !optImg) return null;
                              const isSelected = studentAns === opt;
                              const isRight = q.correctOpt === opt;
                              const isOptE = opt === 'E';

                              return (
                                <div key={opt} style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  fontSize: '0.85rem',
                                  border: isRight ? '2px solid #22c55e' : (isSelected && !isOptE) ? '2px solid #ef4444' : isSelected && isOptE ? '2px solid #9333ea' : '1px solid #e2e8f0',
                                  background: isRight ? '#dcfce7' : (isSelected && !isOptE) ? '#fee2e2' : isSelected && isOptE ? '#f3e8ff' : 'white',
                                  color: isRight ? '#15803d' : (isSelected && !isOptE) ? '#b91c1c' : isSelected && isOptE ? '#7e22ce' : '#334155',
                                  fontWeight: isRight || isSelected ? 800 : 500,
                                  display: 'flex', flexDirection: 'column', gap: 4
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                                    <div>
                                      <strong>({opt})</strong> <span dangerouslySetInnerHTML={{ __html: formatMathText(optText) }} />
                                    </div>
                                    {isRight && <span style={{ color: '#16a34a', fontWeight: 900, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>✓ સાચો</span>}
                                    {isSelected && !isRight && !isOptE && <span style={{ color: '#dc2626', fontWeight: 900, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>તમારો જવાબ</span>}
                                    {isSelected && isOptE && <span style={{ color: '#7e22ce', fontWeight: 900, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>પસંદ કરેલ Skip</span>}
                                  </div>
                                  {optImg && (
                                    <div style={{ marginTop: 2, textAlign: 'center' }}>
                                      <img src={optImg} alt={`Option ${opt}`} style={{ maxHeight: 75, maxWidth: '100%', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Answer Hint / Explanation */}
                        {q.answerHint && (
                          <div style={{ fontSize: '0.82rem', color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 10px', marginTop: 8 }}>
                            💡 <strong>સમજૂતી (Explanation):</strong> {q.answerHint}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="student-modal-footer">
              <button onClick={() => setReviewSubId(null)} className="btn-primary" style={{ padding: '9px 24px', fontSize: '0.9rem', fontWeight: 800 }}>
                બંધ કરો (Close)
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: UPLOADED ANSWER PHOTO PREVIEW (PORTALED)
      ───────────────────────────────────────────────────────────── */}
      {previewPhotoSub && typeof document !== 'undefined' && createPortal(
        <div className="student-modal-backdrop" style={{ zIndex: 10000005 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 650, background: 'white', borderRadius: 16, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>📸 અપલોડ કરેલ ઉત્તરવહી (Answer Sheet)</div>
              <button onClick={() => setPreviewPhotoSub(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 16, textAlign: 'center', overflowY: 'auto', flex: 1 }}>
              <img src={previewPhotoSub.photoUrl} alt="Uploaded Answer Sheet" style={{ maxHeight: '55vh', maxWidth: '100%', borderRadius: 8, objectFit: 'contain', border: '1px solid #cbd5e1' }} />
              {previewPhotoSub.remarks && (
                <div style={{ marginTop: 12, textAlign: 'left', background: '#fffbeb', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: 8, fontSize: '0.88rem', color: '#92400e' }}>
                  <strong>👨‍🏫 શિક્ષકનો અભિપ્રાય:</strong> {previewPhotoSub.remarks}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 📱 Prompt Modal: Enter WhatsApp Mobile Number (If not known or want to send to another phone) ── */}
      {waModalSub && typeof document !== 'undefined' && createPortal(
        <div className="student-modal-backdrop" style={{ zIndex: 10000008, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="card animate-fade-in" style={{
            width: '100%',
            maxWidth: 440,
            background: 'linear-gradient(135deg, #0b1329 0%, #0f172a 100%)',
            border: '2px solid rgba(52,211,153,0.5)',
            borderRadius: 22,
            padding: '24px 20px',
            color: 'white',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(16,185,129,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.5rem' }}>📱</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#ffffff' }}>
                  WhatsApp પર PDF મેળવો
                </h3>
              </div>
              <button onClick={() => setWaModalSub(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: '1rem', fontWeight: 900 }}>✕</button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 700 }}>કસોટી:</div>
              <div style={{ color: '#38bdf8', fontSize: '0.92rem', fontWeight: 800 }}>{waModalSub.testName || waModalSub.subject || 'Scorecard'}</div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.84rem', fontWeight: 800, marginBottom: 8 }}>
                તમારો ૧૦-આંકડાનો WhatsApp નંબર દાખલ કરો:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#1e293b', border: '1.5px solid #475569', borderRadius: 10, padding: '10px 12px', fontWeight: 900, color: '#38bdf8', fontSize: '0.92rem' }}>
                  🇮🇳 +91
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={waTargetMobile}
                  onChange={e => setWaTargetMobile(e.target.value.replace(/\D/g, '').replace(/^(91|0)/, '').slice(0, 10))}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1.5px solid #3b82f6',
                    borderRadius: 10,
                    padding: '11px 14px',
                    color: 'white',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    outline: 'none'
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setWaModalSub(null)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#cbd5e1',
                  padding: '12px',
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.88rem'
                }}>
                રદ કરો
              </button>
              <button
                type="button"
                onClick={() => handleExecuteWhatsAppSend(waModalSub, waTargetMobile)}
                disabled={sendingWaSubId === waModalSub.id}
                style={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  border: 'none',
                  color: 'white',
                  padding: '12px',
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: sendingWaSubId === waModalSub.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 4px 16px rgba(16,185,129,0.4)'
                }}>
                {sendingWaSubId === waModalSub.id ? (
                  <>⏳ મોકલાઈ રહ્યું છે...</>
                ) : (
                  <>🚀 WhatsApp PDF મોકલો</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── 🎉 GRAND WHATSAPP SUCCESS MODAL POPUP: Send Successfully! ── */}
      {waSuccessModal && typeof document !== 'undefined' && createPortal(
        <div className="student-modal-backdrop" style={{ zIndex: 10000012, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
          <div className="card animate-fade-in" style={{
            width: '100%',
            maxWidth: 480,
            background: 'linear-gradient(135deg, #0b1329 0%, #064e3b 55%, #022c22 100%)',
            border: '2.5px solid #34d399',
            borderRadius: 24,
            padding: '30px 22px',
            color: 'white',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(5,150,105,0.5), 0 0 50px rgba(52,211,153,0.4)',
            position: 'relative'
          }}>
            {/* Big animated WhatsApp check badge */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.6rem',
              margin: '0 auto 16px',
              boxShadow: '0 0 35px rgba(34,197,94,0.7)',
              border: '3px solid #86efac'
            }}>
              ✓
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              🎉 Send Successfully!
            </h2>
            <div style={{ color: '#4ade80', fontSize: '1.02rem', fontWeight: 900, marginBottom: 16 }}>
              ✨ WhatsApp પર PDF સફળતાપૂર્વક મોકલાઈ ગયું છે!
            </div>

            <div style={{ background: 'rgba(0,0,0,0.45)', borderRadius: 14, padding: '14px 16px', marginBottom: 18, border: '1px solid rgba(52,211,153,0.3)', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.3rem' }}>📱</span>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>પ્રાપ્તકર્તા નંબર (Recipient Mobile):</div>
                  <div style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 900, fontFamily: 'monospace' }}>
                    +91 {waSuccessModal.mobile}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>📄</span>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700 }}>કસોટીનું નામ:</div>
                  <div style={{ color: '#f8fafc', fontSize: '0.9rem', fontWeight: 800 }}>
                    {waSuccessModal.testName}
                  </div>
                </div>
              </div>
            </div>

            <p style={{ color: '#d1fae5', fontSize: '0.84rem', lineHeight: 1.5, margin: '0 0 22px' }}>
              ત્રિનેત્ર ઓનલાઇન એકેડેમીના અધિકૃત નંબર પરથી તમારા WhatsApp પર રંગીન સ્કોરકાર્ડ, સુનિલ સરની સહી, ક્યુઆર કોડ અને તમામ પ્રશ્નોના સોલ્યુશન સાથેની PDF ફાઇલ મોકલી દેવામાં આવી છે. 💬
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <a
                href={`https://wa.me/91${waSuccessModal.mobile}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: 'white',
                  padding: '13px 16px',
                  borderRadius: 12,
                  fontWeight: 900,
                  fontSize: '0.94rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: '0 4px 18px rgba(34,197,94,0.45)'
                }}>
                💬 WhatsApp ખોલો
              </a>
              <button
                onClick={() => setWaSuccessModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'white',
                  padding: '13px 22px',
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontSize: '0.94rem'
                }}>
                ✅ બરાબર (OK)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Download Success Popup — Portaled to document.body ── */}
      {downloadPopup && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          bottom: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999999,
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
          border: '1.5px solid #34d399',
          borderRadius: 18,
          padding: '14px 20px',
          boxShadow: '0 8px 32px rgba(52,211,153,0.45), 0 2px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 280,
          maxWidth: '90vw',
          animation: 'fadeInUp 0.3s ease',
        }}>
          {/* Big green checkmark */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            flexShrink: 0,
            boxShadow: '0 0 20px rgba(34,197,94,0.6)'
          }}>✅</div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', lineHeight: 1.3 }}>
              {downloadPopup.type === 'whatsapp' ? '✨ WhatsApp પર PDF મોકલાઈ ગયું!' : '✨ ફાઇલ ડાઉનલોડ થઈ ગઈ!'}
            </div>
            <div style={{ color: '#6ee7b7', fontSize: '0.72rem', fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📂 {downloadPopup.filename}
            </div>
            <div style={{ color: '#a7f3d0', fontSize: '0.7rem', marginTop: 2 }}>
              {downloadPopup.type === 'whatsapp' ? 'તમારું WhatsApp ખોલીને PDF ચેક કરો 💬' : 'ફોન ના Downloads ફોલ્ડરમાં ચેક કરો 📱'}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setDownloadPopup(null)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#d1fae5',
              width: 28,
              height: 28,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>✕</button>
        </div>,
        document.body
      )}

      {/* ── Fixed Phone Bottom Nav — Portaled to document.body to escape CSS transform ── */}
      {typeof document !== 'undefined' && createPortal(
        <div className="student-mobile-nav">
          {[
            { id: 'live',            label: 'લાઈવ',      icon: '🔴' },
            { id: 'results',         label: 'રિઝલ્ટ',    icon: '📜', hasBadge: true },
            { id: 'analytics',       label: 'પ્રગતિ',    icon: '📊' },
            { id: 'leaderboard',     label: 'લીડરબોર્ડ', icon: '🏆' },
            { id: 'materials',       label: 'મટીરીયલ',   icon: '📁' },
            { id: 'teacher_support', label: 'સહાય',      icon: '💭' },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id}
                className={`student-mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-label">{tab.label}</span>
                {tab.hasBadge && submissions.length > 0 && (
                  <span className="nav-badge">{submissions.length}</span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}

    </div>
  );
}
