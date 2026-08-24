const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, teacherOnly } = require('../middleware/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

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
    csv += 'ક્રમ,વિદ્યાર્થીનું નામ,મોબાઈલ,MCQ સ્કોર,કુલ MCQ,ટકાવારી,શિક્ષક Marks,Comment,સબમિશન સમય\n';

    submissions.forEach((sub, idx) => {
      const pct = sub.totalMCQ > 0
        ? Math.round((sub.mcqScore / sub.totalMCQ) * 100)
        : 'N/A';
      const time = new Date(sub.submittedAt).toLocaleString('gu-IN');

      csv += `${idx + 1},"${sub.student.name}","${sub.student.mobile}",${sub.mcqScore ?? ''},${sub.totalMCQ ?? ''},${pct},"${sub.teacherMarks || ''}","${sub.remarks || ''}","${time}"\n`;
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
      message: `🔑 ${updated.mobile} (${updated.name}) માટે ${minutes} મિનિટ માટે Master PIN (820040) Access સક્રિય થયો!`
    });
  } catch (err) {
    console.error('Grant Master By Mobile Error:', err);
    res.status(500).json({ error: 'Master Access સેટ કરવામાં ભૂલ આવી.' });
  }
});

// ─── POST /api/teacher/student/:id/reset-session ────────────
// Unlock student session (fixes single-device stuck login)
router.post('/student/:id/reset-session', authMiddleware, teacherOnly, async (req, res) => {
  const studentId = parseInt(req.params.id);
  try {
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { currentSessionId: null }
    });
    res.json({
      success: true,
      message: `✅ વિદ્યાર્થી (${updated.name}) નું સેશન રીસેટ / અનલોક થઈ ગયું છે. હવે વિદ્યાર્થી તરત જ લોગિન કરી શકશે.`
    });
  } catch (err) {
    console.error('Reset Session Error:', err);
    res.status(500).json({ error: 'સેશન રીસેટ કરવામાં ભૂલ આવી.' });
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

module.exports = router;
