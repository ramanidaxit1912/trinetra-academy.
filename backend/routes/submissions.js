const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { authMiddleware, teacherOnly } = require('../middleware/authMiddleware');
const { generateScorecardPDF, generateScorecardPDFBuffer, generatePragatiReportPDFBuffer, buildScorecardHTML, buildPragatiReportHTML } = require('../services/pdfService');
const { sendWhatsAppScorecardPDF, sendWhatsAppPragatiPDF, sendWhatsAppScorecardSummary, sendWhatsAppPragatiSummary } = require('../services/whatsappService');
const { uploadPdfToCloudinary, isCloudinaryConfigured } = require('../services/cloudinaryService');

const router = express.Router();

// Helper to parse scheduled time in Indian Standard Time (IST) or UTC
function parseScheduledTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    const t = new Date(s).getTime();
    return isNaN(t) ? null : t;
  }
  const withSec = s.length === 16 ? `${s}:00` : s;
  const t = new Date(`${withSec}+05:30`).getTime();
  return isNaN(t) ? null : t;
}

// Helper to check if request is authenticated by a teacher
function isTeacherRequest(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded && decoded.role === 'teacher';
  } catch {
    return false;
  }
}


// Memory cache for recent generated PDF URLs: submissionId -> url (capped at 150 entries to prevent memory leak)
const scorecardPdfUrlCache = new Map();
function setScorecardPdfCache(id, url) {
  if (scorecardPdfUrlCache.size >= 150) {
    const oldestKey = scorecardPdfUrlCache.keys().next().value;
    if (oldestKey !== undefined) scorecardPdfUrlCache.delete(oldestKey);
  }
  scorecardPdfUrlCache.set(id, url);
}

// ⚡ In-Memory RAM Cache for Test Questions in Review (serves 500+ students instantly with 0 DB query overhead)
const reviewQuestionsCache = new Map();
const REVIEW_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCachedReviewQuestions(testCode) {
  if (!testCode) return null;
  const entry = reviewQuestionsCache.get(testCode);
  if (entry && (Date.now() - entry.timestamp < REVIEW_CACHE_TTL_MS)) {
    return entry.questions;
  }
  return null;
}

function setCachedReviewQuestions(testCode, questions) {
  if (!testCode || !Array.isArray(questions)) return;
  if (reviewQuestionsCache.size >= 100) {
    const oldestKey = reviewQuestionsCache.keys().next().value;
    if (oldestKey !== undefined) reviewQuestionsCache.delete(oldestKey);
  }
  reviewQuestionsCache.set(testCode, { questions, timestamp: Date.now() });
}

// ⚡ RAM Cache for generated Scorecard PDF Buffers: id -> { buffer, filename } (Capped at 50 to protect RAM)
// Once generated, re-downloads take 0.001 seconds with 0% CPU!
const generatedPdfBufferCache = new Map();
function getCachedPdfBuffer(submissionId) {
  return generatedPdfBufferCache.get(submissionId) || null;
}
function setCachedPdfBuffer(submissionId, buffer, filename) {
  if (generatedPdfBufferCache.size >= 50) {
    const oldestKey = generatedPdfBufferCache.keys().next().value;
    if (oldestKey !== undefined) generatedPdfBufferCache.delete(oldestKey);
  }
  generatedPdfBufferCache.set(submissionId, { buffer, filename });
}

// ─── Helper: Auto-calculate MCQ score with Negative Marking (Supports Option E / Skip) ────
function calculateMCQScore(answers, questions) {
  let score = 0;
  let total = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0; // Option E / Not Attempted
  let negativeMarks = 0;

  answers.forEach(ans => {
    const question = questions.find(q => q.id === Number(ans.questionId));
    if (question && question.type === 'mcq') {
      total++;
      const qMarks = Number(question.marks) || 1;
      const qNeg = Number(question.negativeMarking) || 0;

      const selected = ans.selectedOpt ? String(ans.selectedOpt).trim().toUpperCase() : null;
      const correct = question.correctOpt ? String(question.correctOpt).trim().toUpperCase() : null;

      // Option E = Not Attempted (No marks awarded, NO negative deduction)
      if (selected === 'E') {
        skippedCount++;
      } else if (correct && selected && selected === correct) {
        score += qMarks;
        correctCount++;
      } else if (selected && correct && selected !== correct) {
        // Wrong Answer (A, B, C, D)
        wrongCount++;
        if (qNeg > 0) {
          score -= qNeg;
          negativeMarks += qNeg;
        }
      } else if (!selected) {
        // If question has Option E (TAT-S / TAT-HS pattern), not selecting any option gets penalty.
        // For standard 4-option tests (TET, High Court, etc.), leaving it blank does NOT incur penalty.
        const hasOptionE = Boolean(question.optionE || (question.testName && /TAT[- ]?(S|HS)/i.test(question.testName)));
        if (hasOptionE && qNeg > 0) {
          wrongCount++;
          score -= qNeg;
          negativeMarks += qNeg;
        } else {
          skippedCount++;
        }
      }
    }
  });

  score = Math.max(0, Number(score.toFixed(2)));
  negativeMarks = Number(negativeMarks.toFixed(2));

  return { score, total, correctCount, wrongCount, skippedCount, negativeMarks };
}

// ─── POST /api/submissions/save-progress ──────────────────────
// Auto-save student's current test progress for seamless resume
router.post('/save-progress', authMiddleware, async (req, res) => {
  const { testCode, testName, subject, currentIndex, savedAnswers, answers } = req.body;
  let studentId = req.user.id;

  if (!studentId) {
    let fallbackStudent = await prisma.student.findFirst({
      where: { mobile: req.user.mobile || '9999999999' }
    });
    if (!fallbackStudent) {
      fallbackStudent = await prisma.student.create({
        data: {
          name: req.user.name || req.user.username || 'Teacher Tester',
          mobile: req.user.mobile || '9999999999'
        }
      });
    }
    studentId = fallbackStudent.id;
  }

  if (!testCode) {
    return res.status(400).json({ error: 'testCode જરૂરી છે.' });
  }

  try {
    // Check if test is Enrolled Only:
    const enrolledOnlyQ = await prisma.question.findFirst({
      where: { testCode, isEnrolledOnly: true }
    });
    if (enrolledOnlyQ) {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      const cleanMob = String(student?.mobile || req.user?.mobile || '').replace(/\D/g, '').slice(-10);
      const isEnrolled = await prisma.enrolledStudent.findFirst({
        where: { mobile: cleanMob, isActive: true }
      });
      if (!isEnrolled) {
        return res.status(403).json({
          error: '🔒 આ કસોટી ફક્ત ત્રિનેત્ર એકેડેમીના પ્રવેશ મેળવેલ (Admitted) વિદ્યાર્થીઓ માટે જ છે. પ્રવેશ મેળવવા માટે એકેડેમીનો સંપર્ક કરો.'
        });
      }
    }

    const existing = await prisma.submission.findFirst({
      where: {
        studentId,
        testCode,
        status: 'IN_PROGRESS'
      }
    });

    let record;
    if (existing) {
      record = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          currentIndex: currentIndex != null ? Number(currentIndex) : existing.currentIndex,
          savedAnswers: savedAnswers !== undefined ? savedAnswers : existing.savedAnswers,
          answers: answers || existing.answers || [],
          testName: testName || existing.testName,
          subject: subject || existing.subject,
        }
      });
    } else {
      record = await prisma.submission.create({
        data: {
          student: { connect: { id: studentId } },
          testCode,
          testName: testName || 'સામાન્ય કસોટી',
          subject: subject || 'General',
          status: 'IN_PROGRESS',
          currentIndex: currentIndex != null ? Number(currentIndex) : 0,
          savedAnswers: savedAnswers || {},
          answers: answers || [],
          startedAt: new Date(),
        }
      });
    }

    res.json({ success: true, session: record });
  } catch (err) {
    console.error('Save Progress Error:', err);
    res.status(500).json({ error: 'Progress save કરવામાં ભૂલ.' });
  }
});

// ─── GET /api/submissions/active-session ───────────────────────
// Check if student has an unfinished (in-progress) test
router.get('/active-session', authMiddleware, async (req, res) => {
  let studentId = req.user.id;
  const { testCode } = req.query;

  if (!studentId) {
    const fallbackStudent = await prisma.student.findFirst({
      where: { mobile: req.user.mobile || '9999999999' }
    });
    studentId = fallbackStudent?.id;
  }

  if (!studentId) {
    return res.json({ hasActive: false, session: null });
  }

  try {
    const where = { studentId, status: 'IN_PROGRESS' };
    if (testCode) where.testCode = testCode;

    const session = await prisma.submission.findFirst({
      where,
      orderBy: { startedAt: 'desc' }
    });

    res.json({ hasActive: !!session, session });
  } catch (err) {
    res.status(500).json({ error: 'Session fetch ભૂલ.' });
  }
});

