import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { ConfettiCanvas } from '../components/ConfettiBadges';
import { formatMathText } from '../utils/mathFormatter';
import { isImg, extractImgSrc } from '../components/ExamEngine';

export default function ScorecardPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('PDF'); // 'PDF' (Official Scorecard) | 'REVIEW' (Question-by-Question)
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'CORRECT' | 'WRONG' | 'SKIPPED'
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    async function fetchScorecard() {
      try {
        setLoading(true);
        setError('');
        const res = await axios.get(`/api/submissions/review/${id}`);
        setData(res.data);
      } catch (err) {
        console.error('Fetch Scorecard Error:', err);
        setError(err.response?.data?.error || 'સ્કોરકાર્ડ લોડ કરવામાં ભૂલ આવી. કૃપા કરીને લિંક ફરીથી તપાસો.');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchScorecard();
  }, [id]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      window.open(`/api/submissions/${id}/pdf`, '_blank');
    } catch (e) {
      console.warn('PDF download note:', e);
    } finally {
      setTimeout(() => setDownloadingPdf(false), 2000);
    }
  };

  const handlePrint = () => {
    const iframe = document.getElementById('scorecard-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }} className="animate-bounce">📊</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginBottom: 8 }}>
              સત્તાવાર સ્કોરકાર્ડ લોડ થઈ રહ્યું છે...
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>કૃપા કરીને થોડી ક્ષણો રાહ જુઓ ✨</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.submission) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
        <Navbar />
        <div style={{ maxWidth: 540, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fca5a5', marginBottom: 10 }}>
              પરિણામ મળ્યું નથી
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.6 }}>
              {error || 'આ સ્કોરકાર્ડ ઉપલબ્ધ નથી અથવા લિંક અમાન્ય છે.'}
            </p>
            <Link to="/" style={{ display: 'inline-block', background: '#2563eb', color: '#ffffff', padding: '10px 24px', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>
              🏠 હોમ પેજ પર જાઓ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { submission, review = [] } = data;
  const student = submission.student || {};
  const totalQ = review.length || submission.totalMCQ || 1;
  const totalMarks = Number(submission.totalMarks) > 0 ? Number(submission.totalMarks) : totalQ;
  const score = Number((submission.mcqScore || 0) + (submission.teacherMarks || 0)) || 0;
  const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const isPassing = pct >= 60;

  const correctCount = submission.correctCount ?? review.filter(r => r.isCorrect === true).length;
  const wrongCount = submission.wrongCount ?? review.filter(r => r.isCorrect === false && !r.isSkipped).length;
  const skippedCount = review.filter(r => r.isSkipped).length;
  const negativeMarks = submission.negativeMarks || 0;

  const filteredReview = review.filter(r => {
    if (filter === 'CORRECT') return r.isCorrect === true;
    if (filter === 'WRONG') return r.isCorrect === false && !r.isSkipped;
    if (filter === 'SKIPPED') return r.isSkipped;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0b1329', color: '#f8fafc', paddingBottom: 60, fontFamily: 'Plus Jakarta Sans, Noto Sans Gujarati, sans-serif' }}>
      <Navbar />

      {/* 🎉 Confetti Burst on Good Score */}
      {isPassing && <ConfettiCanvas duration={4000} />}

      <div style={{ maxWidth: 940, margin: '20px auto', padding: '0 12px' }}>

        {/* ── Top Bar with Actions & Mode Switcher ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
            ← હોમ પેજ
          </Link>

          {/* View Mode Toggle: [📄 અધિકૃત PDF સ્કોરકાર્ડ] vs [📝 પ્રશ્નવાર રિવ્યુ] */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: 3, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setViewMode('PDF')}
              style={{
                background: viewMode === 'PDF' ? '#2563eb' : 'transparent',
                color: viewMode === 'PDF' ? '#ffffff' : '#cbd5e1',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 9,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              📄 સત્તાવાર PDF માર્કશીટ
            </button>
            <button
              onClick={() => setViewMode('REVIEW')}
              style={{
                background: viewMode === 'REVIEW' ? '#2563eb' : 'transparent',
                color: viewMode === 'REVIEW' ? '#ffffff' : '#cbd5e1',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 9,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              📝 પ્રશ્નવાર સોલ્યુશન
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', padding: '8px 14px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🖨️ પ્રિન્ટ
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', padding: '8px 18px', borderRadius: 10, fontSize: '0.86rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}
            >
              {downloadingPdf ? '⏳ PDF ડાઉનલોડ થાય છે...' : '📥 Download PDF'}
            </button>
          </div>
        </div>

        {/* ── Mode 1: OFFICIAL ROYAL SCORECARD (Exact 100% PDF Formation) ── */}
        {viewMode === 'PDF' && (
          <div style={{ background: '#ffffff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <iframe
              id="scorecard-iframe"
              title="Official Trinetra Scorecard"
              src={`/api/submissions/${id}/html`}
              style={{
                width: '100%',
                height: '820px',
                border: 'none',
                display: 'block',
                background: '#ffffff'
              }}
            />
          </div>
        )}

        {/* ── Mode 2: INTERACTIVE SOLUTION REVIEW ── */}
        {viewMode === 'REVIEW' && (
          <div style={{ background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 24, overflow: 'hidden', padding: '24px 20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
            
            {/* Quick Summary Strip */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
                  {submission.testName || 'કસોટી'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0 }}>
                  વિદ્યાર્થી: <strong style={{ color: '#38bdf8' }}>{student.name || 'વિદ્યાર્થી'}</strong> • સ્કોર: <strong style={{ color: isPassing ? '#34d399' : '#f87171' }}>{score}/{totalMarks} ({pct}%)</strong>
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: `બધા (${review.length})` },
                  { key: 'CORRECT', label: `સાચા (${correctCount})` },
                  { key: 'WRONG', label: `ખોટા (${wrongCount})` },
                  { key: 'SKIPPED', label: `છોડેલા (${skippedCount})` }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    style={{
                      background: filter === t.key ? '#2563eb' : 'rgba(255,255,255,0.06)',
                      border: filter === t.key ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                      color: filter === t.key ? '#ffffff' : '#94a3b8',
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredReview.map((item, idx) => {
                const q = item.question || {};
                const qNum = review.indexOf(item) + 1;
                const studentAns = item.studentAnswer;
                const correctAns = q.correctOpt;
                const isCorrect = item.isCorrect;
                const isSkipped = item.isSkipped;

                const statusColor = isCorrect ? '#10b981' : isSkipped ? '#f59e0b' : '#ef4444';
                const statusBadge = isCorrect ? '✓ સાચો જવાબ' : isSkipped ? '⏭️ છોડેલો પ્રશ્ન' : '✗ ખોટો જવાબ';

                return (
                  <div
                    key={q.id || idx}
                    style={{
                      background: 'rgba(15,23,42,0.65)',
                      border: `1.5px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : isSkipped ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: 16,
                      padding: '16px 18px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8' }}>
                        પ્રશ્ન {qNum} {q.subject ? `• ${q.subject}` : ''}
                      </span>
                      <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: 12, background: `${statusColor}22`, border: `1px solid ${statusColor}`, color: statusColor }}>
                        {statusBadge}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.6, marginBottom: 12 }}>
                      {formatMathText(q.questionText || '')}
                    </div>

                    {isImg(q.questionImage || q.imageUrl) && (
                      <div style={{ marginBottom: 12, maxWidth: 360 }}>
                        <img src={extractImgSrc(q.questionImage || q.imageUrl)} alt="Question illustration" style={{ width: '100%', borderRadius: 8 }} />
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 10 }}>
                      {['A', 'B', 'C', 'D', 'E'].map(optKey => {
                        const optText = q[`option${optKey}`];
                        if (!optText && optKey === 'E' && !q.optionE) return null;
                        if (!optText && optKey !== 'E') return null;

                        const isStudentChoice = studentAns === optKey;
                        const isCorrectChoice = correctAns === optKey;

                        let optBg = 'rgba(255,255,255,0.03)';
                        let optBorder = 'rgba(255,255,255,0.1)';
                        let optColor = '#cbd5e1';

                        if (isCorrectChoice) {
                          optBg = 'rgba(16,185,129,0.18)';
                          optBorder = '#10b981';
                          optColor = '#34d399';
                        } else if (isStudentChoice && !isCorrect) {
                          optBg = 'rgba(239,68,68,0.18)';
                          optBorder = '#ef4444';
                          optColor = '#f87171';
                        }

                        return (
                          <div
                            key={optKey}
                            style={{
                              background: optBg,
                              border: `1px solid ${optBorder}`,
                              borderRadius: 10,
                              padding: '8px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: '0.86rem',
                              color: optColor,
                              fontWeight: (isStudentChoice || isCorrectChoice) ? 700 : 500
                            }}
                          >
                            <span style={{ fontWeight: 800, minWidth: 20 }}>({optKey})</span>
                            <span style={{ flex: 1 }}>{formatMathText(optText || (optKey === 'E' ? 'Not Attempted' : ''))}</span>
                            {isCorrectChoice && <span style={{ color: '#34d399', fontWeight: 900 }}>✓ સાચો</span>}
                            {isStudentChoice && !isCorrectChoice && <span style={{ color: '#f87171', fontWeight: 900 }}>✗ તમારો જવાબ</span>}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(56,189,248,0.08)', borderLeft: '3px solid #38bdf8', borderRadius: '0 8px 8px 0', fontSize: '0.84rem', color: '#93c5fd' }}>
                        <span style={{ fontWeight: 800 }}>💡 સમજૂતી (Explanation):</span> {formatMathText(q.explanation)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
