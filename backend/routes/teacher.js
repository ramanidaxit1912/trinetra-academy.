const express = require('express');
const prisma = require('../prismaClient');
const { authMiddleware, teacherOnly } = require('../middleware/authMiddleware');

const router = express.Router();

function cleanIndianMobile(rawMobile) {
  let digits = String(rawMobile || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

// ─── GET /api/teacher/stats ───────────────────────────────────
// Dashboard stats: total questions, submissions, pending grades
router.get('/stats', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const [totalQuestions, activeQuestions, totalSubmissions, gradedSubmissions] = await Promise.all([
      prisma.question.count(),
      prisma.question.count({ where: { isActive: true } }),
      prisma.submission.count(),
      prisma.submission.count({ where: { teacherMarks: { not: null } } })
    ]);

    res.json({
      totalQuestions,
      activeQuestions,
      totalSubmissions,
      gradedSubmissions,
      pendingGrades: totalSubmissions - gradedSubmissions
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats fetch ભૂલ.' });
  }
});

// ─── POST /api/teacher/send-test-summary ───────────────────────
// Manually or automatically trigger WhatsApp Test Completion Summary
router.post('/send-test-summary', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { testCode, mobile } = req.body;
    if (!testCode) {
      return res.status(400).json({ error: 'Test code આપવો જરૂરી છે.' });
    }
    const { sendWhatsAppTestCompletionSummary } = require('../services/whatsappService');
    const result = await sendWhatsAppTestCompletionSummary(testCode, mobile || '8200405300');
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'WhatsApp સમરી મોકલી શકાઈ નથી.' });
    }
    res.json({ success: true, message: `✅ ટેસ્ટ (${testCode}) ની WhatsApp સમરી સફળતાપૂર્વક મોકલાઈ ગઈ!` });
  } catch (err) {
    res.status(500).json({ error: 'ટેસ્ટ સમરી મોકલવામાં ક્ષતિ: ' + err.message });
  }
});

// ─── GET /api/teacher/live-monitor ───────────────────────────
// Real-Time Live Exam Hall Monitor for active (IN_PROGRESS) tests
router.get('/live-monitor', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { testCode } = req.query;
    const where = { status: 'IN_PROGRESS' };
    if (testCode && testCode !== 'ALL') {
      where.testCode = testCode;
    }

    const liveSessions = await prisma.submission.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        student: {
          select: { id: true, name: true, mobile: true, lastLoginAt: true }
        }
      }
    });

    // Also get recently completed (last 2 hours) submissions count
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const completedWhere = {
      status: { not: 'IN_PROGRESS' },
      submittedAt: { gte: twoHoursAgo }
    };
    if (testCode && testCode !== 'ALL') completedWhere.testCode = testCode;

    const completedRecentCount = await prisma.submission.count({
      where: completedWhere
    });

    const formattedSessions = liveSessions.map(sub => {
      let savedAnswersObj = {};
      let lastActiveTimestamp = sub.startedAt ? new Date(sub.startedAt).getTime() : Date.now();
      if (typeof sub.savedAnswers === 'object' && sub.savedAnswers !== null) {
        savedAnswersObj = sub.savedAnswers;
        if (savedAnswersObj._lastActiveAt) {
          lastActiveTimestamp = Number(savedAnswersObj._lastActiveAt);
        }
      }
      const answeredCount = Object.keys(savedAnswersObj).filter(k => !k.startsWith('_')).length;

      return {
        id: sub.id,
        studentId: sub.student?.id,
        studentName: sub.student?.name || 'વિદ્યાર્થી',
        mobile: sub.student?.mobile || '',
        testCode: sub.testCode,
        testName: sub.testName,
        subject: sub.subject,
        currentIndex: (sub.currentIndex || 0) + 1, // 1-indexed for display
        answeredCount,
        startedAt: sub.startedAt,
        lastActiveAt: new Date(lastActiveTimestamp).toISOString(),
        isIdle: (Date.now() - lastActiveTimestamp) > 90 * 1000, // Idle if no update for 90s
        remarks: sub.remarks || null
      };
    });

    res.json({
      success: true,
      activeCount: formattedSessions.length,
      completedRecentCount,
      students: formattedSessions
    });
  } catch (err) {
    console.error('Live Monitor Error:', err);
    res.status(500).json({ error: 'Live monitor fetch ભૂલ.' });
  }
});