// ─── DELETE /api/submissions/active-session ────────────────────
// Discard active unfinished session if student wants to start fresh
router.delete('/active-session', authMiddleware, async (req, res) => {
  let studentId = req.user.id;
  const { testCode } = req.body || req.query;

  if (!studentId) {
    const fallbackStudent = await prisma.student.findFirst({
      where: { mobile: req.user.mobile || '9999999999' }
    });
    studentId = fallbackStudent?.id;
  }

  if (!studentId) {
    return res.json({ success: true });
  }

  try {
    const where = { studentId, status: 'IN_PROGRESS' };
    if (testCode) where.testCode = testCode;

    await prisma.submission.deleteMany({ where });
    res.json({ success: true, message: 'Unfinished session discarded.' });
  } catch (err) {
    res.status(500).json({ error: 'Session discard ભૂલ.' });
  }
});

// ─── POST /api/submissions ────────────────────────────────────
// Student submits final test
router.post('/', authMiddleware, async (req, res) => {
  const { answers, photoUrl, testCode, testName, subject, tabSwitchCount, screenshotCount, screenshotViolations } = req.body;
  let studentId = req.user.id;

  if (!studentId) {
    let fallbackStudent = await prisma.student.findFirst({
      where: { mobile: req.user.mobile || '9999999999' }
    });
    if (!fallbackStudent) {
      fallbackStudent = await prisma.student.create({
        data: {
          name: req.user.name || req.user.username || 'Teacher / Tester',
          mobile: req.user.mobile || '9999999999'
        }
      });
    }
    studentId = fallbackStudent.id;
  }

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Answers array જરૂરી છે.' });
  }

  try {
    // 1. Fetch questions: either by testCode or by questionIds
    let allTestQuestions = [];
    if (testCode) {
      allTestQuestions = await prisma.question.findMany({
        where: { testCode }
      });
      const isEnrolledOnlyTest = allTestQuestions.some(q => q.isEnrolledOnly);
      if (isEnrolledOnlyTest) {
        const student = await prisma.student.findUnique({ where: { id: studentId } });
        const cleanMob = String(student?.mobile || req.user?.mobile || '').replace(/\D/g, '').slice(-10);
        const isEnrolled = await prisma.enrolledStudent.findFirst({
          where: { mobile: cleanMob, isActive: true }
        });
        if (!isEnrolled) {
          return res.status(403).json({
            error: '🔒 આ કસોટી ફક્ત ત્રિનેત્ર એકેડેમીના પ્રવેશ મેળવેલ (Admitted) વિદ્યાર્થીઓ માટે જ છે. પ્રવેશ મેળવવા માટે એકેડેમીનો સંપર્ક કરો.'
          });
        }
      }
    }

    const validQuestionIds = answers
      .map(a => Number(a.questionId))
      .filter(id => !isNaN(id) && id > 0);

    if (allTestQuestions.length === 0 && validQuestionIds.length > 0) {
      allTestQuestions = await prisma.question.findMany({
        where: { id: { in: validQuestionIds } }
      });
    }

    const { score, total, correctCount, wrongCount, negativeMarks } = calculateMCQScore(answers, allTestQuestions);

    const resolvedTestCode = testCode || allTestQuestions[0]?.testCode || 'GENERAL';
    const resolvedTestName = testName || allTestQuestions[0]?.testName || allTestQuestions[0]?.chapter || 'સામાન્ય કસોટી (General Test)';
    const resolvedSubject  = subject  || allTestQuestions[0]?.subject  || 'General';
    const calculatedTotalMarks = allTestQuestions.length > 0
      ? allTestQuestions.reduce((sum, q) => sum + (q.marks || 1), 0)
      : (total || 1);

    // 🔒 Enforce Single Attempt Rule: Check if student has already completed this test
    const alreadyCompleted = await prisma.submission.findFirst({
      where: {
        studentId,
        testCode: resolvedTestCode,
        status: 'COMPLETED'
      }
    });

    if (alreadyCompleted) {
      return res.status(400).json({
        error: 'તમે આ કસોટી અગાઉ આપી ચૂક્યા છો. એક કસોટી ફક્ત એક જ વાર આપી શકાય છે.',
        alreadyAttempted: true,
        submissionId: alreadyCompleted.id
      });
    }

    // Check if there was an in-progress session to complete
    const existingInProgress = await prisma.submission.findFirst({
      where: {
        studentId,
        testCode: resolvedTestCode,
        status: 'IN_PROGRESS'
      }
    });

    const violations = Number(tabSwitchCount || 0);
    const ssCount = Number(screenshotCount || 0);
    const ssList = Array.isArray(screenshotViolations) ? screenshotViolations : [];
    const ssQuestionNumbers = [...new Set(ssList.map(v => v.questionNumber).filter(Boolean))].sort((a, b) => a - b);
    const ssQStr = ssQuestionNumbers.length > 0 ? ssQuestionNumbers.join(', ') : '';

    const remarksParts = [];
    if (violations > 0) {
      remarksParts.push(`⚠️ વિદ્યાર્થીએ કસોટી દરમિયાન ${violations} વાર સ્ક્રીન સ્વિચ કરી હતી${violations >= 3 ? ' (Strike 3 Auto-submitted)' : ''}.`);
    }
    if (ssCount > 0) {
      const qDetail = ssQStr ? ` (પ્રશ્ન નં. ${ssQStr})` : '';
      remarksParts.push(`📸 વિદ્યાર્થીએ કસોટી દરમિયાન ${ssCount} વાર સ્ક્રીનશોટ પાડવાનો પ્રયાસ કર્યો હતો${qDetail}${ssCount >= 3 ? ' (Strike 3 Auto-submitted)' : ''}.`);
    }

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const ipTag = clientIp ? `[IP: ${clientIp}]` : '';

    const baseRemark = remarksParts.join(' ');
    const finalRemark = baseRemark ? `${baseRemark} ${ipTag}`.trim() : (ipTag || null);

    let submission;
    if (existingInProgress) {
      submission = await prisma.submission.update({
        where: { id: existingInProgress.id },
        data: {
          testName:      resolvedTestName,
          subject:       resolvedSubject,
          totalMarks:    calculatedTotalMarks,
          answers:       answers,
          photoUrl:      photoUrl || existingInProgress.photoUrl || null,
          mcqScore:      score,
          totalMCQ:      total,
          correctCount:  correctCount,
          wrongCount:    wrongCount,
          negativeMarks: negativeMarks,
          remarks:       finalRemark || existingInProgress.remarks || null,
          status:        'COMPLETED',
          submittedAt:   new Date()
        },
        include: { student: true }
      });
    } else {
      submission = await prisma.submission.create({
        data: {
          student: { connect: { id: studentId } },
          testCode:      resolvedTestCode,
          testName:      resolvedTestName,
          subject:       resolvedSubject,
          totalMarks:    calculatedTotalMarks,
          answers:       answers,
          photoUrl:      photoUrl || null,
          mcqScore:      score,
          totalMCQ:      total,
          correctCount:  correctCount,
          wrongCount:    wrongCount,
          negativeMarks: negativeMarks,
          remarks:       finalRemark,
          status:        'COMPLETED',
          submittedAt:   new Date()
        },
        include: { student: true }
      });
    }

    // ⚡ Instant WhatsApp Scorecard Notification (Background, Non-blocking)
    const resultsPublishAt = allTestQuestions.find(q => q.resultsPublishAt)?.resultsPublishAt || null;
    if (submission?.student?.mobile) {
      const cleanMob = submission.student.mobile;
      const sName = submission.student.name || 'વિદ્યાર્થી';
      const tName = submission.testName || 'કસોટી';
      const totalMarksVal = calculatedTotalMarks || total;
      sendWhatsAppScorecardSummary(cleanMob, sName, tName, score, totalMarksVal, submission.id, resultsPublishAt).catch(err => {
        console.warn('⚠️ [Auto WhatsApp Scorecard Note]:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      submission: {
        id:            submission.id,
        testCode:      submission.testCode,
        testName:      submission.testName,
        subject:       submission.subject,
        mcqScore:      submission.mcqScore,
        totalMCQ:      submission.totalMCQ,
        totalMarks:    submission.totalMarks,
        correctCount:  submission.correctCount,
        wrongCount:    submission.wrongCount,
        negativeMarks: submission.negativeMarks,
        percentage:    total > 0 ? Math.round((score / total) * 100) : null,
        submittedAt:   submission.submittedAt,
        resultsPublishAt: resultsPublishAt
      }
    });
  } catch (err) {
    console.error('Submit Test Error:', err);
    res.status(500).json({ error: 'ટેસ્ટ સબમિટ કરવામાં ભૂલ.' });
  }
});

