import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { saveTestProgress } from '../services/api';
import { formatMathText, formatQuestionText } from '../utils/mathFormatter';
import {
  getPersistentShuffledQuestions,
  getPersistentShuffledOptions
} from '../utils/shuffleUtils';

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
  const { user, questions: rawQuestions, currentIndex, setCurrentIndex, answers, recordAnswer } = useStore();

  const activeTestCode = rawQuestions[0]?.testCode || 'GENERAL';
  const activeTestName = rawQuestions[0]?.testName || rawQuestions[0]?.chapter || 'કસોટી';
  const activeSubject  = rawQuestions[0]?.subject  || 'General';

  // 🔀 Anti-Cheating Question Shuffling (Randomized & Persistent per student attempt)
  const questions = useMemo(() => {
    return getPersistentShuffledQuestions(rawQuestions, user?.mobile, activeTestCode, true);
  }, [rawQuestions, user?.mobile, activeTestCode]);

  const currentQ = questions[currentIndex] || rawQuestions[currentIndex] || {};
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
  const [securityModal, setSecurityModal] = useState(null); // { strike, title, message, color, autoSubmit, type, questionNumber }
  const [tabSwitchCount, setTabSwitchCount] = useState(() => {
    try {
      const saved = localStorage.getItem(`trinetra_tab_switch_${user?.mobile || 'guest'}_${activeTestCode}`);
      return saved ? Number(saved) : 0;
    } catch (_) { return 0; }
  });
  const [screenshotCount, setScreenshotCount] = useState(() => {
    try {
      const saved = localStorage.getItem(`trinetra_ss_count_${user?.mobile || 'guest'}_${activeTestCode}`);
      return saved ? Number(saved) : 0;
    } catch (_) { return 0; }
  });
  const [isBlackoutShield, setIsBlackoutShield] = useState(false);
  const [isSplitScreenBlocked, setIsSplitScreenBlocked] = useState(false);
  const screenshotViolationsRef = useRef([]);
  const lastScreenshotAttemptTime = useRef(0);
  const [slideDirection, setSlideDirection] = useState('next'); // 'next' | 'prev'
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);
  const timerRef = useRef(null);

  // Helper to package onFinish payload including the student's exact question order
  const getFinishPayload = useCallback((extra = {}) => ({
    screenshotCount,
    screenshotViolations: screenshotViolationsRef.current,
    questionOrder: questions.map(q => q.id),
    ...extra
  }), [screenshotCount, questions]);

  // ─── ⏱️ 6-Minute Inactivity Detector State ───────────────────
  const INACTIVITY_TIMEOUT_MS = 6 * 60 * 1000; // 6 mins
  const INACTIVITY_WARNING_MS = 5.5 * 60 * 1000; // 5 mins 30 secs
  const lastActivityTimeRef = useRef(Date.now());
  const [inactivityWarningSeconds, setInactivityWarningSeconds] = useState(null);

  const resetInactivityTimer = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    setInactivityWarningSeconds(null);
  }, []);

  // ─── 🔊 Procedural Anti-Cheat Warning Audio Synthesizer ───
  const playAlertBeep = (freq = 750, count = 2) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.16);
        gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.16);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + i * 0.16 + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.16);
        osc.stop(ctx.currentTime + i * 0.16 + 0.13);
      }
    } catch (_) {}
  };

  // ─── 🔊 Web Audio Procedural Slide Whoosh Sound ───────────
  // 📄 3D Origami Exam Paper Flip Audio Synthesizer (Realistic Page Turn)
  const playPaperFlip = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Multi-layer page rustle simulation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch (e) {}
  };

  // 🔘 Realistic OMR Bubble Darkening / Pencil Scratch Sound Effect
  const playOmrPencilFill = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Tactile Pencil Ink shading frequency tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(820, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(460, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
  };

  const playSlideWhoosh = playPaperFlip;

  // ─── Auto Scroll to Top on Question Change ───────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  // ─── 📸 Anti-Screenshot & Proctoring Violation Handler ──────────
  const recordScreenshotViolation = useCallback(() => {
    // 🛡️ Immediately activate pitch-black privacy shield so any screen grab is 100% black
    setIsBlackoutShield(true);
    setTimeout(() => setIsBlackoutShield(false), 1600);

    const now = Date.now();
    // 2-second debounce to prevent multiple triggers from keydown + keyup + blur
    if (now - lastScreenshotAttemptTime.current < 2000) return;
    lastScreenshotAttemptTime.current = now;

    // Blank out clipboard immediately so any captured text or clip is wiped
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('🚫 સ્ક્રીનશોટ પાડવાની સખત મનાઈ છે! / Screenshots are not allowed.').catch(() => {});
      }
    } catch (_) {}

    const qNum = currentIndex + 1;
    const qId = currentQ?.id;
    screenshotViolationsRef.current.push({
      questionIndex: currentIndex,
      questionNumber: qNum,
      questionId: qId,
      timestamp: now
    });

    setScreenshotCount(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem(`trinetra_ss_count_${user?.mobile || 'guest'}_${activeTestCode}`, String(next));
      } catch (_) {}

      if (next === 1) {
        playAlertBeep(800, 2);
        setSecurityWarning(`📸 ચેતવણી (૧/૩): પ્રશ્ન નં. ${qNum} પર સ્ક્રીનશોટ પાડવાની મનાઈ છે!`);
        setSecurityModal({
          strike: 1,
          type: 'screenshot',
          questionNumber: qNum,
          title: '📸 સ્ક્રીનશોટ પાડવાની સખત મનાઈ છે! (Strike 1 / 3)',
          message: `પ્રશ્ન નં. ${qNum} પર સ્ક્રીનશોટ પાડવાનો પ્રયાસ નોંધાયો છે! આ વિગત શિક્ષકના ડેશબોર્ડમાં દેખાશે. કસોટી શિસ્ત જાળવી રાખો અને ફરી સ્ક્રીનશોટ ન પાડો.`,
          color: '#d97706',
          autoSubmit: false
        });
      } else if (next === 2) {
        playAlertBeep(950, 3);
        setSecurityWarning(`🚨 આખરી ચેતવણી (૨/૩): પ્રશ્ન નં. ${qNum} પર ફરી સ્ક્રીનશોટનો પ્રયાસ!`);
        setSecurityModal({
          strike: 2,
          type: 'screenshot',
          questionNumber: qNum,
          title: '🚨 આખરી ચેતવણી: સ્ક્રીનશોટ પ્રતિબંધિત છે! (Strike 2 / 3)',
          message: `પ્રશ્ન નં. ${qNum} પર ફરીથી સ્ક્રીનશોટ પાડવાનો પ્રયાસ થયો! જો તમે હવે એક પણ વાર સ્ક્રીનશોટ પાડવાનો પ્રયાસ કરશો, તો તમારી કસોટી તરત જ આપોઆપ સબમિટ થઈ જશે!`,
          color: '#dc2626',
          autoSubmit: false
        });
      } else {
        playAlertBeep(1200, 4);
        setSecurityWarning('🛑 નિયમભંગ: ૩ વાર સ્ક્રીનશોટ પાડવા બદલ પરીક્ષા આપમેળે સબમિટ થઈ રહી છે...');
        setSecurityModal({
          strike: 3,
          type: 'screenshot',
          questionNumber: qNum,
          title: '🛑 પરીક્ષા આપોઆપ સબમિટ થઈ રહી છે...',
          message: `નિયમભંગ: તમે કસોટી દરમિયાન ૩ વાર સ્ક્રીનશોટ પાડવાનો પ્રયાસ કર્યો છે (તાજેતરમાં પ્રશ્ન નં. ${qNum}). પરીક્ષા નીતિ મુજબ તમારી કસોટી આપમેળે સબમિટ કરવામાં આવી રહી છે.`,
          color: '#991b1b',
          autoSubmit: true
        });
        setTimeout(() => {
          onFinish(true, tabSwitchCount, getFinishPayload({ screenshotCount: 3 }));
        }, 2500);
      }
      return next;
    });
  }, [currentIndex, currentQ?.id, user?.mobile, activeTestCode, onFinish, tabSwitchCount]);

  // ─── 🛡️ Anti-Cheat, Copy & Screenshot Protection Engine ───────
  useEffect(() => {
    // 1. Block Context Menu (Right Click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      setSecurityWarning('🔒 કસોટી સુરક્ષા: રાઈટ-ક્લિક (Right Click) પ્રતિબંધિત છે.');
      setTimeout(() => setSecurityWarning(''), 3000);
      return false;
    };

    // 2. Block Keyboard Shortcuts (PrintScreen, Snipping Tool, Print, Copy, DevTools)
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // 📸 Screenshot & Screen Snip Detection (PrintScreen, Ctrl+P, Win+Shift+S, Cmd+Shift+3/4/5)
      if (
        e.key === 'PrintScreen' ||
        e.keyCode === 44 ||
        (isCtrlOrCmd && e.shiftKey && ['s', 'S'].includes(e.key)) ||
        (isCtrlOrCmd && ['p', 'P'].includes(e.key)) ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
      ) {
        setIsBlackoutShield(true);
        setTimeout(() => setIsBlackoutShield(false), 1600);
        e.preventDefault();
        e.stopPropagation();
        recordScreenshotViolation();
        return false;
      }

      // 📱 Hardware Volume Button Press (often used in phone screenshot Power + VolDown)
      if (e.key === 'VolumeDown' || e.key === 'VolumeUp') {
        setIsBlackoutShield(true);
        setTimeout(() => setIsBlackoutShield(false), 1400);
      }

      // F12 or Ctrl+Shift+I / J / C (DevTools)
      if (e.key === 'F12' || (isCtrlOrCmd && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))) {
        e.preventDefault();
        setSecurityWarning('🔒 કસોટી સુરક્ષા: DevTools / Inspect એક્સેસ પ્રતિબંધિત છે.');
        setTimeout(() => setSecurityWarning(''), 3000);
        return false;
      }

      // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+U, Ctrl+S
      if (isCtrlOrCmd && ['c', 'C', 'v', 'V', 'x', 'X', 'a', 'A', 'u', 'U', 's', 'S'].includes(e.key)) {
        e.preventDefault();
        setSecurityWarning('🔒 કસોટી સુરક્ષા: કોપી / પેસ્ટ / સેવ પ્રતિબંધિત છે.');
        setTimeout(() => setSecurityWarning(''), 3000);
        return false;
      }
    };

    // 📸 KeyUp listener for PrintScreen (as some browsers only fire on keyup)
    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        setIsBlackoutShield(true);
        setTimeout(() => setIsBlackoutShield(false), 1600);
        e.preventDefault();
        e.stopPropagation();
        recordScreenshotViolation();
      }
    };

    // 🔒 Block Clipboard Copy event
    const handleCopy = (e) => {
      e.preventDefault();
      recordScreenshotViolation();
    };

    // 📱 Mobile 3-Finger Screenshot Gesture Interception (Xiaomi/Oppo/Vivo/Realme/OnePlus/Samsung)
    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length >= 3) {
        setIsBlackoutShield(true);
        setTimeout(() => setIsBlackoutShield(false), 2000);
        try { e.preventDefault(); } catch (_) {}
        recordScreenshotViolation();
      }
    };

    // 🎥 Intercept & Disable Screen Recording / Capture API
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        navigator.mediaDevices.getDisplayMedia = async function() {
          setIsBlackoutShield(true);
          setTimeout(() => setIsBlackoutShield(false), 1600);
          recordScreenshotViolation();
          throw new Error('Screen capture is strictly disabled during Trinetra Academy exams.');
        };
      } catch (_) {}
    }

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('copy', handleCopy);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('copy', handleCopy);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [recordScreenshotViolation]);

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
          answers: questions.map((q, sIdx) => {
            const ans = answers[q.id] || {};
            return {
              questionId: Number(q.id),
              studentOrder: sIdx + 1,
              type: q.type || 'mcq',
              selectedOpt: ans.selectedOpt || null,
              answerText: ans.answerText || '',
              timeSpent: ans.timeSpent || 0
            };
          })
        }).then(() => setSaveStatus('saved'))
          .catch(err => console.warn('Progress API save error:', err?.message));
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [currentIndex, answers, questions, activeTestCode, activeTestName, activeSubject, user]);

  // ─── Immediate Initial Sync on Mount ─────────────────────────
  // Registers student's exact shuffled question sequence with backend immediately (0 delay)
  const hasSyncedInitialRef = useRef(false);
  useEffect(() => {
    if (!hasSyncedInitialRef.current && user && activeTestCode && questions.length > 0) {
      hasSyncedInitialRef.current = true;
      saveTestProgress({
        testCode: activeTestCode,
        testName: activeTestName,
        subject: activeSubject,
        currentIndex: currentIndex || 0,
        savedAnswers: answers || {},
        answers: questions.map((q, sIdx) => {
          const ans = (answers && answers[q.id]) || {};
          return {
            questionId: Number(q.id),
            studentOrder: sIdx + 1,
            type: q.type || 'mcq',
            selectedOpt: ans.selectedOpt || null,
            answerText: ans.answerText || '',
            timeSpent: ans.timeSpent || 0
          };
        })
      }).catch(() => {});
    }
  }, [user, activeTestCode, questions]);

  useEffect(() => {
    questionStartTimeRef.current = Date.now();
  }, [currentIndex]);

  // ─── Offline-Safe Auto-Restore on Mount ─────────────────────
  // If in-memory answers are empty (e.g. after refresh or mobile data cut),
  // immediately restore all saved answers from localStorage!
  useEffect(() => {
    if (!activeTestCode || Object.keys(answers || {}).length > 0) return;
    try {
      const storageKey = `trinetra_exam_progress_${user?.mobile || 'guest'}_${activeTestCode}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.answers && Object.keys(parsed.answers).length > 0) {
          Object.entries(parsed.answers).forEach(([qId, ansData]) => {
            recordAnswer(Number(qId), ansData);
          });
          if (parsed.currentIndex !== undefined && parsed.currentIndex > 0) {
            setCurrentIndex(parsed.currentIndex);
          }
        }
      }
    } catch (e) {}
  }, [activeTestCode, user, answers, recordAnswer, setCurrentIndex]);

  // ─── Live Network Online/Offline Monitor & Auto-Sync ─────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedToast(true);
      setTimeout(() => setShowReconnectedToast(false), 4500);
      // Immediately sync latest answers to backend
      const storageKey = `trinetra_exam_progress_${user?.mobile || 'guest'}_${activeTestCode}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved && user) {
          const parsed = JSON.parse(saved);
          if (parsed?.answers) {
            saveTestProgress({
              testCode: activeTestCode,
              testName: activeTestName,
              subject: activeSubject,
              currentIndex,
              savedAnswers: parsed.answers,
              answers: questions.map((q, sIdx) => {
                const ans = (parsed.answers && parsed.answers[q.id]) || {};
                return {
                  questionId: Number(q.id),
                  studentOrder: sIdx + 1,
                  type: q.type || 'mcq',
                  selectedOpt: ans.selectedOpt || null,
                  answerText: ans.answerText || '',
                  timeSpent: ans.timeSpent || 0
                };
              })
            }).then(() => setSaveStatus('saved')).catch(() => {});
          }
        }
      } catch (e) {}
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus('offline_saved');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, activeTestCode, activeTestName, activeSubject, currentIndex]);

  // ─── 🛡️ Anti-Cheating: Real Tab Switch Detection (3-Strike Rule, NO FALSE MOBILE BLURS) ───
  useEffect(() => {
    let lastViolationTime = 0;

    const recordViolation = () => {
      const now = Date.now();
      // Debounce: prevent multiple triggers from rapid visibility changes within 2.5 seconds
      if (now - lastViolationTime < 2500) return;
      lastViolationTime = now;

      setTabSwitchCount(prev => {
        const next = prev + 1;
        try {
          localStorage.setItem(`trinetra_tab_switch_${user?.mobile || 'guest'}_${activeTestCode}`, String(next));
        } catch (_) {}

        if (next === 1) {
          playAlertBeep(650, 2);
          setSecurityWarning('⚠️ પ્રથમ ચેતવણી (૧/૩): તમે પરીક્ષા સ્ક્રીન છોડી હતી!');
          setSecurityModal({
            strike: 1,
            type: 'tab_switch',
            title: '⚠️ પ્રથમ ચેતવણી (Strike 1 / 3)',
            message: 'તમે પરીક્ષા સ્ક્રીન છોડી દીધી હતી! કૃપા કરીને પરીક્ષા દરમિયાન અન્ય કોઈ ટેબ, એપ્લિકેશન કે ગૂગલ ન ખોલો.',
            color: '#d97706',
            autoSubmit: false
          });
        } else if (next === 2) {
          playAlertBeep(900, 3);
          setSecurityWarning('🚨 આખરી ચેતવણી (૨/૩): હવે ફરીથી સ્ક્રીન બદલશો તો ટેસ્ટ આપોઆપ સબમિટ થશે!');
          setSecurityModal({
            strike: 2,
            type: 'tab_switch',
            title: '🚨 આખરી ચેતવણી (Strike 2 / 3)',
            message: 'આ તમારી છેલ્લી ચેતવણી છે! જો તમે ફરીથી એક પણ વાર સ્ક્રીન બદલશો કે અન્ય એપ ખોલશો, તો તમારી કસોટી આપોઆપ સબમિટ થઈ જશે!',
            color: '#dc2626',
            autoSubmit: false
          });
        } else {
          playAlertBeep(1100, 4);
          setSecurityWarning('🛑 નિયમભંગ: ૩ વાર સ્ક્રીન છોડવા બદલ પરીક્ષા આપમેળે સબમિટ થઈ રહી છે...');
          setSecurityModal({
            strike: 3,
            type: 'tab_switch',
            title: '🛑 પરીક્ષા આપોઆપ સબમિટ થઈ રહી છે...',
            message: 'નિયમભંગ: તમે ૩ વાર પરીક્ષા સ્ક્રીન છોડી છે. પરીક્ષા શિસ્ત અને સુરક્ષા નીતિ અનુસાર તમારી કસોટી આપમેળે સબમિટ કરવામાં આવી છે.',
            color: '#991b1b',
            autoSubmit: true
          });
          setTimeout(() => {
            onFinish(true, 3, getFinishPayload());
          }, 2500);
        }
        return next;
      });
    };

    const handleVisibilityChange = () => {
      // ONLY trigger when document is hidden (user switched tabs, minimized, or opened another app)
      // Never trigger on mobile scrolling, touches, virtual keyboard, or window blur!
      if (document.hidden || document.visibilityState === 'hidden') {
        setIsBlackoutShield(true);
        recordViolation();
      } else {
        setTimeout(() => setIsBlackoutShield(false), 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTestCode, user, onFinish, screenshotCount, getFinishPayload]);

  // ─── 📱 Split-Screen & Floating App Detection Engine ───────────
  useEffect(() => {
    let lastSplitAlert = 0;

    const checkSplitScreen = () => {
      if (typeof window === 'undefined') return;

      const screenH = window.screen.height || window.screen.availHeight || 800;
      const screenW = window.screen.width || window.screen.availWidth || 360;
      const innerH = window.innerHeight;
      const innerW = window.innerWidth;

      // Don't flag if virtual keyboard is open while student is typing
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || Boolean(document.activeElement?.isContentEditable);
      if (isTyping) return;

      const isMobileDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (screenW <= 768 && screenH <= 1024);

      if (isMobileDevice) {
        const isPortrait = screenH >= screenW;
        // In portrait mode, split screen cuts height to < 58% of screen.height or width < 70%
        const isSplitPortrait = isPortrait && (innerH / screenH < 0.58 || innerW / screenW < 0.70);
        // In landscape mode, split screen cuts width to < 60% of screen.width
        const isSplitLandscape = !isPortrait && (innerW / screenW < 0.60);

        if (isSplitPortrait || isSplitLandscape) {
          setIsSplitScreenBlocked(true);
          const now = Date.now();
          if (now - lastSplitAlert > 3000) {
            lastSplitAlert = now;
            playAlertBeep(850, 2);
          }
        } else {
          setIsSplitScreenBlocked(false);
        }
      }
    };

    window.addEventListener('resize', checkSplitScreen);
    window.addEventListener('orientationchange', checkSplitScreen);
    const splitInterval = setInterval(checkSplitScreen, 1200);

    return () => {
      window.removeEventListener('resize', checkSplitScreen);
      window.removeEventListener('orientationchange', checkSplitScreen);
      clearInterval(splitInterval);
    };
  }, []);

  // ─── ⏱️ 6-Minute Inactivity Monitoring Engine ────────────────
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityTimeRef.current = Date.now();
      if (inactivityWarningSeconds !== null && inactivityWarningSeconds > 0) {
        setInactivityWarningSeconds(null);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const inactivityInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityTimeRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(inactivityInterval);
        setInactivityWarningSeconds(0);
        playAlertBeep(1100, 3);
        setTimeout(() => {
          onFinish(true, tabSwitchCount, getFinishPayload({
            autoSubmitReason: 'INACTIVITY_6MIN',
            isAutoSubmit: true
          }));
        }, 1200);
      } else if (elapsed >= INACTIVITY_WARNING_MS) {
        const remainingSecs = Math.max(1, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setInactivityWarningSeconds(remainingSecs);
      } else {
        setInactivityWarningSeconds(null);
      }
    }, 1000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(inactivityInterval);
    };
  }, [onFinish, tabSwitchCount, getFinishPayload, inactivityWarningSeconds]);

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
      onFinish(false, tabSwitchCount, getFinishPayload());
      return prev;
    });
  }, [totalQ, onFinish, setCurrentIndex, qTimeLeftMap, tabSwitchCount, getFinishPayload]);

  // ─── Timer Countdown Logic ─────────────────────────────────
  // 1. If TOTAL TEST TIMER: countdown runs for entire test continuously across questions
  useEffect(() => {
    if (!isTotalTestTimer) return;

    const interval = setInterval(() => {
      setTotalTestTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onFinish(false, tabSwitchCount, getFinishPayload());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTotalTestTimer, onFinish, tabSwitchCount, getFinishPayload]);

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

  // ─── Precise Time Tracking per Question (Anti-Cheating Proctoring) ───
  const flushCurrentQuestionTime = useCallback(() => {
    if (!currentQ?.id) return;
    const elapsed = Math.max(0, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    questionStartTimeRef.current = Date.now();
    if (elapsed > 0) {
      const existing = answers[currentQ.id] || {};
      recordAnswer(currentQ.id, {
        selectedOpt: existing.selectedOpt || null,
        answerText: existing.answerText || '',
        timeSpent: (existing.timeSpent || 0) + elapsed
      });
    }
  }, [currentQ?.id, answers, recordAnswer]);

  const goNext = useCallback(() => {
    flushCurrentQuestionTime();
    if (currentIndex >= totalQ - 1) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        alert('⚠️ તમારું ઇન્ટરનેટ હાલ બંધ છે. કૃપા કરીને મોબાઇલ ડેટા અથવા Wi-Fi ચાલુ કરો.\n\nચિંતા ન કરશો — તમારા તમામ જવાબો તમારા ફોનમાં ૧૦૦% સુરક્ષિત સેવ છે! ઇન્ટરનેટ ચાલુ થતાં જ પેપર સબમિટ થઈ જશે.');
        return;
      }
      onFinish(false, tabSwitchCount, getFinishPayload());
    } else {
      // Find the next available unexpired question
      let targetNext = currentIndex + 1;
      if (isPerQuestionTimer) {
        while (targetNext < totalQ && qTimeLeftMap[targetNext] !== undefined && qTimeLeftMap[targetNext] <= 0) {
          targetNext++;
        }
      }
      if (targetNext >= totalQ) {
        onFinish(false, tabSwitchCount, getFinishPayload());
      } else {
        playSlideWhoosh();
        setSlideDirection('next');
        setCurrentIndex(targetNext);
      }
    }
  }, [currentIndex, totalQ, onFinish, setCurrentIndex, isPerQuestionTimer, qTimeLeftMap, tabSwitchCount, getFinishPayload, flushCurrentQuestionTime]);

  const goPrev = useCallback(() => {
    flushCurrentQuestionTime();
    if (prevAccessibleIndex !== -1) {
      playSlideWhoosh();
      setSlideDirection('prev');
      setCurrentIndex(prevAccessibleIndex);
    }
  }, [prevAccessibleIndex, setCurrentIndex, flushCurrentQuestionTime]);

  const jumpTo = useCallback((index) => {
    if (isPerQuestionTimer && qTimeLeftMap[index] !== undefined && qTimeLeftMap[index] <= 0) {
      setLockedToast(`🔒 પ્રશ્ન #${index + 1} નો સમય પૂર્ણ થઈ ગયો છે. આ પ્રશ્ન હવે ફરી ખોલી શકાશે નહીં.`);
      setTimeout(() => setLockedToast(''), 3500);
      return;
    }
    flushCurrentQuestionTime();
    playSlideWhoosh();
    setSlideDirection(index > currentIndex ? 'next' : 'prev');
    setCurrentIndex(index);
    setShowPalette(false);
  }, [isPerQuestionTimer, qTimeLeftMap, setCurrentIndex, currentIndex, flushCurrentQuestionTime]);

  const selectMCQ = (opt) => {
    playOmrPencilFill();
    const elapsed = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    questionStartTimeRef.current = Date.now();
    const previousTime = currentAns.timeSpent || 0;
    recordAnswer(currentQ.id, {
      selectedOpt: opt,
      answerText: '',
      timeSpent: previousTime + elapsed
    });
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
    <div className="exam-layout" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', WebkitTouchCallout: 'none', position: 'relative' }}>
      <style>{`
        @media print {
          html, body, #root, .exam-layout, * {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* 🛡️ Pitch-Black Instant Privacy Shield (Guarantees zero question capture on any screenshot/screen snip) */}
      {isBlackoutShield && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: '#000000',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          userSelect: 'none'
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            marginBottom: 16
          }}>
            🛡️
          </div>
          <h2 style={{ fontSize: '1.4rem', color: '#f87171', fontWeight: 900, margin: '0 0 10px 0' }}>
            સ્ક્રીનશોટ બ્લોક કરેલ છે! (Screenshot Blocked)
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', maxWidth: 420, lineHeight: 1.6, margin: 0 }}>
            સુરક્ષા કારણોસર પરીક્ષા દરમિયાન સ્ક્રીનશોટ પાડવાની સખત મનાઈ છે.
          </p>
        </div>
      )}

      {/* 📱 Mobile Split-Screen & Floating App Block Overlay */}
      {isSplitScreenBlocked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999998,
          background: '#090d16',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          userSelect: 'none'
        }}>
          <div style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.6rem',
            marginBottom: 18,
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.35)'
          }}>
            📱
          </div>
          <h2 style={{ fontSize: '1.35rem', color: '#f87171', fontWeight: 900, margin: '0 0 10px 0' }}>
            ⚠️ સ્પ્લિટ-સ્ક્રીન ડિટેક્ટ થઈ છે! (Split-Screen Blocked)
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '0.94rem', maxWidth: 440, lineHeight: 1.6, margin: '0 0 16px 0' }}>
            પરીક્ષા દરમિયાન <strong>સ્પ્લિટ-સ્ક્રીન (Split Screen)</strong> અથવા <strong>ફ્લોટિંગ વિન્ડો</strong> વાપરવી સખત પ્રતિબંધિત છે.
          </p>
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: '12px 18px',
            color: '#fca5a5',
            fontSize: '0.88rem',
            fontWeight: 700,
            maxWidth: 400
          }}>
            👉 કૃપા કરીને પરીક્ષા આપવા માટે તમારા મોબાઇલમાં આ એપ્લિકેશન <strong>સંપૂર્ણ સ્ક્રીન (Full Screen)</strong> મોડમાં ખોલો.
          </div>
        </div>
      )}

      {/* 🛡️ Trinetra Academy Official Watermark Logo in Background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: 0.08,
          userSelect: 'none'
        }}
      >
        <img
          src="/trinetra-logo.png"
          alt="Trinetra Logo Watermark"
          style={{
            maxWidth: 'min(75vw, 360px)',
            maxHeight: 'min(75vh, 360px)',
            objectFit: 'contain'
          }}
          onError={(e) => { e.target.src = '/images/logo.jpg'; }}
        />
      </div>

      {/* ── Main Question Area ── */}
      <div className="exam-main">

        {/* 📡 Live Offline Protection Banner */}
        {!isOnline && (
          <div className="animate-fade-in" style={{
            background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
            color: '#ffffff',
            padding: '10px 16px',
            borderRadius: 12,
            marginBottom: 12,
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 14px rgba(217,119,6,0.3)',
            border: '1.5px solid #fde68a'
          }}>
            <span style={{ fontSize: '1.25rem' }}>📡</span>
            <div style={{ flex: 1 }}>
              તમારું ઇન્ટરનેટ હાલ બંધ છે. <strong>ચિંતા ન કરશો — તમારા બધા જવાબો તમારા ફોનમાં ૧૦૦% સુરક્ષિત સેવ છે!</strong> નેટ આવતાં જ આપોઆપ સિંક થશે.
            </div>
          </div>
        )}

        {/* 🟢 Reconnected Success Banner */}
        {showReconnectedToast && (
          <div className="animate-fade-in" style={{
            background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
            color: '#ffffff',
            padding: '10px 16px',
            borderRadius: 12,
            marginBottom: 12,
            fontWeight: 700,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
            border: '1.5px solid #86efac'
          }}>
            <span style={{ fontSize: '1.25rem' }}>✅</span>
            <div style={{ flex: 1 }}>
              ઇન્ટરનેટ ફરીથી કનેક્ટ થઈ ગયું છે! બધા જવાબો સર્વર સાથે સિંક થઈ ગયા છે.
            </div>
          </div>
        )}

        {/* 🛡️ Anti-Cheat Security Alert Notification Banner */}
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

        {/* 🛡️ Anti-Cheating High-Alert Pop-up Modal */}
        {securityModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}>
            <div className="card animate-fade-in" style={{
              maxWidth: 480,
              width: '100%',
              background: '#ffffff',
              borderRadius: 20,
              padding: '28px 24px',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.35)',
              border: `2.5px solid ${securityModal.color}`
            }}>
              <div style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: `${securityModal.color}15`,
                color: securityModal.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.2rem',
                margin: '0 auto 16px auto',
                boxShadow: `0 0 24px ${securityModal.color}30`
              }}>
                {securityModal.strike === 3 ? '🛑' : (securityModal.type === 'screenshot' ? '📸' : '⚠️')}
              </div>

              <h3 style={{
                margin: '0 0 10px 0',
                color: securityModal.color,
                fontSize: '1.28rem',
                fontWeight: 900
              }}>
                {securityModal.title}
              </h3>

              <p style={{
                color: '#334155',
                fontSize: '0.94rem',
                lineHeight: 1.6,
                margin: '0 0 20px 0',
                fontWeight: 600
              }}>
                {securityModal.message}
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 22,
                fontSize: '0.84rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around'
              }}>
                <span>નિયમભંગ: <strong style={{ color: securityModal.color }}>{securityModal.strike} / 3</strong></span>
                <span>•</span>
                <span>કુલ મંજૂર: <strong>2 પ્રયાસ</strong></span>
              </div>

              {securityModal.autoSubmit ? (
                <div style={{
                  padding: '14px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: '0.94rem'
                }}>
                  ⏳ થોડી સેકન્ડમાં ટેસ્ટ સબમિટ થઈ રહી છે...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSecurityModal(null)}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    fontSize: '1.02rem',
                    fontWeight: 900,
                    borderRadius: 12,
                    background: securityModal.strike === 2
                      ? 'linear-gradient(135deg, #b91c1c, #dc2626)'
                      : 'linear-gradient(135deg, #d97706, #f59e0b)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                  }}
                >
                  ✓ હું સમજી ગયો / ગઈ — કસોટી ચાલુ રાખો →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ⏰ 6-MINUTE INACTIVITY WARNING MODAL ⏰ */}
        {inactivityWarningSeconds !== null && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="card animate-fade-in" style={{
              maxWidth: 480,
              width: '100%',
              padding: '30px 24px',
              borderRadius: 20,
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.45)',
              border: '2.5px solid #f59e0b',
              background: '#ffffff'
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.4rem',
                margin: '0 auto 16px auto',
                boxShadow: '0 0 24px rgba(245, 158, 11, 0.35)'
              }}>
                ⏰
              </div>

              <h3 style={{
                margin: '0 0 10px 0',
                color: '#b45309',
                fontSize: '1.35rem',
                fontWeight: 900
              }}>
                {inactivityWarningSeconds <= 0
                  ? '🛑 કસોટી આપોઆપ સબમિટ થઈ રહી છે...'
                  : '⚠️ તમે ૫:૩૦ મિનિટથી નિષ્ક્રિય છો!'}
              </h3>

              <p style={{
                color: '#334155',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                margin: '0 0 20px 0',
                fontWeight: 600
              }}>
                {inactivityWarningSeconds <= 0
                  ? '૬ મિનિટ સુધી કોઈ જવાબ કે પ્રતિક્રિયા ન મળતાં તમારી કસોટી આપમેળે સબમિટ કરવામાં આવી રહી છે.'
                  : 'પરીક્ષા નીતિ મુજબ, જો ૬ મિનિટ સુધી કોઈ જવાબ કે ક્લિક નહીં થાય તો તમારી કસોટી આપોઆપ સબમિટ થઈ જશે!'}
              </p>

              {inactivityWarningSeconds > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  border: '2px dashed #f59e0b',
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 22,
                  fontSize: '1.25rem',
                  color: '#b45309',
                  fontWeight: 900
                }}>
                  ⏱️ ઓટો-સબમિટ બાકી: <span style={{ color: '#dc2626', fontSize: '1.45rem' }}>{inactivityWarningSeconds}</span> સેકન્ડ
                </div>
              )}

              {inactivityWarningSeconds > 0 ? (
                <button
                  type="button"
                  onClick={resetInactivityTimer}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '14px',
                    fontSize: '1.05rem',
                    fontWeight: 900,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(22, 163, 74, 0.4)'
                  }}
                >
                  ✅ હું હાજર છું — પરીક્ષા ચાલુ રાખો!
                </button>
              ) : (
                <div style={{
                  padding: '14px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: '0.94rem'
                }}>
                  ⏳ ઓટો-સબમિશન ચાલુ છે...
                </div>
              )}
            </div>
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
                background: !isOnline ? '#fef3c7' : saveStatus === 'saving' ? '#eff6ff' : '#dcfce7',
                color: !isOnline ? '#b45309' : saveStatus === 'saving' ? '#1d4ed8' : '#166534',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 10,
                border: `1px solid ${!isOnline ? '#fde68a' : saveStatus === 'saving' ? '#bfdbfe' : '#86efac'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3
              }}>
                {!isOnline ? '💾 ઑફલાઇન સેવ' : saveStatus === 'saving' ? '⏳ સિંક થાય છે...' : '🛡️ ઓટો-સેવ'}
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

              {/* Shuffled Order Anti-Cheat Badge */}
              <span style={{
                background: '#f5f3ff',
                color: '#7c3aed',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 10,
                border: '1px solid #ddd6fe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3
              }} title="પ્રશ્નો અને વિકલ્પો દરેક વિદ્યાર્થી માટે અલગ ક્રમમાં રેન્ડમાઇઝ થયેલા છે">
                🔀 શફલ ઓર્ડર
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

        {/* Question Card with 3D Origami Exam Paper Flip Transition */}
        <div
          className={`card ppt-slide-page-box ${slideDirection === 'next' ? 'paper-flip-next-anim' : 'paper-flip-prev-anim'}`}
          style={{ padding: '20px 18px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}
          key={currentIndex}
        >
          {/* 🛡️ Trinetra Academy Official Watermark Logo in Question Background */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 0,
              opacity: 0.06,
              userSelect: 'none',
              width: 'min(280px, 75%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src="/trinetra-logo.png"
              alt="Trinetra Watermark"
              style={{
                width: '100%',
                maxHeight: 260,
                objectFit: 'contain'
              }}
              onError={(e) => { e.target.src = '/images/logo.jpg'; }}
            />
          </div>

          {/* Type & Negative Marking Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
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
              __html: formatQuestionText(currentQ?.text || `પ્રશ્ન ${currentIndex + 1}: નીચે આપેલ વિકલ્પોમાંથી સાચો જવાબ પસંદ કરો`) 
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

          {/* MCQ Options with Anti-Cheating Shuffling and Realistic OMR Bubble Darkening FX */}
          {currentQ?.type === 'mcq' && (() => {
            const shuffledOptions = getPersistentShuffledOptions(
              currentQ,
              user?.mobile,
              activeTestCode,
              activeTestName,
              activeSubject,
              true
            );

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {shuffledOptions.map((optItem) => {
                  const { displayKey, origKey, rawOpt, rawImg, isOptionE } = optItem;
                  const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                  const optText = isImg(rawOpt) ? '' : rawOpt;
                  if (!optText && !optImg) return null;
                  const isSelected = currentAns.selectedOpt === origKey;

                  return (
                    <button
                      key={origKey}
                      className={`mcq-option ${isSelected ? (isOptionE ? 'selected' : 'omr-option-row-active') : ''}`}
                      onClick={() => selectMCQ(origKey)}
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
                      {/* OMR Round Ink Bubble */}
                      <span
                        className={`option-label ${isSelected ? 'omr-bubble-selected' : ''}`}
                        style={{
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.92rem',
                          fontWeight: 900,
                          flexShrink: 0,
                          background: isSelected ? undefined : '#f1f5f9',
                          color: isSelected ? undefined : (isOptionE ? '#475569' : '#1e293b'),
                          border: isSelected ? undefined : '1.5px solid #cbd5e1'
                        }}
                      >
                        {displayKey}
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
                              alt={`Option ${displayKey}`} 
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
                          boxShadow: '0 2px 6px rgba(37,99,235,0.4)'
                        }}>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

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
