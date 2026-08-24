const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Helper: Generate 6-digit OTP ────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Smart Indian Mobile & Advanced Anti-Fake Combinations Filter ──
function validateIndianMobile(rawMobile) {
  if (!rawMobile) return { isValid: false, message: 'કૃપા કરીને ૧૦ આંકડાનો મોબાઈલ નંબર દાખલ કરો.' };
  const cleaned = String(rawMobile).replace(/\D/g, '').replace(/^(91|0)/, '');
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

// ─── POST /api/auth/send-otp ──────────────────────────────────
// Send OTP to student mobile with strict validation and 60s cooldown
router.post('/send-otp', async (req, res) => {
  const { mobile, name } = req.body;

  const validation = validateIndianMobile(mobile);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.message });
  }
  const nameVal = validateStudentName(name);
  if (!nameVal.isValid) {
    return res.status(400).json({ error: nameVal.message });
  }

  const cleanMobile = validation.cleaned;

  // Rate Limiting: Check if an OTP was sent in last 45 seconds to this mobile
  const recentOtp = await prisma.oTPSession.findFirst({
    where: {
      mobile: cleanMobile,
      createdAt: { gt: new Date(Date.now() - 45 * 1000) }
    }
  });

  if (recentOtp) {
    return res.status(429).json({ error: 'થોડીવાર રાહ જુઓ. તમે 45 સેકન્ડ પછી જ નવો OTP મંગાવી શકો છો.' });
  }

  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Invalidate old OTPs for this mobile
    await prisma.oTPSession.updateMany({
      where: { mobile, used: false },
      data: { used: true }
    });

    // Create new OTP session
    await prisma.oTPSession.create({
      data: { mobile, otp, expiresAt }
    });

    // In DEV mode: log OTP to console
    if (process.env.OTP_MODE === 'dev') {
      console.log(`\n📱 OTP for ${mobile} (${name}): ${otp}\n`);
    }
    // TODO: In production, send via MSG91/Twilio SMS API

    res.json({ 
      success: true, 
      message: `OTP ${process.env.OTP_MODE === 'dev' ? otp : 'sent'} to ${mobile}`,
      devOtp: process.env.OTP_MODE === 'dev' ? otp : undefined
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ error: 'OTP મોકલવામાં ભૂલ.' });
  }
});

// ─── POST /api/auth/verify-otp ────────────────────────────────
// Verify OTP → create/find student → return JWT
router.post('/verify-otp', async (req, res) => {
  const { mobile, name, otp } = req.body;

  if (!mobile || !otp || !name) {
    return res.status(400).json({ error: 'mobile, name અને otp જરૂરી છે.' });
  }

  try {
    // Check Master PIN (820040) or Find valid OTP Session
    const MASTER_PIN = process.env.MASTER_PIN || '820040';
    const isMasterOTP = String(otp).trim() === MASTER_PIN;

    let otpSession = null;
    if (isMasterOTP) {
      // Check if teacher has granted Master PIN access to this student mobile
      const allowedStudent = await prisma.student.findFirst({
        where: {
          mobile,
          OR: [
            { masterAccessAllowed: true },
            { masterAccessExpiresAt: { gt: new Date() } }
          ]
        }
      });

      if (!allowedStudent) {
        return res.status(403).json({
          error: '❌ આ મોબાઈલ નંબર માટે શિક્ષક દ્વારા Master PIN Access સક્રિય કરવામાં આવ્યો નથી. કૃપા કરીને શિક્ષકનો સંપર્ક કરો.'
        });
      }

      // Automatically consume / reset one-time master access after successful login
      await prisma.student.update({
        where: { mobile },
        data: { masterAccessAllowed: false, masterAccessExpiresAt: null }
      });
    } else {
      otpSession = await prisma.oTPSession.findFirst({
        where: {
          mobile,
          otp,
          used: false,
          expiresAt: { gt: new Date() }
        }
      });

      if (!otpSession) {
        return res.status(400).json({ error: '❌ OTP ખોટો છે અથવા સમય પૂરો થઈ ગયો છે.' });
      }

      // Mark OTP as used
      await prisma.oTPSession.update({
        where: { id: otpSession.id },
        data: { used: true }
      });
    }

    // Generate new unique Session ID for Single Device Login
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Upsert student (create if not exists) with new sessionId & login timestamp
    const student = await prisma.student.upsert({
      where: { mobile },
      update: { name, currentSessionId: sessionId, lastLoginAt: new Date() },
      create: { mobile, name, currentSessionId: sessionId, lastLoginAt: new Date() }
    });

    // Generate JWT with embedded sessionId
    const token = jwt.sign(
      { id: student.id, mobile: student.mobile, name: student.name, sessionId, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      sessionId,
      student: { id: student.id, name: student.name, mobile: student.mobile }
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: 'OTP ચકાસવામાં ભૂલ.' });
  }
});

// ─── GET /api/auth/check-session ──────────────────────────────
// Check if the current student session is still valid (not logged in elsewhere)
router.get('/check-session', require('../middleware/authMiddleware').authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.json({ success: true, valid: true, user: req.user });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, mobile: true, currentSessionId: true, lastLoginAt: true }
    });

    if (!student) {
      return res.status(401).json({ code: 'STUDENT_NOT_FOUND', error: 'વિદ્યાર્થી એકાઉન્ટ મળ્યું નથી.' });
    }

    if (req.user.sessionId && student.currentSessionId && student.currentSessionId !== req.user.sessionId) {
      return res.status(401).json({
        code: 'SESSION_TERMINATED',
        error: '⚠️ તમારું એકાઉન્ટ અન્ય ડિવાઇસમાં લોગિન થયું છે. સુરક્ષા માટે આ ડિવાઇસમાંથી લોગઆઉટ કરવામાં આવ્યું છે.'
      });
    }

    res.json({
      success: true,
      valid: true,
      student: { id: student.id, name: student.name, mobile: student.mobile }
    });
  } catch (err) {
    res.status(500).json({ error: 'Session check failed' });
  }
});