// ─── GET /api/submissions/my ──────────────────────────────────
// Student's own completed results
router.get('/my', authMiddleware, async (req, res) => {
  try {
    let studentId = req.user.id;
    if (!studentId && req.user.mobile) {
      const student = await prisma.student.findFirst({ where: { mobile: req.user.mobile } });
      studentId = student?.id;
    }
    if (!studentId) {
      const fallbackStudent = await prisma.student.findFirst({
        where: { mobile: '9999999999' }
      });
      studentId = fallbackStudent?.id;
    }

    if (!studentId) {
      return res.json([]);
    }

    const submissions = await prisma.submission.findMany({
      where: {
        studentId,
        status: { not: 'IN_PROGRESS' }
      },
      orderBy: { submittedAt: 'desc' },
      include: { student: { select: { name: true, mobile: true } } }
    });
    res.json(submissions);
  } catch (err) {
    console.error('Fetch My Submissions Error:', err);
    res.status(500).json({ error: 'Results fetch કરવામાં ભૂલ.' });
  }
});

// ─── GET /api/submissions/by-mobile/:mobile ───────────────────
// Fetch student's test history by mobile number
router.get('/by-mobile/:mobile', async (req, res) => {
  const { mobile } = req.params;
  try {
    const cleanMobile = (mobile || '').trim();
    const student = await prisma.student.findFirst({
      where: { mobile: cleanMobile }
    });
    if (!student) {
      return res.json([]);
    }
    const submissions = await prisma.submission.findMany({
      where: {
        studentId: student.id,
        status: { not: 'IN_PROGRESS' }
      },
      orderBy: { submittedAt: 'desc' },
      include: { student: { select: { name: true, mobile: true } } }
    });
    res.json(submissions);
  } catch (err) {
    console.error('Fetch By-Mobile Submissions Error:', err);
    res.status(500).json({ error: 'History fetch ભૂલ.' });
  }
});

// ─── GET /api/submissions/review/:id ──────────────────────────
// Detailed submission solution review with full questions
router.get('/review/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { student: true }
    });
    if (!submission) {
      return res.status(404).json({ error: 'Submission મળ્યું નથી.' });
    }

    const answersArr = Array.isArray(submission.answers) ? submission.answers : [];
    const questionIds = answersArr.map(a => a.questionId).filter(Boolean);

    let questions = [];
    // Priority 1: If testCode exists, check RAM Cache first (0ms DB query overhead for 500+ students)
    if (submission.testCode) {
      const cached = getCachedReviewQuestions(submission.testCode);
      if (cached && cached.length > 0) {
        questions = cached;
      } else {
        questions = await prisma.question.findMany({
          where: { testCode: submission.testCode },
          orderBy: { orderIndex: 'asc' }
        });
        if (questions.length > 0) {
          setCachedReviewQuestions(submission.testCode, questions);
        }
      }
    }

    // Priority 2: If no questions found by testCode but questionIds exist, fetch sample question's testCode or all IDs
    if (questions.length === 0 && questionIds.length > 0) {
      const firstFoundQ = await prisma.question.findUnique({ where: { id: questionIds[0] } });
      if (firstFoundQ?.testCode) {
        const cached = getCachedReviewQuestions(firstFoundQ.testCode);
        if (cached && cached.length > 0) {
          questions = cached;
        } else {
          questions = await prisma.question.findMany({
            where: { testCode: firstFoundQ.testCode },
            orderBy: { orderIndex: 'asc' }
          });
          if (questions.length > 0) {
            setCachedReviewQuestions(firstFoundQ.testCode, questions);
          }
        }
      } else {
        questions = await prisma.question.findMany({
          where: { id: { in: questionIds } },
          orderBy: { orderIndex: 'asc' }
        });
      }
    }

    // 🔒 Cheating Prevention: Check if test solution/scorecard has a scheduled future release time
    let resultsPublishAt = null;
    const qWithPublish = questions.find(q => q.resultsPublishAt);
    if (qWithPublish?.resultsPublishAt) {
      resultsPublishAt = qWithPublish.resultsPublishAt;
    } else if (submission.testCode) {
      const sampleQ = await prisma.question.findFirst({
        where: { testCode: submission.testCode, resultsPublishAt: { not: null } },
        select: { resultsPublishAt: true }
      });
      if (sampleQ?.resultsPublishAt) resultsPublishAt = sampleQ.resultsPublishAt;
    }

    const isTeacher = isTeacherRequest(req);
    const pubTime = resultsPublishAt ? parseScheduledTime(resultsPublishAt) : null;
    const isLocked = Boolean(!isTeacher && pubTime && pubTime > Date.now());

    if (isLocked) {
      return res.json({
        isLocked: true,
        resultsPublishAt,
        submission: {
          id: submission.id,
          testCode: submission.testCode,
          testName: submission.testName,
          subject: submission.subject,
          mcqScore: submission.mcqScore,
          totalMCQ: submission.totalMCQ,
          totalMarks: submission.totalMarks,
          correctCount: submission.correctCount,
          wrongCount: submission.wrongCount,
          negativeMarks: submission.negativeMarks,
          teacherMarks: submission.teacherMarks,
          remarks: submission.remarks,
          submittedAt: submission.submittedAt
        },
        review: [],
        message: '⏳ આ કસોટીનું વિગતવાર સોલ્યુશન, આન્સર કી અને લીડરબોર્ડ નિયત સમયે જાહેર થશે.'
      });
    }

    const detailedReview = questions.map((q, idx) => {
      const ans = answersArr.find(a => a.questionId === q.id) || answersArr[idx] || {};
      const selected = ans.selectedOpt || ans.text || '';
      let isCorrect = null;
      if (q.type === 'mcq') {
        if (!selected) {
          isCorrect = null; // Unattempted
        } else if (selected === 'E') {
          isCorrect = false; // Skipped (Option E)
        } else {
          isCorrect = (selected === q.correctOpt);
        }
      }
      return {
        question: q,
        studentAnswer: selected,
        isCorrect,
        isSkipped: !selected || selected === 'E',
        timeSpent: ans.timeSpent || 0,
        screenshotAttempt: Boolean(ans.screenshotAttempt),
        studentUploadedPhoto: submission.photoUrl
      };
    });

    // ⚡ Browser Cache Header: Result is final & immutable.
    // Cache on student's mobile browser for 24 hours (re-opens in 0.001s with 0 server load!)
    res.set('Cache-Control', 'private, max-age=86400, stale-while-revalidate=3600');

    res.json({
      submission,
      review: detailedReview
    });
  } catch (err) {
    console.error('Review Error:', err);
    res.status(500).json({ error: 'Review fetch ભૂલ.' });
  }
});

