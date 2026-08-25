import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { formatMathText } from '../utils/mathFormatter';
import PdfExportModal, { exportTestPDF as executeExportPDF } from './PdfExportModal';
import { Camera, Zap } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import {
  getQuestions, getAllQuestions, getQuestionsByTest, addQuestion as createQuestion, deleteQuestion, updateQuestion, updateTestMeta, activateTest, scheduleTest,
  getAllSubmissions as getSubmissions, getStudents, resetStudentSession, deleteStudent, grantMasterAccess, grantMasterByMobile, getLiveOTPs, gradeSubmission, getSubmissionReview, reEvaluateSubmissions, broadcastWhatsApp, cleanTestData,
  getMaterials, createMaterial, updateMaterial, deleteMaterial,
  getMarketingItems, createMarketingItem, updateMarketingItem, deleteMarketingItem
} from '../services/api';
import {
  LogOut, Plus, Trash2, Eye, CheckCircle, Users, Clock, BarChart2, Edit3, Play, Square,
  RefreshCw, Layers, Download, Printer, FileText, Calendar, Image as ImageIcon, X, AlertCircle,
  Share2, FolderOpen, UploadCloud, FileCheck, ExternalLink, Link as LinkIcon, RotateCw, Maximize2,
  Sparkles, Tag, Unlock, Key, ShieldCheck, HelpCircle
} from 'lucide-react';

const darkLbl = { display: 'block', fontWeight: 600, fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 };

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

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: '🏠' },
  { id: 'generate',  label: 'Generate',   icon: '📝' },
  { id: 'live',      label: 'Live',       icon: '🔴' },
  { id: 'materials', label: 'Materials',  icon: '📁' },
  { id: 'marketing', label: 'Posters & Offers', icon: '🎨' },
  { id: 'answers',   label: 'Answers',    icon: '📸' },
  { id: 'students',  label: 'Students',   icon: '👥' },
  { id: 'history',   label: 'History',    icon: '📊' },
];

/* ─── Premium Toast ──────────────────────────────────── */
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  return { toast, show };
}

function Toast({ toast }) {
  if (!toast) return null;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className={`toast-premium toast-${toast.type}`}>
      <span style={{ fontSize: '1.2rem' }}>{icons[toast.type]}</span>
      {toast.msg}
    </div>
  );
}

/* ─── Live Clock ─────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span>
      <span className="live-dot" style={{ marginRight: 6 }} />
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

/* ─── Count-up Number ────────────────────────────────── */
function CountUp({ target, duration = 800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const n = parseFloat(target) || 0;
    const step = n / (duration / 30);
    let cur = 0;
    clearInterval(ref.current);
    ref.current = setInterval(() => {
      cur = Math.min(cur + step, n);
      setVal(Number.isInteger(n) ? Math.round(cur) : cur.toFixed(1));
      if (cur >= n) clearInterval(ref.current);
    }, 30);
    return () => clearInterval(ref.current);
  }, [target]);
  return <span className="count-up">{val}</span>;
}

/* ─── Export Test to PDF / Print Event Trigger ────────── */
function exportTestPDF(test, teacherProfile = {}) {
  window.dispatchEvent(new CustomEvent('open-pdf-modal', { detail: { test, teacherProfile } }));
}

/* ─── Avatar ─────────────────────────────────────────── */
function Avatar({ name, size = 36, colors }) {
  const palettes = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
  const color = colors || palettes[(name?.charCodeAt(0) || 0) % palettes.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg,${color},${color}cc)`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.38, flexShrink: 0, boxShadow: `0 0 0 2px rgba(255,255,255,0.1)` }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

/* ─── 📐 Math Symbol Quick Insert Toolbar ──────────────── */
export function MathSymbolToolbar({ onInsert }) {
  const symbols = [
    { label: '½', val: '1/2', title: 'Fraction 1/2' },
    { label: '¾', val: '3/4', title: 'Fraction 3/4' },
    { label: 'a/b', val: '\\frac{a}{b}', title: 'LaTeX Fraction' },
    { label: 'x²', val: 'x^2', title: 'Square power' },
    { label: 'x³', val: 'x^3', title: 'Cube power' },
    { label: 'xⁿ', val: 'x^n', title: 'n power' },
    { label: 'x₁', val: 'x_1', title: 'Subscript' },
    { label: '√', val: '\\sqrt{}', title: 'Square root' },
    { label: '∛', val: '\\sqrt[3]{}', title: 'Cube root' },
    { label: '→MN', val: '→ MN', title: 'Ray (કિરણ)' },
    { label: '↔MN', val: '↔ MN', title: 'Line (રેખા)' },
    { label: '¯MN', val: '\u0304 MN', title: 'Segment (રેખાખંડ)' },
    { label: '∠', val: '\\angle ', title: 'Angle (ખૂણો)' },
    { label: '△', val: '\\Delta ', title: 'Triangle (ત્રિકોણ)' },
    { label: '°', val: '^o', title: 'Degree' },
    { label: 'π', val: 'pi', title: 'Pi' },
    { label: 'θ', val: 'theta', title: 'Theta' },
    { label: 'α', val: 'alpha', title: 'Alpha' },
    { label: 'β', val: 'beta', title: 'Beta' },
    { label: '±', val: '+-', title: 'Plus-Minus' },
    { label: '≠', val: '!=', title: 'Not Equal' },
    { label: '≤', val: '<=', title: 'Less or Equal' },
    { label: '≥', val: '>=', title: 'Greater or Equal' },
    { label: '×', val: '\\times', title: 'Multiply' },
    { label: '÷', val: '\\div', title: 'Divide' },
    { label: '∞', val: '\\infty', title: 'Infinity' },
    { label: '∴', val: '\\therefore', title: 'Therefore' },
    { label: '∵', val: '\\because', title: 'Because' },
    { label: '⇒', val: '=>', title: 'Implies' },
    { label: '∈', val: '\\in', title: 'Element of' },
    { label: '∪', val: '\\cup', title: 'Union' },
    { label: '∩', val: '\\cap', title: 'Intersection' },
    { label: '⊥', val: '\\perp', title: 'Perpendicular' },
    { label: '∥', val: '\\parallel', title: 'Parallel' },
  ];

  return (
    <div style={{ background: 'rgba(30,41,59,0.85)', borderRadius: 8, padding: '6px 8px', marginBottom: 8, border: '1px solid rgba(148,163,184,0.2)' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>⌨️ ગણિત સિમ્બોલ કીબોર્ડ (ક્લિક કરીને ઉમેરો):</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
        {symbols.map((s, idx) => (
          <button
            key={idx}
            type="button"
            title={s.title}
            onClick={() => onInsert && onInsert(s.val)}
            style={{
              background: 'rgba(51,65,85,0.9)',
              color: '#f8fafc',
              border: '1px solid rgba(100,116,139,0.5)',
              borderRadius: 5,
              padding: '2px 7px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'monospace, sans-serif'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#2563eb'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(51,65,85,0.9)'}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── 👁️ Live Math Question Preview Box ─────────────────── */
export function LiveMathQuestionPreview({ qData }) {
  if (!qData || (!qData.text?.trim() && !qData.optionA?.trim())) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95))',
      border: '1.5px solid rgba(56,189,248,0.5)',
      borderRadius: 10,
      padding: '12px 14px',
      marginTop: 10,
      marginBottom: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>👁️ લાઇવ પ્રિવ્યૂ (વિદ્યાર્થી સ્ક્રીન પર આ રીતે દેખાશે):</span>
        </span>
        {Number(qData.negativeMarking) > 0 && (
          <span style={{ background: '#7f1d1d', color: '#fca5a5', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 6, border: '1px solid #dc2626' }}>
            ➖ નેગેટિવ: -{qData.negativeMarking}
          </span>
        )}
      </div>

      {/* Rendered Question Text */}
      {qData.text?.trim() && (
        <div
          style={{ color: '#f1f5f9', fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.6, marginBottom: 8 }}
          dangerouslySetInnerHTML={{ __html: formatMathText(qData.text) }}
        />
      )}

      {/* Rendered Options */}
      {qData.type === 'mcq' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {['A','B','C','D'].map(opt => {
            const optVal = qData[`option${opt}`];
            if (!optVal && !qData[`option${opt}_img`]) return null;
            const isCorrect = qData.correctOpt === opt;
            return (
              <div
                key={opt}
                style={{
                  background: isCorrect ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isCorrect ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: '0.8rem',
                  color: isCorrect ? '#4ade80' : '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <strong style={{ color: isCorrect ? '#22c55e' : '#94a3b8' }}>{opt}.</strong>
                {optVal && <span dangerouslySetInnerHTML={{ __html: formatMathText(optVal) }} />}
                {isCorrect && <span style={{ marginLeft: 'auto', fontWeight: 900, color: '#22c55e' }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════ */
export default function TeacherDashboard() {
  const { logout: logoutTeacher, teacherProfile, saveTeacherProfile } = useStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedLiveTestCode, setSelectedLiveTestCode] = useState(null);
  const [pdfModalTest, setPdfModalTest] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { toast, show: showToast } = useToast();

  const handleAnimatedLogout = () => {
    setIsLoggingOut(true);

    // Play lock sound
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {}

    setTimeout(() => {
      logoutTeacher();
      window.location.href = '/';
    }, 1550);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.test) setPdfModalTest(e.detail.test);
    };
    window.addEventListener('open-pdf-modal', handler);
    return () => window.removeEventListener('open-pdf-modal', handler);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }} className="dash-bg">

      {/* 🔒 Cinematic Vault Lockdown & Homepage Transition Overlay */}
      {isLoggingOut && typeof document !== 'undefined' && createPortal(
        <div className="vault-logout-overlay">
          <div className="vault-logout-logo-box" style={{ textAlign: 'center' }}>
            <div
              className="teacher-cyber-shield"
              style={{
                width: 90,
                height: 90,
                background: '#ffffff',
                padding: 8,
                borderRadius: 28,
                boxShadow: '0 0 50px rgba(234,179,8,0.7), 0 0 90px rgba(56,189,248,0.4)',
                border: '2.5px solid #eab308'
              }}
            >
              <div className="teacher-shield-ring" />
              <div className="teacher-shield-ring-reverse" />
              <img
                src="/trinetra-logo.png"
                alt="Trinetra Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 20
                }}
              />
            </div>
            
            <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.4rem', marginTop: 16, letterSpacing: '-0.02em', textShadow: '0 0 20px rgba(255,255,255,0.4)' }}>
              🔒 સુરક્ષિત લોગઆઉટ થઈ રહ્યું છે...
            </h2>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, marginTop: 4 }}>
              હોમ પેજ પર પુનઃદિશામાન (Redirecting to Home) ➔
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Premium Sidebar ── */}
      <aside className="dash-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 0 16px rgba(37,99,235,0.4)', padding: 2, flexShrink: 0 }}>
              <img src="/images/logo.jpg" alt="Trinetra Academy Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: '0.88rem', lineHeight: 1.2 }}>Trinetra Academy</div>
              <div style={{ color: '#22c55e', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                Teacher Portal
              </div>
            </div>
          </div>
          {/* Live Clock */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 12px', fontSize: '0.78rem', color: '#60a5fa', fontWeight: 700, border: '1px solid rgba(255,255,255,0.06)', fontVariantNumeric: 'tabular-nums' }}>
            <LiveClock />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {TABS.map(tab => (
            <button key={tab.id}
              className={`dash-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              <span style={{ fontSize: '1rem', width: 20, textAlign: 'center' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button className="dash-nav-item" onClick={handleAnimatedLogout} style={{ color: '#f87171', width: '100%', cursor: 'pointer' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="dash-main">
        {/* Top bar */}
        <div className="dash-topbar" style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 40 }}>
          <div>
            <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.8rem' }}>Teacher Dashboard / </span>
            <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>
              {TABS.find(t => t.id === activeTab)?.icon} {TABS.find(t => t.id === activeTab)?.label}
            </span>
          </div>
          <button onClick={handleAnimatedLogout} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', padding: '8px 14px', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: 'clamp(14px,3vw,22px)' }}>
          {activeTab === 'overview'  && <Overview showToast={showToast} setActiveTab={setActiveTab} teacherProfile={teacherProfile} saveTeacherProfile={saveTeacherProfile} logoutTeacher={handleAnimatedLogout} />}
          {activeTab === 'generate'  && <TestGenerate showToast={showToast} setActiveTab={setActiveTab} setSelectedLiveTestCode={setSelectedLiveTestCode} />}
          {activeTab === 'live'      && <LiveController showToast={showToast} selectedTestCode={selectedLiveTestCode} setSelectedTestCode={setSelectedLiveTestCode} />}
          {activeTab === 'materials' && <MaterialManager showToast={showToast} />}
          {activeTab === 'marketing' && <MarketingManager showToast={showToast} />}
          {activeTab === 'answers'   && <StudentAnswers showToast={showToast} />}
          {activeTab === 'students'  && <StudentLogins showToast={showToast} />}
          {activeTab === 'history'   && <TestHistory showToast={showToast} />}
        </div>
      </main>

      {/* ── Premium Mobile Bottom Nav ── */}
      <div className="dash-mobile-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`dash-mobile-nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.shortLabel || tab.label}</span>
          </button>
        ))}
      </div>

      <PdfExportModal
        isOpen={Boolean(pdfModalTest)}
        onClose={() => setPdfModalTest(null)}
        testData={pdfModalTest}
        teacherProfile={teacherProfile}
        showToast={showToast}
      />
      <Toast toast={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   OVERVIEW
═══════════════════════════════════════════════════════ */
function Overview({ showToast, setActiveTab, teacherProfile, saveTeacherProfile, logoutTeacher }) {
  const [subs, setSubs]       = useState([]);
  const [qs, setQs]           = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState({});
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(teacherProfile);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleaningLoading, setCleaningLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [subRes, qRes] = await Promise.all([getSubmissions(), getAllQuestions()]);
        const s = Array.isArray(subRes?.data) ? subRes.data : [];
        const qList = Array.isArray(qRes?.data) ? qRes.data : [];
        const today = s.filter(x => new Date(x.createdAt || x.submittedAt) > new Date(Date.now() - 86400000));
        setSubs(s); setQs(qList);
        setStats({
          students: new Set(s.map(x => x.student?.mobile).filter(Boolean)).size,
          tests: s.length,
          today: today.length,
          questions: qList.length,
          avg: s.length ? (s.reduce((a, x) => a + (x.mcqScore ?? x.score ?? 0), 0) / s.length).toFixed(1) : 0,
          pending: s.filter(x => (x.teacherMarks === null || x.teacherMarks === undefined) && (x.photoUrl || x.photoUrls?.length > 0)).length,
        });
      } catch { showToast('Stats load ન થઈ', 'error'); }
      setLoading(false);
    })();
  }, []);

  const handleSaveProfile = () => {
    saveTeacherProfile(profileForm);
    setEditProfile(false);
    showToast('Profile saved!', 'success');
  };

  // ── Gujarati Date & Time Formatting ──
  const gujaratiDays = ['રવિવાર', 'સોમવાર', 'મંગળવાર', 'બુધવાર', 'ગુરુવાર', 'શુક્રવાર', 'શનિવાર'];
  const gujaratiMonths = ['જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર'];
  const dayName = gujaratiDays[currentTime.getDay()];
  const dateNum = currentTime.getDate();
  const monthName = gujaratiMonths[currentTime.getMonth()];
  const yearNum = currentTime.getFullYear();
  const timeFormatted = currentTime.toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  // ── Active Live Test Detection ──
  const activeTestsMap = {};
  qs.filter(q => q.isActive && q.testCode).forEach(q => {
    if (!activeTestsMap[q.testCode]) {
      activeTestsMap[q.testCode] = {
        testCode: q.testCode,
        testName: q.testName || q.testCode,
        subject: q.subject || 'સામાન્ય',
        timeLimit: q.timeLimit || 60,
        questionsCount: 0
      };
    }
    activeTestsMap[q.testCode].questionsCount++;
  });
  const activeTestList = Object.values(activeTestsMap);
  const primaryActiveTest = activeTestList[0] || null;
  const activeTestSubsCount = primaryActiveTest
    ? subs.filter(s => s.testCode === primaryActiveTest.testCode).length
    : 0;

  // ── 7-Day Weekly Test Activity Calculation ──
  const last7Days = useMemo(() => {
    const days = [];
    const dayLabels = ['રવિ', 'સોમ', 'મંગળ', 'બુધ', 'ગુરુ', 'શુક્ર', 'શનિ'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const count = subs.filter(s => {
        const subDate = new Date(s.createdAt || s.submittedAt);
        return subDate >= d && subDate < nextD;
      }).length;

      days.push({
        dateStr: `${d.getDate()}/${d.getMonth()+1}`,
        dayName: dayLabels[d.getDay()],
        isToday: i === 0,
        count
      });
    }
    return days;
  }, [subs]);

  const maxDayCount = Math.max(...last7Days.map(d => d.count), 1);
  const totalWeeklyCount = last7Days.reduce((acc, d) => acc + d.count, 0);

  const CARDS = [
    { label: 'Total Students', key: 'students', grad: 'stat-grad-blue',   emoji: '👥', badge: '📈 +12% આ અઠવાડિયે', tab: 'students' },
    { label: 'Total Tests',    key: 'tests',    grad: 'stat-grad-purple', emoji: '📝', badge: '✓ ઓલ ટાઈમ', tab: 'history'  },
    { label: 'Today Tests',    key: 'today',    grad: 'stat-grad-green',  emoji: '📅', badge: '🔥 આજે સક્રિય', tab: 'history'  },
    { label: 'Question Bank',  key: 'questions',grad: 'stat-grad-orange', emoji: '❓', badge: '📚 વિષયવાર સંગ્રહ', tab: 'generate' },
    { label: 'Avg Score',      key: 'avg',      grad: 'stat-grad-cyan',   emoji: '📊', badge: '⭐ સરેરાશ સ્કોર', tab: 'history'  },
    { label: 'Grade Pending',  key: 'pending',  grad: 'stat-grad-red',    emoji: '⏳', badge: stats.pending > 0 ? '⚠️ ચેક કરો' : '✅ ક્લીયર', tab: 'answers' },
  ];

  const recentSubs   = subs.slice(0, 5);
  const topStudents  = [...subs].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', paddingBottom: 80 }}>

      {/* ── Mobile-Optimized Top Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,58,138,0.85) 50%, rgba(67,56,202,0.7) 100%)',
        borderRadius: 18,
        padding: '16px',
        marginBottom: 16,
        border: '1.5px solid rgba(59,130,246,0.3)',
        boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow Spheres */}
        <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', top: -60, right: -30, filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', bottom: -30, left: 20, filter: 'blur(30px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Row 1: Teacher Profile & Live Clock in Mobile Wrap */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* Teacher Avatar & Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, flex: 1 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 900, color: 'white',
                boxShadow: '0 0 16px rgba(124,58,237,0.4)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                flexShrink: 0
              }}>
                {teacherProfile.name?.[0]?.toUpperCase() || 'T'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span className="live-dot" style={{ width: 7, height: 7 }} />
                  <span style={{ color: '#a5b4fc', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    શિક્ષક પોર્ટલ • Trinetra
                  </span>
                </div>
                <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.15rem', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  નમસ્તે, {teacherProfile.name || 'શિક્ષક'} સાહેબ! 👋
                </h1>
                <div style={{ color: '#93c5fd', fontSize: '0.76rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎓 {teacherProfile.subject} • 🏫 {teacherProfile.academy}
                </div>
              </div>
            </div>

            {/* Live Clock & Gujarati Date Badge */}
            <div style={{
              background: 'rgba(15,23,42,0.75)',
              border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: 12,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <span style={{ fontSize: '1.2rem' }}>📅</span>
              <div>
                <div style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800 }}>
                  {dayName}, {dateNum} {monthName}
                </div>
                <div style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>⏰ {timeFormatted}</span>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(37,99,235,0.3)', padding: '1px 5px', borderRadius: 4, color: '#93c5fd' }}>લાઈવ</span>
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: Quick Shortcut Buttons Grid (Mobile 2x2 Grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setActiveTab('generate')} style={{
              background: 'linear-gradient(135deg,#2563eb,#38bdf8)', color: 'white', border: 'none',
              padding: '9px 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              boxShadow: '0 3px 10px rgba(37,99,235,0.35)', width: '100%'
            }}>
              ➕ નવી કસોટી
            </button>
            <button onClick={() => setActiveTab('live')} style={{
              background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)',
              padding: '9px 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              width: '100%'
            }}>
              🔴 Live Monitor
            </button>
            <button onClick={() => setActiveTab('marketing')} style={{
              background: 'rgba(245,158,11,0.18)', color: '#fde68a', border: '1px solid rgba(245,158,11,0.35)',
              padding: '9px 12px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              width: '100%'
            }}>
              🎨 પોસ્ટર્સ & ઑફર્સ
            </button>
            <button onClick={() => setShowCleanModal(true)} style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white', border: 'none',
              padding: '9px 12px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              boxShadow: '0 3px 10px rgba(220,38,38,0.4)', width: '100%'
            }}>
              🧹 લાઈવ લોન્ચ (ટેસ્ટ ડેટા સાફ કરો)
            </button>
            <button onClick={() => setEditProfile(!editProfile)} style={{
              background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)',
              padding: '9px 12px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              width: '100%'
            }}>
              ✏️ Profile
            </button>
          </div>

        </div>
      </div>

      {/* ── 🧹 Production Launch Clean Testing Data Modal ── */}
      {showCleanModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: 540, background: '#0f172a', border: '1.5px solid rgba(239,68,68,0.5)', borderRadius: 20, padding: 24, boxShadow: '0 25px 70px rgba(0,0,0,0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>🧹</span>
                <h3 style={{ margin: 0, color: '#f87171', fontWeight: 900, fontSize: '1.15rem' }}>
                  લાઈવ લોન્ચિંગ: ટેસ્ટિંગ ડેટા સાફ કરો
                </h3>
              </div>
              <button onClick={() => setShowCleanModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1', width: 32, height: 32, borderRadius: '50%', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 16 }}>
              પ્લેટફોર્મને વાસ્તવિક વિદ્યાર્થીઓ માટે લાઈવ કરતી વખતે અગાઉના તમામ <strong>ટેસ્ટિંગ સબમિશન્સ, ડમી સ્કોર્સ અને જૂના OTP</strong> માત્ર ૧-ક્લિકમાં સાફ થઈ જશે. તમારા બનાવેલા પ્રશ્નો અને મટીરીયલ સુરક્ષિત રહેશે.
            </p>

            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <div style={{ color: '#fca5a5', fontWeight: 800, fontSize: '0.84rem', marginBottom: 6 }}>
                ⚠️ શું સાફ થશે:
              </div>
              <div style={{ color: '#e2e8f0', fontSize: '0.82rem', lineHeight: 1.6 }}>
                • તમામ વિદ્યાર્થીઓના જૂના ટેસ્ટ પરિણામો (Submissions & Scores)<br />
                • અગાઉના તમામ એક્ટિવ અને લોગ કરેલા OTP સેશન્સ<br />
                • લીડરબોર્ડ રેન્કિંગ્સ ફ્રેશ 0 થી શરૂ થશે
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                રદ કરો (Cancel)
              </button>
              <button
                type="button"
                disabled={cleaningLoading}
                onClick={async () => {
                  setCleaningLoading(true);
                  try {
                    const res = await cleanTestData({ wipeSubmissions: true, wipeOtps: true });
                    showToast(res.data?.message || 'ટેસ્ટિંગ ડેટા સફળતાપૂર્વક સાફ થઈ ગયો!', 'success');
                    setShowCleanModal(false);
                    // Reload overview
                    setSubs([]);
                    setStats(prev => ({ ...prev, tests: 0, today: 0, avg: 0, pending: 0 }));
                  } catch (err) {
                    showToast('ડેટા સાફ કરવામાં ક્ષતિ આવી.', 'error');
                  }
                  setCleaningLoading(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: cleaningLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(220,38,38,0.4)'
                }}
              >
                {cleaningLoading ? '⏳ સાફ થઈ રહ્યું છે...' : '🧹 હા, બધો ટેસ્ટ ડેટા સાફ કરો'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit Profile Modal/Box ── */}
      {editProfile && (
        <div className="glass-card" style={{ padding: '20px', marginBottom: 20, border: '1.5px solid rgba(99,102,241,0.4)' }}>
          <h3 style={{ color: 'white', fontWeight: 800, fontSize: '1rem', marginBottom: 14 }}>
            ✏️ શિક્ષક પ્રોફાઇલ વિગતો સુધારો
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'name',          label: '👤 શિક્ષકનું નામ',       ph: 'Teacher Name' },
              { key: 'subject',       label: '📚 વિષય / સ્પેશિયાલિટી', ph: 'e.g. ગણિત, TET-2' },
              { key: 'phone',         label: '📞 સંપર્ક નંબર',         ph: '8200405300' },
              { key: 'qualification', label: '🎓 લાયકાત',              ph: 'e.g. B.Ed., M.Sc.' },
              { key: 'experience',    label: '📅 અનુભવ',               ph: 'e.g. 5+ Years' },
              { key: 'academy',       label: '🏫 એકેડેમી નામ',         ph: 'Trinetra Online Academy' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>{f.label}</label>
                <input className="input-dark"
                  placeholder={f.ph}
                  value={profileForm[f.key] || ''}
                  onChange={e => setProfileForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ padding: '10px 12px', fontSize: '0.88rem' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSaveProfile}
              style={{ background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif' }}>
              💾 સાચવો (Save Profile)
            </button>
            <button onClick={() => setEditProfile(false)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', padding: '10px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif' }}>
              રદ કરો
            </button>
          </div>
        </div>
      )}

      {/* ── Active Live Test Quick Widget ── */}
      <div style={{
        background: primaryActiveTest
          ? 'linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(15,23,42,0.9) 100%)'
          : 'linear-gradient(135deg, rgba(30,41,59,0.3) 0%, rgba(15,23,42,0.8) 100%)',
        border: primaryActiveTest ? '2px solid transparent' : '1px solid rgba(255,255,255,0.08)',
        background: primaryActiveTest
          ? 'linear-gradient(#0f172a, #0f172a) padding-box, linear-gradient(135deg, #22c55e 0%, #eab308 25%, #ef4444 50%, #a855f7 75%, #38bdf8 100%) border-box'
          : 'linear-gradient(135deg, rgba(30,41,59,0.3) 0%, rgba(15,23,42,0.8) 100%)',
        boxShadow: primaryActiveTest ? '0 0 24px rgba(239,68,68,0.35), 0 0 12px rgba(56,189,248,0.3)' : 'none',
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: primaryActiveTest ? '0 10px 30px rgba(220,38,38,0.15)' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: primaryActiveTest ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
            border: primaryActiveTest ? '1.5px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
            {primaryActiveTest ? '🔴' : '⚪'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{
                background: primaryActiveTest ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                color: primaryActiveTest ? '#f87171' : '#94a3b8',
                fontWeight: 800, fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6
              }}>
                {primaryActiveTest ? '● LIVE TEST ACTIVE' : 'NO ACTIVE TEST'}
              </span>
              {primaryActiveTest && (
                <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700 }}>
                  👨‍🎓 {activeTestSubsCount} વિદ્યાર્થીઓએ ટેસ્ટ સબમિટ કરી
                </span>
              )}
            </div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1.05rem' }}>
              {primaryActiveTest ? primaryActiveTest.testName : 'અત્યારે કોઈ કસોટી લાઈવ ચાલુ નથી'}
            </div>
            {primaryActiveTest && (
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 2 }}>
                📚 {primaryActiveTest.subject} &nbsp;|&nbsp; ⏱️ {primaryActiveTest.timeLimit} મિનિટ &nbsp;|&nbsp; 📋 {primaryActiveTest.questionsCount} પ્રશ્નો
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setActiveTab('live')}
          style={{
            background: primaryActiveTest ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'rgba(255,255,255,0.08)',
            color: 'white',
            border: primaryActiveTest ? 'none' : '1px solid rgba(255,255,255,0.15)',
            padding: '10px 20px',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: primaryActiveTest ? '0 4px 16px rgba(220,38,38,0.4)' : 'none',
            fontFamily: 'Hind Vadodara, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {primaryActiveTest ? '📊 લાઈવ મોનિટર ખોલો →' : '🚀 નવી ટેસ્ટ લાઈવ કરો →'}
        </button>
      </div>

      {/* ── Stat Cards with Trend Badges ── */}
      {loading ? <Loader /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10, marginBottom: 18 }}>
            {CARDS.map((c, i) => (
              <button
                key={i}
                className={`stat-grad-card ${c.grad}`}
                onClick={() => setActiveTab(c.tab)}
                style={{
                  width: '100%',
                  padding: '16px 14px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 115
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.4rem' }}>{c.emoji}</div>
                  <span style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.18)',
                    color: 'white',
                    backdropFilter: 'blur(4px)'
                  }}>
                    {c.badge}
                  </span>
                </div>
                <div>
                  <div className="stat-num" style={{ fontSize: 'clamp(1.3rem,3.5vw,1.8rem)', fontWeight: 900, lineHeight: 1.1, color: 'white', marginTop: 8 }}>
                    <CountUp target={stats[c.key] || 0} />
                  </div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, opacity: 0.9, marginTop: 4, color: '#e2e8f0' }}>
                    {c.label}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ── 7-Day Weekly Test Activity Chart ── */}
          <div className="glass-card" style={{ padding: '20px', marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ color: 'white', fontWeight: 800, fontSize: '0.98rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📊</span> સાપ્તાહિક કસોટી પ્રવૃત્તિ (Weekly Test Activity)
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '4px 0 0' }}>
                  છેલ્લા ૭ દિવસમાં (સોમ થી રવિ) વિદ્યાર્થીઓએ આપેલ કસોટીઓનો ગ્રાફ
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', fontSize: '0.74rem', fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>
                  📈 કુલ આ અઠવાડિયે: <strong style={{ color: 'white' }}>{totalWeeklyCount}</strong>
                </span>
                <span style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', fontSize: '0.74rem', fontWeight: 800, padding: '4px 10px', borderRadius: 8 }}>
                  ⭐ દૈનિક સરેરાશ: <strong style={{ color: 'white' }}>{(totalWeeklyCount / 7).toFixed(1)}</strong>
                </span>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 'clamp(6px, 2vw, 16px)',
              alignItems: 'flex-end',
              height: 160,
              padding: '16px 10px 0',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {last7Days.map((day, idx) => {
                const heightPercent = maxDayCount > 0 ? Math.max((day.count / maxDayCount) * 100, 8) : 8;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    {/* Top Count Tooltip Pill */}
                    <div style={{
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      color: day.isToday ? '#fbbf24' : '#93c5fd',
                      marginBottom: 6,
                      background: day.isToday ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                      padding: '2px 6px',
                      borderRadius: 6,
                      border: day.isToday ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.08)'
                    }}>
                      {day.count}
                    </div>

                    {/* Gradient Bar */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 42,
                        height: `${heightPercent}%`,
                        borderRadius: '6px 6px 2px 2px',
                        background: day.isToday
                          ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                          : day.count > 0
                            ? 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)'
                            : 'rgba(255,255,255,0.08)',
                        boxShadow: day.isToday ? '0 0 12px rgba(245,158,11,0.4)' : day.count > 0 ? '0 0 10px rgba(37,99,235,0.3)' : 'none',
                        transition: 'height 0.6s ease'
                      }}
                    />

                    {/* Day & Date Labels */}
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <div style={{ color: day.isToday ? '#fbbf24' : 'white', fontSize: '0.74rem', fontWeight: 800 }}>
                        {day.dayName}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                        {day.dateStr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
              ⚡ Quick Actions Hub
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 100px), 1fr))', gap: 8 }}>
              {[
                { label: '➕ નવો પ્રશ્ન',     tab: 'generate', from: '#1e3a8a', to: '#3b82f6', icon: '📝' },
                { label: '🔴 Live Test',        tab: 'live',     from: '#7f1d1d', to: '#ef4444', icon: '🔴' },
                { label: '📁 PDF મટીરીયલ',      tab: 'materials',from: '#4c1d95', to: '#8b5cf6', icon: '📁' },
                { label: '🎨 પોસ્ટર્સ & ઑફર્સ', tab: 'marketing',from: '#78350f', to: '#d97706', icon: '🎨' },
                { label: '📸 Grade Answers',    tab: 'answers',  from: '#064e3b', to: '#10b981', icon: '📸' },
                { label: '📊 View History',     tab: 'history',  from: '#0f172a', to: '#334155', icon: '📊' },
              ].map((a, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(a.tab)}
                  style={{
                    background: `linear-gradient(135deg,${a.from},${a.to})`,
                    color: 'white', border: 'none', borderRadius: 12,
                    padding: '14px 10px', fontWeight: 800, fontSize: '0.84rem',
                    cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif',
                    transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Bottom Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 14 }}>

            {/* Recent Tests */}
            <div className="glass-card" style={{ padding: 18 }}>
              <SectionHeader title="🕐 Recent Tests" action="All →" onAction={() => setActiveTab('history')} />
              {recentSubs.length === 0
                ? <Empty msg="No tests yet" />
                : recentSubs.map((s, i) => {
                  const pct = s.totalMarks ? Math.round((s.score / s.totalMarks) * 100) : 0;
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < recentSubs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <Avatar name={s.student?.name} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.student?.name}</div>
                        <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{new Date(s.createdAt).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.88rem', color: pct >= 60 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>{s.score}/{s.totalMarks}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{pct}%</div>
                      </div>
                    </div>
                  );
                })
              }
            </div>

            {/* Top Performers Leaderboard */}
            <div className="glass-card" style={{ padding: 18 }}>
              <SectionHeader title="🏆 Top Performers" action="All →" onAction={() => setActiveTab('history')} />
              {topStudents.length === 0
                ? <Empty msg="No data yet" />
                : topStudents.map((s, i) => {
                  const pct = s.totalMarks ? Math.round((s.score / s.totalMarks) * 100) : 0;
                  const rowClass = ['lb-row-gold','lb-row-silver','lb-row-bronze'][i] || '';
                  const medals = ['🥇','🥈','🥉'];
                  return (
                    <div key={s.id} className={rowClass} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: i < 3 ? '1.3rem' : '0.9rem', width: 24, textAlign: 'center', flexShrink: 0 }}>{medals[i] || `#${i+1}`}</span>
                      <Avatar name={s.student?.name} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.student?.name}</div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 5 }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: pct >= 60 ? '#22c55e' : '#f59e0b' }} />
                        </div>
                      </div>
                      <div style={{ color: '#22c55e', fontWeight: 900, fontSize: '0.9rem', flexShrink: 0 }}>{s.score}</div>
                    </div>
                  );
                })
              }
            </div>

            {/* Question Bank */}
            <div className="glass-card" style={{ padding: 18 }}>
              <SectionHeader title="📚 Question Bank" action="Add →" onAction={() => setActiveTab('generate')} />
              {qs.length === 0
                ? <Empty msg="No questions. Add now!" />
                : (() => {
                  const subjects = {};
                  qs.forEach(q => { subjects[q.subject || 'Other'] = (subjects[q.subject || 'Other'] || 0) + 1; });
                  const colors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#0891b2'];
                  return Object.entries(subjects).map(([subj, count], i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{subj}</span>
                        <span style={{ color: colors[i % colors.length], fontWeight: 800, fontSize: '0.85rem' }}>{count}</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                        <div style={{ height: '100%', width: `${Math.min(100,(count/qs.length)*100)}%`, borderRadius: 4, background: `linear-gradient(90deg,${colors[i % colors.length]},${colors[i % colors.length]}88)`, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  ));
                })()
              }
            </div>

            {/* Grade Alert */}
            <div className="glass-card" style={{ padding: 18, border: stats.pending > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.2)' }}>
              <h3 style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', marginBottom: 14 }}>
                {stats.pending > 0 ? '🔔 Grade Pending' : '✅ All Graded!'}
              </h3>
              {stats.pending > 0 ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: '3rem', marginBottom: 6 }}>⏳</div>
                    <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.92rem' }} className="gu-text">
                      {stats.pending} answers grade pending!
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('answers')} style={{ width: '100%', background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', color: 'white', border: 'none', padding: '13px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: '0.92rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                    📸 Grade Now →
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎉</div>
                  <div style={{ color: '#4ade80', fontWeight: 700 }} className="gu-text">બધા graded!</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PDF ➜ JSON PANEL — PDF Upload → Parse → JSON Generate
═══════════════════════════════════════════════════════ */
function PdfToJsonPanel({ showToast, onBack, setJsonText, setNewMode, setJsonTestMeta }) {
  const [pdfFile, setPdfFile]       = useState(null);
  const [parsing, setParsing]       = useState(false);
  const [rawText, setRawText]       = useState('');
  const [questions, setQs]          = useState([]);
  const [subject, setSubject]       = useState('');
  const [testName, setTestName]     = useState('');
  const [testCode, setTestCode]     = useState('TEST-' + Date.now().toString(36).toUpperCase());
  const [step, setStep]             = useState(1); // 1=upload, 2=review & edit
  const pdfRef                      = useRef(null);

  /* ── Extract text from PDF using pdfjs-dist ── */
  const extractPdfText = async (file) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page  = await pdf.getPage(i);
      const tc    = await page.getTextContent();
      const items = tc.items.map(it => it.str).join(' ');
      fullText   += items + '\n';
    }
    return fullText;
  };

  /* ── Parse extracted text into Q/Options/Answer ── */
  const parseQuestions = (text) => {
    // Normalize: collapse multiple spaces, fix line breaks
    const normalized = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();

    const parsed = [];

    // Match patterns like: "1." / "Q1." / "Q.1" / "પ્ર.1" / "(1)" at start of question
    // Split on question numbers
    const qPattern = /(?:^|\n)\s*(?:Q\.?\s*|પ્ર\.?\s*)?(\d{1,3})[.)]\s+/gm;
    const splits   = [];
    let match;
    while ((match = qPattern.exec(normalized)) !== null) {
      splits.push({ idx: match.index, num: parseInt(match[1]) });
    }

    for (let si = 0; si < splits.length; si++) {
      const start   = splits[si].idx;
      const end     = si + 1 < splits.length ? splits[si + 1].idx : normalized.length;
      const chunk   = normalized.slice(start, end).trim();

      // Extract question text (everything before first option)
      const optPattern = /\(?([AaBbCcDd1234])[.)]\s+/;
      const firstOpt   = optPattern.exec(chunk);
      let qText        = firstOpt ? chunk.slice(0, firstOpt.index).trim() : chunk;
      // Remove leading "N." prefix from question text
      qText = qText.replace(/^\s*\d{1,3}[.)]\s*/, '').trim();

      // Extract options A B C D (also handles 1 2 3 4)
      const optFull = /\(?([AaBbCcDd1-4])[.)]\s+([\s\S]*?)(?=\s*\(?[AaBbCcDd1-4][.)]\s+|$)/g;
      const opts    = {};
      let om;
      while ((om = optFull.exec(chunk)) !== null) {
        const key = om[1].toUpperCase();
        const mapped = { A:'A', B:'B', C:'C', D:'D', '1':'A', '2':'B', '3':'C', '4':'D' }[key] || key;
        opts[mapped] = om[2].trim().replace(/\s+/g, ' ');
      }

      // Try to detect answer line: "Ans: B" / "Answer: 3" / "જવાબ: A"
      const ansPattern = /(?:ans(?:wer)?|જવાબ)[:\s.]+([AaBbCcDd1-4])/i;
      const ansMx      = ansPattern.exec(chunk);
      let answer = '1';
      if (ansMx) {
        const ak = ansMx[1].toUpperCase();
        answer   = { A:'1', B:'2', C:'3', D:'4', '1':'1', '2':'2', '3':'3', '4':'4' }[ak] || '1';
      }

      if (qText.length > 3) {
        parsed.push({
          question: qText,
          optA: opts['A'] || '',
          optB: opts['B'] || '',
          optC: opts['C'] || '',
          optD: opts['D'] || '',
          answer,
        });
      }
    }
    return parsed;
  };

  const handleFileChange = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      showToast('કૃપા કરી .pdf ફાઈલ સિલેક્ટ કરો', 'error');
      return;
    }
    setPdfFile(file);
    setParsing(true);
    try {
      const text = await extractPdfText(file);
      setRawText(text);
      const qs   = parseQuestions(text);
      if (qs.length === 0) {
        showToast('⚠️ PDF માં પ્રશ્નો detect ના થયા — Manual edit કરો', 'warn');
        setQs([{ question: '', optA: '', optB: '', optC: '', optD: '', answer: '1' }]);
      } else {
        showToast(`✅ ${qs.length} પ્રશ્નો PDF માંથી extract થયા!`, 'success');
        setQs(qs);
      }
      setTestName(file.name.replace('.pdf', ''));
      setStep(2);
    } catch (err) {
      console.error(err);
      showToast('PDF extract error: ' + err.message, 'error');
    }
    setParsing(false);
  };

  const updateQ = (idx, field, val) => {
    setQs(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const addQ    = ()    => setQs(prev => [...prev, { question: '', optA: '', optB: '', optC: '', optD: '', answer: '1' }]);
  const removeQ = (idx) => setQs(prev => prev.filter((_, i) => i !== idx));

  const buildJson = () => questions.map((q, i) => ({
    id: i + 1,
    question: q.question.trim() || `પ્રશ્ન ${i + 1}`,
    image: '',
    options: [q.optA, q.optB, q.optC, q.optD],
    answer: q.answer,
  }));

  const handleSendToUpload = () => {
    const json = JSON.stringify(buildJson(), null, 2);
    setJsonTestMeta(m => ({
      ...m,
      subject:  subject || 'General',
      testName: testName || 'PDF Test',
      testCode,
    }));
    setJsonText(json);
    setNewMode('json');
    showToast('✅ PDF Questions ➜ Upload Tab માં ગયા!', 'success');
  };

  const handleDownload = () => {
    const json = JSON.stringify(buildJson(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (testCode || 'pdf-questions') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ JSON Downloaded!', 'success');
  };

  const inp = {
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(71,85,105,0.5)',
    borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', width: '100%',
    fontSize: '0.84rem', fontFamily: 'Hind Vadodara, sans-serif', boxSizing: 'border-box', outline: 'none',
  };
  const lbl = { color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block' };

  return (
    <div className="animate-fade-in" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: '#f59e0b', fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>
            📄 PDF ➜ JSON — PDF માંથી Questions Extract
          </h3>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
            Gujarati · Hindi · English · Maths · Science · SS — PDF Upload ➜ Auto Parse ➜ Review ➜ Upload
          </div>
        </div>
        <button onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
          ← Back
        </button>
      </div>

      {/* STEP 1: PDF Upload */}
      {step === 1 && (
        <div className="glass-card" style={{ padding: 28, textAlign: 'center', border: '2px dashed rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.04)', borderRadius: 16 }}>
          {parsing ? (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
              <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1rem' }}>PDF Extract થઈ રહ્યું છે...</div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 6 }}>કૃપા કરી રાહ જુઓ</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>📄</div>
              <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.05rem', marginBottom: 6 }}>
                PDF ફાઈલ Select કરો
              </div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 18, lineHeight: 1.7 }}>
                MCQ questions ધરાવતી Gujarati / Hindi / English PDF<br/>
                ➜ Auto-detect Questions, Options, Answers<br/>
                ➜ Review & Edit ➜ Upload
              </div>
              <button onClick={() => pdfRef.current?.click()}
                style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)', border: 'none', color: 'white', padding: '13px 32px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                📂 PDF Select કરો
              </button>
              <input ref={pdfRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleFileChange(e.target.files[0]); }} />
              <div style={{ marginTop: 14, color: '#475569', fontSize: '0.75rem' }}>
                ⚠️ PDF text-based હોવી જોઈએ (Scanned image PDF ધીમો/ઓછો accurate)
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Review & Edit Parsed Questions */}
      {step === 2 && (
        <>
          {/* Test Meta */}
          <div className="glass-card" style={{ padding: '16px 18px', marginBottom: 16, border: '1.5px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.88rem', marginBottom: 12 }}>
              📋 કસોટીની વિગત — {pdfFile?.name} ➜ {questions.length} પ્રશ્નો
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
              <div>
                <label style={lbl}>📚 વિષય (Subject)</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  style={{ ...inp, background: '#0d1526', color: '#fbbf24' }}>
                  {['','ગણિત (Mathematics)','વિજ્ઞાન (Science)','સામાજિક વિજ્ઞાન (SS)','ગુજરાતી (Gujarati)','હિન્દી (Hindi)','અંગ્રેજી (English)','સંસ્કૃત (Sanskrit)','ભૌતિક વિજ્ઞાન (Physics)','રસાયણ વિજ્ઞાન (Chemistry)','જીવ વિજ્ઞાન (Biology)','ઇતિહાસ (History)','ભૂગોળ (Geography)','નાગરિક શાસ્ત્ર (Civics)','Other / અન્ય'].map(s => (
                    <option key={s} value={s}>{s || '— Select Subject —'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>📝 Test Name</label>
                <input style={inp} value={testName} onChange={e => setTestName(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>🔑 Test Code</label>
                <input style={{ ...inp, fontFamily: 'monospace', color: '#38bdf8' }} value={testCode}
                  onChange={e => setTestCode(e.target.value.toUpperCase())} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={() => { setStep(1); setPdfFile(null); setRawText(''); setQs([]); }}
                  style={{ width: '100%', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                  🔄 બીજી PDF Upload
                </button>
              </div>
            </div>
          </div>

          {/* Questions Review */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((q, idx) => (
              <div key={idx} className="glass-card" style={{ padding: '14px 16px', border: '1.5px solid rgba(245,158,11,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.88rem' }}>❓ Q{idx + 1}</div>
                  <button onClick={() => removeQ(idx)}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Hind Vadodara, sans-serif' }}>
                    🗑
                  </button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>પ્રશ્ન (Question)</label>
                  <textarea style={{ ...inp, resize: 'vertical', minHeight: 52 }} rows={2}
                    value={q.question} onChange={e => updateQ(idx, 'question', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 8 }}>
                  {[['optA','(A)'],['optB','(B)'],['optC','(C)'],['optD','(D)']].map(([f, l]) => (
                    <div key={f}>
                      <label style={lbl}>{l}</label>
                      <input style={inp} value={q[f]} onChange={e => updateQ(idx, f, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ ...lbl, margin: 0, whiteSpace: 'nowrap' }}>✅ સાચો જવાબ:</label>
                  {['1','2','3','4'].map((num, oi) => {
                    const label = ['A','B','C','D'][oi];
                    const sel   = q.answer === num;
                    return (
                      <button key={num} onClick={() => updateQ(idx, 'answer', num)}
                        style={{
                          padding: '4px 13px', borderRadius: 7, cursor: 'pointer', fontWeight: 800,
                          border: sel ? '2px solid #f59e0b' : '1px solid rgba(71,85,105,0.4)',
                          background: sel ? 'rgba(245,158,11,0.25)' : 'rgba(15,23,42,0.6)',
                          color: sel ? '#fbbf24' : '#64748b', fontSize: '0.83rem',
                          fontFamily: 'Hind Vadodara, sans-serif',
                        }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add Q */}
          <button onClick={addQ}
            style={{ marginTop: 12, width: '100%', background: 'rgba(245,158,11,0.08)', border: '2px dashed rgba(245,158,11,0.35)', borderRadius: 12, padding: '13px', color: '#fbbf24', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
            ➕ નવો પ્રશ્ન ઉમેરો
          </button>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button onClick={handleDownload}
              style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', border: 'none', color: 'white', padding: '13px 20px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              ⬇️ JSON Download ({questions.length} Q)
            </button>
            <button onClick={handleSendToUpload}
              style={{ flex: 2, minWidth: 200, background: 'linear-gradient(135deg,#16a34a,#22c55e)', border: 'none', color: 'white', padding: '13px 20px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              🚀 Upload Tab માં મોકલો ➜ Test Create કરો
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   JSON BUILDER PANEL — Form ➜ Auto JSON Generate ➜ Upload
═══════════════════════════════════════════════════════ */
const SUBJECTS = [
  'ગણિત (Mathematics)',
  'વિજ્ઞાન (Science)',
  'સામાજિક વિજ્ઞાન (SS)',
  'ગુજરાતી (Gujarati)',
  'હિન્દી (Hindi)',
  'અંગ્રેજી (English)',
  'સંસ્કૃત (Sanskrit)',
  'પર્યાવરણ (Environment)',
  'કમ્પ્યૂટર (Computer)',
  'ઇતિહાસ (History)',
  'ભૂગોળ (Geography)',
  'નાગરિક શાસ્ત્ર (Civics)',
  'અર્થશાસ્ત્ર (Economics)',
  'રસાયણ વિજ્ઞાન (Chemistry)',
  'ભૌતિક વિજ્ઞાન (Physics)',
  'જીવ વિજ્ઞાન (Biology)',
  'Other / અન્ય',
];

const EMPTY_Q = (isTat = false) => ({
  question: '',
  optA: '',
  optB: '',
  optC: '',
  optD: '',
  optE: isTat ? 'ઉત્તર આપવા માંગતા નથી (Not Attempted)' : '',
  answer: '1'
});

function JsonBuilderPanel({ showToast, onBack, setJsonText, setNewMode, setJsonTestMeta }) {
  const [subject, setSubject]   = useState(SUBJECTS[0]);
  const [testName, setTestName] = useState('');
  const [testCode, setTestCode] = useState('TEST-' + Date.now().toString(36).toUpperCase());
  const [examPattern, setExamPattern] = useState('standard'); // 'standard' | 'tat'
  const [questions, setQs]      = useState([EMPTY_Q(false)]);
  const [generated, setGenerated] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const updateQ = (idx, field, val) => {
    setQs(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
    setGenerated('');
  };

  const handleToggleExamPattern = (pat) => {
    setExamPattern(pat);
    const isTat = pat === 'tat';
    setQs(prev => prev.map(q => ({
      ...q,
      optE: isTat ? (q.optE || 'ઉત્તર આપવા માંગતા નથી (Not Attempted)') : ''
    })));
    setGenerated('');
  };

  const addQ = () => { setQs(prev => [...prev, EMPTY_Q(examPattern === 'tat')]); setGenerated(''); };
  const removeQ = (idx) => { setQs(prev => prev.filter((_, i) => i !== idx)); setGenerated(''); };

  const buildJson = () => {
    const isTat = examPattern === 'tat';
    const arr = questions.map((q, i) => {
      const item = {
        id: i + 1,
        question: q.question.trim() || `પ્રશ્ન ${i + 1}`,
        image: '',
        options: isTat
          ? [q.optA, q.optB, q.optC, q.optD, q.optE || 'ઉત્તર આપવા માંગતા નથી (Not Attempted)']
          : [q.optA, q.optB, q.optC, q.optD],
        answer: q.answer,
      };
      if (isTat) {
        item.negativeMarking = 0.25;
      }
      return item;
    });
    return JSON.stringify(arr, null, 2);
  };

  const handleGenerate = () => {
    const valid = questions.filter(q => q.question.trim() && q.optA.trim() && q.optB.trim());
    if (valid.length === 0) { showToast('ઓછામાં ઓછો ૧ પ્રશ્ન અને ૨ Option ભરો.', 'error'); return; }
    const json = buildJson();
    setGenerated(json);
    setShowPreview(true);
  };

  const handleDownload = () => {
    const json = generated || buildJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (testCode || 'questions') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ JSON Downloaded!', 'success');
  };

  const handleSendToUpload = () => {
    const json = generated || buildJson();
    setJsonTestMeta(m => ({
      ...m,
      subject,
      testName: testName || (examPattern === 'tat' ? `TAT-S ${subject} Test` : `${subject} Test`),
      testCode
    }));
    setJsonText(json);
    setNewMode('json');
    showToast('✅ JSON Builder ➜ Upload Tab માં ગયો!', 'success');
  };

  const darkLbl2 = { color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4, display: 'block' };
  const inp = {
    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(71,85,105,0.5)',
    borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', width: '100%',
    fontSize: '0.84rem', fontFamily: 'Hind Vadodara, sans-serif', boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div className="animate-fade-in" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: '#22d3ee', fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>🧱 JSON Builder — ફોર્મ ભરો ➜ JSON બનાવો</h3>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
            Maths · Science · SS · Gujarati · Hindi · Sanskrit · English ··· {questions.length} પ્રશ્ન
          </div>
        </div>
        <button onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
          ← Back
        </button>
      </div>

      {/* Exam Pattern Selector in JSON Builder */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div
          onClick={() => handleToggleExamPattern('tat')}
          style={{
            background: examPattern === 'tat' ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.02)',
            border: `1.5px solid ${examPattern === 'tat' ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 12, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ color: '#e9d5ff', fontWeight: 900, fontSize: '0.88rem' }}>🎯 TAT-S / TAT-HS Pattern</div>
            <div style={{ color: '#a5b4fc', fontSize: '0.72rem' }}>૫ ઓપ્શન્સ (Option E = Skip)</div>
          </div>
          {examPattern === 'tat' && <span style={{ color: '#a855f7', fontWeight: 900, fontSize: '1.1rem' }}>✓</span>}
        </div>

        <div
          onClick={() => handleToggleExamPattern('standard')}
          style={{
            background: examPattern === 'standard' ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.02)',
            border: `1.5px solid ${examPattern === 'standard' ? '#06b6d4' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 12, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
          <div>
            <div style={{ color: '#93c5fd', fontWeight: 900, fontSize: '0.88rem' }}>📘 સામાન્ય કસોટી Pattern</div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>૪ ઓપ્શન્સ (A, B, C, D)</div>
          </div>
          {examPattern === 'standard' && <span style={{ color: '#06b6d4', fontWeight: 900, fontSize: '1.1rem' }}>✓</span>}
        </div>
      </div>

      {/* Test Info */}
      <div className="glass-card" style={{ padding: '16px 18px', marginBottom: 16, border: '1.5px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.04)' }}>
        <div style={{ color: '#22d3ee', fontWeight: 800, fontSize: '0.88rem', marginBottom: 12 }}>📋 કસોટીની વિગત (Test Info)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>
          <div>
            <label style={darkLbl2}>📚 વિષય (Subject)</label>
            <select value={subject} onChange={e => setSubject(e.target.value)} style={{ ...inp, background: '#0d1526', color: '#22d3ee' }}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={darkLbl2}>📝 કસોટીનું નામ (Test Name)</label>
            <input style={inp} value={testName} placeholder={examPattern === 'tat' ? `TAT-S ${subject} મોડેલ પેપર` : `${subject} - ટેસ્ટ`} onChange={e => setTestName(e.target.value)} />
          </div>
          <div>
            <label style={darkLbl2}>🔑 ટેસ્ટ કોડ (Test Code)</label>
            <input style={{ ...inp, fontFamily: 'monospace', color: '#38bdf8' }} value={testCode} onChange={e => setTestCode(e.target.value.toUpperCase())} />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {questions.map((q, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '16px 18px', border: '1.5px solid rgba(6,182,212,0.15)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ color: '#22d3ee', fontWeight: 800, fontSize: '0.9rem' }}>❓ Q{idx + 1}</div>
              {questions.length > 1 && (
                <button onClick={() => removeQ(idx)}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Hind Vadodara, sans-serif' }}>
                  🗑 Remove
                </button>
              )}
            </div>

            {/* Question Text */}
            <div style={{ marginBottom: 10 }}>
              <label style={darkLbl2}>પ્રશ્ન (Question Text)</label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} rows={2}
                placeholder={`${idx + 1}. પ્રશ્ન અહીં ટાઈપ કરો...`}
                value={q.question} onChange={e => updateQ(idx, 'question', e.target.value)} />
            </div>

            {/* Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 10 }}>
              {[['optA', '(A) પ્રથમ વિકલ્પ'], ['optB', '(B) બીજો વિકલ્પ'], ['optC', '(C) ત્રીજો વિકલ્પ'], ['optD', '(D) ચોથો વિકલ્પ'], ...(examPattern === 'tat' ? [['optE', '(E) ઉત્તર આપવા માંગતા નથી (Skip)']] : [])].map(([field, ph]) => (
                <div key={field} style={{ background: field === 'optE' ? 'rgba(168,85,247,0.06)' : undefined, padding: field === 'optE' ? 4 : 0, borderRadius: 8 }}>
                  <label style={{ ...darkLbl2, color: field === 'optE' ? '#c084fc' : undefined }}>{ph}</label>
                  <input style={inp} placeholder={ph} value={q[field]} onChange={e => updateQ(idx, field, e.target.value)} />
                </div>
              ))}
            </div>

            {/* Correct Answer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ ...darkLbl2, margin: 0, whiteSpace: 'nowrap' }}>✅ સાચો જવાબ:</label>
              {['1','2','3','4', ...(examPattern === 'tat' ? ['5'] : [])].map((num, oi) => {
                const label = ['A','B','C','D','E'][oi];
                const isSelected = q.answer === num;
                return (
                  <button key={num} onClick={() => updateQ(idx, 'answer', num)}
                    style={{
                      padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 800,
                      border: isSelected ? '2px solid #22d3ee' : '1px solid rgba(71,85,105,0.4)',
                      background: isSelected ? 'rgba(6,182,212,0.25)' : 'rgba(15,23,42,0.6)',
                      color: isSelected ? '#22d3ee' : '#64748b', fontSize: '0.85rem',
                      fontFamily: 'Hind Vadodara, sans-serif', transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Add Question Button */}
      <button onClick={addQ}
        style={{ marginTop: 12, width: '100%', background: 'rgba(6,182,212,0.08)', border: '2px dashed rgba(6,182,212,0.35)', borderRadius: 12, padding: '14px', color: '#22d3ee', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
        ➕ નવો પ્રશ્ન ઉમેરો (Add Question)
      </button>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button onClick={handleGenerate}
          style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#0891b2,#06b6d4)', border: 'none', color: 'white', padding: '13px 20px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.92rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
          ⚡ JSON Generate કરો ({questions.length} Q)
        </button>
        {generated && (
          <>
            <button onClick={handleDownload}
              style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', border: 'none', color: 'white', padding: '13px 20px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.92rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              ⬇️ JSON Download
            </button>
            <button onClick={handleSendToUpload}
              style={{ flex: 1, minWidth: 180, background: 'linear-gradient(135deg,#16a34a,#22c55e)', border: 'none', color: 'white', padding: '13px 20px', borderRadius: 12, fontWeight: 900, cursor: 'pointer', fontSize: '0.92rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              🚀 Upload Tab માં મોકલો & Upload કરો
            </button>
          </>
        )}
      </div>

      {/* Generated JSON Preview */}
      {showPreview && generated && (
        <div className="glass-card animate-fade-in" style={{ marginTop: 16, padding: '16px', border: '1.5px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.88rem' }}>✅ Generated JSON Preview ({questions.length} Questions)</div>
            <button onClick={() => setShowPreview(false)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
          </div>
          <pre style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '12px', fontSize: '0.72rem', color: '#a5b4fc', overflowX: 'auto', overflowY: 'auto', maxHeight: 300, border: '1px solid rgba(139,92,246,0.2)', lineHeight: 1.7, margin: 0 }}>
            {generated}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MANUAL TEST CREATOR — Multi-question + Test Details
═══════════════════════════════════════════════════════ */
function ManualTestCreator({ showToast, onDone }) {
  const genCode = () => 'TEST-' + Date.now().toString(36).toUpperCase();

  // ── Step 1: Test Info & Question Counts ───────────────
  const [step, setStep]         = useState(1); // 1=info, 2=questions
  const [testType, setTestType] = useState('mcq_only'); // 'mcq_only' | 'desc_only' | 'mixed'
  const [testInfo, setTestInfo] = useState({
    testCode:       genCode(),
    testName:       '',
    subject:        '',
    timerMode:      'no_limit',     // 'no_limit' | 'per_question' | 'total_test' (No timer by default)
    perQuestionSec: 60,             // 30, 45, 60, 90, 120, 180
    timeLimit:      0,              // 0 = No time limit
    mcqCount:       5,              // Default 5 MCQ
    descCount:      0,              // Default 0 Desc
    mcqMarks:       1,              // Marks per MCQ
    descMarks:      5,              // Marks per Descriptive
  });

  // ── Step 2: Pre-generated Question Formations ─────────
  const [qList, setQList]         = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [viewMode, setViewMode]   = useState('tabs'); // 'tabs' | 'all'
  const [saving, setSaving]       = useState(false);

  // Switch testType helpers
  const handleSelectTestType = (type) => {
    setTestType(type);
    if (type === 'mcq_only') {
      setTestInfo(t => ({ ...t, mcqCount: t.mcqCount > 0 ? t.mcqCount : 5, descCount: 0 }));
    } else if (type === 'desc_only') {
      setTestInfo(t => ({ ...t, mcqCount: 0, descCount: t.descCount > 0 ? t.descCount : 3 }));
    } else {
      setTestInfo(t => ({
        ...t,
        mcqCount: t.mcqCount > 0 ? t.mcqCount : 4,
        descCount: t.descCount > 0 ? t.descCount : 2
      }));
    }
  };

  const totalTargetQs = Number(testInfo.mcqCount || 0) + Number(testInfo.descCount || 0);
  const totalTargetMarks = (Number(testInfo.mcqCount || 0) * Number(testInfo.mcqMarks || 1)) +
                           (Number(testInfo.descCount || 0) * Number(testInfo.descMarks || 5));

  // Initialize EXACT formation of questions matching the selected count
  const handleNextToQuestions = () => {
    if (!testInfo.testName.trim()) { showToast('કસોટીનું નામ ભરો', 'error'); return; }
    if (!testInfo.subject.trim())  { showToast('વિષય ભરો', 'error'); return; }
    if (totalTargetQs <= 0)        { showToast('ઓછામાં ઓછો ૧ પ્રશ્ન સેટ કરો', 'error'); return; }

    const initialFormation = [];
    let qNumber = 1;

    // 1. Generate MCQ slots
    if (testType === 'mcq_only' || testType === 'mixed') {
      const mcqN = Number(testInfo.mcqCount || 0);
      for (let i = 0; i < mcqN; i++) {
        initialFormation.push({
          id: Date.now() + qNumber,
          num: qNumber,
          type: 'mcq',
          text: '',
          marks: Number(testInfo.mcqMarks || 1),
          optionA: '', optionB: '', optionC: '', optionD: '',
          correctOpt: 'A',
          image: '', imageUrl: '',
          optionA_img: '', optionB_img: '', optionC_img: '', optionD_img: '',
          answerHint: ''
        });
        qNumber++;
      }
    }

    // 2. Generate Descriptive slots
    if (testType === 'desc_only' || testType === 'mixed') {
      const descN = Number(testInfo.descCount || 0);
      for (let i = 0; i < descN; i++) {
        initialFormation.push({
          id: Date.now() + qNumber + 100,
          num: qNumber,
          type: 'descriptive',
          text: '',
          marks: Number(testInfo.descMarks || 5),
          image: '', imageUrl: '',
          answerHint: ''
        });
        qNumber++;
      }
    }

    setQList(initialFormation);
    setActiveIdx(0);
    setStep(2);
    showToast(`🎯 કુલ ${initialFormation.length} પ્રશ્નોનું ફોર્મેશન તૈયાર થયું!`, 'info');
  };

  const updateQuestionAtIndex = (index, field, value) => {
    setQList(prev => prev.map((q, idx) => idx === index ? { ...q, [field]: value } : q));
  };

  const updateQuestionObj = (index, updatedFields) => {
    setQList(prev => prev.map((q, idx) => idx === index ? { ...q, ...updatedFields } : q));
  };

  const filledCount = qList.filter(q => q.text && q.text.trim().length > 0).length;

  const saveAll = async () => {
    if (!testInfo.testName.trim()) { showToast('Test Name ભરો', 'error'); return; }
    if (!testInfo.subject.trim())  { showToast('Subject ભરો', 'error');   return; }

    // Validate that questions are filled
    for (let i = 0; i < qList.length; i++) {
      const q = qList[i];
      if (!q.text || !q.text.trim()) {
        setActiveIdx(i);
        showToast(`⚠️ પ્રશ્ન #${i + 1} નું લખાણ બાકી છે! કૃપા કરીને ભરો.`, 'error');
        return;
      }
      if (q.type === 'mcq' && (!q.optionA || !q.optionB)) {
        setActiveIdx(i);
        showToast(`⚠️ પ્રશ્ન #${i + 1} માં વિકલ્પો (Option A, B) ભરવા જરૂરી છે!`, 'error');
        return;
      }
    }

    setSaving(true);
    let finalTimeLimit = testInfo.timeLimit;
    if (testInfo.timerMode === 'per_question') {
      finalTimeLimit = Number(testInfo.perQuestionSec) || 60; // In seconds (<= 300)
    } else if (testInfo.timerMode === 'total_test') {
      finalTimeLimit = (Number(testInfo.timeLimit) || 60) * 60; // Total test seconds (> 300)
    } else if (testInfo.timerMode === 'no_limit') {
      finalTimeLimit = 0;
    }

    let ok = 0;
    for (const q of qList) {
      try {
        await createQuestion({
          text:        q.text,
          type:        q.type,
          subject:     testInfo.subject,
          chapter:     testInfo.testName,
          marks:       Number(q.marks || 1),
          optionA:     q.optionA || '',
          optionB:     q.optionB || '',
          optionC:     q.optionC || '',
          optionD:     q.optionD || '',
          correctOpt:  q.correctOpt || 'A',
          image:       q.image || q.imageUrl || null,
          imageUrl:    q.image || q.imageUrl || null,
          optionA_img: q.optionA_img || null,
          optionB_img: q.optionB_img || null,
          optionC_img: q.optionC_img || null,
          optionD_img: q.optionD_img || null,
          testCode:        testInfo.testCode,
          testName:        testInfo.testName,
          timeLimit:       finalTimeLimit,
          negativeMarking: Number(testInfo.negativeMarking) || 0,
          isActive:        false, // NOT live immediately; teacher controls live via Tik Box
        });
        ok++;
      } catch {}
    }

    setSaving(false);
    showToast(`🎉 કસોટી '${testInfo.testName}' તૈયાર થઈ ગઈ! તમે જ્યારે ઇચ્છો ત્યારે 'Live' ટેબમાં જઈને Tik Box દ્વારા Live કરી શકો છો.`, 'success');
    onDone(testInfo.testCode);
  };

  const curQ = qList[activeIdx] || null;

  return (
    <div className="animate-fade-in" style={{ marginBottom: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: 'white', fontWeight: 800, marginBottom: 2 }}>✍️ Create Test — Manual Mode</h3>
          <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
            Step {step}/2 — {step === 1 ? 'વિષય, સમય અને પ્રશ્નોની સંખ્યા નક્કી કરો' : `નક્કી કરેલા ${qList.length} પ્રશ્નોની રચના (${filledCount}/${qList.length} ભરાયા)`}
          </div>
        </div>
        <button onClick={onDone} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
          ← Back
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: '100%', width: step === 1 ? '50%' : '100%', background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>

      {/* ── STEP 1: Test Info & Type Selection ── */}
      {step === 1 && (
        <div className="glass-card animate-fade-in" style={{ padding: 22 }}>

          {/* 1. TEST PATTERN (EXAM CATEGORY) SELECTOR */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...darkLbl, color: '#facc15', fontSize: '0.86rem', fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🏆</span> પરીક્ષા પદ્ધતિ પસંદ કરો (EXAM PATTERN / CATEGORY) *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {/* TAT-S / TAT-HS 5 Options Pattern */}
              <div
                onClick={() => {
                  setTestInfo(t => ({
                    ...t,
                    examPattern: 'tat',
                    negativeMarking: 0.25,
                    subject: t.subject || 'TAT-S / TAT-HS'
                  }));
                }}
                style={{
                  background: testInfo.examPattern === 'tat' ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${testInfo.examPattern === 'tat' ? '#c084fc' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: testInfo.examPattern === 'tat' ? '0 0 20px rgba(168,85,247,0.35)' : 'none'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: '#e9d5ff', fontWeight: 900, fontSize: '0.95rem' }}>
                    🎯 TAT-S / TAT-HS પ્રિલિમ્સ
                  </span>
                  <span style={{ background: '#9333ea', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 8 }}>
                    ૫ ઓપ્શન
                  </span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.74rem', lineHeight: 1.4 }}>
                  ✅ Option E (Skip - 0 ગુણ) + Neg: -0.25 માર્ક્સ
                </div>
                {testInfo.examPattern === 'tat' && (
                  <span style={{ background: 'linear-gradient(135deg,#9333ea,#7e22ce)', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, marginTop: 8, display: 'inline-block' }}>
                    ✓ TAT સિસ્ટમ સક્રિય
                  </span>
                )}
              </div>

              {/* Standard 4 Options Pattern */}
              <div
                onClick={() => {
                  setTestInfo(t => ({
                    ...t,
                    examPattern: 'standard',
                    negativeMarking: 0
                  }));
                }}
                style={{
                  background: (!testInfo.examPattern || testInfo.examPattern === 'standard') ? 'rgba(37,99,235,0.22)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${(!testInfo.examPattern || testInfo.examPattern === 'standard') ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: (!testInfo.examPattern || testInfo.examPattern === 'standard') ? '0 0 20px rgba(59,130,246,0.3)' : 'none'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ color: '#93c5fd', fontWeight: 900, fontSize: '0.95rem' }}>
                    📘 સામાન્ય કસોટી (TET / અન્ય)
                  </span>
                  <span style={{ background: '#2563eb', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 8 }}>
                    ૪ ઓપ્શન
                  </span>
                </div>
                <div style={{ color: '#cbd5e1', fontSize: '0.74rem', lineHeight: 1.4 }}>
                  Standard (A, B, C, D) વિકલ્પો વાળી સરળ પદ્ધતિ
                </div>
                {(!testInfo.examPattern || testInfo.examPattern === 'standard') && (
                  <span style={{ background: '#2563eb', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, marginTop: 8, display: 'inline-block' }}>
                    ✓ સામાન્ય સિસ્ટમ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. TEST TYPE SELECTOR (MCQ ONLY vs DESC ONLY vs MIXED) */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...darkLbl, color: '#38bdf8', fontSize: '0.85rem', fontWeight: 800, marginBottom: 10 }}>
              🎯 પ્રશ્નોનું માળખું પસંદ કરો (QUESTION FORMAT) *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {/* Option 1: MCQ ONLY */}
              <div
                onClick={() => handleSelectTestType('mcq_only')}
                style={{
                  background: testType === 'mcq_only' ? 'rgba(37,99,235,0.22)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${testType === 'mcq_only' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '16px 14px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  boxShadow: testType === 'mcq_only' ? '0 0 20px rgba(59,130,246,0.3)' : 'none'
                }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>🔵</div>
                <div style={{ color: testType === 'mcq_only' ? '#93c5fd' : 'white', fontWeight: 900, fontSize: '0.95rem', marginBottom: 4 }}>
                  ફક્ત MCQ કસોટી
                </div>
                <div style={{ color: '#64748b', fontSize: '0.74rem', lineHeight: 1.4 }}>
                  {testInfo.examPattern === 'tat' ? '૫ વિકલ્પોવાળા પ્રશ્નો (A-E)' : '૪ વિકલ્પોવાળા પ્રશ્નો (A-D)'}
                </div>
                {testType === 'mcq_only' && (
                  <span style={{ background: '#2563eb', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, marginTop: 8, display: 'inline-block' }}>
                    ✓ પસંદ કરેલ
                  </span>
                )}
              </div>

              {/* Option 2: DESCRIPTIVE ONLY */}
              <div
                onClick={() => handleSelectTestType('desc_only')}
                style={{
                  background: testType === 'desc_only' ? 'rgba(217,119,6,0.22)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${testType === 'desc_only' ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '16px 14px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  boxShadow: testType === 'desc_only' ? '0 0 20px rgba(245,158,11,0.3)' : 'none'
                }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>📝</div>
                <div style={{ color: testType === 'desc_only' ? '#fcd34d' : 'white', fontWeight: 900, fontSize: '0.95rem', marginBottom: 4 }}>
                  ફક્ત વર્ણાત્મક કસોટી
                </div>
                <div style={{ color: '#64748b', fontSize: '0.74rem', lineHeight: 1.4 }}>
                  વિદ્યાર્થી ફોટો પાડી જવાબ આપશે
                </div>
                {testType === 'desc_only' && (
                  <span style={{ background: '#d97706', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, marginTop: 8, display: 'inline-block' }}>
                    ✓ પસંદ કરેલ
                  </span>
                )}
              </div>

              {/* Option 3: MIXED */}
              <div
                onClick={() => handleSelectTestType('mixed')}
                style={{
                  background: testType === 'mixed' ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${testType === 'mixed' ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '16px 14px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  boxShadow: testType === 'mixed' ? '0 0 20px rgba(168,85,247,0.3)' : 'none'
                }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>🔀</div>
                <div style={{ color: testType === 'mixed' ? '#d8b4fe' : 'white', fontWeight: 900, fontSize: '0.95rem', marginBottom: 4 }}>
                  સંયુક્ત કસોટી (Mixed)
                </div>
                <div style={{ color: '#64748b', fontSize: '0.74rem', lineHeight: 1.4 }}>
                  MCQ અને વર્ણાત્મક બંને સાથે
                </div>
                {testType === 'mixed' && (
                  <span style={{ background: '#9333ea', color: 'white', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, marginTop: 8, display: 'inline-block' }}>
                    ✓ પસંદ કરેલ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. BASIC TEST METADATA */}
          <div className="test-meta-grid">

            {/* Test Name */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={darkLbl}>કસોટીનું નામ (Test Name) *</label>
              <input className="input-dark" placeholder={testInfo.examPattern === 'tat' ? 'e.g. TAT-S ગુજરાતી વ્યાકરણ મોડેલ પેપર' : 'e.g. ગણિત Ch.3 — એકમ કસોટી'}
                value={testInfo.testName} onChange={e => setTestInfo(t => ({ ...t, testName: e.target.value }))} />
            </div>

            {/* Subject */}
            <div>
              <label style={darkLbl}>વિષય (Subject) *</label>
              <input className="input-dark" placeholder="e.g. ગણિત, TET-2, Science..."
                value={testInfo.subject} onChange={e => setTestInfo(t => ({ ...t, subject: e.target.value }))}
                list="subject-list" />
              <datalist id="subject-list">
                <option value="ગણિત" />
                <option value="વિજ્ઞાન" />
                <option value="સામ. વિજ્ઞાન" />
                <option value="ગુજરાતી" />
                <option value="અંગ્રેજી" />
                <option value="General" />
                <option value="TET-2" />
                <option value="TAT" />
                <option value="HTAT" />
              </datalist>
            </div>

            {/* Unique Test Code */}
            <div>
              <label style={darkLbl}>🔑 ટેસ્ટ આઈડી (Test ID / Code)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input-dark" placeholder="TEST-XXXXX"
                  value={testInfo.testCode} onChange={e => setTestInfo(t => ({ ...t, testCode: e.target.value.toUpperCase() }))}
                  style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '0.05em', color: '#38bdf8' }} />
                <button type="button" onClick={() => setTestInfo(t => ({ ...t, testCode: genCode() }))}
                  style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', fontFamily: 'Hind Vadodara, sans-serif' }}>
                  🔄 નવો Code
                </button>
              </div>
            </div>

            {/* Timer Selection: 2 Clear Options (Per MCQ vs Whole Test + No Limit) */}
            <div className="timer-mode-container">
              <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⏱️</span> કસોટીનો સમય કેવી રીતે સેટ કરવો છે? (Timer Options) *
              </div>

              <div className="timer-mode-grid">
                {/* Option 1: Per Question (પ્રશ્ન દીઠ સમય) */}
                <div
                  onClick={() => setTestInfo(t => ({ ...t, timerMode: 'per_question' }))}
                  className="timer-mode-card"
                  style={{
                    background: testInfo.timerMode === 'per_question' ? 'rgba(59,130,246,0.22)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${testInfo.timerMode === 'per_question' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: testInfo.timerMode === 'per_question' ? '0 0 14px rgba(59,130,246,0.25)' : 'none'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="radio" checked={testInfo.timerMode === 'per_question'} onChange={() => {}} style={{ accentColor: '#3b82f6' }} />
                    <span style={{ color: testInfo.timerMode === 'per_question' ? '#93c5fd' : 'white', fontWeight: 900, fontSize: '0.92rem' }}>
                      ⏱️ પ્રશ્ન દીઠ સમય (Per MCQ)
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                    દરેક પ્રશ્નમાં અલગ સેકન્ડ્સ કાઉન્ટડાઉન
                  </div>
                </div>

                {/* Option 2: Whole Test (આખી કસોટીનો સમય) */}
                <div
                  onClick={() => setTestInfo(t => ({ ...t, timerMode: 'total_test' }))}
                  className="timer-mode-card"
                  style={{
                    background: testInfo.timerMode === 'total_test' ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${testInfo.timerMode === 'total_test' ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: testInfo.timerMode === 'total_test' ? '0 0 14px rgba(245,158,11,0.25)' : 'none'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="radio" checked={testInfo.timerMode === 'total_test'} onChange={() => {}} style={{ accentColor: '#f59e0b' }} />
                    <span style={{ color: testInfo.timerMode === 'total_test' ? '#fcd34d' : 'white', fontWeight: 900, fontSize: '0.92rem' }}>
                      ⏳ આખી કસોટીનો સમય (Whole Test)
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                    તમામ પ્રશ્નો માટે કુલ મિનિટ્સ
                  </div>
                </div>

                {/* Option 3: No Limit (સમય મર્યાદા નથી) */}
                <div
                  onClick={() => setTestInfo(t => ({ ...t, timerMode: 'no_limit' }))}
                  className="timer-mode-card"
                  style={{
                    background: testInfo.timerMode === 'no_limit' ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${testInfo.timerMode === 'no_limit' ? '#22c55e' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: testInfo.timerMode === 'no_limit' ? '0 0 14px rgba(34,197,94,0.25)' : 'none'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="radio" checked={testInfo.timerMode === 'no_limit'} onChange={() => {}} style={{ accentColor: '#22c55e' }} />
                    <span style={{ color: testInfo.timerMode === 'no_limit' ? '#4ade80' : 'white', fontWeight: 900, fontSize: '0.92rem' }}>
                      ♾️ સમય મર્યાદા નથી (No Limit)
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                    વિદ્યાર્થી મુક્તપણે કસોટી આપી શકશે
                  </div>
                </div>
              </div>

              {/* Conditional Inputs */}
              {testInfo.timerMode === 'per_question' && (
                <div className="timer-input-row">
                  <span style={{ color: '#93c5fd', fontSize: '0.84rem', fontWeight: 800 }}>
                    ⚡ પ્રશ્ન દીઠ સેકન્ડ પસંદ કરો:
                  </span>
                  <select
                    className="input-dark"
                    value={testInfo.perQuestionSec}
                    onChange={e => setTestInfo(t => ({ ...t, perQuestionSec: Number(e.target.value) }))}
                    style={{ minWidth: 200, padding: '10px 14px', color: '#38bdf8', fontWeight: 900 }}>
                    <option value="30">⚡ 30 સેકન્ડ (Speed Test)</option>
                    <option value="45">⚡ 45 સેકન્ડ</option>
                    <option value="60">🟢 60 સેકન્ડ (૧ મિનિટ - Standard)</option>
                    <option value="90">🟢 90 સેકન્ડ (૧.૫ મિનિટ)</option>
                    <option value="120">⏳ 120 સેકન્ડ (૨ મિનિટ)</option>
                    <option value="180">⏳ 180 સેકન્ડ (૩ મિનિટ)</option>
                  </select>
                </div>
              )}

              {testInfo.timerMode === 'total_test' && (
                <div className="timer-input-row">
                  <span style={{ color: '#fcd34d', fontSize: '0.84rem', fontWeight: 800 }}>
                    ⏳ આખી કસોટીનો કુલ સમય (મિનિટમાં):
                  </span>
                  <input
                    className="input-dark"
                    type="number"
                    min={5}
                    max={300}
                    value={testInfo.timeLimit}
                    onChange={e => setTestInfo(t => ({ ...t, timeLimit: Number(e.target.value) }))}
                    style={{ width: 140, padding: '10px 14px', fontWeight: 900, color: '#fbbf24' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── QUESTION COUNTING CONFIGURATION (DYNAMIC BASED ON TEST TYPE) ── */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
            <div style={{ color: '#38bdf8', fontSize: '0.82rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔢</span> કેટલા પ્રશ્નોનું ફોર્મેશન જનરેટ કરવું છે? (EXACT QUESTION COUNT)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
              {/* MCQ Config Card */}
              {(testType === 'mcq_only' || testType === 'mixed') && (
                <div style={{ background: 'rgba(37, 99, 235, 0.12)', border: '1.5px solid rgba(37, 99, 235, 0.4)', borderRadius: 12, padding: '14px' }}>
                  <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: '0.88rem', marginBottom: 10 }}>
                    🔵 MCQ પ્રશ્નોની સંખ્યા
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ ...darkLbl, fontSize: '0.7rem' }}>સંખ્યા (Slots)</label>
                      <input className="input-dark" type="number" min={1} max={100}
                        value={testInfo.mcqCount}
                        onChange={e => setTestInfo(t => ({ ...t, mcqCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                        style={{ padding: '8px 10px', fontWeight: 800 }} />
                    </div>
                    <div>
                      <label style={{ ...darkLbl, fontSize: '0.7rem' }}>પ્રશ્ન દીઠ ગુણ</label>
                      <input className="input-dark" type="number" min={1} max={20}
                        value={testInfo.mcqMarks}
                        onChange={e => setTestInfo(t => ({ ...t, mcqMarks: Math.max(1, parseInt(e.target.value) || 1) }))}
                        style={{ padding: '8px 10px' }} />
                    </div>
                  </div>
                  <div style={{ color: '#60a5fa', fontSize: '0.74rem', fontWeight: 700, marginTop: 8 }}>
                    કુલ MCQ ગુણ: {Number(testInfo.mcqCount || 0) * Number(testInfo.mcqMarks || 1)}
                  </div>
                  <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8 }}>
                    <label style={{ ...darkLbl, fontSize: '0.7rem' }}>➖ નેગેટિવ માર્કિંગ (Negative Marking)</label>
                    <select className="input-dark" value={testInfo.negativeMarking || 0} onChange={e => setTestInfo(t => ({ ...t, negativeMarking: parseFloat(e.target.value) }))} style={{ padding: '7px 10px', fontSize: '0.8rem' }}>
                      <option value={0}>🚫 0 (No Negative Marking)</option>
                      <option value={0.25}>➖ -0.25 (1/4 Neg)</option>
                      <option value={0.33}>➖ -0.33 (1/3 Neg)</option>
                      <option value={0.5}>➖ -0.50 (1/2 Neg)</option>
                      <option value={1}>➖ -1.00 (1 Mark Neg)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Descriptive Config Card */}
              {(testType === 'desc_only' || testType === 'mixed') && (
                <div style={{ background: 'rgba(217, 119, 6, 0.12)', border: '1.5px solid rgba(217, 119, 6, 0.4)', borderRadius: 12, padding: '14px' }}>
                  <div style={{ color: '#fcd34d', fontWeight: 800, fontSize: '0.88rem', marginBottom: 10 }}>
                    📝 Descriptive પ્રશ્નોની સંખ્યા
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ ...darkLbl, fontSize: '0.7rem' }}>સંખ્યા (Slots)</label>
                      <input className="input-dark" type="number" min={1} max={50}
                        value={testInfo.descCount}
                        onChange={e => setTestInfo(t => ({ ...t, descCount: Math.max(1, parseInt(e.target.value) || 1) }))}
                        style={{ padding: '8px 10px', fontWeight: 800 }} />
                    </div>
                    <div>
                      <label style={{ ...darkLbl, fontSize: '0.7rem' }}>પ્રશ્ન દીઠ ગુણ</label>
                      <input className="input-dark" type="number" min={1} max={50}
                        value={testInfo.descMarks}
                        onChange={e => setTestInfo(t => ({ ...t, descMarks: Math.max(1, parseInt(e.target.value) || 1) }))}
                        style={{ padding: '8px 10px' }} />
                    </div>
                  </div>
                  <div style={{ color: '#fbbf24', fontSize: '0.74rem', fontWeight: 700, marginTop: 8 }}>
                    કુલ Descriptive ગુણ: {Number(testInfo.descCount || 0) * Number(testInfo.descMarks || 5)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info & Total Preview Banner */}
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 800, marginBottom: 8 }}>📌 કસોટી સમરી (Test Summary)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
              {[
                { l: 'ટેસ્ટ નામ',    v: testInfo.testName || '—', e: '📝' },
                { l: 'વિષય',        v: testInfo.subject  || '—', e: '📚' },
                { l: 'કુલ પ્રશ્નો',   v: `${totalTargetQs} (${testType === 'mcq_only' ? `${testInfo.mcqCount} MCQ` : testType === 'desc_only' ? `${testInfo.descCount} Desc` : `${testInfo.mcqCount} MCQ + ${testInfo.descCount} Desc`})`, e: '❓' },
                { l: 'કુલ ગુણ',      v: `${totalTargetMarks} Marks`, e: '🎯' },
                { l: 'સમય',         v: testInfo.timerMode === 'no_limit' ? 'No Limit' : testInfo.timerMode === 'per_question' ? `${testInfo.perQuestionSec}s / પ્રશ્ન` : `${testInfo.timeLimit} Min (કુલ)`, e: '⏱' },
                { l: 'ટેસ્ટ કોડ',    v: testInfo.testCode, e: '🔑' },
              ].map((x, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>{x.e} {x.l}</div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleNextToQuestions}
            style={{ width: '100%', background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)', color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: '1rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
            આગળ વધો → બરાબર {totalTargetQs} પ્રશ્નોનું ફોર્મેશન તૈયાર કરો 🚀
          </button>
        </div>
      )}

      {/* ── STEP 2: EXACT QUESTION FORMATION (ONLY SELECTED COUNT GENERATED) ── */}
      {step === 2 && (
        <div>
          {/* Top Question Navigation Strip & Controls */}
          <div className="glass-card animate-fade-in" style={{ padding: '14px 18px', marginBottom: 14, border: '1px solid rgba(99,102,241,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 900, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📋</span> નક્કી કરેલા {qList.length} પ્રશ્નોનું ફોર્મેશન:
                  <span style={{ background: filledCount === qList.length ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', color: filledCount === qList.length ? '#4ade80' : '#fbbf24', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                    {filledCount} / {qList.length} ભરાયા {filledCount === qList.length && '✅ બધા પૂર્ણ'}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 2 }}>
                  {testInfo.testName} • {testInfo.subject} • કોડ: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{testInfo.testCode}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setViewMode(v => v === 'tabs' ? 'all' : 'tabs')}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Hind Vadodara, sans-serif' }}>
                  {viewMode === 'tabs' ? '📄 બધા પ્રશ્નો એકસાથે જુઓ' : '🔲 ૧-by-૧ ટેબ મોડ'}
                </button>
                <button onClick={() => setStep(1)}
                  style={{ color: '#a5b4fc', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Hind Vadodara, sans-serif' }}>
                  ✏️ સંખ્યા બદલો
                </button>
              </div>
            </div>

            {/* Interactive Question Pills (Click to jump to any question) */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {qList.map((q, idx) => {
                const isFilled = q.text && q.text.trim().length > 0;
                const isActive = activeIdx === idx && viewMode === 'tabs';

                return (
                  <button key={q.id || idx} type="button"
                    onClick={() => { setActiveIdx(idx); setViewMode('tabs'); }}
                    style={{
                      flexShrink: 0,
                      minWidth: 44,
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: isActive ? '2px solid #3b82f6' : (isFilled ? '1.5px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.08)'),
                      background: isActive ? 'rgba(59,130,246,0.3)' : (isFilled ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)'),
                      color: isActive ? '#93c5fd' : (isFilled ? '#4ade80' : '#94a3b8'),
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s'
                    }}>
                    <span>Q{idx + 1}</span>
                    {isFilled ? <span style={{ fontSize: '0.7rem' }}>✓</span> : <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>•</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* VIEW MODE 1: ONE-BY-ONE TAB MODE */}
          {viewMode === 'tabs' && curQ && (
            <div className="glass-card animate-fade-in" style={{ padding: 22, marginBottom: 16, border: '1.5px solid rgba(59,130,246,0.3)' }}>
              
              {/* Slot Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: curQ.type === 'mcq' ? 'rgba(59,130,246,0.3)' : 'rgba(217,119,6,0.3)', color: curQ.type === 'mcq' ? '#60a5fa' : '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900 }}>
                    {activeIdx + 1}
                  </span>
                  <span style={{ background: curQ.type === 'mcq' ? 'rgba(59,130,246,0.2)' : 'rgba(217,119,6,0.2)', color: curQ.type === 'mcq' ? '#60a5fa' : '#fbbf24', fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: 8 }}>
                    {curQ.type === 'mcq' ? '🔵 MCQ QUESTION' : '📝 DESCRIPTIVE QUESTION'} ({activeIdx + 1} of {qList.length})
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ ...darkLbl, margin: 0, fontSize: '0.74rem' }}>ગુણ (Marks):</label>
                  <input className="input-dark" type="number" min={1} max={50}
                    value={curQ.marks}
                    onChange={e => updateQuestionAtIndex(activeIdx, 'marks', Number(e.target.value))}
                    style={{ width: 70, padding: '6px 8px', textAlign: 'center', fontWeight: 800 }} />
                </div>
              </div>

              {/* Math Symbol Toolbar for Question Text */}
              <MathSymbolToolbar onInsert={(sym) => updateQuestionAtIndex(activeIdx, 'text', (curQ.text || '') + (curQ.text && !curQ.text.endsWith(' ') ? ' ' : '') + sym)} />

              {/* Question Text */}
              <div style={{ marginBottom: 14 }}>
                <label style={darkLbl}>પ્રશ્નનું લખાણ (Question Text) *</label>
                <textarea className="input-dark" rows={3}
                  placeholder={curQ.type === 'mcq'
                    ? `પ્રશ્ન #${activeIdx + 1} અહીં લખો... (દા.ત. (3x+2)/3x અથવા \overline{MN})`
                    : `વર્ણાત્મક પ્રશ્ન #${activeIdx + 1} અહીં લખો... (વિદ્યાર્થી નોટબુકમાં લખી ફોટો અપલોડ કરશે)`}
                  value={curQ.text}
                  onChange={e => updateQuestionAtIndex(activeIdx, 'text', e.target.value)}
                  style={{ resize: 'vertical' }} />
              </div>

              {/* Question Image (Optional) */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8' }}>
                    <ImageIcon size={14} /> પ્રશ્નની આકૃતિ / ફોટો (Question Image - Optional)
                  </label>
                  {(curQ.image || curQ.imageUrl) && (
                    <button type="button" onClick={() => updateQuestionObj(activeIdx, { image: '', imageUrl: '' })}
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                      <Trash2 size={12} /> 🗑️ ફોટો દૂર કરો
                    </button>
                  )}
                </div>

                {(curQ.image || curQ.imageUrl) ? (
                  <div style={{ textAlign: 'center', padding: '8px', background: '#000', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                    <img src={curQ.image || curQ.imageUrl} alt="preview" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 6 }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      📁 ફોટો પસંદ કરો
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const r = new FileReader();
                          r.onload = ev => updateQuestionObj(activeIdx, { image: ev.target.result, imageUrl: ev.target.result });
                          r.readAsDataURL(file);
                          e.target.value = '';
                        }} />
                    </label>
                    <input className="input-dark" style={{ flex: 1, minWidth: 160, fontSize: '0.75rem', padding: '8px 10px' }}
                      placeholder="અથવા Image URL / Base64 પેસ્ટ કરો..."
                      value={curQ.image || curQ.imageUrl || ''}
                      onChange={e => updateQuestionObj(activeIdx, { image: e.target.value, imageUrl: e.target.value })} />
                  </div>
                )}
              </div>

              {/* MCQ Options (ONLY IF MCQ) */}
              {curQ.type === 'mcq' && (
                <div className="animate-fade-in">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 14 }}>
                    {(testInfo.examPattern === 'tat' ? ['A','B','C','D','E'] : ['A','B','C','D']).map(opt => (
                      <div key={opt} style={{ background: opt === 'E' ? 'rgba(147,51,234,0.08)' : undefined, padding: opt === 'E' ? 6 : 0, borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <label style={{ ...darkLbl, color: curQ.correctOpt === opt ? '#22c55e' : (opt === 'E' ? '#c084fc' : '#94a3b8'), margin: 0 }}>
                            Option {opt} {curQ.correctOpt === opt && '✓ સાચો જવાબ'} {opt === 'E' && '(Skip)'}
                          </label>
                          {curQ[`option${opt}_img`] && (
                            <button type="button" onClick={() => updateQuestionAtIndex(activeIdx, `option${opt}_img`, '')}
                              style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }} title="Delete Option Image">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <input className="input-dark" placeholder={opt === 'E' ? 'ઉત્તર આપવા માંગતા નથી (Not Attempted)' : `Option ${opt}`}
                          value={curQ[`option${opt}`]}
                          onChange={e => updateQuestionAtIndex(activeIdx, `option${opt}`, e.target.value)}
                          style={{ borderColor: curQ.correctOpt === opt ? 'rgba(34,197,94,0.4)' : (opt === 'E' ? 'rgba(168,85,247,0.3)' : undefined), marginBottom: 4 }} />

                        {curQ[`option${opt}_img`] ? (
                          <img src={curQ[`option${opt}_img`]} alt={`Opt ${opt}`} style={{ maxHeight: 50, maxWidth: '100%', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} />
                        ) : (
                          <label style={{ fontSize: '0.68rem', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            + ફોટો
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const r = new FileReader();
                                r.onload = ev => updateQuestionAtIndex(activeIdx, `option${opt}_img`, ev.target.result);
                                r.readAsDataURL(file);
                                e.target.value = '';
                              }} />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={darkLbl}>✅ સાચો વિકલ્પ (Correct Option) પસંદ કરો</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(testInfo.examPattern === 'tat' ? ['A','B','C','D','E'] : ['A','B','C','D']).map(opt => (
                        <button key={opt} type="button"
                          onClick={() => updateQuestionAtIndex(activeIdx, 'correctOpt', opt)}
                          style={{ flex: 1, minWidth: 60, height: 46, borderRadius: 10, border: `2px solid ${curQ.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: curQ.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.04)', color: curQ.correctOpt === opt ? '#22c55e' : '#64748b', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', transition: 'all 0.15s', fontFamily: 'Hind Vadodara, sans-serif' }}>
                          {opt} {curQ.correctOpt === opt && '✓'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Descriptive Guidelines (ONLY IF DESCRIPTIVE) */}
              {curQ.type === 'descriptive' && (
                <div className="animate-fade-in">
                  <div style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.82rem', marginBottom: 4 }}>📸 વર્ણાત્મક પ્રશ્ન સૂચના</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.6 }}>
                      વિદ્યાર્થી પરીક્ષા વખતે ઉત્તરપત્રનો ફોટો અપલોડ કરશે અને તમે Answers માં મેન્યુઅલ માર્ક્સ આપશો.
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={darkLbl}>📌 Reference Answer / Hint (શિક્ષક માટે સંદર્ભ જવાબ - વૈકલ્પિક)</label>
                    <textarea className="input-dark" rows={2}
                      placeholder="શિક્ષક માટે સંદર્ભ જવાબ..."
                      value={curQ.answerHint || ''}
                      onChange={e => updateQuestionAtIndex(activeIdx, 'answerHint', e.target.value)}
                      style={{ resize: 'vertical' }} />
                  </div>
                </div>
              )}

              {/* 👁️ Live Math Preview Box */}
              <LiveMathQuestionPreview qData={{ ...curQ, negativeMarking: testInfo.negativeMarking }} />

              {/* Prev / Next Navigation Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10 }}>
                <button type="button" disabled={activeIdx === 0}
                  onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: activeIdx === 0 ? '#475569' : '#cbd5e1', padding: '10px 18px', borderRadius: 10, cursor: activeIdx === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                  ← અગાઉનો પ્રશ્ન (Q{activeIdx})
                </button>

                {activeIdx < qList.length - 1 ? (
                  <button type="button"
                    onClick={() => setActiveIdx(i => Math.min(qList.length - 1, i + 1))}
                    style={{ background: 'linear-gradient(135deg,#1e3a8a,#3b82f6)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.88rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                    આગળનો પ્રશ્ન (Q{activeIdx + 2}) →
                  </button>
                ) : (
                  <span style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 800 }}>
                    🏁 છેલ્લો પ્રશ્ન પહોંચી ગયા
                  </span>
                )}
              </div>

            </div>
          )}

          {/* VIEW MODE 2: ALL QUESTIONS ON ONE SCROLLABLE PAGE */}
          {viewMode === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              {qList.map((q, idx) => (
                <div key={q.id || idx} className="glass-card animate-fade-in" style={{ padding: 18, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: q.type === 'mcq' ? 'rgba(59,130,246,0.3)' : 'rgba(217,119,6,0.3)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900 }}>
                        {idx + 1}
                      </span>
                      <span style={{ color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>
                        {q.type.toUpperCase()} QUESTION #{idx + 1}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ ...darkLbl, margin: 0, fontSize: '0.7rem' }}>ગુણ:</label>
                      <input className="input-dark" type="number" min={1} max={50} value={q.marks}
                        onChange={e => updateQuestionAtIndex(idx, 'marks', Number(e.target.value))}
                        style={{ width: 60, padding: '4px 6px', textAlign: 'center' }} />
                    </div>
                  </div>

                  <textarea className="input-dark" rows={2} placeholder={`પ્રશ્ન #${idx + 1} લખો...`}
                    value={formatMathText(q.text)} onChange={e => updateQuestionAtIndex(idx, 'text', e.target.value)}
                    style={{ marginBottom: 10 }} />

                  {q.type === 'mcq' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                      {['A','B','C','D'].map(opt => (
                        <div key={opt}>
                          <input className="input-dark" placeholder={`Option ${opt}`} value={q[`option${opt}`]}
                            onChange={e => updateQuestionAtIndex(idx, `option${opt}`, e.target.value)}
                            style={{ borderColor: q.correctOpt === opt ? '#22c55e' : undefined, fontSize: '0.8rem', padding: '6px 8px' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Finish & Save Test Button */}
          <button onClick={saveAll} disabled={saving}
            style={{ width: '100%', background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '16px', borderRadius: 14, fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '1.05rem', fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(5,150,105,0.4)' }}>
            {saving
              ? <><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> સેવ થઈ રહ્યું છે...</>
              : <>🚀 કસોટી પૂર્ણ કરો અને સેવ કરો (બરાબર {qList.length} પ્રશ્નો • {qList.reduce((a,q)=>a + Number(q.marks || 1),0)} ગુણ)</>
            }
          </button>
        </div>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EXISTING TEST EDITOR — Edit Old Test, Questions & Images
═══════════════════════════════════════════════════════ */
function ExistingTestEditor({ test, showToast, onBack, onSaved, onGoLive }) {
  const { teacherProfile } = useStore();
  const [testData, setTestData]     = useState(test);
  const [editingQId, setEditingQId] = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [showAdd, setShowAdd]       = useState(false);
  const [newQ, setNewQ]             = useState({
    text: '', type: 'mcq', optionA: '', optionB: '', optionC: '', optionD: '', correctOpt: 'A', marks: 1, image: '', imageUrl: '', optionA_img: '', optionB_img: '', optionC_img: '', optionD_img: ''
  });

  const handleSaveQuestion = async (qId) => {
    try {
      await updateQuestion(qId, editForm);
      showToast('✅ પ્રશ્ન સુધારી લેવાયો!', 'success');
      setEditingQId(null);
      setTestData(prev => ({
        ...prev,
        questions: prev.questions.map(q => q.id === qId ? { ...q, ...editForm } : q)
      }));
      if (onSaved) onSaved();
    } catch {
      showToast('પ્રશ્ન સુધારવામાં ક્ષતિ.', 'error');
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!confirm('આ પ્રશ્ન ડીલીટ કરવો છે?')) return;
    try {
      await deleteQuestion(qId);
      showToast('પ્રશ્ન દૂર થયો.', 'success');
      setTestData(prev => ({
        ...prev,
        questions: prev.questions.filter(q => q.id !== qId)
      }));
      if (onSaved) onSaved();
    } catch {
      showToast('ડીલીટ કરવામાં ક્ષતિ.', 'error');
    }
  };

  const handleRemoveQuestionImage = async (qId) => {
    if (!confirm('આ પ્રશ્નનો ફોટો દૂર કરવો છે?')) return;
    try {
      await updateQuestion(qId, { image: '', imageUrl: '' });
      showToast('ફોટો દૂર થયો.', 'success');
      setTestData(prev => ({
        ...prev,
        questions: prev.questions.map(q => q.id === qId ? { ...q, image: '', imageUrl: '' } : q)
      }));
      if (onSaved) onSaved();
    } catch {
      showToast('ક્ષતિ.', 'error');
    }
  };

  const handleAddQuestion = async () => {
    if (!newQ.text.trim()) { showToast('Question text ભરો', 'error'); return; }
    if (newQ.type === 'mcq' && !newQ.optionA) { showToast('Option A ભરો', 'error'); return; }

    try {
      const payload = {
        ...newQ,
        subject:   testData.subject,
        chapter:   testData.testName,
        testCode:  testData.testCode,
        testName:  testData.testName,
        timeLimit: testData.timeLimit,
        isActive:  false,
      };
      const res = await createQuestion(payload);
      showToast('✅ નવો પ્રશ્ન ઉમેરાયો!', 'success');
      setShowAdd(false);
      setNewQ({
        text: '', type: 'mcq', optionA: '', optionB: '', optionC: '', optionD: '', correctOpt: 'A', marks: 1, image: '', imageUrl: '', optionA_img: '', optionB_img: '', optionC_img: '', optionD_img: ''
      });
      if (res.data?.question) {
        setTestData(prev => ({
          ...prev,
          questions: [...prev.questions, res.data.question]
        }));
      }
      if (onSaved) onSaved();
    } catch {
      showToast('પ્રશ્ન ઉમેરવામાં ક્ષતિ.', 'error');
    }
  };

  return (
    <div className="animate-fade-in" style={{ marginBottom: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: 6 }}>
              ✏️ EDIT TEST
            </span>
            {(() => {
              const testStr = `${testData.testName || ''} ${testData.subject || ''} ${testData.testCode || ''}`.toUpperCase();
              const isTat = testStr.includes('TAT-S') || testStr.includes('TAT-HS') || testStr.includes('TAT S') || testStr.includes('TAT HS');
              return isTat ? (
                <span style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(147,51,234,0.35))', border: '1px solid #a855f7', color: '#e9d5ff', fontSize: '0.74rem', fontWeight: 900, padding: '3px 10px', borderRadius: 12 }}>
                  🎯 TAT-S / TAT-HS Pattern (5 Options + Option E Skip)
                </span>
              ) : (
                <span style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: 12 }}>
                  📘 સામાન્ય પેટર્ન (4 Options A-D)
                </span>
              );
            })()}
            <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>
              {testData.testName}
            </h3>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 3 }}>
            વિષય: {testData.subject} • કોડ: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{testData.testCode}</span> • {testData.questions.length} પ્રશ્નો
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => exportTestPDF(testData, teacherProfile)}
            style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', padding: '8px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif' }}>
            <Download size={14} /> PDF Download
          </button>
          <button onClick={() => onGoLive(testData.testCode)}
            style={{ background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif' }}>
            <Play size={14} fill="white" /> Live કરો
          </button>
          <button onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
            ← પાછા જાઓ
          </button>
        </div>
      </div>

      {/* Test Meta Settings Editor (Time Limit, Test Name, Subject) */}
      <div className="glass-card animate-fade-in" style={{ padding: '14px 18px', marginBottom: 18, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}>
        <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.86rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⚙️</span> કસોટી સેટિંગ્સ & સમય મર્યાદા (Test Settings & Timer):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ ...darkLbl, fontSize: '0.72rem' }}>કસોટીનું નામ</label>
            <input className="input-dark" value={testData.testName || ''} onChange={e => setTestData(d => ({ ...d, testName: e.target.value }))} style={{ padding: '7px 10px', fontSize: '0.82rem' }} />
          </div>
          <div>
            <label style={{ ...darkLbl, fontSize: '0.72rem' }}>વિષય (Subject)</label>
            <input className="input-dark" value={testData.subject || ''} onChange={e => setTestData(d => ({ ...d, subject: e.target.value }))} style={{ padding: '7px 10px', fontSize: '0.82rem' }} />
          </div>
          <div>
            <label style={{ ...darkLbl, fontSize: '0.72rem' }}>સમય મર્યાદા (Timer)</label>
            <select
              className="input-dark"
              value={testData.timeLimit === 0 ? 0 : testData.timeLimit <= 300 ? testData.timeLimit : testData.timeLimit}
              onChange={e => setTestData(d => ({ ...d, timeLimit: Number(e.target.value) }))}
              style={{ padding: '7px 10px', fontSize: '0.82rem' }}>
              <option value={0}>♾️ સમય મર્યાદા નથી (No Limit)</option>
              <option value={30}>⏱️ 30 સેકન્ડ / પ્રશ્ન</option>
              <option value={45}>⏱️ 45 સેકન્ડ / પ્રશ્ન</option>
              <option value={60}>⏱️ 60 સેકન્ડ / પ્રશ્ન</option>
              <option value={90}>⏱️ 90 સેકન્ડ / પ્રશ્ન</option>
              <option value={120}>⏱️ 120 સેકન્ડ / પ્રશ્ન</option>
              <option value={900}>⏳ 15 મિનિટ (આખી કસોટી)</option>
              <option value={1800}>⏳ 30 મિનિટ (આખી કસોટી)</option>
              <option value={2700}>⏳ 45 મિનિટ (આખી કસોટી)</option>
              <option value={3600}>⏳ 60 મિનિટ (આખી કસોટી)</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button
              onClick={async () => {
                try {
                  await updateTestMeta(testData.testCode, {
                    testName: testData.testName,
                    subject: testData.subject,
                    timeLimit: testData.timeLimit
                  });
                  showToast('✅ કસોટી સેટિંગ્સ સેવ થઈ ગઈ!', 'success');
                  if (onSaved) onSaved();
                } catch {
                  showToast('સેવ કરવામાં ભૂલ.', 'error');
                }
              }}
              style={{ width: '100%', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', padding: '9px 14px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              💾 સેટિંગ્સ સેવ કરો
            </button>
          </div>
        </div>
      </div>

      {/* Add Question Button Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ color: '#a5b4fc', fontSize: '0.88rem', fontWeight: 800 }}>
          📋 કસોટીના પ્રશ્નો ({testData.questions.length}):
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif' }}>
          <Plus size={14} /> {showAdd ? 'Cancel' : '➕ નવો પ્રશ્ન ઉમેરો'}
        </button>
      </div>

      {/* Add Question Form */}
      {showAdd && (
        <div className="glass-card animate-fade-in" style={{ padding: 18, marginBottom: 18, border: '1.5px solid rgba(59,130,246,0.4)', background: 'rgba(59,130,246,0.05)' }}>
          <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: '0.92rem', marginBottom: 12 }}>
            ➕ આ કસોટીમાં નવો પ્રશ્ન ઉમેરો:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={darkLbl}>Type</label>
              <select className="input-dark" value={newQ.type} onChange={e => setNewQ(q => ({ ...q, type: e.target.value }))}>
                <option value="mcq">🔵 MCQ</option>
                <option value="descriptive">📝 Descriptive</option>
              </select>
            </div>
            <div>
              <label style={darkLbl}>Marks</label>
              <input className="input-dark" type="number" min={1} max={50} value={newQ.marks} onChange={e => setNewQ(q => ({ ...q, marks: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={darkLbl}>Negative Marking</label>
              <select className="input-dark" value={newQ.negativeMarking || 0} onChange={e => setNewQ(q => ({ ...q, negativeMarking: parseFloat(e.target.value) }))}>
                <option value={0}>🚫 0 (No Negative)</option>
                <option value={0.25}>➖ -0.25 (1/4 Neg)</option>
                <option value={0.33}>➖ -0.33 (1/3 Neg)</option>
                <option value={0.5}>➖ -0.50 (1/2 Neg)</option>
                <option value={1}>➖ -1.00 (1 Mark Neg)</option>
              </select>
            </div>
          </div>

          {/* Math Symbol Toolbar */}
          <MathSymbolToolbar onInsert={(sym) => setNewQ(q => ({ ...q, text: (q.text || '') + (q.text && !q.text.endsWith(' ') ? ' ' : '') + sym }))} />

          <div style={{ marginBottom: 10 }}>
            <label style={darkLbl}>Question Text *</label>
            <textarea className="input-dark" rows={2} placeholder="પ્રશ્ન અહીં લખો... (દા.ત. (3x+2)/3x અથવા \overline{MN})" value={newQ.text} onChange={e => setNewQ(q => ({ ...q, text: e.target.value }))} />
          </div>

          {/* Question Image */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8' }}>
                <ImageIcon size={14} /> પ્રશ્નનો ફોટો / આકૃતિ (Question Image - Optional)
              </label>
              {(newQ.image || newQ.imageUrl) && (
                <button type="button" onClick={() => setNewQ(q => ({ ...q, image: '', imageUrl: '' }))}
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                  <Trash2 size={12} /> 🗑️ ફોટો દૂર કરો
                </button>
              )}
            </div>

            {(newQ.image || newQ.imageUrl) ? (
              <div style={{ textAlign: 'center', padding: '8px', background: '#000', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                <img src={newQ.image || newQ.imageUrl} alt="preview" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 6 }} />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📁 કમ્પ્યુટરમાંથી ફોટો સિલેક્ટ કરો
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const r = new FileReader();
                      r.onload = ev => setNewQ(q => ({ ...q, image: ev.target.result, imageUrl: ev.target.result }));
                      r.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                </label>
                <input className="input-dark" style={{ flex: 1, minWidth: 160, fontSize: '0.75rem', padding: '8px 10px' }}
                  placeholder="અથવા Image URL / Base64 પેસ્ટ કરો..."
                  value={newQ.image || newQ.imageUrl || ''}
                  onChange={e => setNewQ(q => ({ ...q, image: e.target.value, imageUrl: e.target.value }))} />
              </div>
            )}
          </div>

          {/* MCQ Options */}
          {newQ.type === 'mcq' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 10 }}>
                {['A','B','C','D','E'].map(opt => (
                  <div key={opt} style={{ background: opt === 'E' ? 'rgba(100,116,139,0.08)' : undefined, padding: opt === 'E' ? 6 : 0, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <label style={{ ...darkLbl, fontSize: '0.68rem', margin: 0, color: opt === 'E' ? '#94a3b8' : undefined }}>
                        Option {opt} {opt === 'E' && '(Skip / Not Attempted)'}
                      </label>
                      {newQ[`option${opt}_img`] && (
                        <button type="button" onClick={() => setNewQ(q => ({ ...q, [`option${opt}_img`]: '' }))}
                          style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }} title="Delete Option Image">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <input
                      className="input-dark"
                      placeholder={opt === 'E' ? 'ઉત્તર આપવા માંગતા નથી (Not Attempted)' : `Option ${opt}`}
                      value={newQ[`option${opt}`]}
                      onChange={e => setNewQ(q => ({ ...q, [`option${opt}`]: e.target.value }))}
                      style={{ marginBottom: 4 }}
                    />
                    {newQ[`option${opt}_img`] ? (
                      <img src={newQ[`option${opt}_img`]} alt={`Opt ${opt}`} style={{ maxHeight: 50, maxWidth: '100%', borderRadius: 4 }} />
                    ) : (
                      <label style={{ fontSize: '0.68rem', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        + ફોટો ઉમેરો
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const r = new FileReader();
                            r.onload = ev => setNewQ(q => ({ ...q, [`option${opt}_img`]: ev.target.result }));
                            r.readAsDataURL(file);
                            e.target.value = '';
                          }} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label style={darkLbl}>✅ સાચો જવાબ</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['A','B','C','D','E'].map(opt => (
                    <button key={opt} type="button" onClick={() => setNewQ(q => ({ ...q, correctOpt: opt }))}
                      style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1.5px solid ${newQ.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: newQ.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'transparent', color: newQ.correctOpt === opt ? '#22c55e' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>
                      {opt} {newQ.correctOpt === opt && '✓'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 👁️ Live Math Preview for Question Add */}
          <LiveMathQuestionPreview qData={newQ} />

          <button onClick={handleAddQuestion}
            style={{ width: '100%', background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '11px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
            ✅ આ પ્રશ્ન ઉમેરો (Save New Question)
          </button>
        </div>
      )}

      {/* List of Questions with Edit / Delete & Image Management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {testData.questions.map((q, idx) => {
          const isEditing = editingQId === q.id;

          return (
            <div key={q.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '16px', border: isEditing ? '1.5px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.06)' }}>
              {!isEditing ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: q.type === 'mcq' ? 'rgba(59,130,246,0.3)' : 'rgba(217,119,6,0.3)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 900 }}>
                        {idx + 1}
                      </span>
                      <span style={{ background: q.type === 'mcq' ? 'rgba(59,130,246,0.2)' : 'rgba(217,119,6,0.2)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                        {q.type.toUpperCase()}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{q.marks || 1} Marks</span>
                      {Number(q.negativeMarking) > 0 && (
                        <span style={{ background: '#7f1d1d', color: '#fca5a5', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6, border: '1px solid #dc2626' }}>
                          ➖ નેગેટિવ: -{q.negativeMarking}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => {
                        setEditingQId(q.id);
                        setEditForm({ ...q });
                      }} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                        <Edit3 size={13} /> Edit (સુધારો)
                      </button>
                      <button onClick={() => handleDeleteQuestion(q.id)}
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', padding: '5px 8px', borderRadius: 6, cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div
                    style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.92rem', marginBottom: 8, lineHeight: 1.5 }}
                    dangerouslySetInnerHTML={{ __html: formatMathText(q.text) }}
                  />

                  {/* Image with Delete Button */}
                  {(q.image || q.imageUrl) && (
                    <div style={{ margin: '6px 0 10px 0', position: 'relative', display: 'inline-block' }}>
                      <img src={q.image || q.imageUrl} alt="diagram" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#000' }} />
                      <button onClick={() => handleRemoveQuestionImage(q.id)}
                        title="આ પ્રશ્નનો ફોટો દૂર કરો"
                        style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(239,68,68,0.9)', border: 'none', color: 'white', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Trash2 size={11} /> ફોટો દૂર કરો
                      </button>
                    </div>
                  )}

                  {/* MCQ Options Display (Clean Mobile Friendly) */}
                  {q.type === 'mcq' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {['A','B','C','D','E'].map(opt => {
                        const optText = q[`option${opt}`];
                        const optImg  = q[`option${opt}_img`];
                        if (!optText && !optImg) return null;
                        const isCorrect = q.correctOpt === opt;
                        const isOptionE = opt === 'E';

                        return (
                          <div key={opt}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: isCorrect ? 'rgba(34,197,94,0.15)' : (isOptionE ? 'rgba(100,116,139,0.08)' : 'rgba(255,255,255,0.03)'),
                              border: isCorrect ? '1.5px solid rgba(34,197,94,0.4)' : (isOptionE ? '1px dashed rgba(100,116,139,0.3)' : '1px solid rgba(255,255,255,0.06)'),
                              color: isCorrect ? '#4ade80' : (isOptionE ? '#94a3b8' : '#cbd5e1'),
                              fontSize: '0.85rem'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                                <span style={{
                                  width: 22, height: 22, borderRadius: '50%',
                                  background: isCorrect ? '#22c55e' : 'rgba(255,255,255,0.08)',
                                  color: isCorrect ? 'white' : '#94a3b8',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.72rem', fontWeight: 900, flexShrink: 0, marginTop: 1
                                }}>
                                  {opt}
                                </span>
                                <span
                                  style={{ fontSize: '0.88rem', fontWeight: isCorrect ? 700 : 500, lineHeight: 1.45, wordBreak: 'break-word' }}
                                  dangerouslySetInnerHTML={{ __html: formatMathText(optText) }}
                                />
                              </div>
                              {isCorrect && (
                                <span style={{ background: '#22c55e', color: '#052e16', fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>
                                  ✓ સાચો જવાબ
                                </span>
                              )}
                              {isOptionE && !isCorrect && (
                                <span style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>
                                  (Skip - No Negative)
                                </span>
                              )}
                            </div>

                            {optImg && (
                              <div style={{ marginLeft: 30, marginTop: 4 }}>
                                <img src={optImg} alt={`Option ${opt}`} style={{ maxHeight: 60, maxWidth: '100%', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Question Edit Mode */
                <div className="animate-fade-in">
                  <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem', marginBottom: 10 }}>
                    ✏️ પ્રશ્ન #{idx + 1} સુધારો (Edit Question)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={darkLbl}>Type</label>
                      <select className="input-dark" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="mcq">🔵 MCQ</option>
                        <option value="descriptive">📝 Descriptive</option>
                      </select>
                    </div>
                    <div>
                      <label style={darkLbl}>Marks</label>
                      <input className="input-dark" type="number" min={1} max={50} value={editForm.marks || 1} onChange={e => setEditForm(f => ({ ...f, marks: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <label style={darkLbl}>Negative Marking</label>
                      <select className="input-dark" value={editForm.negativeMarking || 0} onChange={e => setEditForm(f => ({ ...f, negativeMarking: parseFloat(e.target.value) }))}>
                        <option value={0}>🚫 0 (No Negative)</option>
                        <option value={0.25}>➖ -0.25 (1/4 Neg)</option>
                        <option value={0.33}>➖ -0.33 (1/3 Neg)</option>
                        <option value={0.5}>➖ -0.50 (1/2 Neg)</option>
                        <option value={1}>➖ -1.00 (1 Mark Neg)</option>
                      </select>
                    </div>
                  </div>

                  {/* Math Toolbar for Edit */}
                  <MathSymbolToolbar onInsert={(sym) => setEditForm(f => ({ ...f, text: (f.text || '') + (f.text && !f.text.endsWith(' ') ? ' ' : '') + sym }))} />

                  <div style={{ marginBottom: 10 }}>
                    <label style={darkLbl}>Question Text</label>
                    <textarea className="input-dark" rows={2} value={editForm.text || ''} onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))} />
                  </div>

                  {/* Question Image in Edit */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8' }}>
                        <ImageIcon size={14} /> પ્રશ્નનો ફોટો / આકૃતિ (Question Image)
                      </label>
                      {(editForm.image || editForm.imageUrl) && (
                        <button type="button" onClick={() => setEditForm(f => ({ ...f, image: '', imageUrl: '' }))}
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                          <Trash2 size={12} /> 🗑️ ફોટો દૂર કરો (Delete Image)
                        </button>
                      )}
                    </div>

                    {(editForm.image || editForm.imageUrl) ? (
                      <div style={{ textAlign: 'center', padding: '8px', background: '#000', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                        <img src={editForm.image || editForm.imageUrl} alt="preview" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 6 }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          📁 કમ્પ્યુટરમાંથી ફોટો સિલેક્ટ કરો
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const r = new FileReader();
                              r.onload = ev => setEditForm(f => ({ ...f, image: ev.target.result, imageUrl: ev.target.result }));
                              r.readAsDataURL(file);
                              e.target.value = '';
                            }} />
                        </label>
                        <input className="input-dark" style={{ flex: 1, minWidth: 160, fontSize: '0.75rem', padding: '8px 10px' }}
                          placeholder="અથવા Image URL / Base64 પેસ્ટ કરો..."
                          value={editForm.image || editForm.imageUrl || ''}
                          onChange={e => setEditForm(f => ({ ...f, image: e.target.value, imageUrl: e.target.value }))} />
                      </div>
                    )}
                  </div>

                  {/* MCQ Options in Edit */}
                  {editForm.type === 'mcq' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
                        {['A','B','C','D'].map(opt => (
                          <div key={opt}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <label style={{ ...darkLbl, fontSize: '0.68rem', margin: 0 }}>Option {opt}</label>
                              {editForm[`option${opt}_img`] && (
                                <button type="button" onClick={() => setEditForm(f => ({ ...f, [`option${opt}_img`]: '' }))}
                                  style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }} title="Delete Option Image">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            <input className="input-dark" value={editForm[`option${opt}`] || ''} onChange={e => setEditForm(f => ({ ...f, [`option${opt}`]: e.target.value }))} style={{ marginBottom: 4 }} />
                            {editForm[`option${opt}_img`] ? (
                              <img src={editForm[`option${opt}_img`]} alt={`Opt ${opt}`} style={{ maxHeight: 50, maxWidth: '100%', borderRadius: 4 }} />
                            ) : (
                              <label style={{ fontSize: '0.68rem', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                + ફોટો ઉમેરો
                                <input type="file" accept="image/*" style={{ display: 'none' }}
                                  onChange={e => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const r = new FileReader();
                                    r.onload = ev => setEditForm(f => ({ ...f, [`option${opt}_img`]: ev.target.result }));
                                    r.readAsDataURL(file);
                                    e.target.value = '';
                                  }} />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={darkLbl}>✅ સાચો જવાબ પસંદ કરો</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['A','B','C','D'].map(opt => (
                            <button key={opt} type="button" onClick={() => setEditForm(f => ({ ...f, correctOpt: opt }))}
                              style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1.5px solid ${editForm.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: editForm.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'transparent', color: editForm.correctOpt === opt ? '#22c55e' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>
                              {opt} {editForm.correctOpt === opt && '✓'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 👁️ Live Math Preview for Edit */}
                  <LiveMathQuestionPreview qData={editForm} />

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingQId(null)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                      Cancel
                    </button>
                    <button onClick={() => handleSaveQuestion(q.id)}
                      style={{ background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                      ✅ સાચવો (Save Changes)
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEST GENERATE — New Test vs Edit Old Test Hub
═══════════════════════════════════════════════════════ */

function TestGenerate({ showToast, setActiveTab, setSelectedLiveTestCode }) {
  const { teacherProfile } = useStore();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);

  // Main choice: null (hub menu) | 'new' | 'edit_old' | 'manual' | 'json'
  const [mainChoice, setMainChoice] = useState(null); // 'new' | 'edit_old' | null
  const [newMode, setNewMode]       = useState(null); // 'manual' | 'json' | null
  const [selectedOldTest, setSelectedOldTest] = useState(null); // Test object being edited
  const [expandedTestCode, setExpandedTestCode] = useState(null); // Test ID expanded to view questions
    
  const [filter, setFilter]       = useState('all');
  const [searchTest, setSearchTest] = useState('');
  const fileRef                   = useRef(null);

  // JSON upload state
  const [jsonText, setJsonText]       = useState('');
  const [jsonPreview, setJsonPreview] = useState([]);
  const [jsonError, setJsonError]     = useState('');
  const [uploading, setUploading]     = useState(false);

  useEffect(() => { fetchQ(); }, []);

  const fetchQ = async () => {
    try {
      const r = await getAllQuestions();
      setQuestions(r.data || []);
    } catch {
      showToast('Load failed', 'error');
    }
    setLoading(false);
  };

  // Group questions into existing tests
  const testGroupsMap = {};
  questions.forEach(q => {
    const key = q.testCode || (q.chapter ? `CHAPTER-${q.chapter}` : 'DEFAULT-TEST');
    if (!testGroupsMap[key]) {
      testGroupsMap[key] = {
        testCode:   q.testCode || key,
        testName:   q.testName || q.chapter || 'સામાન્ય કસોટી (General Test)',
        subject:    q.subject  || 'General',
        timeLimit:  q.timeLimit || 60,
        questions:  [],
        totalMarks: 0,
        mcqCount:   0,
        descCount:  0,
      };
    }
    testGroupsMap[key].questions.push(q);
    testGroupsMap[key].totalMarks += (q.marks || 1);
    if (q.type === 'mcq') testGroupsMap[key].mcqCount++;
    else testGroupsMap[key].descCount++;
  });

  const existingTests = Object.values(testGroupsMap);
  const filteredExistingTests = existingTests.filter(t =>
    t.testName.toLowerCase().includes(searchTest.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchTest.toLowerCase()) ||
    t.testCode.toLowerCase().includes(searchTest.toLowerCase())
  );

  // ── JSON format normalizer ─────────────────────────────
  const normalizeJsonQuestion = (q, defaultSubject, defaultTestName, defaultTestCode, defaultTimeLimit) => {
    let text = (q.question || q.text || q.title || q.qText || '').trim();
    let image = (q.image || q.imageUrl || q.img || q.photo || q.questionImage || q.question_image || '').trim();

    // If question text itself is an image URL/base64
    if (isImg(text) && !image) {
      image = extractImgSrc(text);
      text = '';
    }

    let optA = '', optB = '', optC = '', optD = '', optE = '';
    let optA_img = '', optB_img = '', optC_img = '', optD_img = '', optE_img = '';

    const parseOptItem = (item) => {
      if (item === null || item === undefined) return { text: '', img: '' };
      if (typeof item === 'object') {
        let t = String(item.text !== undefined ? item.text : (item.opt !== undefined ? item.opt : (item.option !== undefined ? item.option : (item.title !== undefined ? item.title : (item.label !== undefined ? item.label : ''))))).trim();
        let im = String(item.image || item.imageUrl || item.img || item.photo || item.option_img || item.optionImage || item.opt_img || item.opt_image || item.src || item.url || item.base64 || '').trim();
        if (isImg(t) && !im) {
          im = extractImgSrc(t);
          t = '';
        }
        return { text: t, img: extractImgSrc(im) };
      }
      const s = String(item).trim();
      if (isImg(s)) {
        return { text: '', img: extractImgSrc(s) };
      }
      return { text: s, img: '' };
    };

    // If options is an array
    if (Array.isArray(q.options)) {
      const aObj = parseOptItem(q.options[0]);
      const bObj = parseOptItem(q.options[1]);
      const cObj = parseOptItem(q.options[2]);
      const dObj = parseOptItem(q.options[3]);
      const eObj = parseOptItem(q.options[4]);

      optA = aObj.text; optA_img = aObj.img;
      optB = bObj.text; optB_img = bObj.img;
      optC = cObj.text; optC_img = cObj.img;
      optD = dObj.text; optD_img = dObj.img;
      optE = eObj.text; optE_img = eObj.img;

      // Also check separate optionImages / options_images / optImages array
      const imgArr = q.optionImages || q.options_images || q.option_images || q.optImages || q.opt_images || q.option_imgs || q.images || [];
      if (Array.isArray(imgArr)) {
        if (!optA_img && imgArr[0]) optA_img = extractImgSrc(String(imgArr[0]).trim());
        if (!optB_img && imgArr[1]) optB_img = extractImgSrc(String(imgArr[1]).trim());
        if (!optC_img && imgArr[2]) optC_img = extractImgSrc(String(imgArr[2]).trim());
        if (!optD_img && imgArr[3]) optD_img = extractImgSrc(String(imgArr[3]).trim());
        if (!optE_img && imgArr[4]) optE_img = extractImgSrc(String(imgArr[4]).trim());
      }
    } else if (q.options && typeof q.options === 'object') {
      // Options object: { A: "...", B: "..." } or { A: { text: "...", image: "..." } }
      const extractFromKey = (k, altK, numK) => {
        const val = q.options[k] !== undefined ? q.options[k] : (q.options[altK] !== undefined ? q.options[altK] : q.options[numK]);
        const parsed = parseOptItem(val);
        let directImg = String(q.options[`${k}_img`] || q.options[`${k}_image`] || q.options[`option${k}_img`] || q.options[`option${k}_image`] || q.options[`opt${k}_img`] || '').trim();
        if (directImg) parsed.img = extractImgSrc(directImg);
        return parsed;
      };

      const aObj = extractFromKey('A', 'optionA', '1');
      const bObj = extractFromKey('B', 'optionB', '2');
      const cObj = extractFromKey('C', 'optionC', '3');
      const dObj = extractFromKey('D', 'optionD', '4');
      const eObj = extractFromKey('E', 'optionE', '5');

      optA = aObj.text; optA_img = aObj.img;
      optB = bObj.text; optB_img = bObj.img;
      optC = cObj.text; optC_img = cObj.img;
      optD = dObj.text; optD_img = dObj.img;
      optE = eObj.text; optE_img = eObj.img;
    } else {
      const aObj = parseOptItem(q.optionA !== undefined ? q.optionA : (q.optA !== undefined ? q.optA : (q.A !== undefined ? q.A : q.option1)));
      const bObj = parseOptItem(q.optionB !== undefined ? q.optionB : (q.optB !== undefined ? q.optB : (q.B !== undefined ? q.B : q.option2)));
      const cObj = parseOptItem(q.optionC !== undefined ? q.optionC : (q.optC !== undefined ? q.optC : (q.C !== undefined ? q.C : q.option3)));
      const dObj = parseOptItem(q.optionD !== undefined ? q.optionD : (q.optD !== undefined ? q.optD : (q.D !== undefined ? q.D : q.option4)));
      const eObj = parseOptItem(q.optionE !== undefined ? q.optionE : (q.optE !== undefined ? q.optE : (q.E !== undefined ? q.E : q.option5)));

      optA = aObj.text; optA_img = aObj.img;
      optB = bObj.text; optB_img = bObj.img;
      optC = cObj.text; optC_img = cObj.img;
      optD = dObj.text; optD_img = dObj.img;
      optE = eObj.text; optE_img = eObj.img;
    }

    // Direct root option image keys: optionA_img, optA_img, A_img, option1_img, etc.
    if (!optA_img) optA_img = extractImgSrc(String(q.optionA_img || q.optA_img || q.A_img || q.option1_img || q.opt1_img || q.optionA_image || q.option_a_img || q.option_a_image || q.optA_image || '').trim());
    if (!optB_img) optB_img = extractImgSrc(String(q.optionB_img || q.optB_img || q.B_img || q.option2_img || q.opt2_img || q.optionB_image || q.option_b_img || q.option_b_image || q.optB_image || '').trim());
    if (!optC_img) optC_img = extractImgSrc(String(q.optionC_img || q.optC_img || q.C_img || q.option3_img || q.opt3_img || q.optionC_image || q.option_c_img || q.option_c_image || q.optC_image || '').trim());
    if (!optD_img) optD_img = extractImgSrc(String(q.optionD_img || q.optD_img || q.D_img || q.option4_img || q.opt4_img || q.optionD_image || q.option_d_img || q.option_d_image || q.optD_image || '').trim());
    if (!optE_img) optE_img = extractImgSrc(String(q.optionE_img || q.optE_img || q.E_img || q.option5_img || q.opt5_img || q.optionE_image || q.option_e_img || q.option_e_image || q.optE_image || '').trim());

    // If optA / optB etc still contain image string directly:
    if (isImg(optA) && !optA_img) { optA_img = extractImgSrc(optA); optA = ''; }
    if (isImg(optB) && !optB_img) { optB_img = extractImgSrc(optB); optB = ''; }
    if (isImg(optC) && !optC_img) { optC_img = extractImgSrc(optC); optC = ''; }
    if (isImg(optD) && !optD_img) { optD_img = extractImgSrc(optD); optD = ''; }
    if (isImg(optE) && !optE_img) { optE_img = extractImgSrc(optE); optE = ''; }

    let rawAns = q.answer !== undefined ? q.answer : (q.correctOpt || q.correct || q.ans || q.correctAnswer || 'A');
    let correctOpt = 'A';

    if (typeof rawAns === 'number' || (typeof rawAns === 'string' && /^[1-5]$/.test(rawAns.trim()))) {
      const num = parseInt(rawAns);
      if (num === 1) correctOpt = 'A';
      else if (num === 2) correctOpt = 'B';
      else if (num === 3) correctOpt = 'C';
      else if (num === 4) correctOpt = 'D';
      else if (num === 5) correctOpt = 'E';
    } else if (typeof rawAns === 'string') {
      const upper = rawAns.trim().toUpperCase();
      if (['A','B','C','D','E'].includes(upper)) {
        correctOpt = upper;
      } else if (Array.isArray(q.options)) {
        const idx = q.options.findIndex(o => (typeof o === 'object' ? String(o.text || o.opt).trim() : String(o).trim()) === String(rawAns).trim());
        if (idx === 0) correctOpt = 'A';
        else if (idx === 1) correctOpt = 'B';
        else if (idx === 2) correctOpt = 'C';
        else if (idx === 3) correctOpt = 'D';
        else if (idx === 4) correctOpt = 'E';
      }
    }

    const hasOptions = (optA || optA_img) && (optB || optB_img);
    const type = q.type || (hasOptions ? 'mcq' : 'descriptive');
    const marks = q.marks ? parseInt(q.marks) : (type === 'mcq' ? 1 : 5);
    const subject = q.subject || defaultSubject || 'વિજ્ઞાન (Science)';
    const testName = q.testName || q.chapter || defaultTestName || 'વિજ્ઞાન મોક ટેસ્ટ';
    const testCode = q.testCode || defaultTestCode;
    const timeLimit = q.timeLimit ? parseInt(q.timeLimit) : defaultTimeLimit;
    const negativeMarking = q.negativeMarking !== undefined ? parseFloat(q.negativeMarking) : 0;

    return {
      id: q.id,
      text,
      type,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      optionE: optE,
      optionA_img: optA_img,
      optionB_img: optB_img,
      optionC_img: optC_img,
      optionD_img: optD_img,
      optionE_img: optE_img,
      correctOpt,
      marks,
      negativeMarking,
      image,
      imageUrl: image,
      subject,
      chapter: testName,
      testName,
      testCode,
      timeLimit
    };
  };

  // State for JSON Upload Test Settings
  const [jsonTestMeta, setJsonTestMeta] = useState({
    testName: 'વિજ્ઞાન મોક ટેસ્ટ',
    subject: 'વિજ્ઞાન (Science)',
    timerMode: 'no_limit', // 'no_limit' | 'per_question' | 'total_test' (Default: No timer)
    perQuestionSec: 60, // 30, 45, 60, 90, 120
    timeLimit: 0, // 0 = no time limit
    testCode: 'TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
  });

  // Calculate effective timeLimit: 0 for no_limit, seconds (<= 300) for per_question, total seconds (> 300) for total_test
  const getEffectiveJsonTimeLimit = (meta = jsonTestMeta) => {
    if (meta.timerMode === 'no_limit') return 0;
    if (meta.timerMode === 'per_question') return Number(meta.perQuestionSec) || 60;
    return (Number(meta.timeLimit) || 60) * 60;
  };

  // ── JSON parse ─────────────────────────────────────────
  const parseJSON = (text, metaOverride) => {
    const meta = metaOverride || jsonTestMeta;
    setJsonError(''); setJsonText(text);
    if (!text.trim()) { setJsonPreview([]); return; }
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      if (!arr.length) { setJsonError('JSON empty છે!'); setJsonPreview([]); return; }
      
      const effectiveTime = getEffectiveJsonTimeLimit(meta);
      const normalized = arr.map(q => normalizeJsonQuestion(q, meta.subject, meta.testName, meta.testCode, effectiveTime));
      setJsonPreview(normalized.slice(0, 6));
    } catch (err) {
      setJsonError('Invalid JSON: ' + err.message);
      setJsonPreview([]);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { showToast('Only .json file!', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => parseJSON(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Bulk upload ────────────────────────────────────────
  const handleBulkUpload = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      const qArr = Array.isArray(parsed) ? parsed : (parsed.questions || []);
      if (!qArr.length) { showToast('No questions found', 'error'); return; }
      setUploading(true);
      let ok = 0, fail = 0;
      const bulkTestCode = jsonTestMeta.testCode || ('TEST-' + Date.now().toString(36).toUpperCase());
      const bulkTestName = jsonTestMeta.testName || ('JSON Upload Test (' + new Date().toLocaleDateString() + ')');
      const effectiveTime = getEffectiveJsonTimeLimit(jsonTestMeta);

      for (const rawQ of qArr) {
        try {
          const q = normalizeJsonQuestion(rawQ, jsonTestMeta.subject, bulkTestName, bulkTestCode, effectiveTime);
          const effectiveNeg = jsonTestMeta.negativeMarking !== undefined ? Number(jsonTestMeta.negativeMarking) : (q.negativeMarking || 0);
          await createQuestion({
            text:            q.text,
            type:            q.type,
            subject:         q.subject,
            chapter:         q.chapter,
            optionA:         q.optionA,
            optionB:         q.optionB,
            optionC:         q.optionC,
            optionD:         q.optionD,
            optionE:         q.optionE || '',
            optionA_img:     q.optionA_img,
            optionB_img:     q.optionB_img,
            optionC_img:     q.optionC_img,
            optionD_img:     q.optionD_img,
            optionE_img:     q.optionE_img || '',
            correctOpt:      q.correctOpt,
            marks:           q.marks,
            negativeMarking: effectiveNeg,
            image:           q.image,
            imageUrl:        q.imageUrl,
            testCode:        bulkTestCode,
            testName:        bulkTestName,
            timeLimit:       effectiveTime,
            isActive:        false, // NOT live immediately; teacher controls live via Tik Box
          });
          ok++;
        } catch { fail++; }
      }
      setUploading(false);
      showToast(`✅ કસોટી '${bulkTestName}' તૈયાર થઈ ગઈ! Live ટેબમાં જઈને જ્યારે ઇચ્છો ત્યારે Tik Box દ્વારા Live કરી શકો છો.`, 'success');
      setMainChoice(null); setNewMode(null); setJsonText(''); setJsonPreview([]);
      if (setSelectedLiveTestCode) setSelectedLiveTestCode(bulkTestCode);
      if (setActiveTab) setActiveTab('live');
      fetchQ();
    } catch { showToast('JSON parse error', 'error'); setUploading(false); }
  };

  // ── Download sample in exact user requested format ─────
  const downloadSample = () => {
    const sample = [
      {
        id: 22,
        question: "22. ઘઉંનો છોડ નીચેના પૈકી કઈ લાક્ષણિકતા ધરાવે છે?",
        image: "",
        options: [
          "સોટીમૂળ અને પર્ણોમાં જાળીદાર શિરાવિન્યાસ",
          "સોટીમૂળ અને પર્ણોમાં સમાંતર શિરાવિન્યાસ",
          "તંતુમય મૂળ અને પર્ણોમાં જાળીદાર શિરાવિન્યાસ",
          "તંતુમય મૂળ અને પર્ણોમાં સમાંતર શિરાવિન્યાસ"
        ],
        answer: "4"
      },
      {
        id: 6,
        question: "6. જે વનસ્પતિનાં બીજ દ્વિદળી હોય તેનાં મૂળતંત્ર અને શિરાવિન્યાસ અનુક્રમે કેવા પ્રકારનાં હોય?",
        image: "",
        options: [
          "સોટીમૂળ, સમાંતર શિરાવિન્યાસ",
          "સોટીમૂળ, જાળીદાર શિરાવિન્યાસ",
          "તંતુમય મૂળ, સમાંતર શિરાવિન્યાસ",
          "તંતુમય મૂળ, જાળીદાર શિરાવિન્યાસ"
        ],
        answer: "2"
      },
      {
        id: 4,
        question: "4. નીચે ચિત્રમાં દર્શાવેલ વૃક્ષ કયા વિસ્તારમાં ઉગે છે?",
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAYYAAAEECAIAAACjmgRhAAAACXBIWXMAAA7EAAAOxAGVKw4bAAABZGlDQ1BJQ0NCYXNlZChSR0IsR29vZ2xlL1NraWEvN0M1RkEyMTUxMzk3NDc0QTA0ODZCQkNDODM3MzNENTkpAAB4nH2QvUrDYBSGH2tBFMVBhw4OGRxc1P5of8ClrVhcW4VWpzRNi9ifkKboBejm4OomLt6A6GUoCA7i4CWIoLNvGiQFqefw5nt485Iv50Akhioah07Xc8ulglGtHRhT70yoh2VafYfxpdT3S5B9Xv0nN66mG3bf0vkhea4u1ycb4sVWwKc+1wO+8PnEczzxtc/uXrkovhOvtEa4PsKW4/r5N/FWpz2wwv9m1u7uV3RWpSVK9NQt2tisU+GYI0xRhiKb7JAnSUKUIEVO7sZQeeJ6ZklTUBfVWb3PSCm2lc75+wyu7N1A9gsmL0OvfgUP5xB7Db1lzTZ/BvePoRfu2DFdc2hFpUizCZ+3MFeDhSeYOfxd7JhZjT+zGuzSxWJNlNQ0CdI/hc1LvY60eocAAdmwSURBVHic7F0FXBTp/37pbmmkpZFOCemUTglFUTBQEcTC9mzP7jg7ALu7BQwMFDEP82ya7Zn/O/PujiPe3e88C++/z+f9LMPuMvvuMPPM880XYEIIIcR/DjwSuAAsFuvTbQ6HgzbYbPY3mgb4RvsVQgghfiAQcTAYDIpQIIkwmUxEOvARbqMn0Tu/0TSE/CKEEP9BQOKg5AkEl8vFBKQD6Qb+ShcvQn4RQgghPgMUcbSzjJB+gfxC8Q6im280DSG/CCHEfxAUj1COUCSYhBBfC/5e10E+WAAAAAElFTkSuQmCC",
        options: [
          "રણપ્રદેશ",
          "પર્વતીય પ્રદેશ",
          "મેદાની પ્રદેશ",
          "દરિયાકિનારો"
        ],
        answer: "2"
      }
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' }));
    a.download = 'sample_quiz.json'; a.click();
  };


  const filtered = filter === 'all' ? questions : questions.filter(q => q.type === filter);

  return (
    <div className="animate-fade-in">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { l: 'કુલ કસોટીઓ', v: existingTests.length, grad: 'stat-grad-blue' },
          { l: 'કુલ પ્રશ્નો', v: questions.length, grad: 'stat-grad-purple' },
          { l: 'MCQ',        v: questions.filter(q => q.type === 'mcq').length, grad: 'stat-grad-green' },
          { l: 'Desc.',       v: questions.filter(q => q.type === 'descriptive').length, grad: 'stat-grad-orange' },
        ].map((s, i) => (
          <div key={i} className={`stat-grad-card ${s.grad}`} style={{ padding: '12px 10px' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900 }}><CountUp target={s.v} /></div>
            <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── PRIMARY CHOICE: NEW TEST VS EDIT OLD TEST ── */}
      {!mainChoice && (
        <div className="animate-fade-in" style={{ marginBottom: 24 }}>
          <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 14, textTransform: 'uppercase' }}>
            🎯 તમે શું કરવા માંગો છો? (SELECT ACTION)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>

            {/* 1. NEW TEST */}
            <button onClick={() => setMainChoice('new')}
              style={{ background: 'linear-gradient(135deg,rgba(29,78,216,0.18),rgba(37,99,235,0.08))', border: '2px solid rgba(59,130,246,0.4)', borderRadius: 18, padding: '26px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: 'Hind Vadodara, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.22)'; e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg,rgba(29,78,216,0.18),rgba(37,99,235,0.08))'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '1px solid rgba(59,130,246,0.4)' }}>
                  🆕
                </div>
                <div>
                  <div style={{ color: '#60a5fa', fontWeight: 900, fontSize: '1.15rem' }}>૧. નવી કસોટી બનાવો</div>
                  <div style={{ color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>Create New Test</div>
                </div>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 14 }}>
                • નવું ટાઈટલ, વિષય અને સમય નક્કી કરો.<br />
                • ✍️ Manual Wizard અથવા 📂 JSON થી પ્રશ્નો ઉમેરો.<br />
                • સીધી Live કરવા માટે તૈયાર.
              </div>
              <div style={{ background: 'rgba(59,130,246,0.25)', color: '#bfdbfe', fontSize: '0.8rem', fontWeight: 800, padding: '7px 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                ➕ નવી કસોટી શરૂ કરો →
              </div>
            </button>

            {/* 2. EDIT / MANAGE OLD TEST */}
            <button onClick={() => setMainChoice('edit_old')}
              style={{ background: 'linear-gradient(135deg,rgba(180,83,9,0.18),rgba(217,119,6,0.08))', border: '2px solid rgba(245,158,11,0.4)', borderRadius: 18, padding: '26px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: 'Hind Vadodara, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.22)'; e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg,rgba(180,83,9,0.18),rgba(217,119,6,0.08))'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '1px solid rgba(245,158,11,0.4)' }}>
                  📝
                </div>
                <div>
                  <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.15rem' }}>૨. જૂની કસોટીમાં ફેરફાર કરો</div>
                  <div style={{ color: '#fde68a', fontSize: '0.75rem', fontWeight: 700 }}>Edit / Update Existing Test</div>
                </div>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 14 }}>
                • અગાઉ બનાવેલી કસોટીઓ ({existingTests.length}) માં સુધારો કરો.<br />
                • જૂના પ્રશ્નો Edit / Delete કરો અથવા નવા ઉમેરો.<br />
                • સમય, ગુણ કે વિષય બદલો.
              </div>
              <div style={{ background: 'rgba(245,158,11,0.25)', color: '#fef3c7', fontSize: '0.8rem', fontWeight: 800, padding: '7px 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                ✏️ જૂની કસોટી પસંદ કરો ({existingTests.length}) →
              </div>
            </button>

          </div>
        </div>
      )}

      {/* ── SUB-VIEW 1: NEW TEST (Manual vs JSON) ── */}
      {mainChoice === 'new' && !newMode && (
        <div className="animate-fade-in" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ color: '#60a5fa', fontWeight: 900, fontSize: '1.05rem' }}>
              🆕 નવી કસોટી — મોડ પસંદ કરો
            </div>
            <button onClick={() => setMainChoice(null)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              ← પાછા જાઓ
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {/* Manual */}
            <button onClick={() => setNewMode('manual')}
              style={{ background: 'linear-gradient(135deg,rgba(29,78,216,0.15),rgba(37,99,235,0.08))', border: '1.5px solid rgba(59,130,246,0.3)', borderRadius: 16, padding: '24px 20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', fontFamily: 'Hind Vadodara, sans-serif' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✍️</div>
              <div style={{ color: '#60a5fa', fontWeight: 900, fontSize: '1.05rem', marginBottom: 6 }}>Manual Entry (વિઝાર્ડ)</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6 }}>
                ટેસ્ટ નામ, MCQ/Descriptive પ્રશ્નોની સંખ્યા નક્કી કરી એક-એક ઉમેરો.
              </div>
              <div style={{ marginTop: 14, background: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>
                ➕ Smart Wizard Start
              </div>
            </button>

            {/* JSON */}
            <button onClick={() => setNewMode('json')}
              style={{ background: 'linear-gradient(135deg,rgba(109,40,217,0.15),rgba(124,58,237,0.08))', border: '1.5px solid rgba(139,92,246,0.3)', borderRadius: 16, padding: '24px 20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', fontFamily: 'Hind Vadodara, sans-serif' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
              <div style={{ color: '#a78bfa', fontWeight: 900, fontSize: '1.05rem', marginBottom: 6 }}>JSON File Upload</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6 }}>
                JSON ફાઈલ સિલેક્ટ કરો ➜ તમામ પ્રશ્નો એકસાથે બલ્કમાં અપલોડ થઈ જશે.
              </div>
              <div style={{ marginTop: 14, background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', fontSize: '0.78rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>
                🚀 Bulk Upload
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── MANUAL CREATOR ── */}
      {mainChoice === 'new' && newMode === 'manual' && (
        <ManualTestCreator
          showToast={showToast}
          onDone={(code) => {
            setMainChoice(null);
            setNewMode(null);
            fetchQ();
            if (setSelectedLiveTestCode && code) setSelectedLiveTestCode(code);
            if (setActiveTab) setActiveTab('live');
          }}
        />
      )}

      {/* ── JSON BUILDER ── */}
      {mainChoice === 'new' && newMode === 'json-builder' && (
        <JsonBuilderPanel
          showToast={showToast}
          onUploadDone={() => { setMainChoice(null); setNewMode(null); fetchQ(); }}
          onBack={() => setNewMode(null)}
          parseJSON={parseJSON}
          setJsonText={setJsonText}
          setNewMode={setNewMode}
          setJsonTestMeta={setJsonTestMeta}
        />
      )}

      {/* ── PDF ➜ JSON ── */}
      {mainChoice === 'new' && newMode === 'pdf-json' && (
        <PdfToJsonPanel
          showToast={showToast}
          onBack={() => setNewMode(null)}
          setJsonText={setJsonText}
          setNewMode={setNewMode}
          setJsonTestMeta={setJsonTestMeta}
        />
      )}

      {/* ── JSON UPLOAD ── */}
      {mainChoice === 'new' && newMode === 'json' && (
        <div className="animate-fade-in" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ color: '#c4b5fd', fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>
                📂 JSON Bulk Upload (બલ્ક પ્રશ્નો અપલોડ)
              </h3>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                પ્રશ્નો, વિકલ્પો, સાચા જવાબો અને ફોટા/આકૃતિઓ (Images) સાથેની JSON ફાઈલ અપલોડ કરો.
              </div>
            </div>
            <button onClick={() => { setNewMode(null); setJsonText(''); setJsonPreview([]); setJsonError(''); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              ← Back
            </button>
          </div>

          {/* Test Metadata Config for Uploaded Test */}
          <div className="glass-card" style={{ padding: '16px 18px', marginBottom: 16, border: '1.5px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.04)' }}>
            
            {/* 1. Exam Pattern Selector (TAT-S / TAT-HS vs Standard) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...darkLbl, color: '#facc15', fontSize: '0.86rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🏆</span> કસોટી પદ્ધતિ (EXAM PATTERN) *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {/* Option 1: TAT 5-Option Pattern */}
                <div
                  onClick={() => {
                    const next = {
                      ...jsonTestMeta,
                      examPattern: 'tat',
                      negativeMarking: 0.25,
                      testName: jsonTestMeta.testName.includes('TAT') ? jsonTestMeta.testName : `TAT-S ${jsonTestMeta.subject || 'કસોટી'}`
                    };
                    setJsonTestMeta(next);
                    if (jsonText) parseJSON(jsonText, next);
                  }}
                  style={{
                    background: jsonTestMeta.examPattern === 'tat' ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${jsonTestMeta.examPattern === 'tat' ? '#c084fc' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: jsonTestMeta.examPattern === 'tat' ? '0 0 16px rgba(168,85,247,0.35)' : 'none'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ color: '#e9d5ff', fontWeight: 900, fontSize: '0.9rem' }}>🎯 TAT-S / TAT-HS પ્રિલિમ્સ</span>
                    <span style={{ background: '#9333ea', color: 'white', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: 8 }}>૫ ઓપ્શન</span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.72rem' }}>Option E (Skip - 0 ગુણ) + Neg: -0.25 માર્ક્સ</div>
                </div>

                {/* Option 2: Standard 4-Option Pattern */}
                <div
                  onClick={() => {
                    const next = {
                      ...jsonTestMeta,
                      examPattern: 'standard',
                      negativeMarking: 0
                    };
                    setJsonTestMeta(next);
                    if (jsonText) parseJSON(jsonText, next);
                  }}
                  style={{
                    background: (!jsonTestMeta.examPattern || jsonTestMeta.examPattern === 'standard') ? 'rgba(37,99,235,0.22)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${(!jsonTestMeta.examPattern || jsonTestMeta.examPattern === 'standard') ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: (!jsonTestMeta.examPattern || jsonTestMeta.examPattern === 'standard') ? '0 0 16px rgba(59,130,246,0.3)' : 'none'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ color: '#93c5fd', fontWeight: 900, fontSize: '0.9rem' }}>📘 સામાન્ય કસોટી (TET / અન્ય)</span>
                    <span style={{ background: '#2563eb', color: 'white', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: 8 }}>૪ ઓપ્શન</span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.72rem' }}>Standard (A, B, C, D) સામાન્ય પદ્ધતિ</div>
                </div>
              </div>
            </div>

            <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: '0.92rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📋</span> કસોટીની વિગતો અને સેટિંગ્સ (Test Settings & Configuration):
            </div>

            {/* Row 1: Basic Info (Test Name, Subject, Test Code) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={darkLbl}>📝 કસોટીનું નામ (Test Name) *</label>
                <input className="input-dark" value={jsonTestMeta.testName}
                  placeholder="કસોટીનું નામ લખો..."
                  onChange={e => {
                    const v = e.target.value;
                    setJsonTestMeta(m => ({ ...m, testName: v }));
                    if (jsonText) parseJSON(jsonText, { ...jsonTestMeta, testName: v });
                  }} />
              </div>
              <div>
                <label style={darkLbl}>📚 વિષય (Subject) *</label>
                <input className="input-dark" value={jsonTestMeta.subject}
                  placeholder="વિષય લખો..."
                  onChange={e => {
                    const v = e.target.value;
                    setJsonTestMeta(m => ({ ...m, subject: v }));
                    if (jsonText) parseJSON(jsonText, { ...jsonTestMeta, subject: v });
                  }} />
              </div>
              <div>
                <label style={darkLbl}>🔑 ટેસ્ટ કોડ (Test Code)</label>
                <input className="input-dark" value={jsonTestMeta.testCode} style={{ fontFamily: 'monospace', color: '#38bdf8' }}
                  onChange={e => {
                    const v = e.target.value.toUpperCase();
                    setJsonTestMeta(m => ({ ...m, testCode: v }));
                    if (jsonText) parseJSON(jsonText, { ...jsonTestMeta, testCode: v });
                  }} />
              </div>
            </div>

            {/* Row 2: Evaluation & Timer Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, background: 'rgba(0,0,0,0.25)', padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Negative Marking */}
              <div>
                <label style={{ ...darkLbl, color: '#fca5a5' }}>➖ નેગેટિવ માર્કિંગ (Negative Marking)</label>
                <select className="input-dark" value={jsonTestMeta.negativeMarking || 0}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    const next = { ...jsonTestMeta, negativeMarking: v };
                    setJsonTestMeta(next);
                    if (jsonText) parseJSON(jsonText, next);
                  }}
                  style={{ background: '#0d1526', color: '#fca5a5', fontWeight: 800 }}>
                  <option value={0}>🚫 0 (No Negative Marking)</option>
                  <option value={0.25}>➖ -0.25 (1/4 Neg - TAT Pattern)</option>
                  <option value={0.33}>➖ -0.33 (1/3 Neg)</option>
                  <option value={0.5}>➖ -0.50 (1/2 Neg)</option>
                  <option value={1}>➖ -1.00 (1 Mark Neg)</option>
                </select>
              </div>

              {/* Timer Mode */}
              <div>
                <label style={{ ...darkLbl, color: '#38bdf8' }}>⏱️ સમય પદ્ધતિ (Timer Options)</label>
                <select className="input-dark" value={jsonTestMeta.timerMode}
                  onChange={e => {
                    const v = e.target.value;
                    const next = { ...jsonTestMeta, timerMode: v };
                    setJsonTestMeta(next);
                    if (jsonText) parseJSON(jsonText, next);
                  }}
                  style={{ background: '#0d1526', color: '#38bdf8', fontWeight: 800 }}>
                  <option value="no_limit">♾️ સમય મર્યાદા નથી (No Time Limit)</option>
                  <option value="per_question">⏱️ પ્રશ્ન દીઠ સમય (Per Question Seconds)</option>
                  <option value="total_test">⏳ આખી કસોટીનો કુલ સમય (Total Test Minutes)</option>
                </select>
              </div>

              {/* Conditional Timer Inputs / Banner */}
              {jsonTestMeta.timerMode === 'per_question' && (
                <div>
                  <label style={{ ...darkLbl, color: '#93c5fd' }}>⚡ પ્રશ્ન દીઠ સેકન્ડ (Seconds/Q)</label>
                  <select className="input-dark" value={jsonTestMeta.perQuestionSec}
                    onChange={e => {
                      const v = Number(e.target.value);
                      const next = { ...jsonTestMeta, perQuestionSec: v };
                      setJsonTestMeta(next);
                      if (jsonText) parseJSON(jsonText, next);
                    }}
                    style={{ background: '#0d1526', color: '#38bdf8', fontWeight: 800 }}>
                    <option value="30">⚡ 30 સેકન્ડ (Speed Test)</option>
                    <option value="45">⚡ 45 સેકન્ડ</option>
                    <option value="60">🟢 60 સેકન્ડ (૧ મિનિટ - Standard)</option>
                    <option value="90">🟢 90 સેકન્ડ (૧.૫ મિનિટ)</option>
                    <option value="120">⏳ 120 સેકન્ડ (૨ મિનિટ)</option>
                    <option value="180">⏳ 180 સેકન્ડ (૩ મિનિટ)</option>
                  </select>
                </div>
              )}

              {jsonTestMeta.timerMode === 'total_test' && (
                <div>
                  <label style={{ ...darkLbl, color: '#fcd34d' }}>⏳ કુલ સમય (મિનિટમાં)</label>
                  <input className="input-dark" type="number" min={5} max={300} value={jsonTestMeta.timeLimit}
                    placeholder="દા.ત. 60"
                    onChange={e => {
                      const v = Number(e.target.value) || 60;
                      const next = { ...jsonTestMeta, timeLimit: v };
                      setJsonTestMeta(next);
                      if (jsonText) parseJSON(jsonText, next);
                    }}
                    style={{ color: '#fbbf24', fontWeight: 800 }} />
                </div>
              )}

              {jsonTestMeta.timerMode === 'no_limit' && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '9px 12px', color: '#4ade80', fontSize: '0.78rem', fontWeight: 800, width: '100%' }}>
                    ✓ મુક્ત પરીક્ષા (કોઈ સમય મર્યાદા નહીં)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sample Download & Format Guide */}
          <div className="glass-card" style={{ padding: '16px', marginBottom: 16, border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', marginBottom: 3 }}>📥 Support Format (question, options, answer, image)</div>
                <div style={{ color: '#64748b', fontSize: '0.78rem' }}>તમારું JSON ફોર્મેટ (Options Array + Answer 1,2,3,4 અથવા A,B,C,D + Base64 Image) સપોર્ટેડ છે:</div>
              </div>
              <button onClick={downloadSample}
                style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                ⬇️ Sample JSON Download
              </button>
            </div>
            <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '14px', fontSize: '0.72rem', color: '#a5b4fc', overflowX: 'auto', border: '1px solid rgba(139,92,246,0.15)', lineHeight: 1.7 }}>{`[
  {
    "id": 22,
    "question": "22. ઘઉંનો છોડ નીચેના પૈકી કઈ લાક્ષણિકતા ધરાવે છે?",
    "image": "",
    "options": [
      "સોટીમૂળ અને પર્ણોમાં જાળીદાર શિરાવિન્યાસ",
      "સોટીમૂળ અને પર્ણોમાં સમાંતર શિરાવિન્યાસ",
      "તંતુમય મૂળ અને પર્ણોમાં જાળીદાર શિરાવિન્યાસ",
      "તંતુમય મૂળ અને પર્ણોમાં સમાંતર શિરાવિન્યાસ"
    ],
    "answer": "4"
  },
  {
    "id": 4,
    "question": "4. નીચે ચિત્રમાં દર્શાવેલ વૃક્ષ કયા વિસ્તારમાં ઉગે છે?",
    "image": "data:image/png;base64,...",
    "options": ["રણપ્રદેશ", "પર્વતીય પ્રદેશ", "મેદાની પ્રદેશ", "દરિયાકિનારો"],
    "answer": "2"
  }
]`}</pre>
          </div>

          {/* Upload Area */}
          <div className="glass-card" style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ color: 'white', fontWeight: 800, marginBottom: 12 }}>📁 JSON File Select અથવા Paste કરો</div>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed rgba(139,92,246,0.4)', borderRadius: 14, padding: '24px', textAlign: 'center', cursor: 'pointer', background: 'rgba(139,92,246,0.05)', marginBottom: 14 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)'; }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>📂</div>
              <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.92rem' }}>Click to select .json file</div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4 }}>Select .json file from your computer</div>
            </div>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            <div style={{ color: '#475569', fontSize: '0.78rem', textAlign: 'center', marginBottom: 10, fontWeight: 600 }}>─── અથવા અહીં JSON પેસ્ટ કરો (Paste JSON) ───</div>
            <textarea className="input-dark" rows={6}
              placeholder={'[\n  {\n    "question": "પ્રશ્ન અહીં લખો...",\n    "options": ["A", "B", "C", "D"],\n    "answer": "1",\n    "image": ""\n  }\n]'}
              value={jsonText} onChange={e => parseJSON(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.76rem' }} />
          </div>

          {/* Error Message */}
          {jsonError && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#fca5a5', fontSize: '0.85rem', fontWeight: 700 }}>
              ❌ {jsonError}
            </div>
          )}

          {/* Preview + Upload Button */}
          {jsonPreview.length > 0 && (
            <div className="glass-card animate-fade-in" style={{ padding: 18, border: '1.5px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.92rem' }}>
                  ✅ Preview — પ્રથમ {jsonPreview.length} પ્રશ્નો ચકાસો:
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                  કુલ {(() => { try { const a = JSON.parse(jsonText); return Array.isArray(a) ? a.length : a.questions?.length || 0; } catch { return 0; } })()} પ્રશ્નો મળ્યા
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {jsonPreview.map((q, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(59,130,246,0.25)', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                        {q.type.toUpperCase()}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                        {q.marks} Mark
                      </span>
                    </div>

                    {/* Question text */}
                    <div style={{ color: '#e2e8f0', fontSize: '0.88rem', fontWeight: 600, marginBottom: 6 }}>
                      {i + 1}. {formatMathText(q.text)}
                    </div>

                    {/* Thumbnail image if exists */}
                    {(q.image || q.imageUrl) && (
                      <div style={{ margin: '6px 0 10px 0' }}>
                        <img 
                          src={q.image || q.imageUrl} 
                          alt="preview" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                          style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#000' }} 
                        />
                      </div>
                    )}

                    {/* Options */}
                    {q.type === 'mcq' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6, marginTop: 4 }}>
                        {['A', 'B', 'C', 'D', 'E'].map(opt => {
                          const rawOpt = q[`option${opt}`];
                          const rawImg = q[`option${opt}_img`];
                          const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                          const optText = isImg(rawOpt) ? '' : rawOpt;
                          if (!optText && !optImg) return null;
                          const isOptE = opt === 'E';

                          return (
                            <div key={opt} style={{
                              fontSize: '0.75rem',
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: q.correctOpt === opt ? 'rgba(34,197,94,0.2)' : (isOptE ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.03)'),
                              color: q.correctOpt === opt ? '#4ade80' : (isOptE ? '#c084fc' : '#94a3b8'),
                              fontWeight: q.correctOpt === opt ? 800 : 500,
                              border: q.correctOpt === opt ? '1px solid rgba(34,197,94,0.4)' : (isOptE ? '1px dashed rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.05)'),
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3
                            }}>
                              <div>
                                <strong>{opt}:</strong> {optText} {q.correctOpt === opt && ' ✓ (સાચો જવાબ)'} {isOptE && !q.correctOpt === opt && ' (Skip)'}
                              </div>
                              {optImg && (
                                <div style={{ marginTop: 2 }}>
                                  <img 
                                    src={optImg} 
                                    alt={`Opt ${opt}`} 
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                    style={{ maxHeight: 60, maxWidth: '100%', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} 
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={handleBulkUpload} disabled={uploading}
                style={{ width: '100%', background: uploading ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'Hind Vadodara, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 18px rgba(5,150,105,0.35)' }}>
                {uploading
                  ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Uploading...</>
                  : <>🚀 તમામ પ્રશ્નો કસોટી '{jsonTestMeta.testName}' (કોડ: {jsonTestMeta.testCode}) માં અપલોડ કરો ({(() => { try { const a = JSON.parse(jsonText); return Array.isArray(a) ? a.length : a.questions?.length || 0; } catch { return 0; } })()} પ્રશ્નો)</>
                }
              </button>
            </div>
          )}
        </div>
      )}


      {/* ── SUB-VIEW 2: EDIT OLD TESTS LIST & MANAGER ── */}
      {mainChoice === 'edit_old' && !selectedOldTest && (
        <div className="animate-fade-in" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>
                📝 જૂની કસોટી પસંદ કરો (Select Test to Edit)
              </h3>
              <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                જે કસોટીમાં ફેરફાર કરવો હોય તેના પર ક્લિક કરો અથવા PDF ડાઉનલોડ કરો.
              </div>
            </div>
            <button onClick={() => setMainChoice(null)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              ← પાછા જાઓ
            </button>
          </div>

          {/* Search bar */}
          <div style={{ marginBottom: 16 }}>
            <input className="input-dark" placeholder="🔍 કસોટીનું નામ, વિષય કે કોડથી શોધો..."
              value={searchTest} onChange={e => setSearchTest(e.target.value)} />
          </div>

          {filteredExistingTests.length === 0 ? (
            <div className="glass-card" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
              <div style={{ color: '#e2e8f0', fontWeight: 700 }}>કોઈ કસોટી મળી નહીં.</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>નવી કસોટી બનાવવા માટે "૧. નવી કસોટી બનાવો" પસંદ કરો.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
              {filteredExistingTests.map(t => (
                <div key={t.testCode} className="glass-card animate-fade-in"
                  style={{ padding: 18, border: '1px solid rgba(245,158,11,0.25)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12, background: 'rgba(245,158,11,0.04)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                        📚 {t.subject}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        {t.testCode}
                      </span>
                    </div>
                    <h4 style={{ color: 'white', fontWeight: 800, fontSize: '1rem', margin: '4px 0 8px' }}>
                      {t.testName}
                    </h4>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                      {t.questions.length} પ્રશ્નો ({t.mcqCount} MCQ + {t.descCount} Desc) • {t.totalMarks} ગુણ • ⏱ {t.timeLimit}m
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedOldTest(t)}
                      style={{ flex: 1, background: 'linear-gradient(135deg,#b45309,#f59e0b)', color: 'white', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif' }}>
                      <Edit3 size={14} /> આ કસોટીમાં ફેરફાર કરો (Edit)
                    </button>
                    <button onClick={() => exportTestPDF(t, teacherProfile)}
                      title="PDF Download"
                      style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd', padding: '10px 14px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                      <Download size={14} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-VIEW 2B: DEDICATED EXISTING TEST EDITOR ── */}
      {mainChoice === 'edit_old' && selectedOldTest && (
        <ExistingTestEditor
          test={selectedOldTest}
          showToast={showToast}
          onBack={() => { setSelectedOldTest(null); fetchQ(); }}
          onSaved={() => { fetchQ(); }}
          onGoLive={(code) => {
            if (setSelectedLiveTestCode) setSelectedLiveTestCode(code);
            if (setActiveTab) setActiveTab('live');
          }}
        />
      )}

      {/* ── DEFAULT BOTTOM: TESTS GROUPED BY TEST ID / CODE ── */}
      {!mainChoice && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#e2e8f0', fontSize: '1.05rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                📚 બનાવેલી કસોટીઓની યાદી ({existingTests.length} કસોટીઓ)
              </div>
              <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                તમામ પ્રશ્નો કસોટી ID મુજબ ગોઠવેલા છે. પ્રશ્નો જોવા "👁️ પ્રશ્નો જુઓ" પર ક્લિક કરો.
              </div>
            </div>

            {/* Filter by Type */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'બધી કસોટીઓ' },
                { id: 'mcq', label: '🔵 MCQ' },
                { id: 'descriptive', label: '📝 Descriptive' },
                { id: 'mixed', label: '🔀 સંયુક્ત (Mixed)' }
              ].map(f => {
                const isActive = filter === f.id;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1.5px solid ${isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                      background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                      color: isActive ? '#60a5fa' : '#94a3b8',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      fontFamily: 'Hind Vadodara, sans-serif'
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Search */}
          <div style={{ marginBottom: 16 }}>
            <input className="input-dark"
              placeholder="🔍 ટેસ્ટ કોડ (દા.ત. TEST-XXXX), કસોટીનું નામ કે વિષય શોધો..."
              value={searchTest} onChange={e => setSearchTest(e.target.value)} />
          </div>

          {loading ? <Loader /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(() => {
                const list = existingTests.filter(t => {
                  const matchSearch = t.testName.toLowerCase().includes(searchTest.toLowerCase()) ||
                    t.subject.toLowerCase().includes(searchTest.toLowerCase()) ||
                    t.testCode.toLowerCase().includes(searchTest.toLowerCase());
                  if (!matchSearch) return false;
                  if (filter === 'mcq') return t.mcqCount > 0 && t.descCount === 0;
                  if (filter === 'descriptive') return t.descCount > 0 && t.mcqCount === 0;
                  if (filter === 'mixed') return t.mcqCount > 0 && t.descCount > 0;
                  return true;
                });

                if (list.length === 0) {
                  return (
                    <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 800 }}>કોઈ કસોટી મળી નહીં.</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
                        ઉપર "૧. નવી કસોટી બનાવો" બટન દબાવી નવી કસોટી ઉમેરો.
                      </div>
                    </div>
                  );
                }

                return list.map(t => {
                  const isExpanded = expandedTestCode === t.testCode;
                  const isMixed = t.mcqCount > 0 && t.descCount > 0;
                  const isMCQOnly = t.mcqCount > 0 && t.descCount === 0;

                  return (
                    <div key={t.testCode} className="glass-card animate-fade-in"
                      style={{
                        padding: 18,
                        border: isExpanded ? '1.5px solid rgba(59,130,246,0.45)' : '1px solid rgba(255,255,255,0.08)',
                        background: isExpanded ? 'rgba(59,130,246,0.04)' : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s'
                      }}>
                      
                      {/* Test Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: 6 }}>
                              📚 {t.subject}
                            </span>
                            <span style={{ background: 'rgba(255,255,255,0.08)', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 900, padding: '3px 9px', borderRadius: 6, fontFamily: 'monospace', border: '1px solid rgba(56,189,248,0.25)' }}>
                              🏷️ ID: {t.testCode}
                            </span>
                            <span style={{
                              background: isMixed ? 'rgba(168,85,247,0.2)' : isMCQOnly ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.2)',
                              color: isMixed ? '#c084fc' : isMCQOnly ? '#4ade80' : '#fbbf24',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6
                            }}>
                              {isMixed ? '🔀 સંયુક્ત (MCQ + Desc)' : isMCQOnly ? '🔵 ફક્ત MCQ' : '📝 ફક્ત વર્ણાત્મક'}
                            </span>
                          </div>

                          <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.05rem', margin: 0, letterSpacing: '0.01em' }}>
                            {t.testName}
                          </h3>
                        </div>

                        {/* Badges strip */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>પ્રશ્નો</div>
                            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.85rem' }}>{t.questions.length}</div>
                          </div>
                          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>કુલ ગુણ</div>
                            <div style={{ color: '#4ade80', fontWeight: 800, fontSize: '0.85rem' }}>{t.totalMarks}m</div>
                          </div>
                          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '0.65rem' }}>સમય</div>
                            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.85rem' }}>
                              {t.timeLimit === 0 ? 'No Limit' : t.timeLimit <= 300 ? `${t.timeLimit}s/Q` : `${Math.round(t.timeLimit / 60)}m`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button onClick={() => setExpandedTestCode(isExpanded ? null : t.testCode)}
                          style={{
                            background: isExpanded ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                            border: isExpanded ? '1.5px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                            color: isExpanded ? '#60a5fa' : '#cbd5e1',
                            padding: '7px 14px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'Hind Vadodara, sans-serif'
                          }}>
                          <Eye size={14} />
                          {isExpanded ? 'પ્રશ્નો છુપાવો (Hide Questions)' : `👁️ પ્રશ્નો જુઓ (${t.questions.length})`}
                        </button>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => { setMainChoice('edit_old'); setSelectedOldTest(t); }}
                            style={{
                              background: 'rgba(245,158,11,0.15)',
                              border: '1px solid rgba(245,158,11,0.3)',
                              color: '#fbbf24',
                              padding: '7px 12px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontFamily: 'Hind Vadodara, sans-serif'
                            }}>
                            <Edit3 size={13} /> Edit (સુધારો)
                          </button>

                          <button onClick={() => exportTestPDF(t, teacherProfile)}
                            style={{
                              background: 'rgba(59,130,246,0.15)',
                              border: '1px solid rgba(59,130,246,0.3)',
                              color: '#93c5fd',
                              padding: '7px 12px',
                              borderRadius: 8,
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontFamily: 'Hind Vadodara, sans-serif'
                            }}>
                            <Download size={13} /> PDF
                          </button>

                          <button onClick={() => {
                            if (setSelectedLiveTestCode) setSelectedLiveTestCode(t.testCode);
                            if (setActiveTab) setActiveTab('live');
                          }}
                            style={{
                              background: 'linear-gradient(135deg,#047857,#10b981)',
                              color: 'white',
                              border: 'none',
                              padding: '7px 14px',
                              borderRadius: 8,
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontFamily: 'Hind Vadodara, sans-serif'
                            }}>
                            <Play size={13} fill="white" /> Live કરો
                          </button>
                        </div>
                      </div>

                      {/* Expanded Question List under this Test ID */}
                      {isExpanded && (
                        <div className="animate-fade-in" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ color: '#93c5fd', fontSize: '0.78rem', fontWeight: 800, marginBottom: 4 }}>
                            📋 કસોટી "{t.testName}" (ID: {t.testCode}) ના તમામ પ્રશ્નો:
                          </div>

                          {t.questions.map((q, idx) => (
                            <div key={q.id || idx} style={{
                              background: 'rgba(0,0,0,0.25)',
                              borderRadius: 8,
                              padding: '10px 14px',
                              border: '1px solid rgba(255,255,255,0.05)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              gap: 10
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: q.type === 'mcq' ? 'rgba(59,130,246,0.3)' : 'rgba(217,119,6,0.3)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900 }}>
                                    {idx + 1}
                                  </span>
                                  <span style={{
                                    background: q.type === 'mcq' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)',
                                    color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24',
                                    fontWeight: 800,
                                    fontSize: '0.65rem',
                                    padding: '2px 7px',
                                    borderRadius: 12
                                  }}>
                                    {q.type.toUpperCase()}
                                  </span>
                                  <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                                    {q.marks || 1} Marks
                                  </span>
                                </div>

                                <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.86rem', marginBottom: 6 }}>
                                  {formatMathText(q.text)}
                                </div>

                                {(q.image || q.imageUrl) && (
                                  <div style={{ margin: '6px 0 8px 0' }}>
                                    <img src={q.image || q.imageUrl} alt="diagram" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#000' }} />
                                  </div>
                                )}

                                {q.type === 'mcq' && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {['A','B','C','D'].map(opt => q[`option${opt}`] && (
                                      <span key={opt} style={{
                                        fontSize: '0.72rem',
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        background: q.correctOpt === opt ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
                                        color: q.correctOpt === opt ? '#4ade80' : '#94a3b8',
                                        fontWeight: q.correctOpt === opt ? 800 : 500,
                                        border: q.correctOpt === opt ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.05)'
                                      }}>
                                        {opt}: {q[`option${opt}`]} {q.correctOpt === opt && '✓'}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <button onClick={async () => {
                                if (confirm('આ પ્રશ્ન દૂર કરવો છે?')) {
                                  try {
                                    await deleteQuestion(q.id);
                                    showToast('પ્રશ્ન દૂર થયો.', 'success');
                                    fetchQ();
                                  } catch {
                                    showToast('ડીલીટ કરવામાં ક્ષતિ.', 'error');
                                  }
                                }
                              }} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
                                title="પ્રશ્ન દૂર કરો">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}



    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LIVE CONTROLLER — Test Selection, Preview & Multi-Test Live Manager
═══════════════════════════════════════════════════════ */
function LiveController({ showToast, selectedTestCode, setSelectedTestCode }) {
  const { teacherProfile } = useStore();
  const [allQuestions, setAllQuestions] = useState([]);
  const [loading, setLoading]           = useState(true);

  // Search & Filter state
  const [searchCode, setSearchCode]         = useState('');
  const [filterSubject, setFilterSubject]   = useState('ALL');

  // Multi-Selection State for Batch Live
  const [selectedTestCodes, setSelectedTestCodes] = useState([]);

  // Live session state
  const [testActive, setTestActive]         = useState(false);
  const [activeTestCodes, setActiveTestCodes] = useState([]); // List of active testCodes
  const [activeTestObj, setActiveTestObj]   = useState(null);  // Aggregated active test object
  const [duration, setDuration]             = useState(60);
  const [elapsed, setElapsed]               = useState(0);
  const itvRef = useRef(null);

  // Scheduling state
  const [schedulingTest, setSchedulingTest]     = useState(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Preview & Edit modal state
  const [previewTest, setPreviewTest]           = useState(null); // Test currently in preview modal
  const [expandedTestCode, setExpandedTestCode] = useState(null); // Expanded accordion test
  const [editingQId, setEditingQId]             = useState(null); // ID of question being edited
  const [editForm, setEditForm]                 = useState({});
  const [showAddInPreview, setShowAddInPreview] = useState(false);
  const [newQInPreview, setNewQInPreview]       = useState({
    text: '', type: 'mcq', optionA: '', optionB: '', optionC: '', optionD: '', correctOpt: 'A', marks: 1, image: '', imageUrl: '', optionA_img: '', optionB_img: '', optionC_img: '', optionD_img: '', answerHint: ''
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await getAllQuestions();
      const qs = Array.isArray(res.data) ? res.data : [];
      setAllQuestions(qs);

      // Auto detect currently active tests from DB (including auto-activated scheduled tests)
      const dbActiveCodes = [...new Set(qs.filter(q => q.isActive).map(q => q.testCode).filter(Boolean))];
      setActiveTestCodes(dbActiveCodes);
      setTestActive(dbActiveCodes.length > 0);
    } catch {
      showToast('કસોટીઓ લોડ કરવામાં ક્ષતિ.', 'error');
    }
    setLoading(false);
  };

  // Group questions into tests
  const testGroupsMap = useMemo(() => {
    const map = {};
    allQuestions.forEach(q => {
      const key = q.testCode || (q.chapter ? `CHAPTER-${q.chapter}` : 'DEFAULT-TEST');
      if (!map[key]) {
        map[key] = {
          testCode:    q.testCode || key,
          testName:    q.testName || q.chapter || 'સામાન્ય કસોટી (General Test)',
          subject:     q.subject  || 'General',
          timeLimit:   q.timeLimit || 60,
          scheduledAt: q.scheduledAt || null,
          questions:   [],
          totalMarks:  0,
          mcqCount:    0,
          descCount:   0,
        };
      }
      map[key].questions.push(q);
      map[key].totalMarks += (q.marks || 1);
      if (q.scheduledAt && !map[key].scheduledAt) {
        map[key].scheduledAt = q.scheduledAt;
      }
      if (q.type === 'mcq') map[key].mcqCount++;
      else map[key].descCount++;
    });
    return map;
  }, [allQuestions]);

  const testList = useMemo(() => Object.values(testGroupsMap), [testGroupsMap]);

  // Keep activeTestObj in sync whenever testList or activeTestCodes changes
  useEffect(() => {
    if (activeTestCodes.length > 0 && testList.length > 0) {
      const matchedTests = testList.filter(t => activeTestCodes.includes(t.testCode));
      if (matchedTests.length > 0) {
        const maxLimit = Math.max(...matchedTests.map(t => t.timeLimit || 60), 60);
        const combinedQuestions = matchedTests.flatMap(t => t.questions);
        const combinedMarks = matchedTests.reduce((a, t) => a + (t.totalMarks || 0), 0);

        setActiveTestObj({
          isMulti: matchedTests.length > 1,
          testList: matchedTests,
          testCodes: activeTestCodes,
          testCode: activeTestCodes.join(', '),
          testName: matchedTests.length === 1 ? matchedTests[0].testName : `${matchedTests.length} કસોટીઓ એકસાથે Live`,
          subject: matchedTests.map(t => t.subject).filter((v,i,a)=>a.indexOf(v)===i).join(', '),
          timeLimit: maxLimit,
          questions: combinedQuestions,
          totalMarks: combinedMarks,
          mcqCount: matchedTests.reduce((a, t) => a + t.mcqCount, 0),
          descCount: matchedTests.reduce((a, t) => a + t.descCount, 0),
        });
        setDuration(maxLimit);
        setTestActive(true);
      }
    } else if (activeTestCodes.length === 0) {
      setActiveTestObj(null);
      setTestActive(false);
    }
  }, [activeTestCodes, testList]);

  // Distinct subjects for filter
  const distinctSubjects = useMemo(() => {
    const set = new Set();
    testList.forEach(t => { if (t.subject) set.add(t.subject); });
    return Array.from(set);
  }, [testList]);

  // Filtered test list based on Test ID / Name / Subject search
  const filteredTestList = useMemo(() => {
    return testList.filter(t => {
      const term = searchCode.trim().toLowerCase();
      const matchesSearch = !term ||
        t.testCode.toLowerCase().includes(term) ||
        t.testName.toLowerCase().includes(term);
      const matchesSubject = filterSubject === 'ALL' || t.subject === filterSubject;
      return matchesSearch && matchesSubject;
    });
  }, [testList, searchCode, filterSubject]);

  // Filter to created test if passed from TestGenerate, without popping up blur overlay modal
  useEffect(() => {
    if (selectedTestCode && testList.length > 0) {
      const match = testList.find(t => t.testCode === selectedTestCode);
      if (match) {
        setSearchCode(selectedTestCode);
        if (setSelectedTestCode) setSelectedTestCode(null);
      }
    }
  }, [selectedTestCode, testList, setSelectedTestCode]);

  // Multi-Selection Toggles
  const toggleSelectTest = (testCode) => {
    setSelectedTestCodes(prev =>
      prev.includes(testCode) ? prev.filter(c => c !== testCode) : [...prev, testCode]
    );
  };

  const handleSelectAll = () => {
    if (selectedTestCodes.length === filteredTestList.length) {
      setSelectedTestCodes([]);
    } else {
      setSelectedTestCodes(filteredTestList.map(t => t.testCode));
    }
  };

  // ── Toggle Individual Test Live (Start/Add or Stop) ──
  const handleToggleTestLive = async (testCode, targetAction) => {
    try {
      if (targetAction === 'stop') {
        const res = await activateTest({ testCode, action: 'stop' });
        const remainingCodes = res.data?.activeTestCodes || activeTestCodes.filter(c => c !== testCode);
        setActiveTestCodes(remainingCodes);
        if (remainingCodes.length === 0) {
          clearInterval(itvRef.current);
          setTestActive(false);
          setActiveTestObj(null);
          setElapsed(0);
          showToast(`⏹️ કસોટી (ID: ${testCode}) લાઈવ બંધ કરવામાં આવી.`, 'info');
        } else {
          showToast(`⏹️ કસોટી (ID: ${testCode}) બંધ થઈ. અન્ય કસોટીઓ હજુ Live ચાલુ છે.`, 'info');
        }
      } else {
        // Start or Add this test to live
        const res = await activateTest({ testCode, action: 'add', append: true });
        const finalActiveCodes = res.data?.activeTestCodes || [...new Set([...activeTestCodes, testCode])];
        setActiveTestCodes(finalActiveCodes);
        setTestActive(true);
        setPreviewTest(null);

        // Start/continue countdown timer
        if (!itvRef.current) {
          setElapsed(0);
          itvRef.current = setInterval(() => {
            setElapsed(prev => prev + 1);
          }, 1000);
        }

        const testName = testGroupsMap[testCode]?.testName || testCode;
        showToast(
          activeTestCodes.length > 0
            ? `➕ કસોટી "${testName}" પણ Live ઉમેરાઈ ગઈ! હવે બંને કસોટીઓ Live છે.`
            : `🔴 કસોટી "${testName}" Live શરૂ થઈ!`,
          'success'
        );
      }
      await fetchData();
    } catch {
      showToast('લાઈવ સ્ટેટસ બદલવામાં ક્ષતિ.', 'error');
    }
  };

  // ── Start Live Session (Batch Go Live) ───────────────
  const handleStartBatchLive = async (codesToActivate) => {
    const codes = Array.isArray(codesToActivate) ? codesToActivate.filter(Boolean) : [codesToActivate];
    if (codes.length === 0) {
      showToast('કૃપા કરીને ઓછામાં ઓછી ૧ કસોટી પસંદ કરો.', 'error');
      return;
    }

    try {
      const res = await activateTest({ testCodes: codes });
      const finalActive = res.data?.activeTestCodes || codes;
      setActiveTestCodes(finalActive);
      setElapsed(0);
      setTestActive(true);
      setPreviewTest(null);

      // Start timer
      clearInterval(itvRef.current);
      itvRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      showToast(`🔴 ${codes.length} કસોટીઓ સફળતાપૂર્વક Live શરૂ થઈ!`, 'success');
      await fetchData();
    } catch {
      showToast('લાઈવ શરૂ કરવામાં ક્ષતિ.', 'error');
    }
  };

  // ── Stop All Live Sessions ────────────────────────────
  const handleStopAllLive = async () => {
    try {
      await activateTest({ deactivateAll: true });
    } catch (e) {
      console.warn('Deactivate error:', e);
    }
    clearInterval(itvRef.current);
    itvRef.current = null;
    setTestActive(false);
    setActiveTestCodes([]);
    setActiveTestObj(null);
    setElapsed(0);
    showToast('⏹️ તમામ લાઈવ કસોટીઓ બંધ કરવામાં આવી.', 'info');
    await fetchData();
  };

  // ── Schedule Test (Single or Bulk) ───────────────────
  const handleSaveSchedule = async () => {
    if (!schedulingTest) return;
    try {
      const targets = schedulingTest.testCodes || (schedulingTest.testCode ? [schedulingTest.testCode] : []);
      await scheduleTest({ testCodes: targets, scheduledAt: scheduleDateTime || null });
      showToast(
        scheduleDateTime
          ? `⏰ ${targets.length} કસોટી(ઓ)નો સમય શિડ્યુલ થઈ ગયો: ${scheduleDateTime}`
          : 'શિડ્યુલ દૂર કરવામાં આવ્યું.',
        'success'
      );
      setSchedulingTest(null);
      setScheduleDateTime('');
      await fetchData();
    } catch {
      showToast('શિડ્યુલ કરવામાં ક્ષતિ.', 'error');
    }
  };

  // ── Edit Question inside Preview ──────────────────────
  const handleSaveQuestionEdit = async (qid) => {
    try {
      await updateQuestion(qid, editForm);
      showToast('✅ પ્રશ્ન સુધારી લેવાયો!', 'success');
      setEditingQId(null);
      setEditForm({});
      await fetchData();
      setPreviewTest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.map(q => q.id === qid ? { ...q, ...editForm } : q)
        };
      });
    } catch {
      showToast('પ્રશ્ન સુધારવામાં ક્ષતિ.', 'error');
    }
  };

  // ── Delete Question inside Preview ────────────────────
  const handleDeleteInPreview = async (qid) => {
    if (!confirm('આ પ્રશ્ન ખરેખર દૂર કરવો છે?')) return;
    try {
      await deleteQuestion(qid);
      showToast('પ્રશ્ન દૂર થયો.', 'success');
      await fetchData();
      setPreviewTest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.filter(q => q.id !== qid)
        };
      });
    } catch {
      showToast('પ્રશ્ન ડીલીટ કરવામાં ક્ષતિ.', 'error');
    }
  };

  // ── Remove Question Image in Preview ─────────────────
  const handleRemoveImageInPreview = async (qid) => {
    try {
      await updateQuestion(qid, { image: '', imageUrl: '' });
      showToast('🗑️ ફોટો દૂર થઈ ગયો.', 'success');
      await fetchData();
      setPreviewTest(prev => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.map(q => q.id === qid ? { ...q, image: '', imageUrl: '' } : q)
        };
      });
    } catch {
      showToast('ક્ષતિ.', 'error');
    }
  };

  // ── Add Question inside Preview ──────────────────────
  const handleAddQuestionToTest = async () => {
    if (!newQInPreview.text.trim()) { showToast('Question text ભરો', 'error'); return; }
    if (newQInPreview.type === 'mcq' && !newQInPreview.optionA && !newQInPreview.optionA_img) { showToast('Option A ભરો અથવા ફોટો અપલોડ કરો', 'error'); return; }

    try {
      const toAdd = {
        ...newQInPreview,
        subject:   previewTest.subject,
        chapter:   previewTest.testName,
        testCode:  previewTest.testCode,
        testName:  previewTest.testName,
        timeLimit: previewTest.timeLimit,
        isActive:  false,
      };
      await createQuestion(toAdd);
      showToast('✅ નવો પ્રશ્ન ઉમેરાયો!', 'success');
      setShowAddInPreview(false);
      setNewQInPreview({
        text: '', type: 'mcq', optionA: '', optionB: '', optionC: '', optionD: '', correctOpt: 'A', marks: 1, image: '', imageUrl: '', optionA_img: '', optionB_img: '', optionC_img: '', optionD_img: '', answerHint: ''
      });
      await fetchData();
    } catch {
      showToast('પ્રશ્ન ઉમેરવામાં ક્ષતિ.', 'error');
    }
  };

  const elapsedHH = Math.floor(elapsed / 3600);
  const elapsedMM = Math.floor((elapsed % 3600) / 60);
  const elapsedSS = elapsed % 60;
  const elapsedStr = elapsedHH > 0
    ? `${String(elapsedHH).padStart(2,'0')}:${String(elapsedMM).padStart(2,'0')}:${String(elapsedSS).padStart(2,'0')}`
    : `${String(elapsedMM).padStart(2,'0')}:${String(elapsedSS).padStart(2,'0')}`;

  return (
    <div className="animate-fade-in">

      {/* ── Active Live Test Running Banner ── */}
      {testActive && activeTestObj && (
        <div className="glass-card animate-fade-in" style={{ padding: 24, border: '2px solid rgba(34,197,94,0.6)', marginBottom: 22, background: 'linear-gradient(135deg,rgba(15,23,42,0.95),rgba(5,46,22,0.9))', boxShadow: '0 0 30px rgba(34,197,94,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="live-dot" style={{ width: 14, height: 14, boxShadow: '0 0 16px #22c55e' }} />
              <div>
                <div style={{ color: '#4ade80', fontWeight: 900, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>🔴 LIVE TEST ચાલુ છે:</span>
                  <span style={{ color: 'white' }}>{activeTestObj.testName}</span>
                  {activeTestObj.isMulti && (
                    <span style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8', fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(56,189,248,0.4)' }}>
                      ⚡ {activeTestObj.testList?.length} કસોટીઓ એકસાથે સક્રિય
                    </span>
                  )}
                </div>

                {/* Active Test IDs Badges List with individual stop chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {activeTestObj.testList?.map(t => (
                    <span key={t.testCode} style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 900, padding: '4px 10px', borderRadius: 8, border: '1.5px solid rgba(56,189,248,0.35)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span>🏷️ {t.testName} (ID: {t.testCode})</span>
                      <button onClick={() => handleToggleTestLive(t.testCode, 'stop')}
                        title={`આ ${t.testName} કસોટી લાઈવ બંધ કરો`}
                        style={{ background: 'rgba(239,68,68,0.3)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5', borderRadius: 4, padding: '2px 7px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 800 }}>
                        ✕ Stop
                      </button>
                    </span>
                  ))}
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    • કુલ {activeTestObj.questions?.length} પ્રશ્નો ({activeTestObj.mcqCount} MCQ + {activeTestObj.descCount} Desc) • {activeTestObj.totalMarks} ગુણ
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => {
                if (activeTestObj.testList?.length === 1) {
                  exportTestPDF(activeTestObj.testList[0], teacherProfile);
                } else {
                  activeTestObj.testList?.forEach(t => exportTestPDF(t, teacherProfile));
                }
              }}
                style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', padding: '9px 16px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif' }}>
                <Download size={15} /> PDF
              </button>
              <button onClick={handleStopAllLive}
                style={{ background: 'linear-gradient(135deg,#7f1d1d,#ef4444)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 10, fontWeight: 900, cursor: 'pointer', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Hind Vadodara, sans-serif', boxShadow: '0 4px 18px rgba(239,68,68,0.4)' }}>
                <Square size={16} fill="white" /> ⏹️ તમામ Live બંધ કરો (Stop All)
              </button>
            </div>
          </div>

          {/* Active Live Stopwatch & Manual Control Info */}
          <div style={{ textAlign: 'center', margin: '18px 0', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: 14, border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: 'clamp(2.5rem,8vw,3.8rem)', fontWeight: 900, color: '#22c55e', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 25px rgba(34,197,94,0.35)' }}>
              ⏱️ {elapsedStr}
            </div>
            <div style={{ color: '#4ade80', fontSize: '0.9rem', fontWeight: 800, marginTop: 4 }}>
              🟢 લાઈવ સેશન ચાલુ છે (LIVE ACTIVE DURATION)
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 6 }}>
              💡 કસોટી સતત ચાલુ રહેશે જ્યાં સુધી શિક્ષક મેન્યુઅલી <strong>'⏹️ તમામ Live બંધ કરો'</strong> અથવા <strong>'✕ Stop'</strong> નહીં કરે.
            </div>
          </div>

          {/* Student Link Share */}
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ color: '#4ade80', fontSize: '0.78rem', fontWeight: 800 }}>📱 વિદ્યાર્થીઓ સાથે શેર કરવાની લિંક (Share Link):</div>
              <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem', marginTop: 4 }}>
                {window.location.origin}/exam
              </div>
            </div>
            <button onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}/exam`);
              showToast('📋 લિંક કોપી થઈ ગઈ!', 'success');
            }} style={{ background: 'rgba(34,197,94,0.25)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80', padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
              📋 Copy Link
            </button>
          </div>
        </div>
      )}

      {/* ── BATCH SELECTION ACTION BAR (Floating / Sticky Banner) ── */}
      {testList.length > 0 && (
        <div className="glass-card animate-fade-in" style={{
          padding: '14px 18px',
          marginBottom: 16,
          background: selectedTestCodes.length > 0
            ? 'linear-gradient(135deg,rgba(30,58,138,0.7),rgba(6,78,59,0.7))'
            : 'rgba(255,255,255,0.03)',
          border: selectedTestCodes.length > 0
            ? '2px solid rgba(34,197,94,0.6)'
            : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: selectedTestCodes.length > 0 ? '0 8px 30px rgba(5,150,105,0.3)' : 'none',
          transition: 'all 0.3s'
        }}>
          {/* Left: Checkbox Selector & Count Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={selectedTestCodes.length === filteredTestList.length && filteredTestList.length > 0}
                onChange={handleSelectAll}
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }}
              />
              <span>બધી કસોટીઓ પસંદ કરો (Select All)</span>
            </label>

            {selectedTestCodes.length > 0 ? (
              <span style={{ background: 'rgba(16,185,129,0.25)', color: '#34d399', fontSize: '0.8rem', fontWeight: 800, padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.4)' }}>
                🎯 {selectedTestCodes.length} કસોટીઓ સિલેક્ટ થયેલ છે ({selectedTestCodes.join(', ')})
              </span>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                (નીચેથી તમને જોઈતી કસોટીઓના Checkbox ટીક કરીને એકસાથે Live કરો)
              </span>
            )}
          </div>

          {/* Right: Master Batch Actions (Bulk Schedule & Bulk Live) */}
          <div className="sa-marks-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedTestCodes.length > 0 && (
              <button onClick={() => setSelectedTestCodes([])}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '9px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                ✕ Clear ({selectedTestCodes.length})
              </button>
            )}

            {/* Bulk Schedule Button */}
            {selectedTestCodes.length > 0 && (
              <button
                onClick={() => {
                  const matched = testList.filter(t => selectedTestCodes.includes(t.testCode));
                  setSchedulingTest({
                    isBulk: true,
                    testCodes: selectedTestCodes,
                    testName: `${selectedTestCodes.length} કસોટીઓ શિડ્યુલ (${matched.map(t => t.testName).join(', ')})`,
                    subject: matched.map(t => t.subject).filter((v,i,a)=>a.indexOf(v)===i).join(', '),
                    questions: matched.flatMap(t => t.questions),
                    scheduledAt: matched[0]?.scheduledAt || ''
                  });
                  setScheduleDateTime(matched[0]?.scheduledAt || '');
                }}
                style={{
                  background: 'linear-gradient(135deg,#d97706,#f59e0b)',
                  color: 'white',
                  border: 'none',
                  padding: '11px 18px',
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Hind Vadodara, sans-serif',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.35)'
                }}>
                <Clock size={15} /> ⏰ પસંદ કરેલી ({selectedTestCodes.length}) શિડ્યુલ કરો
              </button>
            )}

            <button
              onClick={() => {
                if (selectedTestCodes.length === 0) {
                  // If none explicitly checked, activate all visible tests
                  handleStartBatchLive(filteredTestList.map(t => t.testCode));
                } else {
                  handleStartBatchLive(selectedTestCodes);
                }
              }}
              style={{
                background: 'linear-gradient(135deg,#059669,#10b981)',
                color: 'white',
                border: 'none',
                padding: '11px 22px',
                borderRadius: 10,
                fontWeight: 900,
                cursor: 'pointer',
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'Hind Vadodara, sans-serif',
                boxShadow: '0 4px 20px rgba(16,185,129,0.4)'
              }}>
              <Play size={16} fill="white" />
              {selectedTestCodes.length > 1
                ? `🚀 પસંદ કરેલી ${selectedTestCodes.length} કસોટીઓ એકસાથે Live કરો`
                : selectedTestCodes.length === 1
                  ? `🚀 પસંદ કરેલી ૧ કસોટી Live કરો`
                  : `⚡ તમામ (${testList.length}) કસોટીઓ એકસાથે Live કરો`}
            </button>
          </div>
        </div>
      )}

      {/* ── TESTS LIST (Preview & Live Launcher Cards) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
            🎯 ઉપલબ્ધ કસોટીઓ (Available Tests for Live)
          </h3>
          <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
            ટેસ્ટ આઈડી (Test ID) વડે સર્ચ કરો, પ્રિવ્યૂ જુઓ, પ્રશ્નો સુધારો, કસોટી શિડ્યુલ કરો અથવા એકસાથે Live શરૂ કરો.
          </div>
        </div>
        <button onClick={fetchData}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ── SEARCH & FILTER BY TEST ID BAR ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <input
            className="input-dark"
            placeholder="🔍 ટેસ્ટ આઈડી (Test ID / Code) અથવા કસોટીનું નામ શોધો..."
            value={searchCode}
            onChange={e => setSearchCode(e.target.value)}
            style={{ width: '100%', padding: '9px 34px 9px 12px', fontSize: '0.85rem' }}
          />
          {searchCode && (
            <button onClick={() => setSearchCode('')}
              title="Clear Search"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', padding: 2 }}>
              ✕
            </button>
          )}
        </div>

        {/* Subject Filter Dropdown */}
        {distinctSubjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              className="input-dark"
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              style={{ padding: '9px 12px', fontSize: '0.82rem', minWidth: 130 }}>
              <option value="ALL">📚 તમામ વિષયો (All)</option>
              {distinctSubjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Result Count Badge */}
        <div style={{ color: '#38bdf8', fontSize: '0.78rem', fontWeight: 800, padding: '6px 12px', background: 'rgba(56,189,248,0.1)', borderRadius: 8, border: '1px solid rgba(56,189,248,0.2)', whiteSpace: 'nowrap' }}>
          {filteredTestList.length} / {testList.length} કસોટીઓ
        </div>
      </div>

      {loading ? <Loader /> : (
        <>
          {testList.length === 0 ? (
            <div className="glass-card" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 10 }}>📝</div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>હજુ સુધી કોઈ કસોટી તૈયાર નથી.</div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 16 }}>Test Generate ટેબમાં જઈને નવી કસોટી બનાવો.</div>
            </div>
          ) : filteredTestList.length === 0 ? (
            <div className="glass-card animate-fade-in" style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔍</div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.95rem', marginBottom: 4 }}>
                "{searchCode}" ટેસ્ટ આઈડી / નામ સાથે કોઈ કસોટી મળી નથી.
              </div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 14 }}>
                ટેસ્ટ કોડ યોગ્ય રીતે તપાસો અથવા સર્ચ રીસેટ કરો.
              </div>
              <button onClick={() => { setSearchCode(''); setFilterSubject('ALL'); }}
                style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                🔄 સર્ચ રીસેટ કરો (Clear Search)
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
              {filteredTestList.map(t => {
                const isSelected = selectedTestCodes.includes(t.testCode);
                const isCurrentLive = testActive && activeTestCodes.includes(t.testCode);
                const isExpanded = expandedTestCode === t.testCode;
                const typeText = t.mcqCount > 0 && t.descCount > 0
                  ? `🔀 Mixed (${t.mcqCount}M+${t.descCount}D)`
                  : t.mcqCount > 0
                    ? `🔵 MCQ (${t.mcqCount})`
                    : `📝 Desc (${t.descCount})`;

                return (
                  <div key={t.testCode} className="glass-card animate-fade-in"
                    style={{
                      padding: isExpanded ? 22 : 18,
                      borderRadius: 16,
                      gridColumn: isExpanded ? '1 / -1' : 'auto',
                      border: isCurrentLive
                        ? '2px solid #22c55e'
                        : isExpanded
                          ? '2px solid #818cf8'
                          : isSelected
                            ? '2px solid #38bdf8'
                            : t.scheduledAt
                              ? '1.5px solid rgba(245,158,11,0.6)'
                              : '1.5px solid rgba(255,255,255,0.12)',
                      background: isCurrentLive
                        ? 'linear-gradient(135deg,rgba(15,23,42,0.98),rgba(6,78,59,0.35))'
                        : isExpanded
                          ? 'linear-gradient(135deg,#0d1527,#161e38)'
                          : isSelected
                            ? 'linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,58,138,0.35))'
                            : t.scheduledAt
                              ? 'linear-gradient(135deg,rgba(15,23,42,0.98),rgba(120,53,15,0.25))'
                              : '#0f172a',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14,
                      boxShadow: isCurrentLive ? '0 4px 25px rgba(34,197,94,0.25)' : isExpanded ? '0 8px 36px rgba(99,102,241,0.35)' : isSelected ? '0 4px 20px rgba(56,189,248,0.25)' : '0 4px 16px rgba(0,0,0,0.3)',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>

                    <div>
                      {/* ── DIRECT LIVE TIK BOX (આ કસોટી Live કરો) ── */}
                      <div
                        onClick={() => handleToggleTestLive(t.testCode, isCurrentLive ? 'stop' : 'start')}
                        style={{
                          background: isCurrentLive
                            ? 'linear-gradient(135deg,rgba(16,185,129,0.3),rgba(5,150,105,0.2))'
                            : '#1e293b',
                          border: isCurrentLive ? '1.5px solid #10b981' : '1.5px solid rgba(255,255,255,0.18)',
                          borderRadius: 10,
                          padding: '10px 14px',
                          marginBottom: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: isCurrentLive ? '0 0 16px rgba(16,185,129,0.3)' : 'none'
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isCurrentLive}
                            onChange={() => {}} // handled by parent click
                            style={{
                              width: 20,
                              height: 20,
                              cursor: 'pointer',
                              accentColor: '#10b981'
                            }}
                          />
                          <span style={{
                            color: isCurrentLive ? '#4ade80' : '#ffffff',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}>
                            {isCurrentLive ? (
                              <><span className="live-dot" style={{ width: 8, height: 8 }} /> 🔴 આ કસોટી Live છે (Tick કરેલ)</>
                            ) : (
                              <>⭕ આ કસોટી Live કરો (Tik Box)</>
                            )}
                          </span>
                        </div>

                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: isCurrentLive ? '#6ee7b7' : '#cbd5e1',
                          background: isCurrentLive ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.1)',
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: isCurrentLive ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.15)'
                        }}>
                          {isCurrentLive ? 'Stop કરવા Uncheck કરો' : 'Live કરવા Tik કરો ✓'}
                        </span>
                      </div>

                      {/* Badges Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Batch Selection Checkbox */}
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(56,189,248,0.25)' : '#1e293b',
                            padding: '4px 9px',
                            borderRadius: 6,
                            border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                            transition: 'all 0.2s'
                          }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTest(t.testCode)}
                              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#38bdf8' }}
                            />
                            <span style={{ color: isSelected ? '#38bdf8' : '#cbd5e1', fontSize: '0.72rem', fontWeight: 700 }}>
                              બલ્ક સિલેક્ટ
                            </span>
                          </label>

                          <span style={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd', fontSize: '0.74rem', fontWeight: 800, padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.4)' }}>
                            📚 {t.subject}
                          </span>
                          <span style={{ background: 'rgba(168,85,247,0.25)', color: '#d8b4fe', fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.4)' }}>
                            {typeText}
                          </span>
                        </div>

                        <span style={{ background: '#1e293b', color: '#38bdf8', fontSize: '0.74rem', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 900, border: '1px solid rgba(56,189,248,0.4)' }}>
                          🏷️ ID: {t.testCode}
                        </span>
                      </div>

                      {/* Scheduled Badge if scheduled */}
                      {t.scheduledAt && (
                        <div style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', padding: '6px 12px', borderRadius: 8, color: '#fde68a', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Calendar size={13} />
                          <span>⏰ શિડ્યુલ: {new Date(t.scheduledAt).toLocaleString('gu-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      )}

                      {/* Test Title */}
                      <h4 style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.1rem', margin: '6px 0 12px', lineHeight: 1.35 }}>
                        {t.testName}
                      </h4>

                      {/* Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, background: '#1e293b', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>પ્રશ્નો</div>
                          <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.9rem' }}>
                            {t.questions.length} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({t.mcqCount}M+{t.descCount}D)</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>કુલ ગુણ</div>
                          <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '0.9rem' }}>{t.totalMarks}m</div>
                        </div>
                        <div>
                          <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700 }}>સમય</div>
                          <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '0.9rem' }}>
                            {t.timeLimit === 0 ? '♾️ No Limit' : t.timeLimit <= 300 ? `⏱️ ${t.timeLimit}s/Q` : `⏳ ${Math.round(t.timeLimit / 60)}m`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Preview/Edit, Schedule, PDF & Live */}
                    <div style={{ display: 'flex', gap: 7, marginTop: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => {
                        setExpandedTestCode(isExpanded ? null : t.testCode);
                        setEditingQId(null);
                        setShowAddInPreview(false);
                      }}
                        style={{
                          flex: 1, minWidth: 95,
                          background: isExpanded ? 'linear-gradient(135deg,#4338ca,#6366f1)' : 'rgba(99,102,241,0.25)',
                          border: isExpanded ? '1.5px solid #a5b4fc' : '1.5px solid #818cf8',
                          color: '#ffffff',
                          padding: '9px 10px',
                          borderRadius: 8,
                          fontWeight: 900,
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontFamily: 'Hind Vadodara, sans-serif',
                          boxShadow: isExpanded ? '0 0 14px rgba(99,102,241,0.4)' : 'none'
                        }}>
                        <Eye size={14} /> {isExpanded ? '✕ પ્રીવ્યુ છુપાવો' : '👁️ Preview જુઓ'}
                      </button>

                      {/* Schedule Button */}
                      <button onClick={() => {
                        setSchedulingTest(t);
                        setScheduleDateTime(t.scheduledAt || '');
                      }}
                        style={{ flex: 1, minWidth: 90, background: 'rgba(245,158,11,0.2)', border: '1.5px solid #f59e0b', color: '#fef3c7', padding: '9px 8px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'Hind Vadodara, sans-serif' }}>
                        <Clock size={14} /> {t.scheduledAt ? '⏰ Edit' : '⏰ Schedule'}
                      </button>

                      <button onClick={() => exportTestPDF(t, teacherProfile)}
                        title="કસોટી PDF ડાઉનલોડ / પ્રિન્ટ કરો"
                        style={{ background: 'rgba(59,130,246,0.22)', border: '1.5px solid #60a5fa', color: '#dbeafe', padding: '9px 11px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'Hind Vadodara, sans-serif' }}>
                        <Download size={14} /> PDF
                      </button>

                      {!isCurrentLive ? (
                        <button onClick={() => handleToggleTestLive(t.testCode, 'start')}
                          style={{
                            flex: 1.3,
                            minWidth: 105,
                            background: activeTestCodes.length > 0
                              ? 'linear-gradient(135deg,#0d9488,#14b8a6)'
                              : 'linear-gradient(135deg,#047857,#10b981)',
                            border: 'none',
                            color: 'white',
                            padding: '9px 10px',
                            borderRadius: 8,
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            fontFamily: 'Hind Vadodara, sans-serif',
                            boxShadow: '0 4px 14px rgba(5,150,105,0.35)'
                          }}>
                          <Play size={13} fill="white" />
                          {activeTestCodes.length > 0 ? '➕ આ પણ Live' : 'Live કરો'}
                        </button>
                      ) : (
                        <button onClick={() => handleToggleTestLive(t.testCode, 'stop')}
                          style={{
                            flex: 1.2,
                            minWidth: 95,
                            background: 'linear-gradient(135deg,#7f1d1d,#ef4444)',
                            border: 'none',
                            color: 'white',
                            padding: '9px 10px',
                            borderRadius: 8,
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            fontFamily: 'Hind Vadodara, sans-serif',
                            boxShadow: '0 4px 14px rgba(239,68,68,0.35)'
                          }}>
                          <Square size={13} fill="white" /> ⏹️ Stop Live
                        </button>
                      )}
                    </div>

                    {/* ── IN-PLACE INLINE QUESTION PREVIEW (ત્યાં ને ત્યાં જ ઓપન થાય - No scrolling up needed!) ── */}
                    {isExpanded && (
                      <div className="animate-fade-in" style={{ marginTop: 14, paddingTop: 16, borderTop: '1.5px dashed rgba(99,102,241,0.35)' }}>

                        {/* Top Action Strip of Inline Preview */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8, background: '#1e293b', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ color: '#a5b4fc', fontSize: '0.9rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
                            📋 પ્રશ્નવાર પ્રીવ્યુ & સુધારો ({t.questions.length} પ્રશ્નો):
                          </span>
                          <button onClick={() => setShowAddInPreview(!showAddInPreview)}
                            style={{ background: showAddInPreview ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.25)', border: showAddInPreview ? '1px solid rgba(239,68,68,0.4)' : '1px solid #818cf8', color: showAddInPreview ? '#fca5a5' : '#e0e7ff', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                            <Plus size={13} /> {showAddInPreview ? 'Cancel' : '➕ નવો પ્રશ્ન ઉમેરો'}
                          </button>
                        </div>

                        {/* Add Question Inline Form */}
                        {showAddInPreview && (
                          <div className="glass-card animate-fade-in" style={{ padding: 14, border: '1.5px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.06)', borderRadius: 12, marginBottom: 14 }}>
                            <div style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', marginBottom: 10 }}>➕ આ ટેસ્ટમાં નવો પ્રશ્ન ઉમેરો</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                              <select className="input-dark" value={newQInPreview.type} onChange={e => setNewQInPreview(q => ({ ...q, type: e.target.value }))}>
                                <option value="mcq">🔵 MCQ</option>
                                <option value="descriptive">📝 Descriptive</option>
                              </select>
                              <input className="input-dark" type="number" min={1} max={50} value={newQInPreview.marks} placeholder="Marks" onChange={e => setNewQInPreview(q => ({ ...q, marks: Number(e.target.value) }))} />
                            </div>
                            <textarea className="input-dark" rows={2} placeholder="પ્રશ્ન અહીં લખો..." value={newQInPreview.text} onChange={e => setNewQInPreview(q => ({ ...q, text: e.target.value }))} style={{ marginBottom: 10 }} />

                            {/* Question Image */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8', fontSize: '0.72rem' }}>
                                  <ImageIcon size={13} /> પ્રશ્નનો ફોટો (Question Image)
                                </label>
                                {(newQInPreview.image || newQInPreview.imageUrl) && (
                                  <button type="button" onClick={() => setNewQInPreview(q => ({ ...q, image: '', imageUrl: '' }))}
                                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>
                                    🗑️ ફોટો દૂર કરો
                                  </button>
                                )}
                              </div>
                              {(newQInPreview.image || newQInPreview.imageUrl) ? (
                                <div style={{ textAlign: 'center', padding: '6px', background: '#000', borderRadius: 8 }}>
                                  <img src={newQInPreview.image || newQInPreview.imageUrl} alt="preview" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 6 }} />
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>
                                    📁 ફોટો સિલેક્ટ કરો
                                    <input type="file" accept="image/*" style={{ display: 'none' }}
                                      onChange={e => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const r = new FileReader();
                                        r.onload = ev => setNewQInPreview(q => ({ ...q, image: ev.target.result, imageUrl: ev.target.result }));
                                        r.readAsDataURL(file);
                                        e.target.value = '';
                                      }} />
                                  </label>
                                  <input className="input-dark" style={{ flex: 1, minWidth: 130, fontSize: '0.75rem', padding: '6px 8px' }}
                                    placeholder="Image URL / Base64..."
                                    value={newQInPreview.image || newQInPreview.imageUrl || ''}
                                    onChange={e => setNewQInPreview(q => ({ ...q, image: e.target.value, imageUrl: e.target.value }))} />
                                </div>
                              )}
                            </div>

                            {/* Options */}
                            {newQInPreview.type === 'mcq' && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                                  {['A','B','C','D'].map(opt => (
                                    <div key={opt}>
                                      <input className="input-dark" placeholder={`Option ${opt}`} value={newQInPreview[`option${opt}`]} onChange={e => setNewQInPreview(q => ({ ...q, [`option${opt}`]: e.target.value }))} style={{ marginBottom: 3 }} />
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {['A','B','C','D'].map(opt => (
                                    <button key={opt} type="button" onClick={() => setNewQInPreview(q => ({ ...q, correctOpt: opt }))}
                                      style={{ flex: 1, padding: '6px', borderRadius: 8, border: `1.5px solid ${newQInPreview.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: newQInPreview.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'transparent', color: newQInPreview.correctOpt === opt ? '#22c55e' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>
                                      {opt} {newQInPreview.correctOpt === opt && '✓'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <button onClick={async () => {
                              if (!newQInPreview.text.trim()) { showToast('Question text ભરો', 'error'); return; }
                              if (newQInPreview.type === 'mcq' && !newQInPreview.optionA && !newQInPreview.optionA_img) { showToast('Option A ભરો અથવા ફોટો અપલોડ કરો', 'error'); return; }
                              try {
                                const toAdd = {
                                  ...newQInPreview,
                                  subject:   t.subject,
                                  chapter:   t.testName,
                                  testCode:  t.testCode,
                                  testName:  t.testName,
                                  timeLimit: t.timeLimit,
                                  isActive:  false,
                                };
                                await createQuestion(toAdd);
                                showToast('✅ નવો પ્રશ્ન ઉમેરાયો!', 'success');
                                setShowAddInPreview(false);
                                setNewQInPreview({
                                  text: '', type: 'mcq', optionA: '', optionB: '', optionC: '', optionD: '', correctOpt: 'A', marks: 1, image: '', imageUrl: '', optionA_img: '', optionB_img: '', optionC_img: '', optionD_img: '', answerHint: ''
                                });
                                await fetchData();
                              } catch {
                                showToast('પ્રશ્ન ઉમેરવામાં ક્ષતિ.', 'error');
                              }
                            }}
                              style={{ width: '100%', background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif' }}>
                              ✅ ઉમેરો (Add Question)
                            </button>
                          </div>
                        )}

                        {/* Questions List (Multi-column responsive grid on Laptop) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
                          {t.questions.map((q, i) => {
                            const isEditing = editingQId === q.id;
                            return (
                              <div key={q.id || i} style={{
                                background: '#1e293b',
                                borderRadius: 12,
                                padding: '12px 14px',
                                border: isEditing ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)'
                              }}>
                                {!isEditing ? (
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: q.type === 'mcq' ? 'rgba(59,130,246,0.3)' : 'rgba(217,119,6,0.3)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 900 }}>
                                          {i+1}
                                        </span>
                                        <span style={{ background: q.type === 'mcq' ? 'rgba(59,130,246,0.2)' : 'rgba(217,119,6,0.2)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6 }}>
                                          {q.type.toUpperCase()}
                                        </span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 600 }}>
                                          {q.marks || 1} Marks
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', gap: 5 }}>
                                        <button onClick={() => {
                                          setEditingQId(q.id);
                                          setEditForm({ ...q });
                                        }} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Hind Vadodara, sans-serif' }}>
                                          <Edit3 size={12} /> Edit
                                        </button>
                                        <button onClick={() => handleDeleteInPreview(q.id)}
                                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Question Text */}
                                    <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 8, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                      {formatMathText(q.text)}
                                    </div>

                                    {/* Question Image */}
                                    {(q.image || q.imageUrl) && (
                                      <div style={{ margin: '6px 0 10px 0', background: '#020617', padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                        <img src={q.image || q.imageUrl} alt="diagram" style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
                                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8 }}>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveImageInPreview(q.id)}
                                            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Trash2 size={12} /> 🗑️ ફોટો દૂર કરો
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* MCQ Options */}
                                    {q.type === 'mcq' && (
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 6 }}>
                                        {['A','B','C','D'].map(opt => {
                                          const rawOpt = q[`option${opt}`] || q[`opt${opt}`] || q[opt.toLowerCase()];
                                          const rawImg = q[`option${opt}_img`] || q[`opt${opt}_img`];
                                          const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                                          const optText = isImg(rawOpt) ? '' : rawOpt;
                                          if (!optText && !optImg) return null;
                                          const isCorrect = q.correctOpt === opt || String(q.correctOpt).toUpperCase() === opt || q.answer === opt;

                                          return (
                                            <div key={opt} style={{
                                              padding: '8px 12px',
                                              borderRadius: 8,
                                              fontSize: '0.82rem',
                                              background: isCorrect ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.03)',
                                              border: isCorrect ? '1.5px solid #22c55e' : '1px solid rgba(255,255,255,0.06)',
                                              color: isCorrect ? '#4ade80' : '#cbd5e1',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: 4
                                            }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span><strong>({opt})</strong> {optText}</span>
                                                {isCorrect && (
                                                  <span style={{ background: '#22c55e', color: '#052e16', fontSize: '0.62rem', fontWeight: 900, padding: '1px 5px', borderRadius: 4 }}>
                                                    🎯 સાચો જવાબ
                                                  </span>
                                                )}
                                              </div>
                                              {optImg && (
                                                <div style={{ marginTop: 2, textAlign: 'center' }}>
                                                  <img src={optImg} alt={`Option ${opt}`} style={{ maxHeight: 75, maxWidth: '100%', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} />
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Descriptive Note */}
                                    {q.type === 'descriptive' && (
                                      <div style={{ background: 'rgba(217,119,6,0.1)', border: '1px dashed rgba(217,119,6,0.3)', borderRadius: 8, padding: '6px 10px', color: '#fbbf24', fontSize: '0.76rem', marginTop: 4 }}>
                                        📝 વર્ણાત્મક પ્રશ્ન (ફોટો અપલોડ દ્વારા ઉત્તર)
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Inline Question Edit Form with Full Image & Options Support */
                                  <div className="animate-fade-in" style={{ background: 'rgba(59,130,246,0.06)', padding: 12, borderRadius: 10, border: '1.5px solid rgba(59,130,246,0.35)' }}>
                                    <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.86rem', marginBottom: 8 }}>
                                      ✏️ પ્રશ્ન #{i+1} સુધારો (Edit Question)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                                      <select className="input-dark" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                                        <option value="mcq">🔵 MCQ</option>
                                        <option value="descriptive">📝 Descriptive</option>
                                      </select>
                                      <input className="input-dark" type="number" min={1} max={50} value={editForm.marks || 1} onChange={e => setEditForm(f => ({ ...f, marks: Number(e.target.value) }))} />
                                    </div>
                                    <textarea className="input-dark" rows={2} placeholder="પ્રશ્ન લખાણ..." value={editForm.text || ''} onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))} style={{ marginBottom: 8 }} />

                                    {/* ── QUESTION IMAGE UPLOAD IN EDIT ── */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8', fontSize: '0.74rem' }}>
                                          <ImageIcon size={13} /> 🖼️ પ્રશ્નનો ફોટો (Question Image)
                                        </label>
                                        {(editForm.image || editForm.imageUrl) && (
                                          <button type="button" onClick={() => setEditForm(f => ({ ...f, image: '', imageUrl: '' }))}
                                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>
                                            🗑️ ફોટો દૂર કરો
                                          </button>
                                        )}
                                      </div>

                                      {(editForm.image || editForm.imageUrl) ? (
                                        <div style={{ textAlign: 'center', padding: '8px', background: '#000', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                                          <img src={editForm.image || editForm.imageUrl} alt="preview" style={{ maxHeight: 130, maxWidth: '100%', borderRadius: 6, objectFit: 'contain', marginBottom: 8 }} />
                                          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <label style={{ background: 'rgba(59,130,246,0.25)', border: '1px solid #3b82f6', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', color: '#93c5fd', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                              🔄 નવો ફોટો બદલો
                                              <input type="file" accept="image/*" style={{ display: 'none' }}
                                                onChange={e => {
                                                  const file = e.target.files[0];
                                                  if (!file) return;
                                                  const r = new FileReader();
                                                  r.onload = ev => setEditForm(f => ({ ...f, image: ev.target.result, imageUrl: ev.target.result }));
                                                  r.readAsDataURL(file);
                                                  e.target.value = '';
                                                }} />
                                            </label>
                                            <button type="button" onClick={() => setEditForm(f => ({ ...f, image: '', imageUrl: '' }))}
                                              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.74rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                              <Trash2 size={12} /> 🗑️ ફોટો હટાવો
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                          <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>
                                            📁 ફોટો સિલેક્ટ કરો
                                            <input type="file" accept="image/*" style={{ display: 'none' }}
                                              onChange={e => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const r = new FileReader();
                                                r.onload = ev => setEditForm(f => ({ ...f, image: ev.target.result, imageUrl: ev.target.result }));
                                                r.readAsDataURL(file);
                                                e.target.value = '';
                                              }} />
                                          </label>
                                          <input className="input-dark" style={{ flex: 1, minWidth: 130, fontSize: '0.75rem', padding: '6px 8px' }}
                                            placeholder="અથવા Image URL / Base64..."
                                            value={editForm.image || editForm.imageUrl || ''}
                                            onChange={e => setEditForm(f => ({ ...f, image: e.target.value, imageUrl: e.target.value }))} />
                                        </div>
                                      )}
                                    </div>

                                    {/* ── MCQ OPTIONS WITH IMAGES IN EDIT ── */}
                                    {editForm.type === 'mcq' && (
                                      <div style={{ marginBottom: 10 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                                          {['A','B','C','D'].map(opt => (
                                            <div key={opt} style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                <span style={{ color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800 }}>વિકલ્પ ({opt})</span>
                                                {editForm[`option${opt}_img`] && (
                                                  <button type="button" onClick={() => setEditForm(f => ({ ...f, [`option${opt}_img`]: '' }))}
                                                    style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '1px 4px', borderRadius: 4, fontSize: '0.65rem' }} title="Delete Option Image">
                                                    <X size={11} />
                                                  </button>
                                                )}
                                              </div>
                                              <input className="input-dark" placeholder={`Option ${opt}`} value={editForm[`option${opt}`] || ''} onChange={e => setEditForm(f => ({ ...f, [`option${opt}`]: e.target.value }))} style={{ marginBottom: 4 }} />
                                              
                                              {editForm[`option${opt}_img`] ? (
                                                <div style={{ marginTop: 2, textAlign: 'center', background: '#000', padding: 2, borderRadius: 4 }}>
                                                  <img src={editForm[`option${opt}_img`]} alt={`Opt ${opt}`} style={{ maxHeight: 40, maxWidth: '100%', borderRadius: 4 }} />
                                                </div>
                                              ) : (
                                                <label style={{ fontSize: '0.68rem', color: '#60a5fa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                  📷 + ફોટો
                                                  <input type="file" accept="image/*" style={{ display: 'none' }}
                                                    onChange={e => {
                                                      const file = e.target.files[0];
                                                      if (!file) return;
                                                      const r = new FileReader();
                                                      r.onload = ev => setEditForm(f => ({ ...f, [`option${opt}_img`]: ev.target.result }));
                                                      r.readAsDataURL(file);
                                                      e.target.value = '';
                                                    }} />
                                                </label>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        {/* Correct Option Selector */}
                                        <div style={{ marginTop: 6 }}>
                                          <label style={{ ...darkLbl, fontSize: '0.74rem', marginBottom: 4 }}>🎯 સાચો જવાબ (Correct Option):</label>
                                          <div style={{ display: 'flex', gap: 6 }}>
                                            {['A','B','C','D'].map(opt => (
                                              <button key={opt} type="button" onClick={() => setEditForm(f => ({ ...f, correctOpt: opt }))}
                                                style={{ flex: 1, padding: '6px', borderRadius: 8, border: `1.5px solid ${editForm.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: editForm.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'transparent', color: editForm.correctOpt === opt ? '#22c55e' : '#94a3b8', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                                                {opt} {editForm.correctOpt === opt && '✓'}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                                      <button onClick={() => setEditingQId(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem' }}>
                                        Cancel
                                      </button>
                                      <button onClick={() => handleSaveQuestionEdit(q.id)} style={{ background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '7px 18px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 4px 12px rgba(5,150,105,0.35)' }}>
                                        ✅ સાચવો (Save)
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Bottom Collapse Button */}
                        <div style={{ marginTop: 12, textAlign: 'center' }}>
                          <button onClick={() => setExpandedTestCode(null)}
                            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '7px 18px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Hind Vadodara, sans-serif' }}>
                            ▲ પ્રીવ્યુ બંધ કરો (Collapse)
                          </button>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── SCHEDULE LIVE TEST MODAL (PRO PORTALED & RESPONSIVE) ── */}
      {schedulingTest && typeof document !== 'undefined' && createPortal(
        <div className="schedule-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSchedulingTest(null); }}>
          <div className="schedule-modal-card" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="schedule-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                  ⏰
                </div>
                <div>
                  <h3 style={{ color: '#fbbf24', fontWeight: 900, fontSize: '1.05rem', margin: 0 }}>
                    કસોટી શિડ્યુલ કરો (Schedule Live)
                  </h3>
                  <div style={{ color: '#fef08a', fontSize: '0.72rem', fontWeight: 600 }}>
                    નક્કી કરેલા સમય પર આપમેળે Live શરૂ થશે
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSchedulingTest(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem' }}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="schedule-modal-body">
              {/* Test Info Box */}
              <div style={{ background: 'rgba(245,158,11,0.08)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.92rem' }}>
                  {schedulingTest.testName}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>📚 <strong>{schedulingTest.subject}</strong></span>
                  {schedulingTest.testCode && (
                    <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 800 }}>
                      ID: {schedulingTest.testCode}
                    </span>
                  )}
                  {schedulingTest.questions?.length > 0 && (
                    <span>• 📋 {schedulingTest.questions.length} પ્રશ્નો</span>
                  )}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <div style={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚡</span> ઝડપી સમય પ્રીસેટ્સ (Quick Presets):
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: '+15 મિનિટ', mins: 15 },
                    { label: '+30 મિનિટ', mins: 30 },
                    { label: '+1 કલાક', mins: 60 },
                    { label: '+2 કલાક', mins: 120 },
                    { label: 'આજે સાંજે 06:00 PM', time: 'today_18' },
                    { label: 'આજે રાત્રે 08:00 PM', time: 'today_20' },
                    { label: 'કાલે સવારે 10:00 AM', time: 'tomorrow_10' }
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="schedule-preset-btn"
                      onClick={() => {
                        let d = new Date();
                        if (p.mins) {
                          d = new Date(Date.now() + p.mins * 60000);
                        } else if (p.time === 'today_18') {
                          d.setHours(18, 0, 0, 0);
                        } else if (p.time === 'today_20') {
                          d.setHours(20, 0, 0, 0);
                        } else if (p.time === 'tomorrow_10') {
                          d.setDate(d.getDate() + 1);
                          d.setHours(10, 0, 0, 0);
                        }
                        const pad = n => String(n).padStart(2, '0');
                        const str = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        setScheduleDateTime(str);
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Datetime Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ ...darkLbl, color: '#fcd34d', fontWeight: 800 }}>
                  📅 પરીક્ષાની તારીખ અને સમય પસંદ કરો:
                </label>
                <input
                  type="datetime-local"
                  className="input-dark"
                  value={scheduleDateTime}
                  onChange={e => setScheduleDateTime(e.target.value)}
                  style={{
                    padding: '12px 14px',
                    fontSize: '0.95rem',
                    color: '#ffffff',
                    colorScheme: 'dark',
                    background: '#162032',
                    borderColor: 'rgba(245,158,11,0.4)',
                    fontWeight: 700
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="schedule-modal-footer">
              <button
                type="button"
                onClick={() => setSchedulingTest(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#94a3b8',
                  padding: '9px 16px',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontFamily: 'Hind Vadodara, sans-serif'
                }}>
                બંધ કરો
              </button>

              {schedulingTest.scheduledAt && (
                <button
                  type="button"
                  onClick={async () => {
                    setScheduleDateTime('');
                    try {
                      const targets = schedulingTest.testCodes || (schedulingTest.testCode ? [schedulingTest.testCode] : []);
                      await scheduleTest({ testCodes: targets, scheduledAt: null });
                      showToast('શિડ્યુલ રદ કરવામાં આવ્યું.', 'info');
                      setSchedulingTest(null);
                      await fetchData();
                    } catch {
                      showToast('ક્ષતિ.', 'error');
                    }
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: '#fca5a5',
                    padding: '9px 14px',
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontFamily: 'Hind Vadodara, sans-serif'
                  }}>
                  🗑️ શિડ્યુલ રદ કરો
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveSchedule}
                style={{
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Hind Vadodara, sans-serif',
                  boxShadow: '0 4px 16px rgba(245,158,11,0.4)'
                }}>
                <CheckCircle size={15} /> 🗓️ શિડ્યુલ સાચવો
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── PREVIEW & EDIT MODAL / DRAWER (MOBILE OPTIMIZED & PORTALED) ── */}
      {previewTest && typeof document !== 'undefined' && createPortal(
        <div className="preview-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPreviewTest(null); }}>
          <div className="glass-card animate-fade-in preview-modal-dialog" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="preview-modal-header">
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                    📚 {previewTest.subject}
                  </span>
                  <span style={{ background: 'rgba(255,255,255,0.06)', color: '#38bdf8', fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                    {previewTest.testCode}
                  </span>
                </div>
                <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.05rem', margin: 0, lineHeight: 1.3 }}>
                  {previewTest.testName}
                </h3>
              </div>

              {/* Header Action Buttons */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => exportTestPDF(previewTest, teacherProfile)}
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: 'white', border: 'none', padding: '7px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Hind Vadodara, sans-serif' }}>
                  <Download size={13} /> PDF
                </button>
                <button
                  onClick={() => {
                    const isLive = activeTestCodes.includes(previewTest.testCode);
                    handleToggleTestLive(previewTest.testCode, isLive ? 'stop' : 'start');
                  }}
                  style={{
                    background: activeTestCodes.includes(previewTest.testCode)
                      ? 'linear-gradient(135deg,#dc2626,#ef4444)'
                      : 'linear-gradient(135deg,#047857,#10b981)',
                    color: 'white',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Hind Vadodara, sans-serif'
                  }}>
                  {activeTestCodes.includes(previewTest.testCode) ? (
                    <><Square size={13} fill="white" /> ⏹️ Stop Live</>
                  ) : (
                    <><Play size={13} fill="white" /> Live કરો</>
                  )}
                </button>
                <button onClick={() => setPreviewTest(null)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#cbd5e1', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Test Details Card in Preview */}
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>🎯 કસોટી પ્રકાર</div>
                  <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: '0.78rem', marginTop: 2 }}>
                    {previewTest.mcqCount > 0 && previewTest.descCount > 0
                      ? `🔀 Mixed (${previewTest.mcqCount}M + ${previewTest.descCount}D)`
                      : previewTest.mcqCount > 0
                        ? `🔵 ફક્ત MCQ (${previewTest.mcqCount})`
                        : `📝 ફક્ત વર્ણાત્મક (${previewTest.descCount})`
                    }
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>⏱️ સમય / ગુણ</div>
                  <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.8rem', marginTop: 2 }}>
                    {previewTest.timeLimit}m • {previewTest.totalMarks} ગુણ
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>📡 સ્થિતિ (Status)</div>
                  <div style={{ marginTop: 2 }}>
                    {activeTestCodes.includes(previewTest.testCode) ? (
                      <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="live-dot" style={{ width: 6, height: 6 }} /> LIVE NOW
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.78rem' }}>
                        🟢 READY
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body: Questions list with Phone-optimized layout */}
            <div className="preview-modal-body">

              {/* Add Question Toggle in Preview */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                <span style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 800 }}>
                  📋 કુલ પ્રશ્નો ({previewTest.questions.length})
                </span>
                <button onClick={() => setShowAddInPreview(!showAddInPreview)}
                  style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}>
                  <Plus size={13} /> {showAddInPreview ? 'Cancel' : '➕ પ્રશ્ન ઉમેરો'}
                </button>
              </div>

              {/* Add Form in Preview (Mobile-Friendly) */}
              {showAddInPreview && (
                <div className="glass-card animate-fade-in" style={{ padding: 14, border: '1.5px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.06)' }}>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', marginBottom: 10 }}>➕ આ ટેસ્ટમાં નવો પ્રશ્ન ઉમેરો</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <select className="input-dark" value={newQInPreview.type} onChange={e => setNewQInPreview(q => ({ ...q, type: e.target.value }))}>
                      <option value="mcq">🔵 MCQ</option>
                      <option value="descriptive">📝 Descriptive</option>
                    </select>
                    <input className="input-dark" type="number" min={1} max={50} value={newQInPreview.marks} placeholder="Marks" onChange={e => setNewQInPreview(q => ({ ...q, marks: Number(e.target.value) }))} />
                  </div>
                  <textarea className="input-dark" rows={2} placeholder="પ્રશ્ન અહીં લખો..." value={newQInPreview.text} onChange={e => setNewQInPreview(q => ({ ...q, text: e.target.value }))} style={{ marginBottom: 10 }} />

                  {/* Question Image */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8', fontSize: '0.72rem' }}>
                        <ImageIcon size={13} /> પ્રશ્નનો ફોટો (Question Image)
                      </label>
                      {(newQInPreview.image || newQInPreview.imageUrl) && (
                        <button type="button" onClick={() => setNewQInPreview(q => ({ ...q, image: '', imageUrl: '' }))}
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>
                          🗑️ ફોટો દૂર કરો
                        </button>
                      )}
                    </div>
                    {(newQInPreview.image || newQInPreview.imageUrl) ? (
                      <div style={{ textAlign: 'center', padding: '6px', background: '#000', borderRadius: 8 }}>
                        <img src={newQInPreview.image || newQInPreview.imageUrl} alt="preview" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 6 }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>
                          📁 ફોટો સિલેક્ટ કરો
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const r = new FileReader();
                              r.onload = ev => setNewQInPreview(q => ({ ...q, image: ev.target.result, imageUrl: ev.target.result }));
                              r.readAsDataURL(file);
                              e.target.value = '';
                            }} />
                        </label>
                        <input className="input-dark" style={{ flex: 1, minWidth: 130, fontSize: '0.75rem', padding: '6px 8px' }}
                          placeholder="અથવા Image URL / Base64..."
                          value={newQInPreview.image || newQInPreview.imageUrl || ''}
                          onChange={e => setNewQInPreview(q => ({ ...q, image: e.target.value, imageUrl: e.target.value }))} />
                      </div>
                    )}
                  </div>

                  {/* Options */}
                  {newQInPreview.type === 'mcq' && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                        {['A','B','C','D'].map(opt => (
                          <div key={opt}>
                            <input className="input-dark" placeholder={`Option ${opt}`} value={newQInPreview[`option${opt}`]} onChange={e => setNewQInPreview(q => ({ ...q, [`option${opt}`]: e.target.value }))} style={{ marginBottom: 3 }} />
                            {newQInPreview[`option${opt}_img`] ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <img src={newQInPreview[`option${opt}_img`]} alt="" style={{ maxHeight: 38, maxWidth: 55, borderRadius: 4 }} />
                                <button type="button" onClick={() => setNewQInPreview(q => ({ ...q, [`option${opt}_img`]: '' }))} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={12} /></button>
                              </div>
                            ) : (
                              <label style={{ fontSize: '0.65rem', color: '#64748b', cursor: 'pointer' }}>
                                + ફોટો
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const r = new FileReader();
                                  r.onload = ev => setNewQInPreview(q => ({ ...q, [`option${opt}_img`]: ev.target.result }));
                                  r.readAsDataURL(file);
                                  e.target.value = '';
                                }} />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['A','B','C','D'].map(opt => (
                          <button key={opt} type="button" onClick={() => setNewQInPreview(q => ({ ...q, correctOpt: opt }))}
                            style={{ flex: 1, padding: '6px', borderRadius: 8, border: `1.5px solid ${newQInPreview.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: newQInPreview.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'transparent', color: newQInPreview.correctOpt === opt ? '#22c55e' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>
                            {opt} {newQInPreview.correctOpt === opt && '✓'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={handleAddQuestionToTest}
                    style={{ width: '100%', background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '10px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif' }}>
                    ✅ ઉમેરો (Add Question)
                  </button>
                </div>
              )}

              {/* List of Questions — Mobile Phone Optimized */}
              {previewTest.questions.map((q, i) => {
                const isEditing = editingQId === q.id;
                return (
                  <div key={q.id} className="preview-q-card animate-fade-in"
                    style={{ border: isEditing ? '1.5px solid rgba(59,130,246,0.6)' : undefined }}>
                    {!isEditing ? (
                      <div>
                        {/* Question Card Header (Badges + Action Buttons) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: q.type === 'mcq' ? 'rgba(59,130,246,0.3)' : 'rgba(217,119,6,0.3)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 900 }}>
                              {i+1}
                            </span>
                            <span style={{ background: q.type === 'mcq' ? 'rgba(59,130,246,0.2)' : 'rgba(217,119,6,0.2)', color: q.type === 'mcq' ? '#60a5fa' : '#fbbf24', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6 }}>
                              {q.type.toUpperCase()}
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 600 }}>
                              {q.marks || 1} Marks
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => {
                              setEditingQId(q.id);
                              setEditForm({ ...q });
                            }} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Hind Vadodara, sans-serif' }}>
                              <Edit3 size={12} /> Edit
                            </button>
                            <button onClick={() => handleDeleteInPreview(q.id)}
                              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Question Text with Gujarati Typography */}
                        <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.55, marginBottom: 10, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {formatMathText(q.text)}
                        </div>

                        {/* Question Image (Mobile Responsive Centered Box) */}
                        {(q.image || q.imageUrl) && (
                          <div style={{ margin: '8px 0 12px 0', background: '#020617', padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', position: 'relative' }}>
                            <img src={q.image || q.imageUrl} alt="diagram" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
                            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center' }}>
                              <button onClick={() => handleRemoveImageInPreview(q.id)}
                                title="આ પ્રશ્નનો ફોટો દૂર કરો"
                                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Trash2 size={11} /> 🗑️ ફોટો દૂર કરો (Delete Image)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* MCQ Options Display (Mobile Clean Cards) */}
                        {q.type === 'mcq' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                            {['A','B','C','D'].map((opt, optIndex) => {
                              const optText = q[`option${opt}`] || q[`opt${opt}`] || q[opt.toLowerCase()] || (q.options && (q.options[opt] || q.options[opt.toLowerCase()] || q.options[optIndex]));
                              const optImg  = q[`option${opt}_img`] || q[`opt${opt}_img`];
                              if (!optText && !optImg) return null;
                              const isCorrect = (q.correctOpt === opt || String(q.correctOpt).toUpperCase() === opt || q.answer === opt || q.correctOption === opt);

                              return (
                                <div key={opt} className="preview-opt-item"
                                  style={{
                                    background: isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                                    border: isCorrect ? '1.5px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                    color: isCorrect ? '#4ade80' : '#cbd5e1'
                                  }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                                      <span style={{
                                        width: 22, height: 22, borderRadius: '50%',
                                        background: isCorrect ? '#22c55e' : 'rgba(255,255,255,0.08)',
                                        color: isCorrect ? 'white' : '#94a3b8',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.72rem', fontWeight: 900, flexShrink: 0, marginTop: 1
                                      }}>
                                        {opt}
                                      </span>
                                      <span style={{ fontSize: '0.88rem', fontWeight: isCorrect ? 700 : 500, lineHeight: 1.45, wordBreak: 'break-word' }}>
                                        {optText}
                                      </span>
                                    </div>
                                    {isCorrect && (
                                      <span style={{ background: '#22c55e', color: '#052e16', fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>
                                        ✓ સાચો જવાબ
                                      </span>
                                    )}
                                  </div>

                                  {/* Option Image Thumbnail */}
                                  {optImg && (
                                    <div style={{ marginLeft: 30, marginTop: 4 }}>
                                      <img src={optImg} alt={`Option ${opt}`} style={{ maxHeight: 60, maxWidth: '100%', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Descriptive Display */}
                        {q.type === 'descriptive' && (
                          <div style={{ background: 'rgba(217,119,6,0.1)', border: '1px dashed rgba(217,119,6,0.3)', borderRadius: 8, padding: '8px 12px', color: '#fbbf24', fontSize: '0.78rem', marginTop: 4 }}>
                            📝 <strong>વર્ણાત્મક પ્રશ્ન:</strong> વિદ્યાર્થીઓ તેમની નોટબુકમાં જવાબ લખીને ફોટો અપલોડ કરશે.
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Question Edit Mode (Mobile Responsive) */
                      <div className="animate-fade-in">
                        <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem', marginBottom: 8 }}>
                          ✏️ પ્રશ્ન #{i+1} સુધારો (Edit Question)
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <label style={darkLbl}>Type</label>
                            <select className="input-dark" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}>
                              <option value="mcq">🔵 MCQ</option>
                              <option value="descriptive">📝 Descriptive</option>
                            </select>
                          </div>
                          <div>
                            <label style={darkLbl}>Marks</label>
                            <input className="input-dark" type="number" min={1} max={50} value={editForm.marks || 1} onChange={e => setEditForm(f => ({ ...f, marks: Number(e.target.value) }))} />
                          </div>
                        </div>

                        <div style={{ marginBottom: 8 }}>
                          <label style={darkLbl}>Question Text</label>
                          <textarea className="input-dark" rows={2} value={editForm.text || ''} onChange={e => setEditForm(f => ({ ...f, text: e.target.value }))} />
                        </div>

                        {/* Question Image in Edit */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ ...darkLbl, margin: 0, display: 'flex', alignItems: 'center', gap: 5, color: '#38bdf8', fontSize: '0.72rem' }}>
                              <ImageIcon size={13} /> પ્રશ્નનો ફોટો (Question Image)
                            </label>
                            {(editForm.image || editForm.imageUrl) && (
                              <button type="button" onClick={() => setEditForm(f => ({ ...f, image: '', imageUrl: '' }))}
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>
                                <Trash2 size={11} /> 🗑️ ફોટો દૂર કરો
                              </button>
                            )}
                          </div>

                          {(editForm.image || editForm.imageUrl) ? (
                            <div style={{ textAlign: 'center', padding: '6px', background: '#000', borderRadius: 8 }}>
                              <img src={editForm.image || editForm.imageUrl} alt="preview" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 6 }} />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <label style={{ background: 'rgba(59,130,246,0.15)', border: '1px dashed rgba(59,130,246,0.4)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>
                                📁 ફોટો સિલેક્ટ કરો
                                <input type="file" accept="image/*" style={{ display: 'none' }}
                                  onChange={e => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const r = new FileReader();
                                    r.onload = ev => setEditForm(f => ({ ...f, image: ev.target.result, imageUrl: ev.target.result }));
                                    r.readAsDataURL(file);
                                    e.target.value = '';
                                  }} />
                              </label>
                              <input className="input-dark" style={{ flex: 1, minWidth: 130, fontSize: '0.75rem', padding: '6px 8px' }}
                                placeholder="Image URL / Base64..."
                                value={editForm.image || editForm.imageUrl || ''}
                                onChange={e => setEditForm(f => ({ ...f, image: e.target.value, imageUrl: e.target.value }))} />
                            </div>
                          )}
                        </div>

                        {/* MCQ Options in Edit */}
                        {editForm.type === 'mcq' && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                              {['A','B','C','D'].map(opt => (
                                <div key={opt}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                    <label style={{ ...darkLbl, fontSize: '0.68rem', margin: 0 }}>Option {opt}</label>
                                    {editForm[`option${opt}_img`] && (
                                      <button type="button" onClick={() => setEditForm(f => ({ ...f, [`option${opt}_img`]: '' }))}
                                        style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0 }} title="Delete Option Image">
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                  <input className="input-dark" value={editForm[`option${opt}`] || ''} onChange={e => setEditForm(f => ({ ...f, [`option${opt}`]: e.target.value }))} style={{ marginBottom: 3 }} />
                                  {editForm[`option${opt}_img`] ? (
                                    <img src={editForm[`option${opt}_img`]} alt={`Opt ${opt}`} style={{ maxHeight: 40, maxWidth: '100%', borderRadius: 4 }} />
                                  ) : (
                                    <label style={{ fontSize: '0.65rem', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      + ફોટો ઉમેરો
                                      <input type="file" accept="image/*" style={{ display: 'none' }}
                                        onChange={e => {
                                          const file = e.target.files[0];
                                          if (!file) return;
                                          const r = new FileReader();
                                          r.onload = ev => setEditForm(f => ({ ...f, [`option${opt}_img`]: ev.target.result }));
                                          r.readAsDataURL(file);
                                          e.target.value = '';
                                        }} />
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <label style={darkLbl}>✅ સાચો જવાબ પસંદ કરો</label>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {['A','B','C','D'].map(opt => (
                                  <button key={opt} type="button" onClick={() => setEditForm(f => ({ ...f, correctOpt: opt }))}
                                    style={{ flex: 1, padding: '6px', borderRadius: 8, border: `1.5px solid ${editForm.correctOpt === opt ? '#22c55e' : 'rgba(255,255,255,0.1)'}`, background: editForm.correctOpt === opt ? 'rgba(34,197,94,0.25)' : 'transparent', color: editForm.correctOpt === opt ? '#22c55e' : '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>
                                    {opt} {editForm.correctOpt === opt && '✓'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button onClick={() => setEditingQId(null)}
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                            Cancel
                          </button>
                          <button onClick={() => handleSaveQuestionEdit(q.id)}
                            style={{ background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '7px 16px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                            ✅ સાચવો
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="preview-modal-footer">
              <button onClick={() => setPreviewTest(null)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'Hind Vadodara, sans-serif' }}>
                બંધ કરો (Close)
              </button>

              <button
                onClick={() => {
                  const isLive = activeTestCodes.includes(previewTest.testCode);
                  handleToggleTestLive(previewTest.testCode, isLive ? 'stop' : 'start');
                }}
                style={{
                  background: activeTestCodes.includes(previewTest.testCode) ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'linear-gradient(135deg,#047857,#10b981)',
                  color: 'white',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: 8,
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Hind Vadodara, sans-serif',
                  boxShadow: activeTestCodes.includes(previewTest.testCode) ? '0 4px 16px rgba(239,68,68,0.4)' : '0 4px 16px rgba(5,150,105,0.4)'
                }}>
                {activeTestCodes.includes(previewTest.testCode) ? (
                  <><Square size={15} fill="white" /> ⏹️ Stop Live</>
                ) : activeTestCodes.length > 0 ? (
                  <><Play size={15} fill="white" /> ➕ આ પણ Live ઉમેરો</>
                ) : (
                  <><Play size={15} fill="white" /> ▶️ આ કસોટી લાઈવ કરો</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   STUDENT ANSWERS & DESCRIPTIVE GRADING (જવાબવહી તપાસણી)
═══════════════════════════════════════════════════════ */
function StudentAnswers({ showToast }) {
  const [subs, setSubs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedSub, setSelectedSub] = useState(null);
  const [reviewsMap, setReviewsMap]   = useState({}); // { [subId]: { loading: boolean, data: array, error: string } }
  const [gradeMarks, setGradeMarks]   = useState({}); // { [subId]: marks }
  const [remarks, setRemarks]         = useState({}); // { [subId]: text }
  const [mcqScores, setMcqScores]     = useState({}); // { [subId]: mcqScore }
  const [testTypeFilter, setTestTypeFilter] = useState('ALL'); // 'ALL' | 'DESCRIPTIVE' | 'MCQ'
  const [filterStatus, setFilterStatus]     = useState('ALL'); // 'ALL' | 'PENDING' | 'GRADED'
  const [searchQuery, setSearchQuery]       = useState('');
  const [previewPhoto, setPreviewPhoto]     = useState(null); // Lightbox modal for photo
  const [expandedTests, setExpandedTests]   = useState({}); // { [testCode]: boolean } — which test groups are open
  const [photoRotations, setPhotoRotations] = useState({}); // { [photoUrl]: number (0 | 90 | 180 | 270) }
  const [activePhotoIdx, setActivePhotoIdx] = useState({}); // { [subId]: number }
  const [questionOverrides, setQuestionOverrides] = useState({}); // { [subId]: { [qKey]: boolean } }
  const [reEvaluating, setReEvaluating] = useState({}); // { [testCode]: boolean }
  const [pendingKeyUpdates, setPendingKeyUpdates] = useState({}); // { [testCode]: { [questionId]: 'A'|'B'|'C'|'D' } }
  const [masterTestModal, setMasterTestModal] = useState(null); // { testCode, testName, subject, questions: [], editedKeys: {}, subs: [], loading: boolean, savedSuccess: boolean }
  const [savingMaster, setSavingMaster] = useState(false);

  const rotatePhoto = (url, e) => {
    if (e) e.stopPropagation();
    setPhotoRotations(prev => ({ ...prev, [url]: ((prev[url] || 0) + 90) % 360 }));
  };

  const openMasterTestModal = async (group, e) => {
    if (e) e.stopPropagation();
    setMasterTestModal({
      testCode: group.testCode,
      testName: group.testName,
      subject: group.subject,
      subs: group.subs || [],
      questions: [],
      editedKeys: {},
      loading: true,
      savedSuccess: false
    });
    try {
      const res = await getQuestionsByTest(group.testCode);
      const qList = res.data || [];
      const initKeys = {};
      qList.forEach(q => {
        if (q.correctOpt) initKeys[q.id] = q.correctOpt;
      });
      setMasterTestModal(prev => ({
        ...prev,
        questions: qList,
        editedKeys: initKeys,
        loading: false
      }));
    } catch {
      showToast('કસોટીના પ્રશ્નો લોડ કરવામાં ક્ષતિ.', 'error');
      setMasterTestModal(null);
    }
  };

  const handleSaveMasterAnswerKeys = async () => {
    if (!masterTestModal) return;
    const { testCode, editedKeys, questions } = masterTestModal;
    const questionUpdates = [];

    questions.forEach(q => {
      if (editedKeys[q.id] && editedKeys[q.id] !== q.correctOpt) {
        questionUpdates.push({
          questionId: q.id,
          correctOpt: editedKeys[q.id]
        });
      }
    });

    setSavingMaster(true);
    try {
      const res = await reEvaluateSubmissions({ testCode, questionUpdates });
      showToast(res.data?.message || '🎉 Answer Key સાચવાઈ અને તમામ વિદ્યાર્થીઓના પોર્ટલ પર ગુણ સફળતાપૂર્વક અપડેટ થયા!', 'success');
      // Update local questions in modal
      setMasterTestModal(prev => ({
        ...prev,
        savedSuccess: true,
        questions: prev.questions.map(q => ({
          ...q,
          correctOpt: prev.editedKeys[q.id] || q.correctOpt
        }))
      }));
      setReviewsMap({});
      await fetchSubs();
    } catch (err) {
      showToast(err.response?.data?.error || 'સાચવવામાં ક્ષતિ થઈ.', 'error');
    }
    setSavingMaster(false);
  };

  const toggleQuestionCorrectness = (subId, qKey, defaultIsCorrect, qMarks = 1) => {
    const currentSubOverrides = questionOverrides[subId] || {};
    const currentEffective = currentSubOverrides[qKey] !== undefined ? currentSubOverrides[qKey] : defaultIsCorrect;
    const newStatus = !currentEffective;

    setQuestionOverrides(prev => ({
      ...prev,
      [subId]: {
        ...(prev[subId] || {}),
        [qKey]: newStatus
      }
    }));

    // Update mcqScores for this submission: if changed to true -> +qMarks, if changed to false -> -qMarks
    setMcqScores(prev => {
      const currentScore = prev[subId] !== undefined ? Number(prev[subId]) : (subs.find(s => s.id === subId)?.mcqScore || 0);
      const delta = newStatus ? qMarks : -qMarks;
      return {
        ...prev,
        [subId]: Math.max(0, currentScore + delta)
      };
    });
  };

  const handleReEvaluate = async (testCode) => {
    const testUpdatesObj = pendingKeyUpdates[testCode] || {};
    const questionUpdates = Object.entries(testUpdatesObj).map(([questionId, correctOpt]) => ({
      questionId: parseInt(questionId),
      correctOpt
    }));

    setReEvaluating(prev => ({ ...prev, [testCode]: true }));
    try {
      const res = await reEvaluateSubmissions({ testCode, questionUpdates });
      showToast(res.data?.message || '🎉 તમામ વિદ્યાર્થીઓના માર્ક્સ નવી Answer Key મુજબ ફરી ગણવામાં આવ્યા!', 'success');
      // Clear pending updates for this test
      setPendingKeyUpdates(prev => ({ ...prev, [testCode]: {} }));
      // Clear cached reviews
      setReviewsMap({});
      await fetchSubs();
    } catch (err) {
      showToast(err.response?.data?.error || 'પુનઃ મૂલ્યાંકન કરવામાં ક્ષતિ.', 'error');
    }
    setReEvaluating(prev => ({ ...prev, [testCode]: false }));
  };

  useEffect(() => { fetchSubs(); }, []);

  const fetchSubs = async () => {
    try {
      const r = await getSubmissions();
      const list = r.data || [];
      setSubs(list);
      // Initialize grades & remarks & mcqScores map
      const gMap = {};
      const rMap = {};
      const mMap = {};
      list.forEach(s => {
        if (s.teacherMarks !== null && s.teacherMarks !== undefined) gMap[s.id] = s.teacherMarks;
        if (s.remarks) rMap[s.id] = s.remarks;
        if (s.mcqScore !== null && s.mcqScore !== undefined) mMap[s.id] = s.mcqScore;
      });
      setGradeMarks(gMap);
      setRemarks(rMap);
      setMcqScores(mMap);
    } catch {
      showToast('જવાબો લોડ કરવામાં ક્ષતિ.', 'error');
    }
    setLoading(false);
  };

  const handleToggleSub = async (subId) => {
    if (selectedSub === subId) {
      setSelectedSub(null);
      return;
    }
    setSelectedSub(subId);
    if (!reviewsMap[subId] || !reviewsMap[subId].data) {
      setReviewsMap(prev => ({ ...prev, [subId]: { loading: true } }));
      try {
        const res = await getSubmissionReview(subId);
        setReviewsMap(prev => ({ ...prev, [subId]: { loading: false, data: res.data?.review || [] } }));
      } catch {
        setReviewsMap(prev => ({ ...prev, [subId]: { loading: false, error: 'જવાબો લોડ કરવામાં ક્ષતિ.', data: [] } }));
      }
    }
  };

  const handleGrade = async (subId, currentGroup) => {
    const markVal = gradeMarks[subId];
    const mcqVal  = mcqScores[subId];

    try {
      await gradeSubmission(subId, {
        teacherMarks: markVal !== undefined && markVal !== '' ? String(markVal) : undefined,
        remarks: remarks[subId] || '',
        mcqScore: mcqVal !== undefined && mcqVal !== '' ? parseInt(mcqVal) : undefined
      });
      showToast('✅ માર્ક્સ અને રીમાર્ક સફળતાપૂર્વક સાચવવામાં આવ્યા!', 'success');
      await fetchSubs();

      // Auto-advance to next student in the same test group
      if (currentGroup && Array.isArray(currentGroup.subs)) {
        const currentIdx = currentGroup.subs.findIndex(s => s.id === subId);
        if (currentIdx !== -1 && currentIdx < currentGroup.subs.length - 1) {
          const nextSub = currentGroup.subs[currentIdx + 1];
          setTimeout(() => {
            handleToggleSub(nextSub.id);
            showToast(`➡️ આગળના વિદ્યાર્થી (${nextSub.student?.name || 'વિદ્યાર્થી'}) ની વિગતો ખુલી!`, 'info');
          }, 250);
        } else {
          showToast('🎉 આ કસોટીના તમામ વિદ્યાર્થીઓના પેપર તપાસાઈ ગયા!', 'success');
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'માર્ક્સ સાચવવામાં ક્ષતિ.', 'error');
    }
  };

  // Helper: check if a submission requires teacher manual marking
  const isPureMCQ = (s) => {
    const hasPhotos = Boolean(s.photoUrl || (Array.isArray(s.photoUrls) && s.photoUrls.length > 0));
    const isHigherMarks = Boolean(s.totalMarks && s.totalMCQ && s.totalMarks > s.totalMCQ);
    const hasDescAnswers = Array.isArray(s.answers) && s.answers.some(a => a.type === 'descriptive' || a.photoUrl);
    return !hasPhotos && !isHigherMarks && !hasDescAnswers;
  };

  // Filter submissions
  const filteredSubs = useMemo(() => {
    return subs.filter(s => {
      const pureMcq = isPureMCQ(s);
      // Filter by Test Type
      if (testTypeFilter === 'DESCRIPTIVE' && pureMcq) return false;
      if (testTypeFilter === 'MCQ' && !pureMcq) return false;

      // Filter by Grading Status
      const isGraded = s.teacherMarks !== null && s.teacherMarks !== undefined;
      if (filterStatus === 'PENDING' && isGraded) return false;
      if (filterStatus === 'GRADED' && !isGraded) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName   = s.student?.name?.toLowerCase().includes(q);
      const matchMobile = s.student?.mobile?.includes(q);
      const matchTest   = s.testName?.toLowerCase().includes(q);
      const matchCode   = s.testCode?.toLowerCase().includes(q);
      const matchSubj   = s.subject?.toLowerCase().includes(q);
      return matchName || matchMobile || matchTest || matchCode || matchSubj;
    });
  }, [subs, testTypeFilter, filterStatus, searchQuery]);

  const descSubs = subs.filter(s => !isPureMCQ(s));
  const mcqSubs  = subs.filter(s => isPureMCQ(s));
  const pendingDescCount = descSubs.filter(s => s.teacherMarks === null || s.teacherMarks === undefined).length;
  const gradedDescCount  = descSubs.filter(s => s.teacherMarks !== null && s.teacherMarks !== undefined).length;

  // Group filteredSubs by testCode for the new grouped view
  const groupedByTest = useMemo(() => {
    const map = {};
    filteredSubs.forEach(sub => {
      const key = sub.testCode || 'NO-CODE';
      if (!map[key]) {
        map[key] = {
          testCode:  sub.testCode || '—',
          testName:  sub.testName  || sub.subject || 'સામાન્ય કસોટી',
          subject:   sub.subject   || '—',
          subs:      [],
          hasMCQ:    false,
          hasDesc:   false,
        };
      }
      map[key].subs.push(sub);
      if (isPureMCQ(sub)) map[key].hasMCQ = true;
      else                 map[key].hasDesc = true;
    });
    // Sort groups: most recent submission first
    return Object.values(map).sort((a, b) => {
      const aTime = new Date(a.subs[0]?.submittedAt || 0).getTime();
      const bTime = new Date(b.subs[0]?.submittedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [filteredSubs]);

  const toggleTestGroup = (testCode) =>
    setExpandedTests(prev => ({ ...prev, [testCode]: !prev[testCode] }));


  return (
    <div className="animate-fade-in">

      {/* ── Compact Top Explanation Banner ── */}
      <div className="glass-card sa-header" style={{ padding: '12px 16px', marginBottom: 12, background: 'linear-gradient(135deg,rgba(30,58,138,0.3),rgba(15,23,42,0.6))', border: '1.5px solid rgba(59,130,246,0.3)', borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>📝</span>
          <div>
            <div style={{ color: 'white', fontWeight: 900, fontSize: '0.94rem' }}>
              વિદ્યાર્થી ઉત્તરવહી તપાસણી & સોલ્યુશન રીવ્યુ
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: 1 }}>
              💡 <span style={{ color: '#38bdf8' }}>MCQ જવાબો જુઓ</span> અને વર્ણાત્મક પેપર તપાસી માર્ક્સ આપો.
            </div>
          </div>
        </div>
      </div>

      {/* ── Modern 3-Pill Filter Tabs ── */}
      <div className="sa-type-tabs">
        <button
          type="button"
          onClick={() => { setTestTypeFilter('ALL'); setFilterStatus('ALL'); }}
          className={`sa-type-pill ${testTypeFilter === 'ALL' ? 'active-all' : ''}`}
        >
          <span>📑 તમામ</span>
          <span className="sa-pill-count">{subs.length}</span>
        </button>

        <button
          type="button"
          onClick={() => { setTestTypeFilter('MCQ'); setFilterStatus('ALL'); }}
          className={`sa-type-pill ${testTypeFilter === 'MCQ' ? 'active-mcq' : ''}`}
        >
          <span>🔵 ફક્ત MCQ</span>
          <span className="sa-pill-count">{mcqSubs.length}</span>
        </button>

        <button
          type="button"
          onClick={() => { setTestTypeFilter('DESCRIPTIVE'); setFilterStatus('ALL'); }}
          className={`sa-type-pill ${testTypeFilter === 'DESCRIPTIVE' ? 'active-desc' : ''}`}
        >
          <span>📝 વર્ણાત્મક</span>
          <span className="sa-pill-count">{descSubs.length}</span>
        </button>
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="sa-filter-bar" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input-dark"
          placeholder="🔍 વિદ્યાર્થીનું નામ, મોબાઈલ, Test ID અથવા કસોટી શોધો..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: '1 1 240px', minHeight: 42 }}
        />
        {testTypeFilter === 'DESCRIPTIVE' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'ALL',     label: 'બધા' },
              { id: 'PENDING', label: `⏳ બાકી (${pendingDescCount})` },
              { id: 'GRADED',  label: `✅ તપાસેલ (${gradedDescCount})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                style={{
                  background: filterStatus === f.id ? '#f59e0b' : 'rgba(255,255,255,0.06)',
                  color: filterStatus === f.id ? '#0f172a' : '#cbd5e1',
                  border: filterStatus === f.id ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontFamily: 'Hind Vadodara, sans-serif'
                }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={fetchSubs}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8',
            padding: '8px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'Hind Vadodara, sans-serif'
          }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? <Loader /> : (
        <>
          {groupedByTest.length === 0 ? (
            <div className="glass-card" style={{ padding: 36, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>
                {testTypeFilter === 'DESCRIPTIVE' ? '📝' : '🔵'}
              </div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1rem' }}>
                {testTypeFilter === 'DESCRIPTIVE'
                  ? (filterStatus === 'PENDING' ? '🎉 તમામ વર્ણાત્મક જવાબો તપાસાઈ ગયા છે! કોઈ બાકી નથી.' : 'કોઈ વર્ણાત્મક સબમિશન મળ્યા નથી.')
                  : 'કોઈ સબમિશન મળ્યા નથી.'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 6 }}>
                વિદ્યાર્થીઓ ટેસ્ટ આપશે એટલે તરત જ અહીં દેખાશે.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {groupedByTest.map(group => {
                const isOpen = Boolean(expandedTests[group.testCode]); // default closed/off
                const pendingInGroup = group.subs.filter(s => !isPureMCQ(s) && (s.teacherMarks === null || s.teacherMarks === undefined)).length;
                const gradedInGroup  = group.subs.filter(s => isPureMCQ(s) || (s.teacherMarks !== null && s.teacherMarks !== undefined)).length;
                const progressPct    = group.subs.length > 0 ? Math.round((gradedInGroup / group.subs.length) * 100) : 0;
                const scores         = group.subs.map(s => (s.mcqScore || 0) + (s.teacherMarks !== null && s.teacherMarks !== undefined ? Number(s.teacherMarks) : 0));
                const highestScore   = scores.length > 0 ? Math.max(...scores) : 0;
                const avgScore       = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                const maxPossibleMarks = group.subs[0]?.totalMarks || (group.subs[0]?.totalMCQ ? group.subs[0]?.totalMCQ : 20);

                const testType = group.hasMCQ && group.hasDesc ? 'BOTH' : group.hasMCQ ? 'MCQ' : 'DESC';
                const typeColor = testType === 'MCQ' ? '#93c5fd' : testType === 'DESC' ? '#fcd34d' : '#86efac';
                const typeBg    = testType === 'MCQ' ? 'rgba(59,130,246,0.18)' : testType === 'DESC' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.15)';
                const typeLabel = testType === 'MCQ' ? '🔵 MCQ' : testType === 'DESC' ? '📝 Non-MCQ' : '⚡ MCQ + Non-MCQ';

                return (
                  <div key={group.testCode} className="sa-test-group">

                    {/* ── Sleek Responsive Test Group Header Card (Single Line on Laptop) ── */}
                    <div
                      className="sa-test-group-header"
                      onClick={() => toggleTestGroup(group.testCode)}
                    >
                      {/* Left Side: Test Icon, Name & Code Meta */}
                      <div className="sa-tg-left" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 300px' }}>
                        <div className="sa-tg-icon">
                          {testType === 'MCQ' ? '🔵' : testType === 'DESC' ? '📝' : '⚡'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="sa-tg-name" style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.96rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {group.testName}
                          </div>
                          <div className="sa-tg-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', marginTop: 2, flexWrap: 'wrap' }}>
                            <span className="sa-tg-code">🏷️ {group.testCode}</span>
                            {group.subject && group.subject !== '—' && (
                              <span style={{ color: '#94a3b8' }}>• {group.subject}</span>
                            )}
                            <span style={{ background: typeBg, color: typeColor, fontSize: '0.68rem', fontWeight: 800, padding: '1px 7px', borderRadius: 10, border: `1px solid ${typeColor}44` }}>
                              {typeLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Stats Badges, Student Count & Actions (Inline on Laptop) */}
                      <div className="sa-tg-right" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
                        {/* Student Count Badge & Dropdown Arrow */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: '#1e293b', color: '#38bdf8', fontSize: '0.78rem', fontWeight: 900, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(56,189,248,0.3)', whiteSpace: 'nowrap' }}>
                            👥 {group.subs.length}
                          </span>
                          <span style={{ background: isOpen ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.06)', color: isOpen ? '#38bdf8' : '#94a3b8', width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▼
                          </span>
                        </div>

                        {/* Stats Badges */}
                        <div className="sa-tg-stats-pills" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ background: 'rgba(234,179,8,0.15)', color: '#fde047', fontSize: '0.72rem', fontWeight: 900, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(234,179,8,0.3)', whiteSpace: 'nowrap' }}>
                            🏆 {highestScore}/{maxPossibleMarks}
                          </span>
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontSize: '0.72rem', fontWeight: 900, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.3)', whiteSpace: 'nowrap' }}>
                            📊 {avgScore}m
                          </span>
                          {pendingInGroup > 0 ? (
                            <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.35)', whiteSpace: 'nowrap' }}>
                              ⏳ {pendingInGroup} બાકી
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(34,197,94,0.18)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 800, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.35)', whiteSpace: 'nowrap' }}>
                              ✅ પૂર્ણ
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="sa-tg-actions-wrap" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => openMasterTestModal(group, e)}
                            style={{
                              background: 'linear-gradient(135deg,#7c3aed,#9333ea)',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: '0.74rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontFamily: 'Hind Vadodara, sans-serif',
                              boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
                              whiteSpace: 'nowrap'
                            }}
                            title="આ કસોટીના તમામ પ્રશ્નો અને Answer Key જુઓ/એડિટ કરો"
                          >
                            <Edit3 size={12} /> 📝 Answer Key
                          </button>

                          {group.hasMCQ && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReEvaluate(group.testCode);
                              }}
                              disabled={reEvaluating[group.testCode]}
                              style={{
                                background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 8,
                                fontSize: '0.74rem',
                                fontWeight: 900,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontFamily: 'Hind Vadodara, sans-serif',
                                boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
                                opacity: reEvaluating[group.testCode] ? 0.6 : 1,
                                whiteSpace: 'nowrap'
                              }}
                              title="MCQ ના માર્ક્સ ફરીથી રી-કેલ્ક્યુલેટ કરો"
                            >
                              <RotateCw size={12} className={reEvaluating[group.testCode] ? 'animate-spin' : ''} /> 🔄 ફરી ગણો
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Progress Bar under header */}
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', height: 5, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${progressPct}%`,
                          background: progressPct === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #38bdf8)',
                          transition: 'width 0.3s ease-in-out'
                        }}
                      />
                    </div>

                    {/* ── Student List (collapsible) ── */}
                    {isOpen && (
                      <div className="sa-test-student-list">
                        {group.subs.map(sub => {
                const isSelected = selectedSub === sub.id;
                const pureMcq    = isPureMCQ(sub);
                const isGraded   = sub.teacherMarks !== null && sub.teacherMarks !== undefined;
                const mcqVal     = mcqScores[sub.id] !== undefined ? Number(mcqScores[sub.id]) : (sub.mcqScore !== null && sub.mcqScore !== undefined ? sub.mcqScore : (sub.score || 0));
                const descVal    = gradeMarks[sub.id] !== undefined ? Number(gradeMarks[sub.id]) : (sub.teacherMarks || 0);
                const totalScored = pureMcq ? mcqVal : (mcqVal + descVal);
                const maxMarks   = sub.totalMarks || (sub.totalMCQ ? sub.totalMCQ : 20);
                const revState   = reviewsMap[sub.id];
                const revList    = revState?.data || [];

                // Resolve photos list (from submission.photoUrl + per-answer photoUrl inside answers[])
                const photoList = [];
                // 1) submission-level photoUrl
                if (sub.photoUrl) {
                  try {
                    const parsed = JSON.parse(sub.photoUrl);
                    if (Array.isArray(parsed)) photoList.push(...parsed);
                    else photoList.push(sub.photoUrl);
                  } catch {
                    photoList.push(sub.photoUrl);
                  }
                }
                // 2) per-question photoUrl inside answers JSON
                if (Array.isArray(sub.answers)) {
                  sub.answers.forEach(ans => {
                    if (ans && ans.photoUrl) photoList.push(ans.photoUrl);
                  });
                }
                // helper to build a proper URL from whatever format we have
                const resolvePhotoUrl = (url) => {
                  if (!url) return null;
                  if (url.startsWith('http') || url.startsWith('data:')) return url;
                  if (url.startsWith('/uploads/')) return url; // already correct relative path
                  if (url.startsWith('uploads/')) return '/' + url;
                  return `/uploads/${url}`; // bare filename
                };
                const uniquePhotos = Array.from(new Set(photoList.filter(Boolean)));

                // WhatsApp message builder
                const waText = `*ત્રિનેત્ર ઓનલાઇન એકેડેમી - કસોટી પરિણામ 🎓*\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `👤 *વિદ્યાર્થી:* ${sub.student?.name || 'વિદ્યાર્થી'}\n` +
                  `🏷️ *Test ID:* ${sub.testCode || 'N/A'}\n` +
                  `📚 *વિષય / કસોટી:* ${sub.testName || sub.subject || 'સામાન્ય કસોટી'}\n` +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  (pureMcq
                    ? `🔵 *MCQ ગુણ:* ${mcqVal} / ${sub.totalMCQ || maxMarks}\n`
                    : `🔵 *MCQ ગુણ:* ${mcqVal} / ${sub.totalMCQ || 'N/A'}\n📝 *વર્ણાત્મક ગુણ:* ${isGraded ? `${sub.teacherMarks} ગુણ` : 'તપાસેલ'}\n`
                  ) +
                  `🏆 *કુલ પરિણામ:* ${totalScored} / ${maxMarks} (${Math.round((totalScored / (maxMarks || 1)) * 100)}%)\n` +
                  (remarks[sub.id] || sub.remarks ? `💬 *શિક્ષકનું સૂચન:* ${remarks[sub.id] || sub.remarks}\n` : '') +
                  `━━━━━━━━━━━━━━━━━━━━\n` +
                  `_શુભેચ્છાઓ સહ - ત્રિનેત્ર એકેડેમી_`;

                return (
                  <div key={sub.id} className="glass-card animate-fade-in"
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      border: pureMcq
                        ? '1.5px solid rgba(59,130,246,0.35)'
                        : (isGraded ? '1.5px solid rgba(34,197,94,0.4)' : '1.5px solid rgba(245,158,11,0.5)'),
                      background: '#0f172a',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.35)'
                    }}>

                    {/* Top Row: Student info + Status Badges */}
                    <div className="sa-card-toprow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={sub.student?.name} size={42} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.02rem' }}>{sub.student?.name}</span>
                            {sub.testCode && (
                              <span style={{ background: '#1e293b', color: '#38bdf8', fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 900, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(56,189,248,0.4)' }}>
                                🏷️ ID: {sub.testCode}
                              </span>
                            )}
                            {pureMcq ? (
                              <span style={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.35)' }}>
                                🔵 ફક્ત MCQ (ઓટો ગણતરી)
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(245,158,11,0.25)', color: '#fcd34d', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.35)' }}>
                                📝 વર્ણાત્મક (મેન્યુઅલ તપાસણી)
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 3 }}>
                            📞 {sub.student?.mobile} • 📚 {sub.testName || sub.subject || 'સામાન્ય કસોટી'} • 📅 {new Date(sub.submittedAt || sub.createdAt).toLocaleString('gu-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>

                      {/* Marks Pills & Toggle Button */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* MCQ Marks */}
                        <span style={{ background: '#1e293b', color: '#60a5fa', fontWeight: 900, padding: '5px 12px', borderRadius: 8, fontSize: '0.82rem', border: '1px solid rgba(59,130,246,0.3)' }}>
                          MCQ: <strong>{mcqVal}m</strong>
                        </span>

                        {/* Descriptive Status if not pure MCQ */}
                        {!pureMcq && (
                          isGraded ? (
                            <span style={{ background: 'rgba(34,197,94,0.25)', color: '#4ade80', fontWeight: 900, padding: '5px 12px', borderRadius: 8, fontSize: '0.82rem', border: '1.5px solid #22c55e', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              ✅ તપાસાઈ ગયેલ ({sub.teacherMarks}m)
                            </span>
                          ) : (
                            <span style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', fontWeight: 900, padding: '5px 12px', borderRadius: 8, fontSize: '0.82rem', border: '1.5px solid #f59e0b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              ⏳ તપાસવાની બાકી છે
                            </span>
                          )
                        )}

                        {/* Combined Total */}
                        <span style={{ background: '#1e293b', color: '#f8fafc', fontWeight: 900, padding: '5px 12px', borderRadius: 8, fontSize: '0.85rem', border: '1px solid rgba(255,255,255,0.15)' }}>
                          🏆 કુલ: <strong style={{ color: totalScored >= (maxMarks * 0.7) ? '#4ade80' : '#fbbf24' }}>{totalScored}</strong>/{maxMarks}
                        </span>

                        {/* Action Toggle Button */}
                        <button onClick={() => handleToggleSub(sub.id)}
                          style={{
                            background: isSelected ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#1e293b',
                            border: isSelected ? '1.5px solid #60a5fa' : '1.5px solid rgba(255,255,255,0.18)',
                            color: isSelected ? '#ffffff' : '#e2e8f0',
                            padding: '8px 15px',
                            borderRadius: 8,
                            fontWeight: 900,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'Hind Vadodara, sans-serif',
                            boxShadow: isSelected ? '0 0 14px rgba(37,99,235,0.4)' : 'none'
                          }}>
                          <Eye size={14} /> {isSelected ? '✕ પ્રિવ્યુ છુપાવો' : (pureMcq ? '👁️ વિદ્યાર્થીના જવાબો & સાચો જવાબ જુઓ' : '👁️ જવાબો & માર્ક્સ તપાસો')}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Area: Full Solution Review & Side-by-Side Grading Suite */}
                    {isSelected && (
                      <div className="animate-fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed rgba(255,255,255,0.15)' }}>

                        {/* ── SIDE-BY-SIDE SPLIT VIEW (When Student Uploaded Photo Answers) ── */}
                        {uniquePhotos.length > 0 ? (
                          <div className="sa-split-container" style={{ marginBottom: 18 }}>

                            {/* Left Column: Photo Inspector with Rotate & Multi-Page Support */}
                            <div className="sa-split-photo-box" style={{ background: '#1e293b', padding: '14px 16px', borderRadius: 12, border: '1.5px solid rgba(59,130,246,0.35)' }}>
                              {(() => {
                                const activeIdx = activePhotoIdx[sub.id] || 0;
                                const currentRawUrl = uniquePhotos[activeIdx] || uniquePhotos[0];
                                const fullUrl = resolvePhotoUrl(currentRawUrl);
                                const rot = photoRotations[fullUrl] || 0;

                                return (
                                  <div>
                                    {/* Header toolbar */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                                      <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        📸 ઉત્તરપત્ર {uniquePhotos.length > 1 ? `(પેજ ${activeIdx + 1}/${uniquePhotos.length})` : ''}
                                      </div>
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => rotatePhoto(fullUrl, e)}
                                          style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.4)', color: '#fde047', padding: '5px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}
                                          title="Rotate 90° Clockwise"
                                        >
                                          <RotateCw size={13} /> 🔄 ફેરવો ({rot}°)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewPhoto(fullUrl)}
                                          style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd', padding: '5px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Hind Vadodara, sans-serif' }}
                                        >
                                          <Maximize2 size={13} /> 🔍 ઝૂમ
                                        </button>
                                        <a
                                          href={fullUrl}
                                          download="student_answer.jpg"
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '5px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                                          title="Download Image"
                                        >
                                          <Download size={13} />
                                        </a>
                                      </div>
                                    </div>

                                    {/* Main Photo View with Smooth Rotation */}
                                    <div
                                      onClick={() => setPreviewPhoto(fullUrl)}
                                      style={{
                                        position: 'relative',
                                        width: '100%',
                                        minHeight: 300,
                                        maxHeight: 450,
                                        background: '#020617',
                                        borderRadius: 10,
                                        border: '1.5px solid rgba(56,189,248,0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        cursor: 'zoom-in',
                                        padding: 8
                                      }}
                                    >
                                      <img
                                        src={fullUrl}
                                        alt={`Answer sheet ${activeIdx + 1}`}
                                        style={{
                                          maxWidth: '100%',
                                          maxHeight: 430,
                                          objectFit: 'contain',
                                          borderRadius: 6,
                                          transform: `rotate(${rot}deg)`,
                                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                      />
                                    </div>

                                    {/* Page Selector Thumbnails if > 1 */}
                                    {uniquePhotos.length > 1 && (
                                      <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                                        {uniquePhotos.map((pUrl, pIdx) => {
                                          const pFull = resolvePhotoUrl(pUrl);
                                          const isAct = pIdx === activeIdx;
                                          return (
                                            <div
                                              key={pIdx}
                                              onClick={() => setActivePhotoIdx(prev => ({ ...prev, [sub.id]: pIdx }))}
                                              style={{
                                                cursor: 'pointer',
                                                border: isAct ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: 6,
                                                padding: 2,
                                                background: isAct ? 'rgba(56,189,248,0.2)' : 'transparent',
                                                flexShrink: 0
                                              }}
                                            >
                                              <img
                                                src={pFull}
                                                alt={`Page ${pIdx + 1}`}
                                                style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                                              />
                                              <div style={{ fontSize: '0.65rem', textAlign: 'center', color: isAct ? '#38bdf8' : '#94a3b8', fontWeight: 800, marginTop: 2 }}>
                                                પેજ {pIdx + 1}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Right Column: Grading Inputs + Quick Chips */}
                            <div className="sa-split-grading-box" style={{ background: '#1e293b', padding: '16px 18px', borderRadius: 12, border: '1.5px solid rgba(245,158,11,0.4)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '0.92rem' }}>
                                  ✍️ માર્ક્સ અને શિક્ષક અભિપ્રાય (Marks Entry & Grading):
                                </div>
                                {isGraded ? (
                                  <span style={{ background: 'rgba(34,197,94,0.25)', color: '#4ade80', fontSize: '0.74rem', fontWeight: 900, padding: '3px 10px', borderRadius: 8, border: '1.5px solid #22c55e' }}>
                                    ✅ તપાસાઈ ગયેલ છે
                                  </span>
                                ) : (
                                  <span style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', fontSize: '0.74rem', fontWeight: 900, padding: '3px 10px', borderRadius: 8, border: '1.5px solid #f59e0b' }}>
                                    ⏳ તપાસવાની બાકી છે
                                  </span>
                                )}
                              </div>

                              {isGraded ? (
                                <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 12px', color: '#86efac', fontSize: '0.78rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>✅ <strong>આ પેપર તપાસાઈ ગયેલ છે</strong> (આપેલ ગુણ: <strong>{sub.teacherMarks}</strong>). જરૂર પડ્યે સુધારી શકો છો.</span>
                                </div>
                              ) : (
                                <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', color: '#fde68a', fontSize: '0.78rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>⏳ <strong>આ પેપર તપાસવાનું બાકી છે.</strong> ડાબી બાજુ ફોટો જોઈને નીચે ગુણ દાખલ કરો.</span>
                                </div>
                              )}

                              {(() => {
                                const targetDescMax = Math.max(1, (sub.totalMarks || maxMarks) - (sub.totalMCQ || 0));
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                                    {/* Descriptive Marks Input */}
                                    <div>
                                      <label style={{ ...darkLbl, color: '#fcd34d', fontWeight: 800 }}>
                                        📝 વર્ણાત્મક પ્રશ્નોના માર્ક્સ (Descriptive Marks):
                                      </label>
                                      <input
                                        className="input-dark"
                                        type="number"
                                        min={0}
                                        max={100}
                                        placeholder={`દા.ત. ${targetDescMax}`}
                                        value={gradeMarks[sub.id] !== undefined ? gradeMarks[sub.id] : ''}
                                        onChange={e => setGradeMarks({ ...gradeMarks, [sub.id]: e.target.value })}
                                        style={{ padding: '10px 12px', fontSize: '0.95rem', fontWeight: 900, color: '#4ade80', width: '100%' }}
                                      />
                                      {/* Quick Marks Presets */}
                                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                                        {[
                                          { label: `પૂરા (${targetDescMax})`, val: targetDescMax, bg: 'rgba(16,185,129,0.18)', border: '#10b981', color: '#6ee7b7' },
                                          { label: `80% (${Math.round(targetDescMax * 0.8)})`, val: Math.round(targetDescMax * 0.8), bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', color: '#93c5fd' },
                                          { label: `50% (${Math.round(targetDescMax * 0.5)})`, val: Math.round(targetDescMax * 0.5), bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', color: '#fcd34d' },
                                          { label: `30% (${Math.round(targetDescMax * 0.3)})`, val: Math.round(targetDescMax * 0.3), bg: 'rgba(249,115,22,0.18)', border: '#f97316', color: '#fdba74' },
                                          { label: '0 ગુણ', val: 0, bg: 'rgba(239,68,68,0.18)', border: '#ef4444', color: '#fca5a5' }
                                        ].map((chip, cIdx) => (
                                          <button
                                            key={cIdx}
                                            type="button"
                                            onClick={() => setGradeMarks({ ...gradeMarks, [sub.id]: chip.val })}
                                            style={{
                                              background: chip.bg,
                                              border: `1px solid ${chip.border}`,
                                              color: chip.color,
                                              fontSize: '0.72rem',
                                              fontWeight: 800,
                                              padding: '3px 8px',
                                              borderRadius: 6,
                                              cursor: 'pointer',
                                              fontFamily: 'Hind Vadodara, sans-serif',
                                              transition: 'all 0.15s'
                                            }}
                                          >
                                            {chip.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Remarks Input */}
                                    <div>
                                      <label style={darkLbl}>
                                        💬 શિક્ષકનો અભિપ્રાય / સૂચન (Teacher Remark):
                                      </label>
                                      <input
                                        className="input-dark"
                                        placeholder="દા.ત. ખૂબ સરસ લખાણ, અક્ષરો સુધારો..."
                                        value={remarks[sub.id] || ''}
                                        onChange={e => setRemarks({ ...remarks, [sub.id]: e.target.value })}
                                        style={{ padding: '10px 12px', fontSize: '0.85rem', width: '100%' }}
                                      />
                                      {/* Quick Remarks Chips */}
                                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                                        {[
                                          '🌟 ખૂબ સરસ લખાણ!',
                                          '👍 સારો પ્રયાસ!',
                                          '✍️ અક્ષરો સુધારો.',
                                          '📖 વધુ મહેનત જરૂરી.',
                                          '⚠️ પ્રશ્ન ધ્યાનથી વાંચો.'
                                        ].map((rem, rIdx) => (
                                          <button
                                            key={rIdx}
                                            type="button"
                                            onClick={() => setRemarks({ ...remarks, [sub.id]: rem })}
                                            style={{
                                              background: 'rgba(255,255,255,0.06)',
                                              border: '1px solid rgba(255,255,255,0.15)',
                                              color: '#cbd5e1',
                                              fontSize: '0.72rem',
                                              fontWeight: 700,
                                              padding: '3px 8px',
                                              borderRadius: 6,
                                              cursor: 'pointer',
                                              fontFamily: 'Hind Vadodara, sans-serif',
                                              transition: 'all 0.15s'
                                            }}
                                          >
                                            {rem}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Live Score Breakdown Pill */}
                              <div style={{ background: 'rgba(59,130,246,0.12)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.25)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ color: '#93c5fd', fontSize: '0.82rem', fontWeight: 700 }}>
                                  📊 કુલ પરિણામ: MCQ ({mcqVal}) + વર્ણાત્મક ({gradeMarks[sub.id] || 0}) = <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '1rem' }}>{mcqVal + Number(gradeMarks[sub.id] || 0)} / {maxMarks}</span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleGrade(sub.id, group)}
                                  style={{
                                    background: 'linear-gradient(135deg,#047857,#10b981)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 22px',
                                    borderRadius: 8,
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontFamily: 'Hind Vadodara, sans-serif',
                                    boxShadow: '0 4px 14px rgba(5,150,105,0.35)'
                                  }}>
                                  <CheckCircle size={15} /> ✅ માર્ક્સ સાચવો (Save Marks)
                                </button>

                                {sub.student?.mobile && (
                                  <a
                                    href={`https://wa.me/91${sub.student.mobile}?text=${encodeURIComponent(waText)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      background: 'linear-gradient(135deg,#059669,#10b981)',
                                      color: 'white',
                                      padding: '10px 18px',
                                      borderRadius: 8,
                                      fontWeight: 800,
                                      fontSize: '0.85rem',
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      fontFamily: 'Hind Vadodara, sans-serif'
                                    }}>
                                    <Share2 size={14} /> 📲 WhatsApp
                                  </a>
                                )}
                              </div>
                            </div>

                          </div>
                        ) : null}

                        {/* ── QUESTION-BY-QUESTION SOLUTION REVIEW ── */}
                        <div style={{ marginBottom: 18 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>📋 પ્રશ્નવાર વિગતવાર ઉત્તરો અને તપાસણી ({revList.length} પ્રશ્નો):</span>
                            </div>
                            {revList.length > 0 && (
                              <div style={{ display: 'flex', gap: 8, fontSize: '0.76rem', fontWeight: 800 }}>
                                <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)' }}>
                                  ✓ સાચા: {revList.filter(r => r.isCorrect === true).length}
                                </span>
                                <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '3px 9px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)' }}>
                                  ✗ ખોટા: {revList.filter(r => r.isCorrect === false).length}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Loading or Error State */}
                          {revState?.loading && (
                            <div style={{ padding: '24px', textAlign: 'center', background: '#1e293b', borderRadius: 12, color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem' }}>
                              ⏳ વિદ્યાર્થીના તમામ પ્રશ્નો અને જવાબો લોડ થઈ રહ્યા છે...
                            </div>
                          )}

                          {revState?.error && (
                            <div style={{ padding: '14px', background: 'rgba(239,68,68,0.15)', borderRadius: 10, color: '#fca5a5', fontSize: '0.85rem' }}>
                              ❌ {revState.error}
                            </div>
                          )}

                          {/* Questions List (Multi-column responsive grid on Laptop, clean single-column on Phone) */}
                          {!revState?.loading && revList.length > 0 && (
                            <div className="sa-review-questions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 12 }}>
                              {revList.map((item, qIdx) => {
                                const q = item.question || {};
                                const isMCQ = q.type === 'mcq';
                                const studentAns = item.studentAnswer;
                                const isCorrect = item.isCorrect;
                                const qKey = q.id !== undefined && q.id !== null ? q.id : qIdx;
                                const hasOverride = questionOverrides[sub.id]?.[qKey] !== undefined;
                                const effectiveCorrect = hasOverride ? questionOverrides[sub.id][qKey] : isCorrect;

                                return (
                                  <div key={q.id || qIdx}
                                    className="sa-review-q-card"
                                    style={{
                                      background: '#1e293b',
                                      borderRadius: 12,
                                      padding: '14px 14px',
                                      border: isMCQ
                                        ? (effectiveCorrect ? '1.5px solid rgba(34,197,94,0.5)' : (studentAns ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)'))
                                        : '1px solid rgba(245,158,11,0.3)',
                                      boxShadow: hasOverride ? '0 0 14px rgba(234,179,8,0.15)' : 'none',
                                      minWidth: 0,
                                      overflow: 'hidden'
                                    }}>
                                    
                                    {/* Question Header Line */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{
                                          width: 26, height: 26, borderRadius: '50%',
                                          background: isMCQ ? (effectiveCorrect ? '#15803d' : (studentAns ? '#b91c1c' : '#475569')) : '#b45309',
                                          color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: '0.78rem', fontWeight: 900, flexShrink: 0
                                        }}>
                                          {qIdx + 1}
                                        </span>
                                        <span style={{ color: '#93c5fd', fontSize: '0.82rem', fontWeight: 800 }}>
                                          પ્રશ્ન {qIdx + 1} • {isMCQ ? 'MCQ' : 'વર્ણાત્મક'} <span style={{ color: '#64748b' }}>({q.marks || 1} ગુણ)</span>
                                        </span>
                                      </div>

                                      {/* Correct/Wrong Status Badge & Teacher Override Toggle */}
                                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {isMCQ ? (
                                          effectiveCorrect ? (
                                            <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 900, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.4)', whiteSpace: 'nowrap' }}>
                                              ✓ સાચો જવાબ (+{q.marks || 1}m)
                                            </span>
                                          ) : studentAns ? (
                                            <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.72rem', fontWeight: 900, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)', whiteSpace: 'nowrap' }}>
                                              ✗ ખોટો જવાબ (0m)
                                            </span>
                                          ) : (
                                            <span style={{ background: 'rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                              ⚪ ઉત્તર આપેલ નથી
                                            </span>
                                          )
                                        ) : null}

                                        {hasOverride && (
                                          <span style={{ background: 'rgba(234,179,8,0.2)', color: '#fde047', fontSize: '0.68rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6, border: '1px solid rgba(234,179,8,0.4)', whiteSpace: 'nowrap' }}>
                                            ✏️ સુધારેલ
                                          </span>
                                        )}

                                        {/* Teacher 1-Click MCQ Correction Button */}
                                        {isMCQ && (
                                          <button
                                            type="button"
                                            onClick={() => toggleQuestionCorrectness(sub.id, qKey, isCorrect, q.marks || 1)}
                                            style={{
                                              background: effectiveCorrect ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.22)',
                                              border: effectiveCorrect ? '1px solid rgba(239,68,68,0.4)' : '1.5px solid #22c55e',
                                              color: effectiveCorrect ? '#fca5a5' : '#4ade80',
                                              padding: '4px 9px',
                                              borderRadius: 6,
                                              fontSize: '0.72rem',
                                              fontWeight: 900,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 4,
                                              fontFamily: 'Hind Vadodara, sans-serif',
                                              transition: 'all 0.15s',
                                              whiteSpace: 'nowrap'
                                            }}
                                            title="ક્લિક કરીને આ પ્રશ્નના માર્ક્સ સુધારો"
                                          >
                                            {effectiveCorrect ? '✗ ખોટો ગણો (-1)' : '✓ સાચો ગણો (+1)'}
                                          </button>
                                        )}

                                        {item.timeSpent > 0 && (
                                          <span style={{ background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                            ⏱️ {item.timeSpent}s
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Question Text */}
                                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.94rem', lineHeight: 1.55, marginBottom: 12, wordBreak: 'break-word' }}>
                                      {formatMathText(q.text)}
                                    </div>

                                    {/* Question Image if any */}
                                    {(q.image || q.imageUrl) && (
                                      <div style={{ marginBottom: 12, textAlign: 'center' }}>
                                        <img src={q.image || q.imageUrl} alt="Question Diagram" style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#000', objectFit: 'contain' }} />
                                      </div>
                                    )}

                                    {/* MCQ Options with Clean Single-Column on Mobile & Cards on Laptop */}
                                    {isMCQ && (
                                      <div className="sa-review-options-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                        {['A', 'B', 'C', 'D'].map((optKey, optIdx) => {
                                          const rawOpt = q[`option${optKey}`] || q[`opt${optKey}`] || q[optKey.toLowerCase()] || (q.options && (q.options[optKey] || q.options[optKey.toLowerCase()] || q.options[optIdx]));
                                          const rawImg = q[`option${optKey}_img`] || q[`opt${optKey}_img`];
                                          const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                                          const optText = isImg(rawOpt) ? '' : rawOpt;
                                          if (!optText && !optImg) return null;

                                          const isRightOpt = (q.correctOpt === optKey || String(q.correctOpt).toUpperCase() === optKey || q.answer === optKey || q.correctOption === optKey);
                                          const isStudentChoice = (studentAns === optKey || String(studentAns).toUpperCase() === optKey);

                                          let optBg = 'rgba(255,255,255,0.03)';
                                          let optBorder = '1px solid rgba(255,255,255,0.08)';
                                          let optColor = '#cbd5e1';

                                          if (isRightOpt) {
                                            optBg = 'rgba(34,197,94,0.18)';
                                            optBorder = '1.5px solid #22c55e';
                                            optColor = '#4ade80';
                                          } else if (isStudentChoice && !isRightOpt) {
                                            optBg = 'rgba(239,68,68,0.18)';
                                            optBorder = '1.5px solid #ef4444';
                                            optColor = '#fca5a5';
                                          }

                                          return (
                                            <div key={optKey} style={{
                                              background: optBg,
                                              border: optBorder,
                                              borderRadius: 10,
                                              padding: '10px 12px',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: 6
                                            }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: '1 1 180px' }}>
                                                  <span style={{
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    background: isRightOpt ? '#22c55e' : (isStudentChoice ? '#ef4444' : 'rgba(255,255,255,0.08)'),
                                                    color: (isRightOpt || isStudentChoice) ? 'white' : '#94a3b8',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.72rem', fontWeight: 900, flexShrink: 0, marginTop: 1
                                                  }}>
                                                    {optKey}
                                                  </span>
                                                  <span style={{ color: optColor, fontWeight: (isRightOpt || isStudentChoice) ? 800 : 500, fontSize: '0.88rem', lineHeight: 1.45, wordBreak: 'break-word' }}>
                                                    {optText}
                                                  </span>
                                                </div>

                                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                                  {isRightOpt && (
                                                    <span style={{ background: '#22c55e', color: '#052e16', fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                                      🎯 સાચો જવાબ
                                                    </span>
                                                  )}
                                                  {isStudentChoice && !isRightOpt && (
                                                    <span style={{ background: '#ef4444', color: 'white', fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                                      ✗ વિદ્યાર્થીનો જવાબ
                                                    </span>
                                                  )}
                                                  {isStudentChoice && isRightOpt && (
                                                    <span style={{ background: '#15803d', color: 'white', fontSize: '0.68rem', fontWeight: 900, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                                      ✓ વિદ્યાર્થીનો જવાબ
                                                    </span>
                                                  )}
                                                </div>
                                              </div>

                                              {optImg && (
                                                <div style={{ marginTop: 4, textAlign: 'center' }}>
                                                  <img src={optImg} alt={`Option ${optKey}`} style={{ maxHeight: 90, maxWidth: '100%', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Official Answer Key Modifier Strip */}
                                    {isMCQ && (
                                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <span style={{ color: '#93c5fd', fontSize: '0.76rem', fontWeight: 800 }}>
                                            🔑 સાચો જવાબ બદલો:
                                          </span>
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            {['A', 'B', 'C', 'D'].map(opt => {
                                              const currentKey = pendingKeyUpdates[sub.testCode]?.[q.id] || q.correctOpt || q.answer;
                                              const isSelectedKey = String(currentKey).toUpperCase() === opt;
                                              return (
                                                <button
                                                  key={opt}
                                                  type="button"
                                                  onClick={() => {
                                                    setPendingKeyUpdates(prev => ({
                                                      ...prev,
                                                      [sub.testCode]: {
                                                        ...(prev[sub.testCode] || {}),
                                                        [q.id]: opt
                                                      }
                                                    }));
                                                  }}
                                                  style={{
                                                    background: isSelectedKey ? '#22c55e' : 'rgba(255,255,255,0.06)',
                                                    color: isSelectedKey ? '#052e16' : '#cbd5e1',
                                                    border: isSelectedKey ? '1.5px solid #16a34a' : '1px solid rgba(255,255,255,0.15)',
                                                    fontWeight: 900,
                                                    fontSize: '0.74rem',
                                                    padding: '3px 9px',
                                                    borderRadius: 5,
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  {opt}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        {pendingKeyUpdates[sub.testCode]?.[q.id] && (
                                          <button
                                            type="button"
                                            onClick={() => handleReEvaluate(sub.testCode)}
                                            disabled={reEvaluating[sub.testCode]}
                                            style={{
                                              background: 'linear-gradient(135deg,#059669,#10b981)',
                                              color: 'white',
                                              border: 'none',
                                              padding: '4px 12px',
                                              borderRadius: 6,
                                              fontWeight: 900,
                                              fontSize: '0.74rem',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              fontFamily: 'Hind Vadodara, sans-serif',
                                              boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                                            }}
                                          >
                                            <CheckCircle size={12} />
                                            {reEvaluating[sub.testCode] ? 'ગણતરી ચાલુ...' : `⚡ [${pendingKeyUpdates[sub.testCode][q.id]}] સાચવો & બધાના માર્ક્સ ફરી ગણો`}
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Descriptive Reference Answer if any */}
                                    {!isMCQ && q.answerHint && (
                                      <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 12px', color: '#fbbf24', fontSize: '0.8rem' }}>
                                        💡 <strong>સંદર્ભ જવાબ (Teacher Hint):</strong> {q.answerHint}
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Fallback if no questions array in review */}
                          {!revState?.loading && revList.length === 0 && !revState?.error && (
                            <div style={{ padding: '16px', background: '#1e293b', borderRadius: 10, color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>
                              વિદ્યાર્થીના જવાબો સબમિટ થઈ ચૂક્યા છે.
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}


      {/* ── Fullscreen Photo Lightbox Modal (PORTALED – mobile responsive) ── */}
      {previewPhoto && typeof document !== 'undefined' && createPortal(
        <div
          className="photo-lightbox-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewPhoto(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setPreviewPhoto(null); }}
          tabIndex={-1}
        >
          {/* Top Bar */}
          <div className="photo-lightbox-topbar">
            <div className="photo-lightbox-title">
              <span style={{ fontSize: '1.2rem' }}>📸</span>
              <div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.2 }}>
                  વિદ્યાર્થીની ઉત્તરવહી
                </div>
                <div style={{ color: '#64748b', fontSize: '0.68rem' }}>
                  Full Screen View
                </div>
              </div>
            </div>
            <div className="photo-lightbox-actions">
              <button
                type="button"
                onClick={(e) => rotatePhoto(previewPhoto, e)}
                className="photo-lb-btn photo-lb-btn-blue"
                style={{ background: 'rgba(234,179,8,0.2)', borderColor: 'rgba(234,179,8,0.5)', color: '#fde047' }}
                title="Rotate 90° Clockwise"
              >
                <RotateCw size={14} />
                <span>ફેરવો ({(photoRotations[previewPhoto] || 0)}°)</span>
              </button>
              <a
                href={previewPhoto}
                download="student_answer_sheet.jpg"
                target="_blank"
                rel="noreferrer"
                className="photo-lb-btn photo-lb-btn-blue"
              >
                <Download size={14} />
                <span>ડાઉનલોડ</span>
              </a>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="photo-lb-btn photo-lb-btn-red"
              >
                ✕ <span>બંધ</span>
              </button>
            </div>
          </div>

          {/* Image Area */}
          <div className="photo-lightbox-imgwrap">
            <img
              src={previewPhoto}
              alt="Zoomed answer sheet"
              className="photo-lightbox-img"
              style={{
                transform: `rotate(${photoRotations[previewPhoto] || 0}deg)`,
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}

      {/* ── MASTER TEST PREVIEW & ANSWER KEY EDITOR MODAL (PORTALED) ── */}
      {masterTestModal && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            background: 'rgba(2,6,23,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !savingMaster) setMasterTestModal(null); }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1.5px solid rgba(124,58,237,0.4)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(124,58,237,0.2)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(124,58,237,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.3rem' }}>📝</span>
                  <h3 style={{ color: 'white', fontSize: '1.15rem', fontWeight: 900, margin: 0, fontFamily: 'Hind Vadodara, sans-serif' }}>
                    {masterTestModal.testName || 'કસોટી'}
                  </h3>
                  <span style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(124,58,237,0.4)' }}>
                    ID: {masterTestModal.testCode}
                  </span>
                  {masterTestModal.subject && (
                    <span style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                      📚 {masterTestModal.subject}
                    </span>
                  )}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '4px 0 0', fontFamily: 'Hind Vadodara, sans-serif' }}>
                  અહીંથી તમે પ્રશ્નોનો સાચો જવાબ બદલી શકો છો. સેવ કરતા જ બધા વિદ્યાર્થીઓના ગુણ તરત સુધરી જશે અને નવા વિદ્યાર્થીઓને પણ સુધારેલ જવાબ મળશે.
                </p>
              </div>

              <button
                onClick={() => setMasterTestModal(null)}
                disabled={savingMaster}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  fontWeight: 900
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Questions List or Notify Drawer */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {masterTestModal.loading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a78bfa', fontWeight: 800 }}>
                  ⏳ કસોટીના તમામ પ્રશ્નો લોડ થઈ રહ્યા છે...
                </div>
              ) : (
                <>
                  {/* Success Confirmation Banner when saved */}
                  {masterTestModal.savedSuccess && (
                    <div style={{ background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.4)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.25s ease' }}>
                      <span style={{ fontSize: '1.5rem' }}>🎉</span>
                      <div>
                        <div style={{ color: '#4ade80', fontWeight: 900, fontSize: '0.92rem' }}>
                          Answer Key સફળતાપૂર્વક સાચવાઈ ગઈ છે!
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: 2 }}>
                          આ કસોટી આપેલા તમામ વિદ્યાર્થીઓના પોર્ટલ પર સુધારેલા ગુણ અને નોટિફિકેશન ઑટોમેટિક પહોંચી ગયા છે.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Question List */}
                  {masterTestModal.questions.map((q, qIdx) => {
                  const isMCQ = q.type === 'mcq';
                  const currentSelectedKey = masterTestModal.editedKeys[q.id] || q.correctOpt || q.answer;
                  const isChanged = currentSelectedKey && q.correctOpt && String(currentSelectedKey).toUpperCase() !== String(q.correctOpt).toUpperCase();

                  return (
                    <div
                      key={q.id || qIdx}
                      style={{
                        background: '#1e293b',
                        border: isChanged ? '1.5px solid #22c55e' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 12,
                        padding: '14px 16px',
                        boxShadow: isChanged ? '0 0 16px rgba(34,197,94,0.2)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {/* Top Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 24, height: 24, borderRadius: '50%', background: isChanged ? '#16a34a' : '#475569', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>
                            {qIdx + 1}
                          </span>
                          <span style={{ color: '#93c5fd', fontSize: '0.8rem', fontWeight: 800 }}>
                            પ્રશ્ન {qIdx + 1} • {isMCQ ? 'MCQ' : 'વર્ણાત્મક'} [ગુણ: {q.marks || 1}]
                          </span>
                        </div>

                        {isChanged && (
                          <span style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.4)' }}>
                            ✏️ નવો જવાબ: ({currentSelectedKey}) [મૂળ: ({q.correctOpt})]
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <div style={{ color: 'white', fontWeight: 700, fontSize: '0.92rem', marginBottom: 10, lineHeight: 1.45 }}>
                        {formatMathText(q.text)}
                      </div>

                      {/* Question Image */}
                      {(q.image || q.imageUrl) && (
                        <div style={{ marginBottom: 10 }}>
                          <img src={q.image || q.imageUrl} alt="Q" style={{ maxHeight: 110, maxWidth: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }} />
                        </div>
                      )}

                      {/* Options Grid */}
                      {isMCQ && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
                          {['A', 'B', 'C', 'D'].map(optKey => {
                            const rawOpt = q[`option${optKey}`] || q[`opt${optKey}`] || q[optKey.toLowerCase()] || (q.options && q.options[optKey]);
                            const rawImg = q[`option${optKey}_img`] || q[`opt${optKey}_img`];
                            const optImg = rawImg || (isImg(rawOpt) ? extractImgSrc(rawOpt) : '');
                            const optText = isImg(rawOpt) ? '' : rawOpt;
                            if (!optText && !optImg) return null;
                            const isThisKey = String(currentSelectedKey).toUpperCase() === optKey;

                            return (
                              <div
                                key={optKey}
                                onClick={() => {
                                  setMasterTestModal(prev => ({
                                    ...prev,
                                    editedKeys: { ...prev.editedKeys, [q.id]: optKey }
                                  }));
                                }}
                                style={{
                                  background: isThisKey ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                                  border: isThisKey ? '1.5px solid #22c55e' : '1px solid rgba(255,255,255,0.08)',
                                  borderRadius: 8,
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: isThisKey ? '#4ade80' : '#cbd5e1', fontWeight: isThisKey ? 900 : 500, fontSize: '0.84rem' }}>
                                    <strong>({optKey})</strong> {optText}
                                  </span>
                                  {isThisKey && (
                                    <span style={{ background: '#22c55e', color: '#052e16', fontSize: '0.65rem', fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                                      ✓ સાચો જવાબ
                                    </span>
                                  )}
                                </div>
                                {optImg && (
                                  <div style={{ marginTop: 2, textAlign: 'center' }}>
                                    <img src={optImg} alt={`Option ${optKey}`} style={{ maxHeight: 65, maxWidth: '100%', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Interactive Key Selector Buttons */}
                      {isMCQ && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 10 }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>
                            સાચો વિકલ્પ પસંદ કરો:
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {['A', 'B', 'C', 'D'].map(opt => {
                              const isSel = String(currentSelectedKey).toUpperCase() === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    setMasterTestModal(prev => ({
                                      ...prev,
                                      editedKeys: { ...prev.editedKeys, [q.id]: opt }
                                    }));
                                  }}
                                  style={{
                                    background: isSel ? 'linear-gradient(135deg,#059669,#10b981)' : 'rgba(255,255,255,0.06)',
                                    color: isSel ? 'white' : '#cbd5e1',
                                    border: isSel ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                                    padding: '4px 12px',
                                    borderRadius: 6,
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
              )}
            </div>

            {/* Footer Bar */}
            <div style={{
              background: '#090d16',
              padding: '14px 20px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div style={{ color: '#93c5fd', fontSize: '0.82rem', fontWeight: 800 }}>
                {masterTestModal.questions?.length || 0} પ્રશ્નો • {masterTestModal.subs?.length || 0} વિદ્યાર્થીઓના પરિણામ
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setMasterTestModal(null)}
                  disabled={savingMaster}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#cbd5e1',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    fontFamily: 'Hind Vadodara, sans-serif'
                  }}
                >
                  બંધ કરો
                </button>

                <button
                  onClick={handleSaveMasterAnswerKeys}
                  disabled={savingMaster}
                  style={{
                    background: 'linear-gradient(135deg,#059669,#10b981)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 22px',
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'Hind Vadodara, sans-serif',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.4)'
                  }}
                >
                  <CheckCircle size={15} />
                  {savingMaster ? 'સાચવી રહ્યા છીએ...' : '💾 Answer Key સાચવો & બધા જ વિદ્યાર્થીઓના ગુણ ફરી ગણો'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   STUDENT LOGINS
═══════════════════════════════════════════════════════ */
function StudentLogins({ showToast }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [liveOtps, setLiveOtps] = useState([]);
  const [showLiveOtps, setShowLiveOtps] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [grantingId, setGrantingId] = useState(null);
  const [quickMobile, setQuickMobile] = useState('');
  const [quickName, setQuickName] = useState('');
  const [grantingQuick, setGrantingQuick] = useState(false);

  const fetchLiveOtps = async () => {
    try {
      const res = await getLiveOTPs();
      setLiveOtps(res.data || []);
      setShowLiveOtps(true);
    } catch {
      showToast('Live OTPs લોડ કરવામાં ભૂલ.', 'error');
    }
  };

  const handleResetSession = async (student) => {
    if (!window.confirm(`શું તમે ${student.name} (${student.mobile}) નું સેશન અનલોક / રીસેટ કરવા માંગો છો?`)) return;
    setResettingId(student.id);
    try {
      const res = await resetStudentSession(student.id);
      showToast(res.data?.message || '✅ સેશન સફળતાપૂર્વક અનલોક થયું!', 'success');
      const r = await getStudents();
      setStudents(r.data);
    } catch {
      showToast('સેશન રીસેટ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      setResettingId(null);
    }
  };

  const handleToggleMasterAccess = async (student) => {
    const isCurrentlyAllowed = student.masterAccessAllowed || (student.masterAccessExpiresAt && new Date(student.masterAccessExpiresAt) > new Date());
    const actionText = isCurrentlyAllowed ? 'રદ (Revoke)' : 'મંજૂર (Grant 1 Hour)';
    if (!window.confirm(`શું તમે ${student.name} (${student.mobile}) માટે Master PIN (820040) Access ${actionText} કરવા માંગો છો?`)) return;

    setGrantingId(student.id);
    try {
      const res = await grantMasterAccess(student.id, { allow: !isCurrentlyAllowed, minutes: 60 });
      showToast(res.data?.message || 'Access updated', 'success');
      const r = await getStudents();
      setStudents(r.data);
    } catch {
      showToast('Master Access અપડેટ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      setGrantingId(null);
    }
  };

  const handleGrantQuickMobile = async (e) => {
    e.preventDefault();
    if (!quickMobile || quickMobile.replace(/\D/g,'').length < 10) {
      return showToast('કૃપા કરીને ૧૦ આંકડાનો સાચો મોબાઈલ નંબર લખો.', 'error');
    }
    setGrantingQuick(true);
    try {
      const res = await grantMasterByMobile({ mobile: quickMobile.trim(), name: quickName.trim() || 'Student', minutes: 60 });
      showToast(res.data?.message || '✅ Master Access સક્રિય થયો!', 'success');
      setQuickMobile('');
      setQuickName('');
      const r = await getStudents();
      setStudents(r.data);
    } catch {
      showToast('Master Access આપવામાં ભૂલ આવી.', 'error');
    } finally {
      setGrantingQuick(false);
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`⚠️ શું તમે ખરેખર વિદ્યાર્થી "${student.name}" (${student.mobile}) ને ડિલીટ કરવા માંગો છો?\nઆ વિદ્યાર્થીના તમામ ટેસ્ટ સબમિશન્સ પણ ડિલીટ થઈ જશે.`)) return;
    try {
      const res = await deleteStudent(student.id);
      showToast(res.data?.message || '🗑️ વિદ્યાર્થી ડિલીટ થઈ ગયો!', 'success');
      setStudents(prev => prev.filter(x => x.id !== student.id));
    } catch {
      showToast('વિદ્યાર્થી ડિલીટ કરવામાં ભૂલ આવી.', 'error');
    }
  };

  useEffect(() => {
    (async () => {
      try { const r = await getStudents(); setStudents(r.data); } catch { showToast('Load failed', 'error'); }
      setLoading(false);
    })();
  }, []);

  const filtered = students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.mobile?.includes(search));
  
  // ─── Professional Styled Excel (.xlsx) Export with Colors & Formatting ───
  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ત્રિનેત્ર ઓનલાઇન એકેડેમી';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('વિદ્યાર્થીઓની યાદી', {
        views: [{ showGridLines: true }]
      });

      // Title Banner Row (Dark Teal / Blue Header)
      worksheet.mergeCells('A1:F1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = '🎓 ત્રિનેત્ર ઓનલાઇન એકેડેમી — વિદ્યાર્થીઓની યાદી (STUDENT DIRECTORY)';
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // Table Header Row (Royal Blue with White Text)
      const headerRow = worksheet.addRow([
        'ક્રમ (No.)',
        'વિદ્યાર્થીનું નામ (Student Name)',
        'મોબાઈલ નંબર (Mobile Number)',
        'આપેલી કસોટીઓ (Tests)',
        'જોડાયાની તારીખ (Joined Date)',
        'છેલ્લું લોગિન (Last Login)'
      ]);
      headerRow.height = 26;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; // Royal Blue Header
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Data Rows (Zebra Striped: White & Light Gray)
      filtered.forEach((s, idx) => {
        const isEven = idx % 2 === 0;
        const joined = s.createdAt ? new Date(s.createdAt).toLocaleDateString('gu-IN') : '—';
        const lastLogin = s.lastLoginAt
          ? new Date(s.lastLoginAt).toLocaleString('gu-IN', { dateStyle: 'short', timeStyle: 'short' })
          : (s.createdAt ? new Date(s.createdAt).toLocaleString('gu-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—');

        const row = worksheet.addRow([
          idx + 1,
          s.name || '',
          s.mobile ? String(s.mobile) : '',
          s._count?.submissions || 0,
          joined,
          lastLogin
        ]);
        row.height = 22;

        const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF1F5F9'; // White vs Light Gray

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alignment
          if (colNum === 1 || colNum === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.numFmt = '@'; // Force text format for phone numbers
          } else if (colNum === 5 || colNum === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      // Total / Summary Footer Row (Yellow / Amber Highlights like the sample image)
      const totalTests = filtered.reduce((sum, s) => sum + (s._count?.submissions || 0), 0);
      const summaryRow = worksheet.addRow([
        'કુલ (Total)',
        `${filtered.length} વિદ્યાર્થીઓ`,
        '',
        totalTests,
        '',
        ''
      ]);
      summaryRow.height = 25;

      summaryRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF92400E' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Light Yellow / Gold
        cell.border = {
          top: { style: 'medium', color: { argb: 'FFD97706' } },
          bottom: { style: 'double', color: { argb: 'FF92400E' } },
          left: { style: 'thin', color: { argb: 'FFD97706' } },
          right: { style: 'thin', color: { argb: 'FFD97706' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'left' : 'center' };
      });

      // Set Precise Column Widths
      worksheet.columns = [
        { width: 14 }, // No.
        { width: 30 }, // Name
        { width: 22 }, // Mobile
        { width: 22 }, // Tests
        { width: 22 }, // Joined Date
        { width: 26 }, // Last Login
      ];

      // Export file buffer & download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Trinetra_Students_List_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } catch (e) {
      console.warn('Excel export error, falling back to CSV', e);
      exportCSV();
    }
  };

  const exportCSV = () => {
    const headers = ['No.', 'Student Name', 'Mobile Number', 'Tests Appeared', 'Joined Date', 'Last Login Date & Time'];
    const dataRows = filtered.map((s, idx) => {
      const no = idx + 1;
      const name = `"${(s.name || '').replace(/"/g, '""')}"`;
      const mobile = `="${s.mobile || ''}"`;
      const tests = s._count?.submissions || 0;
      const joined = s.createdAt ? `"${new Date(s.createdAt).toISOString().slice(0, 10)}"` : '""';
      const lastLogin = s.lastLoginAt
        ? `"${new Date(s.lastLoginAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}"`
        : (s.createdAt ? `"${new Date(s.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}"` : '""');

      return [no, name, mobile, tests, joined, lastLogin].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...dataRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Trinetra_Students_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="animate-fade-in">
      {/* ── Top Summary & Master Access Banner ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 16 }}>
        {[{ l: 'Total Students', v: students.length, g: 'stat-grad-blue' }, { l: 'Active Today', v: students.filter(s => new Date(s.updatedAt || s.lastLoginAt) > new Date(Date.now() - 86400000)).length, g: 'stat-grad-green' }].map((s, i) => (
          <div key={i} className={`stat-grad-card ${s.g}`}><div style={{ fontSize: '1.8rem', fontWeight: 900 }}><CountUp target={s.v} /></div><div style={{ fontSize: '0.75rem', opacity: 0.85 }}>{s.l}</div></div>
        ))}

        {/* Master PIN & Live OTPs Quick Access Card */}
        <div className="stat-grad-card" style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: '#c7d2fe', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldCheck size={14} color="#818cf8" /> Master Override PIN:
            </span>
            <span style={{ background: 'rgba(234,179,8,0.25)', color: '#fef08a', padding: '2px 8px', borderRadius: 6, fontWeight: 900, fontSize: '0.85rem', letterSpacing: 1.5, border: '1px solid rgba(234,179,8,0.4)' }}>
              820040
            </span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.3 }}>
            🔒 સુરક્ષા માટે: તમે જે નંબર પર **"🔑 Master Access આપો"** ક્લિક કરો માત્ર તે જ વિદ્યાર્થી આ PIN વાપરી શકશે.
          </div>
          <button onClick={fetchLiveOtps}
            style={{ marginTop: 8, background: 'rgba(99,102,241,0.25)', border: '1px solid #6366f1', color: '#e0e7ff', padding: '6px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'Hind Vadodara, sans-serif' }}>
            <Key size={12} /> {showLiveOtps ? '🔄 તાજા Live OTPs જુઓ' : '🔑 તાજા Live OTPs જુઓ (15 min)'}
          </button>
        </div>
      </div>

      {/* Quick Grant Master PIN Access Form (For New or Any Number) */}
      <form onSubmit={handleGrantQuickMobile} className="glass-card" style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(30,41,59,0.5)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#facc15', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Key size={14} /> Quick Master PIN Access:
        </span>
        <input className="input-dark" placeholder="૧૦ આંકડાનો મોબાઈલ દાખલ કરો..." value={quickMobile} onChange={e => setQuickMobile(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '7px 10px', fontSize: '0.8rem' }} />
        <input className="input-dark" placeholder="વિદ્યાર્થીનું નામ (ઓપ્શનલ)" value={quickName} onChange={e => setQuickName(e.target.value)} style={{ flex: 1, minWidth: 140, padding: '7px 10px', fontSize: '0.8rem' }} />
        <button type="submit" disabled={grantingQuick}
          style={{ background: 'linear-gradient(135deg,#eab308,#ca8a04)', color: '#0f172a', border: 'none', padding: '7px 14px', borderRadius: 8, fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif' }}>
          {grantingQuick ? 'મંજૂર થાય છે...' : '⚡ Master Access આપો (1 કલાક)'}
        </button>
      </form>

      {/* Live OTPs Drawer Modal / Box */}
      {showLiveOtps && (
        <div className="glass-card animate-fade-in" style={{ padding: 14, marginBottom: 16, border: '1.5px solid #6366f1', background: 'rgba(30,27,75,0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: '#c7d2fe', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔑 તાજેતરમાં મોકલાયેલા Live OTPs (છેલ્લી 15 મિનિટ):
            </div>
            <button onClick={() => setShowLiveOtps(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', fontWeight: 900 }}>✕</button>
          </div>
          {liveOtps.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>છેલ્લી 15 મિનિટમાં કોઈ નવો OTP મોકલાયો નથી.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
              {liveOtps.map(o => (
                <div key={o.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '0.82rem' }}>📞 {o.mobile}</div>
                    <div style={{ color: '#64748b', fontSize: '0.68rem' }}>{new Date(o.createdAt).toLocaleTimeString('gu-IN')}</div>
                  </div>
                  <div style={{ background: '#10b981', color: 'white', padding: '3px 8px', borderRadius: 6, fontWeight: 900, fontSize: '0.9rem', letterSpacing: 1 }}>
                    {o.otp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search & Export Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="input-dark" placeholder="🔍 Search name / mobile..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button onClick={exportExcel}
          style={{ background: 'linear-gradient(135deg,#047857,#10b981)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
          📊 Excel (.xlsx) ડાઉનલોડ
        </button>
        <button onClick={exportCSV}
          style={{ background: 'linear-gradient(135deg,#b45309,#f59e0b)', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'Hind Vadodara, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
          📥 CSV
        </button>
      </div>

      {loading ? <Loader /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && <Empty msg="No students yet" />}
          {filtered.map((s, i) => {
            const hasMasterAccess = s.masterAccessAllowed || (s.masterAccessExpiresAt && new Date(s.masterAccessExpiresAt) > new Date());
            return (
              <div key={s.id} className="glass-card animate-fade-in" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: hasMasterAccess ? '1.5px solid #eab308' : '1px solid rgba(255,255,255,0.06)' }}>
                <Avatar name={s.name} size={42} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'white', fontWeight: 800 }}>{s.name}</span>
                    {hasMasterAccess && (
                      <span style={{ background: 'rgba(234,179,8,0.2)', color: '#fde047', border: '1px solid #eab308', padding: '2px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 800 }}>
                        🔑 Master PIN સક્રિય (820040)
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>📞 {s.mobile} {s.city && `| 📍 ${s.city}`}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                    <div style={{ color: '#475569', fontSize: '0.7rem' }}>Joined: {new Date(s.createdAt).toLocaleDateString('gu-IN')}</div>
                    {s.lastLoginAt && (
                      <div style={{ color: '#38bdf8', fontSize: '0.7rem', fontWeight: 700 }}>
                        🕒 Last Login: {new Date(s.lastLoginAt).toLocaleString('gu-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Master PIN Access Grant, Reset Session, Submissions & WhatsApp */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Master PIN Access Toggle */}
                  <button
                    onClick={() => handleToggleMasterAccess(s)}
                    disabled={grantingId === s.id}
                    title="આ વિદ્યાર્થી માટે Master PIN (820040) Access સક્રિય અથવા રદ કરો"
                    style={{
                      background: hasMasterAccess ? 'linear-gradient(135deg,#ca8a04,#eab308)' : 'rgba(234,179,8,0.12)',
                      border: hasMasterAccess ? 'none' : '1px solid rgba(234,179,8,0.35)',
                      color: hasMasterAccess ? '#0f172a' : '#fef08a',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontFamily: 'Hind Vadodara, sans-serif'
                    }}>
                    <Key size={13} /> {grantingId === s.id ? 'અપડેટ થાય છે...' : hasMasterAccess ? '✓ PIN સક્રિય છે' : '🔑 Master PIN આપો'}
                  </button>

                  {/* Reset Session Button */}
                  <button
                    onClick={() => handleResetSession(s)}
                    disabled={resettingId === s.id}
                    title="જો વિદ્યાર્થીને લોગિનમાં Single Device Error આવતી હોય તો અહીંથી સેશન અનલોક કરો"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      color: '#fca5a5',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontFamily: 'Hind Vadodara, sans-serif'
                    }}>
                    <Unlock size={13} /> {resettingId === s.id ? 'અનલોક થાય છે...' : '🔓 સેશન અનલોક'}
                  </button>

                  <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontWeight: 800, padding: '5px 12px', borderRadius: 20, fontSize: '0.8rem', border: '1px solid rgba(59,130,246,0.2)' }}>
                    📝 {s._count?.submissions || 0}
                  </span>

                  <a href={`https://wa.me/91${s.mobile}?text=${encodeURIComponent(`નમસ્તે ${s.name}, ત્રિનેત્ર એકેડેમી પોર્ટલમાં તમારો Master Login PIN 820040 છે.`)}`} target="_blank" rel="noreferrer" title="WhatsApp પર OTP / PIN મોકલો" style={{ background: '#25d366', color: 'white', padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    💬 WhatsApp
                  </a>

                  {/* Delete Student Button */}
                  <button
                    onClick={() => handleDeleteStudent(s)}
                    title="આ વિદ્યાર્થીને કાયમ માટે ડિલીટ કરો"
                    style={{
                      background: 'rgba(239,68,68,0.2)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: '#f87171',
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'Hind Vadodara, sans-serif'
                    }}>
                    <Trash2 size={13} /> 🗑️ ડિલીટ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TEST HISTORY (TEST-WISE ATTENDANCE & RESULTS)
═══════════════════════════════════════════════════════ */
function TestHistory({ showToast }) {
  const [subs, setSubs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('testWise'); // 'testWise' | 'all'
  const [filterDate, setFilterDate]   = useState('all');      // 'all' | 'today'
  const [searchTerm, setSearchTerm]   = useState('');
  const [expandedTest, setExpandedTest] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getSubmissions();
        setSubs(r.data || []);
      } catch {
        showToast('સબમિશન લોડ કરવામાં ભૂલ.', 'error');
      }
      setLoading(false);
    })();
  }, []);

  const today = useMemo(() => {
    return subs.filter(s => new Date(s.submittedAt || s.createdAt) > new Date(Date.now() - 86400000));
  }, [subs]);

  const displayedSubs = filterDate === 'today' ? today : subs;

  // ── Group Submissions Test-Wise ──
  const testGroups = useMemo(() => {
    const map = {};
    displayedSubs.forEach(sub => {
      const key = sub.testCode || (sub.testName ? `NAME_${sub.testName}` : 'GENERAL');
      if (!map[key]) {
        map[key] = {
          key,
          testCode: sub.testCode || 'GENERAL',
          testName: sub.testName || sub.chapter || 'સામાન્ય કસોટી (General Test)',
          subject:  sub.subject  || 'General',
          totalMarks: sub.totalMarks || sub.totalMCQ || 0,
          submissions: [],
          latestDate: new Date(sub.submittedAt || sub.createdAt)
        };
      }
      map[key].submissions.push(sub);
      const sDate = new Date(sub.submittedAt || sub.createdAt);
      if (sDate > map[key].latestDate) {
        map[key].latestDate = sDate;
      }
    });

    return Object.values(map).map(group => {
      // Sort submissions by score descending
      group.submissions.sort((a, b) => (b.mcqScore ?? b.score ?? 0) - (a.mcqScore ?? a.score ?? 0));
      const validScores = group.submissions.map(s => s.mcqScore ?? s.score ?? 0);
      const topScore = validScores.length ? Math.max(...validScores) : 0;
      const avgScore = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : 0;
      return {
        ...group,
        studentsCount: group.submissions.length,
        topScore,
        avgScore
      };
    }).sort((a, b) => b.latestDate - a.latestDate);
  }, [displayedSubs]);

  // Filter test groups by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return testGroups;
    const term = searchTerm.toLowerCase();
    return testGroups.filter(g =>
      g.testName.toLowerCase().includes(term) ||
      g.testCode.toLowerCase().includes(term) ||
      g.subject.toLowerCase().includes(term) ||
      g.submissions.some(s => s.student?.name?.toLowerCase().includes(term) || s.student?.mobile?.includes(term))
    );
  }, [testGroups, searchTerm]);

  // Overall statistics
  const totalSubmissions = displayedSubs.length;
  const totalUniqueTests = testGroups.length;
  const avgOverallScore = totalSubmissions > 0
    ? (displayedSubs.reduce((sum, s) => sum + (s.mcqScore ?? s.score ?? 0), 0) / totalSubmissions).toFixed(1)
    : 0;

  // Export Specific Test Excel (.xlsx) with Ultra-Attractive Royal Academy Styling & Rich Statistics
  const exportTestExcel = async (group) => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ત્રિનેત્ર ઓનલાઇન એકેડેમી';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('કસોટી પરિણામ યાદી', {
        views: [{ showGridLines: true }]
      });

      // 👑 1. TOP BRANDING ROW (Royal Gold & Deep Navy Banner)
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `🏛️ ત્રિનેત્ર ઓનલાઇન એકેડેમી (TRINETRA ONLINE ACADEMY) — સત્તાવાર કસોટી પરિણામ પત્રક`;
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Royal Deep Slate
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 34;

      // 🏷️ 2. TEST METADATA INFO STRIP
      worksheet.mergeCells('A2:J2');
      const subCell = worksheet.getCell('A2');
      const totalQ = group.questionsCount || group.submissions[0]?.totalMCQ || group.submissions[0]?.totalQuestions || '-';
      const maxM = group.totalMarks || group.submissions[0]?.totalMarks || 100;
      subCell.value = `📝 કસોટી: ${group.testName || 'કસોટી'}   |   📚 વિષય: ${group.subject || 'સામાન્ય'}   |   🔑 ટેસ્ટ કોડ: ${group.testCode || '-'}   |   📋 કુલ પ્રશ્નો: ${totalQ}   |   🎯 કુલ ગુણ: ${maxM}   |   📞 હેલ્પલાઇન: 8200405300`;
      subCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
      subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; // Soft Ice Blue
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 24;

      // 🎨 3. TABLE HEADERS (Royal Blue with Crisp White Bold Text)
      const headerRow = worksheet.addRow([
        'રેન્ક (Rank)',
        'વિદ્યાર્થીનું નામ (Student Name)',
        'મોબાઈલ નંબર (Mobile)',
        'સાચા (Correct)',
        'ખોટા (Wrong)',
        'સ્કીપ (Skipped)',
        'મેળવેલ ગુણ (Score)',
        'ટકાવારી (Percentage)',
        'ગ્રેડ (Grade)',
        'પરિણામ (Status)'
      ]);
      headerRow.height = 28;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }; // Premium Royal Blue
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          left: { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF93C5FD' } }
        };
      });

      // 📊 4. DATA ROWS WITH CONDITIONAL FORMATTING & TOPPER HIGHLIGHTS
      let passCount = 0;
      let totalScoreSum = 0;
      const gradeCounts = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };

      // Helper function to build Unicode Visual Progress Bar
      const getVisualBar = (pct) => {
        const totalBlocks = 10;
        const filled = Math.min(totalBlocks, Math.max(0, Math.round((pct / 100) * totalBlocks)));
        const empty = totalBlocks - filled;
        return '█'.repeat(filled) + '░'.repeat(empty) + ` ${pct}%`;
      };

      group.submissions.forEach((s, idx) => {
        const rank = idx + 1;
        const sc = Number(s.mcqScore ?? s.score ?? 0);
        const tm = Number(s.totalMarks || s.totalMCQ || group.totalMarks || 1);
        const pctNum = tm > 0 ? Math.max(0, Math.round((sc / tm) * 100)) : 0;
        const isPassed = pctNum >= 40;
        if (isPassed) passCount++;
        totalScoreSum += sc;

        const isTopper1 = rank === 1;
        const isTopperTop3 = rank <= 3;
        const isEven = idx % 2 === 0;

        // Rank Display with Medals
        const rankText = isTopper1 ? '🥇 1 (Topper)' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : String(rank);

        // Calculate question breakdown if answers JSON is available
        let correctCount = '-';
        let wrongCount = '-';
        let skippedCount = '-';

        if (Array.isArray(s.answers) && s.answers.length > 0) {
          let c = 0, w = 0, sk = 0;
          s.answers.forEach(a => {
            const opt = (a.selectedOpt || a.text || '').toUpperCase();
            if (!opt || opt === 'E' || a.isSkipped) {
              sk++;
            } else if (a.isCorrect === true) {
              c++;
            } else if (a.isCorrect === false) {
              w++;
            }
          });
          if (c > 0 || w > 0 || sk > 0) {
            correctCount = c;
            wrongCount = w;
            skippedCount = sk;
          }
        }

        // Grade calculation
        let gradeKey = 'D';
        let grade = 'D (સુધારણા)';
        if (pctNum >= 85) { gradeKey = 'A+'; grade = 'A+ (ટોપર)'; }
        else if (pctNum >= 70) { gradeKey = 'A'; grade = 'A (ઉત્કૃષ્ટ)'; }
        else if (pctNum >= 55) { gradeKey = 'B'; grade = 'B (સારો)'; }
        else if (pctNum >= 40) { gradeKey = 'C'; grade = 'C (પાસ)'; }
        gradeCounts[gradeKey] = (gradeCounts[gradeKey] || 0) + 1;

        // Visual Score Bar
        const visualBar = getVisualBar(pctNum);

        // Status Text with Emoji
        const statusText = isPassed ? '✅ પાસ (Passed)' : '⚠️ સુધારાની જરૂર';

        const row = worksheet.addRow([
          rankText,
          s.student?.name || 'વિદ્યાર્થી',
          s.student?.mobile ? String(s.student.mobile) : '',
          correctCount,
          wrongCount,
          skippedCount,
          sc,
          visualBar,
          grade,
          statusText
        ]);
        row.height = 24;

        // Background Color: Gold for Top 3 Toppers, Soft Zebra for Others
        let rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        if (isTopper1) {
          rowBgColor = 'FFFEF9C3'; // Light Golden Yellow for #1 Rank
        } else if (isTopperTop3) {
          rowBgColor = 'FFFEFCE8'; // Subtle Champagne Gold for Top 3
        }

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // 1. Rank styling (Gold bold for topper)
          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: isTopperTop3 ? 'FFB45309' : 'FF1E3A8A' } };
          }
          // 2. Student Name styling (Bold and Left-aligned)
          else if (colNum === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
          }
          // 3. Mobile Number (Centered string format)
          else if (colNum === 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.numFmt = '@';
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
          }
          // 4. Correct Answers (Green)
          else if (colNum === 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF16A34A' } };
          }
          // 5. Wrong Answers (Red)
          else if (colNum === 5) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFDC2626' } };
          }
          // 6. Skipped Answers (Purple/Slate)
          else if (colNum === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF64748B' } };
          }
          // 7. Score (Bold Center)
          else if (colNum === 7) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 11,
              bold: true,
              color: { argb: isPassed ? 'FF15803D' : 'FFDC2626' }
            };
          }
          // 8. Visual Progress Bar (Chart Column)
          else if (colNum === 8) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Consolas',
              size: 10,
              bold: true,
              color: { argb: pctNum >= 70 ? 'FF16A34A' : pctNum >= 40 ? 'FFD97706' : 'FFDC2626' }
            };
          }
          // 9. Grade (Stylish Badge Color)
          else if (colNum === 9) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: pctNum >= 70 ? 'FF1E40AF' : pctNum >= 40 ? 'FFD97706' : 'FFB91C1C' }
            };
          }
          // 10. Status (Soft Green vs Soft Amber/Red Cell)
          else if (colNum === 10) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isPassed ? 'FFDCFCE7' : 'FFFEE2E2' } // Light Green vs Light Red pill
            };
            cell.font = {
              name: 'Calibri',
              size: 10,
              bold: true,
              color: { argb: isPassed ? 'FF14532D' : 'FF991B1B' }
            };
          }
        });
      });

      // 🏆 5. ROYAL SUMMARY & ANALYTICS FOOTER (2-Row Gold & Blue Box)
      const totalStudents = group.submissions.length;
      const topScoreVal = group.topScore !== undefined ? group.topScore : Math.max(...group.submissions.map(s => Number(s.mcqScore ?? s.score ?? 0)), 0);
      const avgScoreVal = totalStudents > 0 ? (totalScoreSum / totalStudents).toFixed(1) : '0';
      const passPercentage = totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0;

      // Summary Header Row (Golden Bar)
      worksheet.mergeCells(`A${worksheet.rowCount + 1}:J${worksheet.rowCount + 1}`);
      const summaryTitleCell = worksheet.getCell(`A${worksheet.rowCount}`);
      summaryTitleCell.value = `📊 એકંદર પરિણામ વિશ્લેષણ (OVERALL PERFORMANCE & SUMMARY)`;
      summaryTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF78350F' } };
      summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Warm Gold
      summaryTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(worksheet.rowCount).height = 25;

      // Summary Metrics Row
      const summaryMetricsRow = worksheet.addRow([
        'કુલ વિદ્યાર્થીઓ:',
        `${totalStudents} હાજર`,
        'સર્વોચ્ચ ગુણ (Top):',
        `${topScoreVal} / ${maxM}`,
        'સરેરાશ ગુણ (Avg):',
        `${avgScoreVal}`,
        'પાસ થયેલ:',
        `${passCount} વિદ્યાર્થીઓ`,
        'પરિણામ (Pass %):',
        `${passPercentage}%`
      ]);
      summaryMetricsRow.height = 26;

      summaryMetricsRow.eachCell((cell, colNum) => {
        const isLabel = colNum % 2 !== 0;
        cell.font = {
          name: 'Calibri',
          size: 10.5,
          bold: true,
          color: { argb: isLabel ? 'FF1E3A8A' : 'FF0F172A' }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isLabel ? 'FFDBEAFE' : 'FFFFFFFF' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
          left: { style: 'thin', color: { argb: 'FF93C5FD' } },
          right: { style: 'thin', color: { argb: 'FF93C5FD' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // 📈 6. GRADE DISTRIBUTION VISUAL BAR CHART INSET (Score Distribution)
      worksheet.addRow([]); // Blank spacer row

      worksheet.mergeCells(`A${worksheet.rowCount + 1}:J${worksheet.rowCount + 1}`);
      const chartHeaderCell = worksheet.getCell(`A${worksheet.rowCount}`);
      chartHeaderCell.value = `📈 ૧. સ્કોર અને ગ્રેડ વિતરણ ગ્રાફ (GRADE DISTRIBUTION VISUAL CHART)`;
      chartHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      chartHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Royal Blue
      chartHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(worksheet.rowCount).height = 26;

      const gradeDefinitions = [
        { label: '🌟 A+ ગ્રેડ (૮૫% થી વધુ - Topper)', key: 'A+', color: 'FF15803D', barChar: '🟩' },
        { label: '🎯 A ગ્રેડ (૭૦% થી ૮૪% - Distinction)', key: 'A', color: 'FF1D4ED8', barChar: '🟦' },
        { label: '👍 B ગ્રેડ (૫૫% થી ૬૯% - First Class)', key: 'B', color: 'FFD97706', barChar: '🟨' },
        { label: '✓ C ગ્રેડ (૪૦% થી ૫૪% - Pass)', key: 'C', color: 'FF475569', barChar: '⬜' },
        { label: '⚠️ D ગ્રેડ (૪૦% થી ઓછા - Needs Help)', key: 'D', color: 'FFDC2626', barChar: '🟥' }
      ];

      gradeDefinitions.forEach(gd => {
        const count = gradeCounts[gd.key] || 0;
        const pctOfBatch = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
        const visualBarBlocks = gd.barChar.repeat(Math.max(0, Math.round(pctOfBatch / 5))) + (pctOfBatch === 0 ? '—' : ` ${count} વિદ્યાર્થીઓ (${pctOfBatch}%)`);

        worksheet.mergeCells(`A${worksheet.rowCount + 1}:D${worksheet.rowCount + 1}`);
        const labelCell = worksheet.getCell(`A${worksheet.rowCount}`);
        labelCell.value = gd.label;
        labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: gd.color } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
        labelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        worksheet.mergeCells(`E${worksheet.rowCount}:J${worksheet.rowCount}`);
        const graphCell = worksheet.getCell(`E${worksheet.rowCount}`);
        graphCell.value = visualBarBlocks;
        graphCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: gd.color } };
        graphCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        graphCell.alignment = { vertical: 'middle', horizontal: 'left' };
        graphCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        worksheet.getRow(worksheet.rowCount).height = 22;
      });

      // 🎯 7. STACKED BREAKDOWN CHART: સાચા vs ખોટા vs સ્કીપ/Option E પ્રશ્નો (TAT-S / TAT-HS Negative Marking Special)
      let totalBatchCorrect = 0;
      let totalBatchWrong = 0;
      let totalBatchSkipped = 0;

      group.submissions.forEach(s => {
        if (Array.isArray(s.answers)) {
          s.answers.forEach(a => {
            const opt = (a.selectedOpt || a.text || '').toUpperCase();
            if (!opt || opt === 'E' || a.isSkipped) {
              totalBatchSkipped++;
            } else if (a.isCorrect === true) {
              totalBatchCorrect++;
            } else if (a.isCorrect === false) {
              totalBatchWrong++;
            }
          });
        }
      });

      const totalBatchQuestionsAttempted = totalBatchCorrect + totalBatchWrong + totalBatchSkipped;

      if (totalBatchQuestionsAttempted > 0) {
        worksheet.addRow([]); // Blank spacer row

        worksheet.mergeCells(`A${worksheet.rowCount + 1}:J${worksheet.rowCount + 1}`);
        const stackedHeaderCell = worksheet.getCell(`A${worksheet.rowCount}`);
        stackedHeaderCell.value = `🎯 ૨. પ્રશ્નવાર સ્ટેક્ડ પૃથ્થકરણ (ATTEMPTED vs SKIPPED BREAKDOWN CHART)`;
        stackedHeaderCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        stackedHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF581C87' } }; // Royal Deep Purple
        stackedHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(worksheet.rowCount).height = 26;

        const correctPct = Math.round((totalBatchCorrect / totalBatchQuestionsAttempted) * 100);
        const wrongPct = Math.round((totalBatchWrong / totalBatchQuestionsAttempted) * 100);
        const skippedPct = Math.round((totalBatchSkipped / totalBatchQuestionsAttempted) * 100);

        const stackedBarVisual = '🟩'.repeat(Math.round(correctPct / 10)) +
                                 '🟥'.repeat(Math.round(wrongPct / 10)) +
                                 '🟪'.repeat(Math.round(skippedPct / 10));

        // Combined Stacked Legend & Bar Row
        worksheet.mergeCells(`A${worksheet.rowCount + 1}:C${worksheet.rowCount + 1}`);
        const barLabelCell = worksheet.getCell(`A${worksheet.rowCount}`);
        barLabelCell.value = `📊 આખી બેચનો સ્ટેક્ડ રેશિયો:`;
        barLabelCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
        barLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
        barLabelCell.alignment = { vertical: 'middle', horizontal: 'left' };
        barLabelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        worksheet.mergeCells(`D${worksheet.rowCount}:J${worksheet.rowCount}`);
        const barVisualCell = worksheet.getCell(`D${worksheet.rowCount}`);
        barVisualCell.value = `${stackedBarVisual} (🟢 સાચા: ${correctPct}% | 🔴 ખોટા: ${wrongPct}% | 🟣 સ્કીપ/Opt-E: ${skippedPct}%)`;
        barVisualCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF581C87' } };
        barVisualCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        barVisualCell.alignment = { vertical: 'middle', horizontal: 'left' };
        barVisualCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        worksheet.getRow(worksheet.rowCount).height = 24;

        // Breakdown detailed rows
        const breakdownItems = [
          { label: '🟢 સાચા જવાબો (Correct Answers)', count: totalBatchCorrect, pct: correctPct, color: 'FF15803D', bg: 'FFDCFCE7', icon: '🟩' },
          { label: '🔴 ખોટા જવાબો (Wrong Answers / Negative Mark)', count: totalBatchWrong, pct: wrongPct, color: 'FFDC2626', bg: 'FFFEE2E2', icon: '🟥' },
          { label: '🟣 સ્કીપ કરેલા પ્રશ્નો (Option E / Not Attempted)', count: totalBatchSkipped, pct: skippedPct, color: 'FF7E22CE', bg: 'FFF3E8FF', icon: '🟪' }
        ];

        breakdownItems.forEach(item => {
          worksheet.mergeCells(`A${worksheet.rowCount + 1}:D${worksheet.rowCount + 1}`);
          const lCell = worksheet.getCell(`A${worksheet.rowCount}`);
          lCell.value = `${item.label}`;
          lCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: item.color } };
          lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.bg } };
          lCell.alignment = { vertical: 'middle', horizontal: 'left' };
          lCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

          worksheet.mergeCells(`E${worksheet.rowCount}:J${worksheet.rowCount}`);
          const vCell = worksheet.getCell(`E${worksheet.rowCount}`);
          vCell.value = `${item.icon.repeat(Math.max(0, Math.round(item.pct / 5)))}  ${item.count} પ્રશ્નો (${item.pct}%)`;
          vCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: item.color } };
          vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          vCell.alignment = { vertical: 'middle', horizontal: 'left' };
          vCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
          worksheet.getRow(worksheet.rowCount).height = 22;
        });
      }

      // 📏 7. PRECISE OPTIMIZED COLUMN WIDTHS
      worksheet.columns = [
        { width: 16 }, // Rank with Medal
        { width: 32 }, // Student Name
        { width: 18 }, // Mobile Number
        { width: 15 }, // Correct
        { width: 15 }, // Wrong
        { width: 15 }, // Skipped
        { width: 18 }, // Score
        { width: 24 }, // Visual Progress Bar (Chart Column)
        { width: 18 }, // Grade
        { width: 26 }, // Status
      ];

      // Export file buffer & trigger instant download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${group.testCode || 'Test'}_Result_${group.testName ? group.testName.replace(/[^a-zA-Z0-9_\u0A80-\u0AFF]/g, '_') : 'Trinetra'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
    } catch (e) {
      console.warn('Excel export failed, falling back to CSV', e);
      exportTestCSV(group);
    }
  };

  // Export Specific Test CSV
  const exportTestCSV = (group) => {
    const headers = ['No.', 'Student Name', 'Mobile Number', 'Score', 'Total Marks', 'Percentage', 'Submitted At', 'Test Name', 'Subject', 'Test Code'];
    const dataRows = group.submissions.map((s, idx) => {
      const no = idx + 1;
      const sc = s.mcqScore ?? s.score ?? 0;
      const tm = s.totalMarks || s.totalMCQ || group.totalMarks || 1;
      const pct = tm > 0 ? Math.round((sc / tm) * 100) : 0;
      const tName = `"${(group.testName || '').replace(/"/g, '""')}"`;
      const tCode = `"${group.testCode || ''}"`;
      const subj = `"${(group.subject || '').replace(/"/g, '""')}"`;
      const sName = `"${(s.student?.name || 'Student').replace(/"/g, '""')}"`;
      const sMobile = `="${s.student?.mobile || ''}"`;
      const dt = s.submittedAt || s.createdAt ? `"${new Date(s.submittedAt || s.createdAt).toLocaleString('en-GB')}"` : '""';

      return [no, sName, sMobile, sc, tm, `"${pct}%"`, dt, tName, subj, tCode].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...dataRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${group.testCode || 'Test'}_Results.csv`;
    a.click();
  };

  const [broadcastingGroup, setBroadcastingGroup] = useState(null);
  const [broadcastIndex, setBroadcastIndex] = useState(0);
  const [isSendingApiBroadcast, setIsSendingApiBroadcast] = useState(false);

  // 1-Click Automated Cloud Broadcast to ALL students (No tabs opened!)
  const handleApiBroadcastAll = async (group) => {
    if (!group || !group.submissions || group.submissions.length === 0) {
      showToast('આ કસોટીમાં કોઈ વિદ્યાર્થીઓ મળ્યા નથી.', 'error');
      return;
    }

    const payloadMessages = group.submissions.map((sub, idx) => {
      const msg = getWhatsAppResultMsg(sub, group, idx + 1);
      return {
        mobile: sub.student?.mobile || '',
        studentName: sub.student?.name || 'Student',
        message: msg
      };
    }).filter(item => item.mobile.length >= 10);

    if (payloadMessages.length === 0) {
      showToast('વિદ્યાર્થીઓના મોબાઈલ નંબર અમાન્ય છે.', 'error');
      return;
    }

    setIsSendingApiBroadcast(true);
    showToast(`⏳ તમામ ${payloadMessages.length} વિદ્યાર્થીઓને WhatsApp મોકલાઈ રહ્યું છે...`, 'info');

    try {
      const res = await broadcastWhatsApp({
        testCode: group.testCode,
        messages: payloadMessages
      });

      if (res.data?.success) {
        showToast(`🎉 સફળતા! ${res.data.sentCount} વિદ્યાર્થીઓને ઓટોમેટિક WhatsApp મોકલાઈ ગયું!`, 'success');
      } else {
        showToast('WhatsApp બ્રોડકાસ્ટ પૂર્ણ થયું.', 'info');
      }
    } catch (err) {
      console.error('API broadcast error:', err);
      showToast('❌ બ્રોડકાસ્ટ કરવામાં ક્ષતિ આવી. કૃપા કરીને ફરી પ્રયાસ કરો.', 'error');
    } finally {
      setIsSendingApiBroadcast(false);
    }
  };

  // Helper to generate beautifully formatted Gujarati WhatsApp Result message
  const getWhatsAppResultMsg = (sub, group, rank) => {
    const score = sub.mcqScore ?? sub.score ?? 0;
    const total = sub.totalMarks || sub.totalMCQ || group.totalMarks || 1;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const dateStr = new Date(sub.submittedAt || sub.createdAt).toLocaleDateString('gu-IN');
    const timeStr = new Date(sub.submittedAt || sub.createdAt).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' });
    const rankEmoji = rank === 1 ? '🥇 ૧st Rank' : rank === 2 ? '🥈 ૨nd Rank' : rank === 3 ? '🥉 ૩rd Rank' : `🏅 Rank #${rank}`;
    const statusText = pct >= 40 ? '🎉 અભિનંદન! તમે સફળતાપૂર્વક પાસ થયા છો.' : '💪 સરસ પ્રયાસ! આગળની કસોટીમાં વધુ મહેનત કરો.';

    return `*🎓 ત્રિનેત્ર ઓનલાઇન એકેડેમી*
*📋 કસોટી પરિણામ પત્રક (Result Card)*
━━━━━━━━━━━━━━━━━━━━
👤 *વિદ્યાર્થીનું નામ:* ${sub.student?.name || 'Student'}
📚 *વિષય:* ${group.subject || 'સામાન્ય'}
📝 *કસોટીનું નામ:* ${group.testName}
🔢 *ટેસ્ટ કોડ:* ${group.testCode}
━━━━━━━━━━━━━━━━━━━━
🏆 *તમારો રેન્ક:* ${rankEmoji}
🎯 *મેળવેલ ગુણ:* ${score} / ${total}
📊 *ટકાવારી:* ${pct}%
📅 *તારીખ & સમય:* ${dateStr}, ${timeStr}
━━━━━━━━━━━━━━━━━━━━
${statusText}

🌐 *સંપૂર્ણ વિશ્લેષણ અને ઓનલાઇન ટેસ્ટ માટે:*
👉 https://trinetraacademy.in
📞 *હેલ્પલાઇન:* 8200405300`;
  };

  return (
    <div className="animate-fade-in">
      {/* ── Top Summary Stats Bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          { l: '📋 કુલ કસોટીઓ', v: totalUniqueTests, g: 'stat-grad-blue' },
          { l: '👥 કુલ પરીક્ષાઓ (Appeared)', v: totalSubmissions, g: 'stat-grad-green' },
          { l: '📅 આજની પરીક્ષાઓ', v: today.length, g: 'stat-grad-purple' },
          { l: '📊 સરેરાશ સ્કોર', v: avgOverallScore, g: 'stat-grad-orange' }
        ].map((s, i) => (
          <div key={i} className={`stat-grad-card ${s.g}`}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900 }}><CountUp target={Number(s.v)} /></div>
            <div style={{ fontSize: '0.72rem', opacity: 0.88 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs, Search & Filters ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* View Mode Tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('testWise')}
            style={{
              padding: '7px 14px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem',
              border: `1.5px solid ${activeTab === 'testWise' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
              background: activeTab === 'testWise' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'testWise' ? '#38bdf8' : '#94a3b8',
              fontFamily: 'Hind Vadodara, sans-serif'
            }}>
            📊 ટેસ્ટ વાઇઝ ગ્રુપ ({totalUniqueTests})
          </button>
          <button onClick={() => setActiveTab('all')}
            style={{
              padding: '7px 14px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '0.82rem',
              border: `1.5px solid ${activeTab === 'all' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
              background: activeTab === 'all' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'all' ? '#38bdf8' : '#94a3b8',
              fontFamily: 'Hind Vadodara, sans-serif'
            }}>
            📋 તમામ વિદ્યાર્થીઓ ({totalSubmissions})
          </button>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', 'તમામ (All)'], ['today', 'આજની (Today)']].map(([id, label]) => (
            <button key={id} onClick={() => setFilterDate(id)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem',
                border: `1px solid ${filterDate === id ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                background: filterDate === id ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: filterDate === id ? '#60a5fa' : '#64748b',
                fontFamily: 'Hind Vadodara, sans-serif'
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search Box ── */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="input-dark"
          placeholder="🔍 કસોટીનું નામ, ટેસ્ટ કોડ, વિષય અથવા વિદ્યાર્થીનું નામ શોધો..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', fontSize: '0.85rem', padding: '10px 14px' }}
        />
      </div>

      {/* ── Content Area ── */}
      {loading ? (
        <Loader />
      ) : activeTab === 'testWise' ? (
        /* ════════════════════════════════════════════════════════════════════════
           TAB 1: TEST-WISE GROUPED VIEW
        ════════════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredGroups.length === 0 && <Empty msg="કોઈ ટેસ્ટ ઇતિહાસ મળ્યો નથી." />}

          {filteredGroups.map(group => {
            const isExpanded = expandedTest === group.key;

            return (
              <div key={group.key} className="glass-card animate-fade-in"
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  border: isExpanded ? '1.5px solid rgba(56,189,248,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: isExpanded ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.02)'
                }}>

                {/* Test Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                        📚 {group.subject}
                      </span>
                      <span style={{ background: 'rgba(255,255,255,0.06)', color: '#38bdf8', fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                        {group.testCode}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        ⏱️ {group.latestDate.toLocaleString('gu-IN')}
                      </span>
                    </div>

                    <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.05rem', margin: 0, lineHeight: 1.3 }}>
                      {group.testName}
                    </h3>
                  </div>

                  {/* Right Badge: Student Attendance Count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{
                      background: 'linear-gradient(135deg,rgba(59,130,246,0.25),rgba(37,99,235,0.35))',
                      border: '1.5px solid rgba(59,130,246,0.5)',
                      color: '#93c5fd',
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontWeight: 900,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <span style={{ fontSize: '1.05rem' }}>👥</span>
                      <span>{group.studentsCount} વિદ્યાર્થીઓએ આપી</span>
                    </div>
                  </div>
                </div>

                {/* Metrics Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: 8,
                  background: 'rgba(255,255,255,0.02)',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.04)',
                  marginBottom: 12
                }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>👥 વિદ્યાર્થીઓની સંખ્યા</div>
                    <div style={{ color: '#38bdf8', fontWeight: 900, fontSize: '0.95rem', marginTop: 2 }}>
                      {group.studentsCount} Students
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>🏆 સર્વોચ્ચ ગુણ (Top Score)</div>
                    <div style={{ color: '#4ade80', fontWeight: 900, fontSize: '0.95rem', marginTop: 2 }}>
                      {group.topScore} / {group.totalMarks || '-'}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700 }}>📊 સરેરાશ સ્કોર (Avg)</div>
                    <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: '0.95rem', marginTop: 2 }}>
                      {group.avgScore} / {group.totalMarks || '-'}
                    </div>
                  </div>
                </div>

                {/* Action Buttons: View Students List & CSV Download */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setExpandedTest(isExpanded ? null : group.key)}
                    style={{
                      background: isExpanded ? 'rgba(56,189,248,0.2)' : 'linear-gradient(135deg,#1d4ed8,#2563eb)',
                      color: 'white',
                      border: isExpanded ? '1px solid rgba(56,189,248,0.4)' : 'none',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: 'Hind Vadodara, sans-serif'
                    }}>
                    <Eye size={14} />
                    {isExpanded ? 'વિદ્યાર્થીઓની યાદી છુપાવો (Hide List)' : `👁️ વિદ્યાર્થીઓની યાદી જુઓ (${group.studentsCount})`}
                  </button>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => exportTestExcel(group)}
                      style={{
                        background: 'linear-gradient(135deg,#047857,#10b981)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: 8,
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: 'Hind Vadodara, sans-serif',
                        boxShadow: '0 3px 12px rgba(16,185,129,0.3)'
                      }}>
                      <Download size={13} /> 📊 Excel ડાઉનલોડ
                    </button>
                    <button onClick={() => exportTestCSV(group)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#cbd5e1',
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontFamily: 'Hind Vadodara, sans-serif'
                      }}>
                      <Download size={13} /> CSV
                    </button>
                  </div>
                </div>

                {/* ── EXPANDED STUDENT LIST FOR THIS TEST ── */}
                {isExpanded && (
                  <div className="animate-fade-in" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ color: '#a5b4fc', fontSize: '0.82rem', fontWeight: 800, marginBottom: 10 }}>
                      📋 આ કસોટી આપનાર વિદ્યાર્થીઓનું લિસ્ટ (Rank Wise):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.submissions.map((sub, sIdx) => {
                        const score = sub.mcqScore ?? sub.score ?? 0;
                        const total = sub.totalMarks || sub.totalMCQ || group.totalMarks || 1;
                        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
                        const medals = ['🥇','🥈','🥉'];

                        return (
                          <div key={sub.id}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: sIdx === 0 ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              flexWrap: 'wrap'
                            }}>
                            {/* Rank Badge */}
                            <span style={{ fontSize: sIdx < 3 ? '1.2rem' : '0.82rem', width: 24, textAlign: 'center', fontWeight: 900, color: sIdx >= 3 ? '#64748b' : undefined }}>
                              {medals[sIdx] || `#${sIdx+1}`}
                            </span>

                            <Avatar name={sub.student?.name} size={34} />

                            {/* Student Info */}
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <div style={{ color: 'white', fontWeight: 800, fontSize: '0.88rem' }}>
                                {sub.student?.name}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                📞 {sub.student?.mobile} • {new Date(sub.submittedAt || sub.createdAt).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>

                            {/* Score & Progress */}
                            <div style={{ minWidth: 100, textAlign: 'right' }}>
                              <div style={{ fontWeight: 900, fontSize: '0.98rem', color: pct >= 60 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                                {score} / {total}
                              </div>
                              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 3 }}>
                                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct >= 60 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                              </div>
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{pct}%</div>
                            </div>

                            {/* Photo Answer / Teacher Marks */}
                            {sub.photoUrl && (
                              <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                                📸 Photo
                              </span>
                            )}

                            {/* WhatsApp Share Button */}
                            <a
                              href={`https://wa.me/91${sub.student?.mobile}?text=${encodeURIComponent(getWhatsAppResultMsg(sub, group, sIdx + 1))}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Send Result on WhatsApp"
                              style={{
                                background: '#25d366',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: 8,
                                textDecoration: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                boxShadow: '0 2px 8px rgba(37,211,102,0.3)'
                              }}>
                              💬 WhatsApp
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ════════════════════════════════════════════════════════════════════════
           TAB 2: ALL SUBMISSIONS FLAT VIEW
        ════════════════════════════════════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayedSubs.length === 0 && <Empty msg="કોઈ સબમિશન મળ્યું નથી." />}

          {displayedSubs.map((sub, i) => {
            const score = sub.mcqScore ?? sub.score ?? 0;
            const total = sub.totalMarks || sub.totalMCQ || 1;
            const pct = total > 0 ? Math.round((score / total) * 100) : 0;

            return (
              <div key={sub.id} className="glass-card animate-fade-in"
                style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', width: 24, textAlign: 'center' }}>
                  #{i+1}
                </span>

                <Avatar name={sub.student?.name} size={36} />

                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>
                    {sub.student?.name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 1 }}>
                    <span style={{ color: '#38bdf8' }}>{sub.testName || 'કસોટી'}</span> • 📞 {sub.student?.mobile}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                    {new Date(sub.submittedAt || sub.createdAt).toLocaleString('gu-IN')}
                  </div>
                </div>

                <div style={{ minWidth: 100, textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: pct >= 60 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                    {score} / {total}
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct >= 60 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>{pct}%</div>
                </div>

                <a
                  href={`https://wa.me/91${sub.student?.mobile}?text=${encodeURIComponent(getWhatsAppResultMsg(sub, { testName: sub.testName || 'કસોટી', subject: sub.subject || 'સામાન્ય', testCode: sub.testCode || '-' }, i + 1))}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Send Result on WhatsApp"
                  style={{ background: '#25d366', color: 'white', padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(37,211,102,0.3)' }}>
                  💬 WhatsApp
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MATERIAL MANAGER — Study Materials, PDFs & Notes
═══════════════════════════════════════════════════════ */
function MaterialManager({ showToast }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMat, setEditingMat] = useState(null);
  const [saving, setSaving] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subject: 'General',
    description: '',
    fileType: 'PDF',
    tag: 'TET-2 Special',
    linkUrl: '',
    customFileSize: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'link'
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const res = await getMaterials();
      setMaterials(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      showToast('મટીરીયલ લોડ કરવામાં ક્ષતિ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingMat(null);
    setFormData({
      title: '',
      subject: 'General',
      description: '',
      fileType: 'PDF',
      tag: 'TET-2 Special',
      linkUrl: '',
      customFileSize: ''
    });
    setSelectedFile(null);
    setUploadMode('file');
    setShowAddModal(true);
  };

  const handleOpenEdit = (mat) => {
    setEditingMat(mat);
    setFormData({
      title: mat.title || '',
      subject: mat.subject || 'General',
      description: mat.description || '',
      fileType: mat.fileType || 'PDF',
      tag: mat.tag || 'IMP',
      linkUrl: mat.linkUrl || mat.fileUrl || '',
      customFileSize: mat.fileSize || ''
    });
    setSelectedFile(null);
    setUploadMode(mat.linkUrl ? 'link' : 'file');
    setShowAddModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setFormData(prev => ({ ...prev, title: cleanName }));
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('મટીરીયલનું શીર્ષક (Title) લખો', 'error');
      return;
    }

    if (uploadMode === 'file' && !selectedFile && !editingMat) {
      showToast('કૃપા કરીને PDF અથવા ફાઇલ પસંદ કરો', 'error');
      return;
    }

    if (uploadMode === 'link' && !formData.linkUrl.trim()) {
      showToast('કૃપા કરીને ડ્રાઇવ / વેબ લિંક દાખલ કરો', 'error');
      return;
    }

    try {
      setSaving(true);
      const data = new FormData();
      data.append('title', formData.title);
      data.append('subject', formData.subject);
      data.append('description', formData.description);
      data.append('fileType', formData.fileType);
      data.append('tag', formData.tag);

      if (uploadMode === 'file' && selectedFile) {
        data.append('file', selectedFile);
      } else if (uploadMode === 'link') {
        data.append('linkUrl', formData.linkUrl);
        if (formData.customFileSize) {
          data.append('customFileSize', formData.customFileSize);
        }
      }

      if (editingMat) {
        await updateMaterial(editingMat.id, data);
        showToast('✅ મટીરીયલ સફળતાપૂર્વક સુધારાઈ ગયું!', 'success');
      } else {
        await createMaterial(data);
        showToast('🎉 નવું મટીરીયલ સફળતાપૂર્વક ઉમેરાઈ ગયું!', 'success');
      }

      setShowAddModal(false);
      await loadMaterials();
    } catch (err) {
      showToast(err.response?.data?.error || 'મટીરીયલ સાચવવામાં ક્ષતિ.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`શું તમે ખરેખર '${title}' મટીરીયલ કાઢી નાખવા માંગો છો?`)) return;
    try {
      await deleteMaterial(id);
      showToast('🗑️ મટીરીયલ દૂર થયું.', 'success');
      await loadMaterials();
    } catch {
      showToast('મટીરીયલ ડીલીટ કરવામાં ક્ષતિ.', 'error');
    }
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchSearch = !searchTerm ||
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.subject && m.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.tag && m.tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchSubject = filterSubject === 'ALL' || m.subject === filterSubject;
      const matchType = filterType === 'ALL' || m.fileType === filterType;
      return matchSearch && matchSubject && matchType;
    });
  }, [materials, searchTerm, filterSubject, filterType]);

  const distinctSubjects = useMemo(() => {
    const s = new Set();
    materials.forEach(m => { if (m.subject) s.add(m.subject); });
    return Array.from(s);
  }, [materials]);

  const modelPapersCount = useMemo(() => materials.filter(m => m.fileType === 'Model Paper').length, [materials]);
  const specialTagCount = useMemo(() => materials.filter(m => Boolean(m.tag)).length, [materials]);

  const getSubjectMeta = (subject = '', type = '') => {
    const sub = (subject || '').toLowerCase();
    if (sub.includes('વિજ્ઞાન') || sub.includes('science')) {
      return {
        icon: '🔬',
        gradient: 'linear-gradient(135deg, rgba(6,78,59,0.55) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1.5px solid rgba(16,185,129,0.4)',
        badgeBg: 'rgba(16,185,129,0.2)',
        badgeColor: '#34d399',
        badgeBorder: 'rgba(16,185,129,0.4)',
        accentColor: '#34d399'
      };
    }
    if (sub.includes('ગણિત') || sub.includes('math')) {
      return {
        icon: '📐',
        gradient: 'linear-gradient(135deg, rgba(30,58,138,0.55) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1.5px solid rgba(59,130,246,0.4)',
        badgeBg: 'rgba(59,130,246,0.2)',
        badgeColor: '#60a5fa',
        badgeBorder: 'rgba(59,130,246,0.4)',
        accentColor: '#60a5fa'
      };
    }
    if (sub.includes('ગુજરાતી') || sub.includes('ભાષા') || sub.includes('guj')) {
      return {
        icon: '📖',
        gradient: 'linear-gradient(135deg, rgba(120,53,15,0.55) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1.5px solid rgba(245,158,11,0.4)',
        badgeBg: 'rgba(245,158,11,0.2)',
        badgeColor: '#fbbf24',
        badgeBorder: 'rgba(245,158,11,0.4)',
        accentColor: '#fbbf24'
      };
    }
    if (sub.includes('સામ') || sub.includes('સામાજિક') || sub.includes('social') || sub.includes('gk')) {
      return {
        icon: '🌍',
        gradient: 'linear-gradient(135deg, rgba(19,78,74,0.55) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1.5px solid rgba(20,184,166,0.4)',
        badgeBg: 'rgba(20,184,166,0.2)',
        badgeColor: '#2dd4bf',
        badgeBorder: 'rgba(20,184,166,0.4)',
        accentColor: '#2dd4bf'
      };
    }
    if (type === 'Model Paper' || sub.includes('tet') || sub.includes('tat')) {
      return {
        icon: '📋',
        gradient: 'linear-gradient(135deg, rgba(88,28,135,0.55) 0%, rgba(15,23,42,0.95) 100%)',
        border: '1.5px solid rgba(168,85,247,0.4)',
        badgeBg: 'rgba(168,85,247,0.2)',
        badgeColor: '#c084fc',
        badgeBorder: 'rgba(168,85,247,0.4)',
        accentColor: '#c084fc'
      };
    }
    return {
      icon: '📁',
      gradient: 'linear-gradient(135deg, rgba(30,41,59,0.65) 0%, rgba(15,23,42,0.95) 100%)',
      border: '1.5px solid rgba(255,255,255,0.12)',
      badgeBg: 'rgba(56,189,248,0.15)',
      badgeColor: '#38bdf8',
      badgeBorder: 'rgba(56,189,248,0.3)',
      accentColor: '#38bdf8'
    };
  };

  return (
    <div className="animate-fade-in">

      {/* ── Top Bar: Title & Upload Button ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: 'white', fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,1.5rem)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📁</span> સ્ટડી મટીરીયલ અને સાહિત્ય મેનેજર
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 0' }}>
            વિદ્યાર્થીઓ માટે PDF પુસ્તકો, શોર્ટ નોટ્સ, મોડેલ પેપર્સ અપલોડ કરો અને લાઈવ શેર કરો.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="material-glow-btn"
          style={{
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            color: 'white',
            border: 'none',
            padding: '11px 22px',
            borderRadius: 14,
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 6px 20px rgba(37,99,235,0.4)',
            transition: 'all 0.2s',
            fontFamily: 'Hind Vadodara, sans-serif'
          }}>
          <Plus size={18} /> + નવું મટીરીયલ અપલોડ કરો
        </button>
      </div>

      {/* ── 3 Quick Stats Mini Banners ── */}
      <div className="material-stats-grid">
        <div className="glass-card material-stat-card" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(15,23,42,0.8))', border: '1px solid rgba(59,130,246,0.3)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            📁
          </div>
          <div>
            <div style={{ color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700 }}>કુલ મટીરીયલ (Total)</div>
            <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 900 }}>{materials.length} ફાઇલો</div>
          </div>
        </div>

        <div className="glass-card material-stat-card" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(15,23,42,0.8))', border: '1px solid rgba(168,85,247,0.3)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(168,85,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            📋
          </div>
          <div>
            <div style={{ color: '#d8b4fe', fontSize: '0.75rem', fontWeight: 700 }}>મોડેલ પેપર્સ (Papers)</div>
            <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 900 }}>{modelPapersCount} સેટ</div>
          </div>
        </div>

        <div className="glass-card material-stat-card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(15,23,42,0.8))', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            ⭐
          </div>
          <div>
            <div style={{ color: '#fde68a', fontSize: '0.75rem', fontWeight: 700 }}>સ્પેશિયલ IMP નોટ્સ</div>
            <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 900 }}>{specialTagCount} વિષયવાર</div>
          </div>
        </div>
      </div>

      {/* ── Search & Horizontal Category Pills ── */}
      <div className="glass-card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Search row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}>🔍</span>
          <input
            className="input-dark"
            placeholder="મટીરીયલ શીર્ષક અથવા વિષય શોધો..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
          />
        </div>

        {/* Scrollable Subject Pills */}
        <div className="material-pill-carousel">
          <button
            onClick={() => setFilterSubject('ALL')}
            className={`material-pill-btn ${filterSubject === 'ALL' ? 'active' : ''}`}
            style={{
              background: filterSubject === 'ALL' ? 'linear-gradient(135deg, #2563eb, #38bdf8)' : 'rgba(255,255,255,0.06)',
              color: filterSubject === 'ALL' ? 'white' : '#94a3b8',
              borderColor: filterSubject === 'ALL' ? '#60a5fa' : 'rgba(255,255,255,0.1)'
            }}>
            🌟 તમામ ({materials.length})
          </button>
          {distinctSubjects.map(sub => {
            const isActive = filterSubject === sub;
            const meta = getSubjectMeta(sub);
            return (
              <button
                key={sub}
                onClick={() => setFilterSubject(sub)}
                className={`material-pill-btn ${isActive ? 'active' : ''}`}
                style={{
                  background: isActive ? 'linear-gradient(135deg, #2563eb, #38bdf8)' : 'rgba(255,255,255,0.06)',
                  color: isActive ? 'white' : '#cbd5e1',
                  borderColor: isActive ? '#60a5fa' : 'rgba(255,255,255,0.1)'
                }}>
                <span>{meta.icon}</span> {sub}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Materials Grid with Subject Gradient Cards ── */}
      {loading ? (
        <Loader />
      ) : filteredMaterials.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📁</div>
          <h3 style={{ color: 'white', fontWeight: 800, marginBottom: 6 }}>હજુ સુધી કોઈ મટીરીયલ મળ્યું નથી</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 18 }}>
            વિદ્યાર્થીઓ માટે PDF પુસ્તકો અથવા નોટ્સ અપલોડ કરવા ઉપર આપેલ બટન ક્લિક કરો.
          </p>
          <button
            onClick={handleOpenAdd}
            style={{
              background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
              color: 'white',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 10,
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.88rem'
            }}>
            + મટીરીયલ ઉમેરો
          </button>
        </div>
      ) : (
        <div className="material-grid">
          {filteredMaterials.map(mat => {
            const isExternal = Boolean(mat.linkUrl);
            const downloadUrl = mat.fileUrl || mat.linkUrl;
            const meta = getSubjectMeta(mat.subject, mat.fileType);

            return (
              <div
                key={mat.id}
                className="material-card-pro animate-fade-in"
                style={{
                  background: meta.gradient,
                  border: meta.border
                }}>
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: meta.badgeBg,
                        color: meta.badgeColor,
                        border: `1px solid ${meta.badgeBorder}`,
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        padding: '3px 9px',
                        borderRadius: 6
                      }}>
                        {meta.icon} {mat.fileType === 'PDF' ? 'PDF દસ્તાવેજ' : mat.fileType}
                      </span>
                      {mat.tag && (
                        <span style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.4)' }}>
                          🏷️ {mat.tag}
                        </span>
                      )}
                    </div>

                    <span style={{ color: '#cbd5e1', fontSize: '0.76rem', fontWeight: 700, background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 6 }}>
                      💾 {mat.fileSize || 'Online'}
                    </span>
                  </div>

                  {/* Title & Subject */}
                  <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.08rem', margin: '0 0 8px', lineHeight: 1.4 }}>
                    {mat.title}
                  </h3>

                  <div style={{ color: meta.accentColor, fontSize: '0.82rem', fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{meta.icon} વિષય:</span> {mat.subject || 'General'}
                  </div>

                  {mat.description && (
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                      {mat.description}
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(37,99,235,0.25)',
                          border: '1px solid rgba(37,99,235,0.5)',
                          color: '#93c5fd',
                          padding: '7px 14px',
                          borderRadius: 8,
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                        <Eye size={14} /> ઓપન
                      </a>
                    )}
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: 'rgba(34,197,94,0.25)',
                          border: '1px solid rgba(34,197,94,0.5)',
                          color: '#4ade80',
                          padding: '7px 14px',
                          borderRadius: 8,
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                        <Download size={14} /> ડાઉનલોડ
                      </a>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleOpenEdit(mat)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#cbd5e1',
                        padding: '7px 10px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                      title="સુધારો">
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(mat.id, mat.title)}
                      style={{
                        background: 'rgba(239,68,68,0.2)',
                        border: '1px solid rgba(239,68,68,0.4)',
                        color: '#fca5a5',
                        padding: '7px 10px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                      title="ડીલીટ">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Material Modal (Pro Portaled Direct to Body for 100% Center & No-Clip) ── */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="upload-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="upload-modal-card" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="upload-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.3)', border: '1px solid rgba(59,130,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                  📁
                </div>
                <div>
                  <h3 style={{ color: 'white', fontWeight: 900, margin: 0, fontSize: '1.05rem' }}>
                    {editingMat ? '✏️ મટીરીયલ વિગત સુધારો' : '➕ નવું સ્ટડી મટીરીયલ અપલોડ કરો'}
                  </h3>
                  <p style={{ color: '#93c5fd', fontSize: '0.74rem', margin: '2px 0 0', fontWeight: 600 }}>
                    વિદ્યાર્થીઓ માટે PDF પુસ્તકો, મોડેલ પેપર્સ અને શોર્ટ નોટ્સ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', transition: 'all 0.2s' }}>
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', margin: 0 }}>
              {/* Scrollable Form Body */}
              <div className="upload-modal-body">
                
                {/* ── 2-Column Responsive Layout (Laptop Side-by-Side, Mobile Stacked) ── */}
                <div className="upload-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                  
                  {/* Left Column: File Upload / Mode */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    
                    {/* Mode Switcher */}
                    <div className="upload-mode-switcher">
                      <button
                        type="button"
                        onClick={() => setUploadMode('file')}
                        className={`upload-mode-btn ${uploadMode === 'file' ? 'active' : ''}`}>
                        <UploadCloud size={15} /> 📄 PDF / File અપલોડ
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode('link')}
                        className={`upload-mode-btn ${uploadMode === 'link' ? 'active' : ''}`}>
                        <LinkIcon size={15} /> 🔗 Drive / Web લિંક
                      </button>
                    </div>

                    {/* Dropzone or Drive Link */}
                    {uploadMode === 'file' ? (
                      selectedFile ? (
                        <div style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid #22c55e', borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                              📄
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.88rem', wordBreak: 'break-all' }}>
                                {selectedFile.name}
                              </div>
                              <div style={{ color: '#86efac', fontSize: '0.74rem', fontWeight: 700 }}>
                                ✅ {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • તૈયાર છે
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              style={{ flex: 1, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#f8fafc', padding: '6px', borderRadius: 6, fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}>
                              🔄 ફાઇલ બદલો
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedFile(null)}
                              style={{ background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '6px 12px', borderRadius: 6, fontSize: '0.76rem', fontWeight: 800, cursor: 'pointer' }}>
                              ❌
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="upload-dropzone"
                          style={{ minHeight: 130, flex: 1 }}>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                          />
                          <div style={{ fontSize: '2rem', marginBottom: 2 }}>☁️</div>
                          <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.88rem' }}>
                            PDF અથવા ફાઇલ પસંદ કરો
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                            PDF, Word, Images, ZIP (મહત્તમ 50MB)
                          </div>
                        </div>
                      )
                    ) : (
                      <div Name="upload-input-group" style={{ flex: 1, justifyContent: 'center' }}>
                        <label className="upload-input-label">
                          <LinkIcon size={14} color="#38bdf8" /> Google Drive અથવા વેબ URL <span className="req">*</span>
                        </label>
                        <input
                          className="input-dark"
                          placeholder="https://drive.google.com/file/d/..."
                          value={formData.linkUrl}
                          onChange={e => setFormData(f => ({ ...f, linkUrl: e.target.value }))}
                          style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)' }}
                        />
                      </div>
                    )}

                    {/* Category Selector */}
                    <div className="upload-input-group">
                      <label className="upload-input-label">
                        <span>📂</span> પ્રકાર (Category)
                      </label>
                      <select
                        className="input-dark"
                        value={formData.fileType}
                        onChange={e => setFormData(f => ({ ...f, fileType: e.target.value }))}
                        style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)', color: '#38bdf8' }}>
                        <option value="PDF">📄 PDF દસ્તાવેજ</option>
                        <option value="Notes">📝 શોર્ટ નોટ્સ (Notes)</option>
                        <option value="Model Paper">📋 મોડેલ પેપર (Model Paper)</option>
                        <option value="Book">📖 પુસ્તક / મટીરીયલ (Book)</option>
                        <option value="Question Bank">🔢 પ્રશ્ન બેંક (Question Bank)</option>
                      </select>
                    </div>
                  </div>

                  {/* Right Column: Title, Subject, Tag */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    
                    {/* Title */}
                    <div className="upload-input-group">
                      <label className="upload-input-label">
                        <FileText size={14} color="#38bdf8" /> મટીરીયલનું શીર્ષક (Title) <span className="req">*</span>
                      </label>
                      <input
                        className="input-dark"
                        placeholder="દા.ત. TET-2 વિજ્ઞાન & ટેકનોલોજી મોડેલ પેપર"
                        value={formData.title}
                        onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                        required
                        style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)' }}
                      />
                    </div>

                    {/* Subject */}
                    <div className="upload-input-group">
                      <label className="upload-input-label">
                        <span>📚</span> વિષય (Subject) <span className="req">*</span>
                      </label>
                      <input
                        className="input-dark"
                        placeholder="e.g. વિજ્ઞાન, ગણિત..."
                        value={formData.subject}
                        onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))}
                        style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)' }}
                      />
                      {/* Quick Subject Chips */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        {['વિજ્ઞાન', 'ગણિત', 'સામ. વિજ્ઞાન', 'ગુજરાતી', 'અંગ્રેજી', 'TET-2'].map(sub => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setFormData(f => ({ ...f, subject: sub }))}
                            style={{
                              background: formData.subject === sub ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${formData.subject === sub ? '#3b82f6' : 'rgba(255,255,255,0.12)'}`,
                              color: formData.subject === sub ? '#93c5fd' : '#cbd5e1',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}>
                            {sub}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tag & File Size */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="upload-input-group">
                        <label className="upload-input-label">
                          <span>🏷️</span> ટેગ (Badge)
                        </label>
                        <input
                          className="input-dark"
                          placeholder="e.g. TET-2 Special"
                          value={formData.tag}
                          onChange={e => setFormData(f => ({ ...f, tag: e.target.value }))}
                          style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)' }}
                        />
                      </div>

                      <div className="upload-input-group">
                        <label className="upload-input-label">
                          <span>💾</span> સાઈઝ (Optional)
                        </label>
                        <input
                          className="input-dark"
                          placeholder="e.g. 2.4 MB"
                          value={formData.customFileSize}
                          onChange={e => setFormData(f => ({ ...f, customFileSize: e.target.value }))}
                          style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description (Full Width Below) */}
                <div className="upload-input-group">
                  <label className="upload-input-label">
                    <span>📝</span> વર્ણન / વિગત (Description)
                  </label>
                  <textarea
                    className="input-dark"
                    rows={2}
                    placeholder="આ સાહિત્યમાં કયા કયા પ્રકરણો કે ટોપિક્સ આવરી લીધેલા છે તેની ટૂંકી વિગત..."
                    value={formData.description}
                    onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                    style={{ background: '#162032', borderColor: 'rgba(255,255,255,0.18)', minHeight: 48 }}
                  />
                </div>
              </div>

              {/* Pinned Action Footer */}
              <div className="upload-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8',
                    padding: '9px 18px',
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontFamily: 'Hind Vadodara, sans-serif'
                  }}>
                  રદ કરો
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="material-glow-btn"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                    color: 'white',
                    border: 'none',
                    padding: '9px 24px',
                    borderRadius: 10,
                    fontWeight: 800,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.88rem',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                    fontFamily: 'Hind Vadodara, sans-serif'
                  }}>
                  {saving ? '⏳ સાચવી રહ્યું છે...' : editingMat ? '💾 સુધારા સાચવો' : '🚀 અપલોડ કરો (Submit)'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MARKETING & OFFERS MANAGER — Home Posters, PDF Brochure, Dhamaka Offers
═══════════════════════════════════════════════════════ */
function MarketingManager({ showToast }) {
  const API = 'http://localhost:8085/api/marketing';
  const token = localStorage.getItem('token');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalMode, setModalMode] = useState('HOME');
  const [saving, setSaving] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const [filterTab, setFilterTab] = useState('ALL');
  const fileInputRef = useRef(null);

  const emptyForm = {
    category: 'CAROUSEL', title: '', subtitle: '', description: '',
    imageUrl: '', price: '', oldPrice: '', badge: '', tagColor: '#2563eb',
    couponCode: '', linkUrl: '', buttonText: '💬 WhatsApp કરો',
    waMessage: '', isActive: true, showInHome: true, showInPdf: false, orderIndex: 0
  };
  const [form, setForm] = useState(emptyForm);
  const [filePreview, setFilePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await getMarketingItems({ all: true });
      const data = res.data?.data || res.data || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Marketing fetch error:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openAdd = (mode) => {
    setEditingItem(null);
    setModalMode(mode);
    setFilePreview('');
    setSelectedFile(null);
    if (mode === 'HOME') {
      setForm({ ...emptyForm, category: 'CAROUSEL', showInHome: true, showInPdf: false, badge: 'BEST SELLER', tagColor: '#2563eb' });
    } else if (mode === 'PDF') {
      setForm({ ...emptyForm, category: 'CAROUSEL', showInHome: false, showInPdf: true, badge: '📑 PDF SPECIAL', tagColor: '#059669' });
    } else {
      setForm({ ...emptyForm, category: 'DHAMAKA_OFFER', showInHome: true, showInPdf: true, badge: '🔥 50% OFF', tagColor: '#d97706', couponCode: 'TET50' });
    }
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setModalMode(item.showInPdf && !item.showInHome ? 'PDF' : item.category === 'DHAMAKA_OFFER' ? 'DHAMAKA' : 'HOME');
    setForm({
      category: item.category || 'CAROUSEL',
      title: item.title || '', subtitle: item.subtitle || '',
      description: item.description || '', imageUrl: item.imageUrl || '',
      price: item.price || '', oldPrice: item.oldPrice || '',
      badge: item.badge || '', tagColor: item.tagColor || '#f59e0b',
      couponCode: item.couponCode || '', linkUrl: item.linkUrl || '',
      buttonText: item.buttonText || '💬 WhatsApp કરો', waMessage: item.waMessage || '',
      isActive: item.isActive !== false, showInHome: item.showInHome !== false,
      showInPdf: item.showInPdf !== false, orderIndex: item.orderIndex || 0
    });
    setFilePreview(item.imageUrl || '');
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (modalMode === 'PDF' && !form.title.trim()) {
      form.title = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : 'PDF સ્પેશિયલ બ્રોશર';
    }
    if (!form.title.trim() && !selectedFile && !form.imageUrl) {
      showToast?.('કૃપા કરીને પોસ્ટર ઇમેજ પસંદ કરો.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (selectedFile) {
        const fd = new FormData();
        Object.keys(form).forEach(key => {
          if (form[key] !== null && form[key] !== undefined) {
            fd.append(key, form[key]);
          }
        });
        fd.append('posterFile', selectedFile);
        if (editingItem) {
          await updateMarketingItem(editingItem.id, fd);
          showToast?.('✅ સફળતાપૂર્વક સુધારો!', 'success');
        } else {
          await createMarketingItem(fd);
          showToast?.('✅ નવું પોસ્ટર ઉમેરાઈ ગયું!', 'success');
        }
      } else {
        if (editingItem) {
          await updateMarketingItem(editingItem.id, form);
          showToast?.('✅ સફળતાપૂર્વક સુધારો!', 'success');
        } else {
          await createMarketingItem(form);
          showToast?.('✅ નવું પોસ્ટર ઉમેરાઈ ગયું!', 'success');
        }
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      console.error('Save poster error:', err);
      showToast?.(err.response?.data?.error || 'પોસ્ટર સાચવવામાં ક્ષતિ', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('શું આ પોસ્ટર કાઢી નાખવું છે?')) return;
    try {
      await deleteMarketingItem(id);
      setItems(prev => prev.filter(x => x.id !== id));
      showToast?.('🗑️ કાઢી નાખ્યું', 'success');
    } catch { showToast?.('Delete ક્ષતિ', 'error'); }
  };

  const toggleField = async (item, field) => {
    const updated = { ...item, [field]: !item[field] };
    setItems(prev => prev.map(x => x.id === item.id ? updated : x));
    try {
      await updateMarketingItem(item.id, { [field]: updated[field] });
    } catch { fetchItems(); showToast?.('Toggle ક્ষતિ', 'error'); }
  };

  const FILTER_TABS = [
    { id: 'ALL', label: '🌐 બધા' },
    { id: 'HOME', label: '🏠 Home Live' },
    { id: 'PDF', label: '📑 PDF Live' },
    { id: 'DHAMAKA', label: '🔥 Dhamaka' },
  ];

  const filteredItems = items.filter(item => {
    if (filterTab === 'HOME') return item.showInHome !== false && item.isActive !== false;
    if (filterTab === 'PDF') return item.showInPdf !== false && item.isActive !== false;
    if (filterTab === 'DHAMAKA') return item.category === 'DHAMAKA_OFFER';
    return true;
  });

  const homeCount   = items.filter(i => i.showInHome !== false && i.isActive !== false).length;
  const pdfCount    = items.filter(i => i.showInPdf  !== false && i.isActive !== false).length;
  const dhamakaCount = items.filter(i => i.category === 'DHAMAKA_OFFER' && i.isActive !== false).length;

  const modeConfig = {
    HOME:   { title: '🏠 Home Page Poster', color: '#2563eb', bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.4)' },
    PDF:    { title: '📑 PDF Brochure Poster', color: '#059669', bg: 'rgba(5,150,105,0.15)', border: 'rgba(5,150,105,0.4)' },
    DHAMAKA:{ title: '🔥 Dhamaka Offer', color: '#d97706', bg: 'rgba(217,119,6,0.15)', border: 'rgba(217,119,6,0.4)' },
  };
  const mc = modeConfig[modalMode] || modeConfig.HOME;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 90, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Mobile-Friendly Header ── */}
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.2rem', margin: '0 0 2px' }}>🎨 Posters & Offers</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>Home Carousel • PDF Brochure • Dhamaka Offers</p>
        </div>
        <button onClick={fetchItems} style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#93c5fd', padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800
        }}>
          <RefreshCw size={13} /> રીફ્રેશ
        </button>
      </div>

      {/* ── Mobile-Optimized Action Buttons Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { mode: 'HOME',    label: '➕ 🏠 Home Poster',    bg: 'linear-gradient(135deg,#1e40af,#2563eb)', note: '🌐 Carousel Banner' },
          { mode: 'PDF',     label: '➕ 📑 PDF Poster',     bg: 'linear-gradient(135deg,#047857,#059669)', note: '📄 Answer Sheet' },
          { mode: 'DHAMAKA', label: '➕ 🔥 Dhamaka Offer',  bg: 'linear-gradient(135deg,#b45309,#d97706)', note: '🎟️ Coupon & Price' },
        ].map(btn => (
          <button key={btn.mode} onClick={() => openAdd(btn.mode)} style={{
            background: btn.bg, color: 'white', border: 'none',
            padding: '12px 14px', borderRadius: 12, fontWeight: 900,
            cursor: 'pointer', fontSize: '0.88rem', display: 'flex',
            flexDirection: 'column', alignItems: 'flex-start', gap: 2,
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)', width: '100%',
            fontFamily: 'Hind Vadodara, sans-serif', lineHeight: 1.25,
            boxSizing: 'border-box'
          }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{btn.label}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.85 }}>{btn.note}</span>
          </button>
        ))}
      </div>

      {/* ── Mobile-Optimized 2x2 Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: '🏠 Home Live', count: homeCount, color: '#60a5fa', bg: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.3)' },
          { label: '📑 PDF Live', count: pdfCount, color: '#34d399', bg: 'rgba(5,150,105,0.12)', border: 'rgba(5,150,105,0.3)' },
          { label: '🔥 Dhamaka', count: dhamakaCount, color: '#fbbf24', bg: 'rgba(217,119,6,0.12)', border: 'rgba(217,119,6,0.3)' },
          { label: '📋 Total Posters', count: items.length, color: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.3)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 800 }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: '1.45rem', fontWeight: 900, lineHeight: 1.15, marginTop: 2 }}>{stat.count}</div>
          </div>
        ))}
      </div>

      {/* ── Mobile Horizontal Scrollable Filter Tabs ── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {FILTER_TABS.map(ft => (
          <button key={ft.id} onClick={() => setFilterTab(ft.id)} style={{
            background: filterTab === ft.id ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${filterTab === ft.id ? '#60a5fa' : 'rgba(255,255,255,0.12)'}`,
            color: filterTab === ft.id ? '#ffffff' : '#94a3b8',
            padding: '8px 16px', borderRadius: 20, fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
            whiteSpace: 'nowrap', flexShrink: 0, boxShadow: filterTab === ft.id ? '0 2px 8px rgba(37,99,235,0.4)' : 'none'
          }}>{ft.label}</button>
        ))}
      </div>

      {/* ── Mobile Responsive Cards Grid ── */}
      {loading ? (
        <Loader />
      ) : filteredItems.length === 0 ? (
        <Empty msg="કોઈ પોસ્ટર / ઑફર મળ્યા નથી. ઉપરના બટન પર ક્લિક કરીને નવું ઉમેરો." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 14 }}>
          {filteredItems.map(item => {
            const isHome = item.showInHome !== false;
            const isPdf  = item.showInPdf  !== false;
            const isLive = item.isActive   !== false;
            return (
              <div key={item.id} style={{
                background: '#1e293b', borderRadius: 14,
                border: isLive ? '1.5px solid rgba(59,130,246,0.3)' : '1px dashed rgba(255,255,255,0.1)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                opacity: isLive ? 1 : 0.6, transition: 'all 0.2s'
              }}>

                {/* Card Top Bar */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: item.category === 'CAROUSEL' ? 'rgba(37,99,235,0.2)' : 'rgba(217,119,6,0.2)', color: item.category === 'CAROUSEL' ? '#60a5fa' : '#fbbf24', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, border: `1px solid ${item.category === 'CAROUSEL' ? 'rgba(37,99,235,0.4)' : 'rgba(217,119,6,0.4)'}` }}>
                      {item.category === 'CAROUSEL' ? '🎠 Carousel' : '🔥 Dhamaka'}
                    </span>
                    {item.badge && <span style={{ background: item.tagColor || '#f59e0b', color: 'white', fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px', borderRadius: 10 }}>{item.badge}</span>}
                    {item.couponCode && <span style={{ background: 'rgba(245,158,11,0.15)', border: '1px dashed rgba(245,158,11,0.5)', color: '#fbbf24', fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 5, fontFamily: 'monospace' }}>🎟️ {item.couponCode}</span>}
                  </div>

                  {/* 2 Independent Toggle Buttons */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => toggleField(item, 'showInHome')} style={{
                      background: isHome ? 'rgba(37,99,235,0.2)' : 'rgba(148,163,184,0.1)',
                      border: `1px solid ${isHome ? '#3b82f6' : '#475569'}`,
                      color: isHome ? '#93c5fd' : '#64748b',
                      padding: '3px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
                    }} title="Homepage Carousel ON/OFF">
                      🏠 {isHome ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => toggleField(item, 'showInPdf')} style={{
                      background: isPdf ? 'rgba(5,150,105,0.2)' : 'rgba(148,163,184,0.1)',
                      border: `1px solid ${isPdf ? '#10b981' : '#475569'}`,
                      color: isPdf ? '#6ee7b7' : '#64748b',
                      padding: '3px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
                    }} title="PDF Brochure ON/OFF">
                      📑 {isPdf ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Mobile Responsive Image Container */}
                <div onClick={() => item.imageUrl && setZoomImg(item.imageUrl)} style={{ height: 170, background: '#0b1120', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: item.imageUrl ? 'zoom-in' : 'default', position: 'relative' }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#0f172a' }} onError={e => { e.target.src = '/images/logo.jpg'; }} />
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700 }}>🖼️ ઇમેજ નથી (Edit પર ક્લિક કરી ફોટો ઉમેરો)</div>
                  )}
                  {item.imageUrl && (
                    <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#93c5fd', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                      🔍 Zoom
                    </span>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '12px 14px', flex: 1 }}>
                  <h3 style={{ color: 'white', fontWeight: 900, fontSize: '0.92rem', margin: '0 0 4px', lineHeight: 1.3 }}>{item.title}</h3>
                  {item.subtitle && <div style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>{item.subtitle}</div>}
                  {(item.price || item.oldPrice) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      {item.oldPrice && <span style={{ textDecoration: 'line-through', color: '#64748b', fontSize: '0.82rem' }}>{item.oldPrice}</span>}
                      {item.price && <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '1.05rem' }}>{item.price}</span>}
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => toggleField(item, 'isActive')} style={{ background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)', border: `1px solid ${isLive ? 'rgba(34,197,94,0.4)' : 'rgba(100,116,139,0.3)'}`, color: isLive ? '#4ade80' : '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}>
                    {isLive ? '🟢 Live' : '⚪ Hidden'}
                  </button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(item)} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd', padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Edit3 size={11} /> Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 14, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#131c2e', borderRadius: 18, maxWidth: 560, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: `1.5px solid ${mc.border}`, boxShadow: '0 25px 60px rgba(0,0,0,0.8)', overflow: 'hidden' }}>

            {/* Modal Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: mc.bg }}>
              <div>
                <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1rem', margin: 0 }}>
                  {editingItem ? '✏️ પોસ્ટર સુધારો' : mc.title + ' ઉમેરો'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.73rem', margin: '2px 0 0' }}>
                  {editingItem
                    ? 'ફેરફાર કરીને Save કરો'
                    : modalMode === 'HOME'
                      ? '🌐 Homepage Carousel Slider પર દેખાશે'
                      : modalMode === 'PDF'
                        ? '📄 Student Answer Sheet PDF Catalog (2×2) માં દેખાશે'
                        : '💥 Coupon code અને Discount offer'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* ── IF PDF BROCHURE MODE: ONLY IMAGE UPLOAD! ── */}
              {modalMode === 'PDF' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Large Direct Image Picker Only */}
                  <div>
                    <label style={{ display: 'block', color: '#6ee7b7', fontSize: '0.88rem', fontWeight: 900, marginBottom: 8, textAlign: 'center' }}>
                      📸 માત્ર પોસ્ટર ફોટો પસંદ કરો (Only Upload Poster Image) *
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2.5px dashed #10b981',
                        borderRadius: 14,
                        padding: filePreview ? '14px' : '36px 20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(5,150,105,0.08)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 220
                      }}
                    >
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                      
                      {filePreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
                          <img
                            src={filePreview}
                            alt="Selected Poster"
                            style={{ maxHeight: 260, maxWidth: '100%', borderRadius: 8, objectFit: 'contain', boxShadow: '0 6px 20px rgba(0,0,0,0.5)', border: '1.5px solid rgba(16,185,129,0.4)' }}
                          />
                          <div style={{ background: '#059669', color: '#ffffff', padding: '6px 18px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            🔄 બીજો ફોટો બદલવા અહીં ક્લિક કરો
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: '3rem', marginBottom: 2 }}>🖼️</div>
                          <div style={{ color: '#6ee7b7', fontSize: '1.05rem', fontWeight: 900 }}>
                            કમ્પ્યુટર / મોબાઇલમાંથી Poster Image સિલેક્ટ કરો
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            (PNG / JPG / JPEG • વિદ્યાર્થીની PDF Answer Sheet માં આખું પોસ્ટર ડાયરેક્ટ દેખાશે)
                          </div>
                          <div style={{ marginTop: 8, background: '#059669', color: 'white', padding: '9px 22px', borderRadius: 10, fontSize: '0.86rem', fontWeight: 900, boxShadow: '0 4px 12px rgba(5,150,105,0.4)' }}>
                            👆 Choose File / ફોટો પસંદ કરો
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PDF Live Active Switch */}
                  <div style={{ background: 'rgba(5,150,105,0.12)', border: '1.5px solid rgba(5,150,105,0.35)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6ee7b7', fontWeight: 900, fontSize: '0.86rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                        style={{ accentColor: '#10b981', width: 18, height: 18 }}
                      />
                      🟢 વિદ્યાર્થી Answer Sheet PDF માં Live રાખો
                    </label>
                  </div>

                </div>
              ) : (
                /* ── STANDARD / HOMEPAGE / DHAMAKA FORM ── */
                <>
                  {/* Title */}
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>📌 Title (Course Name) *</label>
                    <input className="input-dark" placeholder="e.g. TET-2 ગણિત સ્પેશિયલ" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                  </div>

                  {/* Subtitle */}
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>🏷️ Subtitle</label>
                    <input className="input-dark" placeholder="e.g. MCQ Test Series + Practice PDF" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
                  </div>

                  {/* Price Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>💰 Price (e.g. ₹149)</label>
                      <input className="input-dark" placeholder="₹149" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>🏷️ Old Price (Cut)</label>
                      <input className="input-dark" placeholder="₹299" value={form.oldPrice} onChange={e => setForm(f => ({ ...f, oldPrice: e.target.value }))} />
                    </div>
                  </div>

                  {/* Coupon Code (only for DHAMAKA) */}
                  {(form.category === 'DHAMAKA_OFFER' || modalMode === 'DHAMAKA') && (
                    <div>
                      <label style={{ display: 'block', color: '#fbbf24', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>🎟️ Coupon Code</label>
                      <input className="input-dark" placeholder="e.g. TET50" value={form.couponCode} onChange={e => setForm(f => ({ ...f, couponCode: e.target.value }))} style={{ fontFamily: 'monospace', letterSpacing: 2 }} />
                    </div>
                  )}

                  {/* Image Upload */}
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 6 }}>🖼️ Poster Image</label>
                    <div onClick={() => fileInputRef.current?.click()} style={{ border: '1.5px dashed rgba(59,130,246,0.4)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', background: 'rgba(30,58,138,0.08)' }}>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                      {filePreview ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <img src={filePreview} alt="Preview" style={{ maxHeight: 90, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
                          <span style={{ color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700 }}>🔄 ઇમેજ બદલવા ક્લિક કરો</span>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📸</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Photo Select કરો (PNG/JPG)</div>
                        </div>
                      )}
                    </div>
                    <input className="input-dark" placeholder="અથવા Image URL type કરો" value={form.imageUrl} onChange={e => { setForm(f => ({ ...f, imageUrl: e.target.value })); setFilePreview(e.target.value); }} style={{ marginTop: 6, fontSize: '0.75rem' }} />
                  </div>

                  {/* WhatsApp Message */}
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.76rem', fontWeight: 700, marginBottom: 4 }}>📲 WhatsApp Order Message</label>
                    <input className="input-dark" placeholder="e.g. TET-2 Maths ₹149 અંગે info આપો" value={form.waMessage} onChange={e => setForm(f => ({ ...f, waMessage: e.target.value }))} />
                  </div>

                  {/* Placement Checkboxes */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#93c5fd', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.showInHome} onChange={e => setForm(f => ({ ...f, showInHome: e.target.checked }))} style={{ accentColor: '#3b82f6', width: 16, height: 16 }} />
                      🏠 Homepage Carousel
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6ee7b7', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.showInPdf} onChange={e => setForm(f => ({ ...f, showInPdf: e.target.checked }))} style={{ accentColor: '#10b981', width: 16, height: 16 }} />
                      📑 PDF Brochure Catalog
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} style={{ accentColor: '#22c55e', width: 16, height: 16 }} />
                      🟢 Active/Live
                    </label>
                  </div>
                </>
              )}

              {/* Footer Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', padding: '9px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.84rem', fontFamily: 'Hind Vadodara, sans-serif' }}>રદ</button>
                <button type="submit" disabled={saving} style={{ background: saving ? '#374151' : `linear-gradient(135deg, ${mc.color}, ${mc.color}bb)`, color: 'white', border: 'none', padding: '9px 22px', borderRadius: 8, fontWeight: 900, fontSize: '0.86rem', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'Hind Vadodara, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {saving ? '⏳ Saving...' : editingItem ? '💾 Save Changes' : modalMode === 'PDF' ? '🚀 PDF માં લાઈવ કરો' : '🚀 Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Image Zoom Modal ── */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '100%', background: '#131c2e', borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(59,130,246,0.3)' }}>
            <div style={{ padding: '10px 14px', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>🖼️ Poster Preview</span>
              <button onClick={() => setZoomImg(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <img src={zoomImg} alt="Zoom" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', background: '#0b1120' }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────── */

function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{title}</h3>
      {action && <button onClick={onAction} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>{action}</button>}
    </div>
  );
}

function Loader() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Loading...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📭</div>
      <p style={{ fontFamily: 'Hind Vadodara, sans-serif' }}>{msg}</p>
    </div>
  );
}
