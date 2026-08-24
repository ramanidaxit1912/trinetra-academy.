const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, mobile, name, sessionId, role: 'student'|'teacher' }

    // ── Single Device Login Validation for Students ──
    if (decoded.role === 'student') {
      const student = await prisma.student.findUnique({
        where: { id: decoded.id },
        select: { id: true, currentSessionId: true, name: true, mobile: true }
      });

      if (!student) {
        return res.status(401).json({ code: 'STUDENT_NOT_FOUND', error: 'વિદ્યાર્થી એકાઉન્ટ મળ્યું નથી.' });
      }

      // If student has a currentSessionId recorded and it doesn't match this token's sessionId
      if (decoded.sessionId && student.currentSessionId && student.currentSessionId !== decoded.sessionId) {
        return res.status(401).json({
          code: 'SESSION_TERMINATED',
          error: '⚠️ તમારું એકાઉન્ટ અન્ય ડિવાઇસમાં લોગિન થયું છે. સુરક્ષા માટે આ ડિવાઇસમાંથી લોગઆઉટ કરવામાં આવ્યું છે.'
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function teacherOnly(req, res, next) {
  if (req.user && req.user.role === 'teacher') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Teacher only.' });
}

module.exports = { authMiddleware, teacherOnly };

