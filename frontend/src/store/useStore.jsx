import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { checkSession } from '../services/api';
import { ShieldAlert, LogOut } from 'lucide-react';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  // ─── Auth State ────────────────────────────────────────────
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; }
    catch { return null; }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isTeacher, setIsTeacher] = useState(() => localStorage.getItem('role') === 'teacher');
  const [sessionAlert, setSessionAlert] = useState(() => sessionStorage.getItem('session_terminated_msg') || null);

  // ─── Teacher Profile ───────────────────────────────────────
  const [teacherProfile, setTeacherProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('teacherProfile')) || {
      name: 'Teacher',
      subject: 'TET-2',
      phone: '8200405300',
      academy: 'Trinetra Online Academy',
      qualification: 'B.Ed.',
      experience: '5+ Years',
    }; }
    catch { return { name: 'Teacher', subject: 'TET-2', phone: '8200405300', academy: 'Trinetra Online Academy', qualification: 'B.Ed.', experience: '5+ Years' }; }
  });

  const saveTeacherProfile = useCallback((data) => {
    setTeacherProfile(data);
    localStorage.setItem('teacherProfile', JSON.stringify(data));
  }, []);

  // ─── Exam State ────────────────────────────────────────────
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: { selectedOpt, answerText } }
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // ─── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Auth Actions ──────────────────────────────────────────
  const loginStudent = useCallback((userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setIsTeacher(false);
    setSessionAlert(null);
    sessionStorage.removeItem('session_terminated_msg');
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('role', 'student');
  }, []);

  const loginTeacher = useCallback((jwtToken) => {
    setIsTeacher(true);
    setToken(jwtToken);
    setSessionAlert(null);
    sessionStorage.removeItem('session_terminated_msg');
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('role', 'teacher');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsTeacher(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
  }, []);

  // ─── Single Device Session Listener & Heartbeat ────────────
  useEffect(() => {
    const handleSessionTerminated = (e) => {
      const msg = e.detail || '⚠️ તમારું એકાઉન્ટ અન્ય ડિવાઇસમાં લોગિન થયું છે. સુરક્ષા માટે આ ડિવાઇસમાંથી લોગઆઉટ કરવામાં આવ્યું છે.';
      setSessionAlert(msg);
      logout();
    };

    window.addEventListener('session-terminated', handleSessionTerminated);
    return () => window.removeEventListener('session-terminated', handleSessionTerminated);
  }, [logout]);

  // Periodic heartbeat session check (every 25 seconds for logged-in students)
  useEffect(() => {
    if (!token || !user || isTeacher) return;

    const interval = setInterval(() => {
      checkSession().catch((err) => {
        if (err.response?.data?.code === 'SESSION_TERMINATED') {
          const msg = err.response.data.error;
          setSessionAlert(msg);
          logout();
        }
      });
    }, 25000);

    return () => clearInterval(interval);
  }, [token, user, isTeacher, logout]);

  // ─── Exam Actions ──────────────────────────────────────────
  const startExam = useCallback((qs) => {
    setQuestions(qs);
    setCurrentIndex(0);
    setAnswers({});
    setExamStarted(true);
    setExamFinished(false);
    setLastResult(null);
  }, []);

  const recordAnswer = useCallback((questionId, data) => {
    setAnswers(prev => ({ ...prev, [questionId]: data }));
  }, []);

  const resumeExam = useCallback((qs, savedIdx = 0, savedAns = {}) => {
    setQuestions(qs);
    setCurrentIndex(savedIdx || 0);
    setAnswers(savedAns || {});
    setExamStarted(true);
    setExamFinished(false);
    setLastResult(null);
  }, []);

  const finishExam = useCallback((result) => {
    setExamFinished(true);
    setExamStarted(false);
    setLastResult(result);
  }, []);

  const resetExam = useCallback(() => {
    setExamStarted(false);
    setExamFinished(false);
    setCurrentIndex(0);
    setAnswers({});
    setLastResult(null);
    setQuestions([]);
  }, []);

  const handleDismissAlert = () => {
    setSessionAlert(null);
    sessionStorage.removeItem('session_terminated_msg');
    window.location.href = '/student';
  };

  return (
    <StoreContext.Provider value={{
      // Auth
      user, token, isTeacher,
      loginStudent, loginTeacher, logout,
      // Teacher Profile
      teacherProfile, saveTeacherProfile,
      // Exam
      questions, setQuestions,
      currentIndex, setCurrentIndex,
      answers, recordAnswer, setAnswers,
      examStarted, examFinished, lastResult,
      startExam, resumeExam, finishExam, resetExam,
      // Toast
      toast, showToast,
    }}>
      {children}

      {/* ── Single Device Session Terminated Security Modal ── */}
      {sessionAlert && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: 16, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: '#131c2e',
            border: '2px solid rgba(239,68,68,0.5)',
            borderRadius: 18,
            maxWidth: 460,
            width: '100%',
            padding: '28px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(239,68,68,0.2)',
            animation: 'fadeIn 0.25s ease-out'
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)',
              border: '1.5px solid rgba(239,68,68,0.4)',
              color: '#f87171',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '2rem'
            }}>
              <ShieldAlert size={32} />
            </div>

            <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.25rem', marginBottom: 10 }}>
              સુરક્ષા એલર્ટ: અન્ય ડિવાઇસમાં લોગિન થયું છે!
            </h3>

            <p className="gu-text" style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.65, marginBottom: 20 }}>
              {sessionAlert}
            </p>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 22, textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>
              🔒 <strong>સુરક્ષા નિયમ:</strong> Trinetra Academy માં એક સમયે માત્ર ૧ જ મોબાઈલ/કમ્પ્યુટરમાં લોગિન રહી શકાય છે જેથી તમારું એકાઉન્ટ સુરક્ષિત રહે.
            </div>

            <button
              onClick={handleDismissAlert}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                fontFamily: 'Hind Vadodara, sans-serif'
              }}
            >
              🔐 સમજાઈ ગયું / ફરી લોગિન કરો
            </button>
          </div>
        </div>,
        document.body
      )}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
};