// ─── Failed Attempts Tracker & Lockout ───────────────────────
const failedAttemptsMap = new Map(); // username -> { count, lockUntil }
const TEACHER_ADMIN_MOBILE = '8200405300';

// ─── POST /api/auth/teacher-request-otp (Step 1: Validate Credentials + PIN -> Send 2FA OTP) ──
router.post('/teacher-request-otp', async (req, res) => {
  const { username, password, masterPin } = req.body;

  const validUsername = process.env.TEACHER_USERNAME || 'admin@123';
  const validPassword = process.env.TEACHER_PASSWORD || 'janvi@123';
  const validMasterPin = process.env.TEACHER_MASTER_PIN || '820040';

  const userKey = (username || 'unknown').toLowerCase();
  const attemptInfo = failedAttemptsMap.get(userKey) || { count: 0, lockUntil: 0 };

  // Check if currently locked
  if (attemptInfo.lockUntil > Date.now()) {
    const remainingMins = Math.ceil((attemptInfo.lockUntil - Date.now()) / (60 * 1000));
    return res.status(429).json({
      error: `🔒 સુરક્ષા કારણોસર એડમિન લોગિન ${remainingMins} મિનિટ માટે લોક કરવામાં આવ્યું છે. થોડીવાર પછી પ્રયાસ કરો.`
    });
  }

  // Validate Credentials + Master PIN
  const isUserValid = username === validUsername;
  const isPassValid = password === validPassword;
  const isPinValid  = String(masterPin || '').trim() === validMasterPin;

  if (!isUserValid || !isPassValid || !isPinValid) {
    const newCount = attemptInfo.count + 1;
    if (newCount >= 3) {
      failedAttemptsMap.set(userKey, { count: newCount, lockUntil: Date.now() + 15 * 60 * 1000 });
      return res.status(429).json({
        error: '🚨 3 ખોટા પ્રયાસો થયા છે! સુરક્ષા માટે એડમિન પોર્ટલ 15 મિનિટ માટે લોક કરવામાં આવ્યું છે.'
      });
    } else {
      failedAttemptsMap.set(userKey, { count: newCount, lockUntil: 0 });
      const attemptsLeft = 3 - newCount;
      let errorMsg = '❌ ખોટું Username, Password અથવા Master PIN!';
      if (!isPinValid && isUserValid && isPassValid) {
        errorMsg = '❌ 6-અંકનો સિક્રેટ Master PIN ખોટો છે!';
      }
      return res.status(401).json({
        error: `${errorMsg} (બાકી રહેલા પ્રયાસો: ${attemptsLeft})`
      });
    }
  }

  // Reset failed attempts on valid step 1
  failedAttemptsMap.delete(userKey);

  try {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // Invalidate old OTPs for admin
    await prisma.oTPSession.updateMany({
      where: { mobile: TEACHER_ADMIN_MOBILE, used: false },
      data: { used: true }
    });

    // Create 2FA OTP session
    await prisma.oTPSession.create({
      data: { mobile: TEACHER_ADMIN_MOBILE, otp, expiresAt }
    });

    if (process.env.OTP_MODE === 'dev') {
      console.log(`\n👑 [ADMIN 2FA OTP] for Director ${TEACHER_ADMIN_MOBILE} (${username}): ${otp}\n`);
    }

    res.json({
      success: true,
      message: `2FA Security OTP ડિરેક્ટર મોબાઈલ ${TEACHER_ADMIN_MOBILE} પર મોકલ્યો છે.`,
      adminMobile: TEACHER_ADMIN_MOBILE,
      devOtp: process.env.OTP_MODE === 'dev' ? otp : undefined
    });
  } catch (err) {
    console.error('Teacher 2FA Request Error:', err);
    res.status(500).json({ error: '2FA OTP મોકલવામાં ભૂલ.' });
  }
});

// ─── POST /api/auth/teacher-verify-otp (Step 2: Verify 2FA OTP -> Grant Access) ──
router.post('/teacher-verify-otp', async (req, res) => {
  const { username, otp } = req.body;

  if (!username || !otp) {
    return res.status(400).json({ error: 'Username અને OTP જરૂરી છે.' });
  }

  try {
    const otpSession = await prisma.oTPSession.findFirst({
      where: {
        mobile: TEACHER_ADMIN_MOBILE,
        otp: String(otp).trim(),
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!otpSession) {
      return res.status(400).json({ error: '❌ એડમિન 2FA OTP ખોટો છે અથવા સમય સમાપ્ત થઈ ગયો છે.' });
    }

    // Mark OTP as used
    await prisma.oTPSession.update({
      where: { id: otpSession.id },
      data: { used: true }
    });

    const token = jwt.sign(
      { role: 'teacher', username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      teacher: { username }
    });
  } catch (err) {
    console.error('Teacher 2FA Verify Error:', err);
    res.status(500).json({ error: '2FA OTP ચકાસણીમાં ભૂલ.' });
  }
});

module.exports = router;

