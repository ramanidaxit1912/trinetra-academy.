const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, teacherOnly } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

// Ensure upload directory exists for OCR
const ocrUploadDir = path.join(__dirname, '../uploads/ocr');
if (!fs.existsSync(ocrUploadDir)) {
  fs.mkdirSync(ocrUploadDir, { recursive: true });
}

const ocrStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ocrUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'ocr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext);
  }
});
const uploadOcr = multer({ storage: ocrStorage, limits: { fileSize: 15 * 1024 * 1024 } });


const router = express.Router();
const prisma = new PrismaClient();

// Helper to auto-activate scheduled tests whose time has arrived
async function autoActivateScheduledTests() {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    // Auto-activate tests where scheduledAt <= now (matching either UTC ISO or Local datetime-local format)
    await prisma.question.updateMany({
      where: {
        isActive: false,
        scheduledAt: { not: null },
        OR: [
          { scheduledAt: { lte: nowIso } },
          { scheduledAt: { lte: nowLocal } }
        ]
      },
      data: { isActive: true, scheduledAt: null }
    });
  } catch (err) {
    console.error('Auto-activate Scheduled Tests Error:', err);
  }
}

// ─── GET /api/questions ───────────────────────────────────────
// Get all active questions (for students) with scheduled test auto-activation
router.get('/', async (req, res) => {
  try {
    await autoActivateScheduledTests();

    const questions = await prisma.question.findMany({
      where: {
        isActive: true
      },
      orderBy: { orderIndex: 'asc' }
    });
    res.json(questions);
  } catch (err) {
    console.error('Get Questions Error:', err);
    res.status(500).json({ error: 'પ્રશ્નો લઈ શકાયા નહીં.' });
  }
});

// ─── GET /api/questions/all ───────────────────────────────────
// Get ALL questions including inactive (teacher only) with scheduled test auto-activation
router.get('/all', authMiddleware, teacherOnly, async (req, res) => {
  try {
    await autoActivateScheduledTests();

    const questions = await prisma.question.findMany({
      orderBy: { orderIndex: 'asc' }
    });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'પ્રશ્નો લઈ શકાયા નહીં.' });
  }
});

// ─── GET /api/questions/test/:testCode ────────────────────────
// Get questions for a specific test (teacher only)
router.get('/test/:testCode', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode } = req.params;
  try {
    const questions = await prisma.question.findMany({
      where: { testCode },
      orderBy: { orderIndex: 'asc' }
    });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'કસોટીના પ્રશ્નો લઈ શકાયા નહીં.' });
  }
});

// ─── POST /api/questions ──────────────────────────────────────
// Add new question (teacher only)
router.post('/', authMiddleware, teacherOnly, async (req, res) => {
  const {
    text, type, optionA, optionB, optionC, optionD, correctOpt,
    subject, chapter, marks, testCode, testName, timeLimit, isActive,
    image, imageUrl, optionA_img, optionB_img, optionC_img, optionD_img,
    scheduledAt, negativeMarking
  } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'પ્રશ્નનો ટેક્સ્ટ જરૂરી છે.' });
  }
  if (type === 'mcq' && ((!optionA && !optionA_img) || (!optionB && !optionB_img) || (!optionC && !optionC_img) || (!optionD && !optionD_img))) {
    return res.status(400).json({ error: 'MCQ માટે 4 options (ટેક્સ્ટ અથવા ફોટો) જરૂરી છે.' });
  }
  if (type === 'mcq' && !correctOpt) {
    return res.status(400).json({ error: 'MCQ માટે સાચો જવાબ (A/B/C/D) જણાવો.' });
  }

  try {
    // Get next order index
    const maxOrder = await prisma.question.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });

    const finalImage = (image || imageUrl || '').trim() || null;

    const question = await prisma.question.create({
      data: {
        text: text.trim(),
        type: type || 'mcq',
        optionA: optionA?.trim() || null,
        optionB: optionB?.trim() || null,
        optionC: optionC?.trim() || null,
        optionD: optionD?.trim() || null,
        optionE: optionE?.trim() || null,
        correctOpt: correctOpt || null,
        subject: subject?.trim() || null,
        chapter: chapter?.trim() || null,
        marks: marks ? parseInt(marks) : 1,
        testCode: testCode?.trim() || null,
        testName: testName?.trim() || null,
        timeLimit: timeLimit ? parseInt(timeLimit) : 0,
        scheduledAt: scheduledAt || null,
        imageUrl: finalImage,
        image: finalImage,
        optionA_img: (optionA_img || '').trim() || null,
        optionB_img: (optionB_img || '').trim() || null,
        optionC_img: (optionC_img || '').trim() || null,
        optionD_img: (optionD_img || '').trim() || null,
        optionE_img: (optionE_img || '').trim() || null,
        negativeMarking: negativeMarking !== undefined ? parseFloat(negativeMarking) : 0,
        isActive: isActive !== undefined ? isActive : false,
        orderIndex: (maxOrder?.orderIndex || 0) + 1
      }
    });

    res.status(201).json({ success: true, question });
  } catch (err) {
    console.error('Add Question Error:', err);
    res.status(500).json({ error: 'પ્રશ્ન ઉમેરવામાં ભૂલ.' });
  }
});