// ─── GET /api/submissions/:id/html ──────────────────────────
// Direct HTML view matching the Royal Scorecard PDF exactly (0% Puppeteer/Chromium, instant!)
router.get('/:id/html', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { student: true }
    });
    if (!submission) {
      return res.status(404).send('<h2>Submission not found</h2>');
    }

    const answersArr = Array.isArray(submission.answers) ? submission.answers : [];
    const questionIds = answersArr.map(a => a.questionId).filter(Boolean);

    let questions = [];
    if (submission.testCode) {
      const cached = getCachedReviewQuestions(submission.testCode);
      if (cached && cached.length > 0) {
        questions = cached;
      } else {
        questions = await prisma.question.findMany({
          where: { testCode: submission.testCode },
          orderBy: { orderIndex: 'asc' }
        });
        if (questions.length > 0) {
          setCachedReviewQuestions(submission.testCode, questions);
        }
      }
    }
    if (questions.length === 0 && questionIds.length > 0) {
      const firstFoundQ = await prisma.question.findUnique({ where: { id: questionIds[0] } });
      if (firstFoundQ?.testCode) {
        const cached = getCachedReviewQuestions(firstFoundQ.testCode);
        if (cached && cached.length > 0) {
          questions = cached;
        } else {
          questions = await prisma.question.findMany({
            where: { testCode: firstFoundQ.testCode },
            orderBy: { orderIndex: 'asc' }
          });
          if (questions.length > 0) {
            setCachedReviewQuestions(firstFoundQ.testCode, questions);
          }
        }
      } else {
        questions = await prisma.question.findMany({
          where: { id: { in: questionIds } },
          orderBy: { orderIndex: 'asc' }
        });
      }
    }

    // 🔒 Cheating Prevention: Check if test solution/scorecard has a scheduled future release time
    let resultsPublishAt = null;
    const qWithPublish = questions.find(q => q.resultsPublishAt);
    if (qWithPublish?.resultsPublishAt) {
      resultsPublishAt = qWithPublish.resultsPublishAt;
    } else if (submission.testCode) {
      const sampleQ = await prisma.question.findFirst({
        where: { testCode: submission.testCode, resultsPublishAt: { not: null } },
        select: { resultsPublishAt: true }
      });
      if (sampleQ?.resultsPublishAt) resultsPublishAt = sampleQ.resultsPublishAt;
    }

    const isTeacher = isTeacherRequest(req);
    const pubTime = resultsPublishAt ? parseScheduledTime(resultsPublishAt) : null;
    const isLocked = Boolean(!isTeacher && pubTime && pubTime > Date.now());

    if (isLocked) {
      let formattedDate = resultsPublishAt;
      try {
        const istDate = new Date(pubTime);
        formattedDate = istDate.toLocaleDateString('gu-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }) + ' ' +
                        istDate.toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      } catch (e) {}

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>પરિણામ શિડ્યુલ થયેલ છે - ત્રિનેત્ર એકેડેમી</title>
        </head>
        <body style="font-family: 'Hind Vadodara', -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box;">
          <div style="background: rgba(30, 41, 59, 0.9); border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius: 20px; padding: 36px 24px; max-width: 500px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
            <div style="font-size: 3rem; margin-bottom: 12px;">⏳ 🔒</div>
            <h2 style="margin: 0 0 10px; color: #fbbf24; font-size: 1.4rem;">પરિણામ & સોલ્યુશન સુરક્ષિત છે</h2>
            <p style="color: #cbd5e1; font-size: 0.95rem; line-height: 1.6; margin: 0 0 20px;">
              કસોટીમાં ચોરી અટકાવવા માટે તમામ પ્રશ્નોના વિગતવાર સોલ્યુશન, આન્સર કી અને લીડરબોર્ડ નિયત સમયે જાહેર થશે.
            </p>
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px dashed rgba(245, 158, 11, 0.5); border-radius: 12px; padding: 14px; margin-bottom: 20px;">
              <div style="font-size: 0.8rem; color: #94a3b8;">જાહેર થવાનો સમય:</div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #f59e0b; margin-top: 4px;">📅 ${formattedDate}</div>
            </div>
            <div style="font-size: 0.82rem; color: #64748b;">ત્રિનેત્ર ઓનલાઇન એકેડેમી • trinetraonline.in</div>
          </div>
        </body>
        </html>
      `);
    }

    const detailedReview = questions.map((q, idx) => {
      const ans = answersArr.find(a => a.questionId === q.id) || answersArr[idx] || {};
      const selected = ans.selectedOpt || ans.text || '';
      let isCorrect = null;
      if (q.type === 'mcq') {
        if (!selected) {
          isCorrect = null;
        } else if (selected === 'E') {
          isCorrect = false;
        } else {
          isCorrect = (selected === q.correctOpt);
        }
      }
      return {
        question: q,
        studentAnswer: selected,
        isCorrect,
        isSkipped: !selected || selected === 'E',
        timeSpent: ans.timeSpent || 0,
        screenshotAttempt: Boolean(ans.screenshotAttempt),
        studentUploadedPhoto: submission.photoUrl
      };
    });

    const marketingItems = await prisma.marketingItem.findMany({
      where: { 
        isActive: true,
        showInPdf: true
      },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const html = await buildScorecardHTML({
      submission,
      review: detailedReview,
      student: submission.student || {},
      marketingItems
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Scorecard HTML Error:', err);
    res.status(500).send('<h2>Error loading scorecard</h2>');
  }
});

// ─── GET /api/submissions/:id/pdf ──────────────────────────
// Direct binary PDF attachment download for student scorecard
router.get('/:id/pdf', async (req, res) => {
  const id = parseInt(req.params.id);

  // ⚡ 1. Check if PDF is already generated & cached in RAM (returns in 0.001s!)
  const cachedPdf = getCachedPdfBuffer(id);
  if (cachedPdf) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cachedPdf.filename)}"`);
    return res.send(cachedPdf.buffer);
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { student: true }
    });
    if (!submission) {
      return res.status(404).json({ error: 'Submission મળ્યું નથી.' });
    }

    const answersArr = Array.isArray(submission.answers) ? submission.answers : [];
    const questionIds = answersArr.map(a => a.questionId).filter(Boolean);

    let questions = [];
    if (submission.testCode) {
      const cached = getCachedReviewQuestions(submission.testCode);
      if (cached && cached.length > 0) {
        questions = cached;
      } else {
        questions = await prisma.question.findMany({
          where: { testCode: submission.testCode },
          orderBy: { orderIndex: 'asc' }
        });
        if (questions.length > 0) {
          setCachedReviewQuestions(submission.testCode, questions);
        }
      }
    }
    if (questions.length === 0 && questionIds.length > 0) {
      const firstFoundQ = await prisma.question.findUnique({ where: { id: questionIds[0] } });
      if (firstFoundQ?.testCode) {
        const cached = getCachedReviewQuestions(firstFoundQ.testCode);
        if (cached && cached.length > 0) {
          questions = cached;
        } else {
          questions = await prisma.question.findMany({
            where: { testCode: firstFoundQ.testCode },
            orderBy: { orderIndex: 'asc' }
          });
          if (questions.length > 0) {
            setCachedReviewQuestions(firstFoundQ.testCode, questions);
          }
        }
      } else {
        questions = await prisma.question.findMany({
          where: { id: { in: questionIds } },
          orderBy: { orderIndex: 'asc' }
        });
      }
    }

    // 🔒 Cheating Prevention: Check if test solution/scorecard has a scheduled future release time
    let resultsPublishAt = null;
    const qWithPublish = questions.find(q => q.resultsPublishAt);
    if (qWithPublish?.resultsPublishAt) {
      resultsPublishAt = qWithPublish.resultsPublishAt;
    } else if (submission.testCode) {
      const sampleQ = await prisma.question.findFirst({
        where: { testCode: submission.testCode, resultsPublishAt: { not: null } },
        select: { resultsPublishAt: true }
      });
      if (sampleQ?.resultsPublishAt) resultsPublishAt = sampleQ.resultsPublishAt;
    }

    const isTeacher = isTeacherRequest(req);
    const pubTime = resultsPublishAt ? parseScheduledTime(resultsPublishAt) : null;
    const isLocked = Boolean(!isTeacher && pubTime && pubTime > Date.now());

    if (isLocked) {
      return res.status(403).json({
        error: 'આ કસોટીનું વિગતવાર સ્કોરકાર્ડ PDF નિયત સમયે ઉપલબ્ધ થશે.',
        resultsPublishAt
      });
    }

    const detailedReview = questions.map((q, idx) => {
      const ans = answersArr.find(a => a.questionId === q.id) || answersArr[idx] || {};
      const selected = ans.selectedOpt || ans.text || '';
      let isCorrect = null;
      if (q.type === 'mcq') {
        if (!selected) {
          isCorrect = null;
        } else if (selected === 'E') {
          isCorrect = false;
        } else {
          isCorrect = (selected === q.correctOpt);
        }
      }
      return {
        question: q,
        studentAnswer: selected,
        isCorrect,
        isSkipped: !selected || selected === 'E',
        timeSpent: ans.timeSpent || 0,
        screenshotAttempt: Boolean(ans.screenshotAttempt),
        studentUploadedPhoto: submission.photoUrl
      };
    });

    const marketingItems = await prisma.marketingItem.findMany({
      where: { 
        isActive: true,
        showInPdf: true
      },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const safeTestName = (submission.testName || 'Scorecard').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
    const safeStudentName = (submission.student?.name || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
    const filename = `Trinetra_${safeTestName}_${safeStudentName}.pdf`;

    // ⚡ Direct High-Speed PDF Buffer Delivery (100% Reliable, Zero 401 ACL errors!)
    const pdfBuffer = await generateScorecardPDFBuffer({
      submission,
      review: detailedReview,
      student: submission.student || {},
      marketingItems
    });

    // ⚡ Cache in RAM for instantaneous re-downloads
    setCachedPdfBuffer(id, pdfBuffer, filename);

    // Background upload to Cloudinary (fire & forget for backup, never block or redirect client)
    if (isCloudinaryConfigured()) {
      uploadPdfToCloudinary(pdfBuffer, filename, `scorecard_${id}`)
        .catch(err => console.warn('Cloudinary backup note:', err.message));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).json({ error: 'PDF જનરેટ કરવામાં ભૂલ આવી.', details: err.message });
  }
});

