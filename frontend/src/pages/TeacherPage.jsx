import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { teacherRequestOTP, teacherVerifyOTP } from '../services/api';
import TeacherDashboard from '../components/TeacherDashboard';
import { ShieldCheck, Lock, Key, User, ArrowLeft, Smartphone, CheckCircle } from 'lucide-react';

export default function TeacherPage() {
  const { isTeacher, loginTeacher } = useStore();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [form, setForm] = useState({ username: '', password: '', masterPin: '', otp: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [adminMobile, setAdminMobile] = useState('8200405300');
  const [otpCooldown, setOtpCooldown] = useState(0);

  // OTP Cooldown Countdown Timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // ─── Step 1: Validate Credentials + PIN -> Request 2FA OTP ──
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (form.masterPin.length !== 6) {
      setError('⚠️ કૃપા કરીને 6-અંકનો સિક્રેટ Master PIN દાખલ કરો.');
      return;
    }

    setLoading(true);
    try {
      const res = await teacherRequestOTP(form.username, form.password, form.masterPin);
      if (res.data.devOtp) setDevOtp(res.data.devOtp);
      if (res.data.adminMobile) setAdminMobile(res.data.adminMobile);
      setStep('otp');
      setOtpCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || '❌ ખોટું Username, Password અથવા Master PIN!');
    }
    setLoading(false);
  };

  // ─── Step 2: Verify 2FA OTP -> Access Dashboard ─────────────
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');

    if (form.otp.length !== 6) {
      setError('⚠️ કૃપા કરીને 6-અંકનો 2FA OTP દાખલ કરો.');
      return;
    }

    setLoading(true);
    try {
      const res = await teacherVerifyOTP(form.username, form.otp);
      loginTeacher(res.data.token);
    } catch (err) {
      setError(err.response?.data?.error || '❌ ખોટો 2FA OTP દાખલ કર્યો છે.');
    }
    setLoading(false);
  };

  if (isTeacher) return <TeacherDashboard />;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #070d1a 0%, #0f172a 45%, #1e3a8a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient background glow */}
      <div style={{ position: 'absolute', top: -80, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,6,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="card animate-fade-in" style={{
        maxWidth: 460,
        width: '100%',
        padding: '36px 30px',
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        border: '1.5px solid rgba(255,255,255,0.2)',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: '1.8rem',
            color: 'white',
            boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
            border: '2px solid rgba(255,255,255,0.2)'
          }}>
            👑
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            ત્રિનેત્ર સુરક્ષિત એડમિન પોર્ટલ
          </h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1e40af', padding: '3px 10px', borderRadius: 20, fontSize: '0.74rem', fontWeight: 800, marginTop: 6, border: '1px solid #bfdbfe' }}>
            <ShieldCheck size={13} /> {step === 'credentials' ? 'સ્ટેપ ૧: Credentials & Master PIN' : 'સ્ટેપ ૨: 2FA એડમિન OTP'}
          </div>
        </div>

        {step === 'credentials' ? (
          /* ─── STEP 1: USERNAME + PASSWORD + MASTER PIN ─── */
          <form onSubmit={handleRequestOTP}>
            
            {/* 1. Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <User size={14} color="#2563eb" /> એડમિન યુઝરનેમ (Username) *
              </label>
              <input
                className="input-field"
                placeholder="દા.ત. admin@123"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                style={{ padding: '11px 14px', borderRadius: 10, fontSize: '0.92rem' }}
                required
              />
            </div>

            {/* 2. Password */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <Lock size={14} color="#2563eb" /> ગુપ્ત પાસવર્ડ (Password) *
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{ padding: '11px 14px', borderRadius: 10, fontSize: '0.92rem' }}
                required
              />
            </div>

            {/* 3. 6-Digit Master Security PIN */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, fontSize: '0.84rem', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Key size={14} color="#d97706" /> ૬-અંકનો સિક્રેટ Master PIN *
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Default: 820040</span>
              </label>
              <input
                className="input-field"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="•••••• (6 Digits PIN)"
                value={form.masterPin}
                onChange={e => setForm(f => ({ ...f, masterPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                style={{
                  padding: '11px 14px',
                  borderRadius: 10,
                  fontSize: '1.2rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  border: '1.5px solid #f59e0b',
                  background: '#fffbeb'
                }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: '0.86rem',
                fontWeight: 700,
                marginBottom: 16,
                border: '1.5px solid #fca5a5',
                lineHeight: 1.4
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '13px',
                fontSize: '1rem',
                fontWeight: 900,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                boxShadow: '0 6px 20px rgba(37,99,235,0.35)'
              }}
              disabled={loading}
            >
              {loading ? '⏳ સુરક્ષા ચકાસણી...' : '🔐 વિગતો ચકાસો અને 2FA OTP મેળવો →'}
            </button>
          </form>
        ) : (
          /* ─── STEP 2: 2FA SECURITY OTP ─── */
          <form onSubmit={handleVerify2FA}>
            
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 16,
              textAlign: 'center',
              color: '#15803d'
            }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>
                📲 ડિરેક્ટર મોબાઈલ <strong style={{ color: '#14532d' }}>{adminMobile}</strong> પર 2FA OTP મોકલ્યો છે
              </div>
              <div style={{ fontSize: '0.74rem', color: '#166534', marginTop: 3 }}>
                સુરક્ષા પુષ્ટિ માટે OTP દાખલ કરો
              </div>
            </div>

            {devOtp && (
              <div style={{
                background: '#fef3c7',
                border: '1.5px solid #fde68a',
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: '0.9rem',
                color: '#92400e',
                fontWeight: 900,
                textAlign: 'center'
              }}>
                🔧 Dev Mode Admin OTP: <span style={{ letterSpacing: '2px' }}>{devOtp}</span>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <Smartphone size={14} color="#2563eb" /> ૬-અંકનો 2FA Security OTP *
              </label>
              <input
                className="input-field"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-Digit OTP"
                value={form.otp}
                onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  fontSize: '1.4rem',
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  fontWeight: 900,
                  border: '1.5px solid #2563eb',
                  background: '#f8fafc'
                }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 10,
                fontSize: '0.86rem',
                fontWeight: 700,
                marginBottom: 16,
                border: '1.5px solid #fca5a5',
                lineHeight: 1.4
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '13px',
                fontSize: '1rem',
                fontWeight: 900,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                boxShadow: '0 6px 20px rgba(16,185,129,0.35)'
              }}
              disabled={loading}
            >
              {loading ? '⏳ ઓથેન્ટિકેશન...' : '👑 સિક્યોર એડમિન પ્રવેશ કરો (Unlock Dashboard)'}
            </button>

            {/* Bottom Actions: Resend OTP & Back */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: '0.86rem' }}>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 700 }}
              >
                ← Credentials બદલો
              </button>

              {otpCooldown > 0 ? (
                <span style={{ color: '#b45309', fontWeight: 800, background: '#fef3c7', padding: '3px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                  ⏱️ {otpCooldown}s પછી Resend
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 800 }}
                >
                  🔄 ફરીથી 2FA OTP મોકલો
                </button>
              )}
            </div>

          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 22, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <a href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.86rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> હોમ પેજ પર પાછા જાઓ
          </a>
        </div>

      </div>
    </div>
  );
}