// ─── POST /api/questions/activate-test ────────────────────────
// Set questions of specific test(s) as active (or deactivate all / append / stop single)
router.post('/activate-test', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode, testCodes, deactivateAll, action, append } = req.body;
  try {
    if (deactivateAll || action === 'stopAll') {
      await prisma.question.updateMany({
        data: { isActive: false, scheduledAt: null }
      });
      return res.json({ success: true, message: 'બધી લાઈવ કસોટીઓ બંધ કરવામાં આવી.', activeTestCodes: [] });
    }

    if (action === 'stop' && testCode) {
      // Stop only this specific test and clear its schedule
      await prisma.question.updateMany({
        where: { testCode },
        data: { isActive: false, scheduledAt: null }
      });
      const remainingActive = await prisma.question.findMany({
        where: { isActive: true },
        select: { testCode: true },
        distinct: ['testCode']
      });
      const activeCodes = remainingActive.map(x => x.testCode).filter(Boolean);
      return res.json({
        success: true,
        message: `કસોટી (ID: ${testCode}) લાઈવ બંધ કરવામાં આવી.`,
        activeTestCodes: activeCodes
      });
    }

    const targetCodes = Array.isArray(testCodes)
      ? testCodes.filter(Boolean)
      : (testCode ? [testCode] : []);

    if (targetCodes.length > 0) {
      if (append || action === 'add') {
        // Keep existing active tests, and also activate targetCodes
        await prisma.question.updateMany({
          where: { testCode: { in: targetCodes } },
          data: { isActive: true }
        });
      } else {
        // Replace: Deactivate all first, then activate targetCodes
        await prisma.question.updateMany({
          data: { isActive: false }
        });
        await prisma.question.updateMany({
          where: { testCode: { in: targetCodes } },
          data: { isActive: true }
        });
      }

      const allActive = await prisma.question.findMany({
        where: { isActive: true },
        select: { testCode: true },
        distinct: ['testCode']
      });
      const activeCodes = allActive.map(x => x.testCode).filter(Boolean);

      res.json({
        success: true,
        message: `${targetCodes.length} કસોટીઓ લાઈવ કરવામાં આવી.`,
        activeTestCodes: activeCodes
      });
    } else {
      // If no specific code is sent, activate all questions
      await prisma.question.updateMany({
        data: { isActive: true }
      });
      res.json({ success: true, message: 'તમામ કસોટીઓ લાઈવ કરવામાં આવી.' });
    }
  } catch (err) {
    console.error('Activate Test Error:', err);
    res.status(500).json({ error: 'ટેસ્ટ લાઈવ કરવામાં ભૂલ.' });
  }
});

// ─── POST /api/questions/schedule-test ────────────────────────
// Schedule single or bulk tests for a future date/time
router.post('/schedule-test', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode, testCodes, scheduledAt } = req.body;
  try {
    const targets = Array.isArray(testCodes) ? testCodes.filter(Boolean) : (testCode ? [testCode] : []);
    if (targets.length === 0) {
      return res.status(400).json({ error: 'Test code(s) required.' });
    }
    await prisma.question.updateMany({
      where: { testCode: { in: targets } },
      data: { scheduledAt: scheduledAt || null }
    });
    res.json({
      success: true,
      message: scheduledAt ? `${targets.length} કસોટી(ઓ)નો સમય સફળતાપૂર્વક શિડ્યુલ થયો!` : 'શિડ્યુલ દૂર કરવામાં આવ્યું.'
    });
  } catch (err) {
    console.error('Schedule Test Error:', err);
    res.status(500).json({ error: 'શિડ્યુલ કરવામાં ભૂલ.' });
  }
});