// ─── POST /api/submissions/:id/send-whatsapp ────────────────
// Direct Scorecard PDF send to student WhatsApp from teacher's WhatsApp number
router.post('/:id/send-whatsapp', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { student: true }
    });
    if (!submission) {
      return res.status(404).json({ error: 'કસોટી સબમિશન મળ્યું નથી.' });
    }
    const cleanReqMobile = String(req.body.mobile || '').replace(/\D/g, '').replace(/^(91|0)/, '');
    const cleanSubMobile = String(submission.student?.mobile || '').replace(/\D/g, '').replace(/^(91|0)/, '');
    const studentMobile = (cleanReqMobile && cleanReqMobile !== '9999999999' && cleanReqMobile.length === 10)
      ? cleanReqMobile
      : (cleanSubMobile || cleanReqMobile);
    const studentName = (req.body.studentName && req.body.studentName !== 'Teacher / Tester' && req.body.studentName !== 'admin@123')
      ? req.body.studentName
      : (submission.student?.name || req.body.studentName || 'વિદ્યાર્થી');

    if (!studentMobile || studentMobile.length !== 10) {
      return res.status(400).json({ error: 'માન્ય ૧૦-અંકનો મોબાઈલ નંબર મળ્યો નથી.' });
    }

    const answersArr = Array.isArray(submission.answers) ? submission.answers : [];
    const questionIds = answersArr.map(a => a.questionId).filter(Boolean);

    let questions = [];
    if (submission.testCode) {
      questions = await prisma.question.findMany({
        where: { testCode: submission.testCode },
        orderBy: { orderIndex: 'asc' }
      });
    }
    if (questions.length === 0 && questionIds.length > 0) {
      const firstFoundQ = await prisma.question.findUnique({ where: { id: questionIds[0] } });
      if (firstFoundQ?.testCode) {
        questions = await prisma.question.findMany({
          where: { testCode: firstFoundQ.testCode },
          orderBy: { orderIndex: 'asc' }
        });
      } else {
        questions = await prisma.question.findMany({
          where: { id: { in: questionIds } },
          orderBy: { orderIndex: 'asc' }
        });
      }
    }

    const detailedReview = questions.map((q, idx) => {
      const ans = answersArr.find(a => a.questionId === q.id) || answersArr[idx] || {};
      const selected = ans.selectedOpt || ans.text || '';
      let isCorrect = null;
      if (q.type === 'mcq') {
        if (!selected) {
          isCorrect = null;
        } else if (selected === 'E') {
          isCorrect = false;
        } else {
          isCorrect = (selected === q.correctOpt);
        }
      }
      return {
        question: q,
        studentAnswer: selected,
        isCorrect,
        isSkipped: !selected || selected === 'E',
        timeSpent: ans.timeSpent || 0,
        screenshotAttempt: Boolean(ans.screenshotAttempt),
        studentUploadedPhoto: submission.photoUrl
      };
    });

    const marketingItems = await prisma.marketingItem.findMany({
      where: { 
        isActive: true,
        showInPdf: true
      },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const totalMarks = Number(submission.totalMarks) > 0 
      ? Number(submission.totalMarks) 
      : Number(submission.totalMCQ) > 0 
        ? Number(submission.totalMCQ) 
        : detailedReview.length;
    const score = Number((submission.mcqScore || 0) + (submission.teacherMarks || 0)) || 0;

    const mode = req.query.mode || req.body?.mode || 'summary';

    // ⚡ Instant 1-Second WhatsApp Delivery (0% RAM / 0% Puppeteer load)
    if (mode !== 'pdf') {
      const result = await sendWhatsAppScorecardSummary(
        studentMobile,
        studentName,
        submission.testName || 'કસોટી',
        score,
        totalMarks,
        id
      );

      if (result.success) {
        return res.json({ success: true, message: result.message });
      } else {
        return res.status(result.isOffline ? 503 : 500).json({
          error: result.error || 'WhatsApp પર મેસેજ મોકલવામાં ભૂલ આવી.',
          isOffline: result.isOffline
        });
      }
    }

    // Heavy PDF generation (Only when explicitly requested with mode=pdf)
    const pdfBuffer = await generateScorecardPDFBuffer({
      submission,
      review: detailedReview,
      student: submission.student || {},
      marketingItems
    });

    // ☁️ Save to Cloudinary CDN & cache for instant future downloads
    if (isCloudinaryConfigured()) {
      const safeTest = (submission.testName || 'Scorecard').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      const safeStudent = (studentName || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
      const filename = `Trinetra_${safeTest}_${safeStudent}.pdf`;
      uploadPdfToCloudinary(pdfBuffer, filename, `scorecard_${id}`)
        .then(res => {
          if (res?.url) {
            setScorecardPdfCache(id, res.url);
            console.log(`☁️ [Cloudinary] Scorecard #${id} saved: ${res.url}`);
          }
        })
        .catch(err => console.warn('Cloudinary async upload note:', err.message));
    }

    const result = await sendWhatsAppScorecardPDF(
      studentMobile,
      studentName,
      submission.testName || 'કસોટી',
      score,
      totalMarks,
      pdfBuffer
    );

    if (result.success) {
      return res.json({ success: true, message: result.message });
    } else {
      return res.status(result.isOffline ? 503 : 500).json({
        error: result.error || 'WhatsApp પર PDF મોકલવામાં ભૂલ આવી.',
        isOffline: result.isOffline
      });
    }
  } catch (err) {
    console.error('Send WhatsApp Scorecard Error:', err);
    res.status(500).json({ error: 'WhatsApp સેન્ડ કરવામાં સર્વર ભૂલ: ' + (err.message || '') });
  }
});

