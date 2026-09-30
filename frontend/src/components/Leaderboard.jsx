import { useEffect, useState } from 'react';
import { getTestWiseLeaderboard } from '../services/api';

const SUBJECT_ICONS = {
  science: '🔬', math: '📐', maths: '📐', mathematics: '📐',
  ss: '🌍', 'social science': '🌍', 'social studies': '🌍',
  english: '📖', gujarati: '📝', hindi: '🇮🇳',
  computer: '💻', general: '📋', default: '📋'
};

function getSubjectIcon(subject = '') {
  const s = subject.toLowerCase().trim();
  for (const key of Object.keys(SUBJECT_ICONS)) {
    if (s.includes(key)) return SUBJECT_ICONS[key];
  }
  return SUBJECT_ICONS.default;
}

const SUBJECT_COLORS = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: '#2563eb' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#16a34a' },
  { bg: '#fef3c7', border: '#fde68a', text: '#92400e', badge: '#d97706' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#6b21a8', badge: '#9333ea' },
  { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', badge: '#e11d48' },
  { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', badge: '#059669' },
];

function getRankStyle(rank) {
  if (rank === 1) return {
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '#f59e0b',
    medal: '👑 🥇',
    title: '૧મો રેન્ક (Gold Topper)',
    shadow: '0 6px 18px rgba(245,158,11,0.25)'
  };
  if (rank === 2) return {
    bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    border: '#94a3b8',
    medal: '🥈',
    title: '૨જો રેન્ક (Silver)',
    shadow: '0 4px 14px rgba(148,163,184,0.2)'
  };
  if (rank === 3) return {
    bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    border: '#ea580c',
    medal: '🥉',
    title: '૩જો રેન્ક (Bronze)',
    shadow: '0 4px 14px rgba(234,88,12,0.2)'
  };
  return {
    bg: '#ffffff',
    border: '#e2e8f0',
    medal: `#${rank}`,
    title: `રેન્ક ${rank}`,
    shadow: '0 1px 3px rgba(0,0,0,0.03)'
  };
}

// ── Shared inner UI (used by both home page and student dashboard) ─────────────
export function LeaderboardUI({ 
  tests = [], 
  loading = false, 
  currentUserName = null,
  currentUserMobile = null,
  studentSubmissions = []
}) {
  const [activeTest, setActiveTest] = useState(null);

  useEffect(() => {
    if (tests.length > 0 && !activeTest) {
      setActiveTest(tests[0].testCode);
    }
  }, [tests]);

  const activeData = tests.find(t => t.testCode === activeTest) || null;
  const colorIdx = tests.findIndex(t => t.testCode === activeTest);
  const activeColor = SUBJECT_COLORS[colorIdx >= 0 ? colorIdx % SUBJECT_COLORS.length : 0];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12, animation: 'pulse 1.5s infinite' }}>⏳</div>
        <p style={{ color: '#1e3a8a', fontWeight: 800, fontSize: '1rem', margin: 0 }}>Leaderboard લોડ થઈ રહ્યું છે...</p>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', background: 'white', borderRadius: 20, border: '1.5px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📭</div>
        <h3 style={{ color: '#0f172a', fontWeight: 900, margin: '0 0 6px' }}>કોઈ કસોટીનું પરિણામ ઉપલબ્ધ નથી</h3>
        <p className="gu-text" style={{ color: '#64748b', fontWeight: 600, fontSize: '0.92rem', margin: 0 }}>
          વિદ્યાર્થીઓ કસોટી આપશે એટલે ટોચના રેન્કર્સનું લિસ્ટ અહીં ચમકશે!
        </p>
      </div>
    );
  }

  const leaders = (activeData?.leaders || []).slice(0, 10);

  // 🔍 Helper: Check if a student in the leaderboard matches the currently logged-in student
  const isStudentMatch = (leader) => {
    if (!leader) return false;
    if (currentUserMobile) {
      const cleanCurrent = String(currentUserMobile).replace(/\D/g, '').slice(-10);
      const cleanLeaderRaw = String(leader.rawMobile || '').replace(/\D/g, '').slice(-10);
      if (cleanLeaderRaw && cleanLeaderRaw === cleanCurrent) return true;
      const cleanLeaderMasked = String(leader.mobile || '').replace(/\D/g, '');
      if (cleanLeaderMasked && cleanLeaderMasked.length >= 4 && cleanCurrent.startsWith(cleanLeaderMasked)) return true;
    }
    if (currentUserName && leader.studentName) {
      const uName = currentUserName.trim().toLowerCase();
      const lName = leader.studentName.trim().toLowerCase();
      if (uName === lName || (uName.length > 3 && lName.includes(uName)) || (lName.length > 3 && uName.includes(lName))) {
        return true;
      }
    }
    return false;
  };

  const userLeaderEntry = leaders.find(l => isStudentMatch(l));
  const userSubmissionForTest = (studentSubmissions || []).find(s => {
    return (activeData?.testCode && s.testCode === activeData.testCode) ||
           (activeData?.testName && s.testName === activeData.testName);
  });

  // 🔍 Lookup student's overall rank if they are outside the Top 10
  const cleanMyMobile = currentUserMobile ? String(currentUserMobile).replace(/\D/g, '').slice(-10) : null;
  const userMapEntry = (cleanMyMobile && activeData?.studentRankMap) ? activeData.studentRankMap[cleanMyMobile] : null;

  // ⏱️ Helper to compute duration & submission time for student or leader
  const getSubmissionTimeInfo = (entry) => {
    if (!entry) return { duration: null, submittedTime: null, submittedDate: null };

    let duration = entry.timeSpentFormatted || null;
    if (!duration) {
      let seconds = entry.timeSpentSeconds || entry.timeSpent || entry.duration || 0;
      if (!seconds && Array.isArray(entry.answers)) {
        entry.answers.forEach(a => {
          if (a && a.timeSpent) seconds += Number(a.timeSpent) || 0;
        });
      }
      if (!seconds && entry.startedAt && entry.submittedAt) {
        const diff = Math.round((new Date(entry.submittedAt).getTime() - new Date(entry.startedAt).getTime()) / 1000);
        if (diff > 0 && diff < 86400) seconds = diff;
      }
      if (seconds > 0) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) duration = `${hours} ક. ${mins} મિ.`;
        else if (mins > 0) duration = `${mins} મિ. ${secs > 0 ? `${secs} સે.` : ''}`.trim();
        else duration = `${secs} સેકન્ડ`;
      }
    }

    const rawDate = entry.submittedAt || entry.createdAt;
    let submittedTime = null;
    let submittedDate = null;
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          submittedTime = d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          submittedDate = d.toLocaleDateString('gu-IN', {
            day: '2-digit',
            month: 'short'
          });
        }
      } catch (e) {}
    }

    return { duration, submittedTime, submittedDate };
  };

  const studentTimeInfo = getSubmissionTimeInfo(userLeaderEntry || userMapEntry || userSubmissionForTest);

  const myRank = userLeaderEntry?.rank || userMapEntry?.rank || null;
  const myScore = userLeaderEntry ? userLeaderEntry.mcqScore : userMapEntry ? userMapEntry.score : (userSubmissionForTest?.mcqScore ?? userSubmissionForTest?.score ?? null);
  const myTotal = userLeaderEntry ? userLeaderEntry.totalMCQ : userMapEntry ? userMapEntry.totalMarks : (userSubmissionForTest?.totalMarks || userSubmissionForTest?.totalMCQ || activeData?.totalMarks || 100);
  const myPct = (myScore !== null && myTotal > 0) ? Math.round((myScore / myTotal) * 100) : null;
  const hasAttempted = myScore !== null || Boolean(userLeaderEntry || userMapEntry || userSubmissionForTest);
  const isOutsideTop10 = hasAttempted && (!userLeaderEntry) && (myRank !== null || userSubmissionForTest);

  const top1 = leaders.find(l => l.rank === 1);
  const top2 = leaders.find(l => l.rank === 2);
  const top3 = leaders.find(l => l.rank === 3);
  const otherLeaders = leaders.filter(l => l.rank > 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* ── 🌟 1. HORIZONTAL SCROLLABLE TEST FILTER PILLS (MOBILE PRO CAROUSEL) ── */}
      <div style={{ background: 'white', padding: '14px 16px', borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <div style={{
          fontSize: '0.74rem', fontWeight: 800, color: '#64748b',
          textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span>🎯</span> કસોટી પસંદ કરો ({tests.length} ઉપલબ્ધ):
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          {tests.map((t, idx) => {
            const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
            const isActive = t.testCode === activeTest;
            const icon = getSubjectIcon(t.subject);
            return (
              <button
                key={t.testCode}
                onClick={() => setActiveTest(t.testCode)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  borderRadius: 24,
                  border: isActive ? `2px solid ${color.badge}` : '1.5px solid #e2e8f0',
                  background: isActive ? 'linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%)' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontWeight: isActive ? 900 : 700,
                  fontSize: '0.84rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 4px 16px rgba(37,99,235,0.35)' : 'none',
                  fontFamily: 'Hind Vadodara, sans-serif'
                }}
              >
                <span style={{ fontSize: '1.05rem' }}>{icon}</span>
                <span>{t.testName}</span>
                {t.isLocked ? (
                  <span style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    fontSize: '0.66rem', fontWeight: 900,
                    padding: '2px 6px', borderRadius: 12,
                    display: 'inline-flex', alignItems: 'center', gap: 3
                  }}>
                    🔒 શિડ્યુલ
                  </span>
                ) : (
                  <span style={{
                    background: isActive ? '#38bdf8' : '#e2e8f0',
                    color: isActive ? '#0b1329' : '#475569',
                    fontSize: '0.68rem', fontWeight: 900,
                    padding: '2px 7px', borderRadius: 12
                  }}>
                    👥 {t.participants}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 🌟 2. SELECTED TEST HEADER VIP BANNER ── */}
      {activeData && (() => {
        const icon = getSubjectIcon(activeData.subject);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            
            {/* VIP Test Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0b1329 0%, #0f172a 50%, #1e3a8a 100%)',
              borderRadius: 16,
              padding: '12px 16px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem', boxShadow: '0 4px 12px rgba(56,189,248,0.3)',
                flexShrink: 0
              }}>
                {icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: '0 0 2px 0', fontSize: 'clamp(0.95rem, 3vw, 1.15rem)', fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeData.testName} {activeData.isLocked ? '🔒' : ''}
                </h3>
                <div style={{ color: '#93c5fd', fontSize: '0.74rem', fontWeight: 700, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>📚 {activeData.subject}</span>
                  <span style={{ opacity: 0.6 }}>•</span>
                  <span>👥 {activeData.participants} વિદ્યાર્થીઓ</span>
                  {activeData.isLocked ? (
                    <>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span style={{ color: '#fde68a' }}>🔒 શિડ્યુલ સમય બાદ જાહેર થશે</span>
                    </>
                  ) : (
                    <>
                      <span style={{ opacity: 0.6 }}>•</span>
                      <span>🏅 Top 10 Rankers</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* If test leaderboard is locked */}
            {activeData.isLocked ? (
              <div style={{
                textAlign: 'center', padding: '36px 20px', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                borderRadius: 18, border: '2px solid #f59e0b', boxShadow: '0 4px 20px rgba(245,158,11,0.15)'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: 10 }}>⏳ 🔒</div>
                <h4 style={{ color: '#92400e', fontWeight: 900, margin: '0 0 6px', fontSize: '1.15rem' }}>
                  લીડરબોર્ડ નિયત સમયે જાહેર થશે!
                </h4>
                <p style={{ color: '#78350f', fontSize: '0.88rem', margin: '0 0 16px', lineHeight: 1.5, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
                  કસોટીમાં ચોરી અટકાવવા માટે તમામ વિદ્યાર્થીઓનું પરિણામ, આન્સર કી અને ટોપર્સ લીડરબોર્ડ નિયત સમયે એકસાથે જાહેર કરવામાં આવશે.
                </p>
                {activeData.resultsPublishAt && (
                  <div style={{
                    display: 'inline-block',
                    background: '#ffffff',
                    border: '1.5px dashed #f59e0b',
                    borderRadius: 12,
                    padding: '8px 18px',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: '#b45309'
                  }}>
                    📅 જાહેર થવાનો સમય:{' '}
                    {(() => {
                      try {
                        const d = new Date(activeData.resultsPublishAt);
                        return d.toLocaleDateString('gu-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }) + ' ' +
                               d.toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
                      } catch {
                        return activeData.resultsPublishAt;
                      }
                    })()}
                  </div>
                )}
              </div>
            ) : leaders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 34, background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📝</div>
                <h4 style={{ color: '#0f172a', fontWeight: 900, margin: '0 0 4px' }}>હજુ કોઈ પરિણામ નથી</h4>
                <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0 }}>આ ટેસ્ટ આપનાર પ્રથમ વિદ્યાર્થી બનો!</p>
              </div>
            ) : (
              <>
                <style>{`
                  @keyframes floatCrown {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-6px) rotate(-3deg); }
                  }
                  @keyframes goldGlow {
                    0%, 100% { box-shadow: 0 0 18px rgba(245, 158, 11, 0.35); }
                    50% { box-shadow: 0 0 32px rgba(245, 158, 11, 0.7); }
                  }
                  @keyframes userHighlightPulse {
                    0%, 100% { box-shadow: 0 0 15px rgba(56, 189, 248, 0.35), 0 4px 16px rgba(37, 99, 235, 0.15); border-color: #38bdf8; }
                    50% { box-shadow: 0 0 28px rgba(56, 189, 248, 0.75), 0 6px 24px rgba(37, 99, 235, 0.35); border-color: #60a5fa; }
                  }
                  .user-spotlight-pulse {
                    animation: userHighlightPulse 2.4s infinite ease-in-out;
                  }
                  .crown-bounce-anim {
                    animation: floatCrown 2.2s infinite ease-in-out;
                  }
                  .spotlight-stats-grid {
                    width: 100%;
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    box-sizing: border-box;
                  }
                  @media (max-width: 640px) {
                    .spotlight-stats-grid {
                      grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .spotlight-stats-time-tile {
                      grid-column: span 2;
                    }
                  }
                `}</style>

                {/* ── 🌟 STUDENT PERSONAL RANK SPOTLIGHT BANNER (તમારો રેન્ક & સ્કોર) ── */}
                {(userLeaderEntry || userSubmissionForTest) && (
                  <div className="user-spotlight-pulse animate-fade-in" style={{
                    background: userLeaderEntry?.rank === 1
                      ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #78350f 100%)'
                      : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                        ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1e40af 100%)'
                        : 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)',
                    borderRadius: 18,
                    padding: '16px 18px',
                    border: userLeaderEntry?.rank === 1
                      ? '2px solid #f59e0b'
                      : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                        ? '2px solid #38bdf8'
                        : '2px solid rgba(56, 189, 248, 0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    position: 'relative',
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                  }}>
                    {/* Top Accent Strip */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: userLeaderEntry?.rank === 1
                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)'
                        : 'linear-gradient(90deg, #38bdf8, #818cf8, #38bdf8)'
                    }} />

                    {/* Top Row: Avatar + Student Info + Status Message */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: userLeaderEntry?.rank === 1
                            ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
                            : 'linear-gradient(135deg, #2563eb, #38bdf8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.5rem', fontWeight: 900,
                          color: userLeaderEntry?.rank === 1 ? '#78350f' : '#ffffff',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                          border: '2px solid #ffffff'
                        }}>
                          {userLeaderEntry?.rank === 1 ? '👑' : userLeaderEntry?.rank === 2 ? '🥈' : userLeaderEntry?.rank === 3 ? '🥉' : '🌟'}
                        </div>
                        <span style={{
                          position: 'absolute', bottom: -3, right: -4,
                          background: '#10b981', color: 'white',
                          fontSize: '0.62rem', fontWeight: 900,
                          padding: '1px 5px', borderRadius: 8,
                          border: '1.5px solid #0f172a'
                        }}>
                          તમે
                        </span>
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            background: userLeaderEntry?.rank === 1 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.2)',
                            color: userLeaderEntry?.rank === 1 ? '#fde68a' : '#7dd3fc',
                            border: userLeaderEntry?.rank === 1 ? '1px solid #f59e0b' : '1px solid #38bdf8',
                            fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: 10
                          }}>
                            🎯 તમારો લાઇવ પર્ફોર્મન્સ
                          </span>
                          {userLeaderEntry && (
                            <span style={{
                              background: '#10b981', color: 'white',
                              fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: 10,
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                            }}>
                              🔥 TOP 10 RANKER
                            </span>
                          )}
                        </div>

                        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.05rem', marginTop: 3 }}>
                          {currentUserName || 'વિદ્યાર્થી'}
                        </div>

                        <div style={{ color: '#cbd5e1', fontSize: '0.78rem', marginTop: 1, lineHeight: 1.35 }}>
                          {userLeaderEntry?.rank === 1 ? (
                            <span style={{ color: '#fef08a', fontWeight: 800 }}>🏆 અદભુત! તમે સમગ્ર કસોટીમાં ૧લા નંબરના ગોલ્ડ ટોપર છો!</span>
                          ) : userLeaderEntry?.rank && userLeaderEntry.rank <= 3 ? (
                            <span style={{ color: '#93c5fd', fontWeight: 800 }}>🎉 અભિનંદન! તમે 3D પોડિયમ પર ટોપ ૩ વિજેતાઓમાં સામેલ છો!</span>
                          ) : userLeaderEntry ? (
                            <span style={{ color: '#a7f3d0', fontWeight: 800 }}>👏 ઉત્તમ! તમે ટોચના ૧૦ તેજસ્વી રેન્કર્સમાં સ્થાન બનાવ્યું છે!</span>
                          ) : (
                            <span>કસોટી પૂર્ણ કરી. વધુ મહેનત કરી ટોપ ૧૦ માં સ્થાન મેળવો!</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: 3-Column Responsive Balanced Metric Tiles */}
                    <div className="spotlight-stats-grid">
                      {/* Tile 1: તમારો રેન્ક */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                        border: userLeaderEntry?.rank === 1
                          ? '1.5px solid rgba(245, 158, 11, 0.5)'
                          : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                            ? '1.5px solid rgba(56, 189, 248, 0.45)'
                            : '1.5px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 14,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        minWidth: 0,
                        boxSizing: 'border-box'
                      }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: userLeaderEntry?.rank === 1
                            ? 'rgba(245, 158, 11, 0.2)'
                            : userLeaderEntry?.rank === 2
                              ? 'rgba(226, 232, 240, 0.15)'
                              : userLeaderEntry?.rank === 3
                                ? 'rgba(251, 146, 60, 0.2)'
                                : 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.3rem',
                          flexShrink: 0
                        }}>
                          {userLeaderEntry?.rank === 1 ? '🥇' : userLeaderEntry?.rank === 2 ? '🥈' : userLeaderEntry?.rank === 3 ? '🥉' : '🏆'}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            color: '#94a3b8',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            તમારો રેન્ક
                          </div>
                          <div style={{
                            fontSize: '1.4rem',
                            fontWeight: 900,
                            lineHeight: 1.1,
                            marginTop: 1,
                            color: userLeaderEntry?.rank === 1
                              ? '#fbbf24'
                              : userLeaderEntry?.rank === 2
                                ? '#f1f5f9'
                                : userLeaderEntry?.rank === 3
                                  ? '#fdba74'
                                  : '#38bdf8'
                          }}>
                            {userLeaderEntry ? `#${userLeaderEntry.rank}` : 'પૂર્ણ'}
                          </div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginTop: 2,
                            background: userLeaderEntry?.rank === 1
                              ? 'rgba(245, 158, 11, 0.2)'
                              : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                                ? 'rgba(56, 189, 248, 0.18)'
                                : 'rgba(16, 185, 129, 0.18)',
                            color: userLeaderEntry?.rank === 1
                              ? '#fbbf24'
                              : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                                ? '#7dd3fc'
                                : '#6ee7b7',
                            border: userLeaderEntry?.rank === 1
                              ? '1px solid rgba(245, 158, 11, 0.35)'
                              : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                                ? '1px solid rgba(56, 189, 248, 0.35)'
                                : '1px solid rgba(16, 185, 129, 0.35)',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap'
                          }}>
                            {userLeaderEntry?.rank === 1
                              ? '🥇 ૧લો નંબર'
                              : userLeaderEntry?.rank && userLeaderEntry.rank <= 3
                                ? '🎉 ટોપ ૩ વિજેતા'
                                : userLeaderEntry
                                  ? '🔥 ટોપ ૧૦'
                                  : '✓ પૂર્ણ'}
                          </div>
                        </div>
                      </div>

                      {/* Tile 2: મેળવેલ ગુણ */}
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                        border: '1.5px solid rgba(52, 211, 153, 0.4)',
                        borderRadius: 14,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        minWidth: 0,
                        boxSizing: 'border-box'
                      }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'rgba(52, 211, 153, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.3rem',
                          flexShrink: 0
                        }}>
                          🎯
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            color: '#94a3b8',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            મેળવેલ ગુણ
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 3,
                            marginTop: 1,
                            lineHeight: 1.1
                          }}>
                            <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#34d399' }}>
                              {userLeaderEntry ? userLeaderEntry.mcqScore : (userSubmissionForTest?.mcqScore ?? userSubmissionForTest?.score ?? 0)}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                              /{userLeaderEntry ? userLeaderEntry.totalMCQ : (userSubmissionForTest?.totalMarks || userSubmissionForTest?.totalMCQ || activeData.totalMarks || 100)}
                            </span>
                          </div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginTop: 2,
                            background: 'rgba(251, 191, 36, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(251, 191, 36, 0.35)',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap'
                          }}>
                            {userLeaderEntry ? `${userLeaderEntry.percentage}%` : `${userSubmissionForTest ? Math.round(((userSubmissionForTest.mcqScore ?? userSubmissionForTest.score ?? 0) / (userSubmissionForTest.totalMarks || 100)) * 100) : 0}%`} ટકા
                          </div>
                        </div>
                      </div>

                      {/* Tile 3: કસોટી પૂર્ણ સમય & સબમિટ વિગત */}
                      <div className="spotlight-stats-time-tile" style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                        border: '1.5px solid rgba(168, 85, 247, 0.45)',
                        borderRadius: 14,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        minWidth: 0,
                        boxSizing: 'border-box'
                      }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'rgba(168, 85, 247, 0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.3rem',
                          flexShrink: 0
                        }}>
                          ⏱️
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            color: '#94a3b8',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            ટેસ્ટ પૂર્ણ સમય (Time Taken)
                          </div>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 900,
                            color: '#c084fc',
                            lineHeight: 1.1,
                            marginTop: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {studentTimeInfo.duration || 'ઝડપી પૂર્ણ'}
                          </div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            marginTop: 2,
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#e9d5ff',
                            border: '1px solid rgba(168, 85, 247, 0.35)',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 6,
                            whiteSpace: 'nowrap'
                          }}>
                            {studentTimeInfo.submittedTime ? `⏰ સબમિટ: ${studentTimeInfo.submittedTime}` : '⚡ સબમિટેડ'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 👑 3. TOP 3 OLYMPIC 3D PODIUM (STADIUM STAGE) ── */}
                <div style={{
                  background: 'radial-gradient(ellipse at bottom, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.95) 75%)',
                  borderRadius: 20,
                  padding: '20px 14px 16px',
                  border: '1.5px solid rgba(245, 158, 11, 0.35)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}>

                  {/* Stage Title Badge */}
                  <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      color: 'white', padding: '6px 18px', borderRadius: 20,
                      fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.3px',
                      boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
                      display: 'inline-flex', alignItems: 'center', gap: 6
                    }}>
                      <span>👑</span>
                      <span>ત્રિનેત્ર ટોપ ૩ વિજેતાઓ (TOP 3 OLYMPIC PODIUM)</span>
                    </span>
                  </div>

                  {/* 3D Flex Podium Columns */}
                  <div className="leaderboard-podium-container" style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    maxWidth: 680,
                    boxSizing: 'border-box'
                  }}>
                    
                    {/* 🥈 Rank 2 (Left - Silver) */}
                    {top2 ? (
                      <div className="leaderboard-podium-card" style={{
                        flex: '1 1 0%',
                        minWidth: 0,
                        background: 'linear-gradient(180deg, rgba(148,163,184,0.15) 0%, rgba(30,41,59,0.9) 100%)',
                        border: isStudentMatch(top2) ? '2.5px solid #38bdf8' : '1.5px solid #94a3b8',
                        borderRadius: 16,
                        padding: '14px 6px 10px',
                        textAlign: 'center',
                        boxShadow: isStudentMatch(top2) ? '0 0 20px rgba(56,189,248,0.5)' : '0 6px 18px rgba(0,0,0,0.4)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        {/* Avatar */}
                        <div style={{ position: 'relative', marginBottom: 6 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: '#e2e8f0', color: '#1e293b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', fontWeight: 900,
                            border: '2.5px solid #94a3b8',
                            boxShadow: '0 4px 12px rgba(148,163,184,0.3)'
                          }}>
                            {(top2.studentName || 'S')[0].toUpperCase()}
                          </div>
                          {isStudentMatch(top2) && (
                            <span style={{
                              position: 'absolute', bottom: -4, right: -4,
                              background: '#2563eb', color: 'white',
                              fontSize: '0.58rem', fontWeight: 900,
                              padding: '1px 5px', borderRadius: 8,
                              border: '1.5px solid #0f172a'
                            }}>
                              તમે
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.82rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {top2.studentName}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.64rem', margin: '2px 0 6px' }}>
                          📱 {top2.mobile?.slice(0, 5)}****
                        </div>

                        {/* Silver 3D Pillar */}
                        <div style={{
                          width: '100%',
                          minHeight: 124,
                          borderRadius: '10px 10px 4px 4px',
                          background: 'linear-gradient(180deg, #64748b 0%, #334155 100%)',
                          border: '1.5px solid #94a3b8',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '8px 4px 10px',
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🥈</span>
                          <span style={{ color: '#f1f5f9', fontWeight: 900, fontSize: '0.85rem' }}>૨જો રેન્ક</span>
                          <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '0.85rem' }}>
                            {top2.mcqScore}/{top2.totalMCQ}
                          </span>
                          <span style={{ background: '#334155', color: '#cbd5e1', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                            SILVER • {top2.percentage}%
                          </span>
                          {getSubmissionTimeInfo(top2).duration && (
                            <span style={{
                              background: 'rgba(15, 23, 42, 0.65)',
                              color: '#93c5fd',
                              border: '1px solid rgba(147, 197, 253, 0.4)',
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 10,
                              marginTop: 2,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                              whiteSpace: 'nowrap'
                            }}>
                              <span>⏱️</span>
                              <span>{getSubmissionTimeInfo(top2).duration}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : <div style={{ flex: '1 1 0%', minWidth: 0 }} />}

                    {/* 👑 🥇 Rank 1 (Center - Gold Topper Elevated) */}
                    {top1 ? (
                      <div className="leaderboard-podium-card" style={{
                        flex: '1.15 1 0%',
                        minWidth: 0,
                        background: 'linear-gradient(180deg, rgba(245,158,11,0.2) 0%, rgba(30,41,59,0.95) 100%)',
                        border: isStudentMatch(top1) ? '3px solid #fbbf24' : '2px solid #f59e0b',
                        borderRadius: 18,
                        padding: '16px 6px 12px',
                        textAlign: 'center',
                        boxShadow: '0 12px 30px rgba(245,158,11,0.35)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        transform: 'translateY(-8px)',
                        boxSizing: 'border-box'
                      }}>
                        {/* Floating Crown Animation */}
                        <div className="crown-bounce-anim" style={{ fontSize: '1.8rem', lineHeight: 1, marginBottom: 2 }}>
                          👑
                        </div>

                        {/* Gold Avatar Ring */}
                        <div style={{ position: 'relative', marginBottom: 6 }}>
                          <div style={{
                            width: 52, height: 52, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                            color: '#78350f',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.45rem', fontWeight: 900,
                            border: '3px solid #ffffff',
                            boxShadow: '0 0 18px rgba(245,158,11,0.6)'
                          }}>
                            {(top1.studentName || 'S')[0].toUpperCase()}
                          </div>
                          {isStudentMatch(top1) && (
                            <span style={{
                              position: 'absolute', bottom: -4, right: -4,
                              background: '#16a34a', color: 'white',
                              fontSize: '0.6rem', fontWeight: 900,
                              padding: '1px 6px', borderRadius: 8,
                              border: '1.5px solid #0f172a'
                            }}>
                              તમે
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.9rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {top1.studentName}
                        </div>
                        <div style={{ color: '#fde68a', fontSize: '0.64rem', fontWeight: 700, margin: '2px 0 6px' }}>
                          📱 {top1.mobile?.slice(0, 5)}****
                        </div>

                        {/* Gold 3D Pillar (Tallest) */}
                        <div style={{
                          width: '100%',
                          minHeight: 156,
                          borderRadius: '12px 12px 4px 4px',
                          background: 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)',
                          border: '2px solid #fbbf24',
                          boxShadow: '0 12px 28px rgba(245,158,11,0.4), inset 0 2px 4px rgba(255,255,255,0.4)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '10px 4px 12px',
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: '1.9rem', lineHeight: 1 }}>🥇</span>
                          <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.95rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                            ૧મો રેન્ક
                          </span>
                          <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.95rem' }}>
                            {top1.mcqScore}/{top1.totalMCQ}
                          </span>
                          <span style={{ background: '#78350f', color: '#fef08a', fontSize: '0.64rem', fontWeight: 900, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                            👑 GOLD TOPPER • {top1.percentage}%
                          </span>
                          {getSubmissionTimeInfo(top1).duration && (
                            <span style={{
                              background: 'rgba(69, 26, 3, 0.8)',
                              color: '#fef08a',
                              border: '1px solid rgba(254, 240, 138, 0.5)',
                              fontSize: '0.62rem',
                              fontWeight: 900,
                              padding: '2px 8px',
                              borderRadius: 10,
                              marginTop: 2,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                              whiteSpace: 'nowrap'
                            }}>
                              <span>⏱️</span>
                              <span>{getSubmissionTimeInfo(top1).duration}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : <div style={{ flex: '1.15 1 0%', minWidth: 0 }} />}

                    {/* 🥉 Rank 3 (Right - Bronze) */}
                    {top3 ? (
                      <div className="leaderboard-podium-card" style={{
                        flex: '1 1 0%',
                        minWidth: 0,
                        background: 'linear-gradient(180deg, rgba(234,88,12,0.15) 0%, rgba(30,41,59,0.9) 100%)',
                        border: isStudentMatch(top3) ? '2.5px solid #38bdf8' : '1.5px solid #ea580c',
                        borderRadius: 16,
                        padding: '14px 6px 10px',
                        textAlign: 'center',
                        boxShadow: isStudentMatch(top3) ? '0 0 20px rgba(56,189,248,0.5)' : '0 6px 18px rgba(0,0,0,0.4)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                      }}>
                        {/* Avatar */}
                        <div style={{ position: 'relative', marginBottom: 6 }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: '#fed7aa', color: '#7c2d12',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', fontWeight: 900,
                            border: '2.5px solid #ea580c',
                            boxShadow: '0 4px 12px rgba(234,88,12,0.3)'
                          }}>
                            {(top3.studentName || 'S')[0].toUpperCase()}
                          </div>
                          {isStudentMatch(top3) && (
                            <span style={{
                              position: 'absolute', bottom: -4, right: -4,
                              background: '#2563eb', color: 'white',
                              fontSize: '0.58rem', fontWeight: 900,
                              padding: '1px 5px', borderRadius: 8,
                              border: '1.5px solid #0f172a'
                            }}>
                              તમે
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.82rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {top3.studentName}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.64rem', margin: '2px 0 6px' }}>
                          📱 {top3.mobile?.slice(0, 5)}****
                        </div>

                        {/* Bronze 3D Pillar */}
                        <div style={{
                          width: '100%',
                          minHeight: 110,
                          borderRadius: '10px 10px 4px 4px',
                          background: 'linear-gradient(180deg, #ea580c 0%, #7c2d12 100%)',
                          border: '1.5px solid #fdba74',
                          boxShadow: '0 6px 16px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          padding: '8px 4px 10px',
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🥉</span>
                          <span style={{ color: '#ffedd5', fontWeight: 900, fontSize: '0.82rem' }}>૩જો રેન્ક</span>
                          <span style={{ color: '#fb923c', fontWeight: 900, fontSize: '0.82rem' }}>
                            {top3.mcqScore}/{top3.totalMCQ}
                          </span>
                          <span style={{ background: '#7c2d12', color: '#fed7aa', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                            BRONZE • {top3.percentage}%
                          </span>
                          {getSubmissionTimeInfo(top3).duration && (
                            <span style={{
                              background: 'rgba(15, 23, 42, 0.65)',
                              color: '#fed7aa',
                              border: '1px solid rgba(253, 186, 116, 0.4)',
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 10,
                              marginTop: 2,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                              whiteSpace: 'nowrap'
                            }}>
                              <span>⏱️</span>
                              <span>{getSubmissionTimeInfo(top3).duration}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : <div style={{ flex: '1 1 0%', minWidth: 0 }} />}

                  </div>
                </div>

                {/* ── 📋 4. ALL REMAINING RANKERS FULL LIST (TOP 10) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', paddingLeft: 4 }}>
                    🏆 Top 10 રેન્કર્સ લિસ્ટ ({Math.min(10, leaders.length)}):
                  </div>

                  {leaders.map((leader) => {
                    const rs = getRankStyle(leader.rank);
                    const isTop3 = leader.rank <= 3;
                    const isMe = isStudentMatch(leader);

                    return (
                      <div
                        key={leader.rank}
                        className={`animate-fade-in ${isMe ? 'user-spotlight-pulse' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: isMe ? '12px 16px' : '10px 14px',
                          border: isMe
                            ? '2.5px solid #38bdf8'
                            : isTop3
                              ? `1.5px solid ${rs.border}`
                              : '1px solid #e2e8f0',
                          background: isMe
                            ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                            : isTop3
                              ? rs.bg
                              : '#ffffff',
                          borderRadius: 14,
                          boxShadow: isMe
                            ? '0 0 24px rgba(56,189,248,0.4), 0 4px 14px rgba(37,99,235,0.2)'
                            : '0 2px 6px rgba(0,0,0,0.02)',
                          transform: isMe ? 'scale(1.015)' : 'none',
                          gap: 10,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Rank Badge + Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: isMe ? 38 : 34, height: isMe ? 38 : 34, borderRadius: 10,
                            background: isMe ? 'linear-gradient(135deg, #2563eb, #38bdf8)' : isTop3 ? rs.border : '#f1f5f9',
                            color: '#ffffff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isTop3 ? '1.15rem' : '0.85rem',
                            fontWeight: 900, flexShrink: 0,
                            boxShadow: isMe ? '0 4px 12px rgba(37,99,235,0.4)' : 'none'
                          }}>
                            {isTop3 ? (leader.rank === 1 ? '🥇' : leader.rank === 2 ? '🥈' : '🥉') : `#${leader.rank}`}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 900,
                              fontSize: isMe ? '0.94rem' : '0.88rem',
                              color: isMe ? '#1e3a8a' : '#0f172a',
                              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                            }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {leader.studentName}
                              </span>
                              {isMe && (
                                <span style={{
                                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                  color: 'white',
                                  fontSize: '0.64rem', fontWeight: 900,
                                  padding: '2px 8px', borderRadius: 12,
                                  boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  flexShrink: 0
                                }}>
                                  🌟 તમે (Your Rank #{leader.rank})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: isMe ? '#2563eb' : '#64748b', marginTop: 1, fontWeight: isMe ? 700 : 500 }}>
                              📱 {leader.mobile?.slice(0, 6)}****
                            </div>
                          </div>
                        </div>

                        {/* Score + Percentage + Duration */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: isMe ? '1.05rem' : '0.95rem', color: isMe ? '#1d4ed8' : '#1e3a8a' }}>
                            {leader.mcqScore} / {leader.totalMCQ}
                          </div>
                          <div style={{
                            display: 'inline-block',
                            background: leader.percentage >= 80 ? '#dcfce7' : leader.percentage >= 50 ? '#eff6ff' : '#fee2e2',
                            color: leader.percentage >= 80 ? '#15803d' : leader.percentage >= 50 ? '#1e40af' : '#b91c1c',
                            fontSize: '0.68rem', fontWeight: 900,
                            padding: '2px 8px', borderRadius: 10, marginTop: 1
                          }}>
                            {leader.percentage}%
                          </div>
                          {getSubmissionTimeInfo(leader).duration && (
                            <div style={{ fontSize: '0.64rem', color: isMe ? '#1d4ed8' : '#64748b', marginTop: 3, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                              <span>⏱️</span>
                              <span>{getSubmissionTimeInfo(leader).duration}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* 🌟 If student is not in Top 10, show a dedicated glowing row at the bottom of the list */}
                  {isOutsideTop10 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        color: '#64748b',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        margin: '6px 0 2px'
                      }}>
                        <div style={{ height: 1, background: '#cbd5e1', flex: 1 }} />
                        <span>••• તમારો ક્રમ (Your Rank Outside Top 10) •••</span>
                        <div style={{ height: 1, background: '#cbd5e1', flex: 1 }} />
                      </div>

                      <div
                        className="animate-fade-in user-spotlight-pulse"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          border: '2.5px solid #0284c7',
                          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                          borderRadius: 14,
                          boxShadow: '0 0 24px rgba(2,132,199,0.3), 0 4px 14px rgba(37,99,235,0.15)',
                          gap: 10,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Rank Badge + Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                            color: '#ffffff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.88rem',
                            fontWeight: 900, flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(2,132,199,0.4)'
                          }}>
                            #{myRank || '?'}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 900,
                              fontSize: '0.94rem',
                              color: '#075985',
                              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                            }}>
                              <span>{currentUserName || 'તમે'}</span>
                              <span style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                color: 'white',
                                fontSize: '0.64rem', fontWeight: 900,
                                padding: '2px 8px', borderRadius: 12,
                                boxShadow: '0 2px 8px rgba(2,132,199,0.35)',
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                flexShrink: 0
                              }}>
                                🌟 તમે (તમારો ક્રમ #{myRank || '?'})
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#0369a1', marginTop: 2, fontWeight: 700 }}>
                              કુલ {activeData.participants} વિદ્યાર્થીઓમાંથી • થોડી વધુ પ્રેક્ટિસથી તમે Top 10 માં આવી જશો!
                            </div>
                          </div>
                        </div>

                        {/* Score + Percentage + Duration */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0369a1' }}>
                            {myScore !== null ? myScore : 0} / {myTotal}
                          </div>
                          <div style={{
                            display: 'inline-block',
                            background: (myPct || 0) >= 80 ? '#dcfce7' : (myPct || 0) >= 50 ? '#eff6ff' : '#fee2e2',
                            color: (myPct || 0) >= 80 ? '#15803d' : (myPct || 0) >= 50 ? '#1e40af' : '#b91c1c',
                            fontSize: '0.68rem', fontWeight: 900,
                            padding: '2px 8px', borderRadius: 10, marginTop: 1
                          }}>
                            {myPct !== null ? `${myPct}%` : '0%'}
                          </div>
                          {studentTimeInfo.duration && (
                            <div style={{ fontSize: '0.64rem', color: '#0369a1', marginTop: 3, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                              <span>⏱️</span>
                              <span>{studentTimeInfo.duration}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        );
      })()}

    </div>
  );
}

// ── Home Page Section (fetches its own data) ─────────────────────────────────
export default function Leaderboard() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = () => {
    getTestWiseLeaderboard()
      .then(res => setTests(res.data || []))
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaderboard();
    window.addEventListener('trinetra_leaderboard_updated', fetchLeaderboard);
    return () => window.removeEventListener('trinetra_leaderboard_updated', fetchLeaderboard);
  }, []);

  return (
    <section id="leaderboard" style={{ padding: '50px 16px', background: 'linear-gradient(180deg, #f0f4ff 0%, #ffffff 100%)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>🏆</div>
          <h2 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.8rem)', fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
            Test-wise Leaderboard
          </h2>
          <p className="gu-text" style={{ color: '#64748b', fontSize: '0.9rem' }}>
            કસોટી પ્રમાણે ટોચના ૧૦ વિદ્યાર્થીઓ (Top 10 Rankers)
          </p>
        </div>
        <LeaderboardUI tests={tests} loading={loading} />
      </div>
    </section>
  );
}