// ─── POST /api/teacher/force-submit-session ───────────────────
// Force-submit or disqualify an active test session
router.post('/force-submit-session', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { submissionId, reason } = req.body;
    if (!submissionId) return res.status(400).json({ error: 'submissionId જરૂરી છે.' });

    const submission = await prisma.submission.findUnique({
      where: { id: Number(submissionId) },
      include: { student: true }
    });

    if (!submission) return res.status(404).json({ error: 'કસોટી સત્ર મળ્યું નથી.' });

    const updated = await prisma.submission.update({
      where: { id: Number(submissionId) },
      data: {
        status: 'COMPLETED',
        remarks: `🛑 શિક્ષક દ્વારા Force-Submit / Disqualify: ${reason || 'નિયમભંગ / સમય સમાપ્ત'}`,
        submittedAt: new Date()
      }
    });

    res.json({ success: true, message: `વિદ્યાર્થી (${submission.student?.name}) નું સત્ર સબમિટ કરી દીધું છે.`, submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Force-submit માં ક્ષતિ: ' + err.message });
  }
});

// ─── GET /api/teacher/students ───────────────────────────────
// All students list
router.get('/students', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { submissions: true } }
      }
    });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: 'Students fetch ભૂલ.' });
  }
});

// ─── GET /api/teacher/export-csv ─────────────────────────────
// Export all submissions as CSV data
router.get('/export-csv', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      orderBy: { submittedAt: 'desc' },
      include: { student: true }
    });

    let csv = '\uFEFF'; // UTF-8 BOM for Gujarati
    csv += 'ક્રમ,વિદ્યાર્થીનું નામ,મોબાઈલ,કસોટીનું નામ,વિષય,MCQ સ્કોર,કુલ MCQ,ટકાવારી,શિક્ષક Marks,Comment,સબમિશન સમય\n';

    submissions.forEach((sub, idx) => {
      const studentName = sub.student?.name || 'વિદ્યાર્થી';
      const studentMobile = sub.student?.mobile || '';
      const testTitle = sub.testName || 'સામાન્ય કસોટી';
      const subjectName = sub.subject || 'સામાન્ય';
      const pct = sub.totalMCQ > 0
        ? Math.round((sub.mcqScore / sub.totalMCQ) * 100)
        : 'N/A';
      const time = new Date(sub.submittedAt).toLocaleString('gu-IN');

      csv += `${idx + 1},"${studentName}","${studentMobile}","${testTitle}","${subjectName}",${sub.mcqScore ?? ''},${sub.totalMCQ ?? ''},${pct},"${sub.teacherMarks || ''}","${sub.remarks || ''}","${time}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Trinetra_Submissions.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'CSV export ભૂલ.' });
  }
});

// ─── POST /api/teacher/student/:id/grant-master-access ──────
// Grant 1-Hour Master PIN Access to specific student
router.post('/student/:id/grant-master-access', authMiddleware, teacherOnly, async (req, res) => {
  const studentId = parseInt(req.params.id);
  const { allow, minutes = 60 } = req.body;
  try {
    const expiresAt = allow !== false ? new Date(Date.now() + minutes * 60 * 1000) : null;
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        masterAccessAllowed: allow !== false,
        masterAccessExpiresAt: expiresAt
      }
    });
    res.json({
      success: true,
      masterAccessAllowed: updated.masterAccessAllowed,
      masterAccessExpiresAt: updated.masterAccessExpiresAt,
      message: updated.masterAccessAllowed
        ? `🔑 વિદ્યાર્થી (${updated.name}) માટે ${minutes} મિનિટ માટે Master PIN Access મંજૂર થયો!`
        : `🔒 વિદ્યાર્થી (${updated.name}) નો Master PIN Access રદ કરવામાં આવ્યો.`
    });
  } catch (err) {
    console.error('Grant Master Access Error:', err);
    res.status(500).json({ error: 'Master Access સેટ કરવામાં ભૂલ આવી.' });
  }
});

// ─── POST /api/teacher/grant-master-by-mobile ────────────────
// Grant Master Access directly by mobile number (even if new student)
router.post('/grant-master-by-mobile', authMiddleware, teacherOnly, async (req, res) => {
  const { mobile, name = 'Student', minutes = 60 } = req.body;
  if (!mobile) return res.status(400).json({ error: 'મોબાઈલ નંબર જરૂરી છે.' });
  try {
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    const updated = await prisma.student.upsert({
      where: { mobile: String(mobile).trim() },
      update: {
        masterAccessAllowed: true,
        masterAccessExpiresAt: expiresAt
      },
      create: {
        mobile: String(mobile).trim(),
        name: String(name).trim() || 'Student',
        masterAccessAllowed: true,
        masterAccessExpiresAt: expiresAt
      }
    });
    res.json({
      success: true,
      message: `🔑 ${updated.mobile} (${updated.name}) માટે ${minutes} મિનિટ માટે Master PIN (191219) Access સક્રિય થયો!`
    });
  } catch (err) {
    console.error('Grant Master By Mobile Error:', err);
    res.status(500).json({ error: 'Master Access સેટ કરવામાં ભૂલ આવી.' });
  }
});

// ─── POST /api/teacher/student/:id/reset-session ────────────
// Unlock student session (fixes single-device stuck login + clears OTP lock)
router.post('/student/:id/reset-session', authMiddleware, teacherOnly, async (req, res) => {
  const studentId = parseInt(req.params.id);
  try {
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { currentSessionId: null }
    });
    // Also clear old OTP rate-limiting records so student can request OTP immediately
    const cleanMob = cleanIndianMobile(updated.mobile);
    await prisma.oTPSession.deleteMany({
      where: { mobile: { in: [updated.mobile, cleanMob] } }
    });
    res.json({
      success: true,
      message: `✅ વિદ્યાર્થી (${updated.name}) નું સેશન અને OTP લિમિટ અનલોક થઈ ગઈ છે. હવે વિદ્યાર્થી તરત જ લોગિન કરી શકશે.`
    });
  } catch (err) {
    console.error('Reset Session Error:', err);
    res.status(500).json({ error: 'સેશન રીસેટ કરવામાં ભૂલ આવી.' });
  }
});

// ─── POST /api/teacher/student/:id/reset-otp ────────────────
// Explicitly clear OTP attempt limit for student by ID
router.post('/student/:id/reset-otp', authMiddleware, teacherOnly, async (req, res) => {
  const studentId = parseInt(req.params.id);
  try {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ error: 'વિદ્યાર્થી મળ્યો નથી.' });

    const cleanMob = cleanIndianMobile(student.mobile);
    const deleted = await prisma.oTPSession.deleteMany({
      where: { mobile: { in: [student.mobile, cleanMob] } }
    });

    res.json({
      success: true,
      message: `🔄 વિદ્યાર્થી (${student.name}) ની OTP મર્યાદા રીસેટ થઈ ગઈ છે (${deleted.count} OTP રેકોર્ડ્સ ક્લિયર થયા). હવે વિદ્યાર્થી તરત નવો OTP મેળવી શકશે.`
    });
  } catch (err) {
    console.error('Reset OTP Error:', err);
    res.status(500).json({ error: 'OTP રીસેટ કરવામાં ક્ષતિ આવી.' });
  }
});

// ─── POST /api/teacher/reset-otp-by-mobile ──────────────────
// Explicitly clear OTP attempt limit by raw mobile number
router.post('/reset-otp-by-mobile', authMiddleware, teacherOnly, async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: 'મોબાઈલ નંબર જરૂરી છે.' });
  try {
    const cleanMob = cleanIndianMobile(mobile);
    const deleted = await prisma.oTPSession.deleteMany({
      where: { mobile: { in: [String(mobile).trim(), cleanMob] } }
    });
    res.json({
      success: true,
      message: `🔄 મોબાઈલ (+91 ${cleanMob}) ની OTP મર્યાદા રીસેટ થઈ ગઈ છે. હવે નવો OTP તરત જ જશે.`
    });
  } catch (err) {
    console.error('Reset OTP By Mobile Error:', err);
    res.status(500).json({ error: 'OTP રીસેટ કરવામાં ક્ષતિ આવી.' });
  }
});

// ─── DELETE /api/teacher/student/:id ─────────────────────────
// Delete student and their submissions
router.delete('/student/:id', authMiddleware, teacherOnly, async (req, res) => {
  const studentId = parseInt(req.params.id);
  try {
    // Delete associated submissions first
    await prisma.submission.deleteMany({
      where: { studentId }
    });

    const deleted = await prisma.student.delete({
      where: { id: studentId }
    });

    res.json({
      success: true,
      message: `🗑️ વિદ્યાર્થી (${deleted.name}) અને તેનો ડેટા સફળતાપૂર્વક ડિલીટ થઈ ગયો!`
    });
  } catch (err) {
    console.error('Delete Student Error:', err);
    res.status(500).json({ error: 'વિદ્યાર્થી ડિલીટ કરવામાં ક્ષતિ આવી.' });
  }
});

// ─── POST /api/teacher/broadcast-whatsapp ───────────────────
// Automated 1-Click Background Cloud WhatsApp Broadcast to ALL students
router.post('/broadcast-whatsapp', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode, messages } = req.body;
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'મોકલવા માટે કોઈ વિદ્યાર્થીઓની યાદી નથી.' });
    }

    const whatsappApiUrl = process.env.WHATSAPP_API_URL || null;
    const whatsappApiKey = process.env.WHATSAPP_API_KEY || null;

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Send messages in background (or log if in dev / pending API key)
    for (const item of messages) {
      const { mobile, message, studentName } = item;
      try {
        if (whatsappApiUrl && whatsappApiKey) {
          // Cloud API Request (UltraMsg / Fast2SMS / AISensy / WATI / Meta Cloud API)
          const response = await fetch(whatsappApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${whatsappApiKey}`
            },
            body: JSON.stringify({
              to: mobile.startsWith('91') ? mobile : `91${mobile}`,
              message: message,
              phone: mobile
            })
          });
          const data = await response.json();
          results.push({ mobile, studentName, status: 'SENT', response: data });
          successCount++;
        } else {
          // Simulation / Ready for Gateway: Log message
          console.log(`[WHATSAPP 1-CLICK API] 📲 To: ${mobile} (${studentName})\n${message}\n---`);
          results.push({ mobile, studentName, status: 'DELIVERED_DEV' });
          successCount++;
        }
      } catch (err) {
        console.error(`WhatsApp send error to ${mobile}:`, err.message);
        results.push({ mobile, studentName, status: 'FAILED', error: err.message });
        failedCount++;
      }
    }

    res.json({
      success: true,
      total: messages.length,
      sentCount: successCount,
      failedCount: failedCount,
      hasLiveGateway: Boolean(whatsappApiUrl && whatsappApiKey),
      message: `🎉 ${successCount} વિદ્યાર્થીઓને પરિણામ આપોઆપ WhatsApp પર મોકલાઈ ગયું છે!`
    });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'WhatsApp બ્રોડકાસ્ટ કરવામાં સર્વર ક્ષતિ.' });
  }
});

