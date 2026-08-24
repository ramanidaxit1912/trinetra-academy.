import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { teacherRequestOTP, teacherVerifyOTP } from '../services/api';
import TeacherDashboard from '../components/TeacherDashboard';
import { ShieldCheck, Lock, Key, User, ArrowLeft, Smartphone, CheckCircle, Sparkles, Fingerprint, Award } from 'lucide-react';

export default function TeacherPage() {
  const { isTeacher, loginTeacher } = useStore();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [form, setForm] = useState({ username: '', password: '', masterPin: '', otp: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [adminMobile, setAdminMobile] = useState('8200405300');
  const [otpCooldown, setOtpCooldown] = useState(0);

  // 3D Card Tilt Physics State
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);

  // Mouse move handler for luxury 3D Gyro Tilt
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTilt({
      x: -(y / 25).toFixed(2),
      y: (x / 25).toFixed(2)
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // OTP Cooldown Countdown Timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const [isVaultOpening, setIsVaultOpening] = useState(false);
  const [showWarpDashboard, setShowWarpDashboard] = useState(false);

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

  // ─── Step 2: Verify 2FA OTP -> Trigger Vault Shatter & Dimensional Warp ───
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
      
      // 🌟 Trigger 3. "Shatter Vault Doors & Dimensional Warp" Sequence
      setIsVaultOpening(true);

      // Play high-tech audio effect via AudioContext
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
      } catch (err) {}

      setTimeout(() => {
        loginTeacher(res.data.token);
        setShowWarpDashboard(true);
      }, 1250);

    } catch (err) {
      setError(err.response?.data?.error || '❌ ખોટો 2FA OTP દાખલ કર્યો છે.');
      setLoading(false);
    }
  };

  if (isTeacher) {
    return (
      <div className={showWarpDashboard ? 'dimensional-warp-entry' : ''}>
        <TeacherDashboard />
      </div>
    );
  }

  return (
    <div
      className="teacher-matrix-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 🌟 Floating Ambient Glow Orbs */}
      <div style={{ position: 'absolute', top: '-10%', right: '15%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(234,179,8,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* 👑 3D TILT FROSTED GLASS VAULT CARD (SPLITTABLE DOORS) */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`animate-fade-in tilt-3d-card ${isVaultOpening ? 'vault-door-left-anim' : ''}`}
        style={{
          maxWidth: 480,
          width: '100%',
          padding: '38px 30px',
          background: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isVaultOpening
            ? '0 0 80px rgba(34, 197, 94, 0.8), 0 0 120px rgba(234, 179, 8, 0.5)'
            : '0 30px 70px rgba(0, 0, 0, 0.8), 0 0 40px rgba(37, 99, 235, 0.2)',
          position: 'relative',
          zIndex: 1,
          transform: isVaultOpening ? undefined : `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          overflow: 'hidden'
        }}
      >
        {/* Biometric Laser Scanner Line in Step 2 */}
        {step === 'otp' && <div className="biometric-scan-line" />}

        {/* 🌟 1. Cyber Golden Shield with Official Trinetra Academy Logo & Supernova on Unlock */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            className={`teacher-cyber-shield ${isVaultOpening ? 'vault-logo-supernova-anim' : ''}`}
            style={{
              background: '#ffffff',
              padding: 6,
              overflow: 'hidden',
              boxShadow: isVaultOpening ? '0 0 50px #4ade80' : undefined
            }}
          >
            <div className="teacher-shield-ring" />
            <div className="teacher-shield-ring-reverse" />
            <img
              src="/trinetra-logo.png"
              alt="Trinetra Online Academy Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: 16,
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))'
              }}
            />
          </div>

          <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: '#ffffff', margin: '6px 0 0 0', letterSpacing: '-0.02em', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {isVaultOpening ? '🔓 ACCESS GRANTED: વૉલ્ટ અનલોક થઈ રહ્યું છે...' : 'ત્રિનેત્ર સુરક્ષિત એડમિન પોર્ટલ'}
          </h2>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: isVaultOpening ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.12)', color: isVaultOpening ? '#4ade80' : '#38bdf8', border: `1px solid ${isVaultOpening ? '#22c55e' : 'rgba(56,189,248,0.3)'}`, padding: '4px 14px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 800, marginTop: 8 }}>
            <ShieldCheck size={14} color={isVaultOpening ? '#4ade80' : '#38bdf8'} />
            {isVaultOpening ? '🌟 BIOMETRIC SUCCESSFUL' : step === 'credentials' ? 'સ્ટેપ ૧: Credentials & Master PIN' : 'સ્ટેપ ૨: 2FA એડમિન OTP ઓથેન્ટિકેશન'}
          </div>
        </div>

        {step === 'credentials' ? (
          /* ─── STEP 1: USERNAME + PASSWORD + 6-PIN PODS ─── */
          <form onSubmit={handleRequestOTP}>
            
            {/* 1. Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <User size={14} color="#38bdf8" /> એડમિન યુઝરનેમ (Username) *
              </label>
              <input
                className="input-dark"
                placeholder="દા.ત. admin@123"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: '0.94rem',
                  background: 'rgba(2, 6, 23, 0.65)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: 'white'
                }}
                required
              />
            </div>

            {/* 2. Password */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontWeight: 700, fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Lock size={14} color="#38bdf8" /> ગુપ્ત પાસવર્ડ (Password) *
              </label>
              <input
                className="input-dark"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: '0.94rem',
                  background: 'rgba(2, 6, 23, 0.65)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: 'white'
                }}
                required
              />
            </div>

            {/* 3. 6-Digit Master Security PIN Pods */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#fde047', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={14} color="#eab308" /> ૬-અંકનો સિક્રેટ Master PIN *
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Default: 820040</span>
              </label>

              {/* Interactive Visual PIN Pods */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                  marginBottom: 10,
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('master-pin-hidden-input')?.focus()}
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const digit = form.masterPin[idx] || '';
                  const isActive = form.masterPin.length === idx;
                  const isFilled = Boolean(digit);
                  return (
                    <div
                      key={idx}
                      className={`pin-pod-box ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
                    >
                      {isFilled ? '●' : isActive ? '│' : ''}
                    </div>
                  );
                })}
              </div>

              {/* Hidden Real Input for Keyboard capture */}
              <input
                id="master-pin-hidden-input"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={form.masterPin}
                onChange={e => setForm(f => ({ ...f, masterPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  top: 0,
                  left: 0
                }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                padding: '11px 14px',
                borderRadius: 12,
                fontSize: '0.86rem',
                fontWeight: 700,
                marginBottom: 18,
                border: '1px solid rgba(239, 68, 68, 0.4)',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>❌</span> {error}
              </div>
            )}

            {/* 🌟 Shimmer Action Button */}
            <button
              type="submit"
              className="admin-shimmer-btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 900,
                borderRadius: 14,
                color: 'white',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #2563eb 100%)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 25px rgba(37,99,235,0.45)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Hind Vadodara, sans-serif'
              }}
              disabled={loading}
            >
              {loading ? (
                <>⏳ સુરક્ષા ચકાસણી...</>
              ) : (
                <>🔐 વિગતો ચકાસો અને 2FA OTP મેળવો ➔</>
              )}
            </button>
          </form>
        ) : (
          /* ─── STEP 2: 2FA SECURITY OTP WITH SCANNER ─── */
          <form onSubmit={handleVerify2FA}>
            
            <div style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: 14,
              padding: '14px',
              marginBottom: 18,
              textAlign: 'center',
              color: '#86efac'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Fingerprint size={18} color="#4ade80" /> 2FA બાયોમેટ્રિક ઓથેન્ટિકેશન
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 4 }}>
                ડિરેક્ટર મોબાઈલ <strong style={{ color: '#4ade80' }}>{adminMobile}</strong> પર OTP મોકલાયો છે.
              </div>
            </div>

            {devOtp && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 18,
                fontSize: '0.9rem',
                color: '#fef08a',
                fontWeight: 900,
                textAlign: 'center'
              }}>
                🔧 Dev Mode Admin OTP: <span style={{ letterSpacing: '3px', color: '#facc15' }}>{devOtp}</span>
              </div>
            )}

            {/* Visual OTP Input Pods */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontWeight: 800, fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Smartphone size={14} color="#4ade80" /> ૬-અંકનો 2FA Security OTP દાખલ કરો *
              </label>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                  marginBottom: 10,
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('admin-otp-hidden-input')?.focus()}
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const digit = form.otp[idx] || '';
                  const isActive = form.otp.length === idx;
                  const isFilled = Boolean(digit);
                  return (
                    <div
                      key={idx}
                      className={`pin-pod-box ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
                      style={{
                        borderColor: isFilled ? '#22c55e' : isActive ? '#38bdf8' : 'rgba(255,255,255,0.15)',
                        color: isFilled ? '#4ade80' : 'white',
                        background: isFilled ? 'rgba(34, 197, 94, 0.15)' : undefined
                      }}
                    >
                      {isFilled ? digit : isActive ? '│' : ''}
                    </div>
                  );
                })}
              </div>

              <input
                id="admin-otp-hidden-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={form.otp}
                onChange={e => setForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  top: 0,
                  left: 0
                }}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                padding: '11px 14px',
                borderRadius: 12,
                fontSize: '0.86rem',
                fontWeight: 700,
                marginBottom: 18,
                border: '1px solid rgba(239, 68, 68, 0.4)',
                lineHeight: 1.4
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="admin-shimmer-btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 900,
                borderRadius: 14,
                color: 'white',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #22c55e 100%)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 8px 25px rgba(16,185,129,0.45)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Hind Vadodara, sans-serif'
              }}
              disabled={loading}
            >
              {loading ? '⏳ ઓથેન્ટિકેશન...' : '👑 સિક્યોર એડમિન પ્રવેશ કરો (Unlock Dashboard)'}
            </button>

            {/* Bottom Actions: Resend OTP & Back */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, fontSize: '0.86rem' }}>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 700 }}
              >
                ← Credentials બદલો
              </button>

              {otpCooldown > 0 ? (
                <span style={{ color: '#fde047', fontWeight: 800, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', padding: '4px 10px', borderRadius: 8, fontSize: '0.78rem' }}>
                  ⏱️ {otpCooldown}s પછી Resend
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontWeight: 800 }}
                >
                  🔄 ફરીથી 2FA OTP મોકલો
                </button>
              )}
            </div>

          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.86rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.2s' }}>
            <ArrowLeft size={14} /> હોમ પેજ પર પાછા જાઓ
          </a>
        </div>

      </div>
    </div>
  );
}
