
function cleanIndianMobile(rawMobile) {
  let digits = String(rawMobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

// ─── Smart Indian Mobile & Advanced Anti-Fake Combinations Filter ──
function validateIndianMobile(rawMobile) {
  if (!rawMobile) return { isValid: false, message: 'કૃપા કરીને ૧૦ આંકડાનો મોબાઈલ નંબર દાખલ કરો.' };
  const cleaned = cleanIndianMobile(rawMobile);
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ExamEngine from '../components/ExamEngine';
import PhotoAnswerUpload from '../components/PhotoAnswerUpload';
import ResultCard from '../components/ResultCard';
import { useStore } from '../store/useStore';
import { sendOTP, verifyOTP, getQuestions, submitTest, getSubmissionReview, getActiveTestSession, discardActiveTestSession, checkStudentEnrollment } from '../services/api';
import { clearShuffledTestCache, getPersistentShuffledQuestions } from '../utils/shuffleUtils';

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

const STEPS = { LOGIN: 'login', OTP: 'otp', SELECT_TEST: 'select_test', RULES: 'rules', EXAM: 'exam', UPLOAD: 'upload', RESULT: 'result' };

export default function ExamPage() {
  const { user, loginStudent, questions, answers, startExam, resumeExam, finishExam, lastResult, resetExam } = useStore();
  const [step, setStep] = useState(STEPS.LOGIN);
  const [form, setForm] = useState({ name: '', mobile: '' });
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [error, setError] = useState('');
  const [availableLiveTests, setAvailableLiveTests] = useState([]);
  const [userPastSubs, setUserPastSubs] = useState([]);
  const [selectedTestQuestions, setSelectedTestQuestions] = useState([]);
  const [resumableSession, setResumableSession] = useState(null);
  const [agreeRules, setAgreeRules] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(2);
  const [tabSwitchViolations, setTabSwitchViolations] = useState(0);
  const [screenshotViolationsData, setScreenshotViolationsData] = useState({ screenshotCount: 0, screenshotViolations: [] });
  const [enrolledLockModal, setEnrolledLockModal] = useState({ isOpen: false, testName: '' });
  const navigate = useNavigate();

  const checkAndSetResumable = async (testQuestions) => {
    if (!testQuestions || testQuestions.length === 0) return;
    const firstQ = testQuestions[0] || {};
    const testCode = firstQ.testCode || (firstQ.chapter ? `CHAPTER-${firstQ.chapter}` : 'DEFAULT-TEST');

    let found = null;
    try {
      const storageKey = `trinetra_exam_progress_${user?.mobile || 'guest'}_${testCode}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.currentIndex > 0 || Object.keys(parsed.answers || {}).length > 0)) {
          found = parsed;
        }
      }
    } catch (e) {}

    if (!found && user) {
      try {
        const res = await getActiveTestSession({ testCode });
        if (res.data?.hasActive && res.data.session) {
          const s = res.data.session;
          found = {
            testCode: s.testCode,
            testName: s.testName,
            subject: s.subject,
            currentIndex: s.currentIndex || 0,
            answers: s.savedAnswers || {},
            startedAt: s.startedAt
          };
        }
      } catch (e) {}
    }

    setResumableSession(found);
  };

  // ─── Auto Scroll to Top on Step Change (Rules, Exam, etc.) ─
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // ExamPage OTP Cooldown Timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);
  
  useEffect(() => {
    if (user && step === STEPS.LOGIN) {
      if (questions && questions.length > 0) {
        // Came from Student Dashboard with questions already set
        setSelectedTestQuestions(questions);
        checkAndSetResumable(questions);
        setStep(STEPS.RULES);
      } else {
        loadQuestionsAndStart();
      }
    }
  }, []);

  const loadQuestionsAndStart = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getQuestions();
      const rawQs = Array.isArray(res.data) ? res.data : [];
      if (rawQs.length === 0) {
        setError('⚠️ હાલ કોઈ ટેસ્ટ લાઈવ ઉપલબ્ધ નથી. કૃપા કરીને શિક્ષકનો સંપર્ક કરો.');
        setLoading(false);
        return;
      }

      // Group questions by testCode
      const groups = {};
      rawQs.forEach(q => {
        const key = q.testCode || (q.chapter ? `CHAPTER-${q.chapter}` : 'DEFAULT-TEST');
        if (!groups[key]) {
          groups[key] = {
            testCode:  key,
            testName:  q.testName || q.chapter || 'સામાન્ય કસોટી (Live Test)',
            subject:   q.subject  || 'General',
            timeLimit: q.timeLimit || 60,
            scheduledAt:    q.scheduledAt || null,
            scheduledEndAt: q.scheduledEndAt || null,
            questions: [],
            totalMarks: 0,
            mcqCount: 0,
            descCount: 0
          };
        }
        groups[key].questions.push(q);
        groups[key].totalMarks += (q.marks || 1);
        if (q.scheduledEndAt && !groups[key].scheduledEndAt) {
          groups[key].scheduledEndAt = q.scheduledEndAt;
        }
        if (q.type === 'mcq') groups[key].mcqCount++;
        else groups[key].descCount++;
      });

      const distinctTests = Object.values(groups);
      if (distinctTests.length > 1) {
        // Multiple tests are live: let student choose which one to give
        setAvailableLiveTests(distinctTests);
        setStep(STEPS.SELECT_TEST);
      } else {
        // Single test live: show rules first before starting
        setSelectedTestQuestions(rawQs);
        checkAndSetResumable(rawQs);
        setStep(STEPS.RULES);
      }
    } catch (e) {
      setError('Server સાથે connection ભૂલ. Backend ચાલુ છે?');
    }
    setLoading(false);
  };

  // ─── Step 1: Send OTP ─────────────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    const val = validateIndianMobile(form.mobile);
    if (!val.isValid) {
      setError(val.message);
      return;
    }
    const nameVal = validateStudentName(form.name);
    if (!nameVal.isValid) {
      setError(nameVal.message);
      return;
    }
    setLoading(true);
    try {
      const res = await sendOTP(val.cleaned, form.name);
      if (res.data.devOtp) setDevOtp(res.data.devOtp);
      setStep(STEPS.OTP);
      setOtpCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP મોકલવામાં ભૂલ.');
    }
    setLoading(false);
  };

  // ─── Step 2: Verify OTP ───────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyOTP(form.mobile, form.name, otp);
      loginStudent(res.data.student, res.data.token);
      await loadQuestionsAndStart();
    } catch (err) {
      setError(err.response?.data?.error || 'OTP ખોટો');
    }
    setLoading(false);
  };

  const handleSelectTestToRule = async (testQuestions) => {
    // Check enrollment restriction
    if (testQuestions?.some(q => q.isEnrolledOnly)) {
      let isEnrolled = !!user?.isEnrolled;
      const studentMobile = user?.mobile || form?.mobile;

      if (!isEnrolled && studentMobile) {
        try {
          const res = await checkStudentEnrollment(studentMobile);
          if (res.data?.isEnrolled) {
            isEnrolled = true;
          }
        } catch (e) {
          console.error('Enrollment check failed:', e);
        }
      }

      if (!isEnrolled) {
        setEnrolledLockModal({
          isOpen: true,
          testName: testQuestions[0]?.testName || 'કસોટી'
        });
        return;
      }
    }

    setSelectedTestQuestions(testQuestions);
    setAgreeRules(false);
    checkAndSetResumable(testQuestions);
    setStep(STEPS.RULES);
  };

  const handleStartExamAfterRules = async () => {
    // Check enrollment restriction before entering exam
    if (selectedTestQuestions?.some(q => q.isEnrolledOnly)) {
      let isEnrolled = !!user?.isEnrolled;
      const studentMobile = user?.mobile || form?.mobile;

      if (!isEnrolled && studentMobile) {
        try {
          const res = await checkStudentEnrollment(studentMobile);
          if (res.data?.isEnrolled) {
            isEnrolled = true;
          }
        } catch (e) {
          console.error('Enrollment check failed:', e);
        }
      }

      if (!isEnrolled) {
        setEnrolledLockModal({
          isOpen: true,
          testName: selectedTestQuestions[0]?.testName || 'કસોટી'
        });
        return;
      }
    }

    // Reset violations cache for this exam session to guarantee 0 initial false strikes
    try {
      const firstQ = (selectedTestQuestions && selectedTestQuestions[0]) || {};
      const targetTestCode = firstQ.testCode || (firstQ.chapter ? `CHAPTER-${firstQ.chapter}` : 'GENERAL');
      localStorage.removeItem(`trinetra_tab_switch_${user?.mobile || 'guest'}_${targetTestCode}`);
      localStorage.removeItem(`trinetra_ss_count_${user?.mobile || 'guest'}_${targetTestCode}`);
    } catch (e) {}

    setTabSwitchViolations(0);
    setScreenshotViolationsData({ screenshotCount: 0, screenshotViolations: [] });
    startExam(selectedTestQuestions);
    setStep(STEPS.EXAM);
  };

  // ─── Exam Done → Upload Screen or Instant Auto-Submit ────
  const handleExamFinish = (isCheatingAutoSubmit = false, violations = 0, ssData = {}) => {
    setTabSwitchViolations(violations);
    const ssInfo = {
      screenshotCount: ssData?.screenshotCount || 0,
      screenshotViolations: ssData?.screenshotViolations || [],
      questionOrder: ssData?.questionOrder || []
    };
    setScreenshotViolationsData(ssInfo);

    if (isCheatingAutoSubmit) {
      handleFinalSubmit(violations, ssInfo);
    } else {
      setStep(STEPS.UPLOAD);
    }
  };

  // ─── Final Submit with Popup & Dashboard Redirect ─────────
  const handleFinalSubmit = async (forcedViolations, forcedSsData) => {
    const finalViolations = typeof forcedViolations === 'number' ? forcedViolations : tabSwitchViolations;
    const finalSsData = forcedSsData || screenshotViolationsData || {};
    const ssCount = Number(finalSsData.screenshotCount || 0);
    const ssViolationsList = Array.isArray(finalSsData.screenshotViolations) ? finalSsData.screenshotViolations : [];

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('⚠️ તમારું ઇન્ટરનેટ હાલ બંધ છે. કૃપા કરીને મોબાઇલ ડેટા અથવા Wi-Fi ચાલુ કરો.\nચિંતા ન કરશો — તમારા તમામ જવાબો તમારા ફોનમાં ૧૦૦% સુરક્ષિત સેવ છે! ઇન્ટરનેટ ચાલુ થતાં જ સબમિટ થઈ જશે.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const firstQ = (questions && questions.length > 0) ? questions[0] : (selectedTestQuestions && selectedTestQuestions[0]) || {};
      const targetTestCode = firstQ.testCode || (firstQ.chapter ? `CHAPTER-${firstQ.chapter}` : 'GENERAL');
      const targetTestName = firstQ.testName || firstQ.chapter || 'સામાન્ય કસોટી';
      const targetSubject  = firstQ.subject  || 'General';

      // 🔀 Retrieve the exact student question sequence
      let studentQuestions = [];
      const allQPool = (questions && questions.length > 0) ? questions : (selectedTestQuestions || []);
      const qOrderIds = finalSsData?.questionOrder || screenshotViolationsData?.questionOrder;

      if (Array.isArray(qOrderIds) && qOrderIds.length > 0) {
        const idMap = new Map(allQPool.map(q => [Number(q.id), q]));
        studentQuestions = qOrderIds.map(id => idMap.get(Number(id))).filter(Boolean);
      }
      if (studentQuestions.length === 0 && allQPool.length > 0) {
        studentQuestions = getPersistentShuffledQuestions(
          allQPool,
          user?.mobile,
          targetTestCode,
          true
        );
      }

      const baseQList = (studentQuestions && studentQuestions.length > 0)
        ? studentQuestions
        : Object.keys(answers || {}).map(id => ({ id: Number(id) }));

      const answersArr = baseQList.map((q, sIdx) => {
        const qIdNum = Number(q.id);
        const ans = (answers && answers[qIdNum]) || {};
        const hasSsAttempt = ssViolationsList.some(v => Number(v.questionId) === qIdNum);
        return {
          questionId: qIdNum,
          studentOrder: sIdx + 1, // Student's question #1, #2, #3...
          type: ans.type || q.type || 'mcq',
          selectedOpt: ans.selectedOpt || null,
          answerText: ans.answerText || '',
          timeSpent: ans.timeSpent || 0,
          screenshotAttempt: hasSsAttempt
        };
      }).filter(a => !isNaN(a.questionId) && a.questionId > 0);

      const res = await submitTest({
        answers: answersArr,
        photoUrl: photoUrl || null,
        testCode: targetTestCode,
        testName: targetTestName,
        subject:  targetSubject,
        tabSwitchCount: finalViolations,
        screenshotCount: ssCount,
        screenshotViolations: ssViolationsList
      });

      // Clear local storage progress upon successful completion
      try {
        localStorage.removeItem(`trinetra_exam_progress_${user?.mobile || 'guest'}_${targetTestCode}`);
        localStorage.removeItem(`trinetra_exam_q_timers_${user?.mobile || 'guest'}_${targetTestCode}`);
        localStorage.removeItem(`trinetra_tab_switch_${user?.mobile || 'guest'}_${targetTestCode}`);
        localStorage.removeItem(`trinetra_ss_count_${user?.mobile || 'guest'}_${targetTestCode}`);
        clearShuffledTestCache(user?.mobile, targetTestCode);
      } catch (e) {}

      finishExam(res.data.submission);
      setSubmitSuccess(true);
      setRedirectCountdown(2);

      let count = 2;
      const interval = setInterval(() => {
        count--;
        setRedirectCountdown(count);
        if (count <= 0) {
          clearInterval(interval);
          navigate('/student?tab=results');
        }
      }, 1000);
    } catch (err) {
      console.error('Final Submit Error:', err);
      setError(err.response?.data?.error || err.message || 'Submit ભૂલ. ફરી try કરો.');
      setLoading(false);
    }
  };

  const handleRetry = () => { resetExam(); setStep(STEPS.LOGIN); setOtp(''); setDevOtp(''); setError(''); setSubmitSuccess(false); };

  // ─── Download PDF of all questions + answers after submit ────
  const handleDownloadExamPDF = async () => {
    const sub = lastResult;
    if (!sub) return;
    let reviewList = [];
    try {
      const res = await getSubmissionReview(sub.id);
      reviewList = res.data?.review || [];
    } catch (e) {
      alert('PDF લોડ કરવામાં ભૂલ. ફરી try કરો.');
      return;
    }

    const score = (sub.mcqScore || 0) + (sub.teacherMarks || 0);
    const totalMarks = sub.totalMarks || reviewList.length;
    const pct = Math.round((score / totalMarks) * 100);

    const questionsHtml = reviewList.map((item, idx) => {
      const q = item.question || {};
      const studentAns = item.studentAnswer;
      const isCorrect = item.isCorrect;
      const correctOpt = q.correctOpt;

      const rawA = q.optionA || q.optA || (q.options && (q.options.A || q.options[0])) || '';
      const rawB = q.optionB || q.optB || (q.options && (q.options.B || q.options[1])) || '';
      const rawC = q.optionC || q.optC || (q.options && (q.options.C || q.options[2])) || '';
      const rawD = q.optionD || q.optD || (q.options && (q.options.D || q.options[3])) || '';

      const imgA = q.optionA_img || q.optA_img || (isImg(rawA) ? extractImgSrc(rawA) : '');
      const imgB = q.optionB_img || q.optB_img || (isImg(rawB) ? extractImgSrc(rawB) : '');
      const imgC = q.optionC_img || q.optC_img || (isImg(rawC) ? extractImgSrc(rawC) : '');
      const imgD = q.optionD_img || q.optD_img || (isImg(rawD) ? extractImgSrc(rawD) : '');

      const textA = isImg(rawA) ? '' : rawA;
      const textB = isImg(rawB) ? '' : rawB;
      const textC = isImg(rawC) ? '' : rawC;
      const textD = isImg(rawD) ? '' : rawD;

      const qImg = q.image || q.imageUrl || (isImg(q.text) ? extractImgSrc(q.text) : '');
      const qText = isImg(q.text) ? '' : q.text;

      const opts = [
        { key: 'A', text: textA, img: imgA },
        { key: 'B', text: textB, img: imgB },
        { key: 'C', text: textC, img: imgC },
        { key: 'D', text: textD, img: imgD }
      ].filter(o => o.text || o.img);

      return `
        <div style="margin-bottom:20px;padding:14px 16px;border:2px solid ${isCorrect===true?'#86efac':isCorrect===false?'#fca5a5':'#cbd5e1'};border-radius:10px;background:${isCorrect===true?'#f0fdf4':isCorrect===false?'#fef2f2':'#f8fafc'};page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:10px;">
            <div style="font-weight:800;font-size:14.5px;color:#0f172a;flex:1;line-height:1.5;">પ્રશ્ન ${idx+1}: ${qText}</div>
            <span style="font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:14px;background:${isCorrect===true?'#dcfce7':isCorrect===false?'#fee2e2':'#f1f5f9'};color:${isCorrect===true?'#166534':isCorrect===false?'#991b1b':'#475569'};white-space:nowrap;flex-shrink:0;">
              ${isCorrect===true?'✓ સાચો (+1 ગુણ)':isCorrect===false?'✕ ખોટો (0 ગુણ)':'વર્ણાત્મક'}
            </span>
          </div>

          <!-- Question Image if present -->
          ${qImg ? `
            <div style="text-align:center;margin:10px 0 14px 0;">
              <img src="${qImg}" alt="Question Diagram" loading="lazy" style="max-height:160px;max-width:100%;border-radius:8px;border:1px solid #cbd5e1;display:inline-block;" />
            </div>
          ` : ''}

          ${opts.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:12px;">
            ${opts.map(o => {
              const isSel = studentAns === o.key;
              const isTgt = correctOpt === o.key;
              let bg='#ffffff',bdr='1.5px solid #e2e8f0',kc='#334155',badge='';
              if(isTgt){bg='#dcfce7';bdr='2px solid #22c55e';kc='#15803d';badge='&nbsp;<strong style="font-size:11px;color:#166534;background:#bbf7d0;padding:1px 7px;border-radius:10px;">[🎯 સાચો જવાબ]</strong>';}
              if(isSel&&isCorrect!==true){bg='#fee2e2';bdr='2px solid #ef4444';kc='#991b1b';badge='&nbsp;<strong style="font-size:11px;color:#991b1b;background:#fecaca;padding:1px 7px;border-radius:10px;">[✕ તમે પસંદ કરેલ]</strong>';}
              if(isSel&&isCorrect===true){badge='&nbsp;<strong style="font-size:11px;color:#166534;background:#bbf7d0;padding:1px 7px;border-radius:10px;">[✓ તમારો સાચો જવાબ]</strong>';}
              return `
                <div style="display:flex;flex-direction:column;padding:9px 13px;border:${bdr};background:${bg};border-radius:8px;font-size:13.5px;color:#1e293b;gap:6px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:900;font-size:14px;color:${kc};min-width:22px;">${o.key}.</span>
                    <span style="flex:1;">${o.text}</span>
                    ${badge}
                  </div>
                  ${o.img ? `
                    <div style="text-align:center;margin-top:4px;">
                      <img src="${o.img}" alt="Option ${o.key}" loading="lazy" style="max-height:80px;max-width:100%;border-radius:6px;border:1px solid #cbd5e1;display:inline-block;" />
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>` : ''}
          <div style="font-size:12.5px;color:#475569;display:flex;justify-content:space-between;border-top:1.5px dashed #cbd5e1;padding-top:8px;">
            <span>📌 તમે ટીક કરેલો જવાબ:&nbsp;<strong style="color:${isCorrect===true?'#166534':isCorrect===false?'#991b1b':'#64748b'}">${studentAns||'અનુત્તર'}</strong></span>
            ${correctOpt?`<span>✅ સાચો જવાબ:&nbsp;<strong style="color:#166534">${correctOpt}</strong></span>`:''}
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="gu"><head><meta charset="UTF-8"><title>ત્રિનેત્ર એકેડેમી - પ્રશ્ન-જવાબ PDF</title>
    <style>
      body{font-family:'Hind Vadodara',sans-serif,system-ui;padding:24px;color:#0f172a;max-width:820px;margin:0 auto;line-height:1.5;}
      .hdr{text-align:center;border-bottom:2px solid #1e3a8a;padding-bottom:14px;margin-bottom:16px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f8fafc;border:1.5px solid #cbd5e1;padding:12px 16px;border-radius:10px;font-size:13.5px;margin-bottom:16px;}
      .sbox{background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:14px;text-align:center;margin-bottom:18px;}
      @media print{body{padding:0;max-width:100%;}}
    </style></head><body>
      <div class="hdr">
        <h1 style="margin:0;color:#1e3a8a;font-size:22px;">🏛️ ત્રિનેત્ર ઓનલાઈન એકેડેમી</h1>
        <div style="font-size:13px;color:#64748b;margin-top:3px;">સંપૂર્ણ પ્રશ્ન-જવાબ PDF (Detailed Question &amp; Answer Sheet)</div>
      </div>
      <div class="meta">
        <div><strong>વિદ્યાર્થી:</strong> ${sub.student?.name||user?.name||'–'}</div>
        <div><strong>Mobile:</strong> ${sub.student?.mobile||user?.mobile||'–'}</div>
        <div><strong>કસોટી:</strong> ${sub.testName||'–'}</div>
        <div><strong>વિષય:</strong> ${sub.subject||'–'}</div>
        <div><strong>તારીખ:</strong> ${new Date(sub.submittedAt||Date.now()).toLocaleString('gu-IN')}</div>
        <div><strong>ટેસ્ટ ID:</strong> ${sub.testCode||'N/A'}</div>
      </div>
      <div class="sbox">
        <div style="font-size:13px;color:#15803d;font-weight:700;">મેળવેલ ગુણ / કુલ ગુણ</div>
        <div style="font-size:28px;font-weight:900;color:#166534;">${score} / ${totalMarks}</div>
        <div style="font-size:15px;font-weight:800;color:#166534;margin-top:2px;">ટકાવારી: ${pct}% &nbsp;|&nbsp; ${pct>=60?'🟢 પાસ':'🔴 સુધારાની જરૂર'}</div>
      </div>
      <h3 style="color:#1e3a8a;margin:18px 0 12px;font-size:16px;border-bottom:1.5px solid #cbd5e1;padding-bottom:6px;">
        📝 તમામ પ્રશ્નો અને ઉત્તરોની ચકાસણી:
      </h3>
      ${questionsHtml}
      <div style="margin-top:30px;border-top:1px dashed #94a3b8;padding-top:14px;display:flex;justify-content:space-between;font-size:12px;color:#64748b;">
        <div>ત્રિનેત્ર એકેડેમી અધિકૃત પ્રશ્ન-જવાબ PDF • Helpline: 8200405300</div>
        <div>તપાસનાર: __________________</div>
      </div>
      <script>window.onload=function(){window.print();};<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Popup blocked. Please allow popups.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {step !== STEPS.EXAM && <Navbar />}

      {/* LOGIN */}
      {step === STEPS.LOGIN && (
        <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className="card animate-fade-in" style={{ maxWidth: 440, width: '100%', padding: '28px 20px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📝</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>ઓનલાઈન ટેસ્ટ Login</h2>
              <p className="gu-text" style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 6 }}>
                OTP verify કર્યા પછી ટેસ્ટ શરૂ થશે
              </p>
            </div>

            <form onSubmit={handleSendOTP}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', display: 'block', marginBottom: 6 }}>
                  તમારું નામ *
                </label>
                <input className="input-field gu-text" placeholder="પૂરું નામ..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', display: 'block', marginBottom: 6 }}>
                  Mobile નંબર (10 digits) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="દા.ત. 9876543210"
                    value={form.mobile}
                    onChange={e => {
                      const cleaned = cleanIndianMobile(e.target.value);
                      setForm(f => ({ ...f, mobile: cleaned }));
                      if (error) setError('');
                    }}
                    style={{
                      paddingRight: form.mobile.length === 10 ? 40 : 12,
                      border: form.mobile.length === 10
                        ? validateIndianMobile(form.mobile).isValid ? '2px solid #22c55e' : '2px solid #ef4444'
                        : undefined,
                      background: form.mobile.length === 10
                        ? validateIndianMobile(form.mobile).isValid ? '#f0fdf4' : '#fef2f2'
                        : undefined
                    }}
                    required
                  />
                  {form.mobile.length === 10 && validateIndianMobile(form.mobile).isValid && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#16a34a', fontWeight: 900, fontSize: '1.1rem' }}>
                      ✓
                    </span>
                  )}
                </div>
                {form.mobile.length > 0 && form.mobile.length === 10 && !validateIndianMobile(form.mobile).isValid && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: 4, fontWeight: 700 }}>
                    ⚠️ {validateIndianMobile(form.mobile).message}
                  </div>
                )}
              </div>
              {error && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: '#ef4444', fontSize: '0.88rem', margin: '0 0 10px 0', fontWeight: 600 }}>{error}</p>
                  {(error.includes('મર્યાદા') || error.includes('Master PIN') || error.includes('શિક્ષક')) && (
                    <button
                      type="button"
                      onClick={() => setStep(STEPS.OTP)}
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        border: 'none',
                        color: 'white',
                        padding: '10px 14px',
                        borderRadius: 10,
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        width: '100%',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                        fontFamily: 'Hind Vadodara, sans-serif'
                      }}>
                      🔑 શિક્ષકના Master PIN વડે સીધું લૉગિન કરો →
                    </button>
                  )}
                </div>
              )}
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? '⏳ Sending OTP...' : '📱 OTP Send કરો'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OTP VERIFY */}
      {step === STEPS.OTP && (
        <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className="card animate-fade-in" style={{ maxWidth: 420, width: '100%', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📱</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>OTP Verify કરો</h2>
            <p className="gu-text" style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 24 }}>
              {form.mobile} પર OTP send થઈ ગઈ છે
            </p>
            {devOtp && (
              <div style={{ 
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 
                border: '2px dashed #f59e0b', 
                borderRadius: 12, 
                padding: '12px 14px', 
                marginBottom: 18, 
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
              }}>
                <div style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 800, marginBottom: 4 }}>
                  ⚡ લૉગિન OTP (સુરક્ષિત પ્રવેશ):
                </div>
                <div style={{ letterSpacing: '4px', fontSize: '1.4rem', color: '#b45309', fontWeight: 900, fontFamily: 'monospace' }}>
                  {devOtp}
                </div>
              </div>
            )}
            <form onSubmit={handleVerifyOTP}>
              <input
                className="input-field"
                type="text" inputMode="numeric" maxLength={6}
                placeholder="6-digit OTP"
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3em', marginBottom: 16 }}
                required
              />
              {error && <p style={{ color: '#ef4444', fontSize: '0.88rem', marginBottom: 12 }}>{error}</p>}
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? '⏳ Verifying...' : '✅ Verify & ટેસ્ટ શરૂ'}
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: '0.86rem' }}>
                <button type="button" onClick={() => setStep(STEPS.LOGIN)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700 }}>
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
          </div>
        </div>
      )}

      {/* SELECT TEST (When multiple tests are active) */}
      {step === STEPS.SELECT_TEST && (
        <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
          <div className="card animate-fade-in" style={{ padding: '28px 24px', marginBottom: 20, textAlign: 'center', background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)', color: 'white' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎯</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 6px 0' }}>
              ઉપલબ્ધ લાઈવ કસોટીઓ (Active Tests)
            </h2>
            <p style={{ color: '#bfdbfe', fontSize: '0.9rem', margin: 0 }}>
              નમસ્તે {user?.name || 'વિદ્યાર્થી'}, નીચેમાંથી તમે જે કસોટી આપવા માંગો છો તે પસંદ કરો:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {availableLiveTests.map((t) => {
              const alreadyDone = userPastSubs.some(s => s.testCode === t.testCode);

              return (
                <div key={t.testCode} className="card animate-fade-in" style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: alreadyDone ? '1.5px solid #cbd5e1' : '1.5px solid #e2e8f0', background: alreadyDone ? '#f8fafc' : 'white', borderRadius: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                        📚 {t.subject}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {t.questions?.some(q => q.isEnrolledOnly) && (
                          <span style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 6
                          }}>
                            🔒 એડમિશન સ્પેશિયલ
                          </span>
                        )}
                        <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, padding: '3px 8px', borderRadius: 6 }}>
                          ID: {t.testCode}
                        </span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>
                      {t.testName}
                    </h3>

                    <div style={{ display: 'flex', gap: 12, marginBottom: t.scheduledEndAt ? 8 : 16, color: '#475569', fontSize: '0.85rem' }}>
                      <div>📝 <strong>{t.questions.length}</strong> પ્રશ્નો ({t.mcqCount}M + {t.descCount}D)</div>
                      <div>🎯 <strong>{t.totalMarks}</strong> ગુણ</div>
                      {Number(t.timeLimit || 0) > 0 && (
                        <div>
                          {t.timeLimit <= 300
                            ? <span>⏱️ <strong>{t.timeLimit}s</strong> / પ્રશ્ન</span>
                            : <span>⏱️ <strong>{Math.round(t.timeLimit / 60)}</strong>m કુલ</span>}
                        </div>
                      )}
                    </div>

                    {t.scheduledEndAt && (
                      <div style={{ marginBottom: 14 }}>
                        <span style={{
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          🛑 સમાપ્તિ: {new Date(t.scheduledEndAt).toLocaleString('gu-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {alreadyDone ? (
                    <button
                      style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '0.92rem', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
                      onClick={() => navigate('/student')}>
                      ✓ કસોટી પૂર્ણ થયેલ છે • પરિણામ જુઓ →
                    </button>
                  ) : (t.scheduledEndAt && Date.now() >= new Date(t.scheduledEndAt).getTime()) ? (
                    <button
                      disabled
                      style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '0.92rem', background: '#e2e8f0', color: '#94a3b8', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'not-allowed' }}>
                      ⚠️ આ કસોટીનો સમય પૂર્ણ થયો છે
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '0.95rem' }}
                      onClick={() => handleSelectTestToRule(t.questions)}>
                      ▶️ આ કસોટી પસંદ કરો →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RULES / INSTRUCTIONS PAGE (Before starting the exam) */}
      {step === STEPS.RULES && selectedTestQuestions.length > 0 && (() => {
        const firstQ = selectedTestQuestions[0] || {};
        const testName = firstQ.testName || firstQ.chapter || 'સામાન્ય મોક ટેસ્ટ';
        const subject = firstQ.subject || 'General';
        const rawTime = Number(firstQ.timeLimit || 0);
        const isNoLimit = rawTime === 0;
        const isTotalTime = !isNoLimit && rawTime > 300;
        const timerFormatted = isNoLimit
          ? '♾️ સમય મર્યાદા નથી'
          : isTotalTime
            ? `⏱️ ${Math.round(rawTime / 60)} મિનિટ (આખી કસોટીનો કુલ સમય)`
            : `⏱️ ${rawTime} સેકન્ડ (પ્રશ્ન દીઠ સમય)`;

        const totalMarks = selectedTestQuestions.reduce((a, q) => a + (q.marks || 1), 0);
        const mcqCount = selectedTestQuestions.filter(q => q.type === 'mcq').length;
        const descCount = selectedTestQuestions.filter(q => q.type === 'descriptive').length;

        return (
          <div style={{ maxWidth: 760, margin: '30px auto', padding: '0 16px 50px' }}>
            <div className="card animate-fade-in" style={{ padding: '24px', background: 'white', border: '1.5px solid #bfdbfe', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
              
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', marginBottom: 10, boxShadow: '0 6px 16px rgba(37,99,235,0.3)' }}>
                  📜
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
                  કસોટીના નિયમો અને અગત્યની સૂચનાઓ (Exam Rules & Guidelines)
                </h2>
                <div style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.92rem' }}>
                  {testName} • {subject}
                </div>
              </div>

              {/* Test Info Cards Grid (3D Luxury Tiles) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isNoLimit ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 24
              }}>
                {/* Tile 1: કુલ પ્રશ્નો */}
                <div style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  padding: '16px 14px',
                  borderRadius: 14,
                  border: '1.5px solid #93c5fd',
                  boxShadow: '0 6px 18px rgba(37, 99, 235, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.35rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}>
                    📋
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: '#1e40af', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      કુલ પ્રશ્નો
                    </div>
                    <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.45rem', lineHeight: 1.1, marginTop: 2 }}>
                      {selectedTestQuestions.length}
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginTop: 3,
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#1d4ed8',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 6
                    }}>
                      {mcqCount} MCQ {descCount > 0 ? `+ ${descCount} વર્ણનાત્મક` : ''}
                    </div>
                  </div>
                </div>

                {/* Tile 2: કુલ ગુણ */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  padding: '16px 14px',
                  borderRadius: 14,
                  border: '1.5px solid #86efac',
                  boxShadow: '0 6px 18px rgba(34, 197, 94, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.35rem',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}>
                    🎯
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      કુલ ગુણ
                    </div>
                    <div style={{ color: '#0f172a', fontWeight: 900, fontSize: '1.45rem', lineHeight: 1.1, marginTop: 2 }}>
                      {totalMarks}
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginTop: 3,
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#15803d',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 6
                    }}>
                      💯 મહત્તમ માર્ક્સ
                    </div>
                  </div>
                </div>

                {/* Tile 3: સમય મર્યાદા */}
                {!isNoLimit && (
                  <div style={{
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    padding: '16px 14px',
                    borderRadius: 14,
                    border: '1.5px solid #fde68a',
                    boxShadow: '0 6px 18px rgba(245, 158, 11, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.35rem',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                    }}>
                      ⏱️
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#92400e', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        સમય મર્યાદા
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: 900, fontSize: isTotalTime ? '1.35rem' : '1.25rem', lineHeight: 1.1, marginTop: 2 }}>
                        {isTotalTime ? `${Math.round(rawTime / 60)} મિનિટ` : `${rawTime} સેકન્ડ`}
                      </div>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        marginTop: 3,
                        background: 'rgba(217, 119, 6, 0.14)',
                        color: '#b45309',
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 6
                      }}>
                        {isTotalTime ? '⏱️ આખી કસોટીનો સમય' : '⚡ પ્રશ્ન દીઠ સમય'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ⚡ RESUME PREVIOUS UNFINISHED TEST BANNER ⚡ */}
              {resumableSession && (
                <div className="card animate-fade-in" style={{
                  background: 'linear-gradient(135deg, rgba(30,58,138,0.06), rgba(16,185,129,0.12))',
                  border: '2px solid #22c55e',
                  borderRadius: 14,
                  padding: '18px 20px',
                  marginBottom: 22,
                  boxShadow: '0 6px 20px rgba(34,197,94,0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                      ⚡
                    </div>
                    <div>
                      <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.08rem', fontWeight: 900 }}>
                        તમારી અગાઉની અધૂરી કસોટી મળી આવી છે! (Resume Test)
                      </h3>
                      <div style={{ fontSize: '0.84rem', color: '#334155', marginTop: 3 }}>
                        તમે પ્રશ્ન નં. <strong>#{resumableSession.currentIndex + 1}</strong> પર હતા અને <strong>{Object.keys(resumableSession.answers || {}).length}</strong> પ્રશ્નોના જવાબો સુરક્ષિત રીતે સેવ થયેલા છે.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        resumeExam(selectedTestQuestions, resumableSession.currentIndex, resumableSession.answers);
                        setStep(STEPS.EXAM);
                      }}
                      className="btn-primary"
                      style={{
                        background: 'linear-gradient(135deg,#059669,#10b981)',
                        padding: '11px 22px',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                        cursor: 'pointer'
                      }}
                    >
                      ▶️ જ્યાંથી અટક્યા ત્યાંથી આગળ ચાલુ રાખો (Resume Test)
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('નવી કસોટી શરૂ કરવાથી અગાઉના અધૂરા જવાબો રદ્દ થશે. શું તમે સહમત છો?')) {
                          try {
                            const storageKey = `trinetra_exam_progress_${user?.mobile || 'guest'}_${resumableSession.testCode}`;
                            localStorage.removeItem(storageKey);
                            clearShuffledTestCache(user?.mobile, resumableSession.testCode);
                            if (user) await discardActiveTestSession({ testCode: resumableSession.testCode });
                          } catch (e) {
                            console.warn(e);
                          }
                          setResumableSession(null);
                        }
                      }}
                      style={{
                        background: '#fee2e2',
                        border: '1.5px solid #fca5a5',
                        color: '#991b1b',
                        padding: '11px 16px',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.86rem',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 નવેસરથી શરૂ કરો (Start Fresh)
                    </button>
                  </div>
                </div>
              )}

              {/* Detailed Rules List - Dynamically generated based on test settings */}
              {(() => {
                const testMetaStr = `${testName} ${subject} ${firstQ.testCode || ''}`.toUpperCase();
                const isTat = testMetaStr.includes('TAT-S') || testMetaStr.includes('TAT-HS') || testMetaStr.includes('TAT S') || testMetaStr.includes('TAT HS');
                const hasOptionE = isTat || selectedTestQuestions.some(q => q.optionE || q.optionE_img);
                const hasNeg = selectedTestQuestions.some(q => Number(q.negativeMarking) > 0);
                const maxNeg = Math.max(0, ...selectedTestQuestions.map(q => Number(q.negativeMarking) || 0));

                let ruleNum = 1;

                return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', marginBottom: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                      <h4 style={{ margin: 0, color: '#0f172a', fontSize: '0.98rem', fontWeight: 800 }}>
                        📌 આ કસોટી માટેના ચોક્કસ નિયમો & માર્ગદર્શિકા:
                      </h4>
                      {hasOptionE ? (
                        <span style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #c084fc', padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 900 }}>
                          🎯 TAT ૫-ઓપ્શન પદ્ધતિ
                        </span>
                      ) : (
                        <span style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 800 }}>
                          📘 સામાન્ય ૪-ઓપ્શન પદ્ધતિ
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.88rem', color: '#334155', lineHeight: 1.6 }}>
                      
                      {/* Rule 1: Timer */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#2563eb', fontWeight: 900 }}>{ruleNum++}.</span>
                        <span>
                          <strong>સમય મર્યાદા (Timer):</strong>{' '}
                          {isNoLimit
                            ? 'આ કસોટીમાં કોઈ સમય મર્યાદા નથી (તમે શાંતિથી તમામ પ્રશ્નો વિચારીને આપી શકો છો).'
                            : isTotalTime
                              ? `આખી કસોટી માટે કુલ ${Math.round(rawTime / 60)} મિનિટનો સમય નિર્ધારિત છે. સમય પૂરો થતાં ટેસ્ટ આપમેળે સબમિટ થશે.`
                              : `દરેક પ્રશ્ન માટે ${rawTime} સેકન્ડનો લાઈવ ટાઈમર રહેશે. પ્રશ્નનો સમય પૂરો થતાં આપમેળે આગળનો પ્રશ્ન આવશે.`}
                        </span>
                      </div>

                      {/* Rule 2: MCQ Options (4 vs 5) */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#2563eb', fontWeight: 900 }}>{ruleNum++}.</span>
                        <span>
                          <strong>પ્રશ્નોના વિકલ્પો (Options):</strong>{' '}
                          {hasOptionE ? (
                            <span>આ કસોટીમાં <strong>૫ ઓપ્શન્સ (A, B, C, D અને E)</strong> છે. સાચા ઉત્તર માટે A, B, C, D માંથી પસંદ કરવો. જો પ્રશ્ન છોડવો હોય તો <strong>Option E: 'ઉત્તર આપવા માંગતા નથી (Skip)'</strong> સિલેક્ટ કરવો.</span>
                          ) : (
                            <span>દરેક પ્રશ્નમાં <strong>૪ વિકલ્પો (A, B, C, D)</strong> હશે. તમે તમારી સમજ મુજબ સાચો વિકલ્પ પસંદ કરી શકો છો.</span>
                          )}
                        </span>
                      </div>

                      {/* Rule 3: Negative Marking */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: hasNeg ? '#dc2626' : '#16a34a', fontWeight: 900 }}>{ruleNum++}.</span>
                        <span>
                          <strong>નેગેટિવ માર્કિંગ (Negative Marking):</strong>{' '}
                          {hasNeg ? (
                            hasOptionE ? (
                              <span style={{ color: '#991b1b', fontWeight: 600 }}>
                                ⚠️ આ કસોટીમાં દરેક <strong>ખોટા જવાબ પર -{maxNeg} ગુણ કપાશે</strong>. જો તમે <strong>Option (E) સિલેક્ટ કરશો તો 0 ગુણ (કોઈ નેગેટિવ માર્ક નહીં કપાય)</strong>. પરંતુ જો એકપણ વિકલ્પ ટીક કર્યા વગર ખાલી છોડશો તો -{maxNeg} માર્ક્સ કપાશે.
                              </span>
                            ) : (
                              <span style={{ color: '#991b1b', fontWeight: 600 }}>
                                ⚠️ આ કસોટીમાં દરેક <strong>ખોટા જવાબ પર -{maxNeg} ગુણ કપાશે</strong>.
                              </span>
                            )
                          ) : (
                            <span style={{ color: '#15803d', fontWeight: 600 }}>
                              ✅ આ કસોટીમાં <strong>કોઈ નેગેટિવ માર્કિંગ નથી</strong> (ખોટા જવાબ પર કોઈ ગુણ કપાશે નહીં).
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Rule 4: Descriptive if present */}
                      {descCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: '#2563eb', fontWeight: 900 }}>{ruleNum++}.</span>
                          <span><strong>વર્ણાત્મક પ્રશ્નો (Descriptive):</strong> વર્ણાત્મક પ્રશ્નોના જવાબો તમારી ઉત્તરવહી/કાગળમાં સુંદર અક્ષરે લખી રાખો. કસોટીના અંતે તેનો સ્પષ્ટ ફોટો પાડીને અપલોડ કરવાનો રહેશે.</span>
                        </div>
                      )}

                      {/* Rule 5: Anti-cheat / Security */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#dc2626', fontWeight: 900 }}>{ruleNum++}.</span>
                        <span style={{ color: '#991b1b' }}><strong>સુરક્ષા નિયમ:</strong> કસોટી ચાલુ હોય ત્યારે બ્રાઉઝર ટેબ બદલવી નહીં કે પેજ બંધ ન કરવું.</span>
                      </div>

                      {/* Rule 6: Anti-Cheating Question & Option Shuffling */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: '#7c3aed', fontWeight: 900 }}>{ruleNum++}.</span>
                        <span style={{ color: '#5b21b6' }}>
                          <strong>🔀 ચોરી-મુક્ત સુરક્ષા (Anti-Cheating Shuffling):</strong> દરેક વિદ્યાર્થીના ફોનમાં <strong>પ્રશ્નો અને વિકલ્પો (A, B, C, D) આપોઆપ અલગ-અલગ ક્રમમાં</strong> આવે છે. તેથી બીજા વિદ્યાર્થીના ફોનમાંથી જોઈને ઉત્તર ટીક કરવો નહીં, કારણ કે તમારા અને તેમના વિકલ્પો તદ્દન અલગ હશે.
                        </span>
                      </div>

                    </div>
                  </div>
                );
              })()}

              {/* Student Agreement Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', background: agreeRules ? '#eff6ff' : '#f8fafc', border: `1.5px solid ${agreeRules ? '#2563eb' : '#cbd5e1'}`, borderRadius: 10, marginBottom: 20, transition: 'all 0.2s' }}>
                <input
                  type="checkbox"
                  checked={agreeRules}
                  onChange={e => setAgreeRules(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: agreeRules ? '#1e40af' : '#475569' }}>
                  મેં ઉપરોક્ત તમામ નિયમો અને સૂચનાઓ ધ્યાનપૂર્વક વાંચી લીધા છે અને હું કસોટી શરૂ કરવા સંમત છું.
                </span>
              </label>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {availableLiveTests.length > 1 && (
                  <button onClick={() => setStep(STEPS.SELECT_TEST)}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '12px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                    ← બીજી કસોટી પસંદ કરો
                  </button>
                )}

                <button
                  onClick={handleStartExamAfterRules}
                  disabled={!agreeRules}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '14px 20px', fontSize: '1.05rem', background: agreeRules ? 'linear-gradient(135deg,#059669,#10b981)' : '#cbd5e1', cursor: agreeRules ? 'pointer' : 'not-allowed', boxShadow: agreeRules ? '0 4px 16px rgba(16,185,129,0.3)' : 'none' }}>
                  🚀 હવે કસોટી શરૂ કરો (Start Exam Now) →
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* EXAM */}
      {step === STEPS.EXAM && <ExamEngine onFinish={handleExamFinish} />}

      {/* UPLOAD */}
      {step === STEPS.UPLOAD && (
        <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
          <div className="card animate-fade-in" style={{ padding: '28px', textAlign: 'center', marginBottom: 20, background: '#f0fdf4', border: '1px solid #86efac' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎉</div>
            <h2 className="gu-text" style={{ fontWeight: 800, color: '#065f46', fontSize: '1.3rem' }}>
              ટેસ્ટ પૂરો! શ્રેષ્ઠ પ્રયાસ!
            </h2>
            <p className="gu-text" style={{ color: '#059669', marginTop: 6 }}>
              {questions.filter(q => q.type === 'descriptive').length > 0
                ? 'Descriptive questions ના જવાબ ની ફોટો upload કરો.'
                : 'MCQ answers save થઈ ગઈ. Submit કરો!'}
            </p>
          </div>

          {questions.some(q => q.type === 'descriptive') && (
            <div style={{ marginBottom: 20 }}>
              <PhotoAnswerUpload onPhotoReady={setPhotoUrl} />
            </div>
          )}

          {error && <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{error}</p>}

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '1.05rem', padding: '14px' }} onClick={handleFinalSubmit} disabled={loading}>
            {loading ? '⏳ Submitting...' : '🏁 Final Submit →'}
          </button>
        </div>
      )}

      {/* RESULT */}
      {step === STEPS.RESULT && lastResult && (
        <ResultCard result={lastResult} questions={questions} answers={answers} onRetry={handleRetry} />
      )}

      {/* ── SUBMIT SUCCESS CELEBRATION POPUP & REDIRECT MODAL ── */}
      {submitSuccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card animate-fade-in" style={{ maxWidth: 440, width: '100%', background: 'white', borderRadius: 20, padding: '32px 24px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: '2px solid #86efac' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065f46', margin: '0 0 8px' }}>
              કસોટી સફળતાપૂર્વક સબમિટ થઈ ગઈ! 🎉
            </h2>
            <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 20px' }}>
              તમારા તમામ જવાબો સેવ થઈ ગયા છે. તમને <strong>રિઝલ્ટ ડેશબોર્ડ</strong> પર લઈ જવામાં આવી રહ્યા છે...
            </p>
            
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px', marginBottom: 20, fontSize: '0.85rem', color: '#166534', fontWeight: 700 }}>
              ⏱️ રીડાયરેક્ટ થઈ રહ્યું છે... ({redirectCountdown}s)
            </div>

            {/* PDF Download Button */}
            <button onClick={handleDownloadExamPDF}
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '1rem', background: 'linear-gradient(135deg,#15803d,#16a34a)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}>
              📄 પ્રશ્ન-જવાબ PDF ડાઉનલોડ કરો
            </button>

            <button onClick={() => navigate('/student?tab=results')}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '1rem', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)' }}>
              📜 સીધા રિઝલ્ટ ડેશબોર્ડ પર જાઓ →
            </button>
          </div>
        </div>
      )}

      {/* ── 🔒 TRINETRA ENROLLED ADMISSION RESTRICTION MODAL ── */}
      {enrolledLockModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 10000020, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card animate-fade-in" style={{
            maxWidth: 460,
            width: '100%',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
            borderRadius: 24,
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(79,70,229,0.4), 0 0 40px rgba(129,140,248,0.25)',
            border: '2px solid #818cf8',
            color: 'white'
          }}>
            <div style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.4rem',
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(79,70,229,0.5)'
            }}>
              🔒
            </div>

            <span style={{
              background: 'rgba(239,68,68,0.2)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.4)',
              fontSize: '0.76rem',
              fontWeight: 900,
              padding: '4px 14px',
              borderRadius: 20,
              display: 'inline-block',
              marginBottom: 12
            }}>
              એડમિશન મર્યાદિત કસોટી (Restricted Access)
            </span>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '0 0 10px' }}>
              ત્રિનેત્ર એકેડેમી પ્રવેશ જરૂરી છે!
            </h3>

            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', fontWeight: 700 }}>કસોટીનું નામ:</div>
              <div style={{ color: '#a5b4fc', fontSize: '0.98rem', fontWeight: 900, marginTop: 2 }}>{enrolledLockModal.testName}</div>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 24px' }}>
              આ કસોટી ફક્ત <strong>ત્રિનેત્ર ઓનલાઇન એકેડેમી</strong> ના નિયમિત એડમિશન લીધેલા (Enrolled) વિદ્યાર્થીઓ માટે જ માન્ય છે.<br />
              જો તમે એડમિશન લીધું હોય છતાં આ મેસેજ દેખાય છે, તો શિક્ષક દ્વારા તમારો મોબાઈલ નંબર એડમિશન લિસ્ટમાં ઉમેરાવવો પડશે.
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setEnrolledLockModal({ isOpen: false, testName: '' })}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#cbd5e1',
                  padding: '13px',
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}>
                બંધ કરો
              </button>

              <a
                href={`https://wa.me/918200405300?text=${encodeURIComponent(`નમસ્તે સર, હું ત્રિનેત્ર એપ્લિકેશન પર "${enrolledLockModal.testName}" કસોટી આપવા માંગુ છું. મારો મોબાઈલ નંબર: ${user?.mobile || form?.mobile || ''} છે. મને એડમિશન બેચમાં એડ કરવા વિનંતી.`)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1.5,
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '13px',
                  borderRadius: 12,
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(16,185,129,0.4)'
                }}>
                💬 WhatsApp પર સંપર્ક કરો
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
