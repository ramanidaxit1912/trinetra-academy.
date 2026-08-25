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

      {/* 🔬📐 FLOATING MATHEMATICS & SCIENCE EQUATIONS BACKGROUND ANIMATIONS (25 Rich Medium-Speed Drift Formulas) */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        
        {/* 1. Math: Quadratic Formula */}
        <div className="floating-equation-item" style={{ top: '10%', left: '6%', color: 'rgba(56, 189, 248, 0.45)', fontSize: 'clamp(0.95rem, 1.8vw, 1.35rem)', animation: 'floatFormulaDrift1 18s ease-in-out infinite' }}>
          📐 x = (-b ± √(b² - 4ac)) / 2a
        </div>

        {/* 2. Science: Einstein's Mass-Energy */}
        <div className="floating-equation-item" style={{ top: '18%', right: '8%', color: 'rgba(250, 204, 21, 0.45)', fontSize: 'clamp(1rem, 2vw, 1.5rem)', animation: 'floatFormulaDrift2 22s ease-in-out infinite' }}>
          ⚡ E = mc²  •  ⚛️ F = ma
        </div>

        {/* 3. Math: Pythagoras & Trig Identity */}
        <div className="floating-equation-item" style={{ bottom: '16%', left: '5%', color: 'rgba(52, 211, 153, 0.45)', fontSize: 'clamp(0.95rem, 1.8vw, 1.35rem)', animation: 'floatFormulaDrift3 20s ease-in-out infinite' }}>
          🔺 a² + b² = c²  |  sin²θ + cos²θ = 1
        </div>

        {/* 4. Science: Chemistry Photosynthesis */}
        <div className="floating-equation-item" style={{ bottom: '14%', right: '7%', color: 'rgba(167, 139, 250, 0.45)', fontSize: 'clamp(0.9rem, 1.7vw, 1.3rem)', animation: 'floatFormulaDrift4 25s ease-in-out infinite' }}>
          🧪 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂
        </div>

        {/* 5. Math: Calculus & Euler Identity */}
        <div className="floating-equation-item" style={{ top: '44%', left: '3%', color: 'rgba(96, 165, 250, 0.38)', fontSize: 'clamp(1rem, 1.9vw, 1.45rem)', animation: 'floatFormulaDrift5 19s ease-in-out infinite' }}>
          ∫ eˣ dx = eˣ + C  •  e^(iπ) + 1 = 0
        </div>

        {/* 6. Science: Newton Universal Gravitation & Ohm's Law */}
        <div className="floating-equation-item" style={{ top: '50%', right: '4%', color: 'rgba(244, 114, 182, 0.42)', fontSize: 'clamp(0.95rem, 1.8vw, 1.35rem)', animation: 'floatFormulaDrift1 24s ease-in-out infinite' }}>
          🧲 F = G(m₁m₂)/r²  |  ⚡ V = I × R
        </div>

        {/* 7. Math: Circle Area & Velocity */}
        <div className="floating-equation-item" style={{ top: '5%', left: '42%', transform: 'translateX(-50%)', color: 'rgba(125, 211, 252, 0.35)', fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)', animation: 'floatFormulaDrift2 21s ease-in-out infinite' }}>
          ⭕ Area = πr²  •  v = u + at
        </div>

        {/* 8. Science: Ideal Gas & Heat Equation */}
        <div className="floating-equation-item" style={{ bottom: '5%', left: '48%', transform: 'translateX(-50%)', color: 'rgba(253, 224, 71, 0.4)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift3 23s ease-in-out infinite' }}>
          🧬 PV = nRT  •  Q = mcΔT
        </div>

        {/* 9. Physics: Kinetic Energy & Momentum */}
        <div className="floating-equation-item" style={{ top: '28%', left: '12%', color: 'rgba(74, 222, 128, 0.4)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift4 20s ease-in-out infinite' }}>
          🚀 KE = ½mv²  •  p = mv
        </div>

        {/* 10. Math: Logarithm & Exponent Rules */}
        <div className="floating-equation-item" style={{ top: '34%', right: '11%', color: 'rgba(192, 132, 252, 0.42)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift5 21s ease-in-out infinite' }}>
          📐 log(ab) = log a + log b
        </div>

        {/* 11. Chemistry: Acid-Base Neutralization & pH */}
        <div className="floating-equation-item" style={{ bottom: '26%', left: '10%', color: 'rgba(251, 146, 60, 0.4)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift1 26s ease-in-out infinite' }}>
          ⚗️ pH = -log[H⁺]  •  HCl + NaOH → NaCl + H₂O
        </div>

        {/* 12. Physics: Wave Speed & Frequency */}
        <div className="floating-equation-item" style={{ bottom: '32%', right: '9%', color: 'rgba(56, 189, 248, 0.42)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift2 19s ease-in-out infinite' }}>
          🌊 v = f × λ  •  T = 1 / f
        </div>

        {/* 13. Math: Binomial Theorem & Factorial */}
        <div className="floating-equation-item" style={{ top: '15%', left: '30%', color: 'rgba(234, 179, 8, 0.38)', fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)', animation: 'floatFormulaDrift3 22s ease-in-out infinite' }}>
          🔢 ⁿCᵣ = n! / (r!(n-r)!)
        </div>

        {/* 14. Physics: Work & Electric Power */}
        <div className="floating-equation-item" style={{ top: '20%', right: '28%', color: 'rgba(147, 197, 253, 0.4)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift4 24s ease-in-out infinite' }}>
          💡 P = V × I  •  W = F × d cosθ
        </div>

        {/* 15. Biology & Genetics: DNA Base Pairing */}
        <div className="floating-equation-item" style={{ bottom: '22%', left: '32%', color: 'rgba(134, 239, 172, 0.38)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift5 25s ease-in-out infinite' }}>
          🧬 DNA: A ═ T  •  G ≡ C  (Codon AUG)
        </div>

        {/* 16. Physics: Centripetal Force & Gravity */}
        <div className="floating-equation-item" style={{ bottom: '20%', right: '27%', color: 'rgba(249, 168, 212, 0.4)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift1 20s ease-in-out infinite' }}>
          🪐 F_c = (mv²)/r  •  g = 9.8 m/s²
        </div>

        {/* 17. Math: Arithmetic Progression (AP) */}
        <div className="floating-equation-item" style={{ top: '65%', left: '7%', color: 'rgba(129, 140, 248, 0.42)', fontSize: 'clamp(0.88rem, 1.6vw, 1.22rem)', animation: 'floatFormulaDrift2 23s ease-in-out infinite' }}>
          📈 aₙ = a + (n-1)d  •  Sₙ = ⁿ/₂(2a + (n-1)d)
        </div>

        {/* 18. Science: Respiration & ATP Energy */}
        <div className="floating-equation-item" style={{ top: '68%', right: '7%', color: 'rgba(252, 211, 77, 0.4)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift3 21s ease-in-out infinite' }}>
          ⚡ C₆H₁₂O₆ + 6O₂ → 6CO₂ + 38 ATP
        </div>

        {/* 19. Math: Coordinate Geometry Distance Formula */}
        <div className="floating-equation-item" style={{ top: '80%', left: '14%', color: 'rgba(56, 189, 248, 0.38)', fontSize: 'clamp(0.88rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift4 22s ease-in-out infinite' }}>
          📍 d = √((x₂ - x₁)² + (y₂ - y₁)²)
        </div>

        {/* 20. Physics: Pressure & Pascal's Law */}
        <div className="floating-equation-item" style={{ top: '82%', right: '15%', color: 'rgba(248, 113, 113, 0.4)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift5 24s ease-in-out infinite' }}>
          🌡️ P = F / A  •  Density ρ = m / V
        </div>

        {/* 21. Math: Matrices & Determinants */}
        <div className="floating-equation-item" style={{ top: '38%', left: '22%', color: 'rgba(167, 243, 208, 0.36)', fontSize: 'clamp(0.85rem, 1.5vw, 1.15rem)', animation: 'floatFormulaDrift1 25s ease-in-out infinite' }}>
          📊 det(AB) = det(A) × det(B)
        </div>

        {/* 22. Chemistry: Avogadro's Constant */}
        <div className="floating-equation-item" style={{ top: '42%', right: '22%', color: 'rgba(216, 180, 254, 0.38)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift2 20s ease-in-out infinite' }}>
          🔬 N_A = 6.022 × 10²³ mol⁻¹
        </div>

        {/* 23. Physics: Coulomb's Electrostatic Law */}
        <div className="floating-equation-item" style={{ bottom: '8%', left: '25%', color: 'rgba(253, 186, 116, 0.38)', fontSize: 'clamp(0.85rem, 1.5vw, 1.2rem)', animation: 'floatFormulaDrift3 23s ease-in-out infinite' }}>
          ⚡ F = k(q₁q₂)/r²  •  c = 3 × 10⁸ m/s
        </div>

        {/* 24. Math: Derivative of Sine & Cosine */}
        <div className="floating-equation-item" style={{ bottom: '9%', right: '24%', color: 'rgba(147, 197, 253, 0.4)', fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)', animation: 'floatFormulaDrift4 22s ease-in-out infinite' }}>
          📈 d/dx(sin x) = cos x  •  d/dx(ln x) = 1/x
        </div>

        {/* 25. Quantum Physics: Planck's Quantum Energy */}
        <div className="floating-equation-item" style={{ top: '2%', right: '3%', color: 'rgba(250, 204, 21, 0.42)', fontSize: 'clamp(0.95rem, 1.7vw, 1.3rem)', animation: 'floatFormulaDrift5 21s ease-in-out infinite' }}>
          ✨ E = hν  •  h = 6.626 × 10⁻³⁴ J·s
        </div>

        {/* ═══════════════════════════════════════════════════════
            📊 GRAPHS, CHARTS & SCIENTIFIC VISUAL DIAGRAMS (ANIMATED)
        ═══════════════════════════════════════════════════════ */}

        {/* 1. Visual Mini Bar Chart with Trending Graph Line */}
        <div className="floating-visual-graph" style={{ top: '24%', left: '20%', animation: 'floatFormulaDrift1 26s ease-in-out infinite' }}>
          <svg width="110" height="75" viewBox="0 0 110 75" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(56,189,248,0.4))' }}>
            <line x1="10" y1="65" x2="100" y2="65" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
            <line x1="10" y1="10" x2="10" y2="65" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
            <rect x="18" y="38" width="12" height="27" rx="3" fill="rgba(56,189,248,0.35)" />
            <rect x="36" y="24" width="12" height="41" rx="3" fill="rgba(99,102,241,0.45)" />
            <rect x="54" y="44" width="12" height="21" rx="3" fill="rgba(234,179,8,0.35)" />
            <rect x="72" y="15" width="12" height="50" rx="3" fill="rgba(34,197,94,0.45)" />
            <path d="M 24 38 L 42 24 L 60 44 L 78 15 L 96 10" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" fill="none" />
            <circle cx="78" cy="15" r="3.5" fill="#4ade80" />
            <circle cx="96" cy="10" r="3.5" fill="#38bdf8" />
          </svg>
        </div>

        {/* 2. Trigonometric Sine / Cosine Wave Waveform Graph */}
        <div className="floating-visual-graph" style={{ bottom: '26%', right: '18%', animation: 'floatFormulaDrift3 28s ease-in-out infinite' }}>
          <svg width="130" height="60" viewBox="0 0 130 60" fill="none" style={{ filter: 'drop-shadow(0 0 14px rgba(168,85,247,0.4))' }}>
            <line x1="5" y1="30" x2="125" y2="30" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 2" />
            <path d="M 5 30 Q 20 5 35 30 T 65 30 T 95 30 T 125 30" stroke="rgba(192,132,252,0.6)" strokeWidth="2.5" fill="none" />
            <path d="M 5 10 Q 20 35 35 10 T 65 10 T 95 10 T 125 10" stroke="rgba(244,114,182,0.35)" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
            <text x="70" y="55" fill="rgba(192,132,252,0.6)" fontSize="9" fontWeight="bold">y = sin(x)</text>
          </svg>
        </div>

        {/* 3. Rotating Rutherford Bohr Atomic Orbit Model */}
        <div className="floating-visual-graph" style={{ top: '8%', right: '20%', animation: 'floatFormulaDrift2 24s ease-in-out infinite' }}>
          <div style={{ position: 'relative', width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle, #facc15 0%, #ca8a04 100%)', boxShadow: '0 0 15px #eab308' }} />
            <div style={{ position: 'absolute', width: 64, height: 26, borderRadius: '50%', border: '1.5px solid rgba(56,189,248,0.55)', animation: 'spinOrbitSlow 8s linear infinite' }} />
            <div style={{ position: 'absolute', width: 64, height: 26, borderRadius: '50%', border: '1.5px solid rgba(244,114,182,0.5)', transform: 'rotate(60deg)', animation: 'spinOrbitSlow 10s linear infinite reverse' }} />
            <div style={{ position: 'absolute', width: 64, height: 26, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.5)', transform: 'rotate(120deg)', animation: 'spinOrbitSlow 12s linear infinite' }} />
          </div>
        </div>

        {/* 4. Normal Distribution / Gaussian Bell Curve Diagram */}
        <div className="floating-visual-graph" style={{ bottom: '10%', left: '16%', animation: 'floatFormulaDrift5 27s ease-in-out infinite' }}>
          <svg width="120" height="65" viewBox="0 0 120 65" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.4))' }}>
            <line x1="5" y1="58" x2="115" y2="58" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
            <line x1="60" y1="12" x2="60" y2="58" stroke="rgba(234,179,8,0.4)" strokeWidth="1" strokeDasharray="2 2" />
            <path d="M 10 58 C 35 58, 42 12, 60 12 C 78 12, 85 58, 110 58" stroke="rgba(74,222,128,0.65)" strokeWidth="2.5" fill="rgba(34,197,94,0.08)" />
            <text x="56" y="8" fill="rgba(234,179,8,0.8)" fontSize="9" fontWeight="bold">μ, σ</text>
            <text x="80" y="52" fill="rgba(74,222,128,0.6)" fontSize="8">Normal Dist</text>
          </svg>
        </div>

        {/* 5. 2D Cartesian Coordinate System with Linear Vector (f(x) = mx + c) */}
        <div className="floating-visual-graph" style={{ top: '56%', left: '18%', animation: 'floatFormulaDrift4 25s ease-in-out infinite' }}>
          <svg width="85" height="85" viewBox="0 0 85 85" fill="none" style={{ filter: 'drop-shadow(0 0 10px rgba(96,165,250,0.35))' }}>
            <line x1="42" y1="5" x2="42" y2="80" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <line x1="5" y1="42" x2="80" y2="42" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <polygon points="42,2 39,7 45,7" fill="rgba(255,255,255,0.5)" />
            <polygon points="83,42 78,39 78,45" fill="rgba(255,255,255,0.5)" />
            <line x1="12" y1="72" x2="72" y2="12" stroke="#38bdf8" strokeWidth="2.5" />
            <circle cx="42" cy="42" r="3" fill="#facc15" />
            <text x="55" y="24" fill="#38bdf8" fontSize="8.5" fontWeight="bold">y = mx + c</text>
          </svg>
        </div>

        {/* 6. Glowing Circular Pie / Donut Chart */}
        <div className="floating-visual-graph" style={{ top: '70%', right: '22%', animation: 'floatFormulaDrift2 29s ease-in-out infinite' }}>
          <svg width="75" height="75" viewBox="0 0 75 75" style={{ filter: 'drop-shadow(0 0 12px rgba(234,179,8,0.45))' }}>
            <circle cx="37.5" cy="37.5" r="28" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="12" strokeDasharray="45 130" strokeDashoffset="0" />
            <circle cx="37.5" cy="37.5" r="28" fill="none" stroke="rgba(34,197,94,0.45)" strokeWidth="12" strokeDasharray="60 115" strokeDashoffset="-45" />
            <circle cx="37.5" cy="37.5" r="28" fill="none" stroke="rgba(234,179,8,0.5)" strokeWidth="12" strokeDasharray="70 105" strokeDashoffset="-105" />
            <text x="37.5" y="41" fill="#fef08a" fontSize="9" fontWeight="900" textAnchor="middle">100%</text>
          </svg>
        </div>

        {/* 7. DNA Double Helix Abstract Representation */}
        <div className="floating-visual-graph" style={{ top: '3%', left: '16%', animation: 'floatFormulaDrift3 23s ease-in-out infinite' }}>
          <svg width="90" height="35" viewBox="0 0 90 35" fill="none" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.4))' }}>
            <path d="M 5 8 Q 25 28 45 8 T 85 8" stroke="#34d399" strokeWidth="2" fill="none" />
            <path d="M 5 28 Q 25 8 45 28 T 85 28" stroke="#38bdf8" strokeWidth="2" fill="none" />
            <line x1="15" y1="13" x2="15" y2="23" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <line x1="35" y1="18" x2="35" y2="18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <line x1="55" y1="13" x2="55" y2="23" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
            <line x1="75" y1="18" x2="75" y2="18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
          </svg>
        </div>

      </div>

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