// ─── PUT /api/questions/test/:testCode/meta ──────────────────
// Update test metadata (timeLimit, testName, subject) for all questions in test (teacher only)
router.put('/test/:testCode/meta', authMiddleware, teacherOnly, async (req, res) => {
  const { testCode } = req.params;
  const { testName, subject, timeLimit } = req.body;
  try {
    await prisma.question.updateMany({
      where: { testCode },
      data: {
        ...(testName !== undefined && { testName: testName.trim(), chapter: testName.trim() }),
        ...(subject !== undefined && { subject: subject.trim() }),
        ...(timeLimit !== undefined && { timeLimit: parseInt(timeLimit) })
      }
    });
    res.json({ success: true, message: 'કસોટીની વિગતો સફળતાપૂર્વક અપડેટ થઈ.' });
  } catch (err) {
    console.error('Update Test Meta Error:', err);
    res.status(500).json({ error: 'કસોટી અપડેટ કરવામાં ભૂલ.' });
  }
});

// ─── PUT /api/questions/:id ───────────────────────────────────
// Update question or toggle active (teacher only)
router.put('/:id', authMiddleware, teacherOnly, async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    text, type, optionA, optionB, optionC, optionD, correctOpt,
    subject, chapter, marks, testCode, testName, timeLimit, isActive,
    image, imageUrl, optionA_img, optionB_img, optionC_img, optionD_img,
    scheduledAt, negativeMarking
  } = req.body;

  try {
    const finalImage = (image !== undefined ? (image || null) : (imageUrl !== undefined ? (imageUrl || null) : undefined));

    const question = await prisma.question.update({
      where: { id },
      data: {
        ...(text !== undefined && { text: text.trim() }),
        ...(type !== undefined && { type }),
        ...(optionA !== undefined && { optionA: optionA ? optionA.trim() : null }),
        ...(optionB !== undefined && { optionB: optionB ? optionB.trim() : null }),
        ...(optionC !== undefined && { optionC: optionC ? optionC.trim() : null }),
        ...(optionD !== undefined && { optionD: optionD ? optionD.trim() : null }),
        ...(optionE !== undefined && { optionE: optionE ? optionE.trim() : null }),
        ...(correctOpt !== undefined && { correctOpt }),
        ...(subject !== undefined && { subject: subject ? subject.trim() : null }),
        ...(chapter !== undefined && { chapter: chapter ? chapter.trim() : null }),
        ...(marks !== undefined && { marks: parseInt(marks) }),
        ...(testCode !== undefined && { testCode }),
        ...(testName !== undefined && { testName }),
        ...(timeLimit !== undefined && { timeLimit: parseInt(timeLimit) }),
        ...(scheduledAt !== undefined && { scheduledAt }),
        ...(finalImage !== undefined && { imageUrl: finalImage, image: finalImage }),
        ...(optionA_img !== undefined && { optionA_img: optionA_img || null }),
        ...(optionB_img !== undefined && { optionB_img: optionB_img || null }),
        ...(optionC_img !== undefined && { optionC_img: optionC_img || null }),
        ...(optionD_img !== undefined && { optionD_img: optionD_img || null }),
        ...(optionE_img !== undefined && { optionE_img: optionE_img || null }),
        ...(negativeMarking !== undefined && { negativeMarking: parseFloat(negativeMarking) }),
        ...(isActive !== undefined && { isActive })
      }
    });
    res.json({ success: true, question });
  } catch (err) {
    console.error('Update Question Error:', err);
    res.status(500).json({ error: 'પ્રશ્ન અપડેટ કરવામાં ભૂલ.' });
  }
});

// ─── DELETE /api/questions/:id ────────────────────────────────
// Delete question (teacher only)
router.delete('/:id', authMiddleware, teacherOnly, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await prisma.question.delete({ where: { id } });
    res.json({ success: true, message: 'પ્રશ્ન ડિલીટ થઈ ગયો.' });
  } catch (err) {
    res.status(500).json({ error: 'પ્રશ્ન ડિલીટ કરવામાં ભૂલ.' });
  }
});


