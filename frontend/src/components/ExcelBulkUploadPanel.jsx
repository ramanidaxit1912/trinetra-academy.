import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import confetti from 'canvas-confetti';
import {
  UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle,
  Trash2, ArrowLeft, Sparkles, Clock, BookOpen, Layers, Play, Check, X, FileText
} from 'lucide-react';
import { bulkSaveQuestions, createQuestion, activateTest } from '../services/api';

const DEFAULT_SUBJECTS = [
  'સામાન્ય જ્ઞાન & કરંટ અફેર્સ (GK)',
  'ગુજરાતી સાહિત્ય & વ્યાકરણ',
  'બાળ મનોવિજ્ઞાન & શિક્ષણના સિદ્ધાંતો (Pedagogy)',
  'અંગ્રેજી વ્યાકરણ (English Grammar)',
  'ગણિત & તાર્કિક કસોટીઓ (Maths & Reasoning)',
  'સામાજિક વિજ્ઞાન (Social Science)',
  'વિજ્ઞાન અને ટેકનોલોજી (Science & Tech)',
  'ભારતીય બંધારણ & રાજ્યવ્યવસ્થા (Polity)',
  'પર્યાવરણ અને ભૂગોળ (Environment & Geography)',
  'સંસ્કૃત (Sanskrit)',
  'હિન્દી (Hindi)',
  'કમ્પ્યૂટર સાક્ષરતા (Computer)',
  'અન્ય કસોટી (Other)'
];

const SAMPLE_QUESTIONS = [
  {
    q: 'ગુજરાત રાજ્યનું પાટનગર નીચેનામાંથી કયું છે?',
    a: 'અમદાવાદ',
    b: 'ગાંધીનગર',
    c: 'વડોદરા',
    d: 'રાજકોટ',
    e: 'ઉત્તર આપવા માંગતા નથી',
    ans: 'B',
    marks: 1,
    exp: '૧૯૭૦માં ગાંધીનગરને ગુજરાતનું પાટનગર બનાવવામાં આવ્યું હતું.'
  },
  {
    q: 'ભારતીય બંધારણ કઈ તારીખે સંપૂર્ણપણે અમલમાં આવ્યું હતું?',
    a: '૧૫ ઓગસ્ટ ૧૯૪૭',
    b: '૨૬ નવેમ્બર ૧૯૪૯',
    c: '૨૬ જાન્યુઆરી ૧૯૫૦',
    d: '૩૦ જાન્યુઆરી ૧૯૪૮',
    e: 'ઉત્તર આપવા માંગતા નથી',
    ans: 'C',
    marks: 1,
    exp: '૨૬ જાન્યુઆરી ૧૯૫૦ના રોજ ભારત પ્રજાસત્તાક દેશ બન્યો હતો.'
  },
  {
    q: 'પાણીનું સાચું રાસાયણિક સૂત્ર (Chemical Formula) શું છે?',
    a: 'CO2',
    b: 'H2O',
    c: 'NaCl',
    d: 'O2',
    e: 'ઉત્તર આપવા માંગતા નથી',
    ans: 'B',
    marks: 1,
    exp: 'પાણી એ હાઇડ્રોજનના ૨ પરમાણુ અને ઓક્સિજનના ૧ પરમાણુનું સંયોજન છે.'
  },
  {
    q: 'ગુજરાતી સાહિત્યમાં પ્રતિષ્ઠિત ‘જ્ઞાનપીઠ એવોર્ડ’ મેળવનાર પ્રથમ સાહિત્યકાર કોણ હતા?',
    a: 'ઉમાશંકર જોશી',
    b: 'પન્નાલાલ પટેલ',
    c: 'રાજેન્દ્ર શાહ',
    d: 'રઘુવીર ચૌધરી',
    e: 'ઉત્તર આપવા માંગતા નથી',
    ans: 'A',
    marks: 1,
    exp: '૧૯૬૭માં તેમના કાવ્યસંગ્રહ ‘નિશીથ’ માટે ઉમાશંકર જોશીને જ્ઞાનપીઠ એવોર્ડ એનાયત થયો હતો.'
  },
  {
    q: 'માનવ શરીરમાં રક્ત શુદ્ધિકરણ (Blood Filtration) નું મુખ્ય કાર્ય કયું અંગ કરે છે?',
    a: 'હૃદય (Heart)',
    b: 'કિડની / મૂત્રપિંડ (Kidney)',
    c: 'ફેફસાં (Lungs)',
    d: 'યકૃત / લીવર (Liver)',
    e: 'ઉત્તર આપવા માંગતા નથી',
    ans: 'B',
    marks: 1,
    exp: 'કિડની લોહીમાંથી ઉત્સર્ગ દ્રવ્યો અને વધારાનું પાણી ગાળીને પેશાબ સ્વરૂપે બહાર કાઢે છે.'
  }
];