// ─── GET /api/submissions/pragati/:mobile/html ───────────────────
// Direct HTML view matching the Pragati Report PDF exactly (0% Puppeteer, instant!)
router.get('/pragati/:mobile/html', async (req, res) => {
  try {
    const rawMobile = req.params.mobile || '';
    const cleanMobile = String(rawMobile).replace(/\D/g, '').replace(/^(91|0)/, '');
    if (!cleanMobile) {
      return res.status(400).send('<h2>Mobile number is required</h2>');
    }

    const student = await prisma.student.findFirst({ where: { mobile: cleanMobile } });
    const effectiveName = student?.name || 'વિદ્યાર્થી';

    const submissions = await prisma.submission.findMany({
      where: {
        OR: [
          ...(student?.id ? [{ studentId: student.id }] : []),
          { student: { mobile: cleanMobile } }
        ],
        status: { not: 'IN_PROGRESS' },
        mcqScore: { not: null }
      },
      orderBy: { submittedAt: 'desc' }
    });

    if (submissions.length === 0) {
      return res.status(404).send('<h2>કોઈ કસોટી પરિણામ મળ્યું નથી.</h2>');
    }

    const marketingItems = await prisma.marketingItem.findMany({
      where: { isActive: true, showInPdf: true },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const html = await buildPragatiReportHTML({
      student: { name: effectiveName, mobile: cleanMobile },
      submissions,
      marketingItems
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Pragati HTML Error:', err);
    res.status(500).send('<h2>Error loading pragati report</h2>');
  }
});

// ─── GET /api/submissions/pragati/:mobile/pdf ────────────────────
// Direct binary PDF stream of student's Pragati Report
router.get('/pragati/:mobile/pdf', async (req, res) => {
  try {
    const rawMobile = req.params.mobile || '';
    const cleanMobile = String(rawMobile).replace(/\D/g, '').replace(/^(91|0)/, '');
    if (!cleanMobile) {
      return res.status(400).json({ error: 'Mobile number required' });
    }

    const student = await prisma.student.findFirst({ where: { mobile: cleanMobile } });
    const effectiveName = student?.name || 'વિદ્યાર્થી';

    const submissions = await prisma.submission.findMany({
      where: {
        OR: [
          ...(student?.id ? [{ studentId: student.id }] : []),
          { student: { mobile: cleanMobile } }
        ],
        status: { not: 'IN_PROGRESS' },
        mcqScore: { not: null }
      },
      orderBy: { submittedAt: 'desc' }
    });

    if (submissions.length === 0) {
      return res.status(404).json({ error: 'કોઈ કસોટી પરિણામ મળ્યું નથી.' });
    }

    const marketingItems = await prisma.marketingItem.findMany({
      where: { isActive: true, showInPdf: true },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const pdfBuffer = await generatePragatiReportPDFBuffer({
      student: { name: effectiveName, mobile: cleanMobile },
      submissions,
      marketingItems
    });

    const safeName = effectiveName.replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
    const filename = `Trinetra_Pragati_${safeName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Pragati PDF Error:', err);
    res.status(500).json({ error: 'Pragati PDF Error: ' + err.message });
  }
});

// ─── POST /api/submissions/send-pragati-whatsapp ─────────────
// Generate Pragati (Progress Report) and send to student's WhatsApp
router.post('/send-pragati-whatsapp', authMiddleware, async (req, res) => {
  try {
    const { studentId, studentName, mobile } = req.body;

    const rawMobile = mobile || req.user?.mobile || '';
    const cleanMobile = String(rawMobile).replace(/\D/g, '').replace(/^(91|0)/, '');
    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile)) {
      return res.status(400).json({ error: 'માન્ય ૧૦-અંકનો WhatsApp મોબાઈલ નંબર જરૂરી છે.' });
    }

    const targetStudentId = studentId ? parseInt(studentId) : (req.user?.id ? parseInt(req.user.id) : null);
    
    let student = null;
    if (targetStudentId) {
      student = await prisma.student.findUnique({ where: { id: targetStudentId } });
    }
    if (!student && cleanMobile) {
      student = await prisma.student.findFirst({ where: { mobile: cleanMobile } });
    }
    if (!student && targetStudentId) {
      student = { id: targetStudentId, name: studentName || req.user?.name || 'વિદ્યાર્થી', mobile: cleanMobile };
    }
    if (!student) {
      return res.status(404).json({ error: 'વિદ્યાર્થી એકાઉન્ટ મળ્યું નથી.' });
    }

    const effectiveName = studentName || student.name || req.user?.name || 'વિદ્યાર્થી';

    const submissions = await prisma.submission.findMany({
      where: {
        OR: [
          ...(student.id ? [{ studentId: student.id }] : []),
          ...(cleanMobile ? [{ student: { mobile: cleanMobile } }] : [])
        ],
        status: { not: 'IN_PROGRESS' },
        mcqScore: { not: null }
      },
      orderBy: { submittedAt: 'desc' }
    });

    if (submissions.length === 0) {
      return res.status(400).json({ error: 'આ વિદ્યાર્થીએ હજુ કોઈ કસોટી આપી નથી.' });
    }

    let sumScore = 0, sumTotal = 0;
    submissions.forEach(s => {
      const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
      const totalM = Number(s.totalMarks) > 0 ? Number(s.totalMarks) : Number(s.totalMCQ) > 0 ? Number(s.totalMCQ) : 20;
      sumScore += Math.min(totalM, Math.max(0, score));
      sumTotal += totalM;
    });
    const avgPct = sumTotal > 0 ? Math.min(100, Math.round((sumScore / sumTotal) * 100)) : 0;
    const overallGrade = avgPct >= 90 ? '👑 A+ (ટોપર)' : avgPct >= 75 ? '⭐ A (ઉત્કૃષ્ટ)' : avgPct >= 60 ? '🟢 B (સક્ષમ)' : '🔴 C (સુધારણા)';

    const mode = req.query.mode || req.body?.mode || 'summary';

    // ⚡ Fast 1-Second WhatsApp Delivery (0% RAM / 0% Puppeteer load)
    if (mode !== 'pdf') {
      const result = await sendWhatsAppPragatiSummary(
        cleanMobile,
        effectiveName,
        submissions.length,
        avgPct,
        overallGrade
      );
      if (result.success) {
        return res.json({ success: true, message: result.message || 'પ્રગતિ અહેવાલ લિંક WhatsApp પર મોકલાઈ ગઈ!' });
      } else {
        return res.status(result.isOffline ? 503 : 500).json({ error: result.error, isOffline: result.isOffline });
      }
    }

    // Heavy PDF generation (Only when mode=pdf explicitly requested)
    const marketingItems = await prisma.marketingItem.findMany({
      where: { isActive: true, showInPdf: true },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const pdfBuffer = await generatePragatiReportPDFBuffer({
      student: { name: effectiveName, mobile: cleanMobile },
      submissions,
      marketingItems
    });

    const result = await sendWhatsAppPragatiPDF(
      cleanMobile,
      effectiveName,
      pdfBuffer
    );

    if (result.success) {
      console.log(`✅ [Pragati WhatsApp Sent] To: +91${cleanMobile} (${effectiveName})`);
      return res.json({ success: true, message: `📊 પ્રગતિ રિપોર્ટ PDF WhatsApp (+91${cleanMobile}) પર સફળતાપૂર્વક મોકલ્યો!` });
    } else {
      return res.status(result.isOffline ? 503 : 500).json({ error: result.error, isOffline: result.isOffline });
    }
  } catch (err) {
    console.error('Send Pragati WhatsApp Error:', err);
    res.status(500).json({ error: 'Pragati WhatsApp: ' + (err.message || 'સર્વર ભૂલ') });
  }
});

// ─── GET /api/submissions ─────────────────────────────────────
// All submissions (teacher only)
router.get('/', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, mobile: true } }
      }
    });
    const enhancedSubmissions = submissions.map(sub => {
      const match = sub.remarks ? sub.remarks.match(/\[IP:\s*([^\]]+)\]/) : null;
      return {
        ...sub,
        ipAddress: match ? match[1] : null
      };
    });
    res.json(enhancedSubmissions);
  } catch (err) {
    res.status(500).json({ error: 'Submissions fetch કરવામાં ભૂલ.' });
  }
});

// ─── ⚡ Ultra-Fast In-Memory Cache for Leaderboard (0% Database Load) ───
let leaderboardCache = null;
let leaderboardCacheTime = 0;
let testWiseLeaderboardCache = null;
let testWiseLeaderboardCacheTime = 0;
const LB_CACHE_TTL = 30 * 1000; // 30 seconds cache

// ⏱️ Helper to compute duration & human-formatted time in Gujarati
function computeSubmissionTimeStats(sub) {
  let seconds = 0;
  if (Array.isArray(sub.answers)) {
    sub.answers.forEach(a => {
      if (a && a.timeSpent) seconds += Number(a.timeSpent) || 0;
    });
  }
  if (!seconds && sub.startedAt && sub.submittedAt) {
    const diff = Math.round((new Date(sub.submittedAt).getTime() - new Date(sub.startedAt).getTime()) / 1000);
    if (diff > 0 && diff < 86400) seconds = diff;
  }

  let formatted = '';
  if (seconds > 0) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) formatted = `${hours} ક. ${mins} મિ.`;
    else if (mins > 0) formatted = `${mins} મિ. ${secs > 0 ? `${secs} સે.` : ''}`.trim();
    else formatted = `${secs} સેકન્ડ`;
  }

  return {
    timeSpentSeconds: seconds,
    timeSpentFormatted: formatted || null
  };
}

// ─── GET /api/submissions/leaderboard ────────────────────────
// Top students by MCQ score (public) - overall with RAM Caching
router.get('/leaderboard', async (req, res) => {
  try {
    const isTeacher = isTeacherRequest(req);
    const now = Date.now();
    if (!isTeacher && leaderboardCache && (now - leaderboardCacheTime < LB_CACHE_TTL)) {
      return res.json(leaderboardCache);
    }

    const topSubmissions = await prisma.submission.findMany({
      where: { mcqScore: { not: null }, status: { not: 'IN_PROGRESS' } },
      orderBy: [{ mcqScore: 'desc' }, { submittedAt: 'asc' }],
      take: 60,
      include: {
        student: { select: { name: true, mobile: true } }
      }
    });

    let leaderboard = topSubmissions.map((sub) => {
      const timeStats = computeSubmissionTimeStats(sub);
      return {
        submissionId: sub.id,
        studentName: sub.student.name,
        mobile: sub.student.mobile.slice(0, 5) + '*****',
        mcqScore: sub.mcqScore,
        totalMCQ: sub.totalMCQ,
        percentage: sub.totalMCQ > 0
          ? Math.round((sub.mcqScore / sub.totalMCQ) * 100)
          : 0,
        startedAt: sub.startedAt,
        submittedAt: sub.submittedAt,
        timeSpentSeconds: timeStats.timeSpentSeconds,
        timeSpentFormatted: timeStats.timeSpentFormatted
      };
    });

    // Sort by mcqScore descending; if equal, by least time (faster completion) ascending; then submittedAt
    leaderboard.sort((a, b) => {
      if (b.mcqScore !== a.mcqScore) return b.mcqScore - a.mcqScore;
      const durA = (a.timeSpentSeconds && a.timeSpentSeconds > 0) ? a.timeSpentSeconds : 999999;
      const durB = (b.timeSpentSeconds && b.timeSpentSeconds > 0) ? b.timeSpentSeconds : 999999;
      if (durA !== durB) return durA - durB;
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });

    leaderboard = leaderboard.slice(0, 15).map((l, index) => ({
      ...l,
      rank: index + 1
    }));

    // Check for active overrides (for ALL tests or specific tests)
    const activeOverrides = await prisma.leaderboardOverride.findMany({
      where: { isActive: true },
      orderBy: { rank: 'desc' }
    });

    if (activeOverrides.length > 0) {
      activeOverrides.forEach(ov => {
        const existingIdx = leaderboard.findIndex(l => 
          (ov.submissionId && l.submissionId === ov.submissionId) ||
          (l.studentName && l.studentName.trim().toLowerCase() === ov.studentName.trim().toLowerCase())
        );
        let leaderItem;
        if (existingIdx >= 0) {
          leaderItem = { ...leaderboard[existingIdx], mcqScore: ov.score ?? leaderboard[existingIdx].mcqScore, isTeacherOverride: true };
          leaderboard.splice(existingIdx, 1);
        } else {
          leaderItem = {
            submissionId: ov.submissionId,
            studentName: ov.studentName,
            mobile: ov.mobile ? (ov.mobile.slice(0, 5) + '*****') : '******',
            mcqScore: ov.score,
            totalMCQ: ov.totalMarks || 100,
            percentage: (ov.totalMarks && ov.totalMarks > 0) ? Math.round((ov.score / ov.totalMarks) * 100) : 100,
            submittedAt: ov.updatedAt || ov.createdAt,
            isTeacherOverride: true
          };
        }
        const targetPos = Math.min(leaderboard.length, Math.max(0, (ov.rank || 1) - 1));
        leaderboard.splice(targetPos, 0, leaderItem);
      });
    }

    // Always strictly enforce Top 10 ranking
    leaderboard = leaderboard.slice(0, 10).map((l, idx) => ({ ...l, rank: idx + 1 }));

    if (!isTeacher) {
      leaderboardCache = leaderboard;
      leaderboardCacheTime = now;
    }

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Leaderboard fetch ભૂલ.' });
  }
});

// ─── GET /api/submissions/leaderboard/by-test ─────────────────
// Test-wise leaderboard — grouped by testCode/testName with scheduled lock & teacher override
router.get('/leaderboard/by-test', async (req, res) => {
  try {
    const isTeacher = isTeacherRequest(req);
    const now = Date.now();
    if (!isTeacher && testWiseLeaderboardCache && (now - testWiseLeaderboardCacheTime < LB_CACHE_TTL)) {
      return res.json(testWiseLeaderboardCache);
    }

    // 1. Fetch questions with scheduled resultsPublishAt
    const questionsWithPublish = await prisma.question.findMany({
      where: { resultsPublishAt: { not: null } },
      select: { testCode: true, resultsPublishAt: true }
    });
    const scheduledPublishMap = {};
    questionsWithPublish.forEach(q => {
      if (q.testCode && !scheduledPublishMap[q.testCode]) {
        scheduledPublishMap[q.testCode] = q.resultsPublishAt;
      }
    });

    // 2. Fetch active leaderboard overrides
    const overrides = await prisma.leaderboardOverride.findMany({
      where: { isActive: true },
      orderBy: { rank: 'asc' }
    });

    const allSubs = await prisma.submission.findMany({
      where: {
        mcqScore: { not: null },
        status: { not: 'IN_PROGRESS' }
      },
      orderBy: [{ mcqScore: 'desc' }, { submittedAt: 'asc' }],
      include: {
        student: { select: { name: true, mobile: true } }
      }
    });

    // Group by testCode
    const testMap = {};
    allSubs.forEach(sub => {
      const key = sub.testCode || 'GENERAL';
      if (!testMap[key]) {
        testMap[key] = {
          testCode: key,
          testName: sub.testName || key,
          subject: sub.subject || 'General',
          participants: 0,
          isLocked: false,
          resultsPublishAt: scheduledPublishMap[key] || null,
          rawSubs: [],
          leaders: [],
          studentRankMap: {}
        };
      }
      testMap[key].participants++;
      const timeStats = computeSubmissionTimeStats(sub);
      testMap[key].rawSubs.push({
        submissionId: sub.id,
        studentName: sub.student?.name || 'વિદ્યાર્થી',
        mobile: sub.student?.mobile ? sub.student.mobile.slice(0, 5) + '*****' : '*****',
        rawMobile: sub.student?.mobile || '',
        mcqScore: sub.mcqScore,
        totalMCQ: sub.totalMCQ,
        totalMarks: sub.totalMarks,
        percentage: sub.totalMCQ > 0 ? Math.round((sub.mcqScore / sub.totalMCQ) * 100) : 0,
        startedAt: sub.startedAt,
        submittedAt: sub.submittedAt,
        timeSpentSeconds: timeStats.timeSpentSeconds,
        timeSpentFormatted: timeStats.timeSpentFormatted
      });
    });

    // For each test, sort by score descending; if equal, by least time (faster completion) ascending; then submittedAt
    Object.keys(testMap).forEach(key => {
      testMap[key].rawSubs.sort((a, b) => {
        if (b.mcqScore !== a.mcqScore) return b.mcqScore - a.mcqScore;
        const durA = (a.timeSpentSeconds && a.timeSpentSeconds > 0) ? a.timeSpentSeconds : 999999;
        const durB = (b.timeSpentSeconds && b.timeSpentSeconds > 0) ? b.timeSpentSeconds : 999999;
        if (durA !== durB) return durA - durB;
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });

      testMap[key].rawSubs.forEach((item, idx) => {
        const currentRank = idx + 1;
        if (item.rawMobile) {
          const cleanM = String(item.rawMobile).replace(/\D/g, '').slice(-10);
          if (cleanM && !testMap[key].studentRankMap[cleanM]) {
            testMap[key].studentRankMap[cleanM] = {
              rank: currentRank,
              submissionId: item.submissionId,
              studentName: item.studentName,
              score: item.mcqScore,
              totalMarks: item.totalMarks || item.totalMCQ,
              percentage: item.percentage,
              startedAt: item.startedAt,
              submittedAt: item.submittedAt,
              timeSpentSeconds: item.timeSpentSeconds,
              timeSpentFormatted: item.timeSpentFormatted
            };
          }
        }

        if (idx < 15) {
          testMap[key].leaders.push({
            ...item,
            rank: currentRank
          });
        }
      });
      delete testMap[key].rawSubs;
    });

    // Apply scheduled result lock and teacher overrides per test
    Object.keys(testMap).forEach(key => {
      const pubAt = scheduledPublishMap[key];
      const pubTime = pubAt ? parseScheduledTime(pubAt) : null;
      const isLocked = Boolean(!isTeacher && pubTime && pubTime > now);

      if (isLocked) {
        testMap[key].isLocked = true;
        testMap[key].resultsPublishAt = pubAt;
        testMap[key].leaders = []; // Conceal leaders until scheduled release time
        testMap[key].studentRankMap = {}; // Conceal student ranks until scheduled release time
      } else {
        testMap[key].isLocked = false;
        testMap[key].resultsPublishAt = pubAt || null;

        // Apply any leaderboard overrides for this testCode
        const testOverrides = overrides.filter(o => 
          o.testCode === key || 
          o.testCode === 'ALL' || 
          o.testCode === testMap[key].testCode ||
          (testMap[key].testName && o.testCode === `NAME_${testMap[key].testName}`)
        );

        if (testOverrides.length > 0) {
          testOverrides.sort((a, b) => (b.rank || 1) - (a.rank || 1));
          testOverrides.forEach(ov => {
            const existingIdx = testMap[key].leaders.findIndex(l => 
              (ov.submissionId && l.submissionId === ov.submissionId) || 
              (l.studentName && l.studentName.trim().toLowerCase() === ov.studentName.trim().toLowerCase())
            );

            let leaderItem;
            if (existingIdx >= 0) {
              leaderItem = { 
                ...testMap[key].leaders[existingIdx], 
                mcqScore: ov.score ?? testMap[key].leaders[existingIdx].mcqScore, 
                isTeacherOverride: true,
                overrideNote: ov.note
              };
              testMap[key].leaders.splice(existingIdx, 1);
            } else {
              leaderItem = {
                submissionId: ov.submissionId,
                studentName: ov.studentName,
                mobile: ov.mobile ? (ov.mobile.slice(0, 5) + '*****') : '******',
                rawMobile: ov.mobile,
                mcqScore: ov.score,
                totalMCQ: ov.totalMarks || 100,
                totalMarks: ov.totalMarks || 100,
                percentage: (ov.totalMarks && ov.totalMarks > 0) ? Math.round((ov.score / ov.totalMarks) * 100) : 100,
                submittedAt: ov.updatedAt || ov.createdAt,
                isTeacherOverride: true,
                overrideNote: ov.note
              };
            }
            const targetPos = Math.min(testMap[key].leaders.length, Math.max(0, (ov.rank || 1) - 1));
            testMap[key].leaders.splice(targetPos, 0, leaderItem);

            // Also sync studentRankMap
            if (ov.mobile) {
              const cleanM = String(ov.mobile).replace(/\D/g, '').slice(-10);
              if (cleanM && testMap[key].studentRankMap[cleanM]) {
                testMap[key].studentRankMap[cleanM].rank = ov.rank || 1;
                testMap[key].studentRankMap[cleanM].isTeacherOverride = true;
              }
            }
          });

          // Re-index ranks
          testMap[key].leaders = testMap[key].leaders.slice(0, 10).map((l, idx) => ({
            ...l,
            rank: idx + 1
          }));
        } else {
          testMap[key].leaders = testMap[key].leaders.slice(0, 10).map((l, idx) => ({
            ...l,
            rank: idx + 1
          }));
        }
      }
    });

    // Sort tests: most participants first
    const testList = Object.values(testMap).sort((a, b) => b.participants - a.participants);

    if (!isTeacher) {
      testWiseLeaderboardCache = testList;
      testWiseLeaderboardCacheTime = now;
    }

    res.json(testList);
  } catch (err) {
    console.error('by-test leaderboard error:', err);
    res.status(500).json({ error: 'Test-wise leaderboard fetch ભૂલ.' });
  }
});

// ─── POST /api/submissions/leaderboard/override ──────────────
// Teacher manually changes/sets the leader or rank for a test
router.post('/leaderboard/override', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode, submissionId, studentName, mobile, score, totalMarks, rank, action } = req.body;
  if (!testCode) {
    return res.status(400).json({ error: 'testCode જરૂરી છે.' });
  }

  try {
    // Clear RAM cache immediately
    leaderboardCache = null;
    leaderboardCacheTime = 0;
    testWiseLeaderboardCache = null;
    testWiseLeaderboardCacheTime = 0;

    if (action === 'reset') {
      await prisma.leaderboardOverride.updateMany({
        where: testCode === 'ALL' ? {} : { testCode },
        data: { isActive: false }
      });
      try {
        await prisma.submission.updateMany({
          where: testCode === 'ALL' ? {} : { testCode },
          data: { customRank: null }
        });
      } catch (err) {
        console.warn('Submission customRank reset note:', err.message);
      }
      return res.json({ success: true, message: 'લીડરબોર્ડ સફળતાપૂર્વક મૂળ ઓટોમેટિક ક્રમ પર રીસેટ થયું.' });
    }

    if (action === 'reset_student') {
      await prisma.leaderboardOverride.updateMany({
        where: {
          testCode,
          OR: [
            ...(submissionId ? [{ submissionId: parseInt(submissionId) }] : []),
            ...(studentName ? [{ studentName: studentName.trim() }] : [])
          ]
        },
        data: { isActive: false }
      });
      if (submissionId) {
        try {
          await prisma.submission.update({
            where: { id: parseInt(submissionId) },
            data: { customRank: null }
          });
        } catch (err) {
          console.warn('Submission customRank reset student note:', err.message);
        }
      }
      return res.json({ success: true, message: 'વિદ્યાર્થીનો મેન્યુઅલ રેન્ક રદ થયો.' });
    }

    if (!studentName || score === undefined) {
      return res.status(400).json({ error: 'વિદ્યાર્થીનું નામ અને ગુણ જરૂરી છે.' });
    }

    const targetRank = rank ? parseInt(rank) : 1;

    // Deactivate previous active override for this student OR this rank in this testCode
    const cleanMob = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : '';
    await prisma.leaderboardOverride.updateMany({
      where: {
        testCode,
        OR: [
          { rank: targetRank },
          ...(submissionId ? [{ submissionId: parseInt(submissionId) }] : []),
          ...(cleanMob ? [{ mobile: { contains: cleanMob } }] : (!submissionId ? [{ studentName: studentName.trim() }] : []))
        ]
      },
      data: { isActive: false }
    });

    const override = await prisma.leaderboardOverride.create({
      data: {
        testCode,
        submissionId: submissionId ? parseInt(submissionId) : null,
        studentName: studentName.trim(),
        mobile: mobile ? String(mobile).trim() : null,
        score: parseFloat(score),
        totalMarks: totalMarks ? parseInt(totalMarks) : null,
        rank: targetRank,
        isActive: true,
        note: 'શિક્ષક દ્વારા મેન્યુઅલ લીડર સિલેક્શન'
      }
    });

    // Update submission record with customRank
    if (submissionId) {
      try {
        await prisma.submission.update({
          where: { id: parseInt(submissionId) },
          data: { customRank: targetRank }
        });
      } catch (subErr) {
        console.warn('submission customRank update note:', subErr.message);
      }
    }

    res.json({
      success: true,
      message: `👑 લીડર સફળતાપૂર્વક બદલાઈ ગયો! ${studentName} ને રેન્ક #${targetRank} પર સેટ કરવામાં આવ્યા છે.`,
      override
    });
  } catch (err) {
    console.error('Leaderboard override error:', err);
    res.status(500).json({ error: 'લીડર બદલવામાં સર્વર ક્ષતિ: ' + (err.message || '') });
  }
});

// ─── GET /api/submissions/leaderboard/overrides ──────────────
// Fetch all active overrides (Teacher only)
router.get('/leaderboard/overrides', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const overrides = await prisma.leaderboardOverride.findMany({
      where: { isActive: true },
      orderBy: [{ testCode: 'asc' }, { rank: 'asc' }]
    });
    res.json(overrides);
  } catch (err) {
    res.status(500).json({ error: 'Overrides fetch કરવામાં ભૂલ.' });
  }
});



// ─── PUT /api/submissions/:id/grade ──────────────────────────
// Teacher grades a submission
router.put('/:id/grade', authMiddleware, teacherOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  const { teacherMarks, remarks, mcqScore } = req.body;

  try {
    const updateData = {};
    if (teacherMarks !== undefined) {
      updateData.teacherMarks = teacherMarks !== null ? String(teacherMarks) : null;
    }
    if (remarks !== undefined) {
      updateData.remarks = remarks !== null ? String(remarks) : null;
    }
    if (mcqScore !== undefined && mcqScore !== null && !isNaN(parseInt(mcqScore))) {
      updateData.mcqScore = parseInt(mcqScore);
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: updateData,
      include: { student: true }
    });

    res.json({ success: true, submission: updated });
  } catch (err) {
    console.error('Grade Save Error:', err);
    res.status(500).json({ error: 'Grade save કરવામાં ભૂલ.', details: err.message });
  }
});

