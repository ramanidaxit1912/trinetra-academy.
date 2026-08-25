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
export function LeaderboardUI({ tests = [], loading = false, currentUserName = null }) {
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

  const leaders = activeData?.leaders || [];
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
                <span style={{
                  background: isActive ? '#38bdf8' : '#e2e8f0',
                  color: isActive ? '#0b1329' : '#475569',
                  fontSize: '0.68rem', fontWeight: 900,
                  padding: '2px 7px', borderRadius: 12
                }}>
                  👥 {t.participants}
                </span>
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
                  {activeData.testName}
                </h3>
                <div style={{ color: '#93c5fd', fontSize: '0.74rem', fontWeight: 700, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>📚 {activeData.subject}</span>
                  <span style={{ opacity: 0.6 }}>•</span>
                  <span>👥 {activeData.participants} વિદ્યાર્થીઓ</span>
                  <span style={{ opacity: 0.6 }}>•</span>
                  <span>🏅 Top {leaders.length} Rankers</span>
                </div>
              </div>
            </div>

            {/* If no leaders */}
            {leaders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 34, background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📝</div>
                <h4 style={{ color: '#0f172a', fontWeight: 900, margin: '0 0 4px' }}>હજુ કોઈ પરિણામ નથી</h4>
                <p style={{ color: '#64748b', fontSize: '0.84rem', margin: 0 }}>આ ટેસ્ટ આપનાર પ્રથમ વિદ્યાર્થી બનો!</p>
              </div>
            ) : (
              <>
                {/* ── 👑 3. TOP 3 PODIUM HERO SHOWCASE (GUARANTEED 3-COLUMN FLEX PODIUM) ── */}
                <div className="leaderboard-podium-container" style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'nowrap',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  margin: '12px 0 14px',
                  boxSizing: 'border-box'
                }}>
                  
                  {/* 🥈 Rank 2 (Left) */}
                  {top2 ? (
                    <div className="leaderboard-podium-card" style={{
                      flex: '1 1 0%',
                      minWidth: 0,
                      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '2px solid #94a3b8',
                      borderRadius: 14,
                      padding: '12px 6px 8px',
                      textAlign: 'center',
                      boxShadow: '0 4px 14px rgba(148,163,184,0.25)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minHeight: 135,
                      justifyContent: 'flex-end',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ position: 'absolute', top: -13, background: 'linear-gradient(135deg, #64748b, #94a3b8)', color: 'white', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: '2px solid white' }}>
                        🥈
                      </div>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 900, color: '#334155', marginBottom: 4, border: '2px solid #94a3b8' }}>
                        {(top2.studentName || 'S')[0].toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                        {top2.studentName}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, margin: '1px 0 3px', whiteSpace: 'nowrap' }}>
                        📱 {top2.mobile?.slice(0, 5)}****
                      </div>
                      <div style={{ background: '#e2e8f0', color: '#1e293b', padding: '2px 6px', borderRadius: 14, fontSize: '0.68rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {top2.mcqScore}/{top2.totalMCQ} ({top2.percentage}%)
                      </div>
                    </div>
                  ) : <div style={{ flex: '1 1 0%', minWidth: 0 }} />}

                  {/* 👑 🥇 Rank 1 (Center - Elevated & Glowing Gold) */}
                  {top1 ? (
                    <div className="leaderboard-podium-card" style={{
                      flex: '1.1 1 0%',
                      minWidth: 0,
                      background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
                      border: '2.5px solid #f59e0b',
                      borderRadius: 16,
                      padding: '14px 6px 10px',
                      textAlign: 'center',
                      boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minHeight: 155,
                      justifyContent: 'flex-end',
                      transform: 'translateY(-6px)',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ position: 'absolute', top: -15, background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', fontWeight: 900, boxShadow: '0 4px 12px rgba(234,179,8,0.5)', border: '2px solid white', animation: 'bounce 2s infinite' }}>
                        👑
                      </div>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #facc15, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, color: '#713f12', marginBottom: 4, border: '2px solid #ca8a04', boxShadow: '0 0 12px rgba(234,179,8,0.5)' }}>
                        {(top1.studentName || 'S')[0].toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '0.84rem', color: '#713f12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                        {top1.studentName}
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#854d0e', fontWeight: 700, margin: '1px 0 3px', whiteSpace: 'nowrap' }}>
                        📱 {top1.mobile?.slice(0, 5)}****
                      </div>
                      <div style={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: '#ffffff', padding: '2px 8px', borderRadius: 14, fontSize: '0.72rem', fontWeight: 900, boxShadow: '0 2px 6px rgba(202,138,4,0.3)', whiteSpace: 'nowrap' }}>
                        {top1.mcqScore}/{top1.totalMCQ} ({top1.percentage}%)
                      </div>
                    </div>
                  ) : <div style={{ flex: '1.1 1 0%', minWidth: 0 }} />}

                  {/* 🥉 Rank 3 (Right) */}
                  {top3 ? (
                    <div className="leaderboard-podium-card" style={{
                      flex: '1 1 0%',
                      minWidth: 0,
                      background: 'linear-gradient(180deg, #fff7ed 0%, #ffedd5 100%)',
                      border: '2px solid #ea580c',
                      borderRadius: 14,
                      padding: '12px 6px 8px',
                      textAlign: 'center',
                      boxShadow: '0 4px 14px rgba(234,88,12,0.25)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minHeight: 125,
                      justifyContent: 'flex-end',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ position: 'absolute', top: -13, background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: 'white', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', border: '2px solid white' }}>
                        🥉
                      </div>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', fontWeight: 900, color: '#7c2d12', marginBottom: 4, border: '2px solid #ea580c' }}>
                        {(top3.studentName || 'S')[0].toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                        {top3.studentName}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#9a3412', fontWeight: 700, margin: '1px 0 3px', whiteSpace: 'nowrap' }}>
                        📱 {top3.mobile?.slice(0, 5)}****
                      </div>
                      <div style={{ background: '#fed7aa', color: '#7c2d12', padding: '2px 6px', borderRadius: 14, fontSize: '0.68rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {top3.mcqScore}/{top3.totalMCQ} ({top3.percentage}%)
                      </div>
                    </div>
                  ) : <div style={{ flex: '1 1 0%', minWidth: 0 }} />}

                </div>

                {/* ── 📋 4. ALL REMAINING RANKERS FULL LIST ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', paddingLeft: 4 }}>
                    તમામ રેન્કર્સ લિસ્ટ ({leaders.length}):
                  </div>

                  {leaders.map((leader) => {
                    const rs = getRankStyle(leader.rank);
                    const isTop3 = leader.rank <= 3;
                    const isMe = currentUserName && leader.studentName === currentUserName;

                    return (
                      <div
                        key={leader.rank}
                        className="animate-fade-in"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          border: isMe
                            ? '2px solid #2563eb'
                            : isTop3
                              ? `1.5px solid ${rs.border}`
                              : '1px solid #e2e8f0',
                          background: isMe
                            ? '#eff6ff'
                            : isTop3
                              ? rs.bg
                              : '#ffffff',
                          borderRadius: 12,
                          boxShadow: isMe
                            ? '0 4px 14px rgba(37,99,235,0.2)'
                            : '0 2px 6px rgba(0,0,0,0.02)',
                          gap: 10
                        }}
                      >
                        {/* Rank Badge + Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: isTop3 ? rs.border : '#f1f5f9',
                            color: isTop3 ? '#ffffff' : '#475569',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: isTop3 ? '1.05rem' : '0.82rem',
                            fontWeight: 900, flexShrink: 0
                          }}>
                            {isTop3 ? (leader.rank === 1 ? '🥇' : leader.rank === 2 ? '🥈' : '🥉') : `#${leader.rank}`}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              color: '#0f172a',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {leader.studentName}
                              </span>
                              {isMe && (
                                <span style={{
                                  background: '#2563eb', color: 'white',
                                  fontSize: '0.62rem', fontWeight: 900,
                                  padding: '1px 6px', borderRadius: 4, flexShrink: 0
                                }}>
                                  તમે
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>
                              📱 {leader.mobile?.slice(0, 6)}****
                            </div>
                          </div>
                        </div>

                        {/* Score + Percentage */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#1e3a8a' }}>
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
                        </div>
                      </div>
                    );
                  })}
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

  useEffect(() => {
    getTestWiseLeaderboard()
      .then(res => setTests(res.data || []))
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
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
            ટેસ્ટ પ્રમાણે ટોચના વિદ્યાર્થીઓ
          </p>
        </div>
        <LeaderboardUI tests={tests} loading={loading} />
      </div>
    </section>
  );
}
