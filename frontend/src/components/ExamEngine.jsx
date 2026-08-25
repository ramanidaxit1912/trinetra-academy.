import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { saveTestProgress } from '../services/api';
import { formatMathText } from '../utils/mathFormatter';

export const isImg = (val) => {
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

export const extractImgSrc = (val) => {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (s.startsWith('<img')) {
    const m = s.match(/src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }
  return s;
};

export default function ExamEngine({ onFinish }) {
  const { user, questions, currentIndex, setCurrentIndex, answers, recordAnswer } = useStore();

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const currentAns = answers[currentQ?.id] || {};
  const questionStartTimeRef = useRef(Date.now());
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved'

  // ─── Determine Timer Mode ─────────────────────────────────
  // timeLimit === 0 (or null/undefined) -> No limit (Default)
  // 1 <= timeLimit <= 300 -> Per-Question Timer (seconds per question e.g. 30s, 45s, 60s, 90s, 120s, 180s)
  // timeLimit > 300  -> Total Test Timer (total exam countdown in seconds e.g. 1800s for 30m, 3600s for 60m)
  const rawTimeLimit = Number(currentQ?.timeLimit || 0);
  const isNoTimer = rawTimeLimit === 0 || currentQ?.noTimer === true;
  const isTotalTestTimer = !isNoTimer && rawTimeLimit > 300;
  const isPerQuestionTimer = !isNoTimer && !isTotalTestTimer;

  // Per-Question seconds allotment (no carryover / no bonus)
  const secPerQ = isPerQuestionTimer ? Math.max(10, rawTimeLimit) : 0;

  const activeTestCode = currentQ?.testCode || 'GENERAL';
  const activeTestName = currentQ?.testName || currentQ?.chapter || 'કસોટી';
  const activeSubject  = currentQ?.subject  || 'General';

  // Per-Question timers map: tracks remaining time per question index { [qIndex]: number }
  const [qTimeLeftMap, setQTimeLeftMap] = useState(() => {
    try {
      const storageKey = `trinetra_exam_q_timers_${user?.mobile || 'guest'}_${activeTestCode}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [perQTimeLeft, setPerQTimeLeft] = useState(() => {
    return qTimeLeftMap[currentIndex] !== undefined ? qTimeLeftMap[currentIndex] : secPerQ;
  });

  // Total Test Timer overall countdown in seconds
  const totalTestInitialSecs = isTotalTestTimer ? rawTimeLimit : 0;
  const [totalTestTimeLeft, setTotalTestTimeLeft] = useState(totalTestInitialSecs);

  const [showPalette, setShowPalette] = useState(false);
  const [lockedToast, setLockedToast] = useState('');
  const [securityWarning, setSecurityWarning] = useState('');
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [slideDirection, setSlideDirection] = useState('next'); // 'next' | 'prev'
  const timerRef = useRef(null);

  // ─── 🔊 Web Audio Procedural Slide Whoosh Sound ───────────
  const playSlideWhoosh = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  };

  // ─── Auto Scroll to Top on Question Change ───────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  // ─── 🛡️ Anti-Cheat & Copy Protection Engine ────────────────
  useEffect(() => {
    // 1. Block Context Menu (Right Click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      setSecurityWarning('🔒 કસોટી સુરક્ષા: રાઈટ-ક્લિક (Right Click) પ્રતિબંધિત છે.');
      setTimeout(() => setSecurityWarning(''), 3000);
      return false;
    };

    // 2. Block Keyboard Shortcuts (Copy, Cut, Paste, Print, Select All, DevTools)
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      // F12 or Ctrl+Shift+I / J / C (DevTools)
      if (e.key === 'F12' || (isCtrlOrCmd && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))) {
        e.preventDefault();
        setSecurityWarning('🔒 કસોટી સુરક્ષા: DevTools / Inspect એક્સેસ પ્રતિબંધિત છે.');
        setTimeout(() => setSecurityWarning(''), 3000);
        return false;
      }
      // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+U
      if (isCtrlOrCmd && ['c', 'C', 'v', 'V', 'x', 'X', 'a', 'A', 'p', 'P', 'u', 'U', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        setSecurityWarning('🔒 કસોટી સુરક્ષા: કોપી / પેસ્ટ / પ્રિન્ટ / સિલેક્ટ પ્રતિબંધિત છે.');
        setTimeout(() => setSecurityWarning(''), 3000);
        return false;
      }
    };

    // 3. Tab Switch / Window Blur Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const next = prev + 1;
          setSecurityWarning(`⚠️ ચેતવણી #${next}: કસોટી દરમિયાન ટેબ બદલવી કે અન્ય વિન્ડોમાં જવાની સખત મનાઈ છે!`);
          setTimeout(() => setSecurityWarning(''), 5000);
          return next;
        });
      }
    };

    const handleWindowBlur = () => {
      setTabSwitchCount(prev => {
        const next = prev + 1;
        setSecurityWarning(`⚠️ ચેતવણી #${next}: કસોટી સ્ક્રીન બહાર જવાની મનાઈ છે.`);
        setTimeout(() => setSecurityWarning(''), 4000);
        return next;
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // ─── Save qTimeLeftMap to LocalStorage ───────────────────────
  useEffect(() => {
    if (!isPerQuestionTimer) return;
    try {
      const storageKey = `trinetra_exam_q_timers_${user?.mobile || 'guest'}_${activeTestCode}`;
      localStorage.setItem(storageKey, JSON.stringify(qTimeLeftMap));
    } catch {}
  }, [qTimeLeftMap, activeTestCode, user, isPerQuestionTimer]);

  // ─── Seamless Auto-Save to LocalStorage & Backend ───────────
  useEffect(() => {
    if (!questions.length) return;
    setSaveStatus('saving');

    const storageKey = `trinetra_exam_progress_${user?.mobile || 'guest'}_${activeTestCode}`;
    const progressData = {
      testCode: activeTestCode,
      testName: activeTestName,
      subject: activeSubject,
      currentIndex,
      answers,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(progressData));
      setSaveStatus('saved');
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

    // Throttled / Debounced Backend Sync (Saves to server smoothly every 3.5s without hammering DB)
    const timer = setTimeout(() => {
      if (user) {
        saveTestProgress({
          testCode: activeTestCode,
          testName: activeTestName,
          subject: activeSubject,
          currentIndex,
          savedAnswers: answers,
          answers: Object.entries(answers).map(([qId, ans]) => ({
            questionId: Number(qId),
            type: 'mcq',
            selectedOpt: ans.selectedOpt || null,
            answerText: ans.answerText || '',
            timeSpent: ans.timeSpent || 0
          }))
        }).then(() => setSaveStatus('saved'))
          .catch(err => console.warn('Progress API save error:', err?.message));
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [currentIndex, answers, questions, activeTestCode, activeTestName, activeSubject, user]);

  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [currentIndex]);

  // ─── Auto-advance when Per-Question Timer hits 0 ────────────
  const goNextAuto = useCallback(() => {
    setCurrentIndex(prev => {
      // Find the next available unexpired question
      for (let nextIdx = prev + 1; nextIdx < totalQ; nextIdx++) {
        const timeLeft = qTimeLeftMap[nextIdx];
        if (timeLeft === undefined || timeLeft > 0) {
          return nextIdx;
        }
      }
      // If no further unexpired questions, finish test
      onFinish();
      return prev;
    });
  }, [totalQ, onFinish, setCurrentIndex, qTimeLeftMap]);

  // ─── Timer Countdown Logic ─────────────────────────────────
  // 1. If TOTAL TEST TIMER: countdown runs for entire test continuously across questions
  useEffect(() => {
    if (!isTotalTestTimer) return;

    const interval = setInterval(() => {
      setTotalTestTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTotalTestTimer, onFinish]);

  // 2. If PER-QUESTION TIMER: counts down for current question index
  useEffect(() => {
    if (!isPerQuestionTimer) return;

    const initialTime = qTimeLeftMap[currentIndex] !== undefined ? qTimeLeftMap[currentIndex] : secPerQ;

    // If current question has already expired, skip to next
    if (initialTime <= 0) {
      setPerQTimeLeft(0);
      goNextAuto();
      return;
    }

    setPerQTimeLeft(initialTime);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setPerQTimeLeft(prev => {
        const nextVal = prev - 1;
        setQTimeLeftMap(m => ({ ...m, [currentIndex]: Math.max(0, nextVal) }));

        if (nextVal <= 0) {
          clearInterval(timerRef.current);
          goNextAuto();
          return 0;
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentIndex, isPerQuestionTimer, secPerQ, goNextAuto]);

  // ─── Calculate Previous Accessible Question ─────────────────
  // In per-MCQ timer mode: can only go back to a question if its time is still > 0
  const prevAccessibleIndex = (() => {
    if (!isPerQuestionTimer) {
      return currentIndex > 0 ? currentIndex - 1 : -1;
    }
    for (let p = currentIndex - 1; p >= 0; p--) {
      const pTime = qTimeLeftMap[p];
      if (pTime === undefined || pTime > 0) {
        return p;
      }
    }
    return -1;
  })();

  // ─── Navigation Actions ─────────────────────────────────────
  const goNext = useCallback(() => {
    if (currentIndex >= totalQ - 1) {
      onFinish();
    } else {
      // Find the next available unexpired question
      let targetNext = currentIndex + 1;
      if (isPerQuestionTimer) {
        while (targetNext < totalQ && qTimeLeftMap[targetNext] !== undefined && qTimeLeftMap[targetNext] <= 0) {
          targetNext++;
        }
      }
      if (targetNext >= totalQ) {
        onFinish();
      } else {
        playSlideWhoosh();
        setSlideDirection('next');
        setCurrentIndex(targetNext);
      }
    }
  }, [currentIndex, totalQ, onFinish, setCurrentIndex, isPerQuestionTimer, qTimeLeftMap]);

  const goPrev = useCallback(() => {
    if (prevAccessibleIndex !== -1) {
      playSlideWhoosh();
      setSlideDirection('prev');
      setCurrentIndex(prevAccessibleIndex);
    }
  }, [prevAccessibleIndex, setCurrentIndex]);

  const jumpTo = useCallback((index) => {
    if (isPerQuestionTimer && qTimeLeftMap[index] !== undefined && qTimeLeftMap[index] <= 0) {
      setLockedToast(`🔒 પ્રશ્ન #${index + 1} નો સમય પૂર્ણ થઈ ગયો છે. આ પ્રશ્ન હવે ફરી ખોલી શકાશે નહીં.`);
      setTimeout(() => setLockedToast(''), 3500);
      return;
    }
    playSlideWhoosh();
    setSlideDirection(index > currentIndex ? 'next' : 'prev');
    setCurrentIndex(index);
    setShowPalette(false);
  }, [isPerQuestionTimer, qTimeLeftMap, setCurrentIndex, currentIndex]);

  const selectMCQ = (opt) => {
    const elapsed = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    const previousTime = currentAns.timeSpent || 0;
    recordAnswer(currentQ.id, {
      selectedOpt: opt,
      answerText: '',
      timeSpent: previousTime + elapsed
    });
    questionStartTimeRef.current = Date.now();
  };

  // ─── Timer Display Formatting ──────────────────────────────
  let timerStr = '';
  let isWarning = false;
  let timerLabel = '';
  let timerPct = 100;

  if (isNoTimer) {
    timerStr = '♾️ No Limit';
    timerLabel = 'સમય મર્યાદા નથી';
  } else if (isTotalTestTimer) {
    const totalMins = Math.floor(totalTestTimeLeft / 60);
    const totalSecs = totalTestTimeLeft % 60;
    const totalHours = Math.floor(totalMins / 60);
    const displayMins = totalMins % 60;
    if (totalHours > 0) {
      timerStr = `${String(totalHours).padStart(2,'0')}:${String(displayMins).padStart(2,'0')}:${String(totalSecs).padStart(2,'0')}`;
    } else {
      timerStr = `${String(displayMins).padStart(2,'0')}:${String(totalSecs).padStart(2,'0')}`;
    }
    isWarning = totalTestTimeLeft <= 120;
    timerLabel = 'કુલ સમય બાકી';
    timerPct = totalTestInitialSecs > 0 ? Math.max(0, Math.min(100, (totalTestTimeLeft / totalTestInitialSecs) * 100)) : 100;
  } else {
    // Per Question Timer
    const qMins = Math.floor(perQTimeLeft / 60);
    const qSecs = perQTimeLeft % 60;
    timerStr = `${String(qMins).padStart(2,'0')}:${String(qSecs).padStart(2,'0')}`;
    isWarning = perQTimeLeft <= 10;
    timerLabel = 'પ્રશ્ન સમય';
    timerPct = secPerQ > 0 ? Math.max(0, Math.min(100, (perQTimeLeft / secPerQ) * 100)) : 100;
  }

  const answeredCount = questions.filter(q => {
    const a = answers[q?.id];
    return a && (a.selectedOpt || a.answerText);
  }).length;

  return (
    <div className="exam-layout" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>

      {/* ── Main Question Area ── */}
      <div className="exam-main">

        {/* 🛡️ Anti-Cheat Security Alert Notification */}
        {securityWarning && (
          <div className="animate-fade-in" style={{
            background: 'linear-gradient(135deg,#991b1b,#dc2626)',
            color: 'white',
            padding: '12px 18px',
            borderRadius: 12,
            marginBottom: 12,
            fontWeight: 800,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 6px 20px rgba(220,38,38,0.4)',
            border: '1.5px solid #f87171'
          }}>
            <span style={{ fontSize: '1.3rem' }}>🚨</span>
            <div style={{ flex: 1 }}>{securityWarning}</div>
          </div>
        )}

        {/* Locked Toast Notification Banner */}
        {lockedToast && (
          <div className="animate-fade-in" style={{
            background: 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: 10,
            marginBottom: 12,
            fontWeight: 800,
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(185,28,28,0.35)'
          }}>
            <span>⚠️</span>
            <span>{lockedToast}</span>
          </div>
        )}

        {/* Top bar: Question count + Circular Animated Timer (Sticky Top Header) */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          padding: '10px 14px',
          borderRadius: 14,
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
          gap: 8
        }}>
          {/* Left: Progress info & Auto-save pill */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span>પ્રશ્ન <strong style={{ color: '#2563eb', fontSize: '0.94rem' }}>{currentIndex + 1}</strong> / {totalQ}</span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>•</span>
              <span style={{ color: '#059669', fontSize: '0.78rem' }}>ઉત્તર આપેલ: <strong>{answeredCount}</strong></span>
            </div>

            {/* Badges Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                background: saveStatus === 'saving' ? '#fef3c7' : '#dcfce7',
                color: saveStatus === 'saving' ? '#92400e' : '#166534',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 10,
                border: `1px solid ${saveStatus === 'saving' ? '#fde68a' : '#86efac'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3
              }}>
                {saveStatus === 'saving' ? '⏳ સેવિંગ...' : '🛡️ ઓટો-સેવ'}
              </span>

              {/* Anti-Cheat Shield Badge */}
              <span style={{
                background: tabSwitchCount > 0 ? '#fee2e2' : '#f0fdf4',
                color: tabSwitchCount > 0 ? '#dc2626' : '#15803d',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 10,
                border: `1px solid ${tabSwitchCount > 0 ? '#fca5a5' : '#bbf7d0'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3
              }} title="Anti-Cheat Security Protection Active">
                {tabSwitchCount > 0 ? `⚠️ ${tabSwitchCount} ચેતવણી` : '🔒 સુરક્ષિત'}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', maxWidth: 160, height: 4.5, background: '#e2e8f0', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg,#2563eb,#10b981)',
                width: `${((currentIndex + 1) / totalQ) * 100}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Right: ⏱️ Compact Sleek Circular SVG Timer Ring */}
          {!isNoTimer && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: isWarning ? '#fee2e2' : '#f8fafc',
              border: `1.5px solid ${isWarning ? '#fca5a5' : '#cbd5e1'}`,
              borderRadius: 12,
              padding: '6px 10px',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div style={{ position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="34" height="34" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  <circle
                    cx="22" cy="22" r="18" fill="none"
                    stroke={isWarning ? '#ef4444' : timerPct <= 30 ? '#f59e0b' : '#2563eb'}
                    strokeWidth="4"
                    strokeDasharray={113.1}
                    strokeDashoffset={113.1 - (113.1 * (timerPct / 100))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
                  />
                </svg>
                <span style={{ position: 'absolute', fontSize: '0.7rem', fontWeight: 900, color: isWarning ? '#ef4444' : '#0f172a' }}>
                  ⏱️
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{
                  fontSize: '0.98rem',
                  fontWeight: 900,
                  color: isWarning ? '#dc2626' : '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1
                }}>
                  {timerStr}
                </div>
                <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, marginTop: 2 }}>
                  {timerLabel}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Question Card with 3D PowerPoint Slide Transition */}
        <div
          className={`card ppt-slide-page-box ${slideDirection === 'next' ? 'ppt-slide-next-anim' : 'ppt-slide-prev-anim'}`}
          style={{ padding: '20px 18px', marginBottom: 14 }}
          key={currentIndex}
        >

          {/* Type & Negative Marking Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="badge" style={{
                background: currentQ?.type === 'mcq' ? '#dbeafe' : '#fef3c7',
                color: currentQ?.type === 'mcq' ? '#1e40af' : '#92400e',
                fontSize: '0.78rem',
                fontWeight: 800
              }}>
                {currentQ?.type === 'mcq' ? '🔵 MCQ' : '📝 Descriptive'}
              </span>

              {/* Negative Marking Badge */}
              {Number(currentQ?.negativeMarking) > 0 && (
                <span className="badge" style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  border: '1px solid #fca5a5'
                }}>
                  ➖ નેગેટિવ: -{currentQ.negativeMarking}
                </span>
              )}
            </div>

            {currentQ?.marks && (
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                ગુણ: {currentQ.marks}
              </span>
            )}
          </div>

          {/* Question Text with Math & Science LaTeX Engine */}
          <div
            className="gu-text"
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1.75,
              marginBottom: 16
            }}
            dangerouslySetInnerHTML={{ 
              __html: formatMathText(currentQ?.text || `પ્રશ્ન ${currentIndex + 1}: નીચે આપેલ વિકલ્પોમાંથી સાચો જવાબ પસંદ કરો`) 
            }}
          />

          {/* Question Image if present */}
          {(() => {
            const rawQImg = currentQ?.image || currentQ?.imageUrl;
            const qImg = rawQImg || (isImg(currentQ?.text) ? extractImgSrc(currentQ?.text) : '');
            if (!qImg) return null;
            return (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img
                  src={qImg}
                  alt="Question diagram"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 10, border: '1.5px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                />
              </div>
            );
          })()}

          {/* MCQ Options with Interactive Touch & Vibrant Glow (Supports 4 or 5 Options) */}
          {currentQ?.type === 'mcq' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {['A','B','C','D','E'].map((opt, optIndex) => {
                let rawOpt = currentQ[`option${opt}`] || currentQ[`opt${opt}`] || currentQ[opt.toLowerCase()] || (currentQ.options && (currentQ.options[opt] || currentQ.options[opt.toLowerCase()] || currentQ.options[optIndex]));
                const rawImg = currentQ[`option${opt}_img`] || currentQ[`opt${opt}_img`];
                const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                
                // Option E is ONLY shown if:
                // 1. Teacher explicitly provided Option E text/image
                // 2. OR Test name / subject / testCode is specifically for TAT-S / TAT-HS
                const testMetaStr = `${activeTestName || ''} ${activeSubject || ''} ${activeTestCode || ''} ${currentQ?.subject || ''} ${currentQ?.testName || ''} ${currentQ?.testCode || ''}`.toUpperCase();
                const isTatExam = testMetaStr.includes('TAT-S') || testMetaStr.includes('TAT-HS') || testMetaStr.includes('TAT S') || testMetaStr.includes('TAT HS') || testMetaStr.includes('TATS') || testMetaStr.includes('TATHS');

                if (opt === 'E' && !rawOpt && !optImg && isTatExam) {
                  rawOpt = 'ઉત્તર આપવા માંગતા નથી (Not Attempted / Skip)';
                }

                const optText = isImg(rawOpt) ? '' : rawOpt;
                if (!optText && !optImg) return null;
                const isSelected = currentAns.selectedOpt === opt;
                const isOptionE = opt === 'E';

                return (
                  <button
                    key={opt}
                    className={`mcq-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectMCQ(opt)}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      border: isSelected
                        ? (isOptionE ? '2px solid #64748b' : '2px solid #2563eb')
                        : (isOptionE ? '1.5px dashed #94a3b8' : '1.5px solid #cbd5e1'),
                      background: isSelected
                        ? (isOptionE ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)')
                        : (isOptionE ? '#f8fafc' : '#ffffff'),
                      boxShadow: isSelected
                        ? (isOptionE ? '0 4px 14px rgba(100,116,139,0.18)' : '0 4px 14px rgba(37,99,235,0.18)')
                        : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <span className="option-label" style={{
                      background: isSelected ? (isOptionE ? '#64748b' : '#2563eb') : '#f1f5f9',
                      color: isSelected ? '#ffffff' : (isOptionE ? '#475569' : '#1e293b'),
                      border: isSelected ? (isOptionE ? '1.5px solid #475569' : '1.5px solid #1e40af') : '1.5px solid #cbd5e1',
                      boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.4)' : 'none'
                    }}>
                      {opt}
                    </span>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      {optText && (
                        <div
                          className="gu-text"
                          style={{
                            color: isSelected ? '#0f172a' : (isOptionE ? '#475569' : '#1e293b'),
                            fontWeight: isSelected ? 800 : (isOptionE ? 600 : 500),
                            lineHeight: 1.45,
                            fontSize: '0.94rem'
                          }}
                          dangerouslySetInnerHTML={{ __html: formatMathText(optText) }}
                        />
                      )}
                      {isOptionE && (
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 2, fontWeight: 700 }}>
                          ℹ️ આ વિકલ્પ પસંદ કરવાથી નેગેટિવ માર્કિંગ થશે નહીં (0 ગુણ).
                        </div>
                      )}
                      {optImg && (
                        <div style={{ marginTop: 8 }}>
                          <img 
                            src={optImg} 
                            alt={`Option ${opt}`} 
                            onError={(e) => { e.target.style.display = 'none'; }}
                            style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', objectFit: 'contain' }} 
                          />
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{
                        background: isOptionE ? '#64748b' : '#2563eb',
                        color: '#ffffff',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 900,
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        animation: 'fadeIn 0.2s ease'
                      }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Descriptive hint */}
          {currentQ?.type === 'descriptive' && (
            <div style={{ background: '#f0f9ff', border: '1px dashed #7dd3fc', borderRadius: 10, padding: '14px 16px', color: '#0369a1', fontSize: '0.9rem' }}>
              📖 <strong>નોટબુક/ઉત્તરપત્ર</strong>માં જવાબ લખો. ટેસ્ટ પૂરો થયા બાદ ફોટો અપલોડ કરો.
            </div>
          )}
        </div>

        {/* Navigation Action Buttons: Previous + Next / Finish */}
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          width: '100%',
          marginTop: 8,
          padding: '6px 0',
          position: 'relative',
          zIndex: 10
        }}>
          {prevAccessibleIndex !== -1 ? (
            <button
              onClick={goPrev}
              type="button"
              style={{
                flex: '0 0 auto',
                background: '#ffffff',
                border: '2px solid #cbd5e1',
                color: '#1e293b',
                padding: '13px 20px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              ← પાછલો પ્રશ્ન (Q{prevAccessibleIndex + 1})
            </button>
          ) : (
            isPerQuestionTimer && currentIndex > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                🔒 અગાઉના પ્રશ્નોનો સમય સમાપ્ત
              </span>
            )
          )}

          <button
            className="btn-primary"
            style={{
              flex: 1,
              fontSize: '1.05rem',
              fontWeight: 900,
              padding: '14px 20px',
              borderRadius: 12,
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
              background: currentIndex >= totalQ - 1
                ? 'linear-gradient(135deg,#059669,#10b981)'
                : 'linear-gradient(135deg,#1d4ed8,#2563eb)'
            }}
            onClick={goNext}
          >
            {currentIndex >= totalQ - 1 ? '✅ કસોટી પૂર્ણ કરો (Submit Test)' : 'આગળનો પ્રશ્ન (Next) →'}
          </button>
        </div>
      </div>

      {/* ── Desktop Sidebar Palette ── */}
      <div className="exam-sidebar">
        <DesktopPalette
          total={totalQ}
          currentIndex={currentIndex}
          answers={answers}
          questions={questions}
          isPerQuestionTimer={isPerQuestionTimer}
          qTimeLeftMap={qTimeLeftMap}
          onJump={jumpTo}
        />
      </div>

      {/* ── Mobile Bottom Palette ── */}
      <div className="mobile-palette">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPalette ? 10 : 0 }}>
          <button
            onClick={() => setShowPalette(!showPalette)}
            style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 8, padding: '7px 14px',
              fontWeight: 700, fontSize: '0.82rem', color: '#1e40af', cursor: 'pointer'
            }}
          >
            {showPalette ? '▼ Palette બંધ' : '▲ Palette (' + answeredCount + '/' + totalQ + ')'}
          </button>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            Q {currentIndex + 1} / {totalQ}
          </span>
        </div>

        {/* Palette grid - expandable */}
        {showPalette && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            maxHeight: 150, overflowY: 'auto', paddingTop: 4
          }}>
            {Array.from({ length: totalQ }, (_, i) => {
              const q = questions[i];
              const ans = answers[q?.id];
              const hasAns = ans && (ans.selectedOpt || ans.answerText);
              const isCurrent = i === currentIndex;
              const isLocked = isPerQuestionTimer && qTimeLeftMap[i] !== undefined && qTimeLeftMap[i] <= 0;

              return (
                <button
                  key={i}
                  className={`palette-btn ${isCurrent ? 'current' : isLocked ? 'locked' : hasAns ? 'answered' : 'unanswered'}`}
                  onClick={() => jumpTo(i)}
                  title={isLocked ? `પ્રશ્ન ${i + 1} નો સમય સમાપ્ત (Locked)` : `પ્રશ્ન ${i + 1}`}
                >
                  {isLocked ? '🔒' : i + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopPalette({ total, currentIndex, answers, questions, isPerQuestionTimer, qTimeLeftMap = {}, onJump }) {
  const answeredCount = questions.filter(q => {
    const a = answers[q?.id];
    return a && (a.selectedOpt || a.answerText);
  }).length;

  const lockedCount = isPerQuestionTimer
    ? Array.from({ length: total }, (_, i) => i).filter(i => qTimeLeftMap[i] !== undefined && qTimeLeftMap[i] <= 0).length
    : 0;

  return (
    <div className="card" style={{ padding: 16, position: 'sticky', top: 80 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
        📋 Question Palette
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.72rem', marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} /> Current
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669', display: 'inline-block' }} /> Answered
        </span>
        {isPerQuestionTimer && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} /> 🔒 Locked
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Array.from({ length: total }, (_, i) => {
          const q = questions[i];
          const ans = answers[q?.id];
          const hasAns = ans && (ans.selectedOpt || ans.answerText);
          const isCurrent = i === currentIndex;
          const isLocked = isPerQuestionTimer && qTimeLeftMap[i] !== undefined && qTimeLeftMap[i] <= 0;

          return (
            <button
              key={i}
              className={`palette-btn ${isCurrent ? 'current' : isLocked ? 'locked' : hasAns ? 'answered' : 'unanswered'}`}
              onClick={() => onJump(i)}
              title={isLocked ? `પ્રશ્ન ${i + 1} નો સમય સમાપ્ત (Locked)` : `પ્રશ્ન ${i + 1}`}
            >
              {isLocked ? '🔒' : i + 1}
            </button>
          );
        })}
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginBottom: 3 }}>
          <span>✅ Answered</span><strong style={{ color: '#059669' }}>{answeredCount}</strong>
        </div>
        {isPerQuestionTimer && lockedCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginBottom: 3 }}>
            <span>🔒 Locked (Time Over)</span><strong style={{ color: '#94a3b8' }}>{lockedCount}</strong>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
          <span>⬜ Pending</span><strong style={{ color: '#ef4444' }}>{total - answeredCount}</strong>
        </div>
      </div>
    </div>
  );
}