// ─── GET /api/teacher/live-otps ──────────────────────────────
// Get recent active OTPs for teacher reference (last 15 mins)
router.get('/live-otps', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const otps = await prisma.oTPSession.findMany({
      where: {
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(otps);
  } catch (err) {
    res.status(500).json({ error: 'Live OTPs fetch ભૂલ.' });
  }
});

// ─── POST /api/teacher/clean-test-data ────────────────────────
// 🧹 Secure Production Launch: 1-Click Wipe of Testing Submissions & Dummy Data
router.post('/clean-test-data', authMiddleware, teacherOnly, async (req, res) => {
  const { wipeSubmissions = true, wipeStudents = false, wipeOtps = true, wipeQuestions = false } = req.body;
  try {
    const results = {};

    // 1. Delete testing submissions
    if (wipeSubmissions) {
      const deletedSubs = await prisma.submission.deleteMany({});
      results.deletedSubmissions = deletedSubs.count;
    }

    // 2. Delete OTP Sessions
    if (wipeOtps) {
      const deletedOtps = await prisma.oTPSession.deleteMany({});
      results.deletedOtps = deletedOtps.count;
    }

    // 3. Delete Dummy Students (optional)
    if (wipeStudents) {
      const deletedStudents = await prisma.student.deleteMany({});
      results.deletedStudents = deletedStudents.count;
    }

    // 4. Delete Questions (optional)
    if (wipeQuestions) {
      const deletedQs = await prisma.question.deleteMany({});
      results.deletedQuestions = deletedQs.count;
    }

    res.json({
      success: true,
      message: '✅ ટેસ્ટિંગ ડેટા સફળતાપૂર્વક સાફ થઈ ગયો છે! પ્લેટફોર્મ હવે લાઈવ પ્રોડક્શન માટે ૧૦૦% તૈયાર છે.',
      stats: results
    });
  } catch (err) {
    console.error('Clean test data error:', err);
    res.status(500).json({ error: 'ડેટા સાફ કરવામાં ક્ષતિ આવી.' });
  }
});

// ─── POST /api/teacher/send-daily-report ──────────────────────
// 📊 On-demand manual trigger to send daily WhatsApp summary to director
const { sendWhatsAppDailyReport } = require('../services/whatsappService');

router.post('/send-daily-report', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const adminMobile = req.body?.mobile || process.env.TEACHER_ADMIN_MOBILE || '8200405300';
    const result = await sendWhatsAppDailyReport(adminMobile);
    if (result.success) {
      return res.json({ success: true, message: result.message });
    } else {
      return res.status(400).json({ error: result.error || 'રિપોર્ટ મોકલવામાં ભૂલ.' });
    }
  } catch (err) {
    console.error('Manual Daily Report error:', err);
    res.status(500).json({ error: 'સર્વર એરર: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 🎓 TRINETRA ENROLLED STUDENTS (BATCH & ADMISSION CONTROL)
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/teacher/enrolled-students ─────────────────────────
// Fetch list of enrolled Trinetra students
router.get('/enrolled-students', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { q } = req.query;
    let where = {};
    if (q && q.trim()) {
      const searchTerm = q.trim();
      where = {
        OR: [
          { mobile: { contains: searchTerm } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { batch: { contains: searchTerm, mode: 'insensitive' } }
        ]
      };
    }
    const students = await prisma.enrolledStudent.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    const totalCount = await prisma.enrolledStudent.count();
    res.json({ success: true, students, totalCount });
  } catch (err) {
    console.error('Fetch Enrolled Students Error:', err);
    res.status(500).json({ error: 'એડમિશન વિદ્યાર્થીઓ લોડ કરવામાં ભૂલ.' });
  }
});

// ─── GET /api/teacher/enrolled-students-otps ─────────────────
// Fetch enrolled admission students with their latest OTP sessions, login status & test counts
router.get('/enrolled-students-otps', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { q } = req.query;
    let enrolledWhere = {};
    if (q && q.trim()) {
      const s = q.trim();
      enrolledWhere = {
        OR: [
          { mobile: { contains: s } },
          { name: { contains: s, mode: 'insensitive' } },
          { batch: { contains: s, mode: 'insensitive' } }
        ]
      };
    }

    const enrolledList = await prisma.enrolledStudent.findMany({
      where: enrolledWhere,
      orderBy: { createdAt: 'desc' }
    });

    if (enrolledList.length === 0) {
      return res.json({ success: true, students: [], totalCount: 0 });
    }

    // Build variant mobiles map
    const cleanMobMap = {};
    const allMobilesSet = new Set();
    enrolledList.forEach(e => {
      const raw = String(e.mobile || '').trim();
      const clean = cleanIndianMobile(raw);
      const variants = [raw, clean, `91${clean}`, `+91${clean}`, `+91 ${clean}`];
      cleanMobMap[e.id] = variants;
      variants.forEach(v => allMobilesSet.add(v));
    });

    const allMobiles = Array.from(allMobilesSet);

    // Fetch OTP sessions
    const otpSessions = await prisma.oTPSession.findMany({
      where: {
        mobile: { in: allMobiles }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch registered student profiles with submissions count
    const studentRecords = await prisma.student.findMany({
      where: {
        mobile: { in: allMobiles }
      },
      include: {
        _count: { select: { submissions: true } }
      }
    });

    const enriched = enrolledList.map(enrolled => {
      const variants = cleanMobMap[enrolled.id] || [];
      const matchedOtps = otpSessions.filter(o => variants.includes(o.mobile));
      const latestOtp = matchedOtps.length > 0 ? matchedOtps[0] : null;
      const matchedStudent = studentRecords.find(s => variants.includes(s.mobile));

      return {
        id: enrolled.id,
        name: enrolled.name || matchedStudent?.name || 'વિદ્યાર્થી',
        mobile: enrolled.mobile,
        batch: enrolled.batch || 'Trinetra Regular',
        isActive: enrolled.isActive,
        createdAt: enrolled.createdAt,
        registeredStudentId: matchedStudent?.id || null,
        isRegistered: !!matchedStudent,
        lastLoginAt: matchedStudent?.lastLoginAt || null,
        currentSessionId: matchedStudent?.currentSessionId || null,
        masterAccessAllowed: matchedStudent?.masterAccessAllowed || false,
        masterAccessExpiresAt: matchedStudent?.masterAccessExpiresAt || null,
        submissionsCount: matchedStudent?._count?.submissions || 0,
        latestOtp: latestOtp ? {
          otp: latestOtp.otp,
          expiresAt: latestOtp.expiresAt,
          used: latestOtp.used,
          createdAt: latestOtp.createdAt,
          isExpired: new Date(latestOtp.expiresAt) < new Date(),
        } : null,
        totalOtpRequests: matchedOtps.length
      };
    });

    const totalEnrolled = await prisma.enrolledStudent.count();
    res.json({ success: true, students: enriched, totalCount: totalEnrolled });
  } catch (err) {
    console.error('Fetch Enrolled OTPs Error:', err);
    res.status(500).json({ error: 'એડમિશન વિદ્યાર્થીઓના OTP ડેટા લોડ કરવામાં ભૂલ.' });
  }
});

// ─── POST /api/teacher/enrolled-students/bulk ──────────────────
// Bulk import enrolled students from Excel or CSV
router.post('/enrolled-students/bulk', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { students, defaultBatch = 'Trinetra Regular' } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'વિદ્યાર્થીઓની યાદી (array) જરૂરી છે.' });
    }

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of students) {
      const rawMobile = item.mobile || item.phone || item.Mobile || item.Phone || item['મોબાઈલ'] || item['મોબાઇલ'] || '';
      const clean = String(rawMobile).replace(/\D/g, '').slice(-10);

      // Validate 10-digit Indian mobile format (starts with 6-9)
      if (clean.length === 10 && /^[6-9]/.test(clean)) {
        const studentName = (item.name || item.Name || item['વિદ્યાર્થીનું નામ'] || item['નામ'] || '').trim() || null;
        const studentBatch = (item.batch || item.Batch || item['બેચ'] || defaultBatch || 'Trinetra Regular').trim();

        const existing = await prisma.enrolledStudent.findUnique({
          where: { mobile: clean }
        });

        if (existing) {
          await prisma.enrolledStudent.update({
            where: { mobile: clean },
            data: {
              name: studentName || existing.name,
              batch: studentBatch || existing.batch,
              isActive: true,
              updatedAt: new Date()
            }
          });
          updatedCount++;
        } else {
          await prisma.enrolledStudent.create({
            data: {
              mobile: clean,
              name: studentName,
              batch: studentBatch,
              isActive: true
            }
          });
          addedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    const totalEnrolled = await prisma.enrolledStudent.count();

    res.json({
      success: true,
      message: `✅ એડમિશન પ્રક્રિયા પૂર્ણ: ${addedCount} નવા ઉમેરાયા, ${updatedCount} અપડેટ થયા${skippedCount > 0 ? `, ${skippedCount} અમાન્ય નંબર છોડી દીધા` : ''}!`,
      addedCount,
      updatedCount,
      skippedCount,
      totalEnrolled
    });
  } catch (err) {
    console.error('Bulk Import Enrolled Students Error:', err);
    res.status(500).json({ error: 'એક્સેલ ડેટા ઉમેરવામાં ભૂલ આવી: ' + err.message });
  }
});

// ─── POST /api/teacher/enrolled-students ───────────────────────
// Add single enrolled student
router.post('/enrolled-students', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { mobile, name, batch = 'Trinetra Regular' } = req.body;
    const clean = String(mobile || '').replace(/\D/g, '').slice(-10);

    if (clean.length !== 10 || !/^[6-9]/.test(clean)) {
      return res.status(400).json({ error: 'માન્ય ૧૦ આંકડાનો ભારતીય મોબાઈલ નંબર દાખલ કરો.' });
    }

    const record = await prisma.enrolledStudent.upsert({
      where: { mobile: clean },
      update: {
        name: (name || '').trim() || undefined,
        batch: (batch || 'Trinetra Regular').trim(),
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        mobile: clean,
        name: (name || '').trim() || null,
        batch: (batch || 'Trinetra Regular').trim(),
        isActive: true
      }
    });

    res.json({
      success: true,
      student: record,
      message: `✅ મોબાઈલ ${clean} સફળતાપૂર્વક ત્રિનેત્ર એડમિશન લિસ્ટમાં ઉમેરાઈ ગયો!`
    });
  } catch (err) {
    console.error('Add Single Enrolled Student Error:', err);
    res.status(500).json({ error: 'વિદ્યાર્થી ઉમેરવામાં ભૂલ આવી.' });
  }
});

