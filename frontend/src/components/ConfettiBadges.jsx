import { useEffect, useRef } from 'react';

// ─── Canvas Particle Confetti Animation ─────────────────────────────
export function ConfettiCanvas({ duration = 3500 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#38bdf8', '#fbbf24', '#34d399', '#f43f5e', '#a855f7', '#60a5fa'];
    const particleCount = 75;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height * 0.5,
        w: Math.random() * 9 + 5,
        h: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        opacity: 1
      });
    }

    let animId;
    const startTime = Date.now();

    function render() {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (elapsed > duration * 0.7) {
          p.opacity = Math.max(0, 1 - (elapsed - duration * 0.7) / (duration * 0.3));
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < duration) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animId = requestAnimationFrame(render);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [duration]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        width: '100vw',
        height: '100vh'
      }}
    />
  );
}

// ─── Achievement Badges Calculation & Component ─────────────────────
export function AchievementBadges({ score = 0, totalMarks = 1, avgTimePerQ = 0, totalSubmissions = 1 }) {
  const pct = Math.round((score / Math.max(1, totalMarks)) * 100);
  const badges = [];

  if (pct >= 85) {
    badges.push({
      id: 'topper',
      icon: '🥇',
      title: 'સુવર્ણ ટોપર (Gold Topper)',
      desc: '૮૫%+ શાનદાર સ્કોર પ્રાપ્ત કર્યો!',
      grad: 'linear-gradient(135deg,#f59e0b,#d97706)',
      border: '#fde68a',
      bg: '#fffbeb',
      color: '#92400e'
    });
  } else if (pct >= 65) {
    badges.push({
      id: 'star',
      icon: '🥈',
      title: 'સ્ટાર પરફોર્મર (Silver Star)',
      desc: 'સફળતાપૂર્વક ઉત્કૃષ્ટ પાસિંગ સ્કોર!',
      grad: 'linear-gradient(135deg,#64748b,#475569)',
      border: '#cbd5e1',
      bg: '#f8fafc',
      color: '#334155'
    });
  }

  if (avgTimePerQ > 0 && avgTimePerQ <= 35) {
    badges.push({
      id: 'speed',
      icon: '⚡',
      title: 'સ્પીડ માસ્ટર (Speed Master)',
      desc: `પ્રશ્ન દીઠ સરેરાશ માત્ર ${Math.round(avgTimePerQ)} સેકન્ડમાં ઝડપી નિર્ણય!`,
      grad: 'linear-gradient(135deg,#0284c7,#0369a1)',
      border: '#bae6fd',
      bg: '#f0f9ff',
      color: '#0369a1'
    });
  }

  if (pct >= 90) {
    badges.push({
      id: 'accuracy',
      icon: '🎯',
      title: 'ચોકસાઈ ચેમ્પિયન (90%+ Accuracy)',
      desc: 'અચૂક અને સચોટ જવાબો!',
      grad: 'linear-gradient(135deg,#059669,#047857)',
      border: '#a7f3d0',
      bg: '#ecfdf5',
      color: '#065f46'
    });
  }

  if (totalSubmissions >= 3) {
    badges.push({
      id: 'dedication',
      icon: '🚀',
      title: 'પ્રેક્ટિસ યોદ્ધા (Consistent Warrior)',
      desc: 'સતત ૩ કે વધુ ટેસ્ટ આપીને લગન સાબિત કરી!',
      grad: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
      border: '#ddd6fe',
      bg: '#f5f3ff',
      color: '#5b21b6'
    });
  }

  if (badges.length === 0) {
    badges.push({
      id: 'fighter',
      icon: '🌱',
      title: 'પ્રયાસશીલ વિદ્યાર્થી (Keep Growing)',
      desc: 'સતત મહાવરો તમને આગળ લઈ જશે!',
      grad: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
      border: '#bfdbfe',
      bg: '#eff6ff',
      color: '#1e40af'
    });
  }

  return (
    <div style={{ margin: '14px 0 18px' }}>
      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}>
        <span>🎖️</span> તમારા અચીવમેન્ટ બેજ (Earned Badges):
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {badges.map(b => (
          <div key={b.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 16,
            background: 'linear-gradient(135deg, #ffffff 0%, ' + b.bg + ' 100%)',
            border: `1.5px solid ${b.border}`,
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: b.grad, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.35rem', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)'
            }}>
              {b.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 900, color: b.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b.title}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.3, marginTop: 2, fontWeight: 600 }}>
                {b.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