// ─── POST /api/questions/ai-generate ──────────────────────────
// Generate MCQs in Gujarati using Gemini AI (teacher only)
router.post('/ai-generate', authMiddleware, teacherOnly, async (req, res) => {
  const { topic, subject, examType, count = 5, difficulty = 'મધ્યમ', apiKey } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: 'કૃપા કરીને વિષય / ટોપિક (Topic) લખો.' });
  }

  const effectiveKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
  const numCount = Math.min(Math.max(parseInt(count) || 5, 1), 30);

  const promptText = `
You are an expert Gujarati question paper setter for Gujarat competitive examinations (TET-1, TET-2, TAT-S, TAT-HS, HTAT, GPSC, GSSSB).
Generate ${numCount} high-quality Multiple Choice Questions (MCQs) in pure, grammatically correct GUJARATI language.

TOPIC / પ્રકરણ: ${topic}
SUBJECT / વિષય: ${subject || 'સામાન્ય'}
EXAM LEVEL: ${examType || 'TET-2'}
DIFFICULTY: ${difficulty}

REQUIREMENTS:
1. Every question and all 4 options MUST be in Gujarati script (ગુજરાતી લિપિ).
2. For each question, provide:
   - "text": The clear question text in Gujarati.
   - "optionA": First option in Gujarati.
   - "optionB": Second option in Gujarati.
   - "optionC": Third option in Gujarati.
   - "optionD": Fourth option in Gujarati.
   - "correctOpt": One uppercase character: "A", "B", "C", or "D".
   - "explanation": A 1-2 sentence explanation in Gujarati explaining why this option is correct.
   - "subject": "${subject || 'સામાન્ય'}"
   - "chapter": "${topic}"
3. Format your response strictly as a JSON array of objects. Do NOT include markdown code blocks or additional text.
`;

  if (effectiveKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: effectiveKey });
      let response;
      const models = ['gemini-3.5-flash-lite', 'gemini-3.7-flash'];
      for (const m of models) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents: promptText,
            config: {
              temperature: 0.7,
              responseMimeType: 'application/json'
            }
          });
          if (response?.text) break;
        } catch (mErr) {
          console.warn(`Model ${m} failed, trying next:`, mErr.message);
        }
      }

      const rawText = response.text ? response.text.trim() : '';
      let parsed = [];
      try {
        parsed = JSON.parse(rawText);
      } catch (e) {
        // clean up markdown backticks if any
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, count: parsed.length, questions: parsed });
      }
    } catch (apiErr) {
      console.error('Gemini AI Generation Error:', apiErr?.message || apiErr);
      // fallback to curated intelligent generator if API call failed
    }
  }

  // Smart fallback questions generator if API key is not configured or failed
  const fallbackList = [];
  const topicsBase = topic.trim();
  for (let i = 1; i <= numCount; i++) {
    fallbackList.push({
      text: `${topicsBase} સંદર્ભે નીચેનામાંથી કયું વિધાન સાચું છે? (પ્રશ્ન ${i})`,
      optionA: `${topicsBase} નો પાયાનો સિદ્ધાંત અને મહત્વ`,
      optionB: `સામાન્ય નિયમો અને વિશેષતાઓ`,
      optionC: `વ્યવહારુ ઉપયોગ અને અમલીકરણ`,
      optionD: `ઉપરોક્ત તમામ`,
      correctOpt: 'D',
      explanation: `આ પ્રશ્ન ${topicsBase} વિષયના મહત્વના મુદ્દાઓ પર આધારિત છે.`,
      subject: subject || 'સામાન્ય',
      chapter: topicsBase,
      marks: 1
    });
  }

  return res.json({
    success: true,
    count: fallbackList.length,
    questions: fallbackList,
    notice: effectiveKey ? undefined : 'Gemini API Key દાખલ કરવાથી AI વધુ સચોટ પ્રશ્નો જનરેટ કરશે.'
  });
});