export default function ExcelBulkUploadPanel({ showToast, onBack, onDone, subjects = DEFAULT_SUBJECTS, setSelectedLiveTestCode }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [parseIssues, setParseIssues] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);

  // Test Configurations
  const [testMeta, setTestMeta] = useState({
    testName: `નવી મોક ટેસ્ટ (${new Date().toLocaleDateString('gu-IN')})`,
    testCode: 'TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
    subject: subjects[0] || 'સામાન્ય જ્ઞાન & કરંટ અફેર્સ (GK)',
    timerMode: 'total_test', // 'no_limit' | 'total_test' | 'per_question'
    totalMinutes: 60,
    perQuestionSec: 60,
    negativeMarking: 0, // 0, 0.25, 0.33, 0.50
    hasOptionE: true, // Add Option E "ઉત્તર આપવા માંગતા નથી"
  });

  const fileInputRef = useRef(null);

  // 📥 Download Stylized Excel Template (.xlsx) using ExcelJS
  const downloadExcelTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ત્રિનેત્ર ઓનલાઇન એકેડેમી';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('પ્રશ્નપત્ર ટેમ્પ્લેટ', {
        views: [{ showGridLines: true }]
      });

      // 1. Top Brand Banner
      worksheet.mergeCells('A1:J1');
      const banner = worksheet.getCell('A1');
      banner.value = '🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી — બલ્ક પ્રશ્નપત્ર અપલોડ એક્સેલ ટેમ્પ્લેટ';
      banner.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Deep Navy
      banner.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 36;

      // 2. Instructions Banner
      worksheet.mergeCells('A2:J2');
      const instructions = worksheet.getCell('A2');
      instructions.value = '💡 સૂચના: નીચે આપેલા કોલમમાં આપના પ્રશ્નો અને વિકલ્પો ભરો. "Answer" માં A, B, C, D કે E લખો. Marks જો ખાલી રાખશો તો ૧ ગણાશે.';
      instructions.font = { name: 'Calibri', size: 10, italic: true, bold: true, color: { argb: 'FF1E293B' } };
      instructions.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Warm Amber Yellow
      instructions.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(2).height = 24;

      // 3. Header Row Definition
      const headers = [
        { key: 'q', header: 'Question (પ્રશ્ન)', width: 45 },
        { key: 'a', header: 'Option A (વિકલ્પ A)', width: 25 },
        { key: 'b', header: 'Option B (વિકલ્પ B)', width: 25 },
        { key: 'c', header: 'Option C (વિકલ્પ C)', width: 25 },
        { key: 'd', header: 'Option D (વિકલ્પ D)', width: 25 },
        { key: 'e', header: 'Option E (વિકલ્પ E - ઓપ્શનલ)', width: 25 },
        { key: 'ans', header: 'Answer (સાચો ઉત્તર: A/B/C/D/E)', width: 22 },
        { key: 'marks', header: 'Marks (ગુણ)', width: 14 },
        { key: 'exp', header: 'Explanation (સમજૂતી - ઓપ્શનલ)', width: 38 }
      ];

      const headerRow = worksheet.getRow(3);
      headerRow.height = 30;
      headers.forEach((h, colIndex) => {
        const cell = headerRow.getCell(colIndex + 1);
        cell.value = h.header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Royal Blue
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } }
        };
        worksheet.getColumn(colIndex + 1).width = h.width;
      });

      // 4. Sample Rows
      SAMPLE_QUESTIONS.forEach((sq, rIdx) => {
        const row = worksheet.getRow(4 + rIdx);
        row.height = 24;
        const rowVals = [sq.q, sq.a, sq.b, sq.c, sq.d, sq.e, sq.ans, sq.marks, sq.exp];
        rowVals.forEach((val, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = val;
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: cIdx === 6 || cIdx === 7 ? 'center' : 'left' };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (cIdx === 6) {
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF15803D' } }; // Green Bold for Answer
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Trinetra_Question_Template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📥 એક્સેલ ટેમ્પ્લેટ સફળતાપૂર્વક ડાઉનલોડ થઈ ગયું!', 'success');
    } catch (err) {
      console.error('Download template error:', err);
      showToast('ટેમ્પ્લેટ ડાઉનલોડ કરવામાં ક્ષતિ આવી.', 'error');
    }
  };

  // 📥 Download CSV Template with UTF-8 BOM for Gujarati
  const downloadCsvTemplate = () => {
    try {
      const headers = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Answer', 'Marks', 'Explanation'];
      const rows = SAMPLE_QUESTIONS.map(sq => [
        `"${sq.q.replace(/"/g, '""')}"`,
        `"${sq.a.replace(/"/g, '""')}"`,
        `"${sq.b.replace(/"/g, '""')}"`,
        `"${sq.c.replace(/"/g, '""')}"`,
        `"${sq.d.replace(/"/g, '""')}"`,
        `"${sq.e.replace(/"/g, '""')}"`,
        `"${sq.ans}"`,
        sq.marks,
        `"${sq.exp.replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Trinetra_Question_Template.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📥 CSV ટેમ્પ્લેટ સફળતાપૂર્વક ડાઉનલોડ થઈ ગયું!', 'success');
    } catch {
      showToast('CSV ડાઉનલોડ નિષ્ફળ થયું.', 'error');
    }
  };

  // 🔍 File Parser
  const parseFile = async (selectedFile) => {
    if (!selectedFile) return;
    setIsParsing(true);
    setFileName(selectedFile.name);
    setFile(selectedFile);
    setParsedRows([]);
    setParseIssues([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('ફાઇલમાં કોઈ શીટ મળેલ નથી.');
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', header: 1 });

      if (!rawRows || rawRows.length < 2) {
        throw new Error('ફાઇલમાં પૂરતો ડેટા મળ્યો નથી (ઓછામાં ઓછી હેડર રો અને ૧ પ્રશ્ન જરૂરી છે).');
      }

      // Find Header Row (A row that contains both question and options/answer)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const rowStr = rawRows[i].map(c => String(c).toLowerCase()).join(' ');
        const hasQuestion = rowStr.includes('question') || rowStr.includes('પ્રશ્ન') || rowStr.includes('q text');
        const hasOptions = rowStr.includes('option') || rowStr.includes('વિકલ્પ') || rowStr.includes('opt') || rowStr.includes('ans') || rowStr.includes('answer');
        if (hasQuestion && hasOptions) {
          headerRowIndex = i;
          break;
        }
      }

      const rawHeaders = rawRows[headerRowIndex].map(h => String(h || '').trim());
      const dataRows = rawRows.slice(headerRowIndex + 1);

      // Map column headers intelligently
      const colMap = {
        question: -1,
        optA: -1,
        optB: -1,
        optC: -1,
        optD: -1,
        optE: -1,
        answer: -1,
        marks: -1,
        exp: -1
      };

      rawHeaders.forEach((h, idx) => {
        const cleanH = h.toLowerCase().replace(/[^a-z0-9\u0A80-\u0AFF]/g, '');
        if (colMap.question === -1 && (cleanH.includes('question') || cleanH.includes('પ્રશ્ન') || cleanH.includes('text') || cleanH.includes('q') || cleanH.includes('સવાલ'))) {
          colMap.question = idx;
        } else if (colMap.optA === -1 && (cleanH.includes('optiona') || cleanH.includes('opta') || cleanH.includes('વિકલ્પa') || cleanH.includes('option1') || cleanH === 'a')) {
          colMap.optA = idx;
        } else if (colMap.optB === -1 && (cleanH.includes('optionb') || cleanH.includes('optb') || cleanH.includes('વિકલ્પb') || cleanH.includes('option2') || cleanH === 'b')) {
          colMap.optB = idx;
        } else if (colMap.optC === -1 && (cleanH.includes('optionc') || cleanH.includes('optc') || cleanH.includes('વિકલ્પc') || cleanH.includes('option3') || cleanH === 'c')) {
          colMap.optC = idx;
        } else if (colMap.optD === -1 && (cleanH.includes('optiond') || cleanH.includes('optd') || cleanH.includes('વિકલ્પd') || cleanH.includes('option4') || cleanH === 'd')) {
          colMap.optD = idx;
        } else if (colMap.optE === -1 && (cleanH.includes('optione') || cleanH.includes('opte') || cleanH.includes('વિકલ્પe') || cleanH.includes('option5') || cleanH === 'e')) {
          colMap.optE = idx;
        } else if (colMap.answer === -1 && (cleanH.includes('answer') || cleanH.includes('correct') || cleanH.includes('જવાબ') || cleanH.includes('ઉત્તર') || cleanH.includes('ans'))) {
          colMap.answer = idx;
        } else if (colMap.marks === -1 && (cleanH.includes('mark') || cleanH.includes('ગુણ'))) {
          colMap.marks = idx;
        } else if (colMap.exp === -1 && (cleanH.includes('explanation') || cleanH.includes('સમજૂતી') || cleanH.includes('solution') || cleanH.includes('સ્પષ્ટીકરણ'))) {
          colMap.exp = idx;
        }
      });

      // Fallback if headers didn't match: assume Standard Order (Q, A, B, C, D, E, Ans, Marks)
      if (colMap.question === -1) colMap.question = 0;
      if (colMap.optA === -1) colMap.optA = 1;
      if (colMap.optB === -1) colMap.optB = 2;
      if (colMap.optC === -1) colMap.optC = 3;
      if (colMap.optD === -1) colMap.optD = 4;
      if (colMap.answer === -1) {
        if (colMap.optE !== -1 && colMap.optE + 1 < rawHeaders.length) colMap.answer = colMap.optE + 1;
        else colMap.answer = 5;
      }

      const validList = [];
      const issuesList = [];

      dataRows.forEach((row, rIdx) => {
        const lineNum = headerRowIndex + 2 + rIdx;
        const qText = String(row[colMap.question] || '').trim();
        if (!qText) return; // Skip empty rows

        const optA = String(row[colMap.optA] || '').trim();
        const optB = String(row[colMap.optB] || '').trim();
        const optC = colMap.optC !== -1 ? String(row[colMap.optC] || '').trim() : '';
        const optD = colMap.optD !== -1 ? String(row[colMap.optD] || '').trim() : '';
        let optE = colMap.optE !== -1 ? String(row[colMap.optE] || '').trim() : '';

        const rawAns = colMap.answer !== -1 ? String(row[colMap.answer] || '').trim() : 'A';
        const marks = colMap.marks !== -1 && row[colMap.marks] !== undefined && !isNaN(parseInt(row[colMap.marks])) ? parseInt(row[colMap.marks]) : 1;
        const explanation = colMap.exp !== -1 ? String(row[colMap.exp] || '').trim() : '';

        // Validate Options
        if (!optA || !optB) {
          issuesList.push({ line: lineNum, text: qText, issue: 'વિકલ્પ A અથવા B ખાલી છે.' });
          return;
        }

        // Normalize Answer
        let correctOpt = 'A';
        const cleanAns = rawAns.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E'].includes(cleanAns)) {
          correctOpt = cleanAns;
        } else if (/^[1-5]$/.test(cleanAns)) {
          correctOpt = ['A', 'B', 'C', 'D', 'E'][parseInt(cleanAns) - 1];
        } else {
          // If answer is text matching one of options
          const ansLow = rawAns.toLowerCase();
          if (optA && ansLow === optA.toLowerCase()) correctOpt = 'A';
          else if (optB && ansLow === optB.toLowerCase()) correctOpt = 'B';
          else if (optC && ansLow === optC.toLowerCase()) correctOpt = 'C';
          else if (optD && ansLow === optD.toLowerCase()) correctOpt = 'D';
          else if (optE && ansLow === optE.toLowerCase()) correctOpt = 'E';
          else {
            issuesList.push({ line: lineNum, text: qText, issue: `સાચો ઉત્તર '${rawAns}' માન્ય નથી (A, B, C, D કે E હોવો જોઈએ).` });
            return;
          }
        }

        validList.push({
          id: `q_${Date.now()}_${rIdx}`,
          line: lineNum,
          text: qText,
          optionA: optA,
          optionB: optB,
          optionC: optC || 'વિકલ્પ C',
          optionD: optD || 'વિકલ્પ D',
          optionE: optE,
          correctOpt,
          marks,
          explanation
        });
      });

      if (validList.length === 0) {
        throw new Error('ફાઇલમાં કોઈ માન્ય પ્રશ્ન મળી શક્યો નથી. કૃપા કરીને સેમ્પલ ટેમ્પ્લેટ ચકાસો.');
      }

      setParsedRows(validList);
      setParseIssues(issuesList);

      // Auto update Test Name if file has meaningful name
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]+/g, ' ');
      if (cleanName && cleanName.length > 3) {
        setTestMeta(prev => ({
          ...prev,
          testName: cleanName
        }));
      }

      showToast(`🎉 સફળ! ${validList.length} પ્રશ્નો ઓળખાયા.${issuesList.length > 0 ? ` (${issuesList.length} પ્રશ્નોમાં ક્ષતિ છે)` : ''}`, issuesList.length > 0 ? 'warning' : 'success');
    } catch (err) {
      console.error('File Parse Error:', err);
      showToast(err.message || 'ફાઇલ વાંચવામાં ક્ષતિ આવી. કૃપા કરીને સાચી .xlsx કે .csv ફાઇલ પસંદ કરો.', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseFile(e.dataTransfer.files[0]);
    }
  };

  // Remove question row from preview
  const handleRemoveRow = (idxToRemove) => {
    setParsedRows(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Calculate Effective Time in Minutes/Seconds for DB
  const getEffectiveTimeLimit = () => {
    if (testMeta.timerMode === 'no_limit') return 0;
    if (testMeta.timerMode === 'per_question') return Number(testMeta.perQuestionSec) || 60;
    return Number(testMeta.totalMinutes) || 60;
  };

  // 🚀 Bulk Save and optionally activate live
  const handleSaveTest = async (makeLiveImmediately = false) => {
    if (parsedRows.length === 0) {
      showToast('કોઈ પ્રશ્નો અપલોડ થયેલ નથી.', 'error');
      return;
    }

    if (!testMeta.testName.trim()) {
      showToast('કસોટીનું નામ લખવું જરૂરી છે.', 'error');
      return;
    }

    setIsUploading(true);
    const finalTestCode = testMeta.testCode.trim() || ('TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase());
    const finalTestName = testMeta.testName.trim();
    const effectiveTime = getEffectiveTimeLimit();
    const effectiveNeg = parseFloat(testMeta.negativeMarking) || 0;

    // Prepare questions with Option E if toggle is active and not already present
    const preparedQuestions = parsedRows.map((q, idx) => ({
      text: q.text,
      type: 'mcq',
      subject: testMeta.subject,
      chapter: finalTestName,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      optionE: q.optionE || (testMeta.hasOptionE ? 'ઉત્તર આપવા માંગતા નથી (Not Attempted)' : null),
      correctOpt: q.correctOpt,
      marks: q.marks || 1,
      negativeMarking: effectiveNeg,
      testCode: finalTestCode,
      testName: finalTestName,
      timeLimit: effectiveTime,
      isActive: makeLiveImmediately,
      orderIndex: idx + 1
    }));

    try {
      setUploadProgress({ current: 0, total: preparedQuestions.length });

      // Try bulk-save first
      try {
        await bulkSaveQuestions({
          questions: preparedQuestions,
          testCode: finalTestCode,
          testName: finalTestName,
          subject: testMeta.subject,
          timeLimit: effectiveTime,
          negativeMarking: effectiveNeg,
          isActive: makeLiveImmediately,
          hasOptionE: testMeta.hasOptionE
        });
      } catch (bulkErr) {
        console.warn('Bulk-save endpoint failed, falling back to sequential createQuestion:', bulkErr);
        // Fallback: Individual createQuestion
        let count = 0;
        for (const q of preparedQuestions) {
          await createQuestion(q);
          count++;
          setUploadProgress({ current: count, total: preparedQuestions.length });
        }
      }

      // If user chose to make it live immediately
      if (makeLiveImmediately) {
        try {
          await activateTest({ testCode: finalTestCode, action: 'activate' });
        } catch (actErr) {
          console.warn('Activate call warning:', actErr);
        }
      }

      // Celebration Confetti
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      showToast(`🎉 સફળતા! '${finalTestName}' (${preparedQuestions.length} પ્રશ્નો) સફળતાપૂર્વક તૈયાર થઈ ગઈ!`, 'success');

      if (setSelectedLiveTestCode) setSelectedLiveTestCode(finalTestCode);
      if (onDone) onDone(finalTestCode, makeLiveImmediately);
    } catch (err) {
      console.error('Save Test Error:', err);
      showToast('કસોટી સાચવવામાં ક્ષતિ આવી: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const totalMarks = parsedRows.reduce((acc, q) => acc + (q.marks || 1), 0);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40, fontFamily: 'Hind Vadodara, sans-serif' }}>
      
      {/* ── Top Header Strip ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1.5px solid rgba(59, 130, 246, 0.35)',
        borderRadius: 16,
        padding: '16px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#cbd5e1',
              padding: '8px 14px',
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <ArrowLeft size={16} /> પાછા જાઓ
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 8 }}>
              📊 એક્સેલ / CSV બલ્ક પ્રશ્નપત્ર અપલોડ
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
              Excel (.xlsx) કે CSV ફાઇલ અપલોડ કરીને ૫૦ થી ૫૦૦ પ્રશ્નો ૧-ક્લિકમાં ડાયરેક્ટ નવી કસોટીમાં કન્વર્ટ કરો
            </div>
          </div>
        </div>

        {/* Download Template Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={downloadExcelTemplate}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              padding: '9px 15px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <FileSpreadsheet size={16} /> 📥 સેમ્પલ એક્સેલ (.xlsx)
          </button>
          <button
            onClick={downloadCsvTemplate}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '9px 13px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <FileText size={16} /> સેમ્પલ CSV
          </button>
        </div>
      </div>

      {/* ── STEP 1: UPLOAD ZONE ── */}
      <div style={{ marginBottom: 24 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              parseFile(e.target.files[0]);
            }
          }}
        />

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? '#3b82f6' : 'rgba(59, 130, 246, 0.4)'}`,
            background: dragActive ? 'rgba(59, 130, 246, 0.12)' : 'rgba(15, 23, 42, 0.6)',
            borderRadius: 18,
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
          }}
        >
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(59, 130, 246, 0.1))',
            border: '1.5px solid rgba(59, 130, 246, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#60a5fa'
          }}>
            <UploadCloud size={32} />
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            {fileName ? `📂 પસંદ કરેલી ફાઇલ: ${fileName}` : 'એક્સેલ કે CSV ફાઇલ અહીં ડ્રેગ કરો અથવા ક્લિક કરીને પસંદ કરો'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
            સપોર્ટેડ ફોર્મેટ્સ: <strong>.xlsx, .xls, .csv</strong> (Unicode ગુજરાતી સપોર્ટ સાથે)
          </p>

          <div style={{ marginTop: 16 }}>
            <span style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              padding: '8px 18px',
              borderRadius: 10,
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}>
              📁 કમ્પ્યુટર / મોબાઇલમાંથી ફાઇલ ચૂઝ કરો
            </span>
          </div>

          {isParsing && (
            <div style={{ marginTop: 14, color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
              ⏳ ફાઇલ વાંચવામાં આવી રહી છે... કૃપા કરીને થોડી ક્ષણ રાહ જુઓ...
            </div>
          )}
        </div>
      </div>

      {/* ── STEP 2: SUMMARY CHIPS (IF PARSED) ── */}
      {parsedRows.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24
        }}>
          <div style={{ background: 'rgba(37, 99, 235, 0.15)', border: '1.5px solid rgba(37, 99, 235, 0.4)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93c5fd' }}>કુલ ઓળખાયેલા પ્રશ્નો</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{parsedRows.length} MCQ</div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid rgba(16, 185, 129, 0.4)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#86efac' }}>કુલ ગુણ (Total Marks)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{totalMarks} ગુણ</div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1.5px solid rgba(245, 158, 11, 0.4)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fde68a' }}>ક્ષતિગ્રસ્ત / સ્કીપ સવાલો</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{parseIssues.length}</div>
          </div>
        </div>
      )}

      {/* Issues List Alert */}
      {parseIssues.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 24,
          color: '#fca5a5',
          fontSize: '0.84rem'
        }}>
          <div style={{ fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={16} /> નીચેની લાઇન્સમાં ક્ષતિ હોવાથી તે સ્કીપ કરવામાં આવ્યા છે:
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {parseIssues.slice(0, 5).map((iss, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                લાઇન {iss.line}: {iss.issue} ({iss.text.slice(0, 40)}...)
              </li>
            ))}
            {parseIssues.length > 5 && <li>...અને બીજા {parseIssues.length - 5} પ્રશ્નો</li>}
          </ul>
        </div>
      )}

      {/* ── STEP 3: TEST CONFIGURATION SETTINGS ── */}
      {parsedRows.length > 0 && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 18,
          padding: 22,
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚙️ કસોટીની વિગતો અને સેટિંગ્સ (Test Settings)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* Test Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                📝 કસોટીનું નામ (Test Title) *
              </label>
              <input
                type="text"
                value={testMeta.testName}
                onChange={(e) => setTestMeta({ ...testMeta, testName: e.target.value })}
                placeholder="દા.ત. TET-2 ગુજરાતી વ્યાકરણ Mock Test"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.88rem'
                }}
              />
            </div>

            {/* Test Code */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                🔑 ટેસ્ટ કોડ (Test Code) *
              </label>
              <input
                type="text"
                value={testMeta.testCode}
                onChange={(e) => setTestMeta({ ...testMeta, testCode: e.target.value.toUpperCase() })}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#38bdf8',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  letterSpacing: '0.5px'
                }}
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                📚 વિષય (Subject) *
              </label>
              <select
                value={testMeta.subject}
                onChange={(e) => setTestMeta({ ...testMeta, subject: e.target.value })}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.88rem'
                }}
              >
                {subjects.map((sub, i) => (
                  <option key={i} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Timer Mode */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                ⏱️ સમય મર્યાદા (Timer Mode)
              </label>
              <select
                value={testMeta.timerMode}
                onChange={(e) => setTestMeta({ ...testMeta, timerMode: e.target.value })}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.88rem'
                }}
              >
                <option value="total_test">આખી કસોટી માટે સમય (Total Test Time)</option>
                <option value="per_question">પ્રશ્ન દીઠ સમય (Per Question Seconds)</option>
                <option value="no_limit">સમય મર્યાદા નથી (Unlimited)</option>
              </select>
            </div>

            {/* Timer Value input if total_test or per_question */}
            {testMeta.timerMode === 'total_test' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  ⏳ કસોટીનો સમય (મિનિટમાં)
                </label>
                <select
                  value={testMeta.totalMinutes}
                  onChange={(e) => setTestMeta({ ...testMeta, totalMinutes: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                >
                  <option value={15}>૧૫ મિનિટ</option>
                  <option value={30}>૩૦ મિનિટ</option>
                  <option value={45}>૪૫ મિનિટ</option>
                  <option value={60}>૬૦ મિનિટ (૧ કલાક)</option>
                  <option value={90}>૯૦ મિનિટ (૧.૫ કલાક)</option>
                  <option value={120}>૧૨૦ મિનિટ (૨ કલાક)</option>
                  <option value={150}>૧૫૦ મિનિટ (TET/TAT Full)</option>
                  <option value={180}>૧૮૦ મિનિટ (૩ કલાક)</option>
                </select>
              </div>
            )}

            {testMeta.timerMode === 'per_question' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  ⚡ પ્રશ્ન દીઠ સેકન્ડ
                </label>
                <select
                  value={testMeta.perQuestionSec}
                  onChange={(e) => setTestMeta({ ...testMeta, perQuestionSec: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                >
                  <option value={30}>૩૦ સેકન્ડ / પ્રશ્ન</option>
                  <option value={45}>૪૫ સેકન્ડ / પ્રશ્ન</option>
                  <option value={60}>૬૦ સેકન્ડ (૧ મિનિટ) / પ્રશ્ન</option>
                  <option value={90}>૯૦ સેકન્ડ / પ્રશ્ન</option>
                  <option value={120}>૧૨૦ સેકન્ડ (૨ મિનિટ) / પ્રશ્ન</option>
                </select>
              </div>
            )}

            {/* Negative Marking */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                🔻 નેગેટિવ માર્કિંગ (ખોટા ઉત્તર પર કપાત)
              </label>
              <select
                value={testMeta.negativeMarking}
                onChange={(e) => setTestMeta({ ...testMeta, negativeMarking: Number(e.target.value) })}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.88rem'
                }}
              >
                <option value={0}>0 (કોઈ નેગેટિવ માર્કિંગ નહીં)</option>
                <option value={0.25}>-0.25 (૧/૪ ગુણ કપાત)</option>
                <option value={0.33}>-0.33 (૧/૩ ગુણ કપાત)</option>
                <option value={0.50}>-0.50 (૧/૨ ગુણ કપાત)</option>
                <option value={1.00}>-1.00 (૧ ગુણ કપાત)</option>
              </select>
            </div>

            {/* Option E Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
              <input
                type="checkbox"
                id="hasOptionECheck"
                checked={testMeta.hasOptionE}
                onChange={(e) => setTestMeta({ ...testMeta, hasOptionE: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#38bdf8' }}
              />
              <label htmlFor="hasOptionECheck" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#cbd5e1', cursor: 'pointer' }}>
                ૫ વિકલ્પો (Option E) ઓટોમેટિક સેટ કરો (TAT/GPSC સ્પર્ધાત્મક પરીક્ષા નિયમ મુજબ "ઉત્તર આપવા માંગતા નથી")
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: INTERACTIVE PREVIEW ── */}
      {parsedRows.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>
              📋 પ્રશ્નોનો લાઈવ પ્રિવ્યુ ({parsedRows.length})
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              * લીલા કલરનો વિકલ્પ સાચો ઉત્તર (Correct Answer) દર્શાવે છે
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {parsedRows.slice(0, 20).map((q, idx) => (
              <div
                key={q.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  position: 'relative'
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      background: 'rgba(56, 189, 248, 0.18)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 900
                    }}>
                      Q{idx + 1}
                    </span>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {q.marks || 1} ગુણ
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveRow(idx)}
                    title="પ્રશ્ન કાઢી નાખો"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      borderRadius: 8,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Trash2 size={13} /> રદ્દ
                  </button>
                </div>

                {/* Question Text */}
                <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 12, lineHeight: 1.5 }}>
                  {q.text}
                </div>

                {/* Options Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  {[
                    { opt: 'A', text: q.optionA },
                    { opt: 'B', text: q.optionB },
                    { opt: 'C', text: q.optionC },
                    { opt: 'D', text: q.optionD },
                    ...(q.optionE || testMeta.hasOptionE ? [{ opt: 'E', text: q.optionE || 'ઉત્તર આપવા માંગતા નથી (Not Attempted)' }] : [])
                  ].map((o) => {
                    const isCorrect = q.correctOpt === o.opt;
                    return (
                      <div
                        key={o.opt}
                        style={{
                          background: isCorrect ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                          border: isCorrect ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                          color: isCorrect ? '#34d399' : '#cbd5e1',
                          borderRadius: 8,
                          padding: '8px 12px',
                          fontSize: '0.85rem',
                          fontWeight: isCorrect ? 800 : 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <span style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: isCorrect ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                          color: isCorrect ? '#0f172a' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 900
                        }}>
                          {o.opt}
                        </span>
                        <span>{o.text}</span>
                        {isCorrect && <Check size={14} style={{ marginLeft: 'auto' }} />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation if present */}
                {q.explanation && (
                  <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 6 }}>
                    💡 <strong>સમજૂતી:</strong> {q.explanation}
                  </div>
                )}
              </div>
            ))}

            {parsedRows.length > 20 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem', padding: '10px 0' }}>
                ...અને બીજા {parsedRows.length - 20} પ્રશ્નો સફળતાપૂર્વક લોડ થઈ ચૂક્યા છે.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 5: SAVE & CREATE BUTTONS ── */}
      {parsedRows.length > 0 && (
        <div style={{
          position: 'sticky',
          bottom: 16,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: 18,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          zIndex: 100
        }}>
          <div>
            <div style={{ fontWeight: 900, color: 'white', fontSize: '0.95rem' }}>
              🎯 {parsedRows.length} પ્રશ્નો સાથે '{testMeta.testName}' તૈયાર છે!
            </div>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 2 }}>
              કુલ ગુણ: {totalMarks} | નેગેટિવ: {testMeta.negativeMarking} | સમય: {testMeta.timerMode === 'no_limit' ? 'અમર્યાદિત' : `${testMeta.totalMinutes} મિનિટ`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Save as Inactive */}
            <button
              onClick={() => handleSaveTest(false)}
              disabled={isUploading}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1.5px solid rgba(255, 255, 255, 0.2)',
                color: '#e2e8f0',
                padding: '11px 20px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.7 : 1
              }}
            >
              💾 કસોટી સાચવો (Draft / Save)
            </button>

            {/* Save & Make Live */}
            <button
              onClick={() => handleSaveTest(true)}
              disabled={isUploading}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '11px 24px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: '0.92rem',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: isUploading ? 0.7 : 1
              }}
            >
              <Play size={18} /> 🚀 સેવ કરીને તરત Live કરો
            </button>
          </div>

          {isUploading && uploadProgress.total > 0 && (
            <div style={{ width: '100%', marginTop: 8 }}>
              <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginBottom: 4 }}>
                પ્રશ્નો સેવ થઈ રહ્યા છે... {uploadProgress.current} / {uploadProgress.total}
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #38bdf8, #10b981)',
                  transition: 'width 0.2s ease'
                }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
