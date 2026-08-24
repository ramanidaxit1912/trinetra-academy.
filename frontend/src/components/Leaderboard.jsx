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
  const [showTestList, setShowTestList] = useState(false); // mobile: collapsed by default

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
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>⏳</div>
        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>Leaderboard લોડ થઈ રહ્યો છે...</p>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📭</div>
        <p className="gu-text" style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.95rem' }}>
          હજુ સુધી કોઈ ટેસ્ટ completed નથી. પ્રથમ ટેસ્ટ આપો!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Mobile: Horizontal scrollable test tabs ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8
        }}>
          ટેસ્ટ પ્રમાણે ({tests.length})
        </div>

        {/* Horizontal scroll tabs — works on all screen sizes */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 6,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}>
          <style>{`.lb-tabs::-webkit-scrollbar { display: none; }`}</style>
          {tests.map((t, idx) => {
            const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
            const isActive = t.testCode === activeTest;
            const icon = getSubjectIcon(t.subject);
            return (
              <button
                key={t.testCode}
                onClick={() => setActiveTest(t.testCode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 14px',
                  borderRadius: 30,
                  border: isActive ? `2px solid ${color.badge}` : '1.5px solid #e2e8f0',
                  background: isActive ? color.badge : 'white',
                  color: isActive ? 'white' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? `0 3px 12px ${color.badge}40` : '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{icon}</span>
                <span>{t.testName}</span>
                <span style={{
                  background: isActive ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
                  color: isActive ? 'white' : '#64748b',
                  fontSize: '0.65rem', fontWeight: 900,
                  padding: '1px 7px', borderRadius: 20
                }}>
                  {t.participants}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected Test: Header + Leaders ── */}
      {activeData && (() => {
        const color = activeColor;
        const icon = getSubjectIcon(activeData.subject);
        return (
          <div>
            {/* Test Header Banner */}
            <div style={{
              background: `linear-gradient(135deg, ${color.badge}, ${color.badge}bb)`,
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 12,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ fontSize: '1.8rem', flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeData.testName}
                </div>
                <div style={{ opacity: 0.88, fontSize: '0.75rem', marginTop: 2 }}>
                  📚 {activeData.subject} &nbsp;•&nbsp; 👥 {activeData.participants} participants &nbsp;•&nbsp; 🏅 Top {activeData.leaders.length}
                </div>
              </div>
            </div>

            {/* Leader rows */}
            {activeData.leaders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0' }}>
                <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.88rem' }}>આ ટેસ્ટ માટે હજુ કોઈ result નથી.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {activeData.leaders.map((leader) => {
                  const rs = getRankStyle(leader.rank);
                  const isTop3 = leader.rank <= 3;
                  const isMe = currentUserName && leader.studentName === currentUserName;

                  return (
                    <div
                      key={leader.rank}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: isTop3 ? '13px 16px' : '10px 14px',
                        border: isMe
                          ? '2px solid #2563eb'
                          : `${isTop3 ? 2 : 1}px solid ${rs.border}`,
                        background: isMe ? '#eff6ff' : rs.bg,
                        borderRadius: isTop3 ? 14 : 10,
                        boxShadow: isTop3 ? `0 4px 14px ${rs.border}44` : '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      {/* Medal/Rank */}
                      <div style={{
                        width: isTop3 ? 40 : 30,
                        height: isTop3 ? 40 : 30,
                        flexShrink: 0,
                        background: isTop3 ? rs.border : '#f1f5f9',
                        borderRadius: isTop3 ? 11 : 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isTop3 ? '1.3rem' : '0.75rem',
                        fontWeight: 900,
                        color: isTop3 ? 'white' : '#64748b'
                      }}>
                        {isTop3 ? rs.medal : `#${leader.rank}`}
                      </div>

                      {/* Name + Mobile */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 800,
                          fontSize: isTop3 ? '0.95rem' : '0.85rem',
                          color: '#0f172a',
                          display: 'flex', alignItems: 'center', gap: 5,
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                            {leader.studentName}
                          </span>
                          {isMe && (
                            <span style={{
                              background: '#2563eb', color: 'white',
                              fontSize: '0.6rem', fontWeight: 800,
                              padding: '1px 6px', borderRadius: 4, flexShrink: 0
                            }}>
                              તમે
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 1 }}>
                          📱 {leader.mobile}
                        </div>
                      </div>

                      {/* Score + % */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontWeight: 900,
                          fontSize: isTop3 ? '1.05rem' : '0.9rem',
                          color: color.badge
                        }}>
                          {leader.mcqScore}/{leader.totalMCQ}
                        </div>
                        <div style={{
                          display: 'inline-block',
                          background: leader.percentage >= 80 ? '#dcfce7' : leader.percentage >= 50 ? '#fef3c7' : '#fee2e2',
                          color: leader.percentage >= 80 ? '#166534' : leader.percentage >= 50 ? '#92400e' : '#991b1b',
                          fontSize: '0.65rem', fontWeight: 800,
                          padding: '2px 8px', borderRadius: 20, marginTop: 2
                        }}>
                          {leader.percentage}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