// ─── POST /api/submissions/re-evaluate ──────────────────────────
// Re-evaluates all submissions for a testCode using current or updated question answer keys
router.post('/re-evaluate', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode, questionUpdates } = req.body;

  if (!testCode) {
    return res.status(400).json({ error: 'testCode જરૂરી છે.' });
  }

  try {
    // 1. If questionUpdates provided, update the questions in DB first
    if (Array.isArray(questionUpdates) && questionUpdates.length > 0) {
      for (const qu of questionUpdates) {
        if (qu.questionId && qu.correctOpt) {
          await prisma.question.update({
            where: { id: parseInt(qu.questionId) },
            data: { correctOpt: String(qu.correctOpt).toUpperCase() }
          });
        }
      }
    }

    // 2. Fetch all questions for this testCode
    const questions = await prisma.question.findMany({
      where: { testCode },
      orderBy: { orderIndex: 'asc' }
    });

    if (questions.length === 0) {
      return res.status(404).json({ error: 'આ કસોટીના કોઈ પ્રશ્નો મળ્યા નથી.' });
    }

    // 3. Fetch all submissions for this testCode
    const submissions = await prisma.submission.findMany({
      where: { testCode }
    });

    let updatedCount = 0;

    for (const sub of submissions) {
      const answersArr = Array.isArray(sub.answers) ? sub.answers : [];
      let newScore = 0;
      let mcqCount = 0;

      questions.forEach((q, idx) => {
        if (q.type === 'mcq') {
          mcqCount++;
          const ans = answersArr.find(a => a.questionId === q.id) || answersArr[idx] || {};
          const selected = ans.selectedOpt || ans.studentAnswer || ans.answer || '';
          if (q.correctOpt && selected && String(selected).trim().toUpperCase() === String(q.correctOpt).trim().toUpperCase()) {
            newScore += (q.marks || 1);
          }
        }
      });

      await prisma.submission.update({
        where: { id: sub.id },
        data: {
          mcqScore: newScore,
          totalMCQ: mcqCount,
          remarks: '📢 Answer Key સુધારા બાદ ગુણ પુનઃ ગણતરી (Re-Evaluation) કરીને અપડેટ કરવામાં આવ્યા છે.'
        }
      });
      updatedCount++;
    }

    res.json({
      success: true,
      updatedCount,
      message: `${updatedCount} વિદ્યાર્થીઓના ગુણ નવી Answer Key મુજબ સફળતાપૂર્વક ફરી ગણવામાં આવ્યા!`
    });
  } catch (err) {
    console.error('Re-evaluate error:', err);
    res.status(500).json({ error: 'પુનઃ મૂલ્યાંકન કરવામાં ક્ષતિ.', details: err.message });
  }
});

module.exports = router;