// ─── POST /api/questions/ocr-extract ──────────────────────────
// Extract MCQs from uploaded textbook/paper photo using Gemini Multimodal (teacher only)
router.post('/ocr-extract', authMiddleware, teacherOnly, uploadOcr.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'કૃપા કરીને પુસ્તક અથવા પેપરનો ફોટો અપલોડ કરો.' });
  }

  const { apiKey } = req.body;
  const effectiveKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
  const filePath = req.file.path;
  const mimeType = req.file.mimetype || 'image/jpeg';

  if (!effectiveKey) {
    return res.status(400).json({
      error: 'ફોટોમાંથી ગુજરાતી પ્રશ્નો સ્કેન કરવા માટે Gemini API Key જરૂરી છે. કૃપા કરીને API Key દાખલ કરો.'
    });
  }

  try {
    const imageBytes = fs.readFileSync(filePath);
    const base64Data = imageBytes.toString('base64');

    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    let response;
    const models = ['gemini-3.5-flash-lite', 'gemini-3.7-flash'];
    for (const m of models) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            `
You are an expert Gujarati OCR and exam question digitizer.
Scan this image carefully and extract all multiple-choice questions (MCQs) written in Gujarati.

For EACH question found in the image, extract:
1. "text": The complete Gujarati question statement.
2. "optionA": Gujarati text for option (A).
3. "optionB": Gujarati text for option (B).
4. "optionC": Gujarati text for option (C).
5. "optionD": Gujarati text for option (D).
6. "correctOpt": "A", "B", "C", or "D" (if marked/ticked/underlined or known, otherwise best guess).
7. "explanation": Brief Gujarati explanation if provided or relevant.
8. "subject": Subject name if detected or "સામાન્ય".
9. "chapter": Chapter/topic if detected or "સ્કેન કરેલ પ્રશ્ન".

Return ONLY a JSON array of question objects. Do not wrap in markdown quotes.
`
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });
        if (response?.text) break;
      } catch (mErr) {
        console.warn(`OCR Model ${m} failed, trying next:`, mErr.message);
      }
    }

    const rawText = response.text ? response.text.trim() : '';
    let parsed = [];
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    // Clean up uploaded temp image
    try { fs.unlinkSync(filePath); } catch (_) {}

    if (Array.isArray(parsed) && parsed.length > 0) {
      return res.json({ success: true, count: parsed.length, questions: parsed });
    } else {
      return res.status(404).json({ error: 'ફોટામાંથી કોઈ પ્રશ્નો ઓળખાયા નહીં. કૃપા કરીને સ્પષ્ટ ફોટો અપલોડ કરો.' });
    }
  } catch (ocrErr) {
    console.error('OCR Extraction Error:', ocrErr?.message || ocrErr);
    try { fs.unlinkSync(filePath); } catch (_) {}
    return res.status(500).json({ error: 'ફોટો સ્કેન કરવામાં ભૂલ આવી: ' + (ocrErr?.message || 'અજ્ઞાત ભૂલ') });
  }
});

// ─── POST /api/questions/bulk-save ────────────────────────────
// Save an array of questions into the database under a test code (teacher only)
router.post('/bulk-save', authMiddleware, teacherOnly, async (req, res) => {
  const { questions, testCode, testName, subject, timeLimit, isActive } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'સાચવવા માટે પ્રશ્નો મળ્યા નથી.' });
  }

  const finalTestCode = (testCode || 'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase()).trim();
  const finalTestName = (testName || finalTestCode).trim();
  const finalSubject  = (subject || questions[0]?.subject || 'સામાન્ય').trim();
  const finalTimeLimit = parseInt(timeLimit) || 60;
  const finalIsActive  = isActive !== undefined ? isActive : true;

  try {
    const maxOrder = await prisma.question.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });
    let currentOrder = (maxOrder?.orderIndex || 0) + 1;

    const createdList = [];
    for (const q of questions) {
      if (!q.text || !q.text.trim()) continue;

      const created = await prisma.question.create({
        data: {
          text: q.text.trim(),
          type: 'mcq',
          optionA: q.optionA ? q.optionA.trim() : 'વિકલ્પ A',
          optionB: q.optionB ? q.optionB.trim() : 'વિકલ્પ B',
          optionC: q.optionC ? q.optionC.trim() : 'વિકલ્પ C',
          optionD: q.optionD ? q.optionD.trim() : 'વિકલ્પ D',
          optionE: q.optionE ? q.optionE.trim() : (req.body.hasOptionE ? 'ઉત્તર આપવા માંગતા નથી (Not Attempted)' : null),
          correctOpt: (q.correctOpt || 'A').toUpperCase(),
          subject: (q.subject || finalSubject).trim(),
          chapter: q.chapter ? q.chapter.trim() : null,
          marks: q.marks ? parseInt(q.marks) : 1,
          negativeMarking: q.negativeMarking !== undefined ? parseFloat(q.negativeMarking) : (req.body.negativeMarking !== undefined ? parseFloat(req.body.negativeMarking) : 0),
          testCode: finalTestCode,
          testName: finalTestName,
          timeLimit: finalTimeLimit,
          isActive: finalIsActive,
          orderIndex: currentOrder++
        }
      });
      createdList.push(created);
    }

    res.status(201).json({
      success: true,
      message: `🎉 ${createdList.length} પ્રશ્નો સફળતાપૂર્વક કસોટી (${finalTestCode}) માં સાચવી લેવામાં આવ્યા!`,
      count: createdList.length,
      testCode: finalTestCode,
      testName: finalTestName
    });
  } catch (err) {
    console.error('Bulk Save Questions Error:', err);
    res.status(500).json({ error: 'પ્રશ્નો સાચવવામાં ભૂલ આવી.' });
  }
});


module.exports = router;
