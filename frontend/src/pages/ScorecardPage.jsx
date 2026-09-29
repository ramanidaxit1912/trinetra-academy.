import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import { ConfettiCanvas } from '../components/ConfettiBadges';
import { formatMathText, formatQuestionText } from '../utils/mathFormatter';
import { isImg, extractImgSrc } from '../components/ExamEngine';

export default function ScorecardPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('PDF'); // 'PDF' (Official Scorecard) | 'REVIEW' (Question-by-Question)
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'CORRECT' | 'WRONG' | 'SKIPPED'
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadToast, setDownloadToast] = useState('');

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

  // Background direct download (like YouTube/Facebook) — NO blank white page tab!
  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      setDownloadToast('📥 PDF તૈયાર થઈ રહી છે... થોડી સેકન્ડ રાહ જુઓ');

      const res = await axios.get(`/api/submissions/${id}/pdf`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanStudentName = (data?.student?.name || 'Student').replace(/\s+/g, '_');
      const testName = (data?.submission?.testName || 'Scorecard').replace(/\s+/g, '_');
      link.setAttribute('download', `${cleanStudentName}_${testName}_Scorecard.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);

      setDownloadToast('✅ PDF સફળતાપૂર્વક ડાઉનલોડ થઈ ગઈ!');
      setTimeout(() => setDownloadToast(''), 3500);
    } catch (e) {
      console.warn('Direct blob download fallback to hidden iframe:', e);
      // Fallback: silent hidden iframe download without opening any white tab
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `/api/submissions/${id}/pdf`;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 60000);
      setDownloadToast('📥 PDF ડાઉનલોડ શરૂ થઈ ગયું છે!');
      setTimeout(() => setDownloadToast(''), 3500);
    } finally {
      setDownloadingPdf(false);
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
      <div style={{ minHeight: '100vh', background: '#0b1329', color: '#f8fafc', paddingBottom: 60, fontFamily: 'Plus Jakarta Sans, Noto Sans Gujarati, sans-serif' }}>
        <Navbar />
        <div style={{ maxWidth: 940, margin: '20px auto', padding: '0 12px' }}>
          {/* Top bar skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="skeleton-pulse" style={{ width: 90, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.08)' }} />
            <div className="skeleton-pulse" style={{ width: 200, height: 34, borderRadius: 12, background: 'rgba(255,255,255,0.08)' }} />
            <div className="skeleton-pulse" style={{ width: 130, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Student Profile & Test Title Skeleton */}
          <div style={{ background: '#111827', borderRadius: 20, padding: '24px 20px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div className="skeleton-pulse" style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-pulse" style={{ width: '45%', height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.1)', marginBottom: 10 }} />
                <div className="skeleton-pulse" style={{ width: '30%', height: 16, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }} />
              </div>
            </div>

            {/* 4 Stat Boxes Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="skeleton-pulse" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '16px 12px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                  <div style={{ width: '50%', height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.08)', margin: '0 auto 10px' }} />
                  <div style={{ width: '70%', height: 26, borderRadius: 6, background: 'rgba(56,189,248,0.18)', margin: '0 auto' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Main Certificate / Solution Card Skeleton */}
          <div style={{ background: '#111827', borderRadius: 20, padding: '28px 20px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
            <div className="skeleton-pulse" style={{ width: '50%', height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.1)', margin: '0 auto 18px' }} />
            <div className="skeleton-pulse" style={{ width: '75%', height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.05)', margin: '0 auto 12px' }} />
            <div className="skeleton-pulse" style={{ width: '65%', height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.05)', margin: '0 auto 28px' }} />
            <div className="skeleton-pulse" style={{ width: '100%', height: 320, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }} />
          </div>
        </div>
        <style>{`
          @keyframes skeletonPulse {
            0%, 100% { opacity: 0.35; }
            50% { opacity: 0.85; }
          }
          .skeleton-pulse {
            animation: skeletonPulse 1.3s ease-in-out infinite;
          }
        `}</style>
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

  if (data?.isLocked) {
    const publishDateStr = data.resultsPublishAt 
      ? new Date(data.resultsPublishAt).toLocaleString('gu-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : null;

    return (
      <div style={{ minHeight: '100vh', background: '#0b1329', color: '#f8fafc', paddingBottom: 60, fontFamily: 'Plus Jakarta Sans, Noto Sans Gujarati, sans-serif' }}>
        <Navbar />
        <div style={{ maxWidth: 640, margin: '50px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 24,
            padding: '40px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '2px solid rgba(245, 158, 11, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              margin: '0 auto 20px'
            }}>
              🔒
            </div>

            <span style={{
              display: 'inline-block',
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fef08a',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: '0.85rem',
              fontWeight: 800,
              marginBottom: 16
            }}>
              વિગતવાર સ્કોરકાર્ડ & સોલ્યુશન લૉક છે
            </span>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginBottom: 6 }}>
              {data.submission?.testName || 'ટેસ્ટ પરિણામ'}
            </h2>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>
              વિદ્યાર્થી: <strong style={{ color: '#38bdf8' }}>{data.submission?.student?.name || 'વિદ્યાર્થી'}</strong>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>
              પરીક્ષાની પારદર્શિતા જાળવવા અને પેપર લીક / ચોરી અટકાવવા માટે તમામ વિદ્યાર્થીઓનું વિગતવાર સોલ્યુશન, આન્સર કી અને રેન્ક કાર્ડ નિર્ધારિત સમયે જ જાહેર કરવામાં આવશે.
            </p>

            {publishDateStr && (
              <div style={{
                background: 'rgba(30, 58, 138, 0.35)',
                border: '1.5px solid rgba(96, 165, 250, 0.4)',
                borderRadius: 16,
                padding: '16px 20px',
                marginBottom: 24,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12
              }}>
                <span style={{ fontSize: '1.5rem' }}>⏳</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    પરિણામ જાહેર થવાનો શિડ્યુલ સમય
                  </div>
                  <div style={{ fontSize: '1.05rem', color: '#ffffff', fontWeight: 900 }}>
                    {publishDateStr}
                  </div>
                </div>
              </div>
            )}

            {data.submission && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14,
                padding: '16px',
                maxWidth: 360,
                margin: '0 auto 28px'
              }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>તમારા મેળવેલ પ્રાથમિક ગુણ</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>
                  {data.submission.score} <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>/ {data.submission.totalMarks}</span>
                </div>
              </div>
            )}

            <div>
              <Link to="/student" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#2563eb',
                color: '#ffffff',
                padding: '12px 28px',
                borderRadius: 12,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}>
                ← વિદ્યાર્થી ડેશબોર્ડ પર પાછા જાઓ
              </Link>
            </div>
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

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 4px 18px rgba(16, 185, 129, 0.4); transform: translateY(0); }
          50% { box-shadow: 0 8px 28px rgba(16, 185, 129, 0.65); transform: translateY(-1.5px); }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes spinRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .btn-download-glow {
          animation: pulseGlow 2.4s infinite ease-in-out;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .btn-download-glow:active {
          transform: scale(0.96) !important;
        }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 45%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent);
          animation: shimmerSlide 3s infinite linear;
          pointer-events: none;
        }
        .btn-touch {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .btn-touch:active {
          transform: scale(0.95);
        }
        .spinner-ring {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-radius: 50%;
          border-top-color: #ffffff;
          animation: spinRing 0.8s linear infinite;
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translate(-50%, 15px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* Responsive rules for mobile phone view */
        @media (max-width: 768px) {
          .scorecard-header-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .scorecard-mode-toggle {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
          }
          .scorecard-mode-toggle button {
            justify-content: center !important;
            text-align: center !important;
            padding: 8px 6px !important;
            font-size: 0.82rem !important;
          }
          .scorecard-hero-card {
            padding: 12px 14px !important;
          }
        }
      `}</style>

      {/* 🎉 Confetti Burst on Good Score */}
      {isPassing && <ConfettiCanvas duration={4000} />}

      <div style={{ maxWidth: 940, margin: '20px auto', padding: '0 12px' }}>

        {/* ── Top Bar: Back to Home + Mode Switcher ── */}
        <div className="scorecard-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <Link
            to="/"
            className="btn-touch"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#cbd5e1',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '6px 14px',
              borderRadius: 20,
              textDecoration: 'none',
              fontSize: '0.84rem',
              fontWeight: 700
            }}
          >
            ← હોમ પેજ
          </Link>

          {/* View Mode Toggle: [📄 અધિકૃત PDF સ્કોરકાર્ડ] vs [📝 પ્રશ્નવાર રિવ્યુ] */}
          <div className="scorecard-mode-toggle" style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', padding: 3, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setViewMode('PDF')}
              className="btn-touch"
              style={{
                background: viewMode === 'PDF' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                color: viewMode === 'PDF' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '7px 16px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: viewMode === 'PDF' ? '0 4px 12px rgba(37,99,235,0.35)' : 'none'
              }}
            >
              📄 સત્તાવાર PDF માર્કશીટ
            </button>
            <button
              onClick={() => setViewMode('REVIEW')}
              className="btn-touch"
              style={{
                background: viewMode === 'REVIEW' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                color: viewMode === 'REVIEW' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '7px 16px',
                borderRadius: 9,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: viewMode === 'REVIEW' ? '0 4px 12px rgba(37,99,235,0.35)' : 'none'
              }}
            >
              📝 પ્રશ્નવાર સોલ્યુશન
            </button>
          </div>
        </div>

        {/* ── 🌟 Mobile & Desktop Hero Action Card ── */}
        <div
          className="scorecard-hero-card"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.92) 0%, rgba(15, 23, 42, 0.98) 100%)',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 18,
            padding: '16px 18px',
            marginBottom: 16,
            boxShadow: '0 12px 30px -5px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Header Row: Test Name + Score Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                {submission.testName || 'કસોટી પરિણામ'}
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: isPassing ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                  color: isPassing ? '#34d399' : '#f87171',
                  border: `1px solid ${isPassing ? '#10b981' : '#ef4444'}`
                }}
              >
                {isPassing ? '✓ ઉત્તીર્ણ (Pass)' : 'પ્રયાસ જરૂરી'}
              </span>
            </div>
            <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
              વિદ્યાર્થી: <strong style={{ color: '#38bdf8' }}>{student.name || 'વિદ્યાર્થી'}</strong> • સ્કોર: <strong style={{ color: isPassing ? '#34d399' : '#f87171', fontSize: '0.96rem' }}>{score}/{totalMarks} ({pct}%)</strong>
            </div>
          </div>

          {/* Action Buttons: 🖨️ પ્રિન્ટ + 📥 Download Scorecard PDF (In ONE Single Line!) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(95px, 1fr) 2fr', gap: 10, width: '100%', alignItems: 'stretch' }}>
            <button
              onClick={handlePrint}
              className="btn-touch"
              title="પ્રિન્ટ કરો"
              style={{
                minHeight: 46,
                background: 'linear-gradient(135deg, rgba(51, 65, 85, 0.85) 0%, rgba(30, 41, 59, 0.95) 100%)',
                border: '1.5px solid rgba(255, 255, 255, 0.18)',
                color: '#f8fafc',
                padding: '8px 12px',
                borderRadius: 14,
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ fontSize: '1.15rem' }}>🖨️</span>
              <span>પ્રિન્ટ</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="btn-download-glow btn-touch btn-shimmer"
              style={{
                minHeight: 46,
                background: downloadingPdf
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 55%, #047857 100%)',
                border: '1.5px solid rgba(52, 211, 153, 0.45)',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: 14,
                fontSize: '0.9rem',
                fontWeight: 900,
                cursor: downloadingPdf ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 6px 22px rgba(16, 185, 129, 0.5)'
              }}
            >
              {downloadingPdf ? (
                <>
                  <span className="spinner-ring" />
                  <span style={{ fontSize: '0.86rem' }}>PDF ડાઉનલોડ થાય છે...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.25rem' }}>📥</span>
                  <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900 }}>Download Scorecard PDF</div>
                    <div style={{ fontSize: '0.66rem', fontWeight: 600, opacity: 0.9 }}>ઓરિજિનલ HD માર્કશીટ</div>
                  </div>
                </>
              )}
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

                    <div 
                      style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.6, marginBottom: 12 }}
                      dangerouslySetInnerHTML={{ __html: formatQuestionText(q.questionText || '') }}
                    />

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

      {/* ── 🌟 YouTube/Facebook Style Download Toast (Zero White Tab!) ── */}
      {downloadToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: 30,
            fontSize: '0.88rem',
            fontWeight: 700,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            whiteSpace: 'nowrap',
            animation: 'fadeSlideUp 0.3s ease-out'
          }}
        >
          <span>{downloadToast}</span>
        </div>
      )}
    </div>
  );
}
