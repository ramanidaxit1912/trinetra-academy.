const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, teacherOnly } = require('../middleware/authMiddleware');
const { generateScorecardPDF, generateScorecardPDFBuffer, generatePragatiReportPDFBuffer } = require('../services/pdfService');
const { sendWhatsAppScorecardPDF, sendWhatsAppPragatiPDF } = require('../services/whatsappService');

const router = express.Router();
const prisma = new PrismaClient();

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
  const { answers, photoUrl, testCode, testName, subject } = req.body;
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
          status:        'COMPLETED',
          submittedAt:   new Date()
        },
        include: { student: true }
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
        submittedAt:   submission.submittedAt
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
    // Priority 1: If testCode exists, fetch ALL questions belonging to this test
    if (submission.testCode) {
      questions = await prisma.question.findMany({
        where: { testCode: submission.testCode },
        orderBy: { orderIndex: 'asc' }
      });
    }

    // Priority 2: If no questions found by testCode but questionIds exist, fetch sample question's testCode or all IDs
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
        studentUploadedPhoto: submission.photoUrl
      };
    });

    res.json({
      submission,
      review: detailedReview
    });
  } catch (err) {
    console.error('Review Error:', err);
    res.status(500).json({ error: 'Review fetch ભૂલ.' });
  }
});

// ─── GET /api/submissions/:id/pdf ──────────────────────────
// Direct binary PDF attachment download for student scorecard
router.get('/:id/pdf', async (req, res) => {
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

    const pdfDoc = generateScorecardPDF({
      submission,
      review: detailedReview,
      student: submission.student || {},
      marketingItems
    });

    const safeTestName = (submission.testName || 'Scorecard').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
    const safeStudentName = (submission.student?.name || 'Student').replace(/[^a-zA-Z0-9\u0A80-\u0AFF]/g, '_');
    const filename = `Trinetra_${safeTestName}_${safeStudentName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).json({ error: 'PDF જનરેટ કરવામાં ભૂલ આવી.' });
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

    const pdfBuffer = await generateScorecardPDFBuffer({
      submission,
      review: detailedReview,
      student: submission.student || {},
      marketingItems
    });

    const totalMarks = Number(submission.totalMarks) > 0 
      ? Number(submission.totalMarks) 
      : Number(submission.totalMCQ) > 0 
        ? Number(submission.totalMCQ) 
        : detailedReview.length;
    const score = Number((submission.mcqScore || 0) + (submission.teacherMarks || 0)) || 0;

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

// ─── POST /api/submissions/send-pragati-whatsapp ─────────────
// Generate Pragati (Progress Report) PDF and send to student's WhatsApp
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

    const marketingItems = await prisma.marketingItem.findMany({
      where: { isActive: true, showInPdf: true },
      orderBy: [{ orderIndex: 'asc' }, { id: 'desc' }]
    });

    const pdfBuffer = await generatePragatiReportPDFBuffer({
      student: { name: effectiveName, mobile: cleanMobile },
      submissions,
      marketingItems
    });

    let sumScore = 0, sumTotal = 0;
    submissions.forEach(s => {
      const score = Number((s.mcqScore || 0) + (s.teacherMarks || 0)) || 0;
      const totalM = Number(s.totalMarks) > 0 ? Number(s.totalMarks) : Number(s.totalMCQ) > 0 ? Number(s.totalMCQ) : 20;
      sumScore += Math.min(totalM, Math.max(0, score));
      sumTotal += totalM;
    });
    const avgPct = sumTotal > 0 ? Math.min(100, Math.round((sumScore / sumTotal) * 100)) : 0;
    const overallGrade = avgPct >= 90 ? 'A+ (ટોપર)' : avgPct >= 75 ? 'A (ઉત્કૃષ્ટ)' : avgPct >= 60 ? 'B (સક્ષમ)' : 'C (સુધારણા)';

    const result = await sendWhatsAppPragatiPDF(
      cleanMobile,
      effectiveName,
      submissions.length,
      avgPct,
      overallGrade,
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
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: 'Submissions fetch કરવામાં ભૂલ.' });
  }
});

// ─── ⚡ Ultra-Fast In-Memory Cache for Leaderboard (0% Database Load) ───
let leaderboardCache = null;
let leaderboardCacheTime = 0;
let testWiseLeaderboardCache = null;
let testWiseLeaderboardCacheTime = 0;
const LB_CACHE_TTL = 10 * 1000; // 10 seconds cache

// ─── GET /api/submissions/leaderboard ────────────────────────
// Top students by MCQ score (public) - overall with RAM Caching
router.get('/leaderboard', async (req, res) => {
  try {
    const now = Date.now();
    if (leaderboardCache && (now - leaderboardCacheTime < LB_CACHE_TTL)) {
      return res.json(leaderboardCache);
    }

    const topSubmissions = await prisma.submission.findMany({
      where: { mcqScore: { not: null }, status: { not: 'IN_PROGRESS' } },
      orderBy: [{ mcqScore: 'desc' }, { submittedAt: 'asc' }],
      take: 10,
      include: {
        student: { select: { name: true, mobile: true } }
      }
    });

    const leaderboard = topSubmissions.map((sub, index) => ({
      rank: index + 1,
      studentName: sub.student.name,
      mobile: sub.student.mobile.slice(0, 5) + '*****',
      mcqScore: sub.mcqScore,
      totalMCQ: sub.totalMCQ,
      percentage: sub.totalMCQ > 0
        ? Math.round((sub.mcqScore / sub.totalMCQ) * 100)
        : 0,
      submittedAt: sub.submittedAt
    }));

    leaderboardCache = leaderboard;
    leaderboardCacheTime = now;

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Leaderboard fetch ભૂલ.' });
  }
});

// ─── GET /api/submissions/leaderboard/by-test ─────────────────
// Test-wise leaderboard — grouped by testCode/testName with RAM Caching
router.get('/leaderboard/by-test', async (req, res) => {
  try {
    const now = Date.now();
    if (testWiseLeaderboardCache && (now - testWiseLeaderboardCacheTime < LB_CACHE_TTL)) {
      return res.json(testWiseLeaderboardCache);
    }
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
          leaders: []
        };
      }
      testMap[key].participants++;
      // Only keep top 10 per test
      if (testMap[key].leaders.length < 10) {
        testMap[key].leaders.push({
          rank: testMap[key].leaders.length + 1,
          studentName: sub.student.name,
          mobile: sub.student.mobile.slice(0, 5) + '*****',
          mcqScore: sub.mcqScore,
          totalMCQ: sub.totalMCQ,
          totalMarks: sub.totalMarks,
          percentage: sub.totalMCQ > 0
            ? Math.round((sub.mcqScore / sub.totalMCQ) * 100)
            : 0,
          submittedAt: sub.submittedAt
        });
      }
    });

    // Sort tests: most participants first
    const testList = Object.values(testMap).sort((a, b) => b.participants - a.participants);

    res.json(testList);
  } catch (err) {
    console.error('by-test leaderboard error:', err);
    res.status(500).json({ error: 'Test-wise leaderboard fetch ભૂલ.' });
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