// ─── DELETE /api/teacher/enrolled-students/:id ──────────────────
// Remove single student from enrolled list
router.delete('/enrolled-students/:id', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.enrolledStudent.delete({ where: { id } });
    res.json({ success: true, message: 'વિદ્યાર્થી એડમિશન લિસ્ટમાંથી દૂર કરવામાં આવ્યો.' });
  } catch (err) {
    console.error('Delete Enrolled Student Error:', err);
    res.status(500).json({ error: 'વિદ્યાર્થી દૂર કરવામાં ભૂલ આવી.' });
  }
});

// ─── DELETE /api/teacher/enrolled-students ──────────────────────
// Clear all enrolled students
router.delete('/enrolled-students', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const deleted = await prisma.enrolledStudent.deleteMany({});
    res.json({ success: true, message: `🗑️ ત્રિનેત્ર એડમિશન લિસ્ટના તમામ (${deleted.count}) રેકોર્ડ્સ સાફ થઈ ગયા.` });
  } catch (err) {
    console.error('Clear All Enrolled Students Error:', err);
    res.status(500).json({ error: 'લિસ્ટ સાફ કરવામાં ભૂલ આવી.' });
  }
});

// ─── GET /api/teacher/settings/otp-mode ─────────────────────────
// Fetch current student login OTP delivery mode ('WHATSAPP' | 'SCREEN')
router.get('/settings/otp-mode', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { getSetting } = require('../services/settingsService');
    const otpMode = await getSetting('student_otp_mode', 'WHATSAPP');
    res.json({ success: true, otpMode });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch OTP mode' });
  }
});

// ─── POST /api/teacher/settings/otp-mode ────────────────────────
// Update student login OTP delivery mode ('WHATSAPP' | 'SCREEN')
router.post('/settings/otp-mode', authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { otpMode } = req.body;
    if (!['WHATSAPP', 'SCREEN'].includes(otpMode)) {
      return res.status(400).json({ error: 'અમાન્ય OTP મોડ. માત્ર WHATSAPP અથવા SCREEN માન્ય છે.' });
    }
    const { setSetting } = require('../services/settingsService');
    await setSetting('student_otp_mode', otpMode);
    res.json({
      success: true,
      otpMode,
      message: otpMode === 'WHATSAPP'
        ? '✅ વિદ્યાર્થીઓને લૉગિન OTP WhatsApp પર મોકલવાનું સેટ થઈ ગયું છે.'
        : '✅ વિદ્યાર્થીઓને લૉગિન OTP સીધો સ્ક્રીન પર દર્શાવવાનું સેટ થઈ ગયું છે.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update OTP mode: ' + err.message });
  }
});

module.exports = router;

