import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: '🏠 Home',               to: '/',         type: 'link' },
  { label: '🎓 Student Portal',     to: '/student',  type: 'link' },
  { label: '🔐 Teacher Login',      to: '/teacher',  type: 'link' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (to) => location.pathname === to;

  return (
    <div className="sticky-header-container" style={{ position: 'sticky', top: 0, zIndex: 1000, width: '100%' }}>
      {/* 🌟 CENTERED BOLD RGB RAINBOW NEON MOTIVATION BAR (NO PHONE NUMBER) 🌟 */}
      <div className="announcement-bar">
        <span className="rgb-rainbow-text" style={{ fontSize: 'clamp(0.84rem, 2.6vw, 1rem)', fontWeight: 900, letterSpacing: '0.4px' }}>
          ✨ સફળતા એટલે વાર લાગવી પણ પરાજય નહીં! 🏆
        </span>
      </div>

      {/* Main Dark Luxury Glass Navbar */}
      <nav className="navbar" style={{
        position: 'relative',
        top: 0,
        zIndex: 1000,
        width: '100%',
        background: '#0b1329',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 16px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', height: 60
        }}>

          {/* ── Brand Logo ── */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              padding: 2
            }}>
              <img src="/images/logo.jpg" alt="Trinetra Online Academy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontSize: 'clamp(0.85rem,2.5vw,1.02rem)', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                Trinetra Online Academy
              </div>
              <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700 }}>
                Learning Is Limitless
              </div>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <div id="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {NAV_LINKS.map((nav) => {
              const active = isActive(nav.to);

              /* Student Portal → Primary gradient button */
              if (nav.to === '/student') {
                return (
                  <Link key={nav.to} to={nav.to} style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                    color: 'white',
                    border: '1.5px solid rgba(255,255,255,0.2)',
                    padding: '8px 16px', borderRadius: 10,
                    fontWeight: 800, textDecoration: 'none',
                    fontSize: '0.88rem', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 3px 12px rgba(37,99,235,0.4)'
                  }}>
                    {nav.label}
                  </Link>
                );
              }

              /* Teacher Login → outlined button */
              if (nav.to === '/teacher') {
                return (
                  <Link key={nav.to} to={nav.to} style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    padding: '8px 16px', borderRadius: 10,
                    fontWeight: 700, textDecoration: 'none',
                    fontSize: '0.88rem', whiteSpace: 'nowrap',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(8px)'
                  }}>
                    {nav.label}
                  </Link>
                );
              }

              /* Regular nav link */
              return (
                <Link key={nav.to} to={nav.to} style={{
                  padding: '8px 14px', borderRadius: 8,
                  fontWeight: 700,
                  color: active ? '#38bdf8' : '#cbd5e1',
                  textDecoration: 'none', fontSize: '0.88rem',
                  background: active ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                }}>
                  {nav.label}
                </Link>
              );
            })}
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            id="hamburger-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: menuOpen ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: 10, cursor: 'pointer',
              padding: '7px 9px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)'
            }}
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} color="#ffffff" /> : <Menu size={22} color="#ffffff" />}
          </button>
        </div>

        {/* ── Dark Luxury Glass Mobile Dropdown ── */}
        {menuOpen && (
          <div style={{
            background: '#0b1329',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '14px 16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderRadius: '0 0 20px 20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderTop: 'none',
            animation: 'fade-in 0.2s ease-out'
          }}>

            {/* Row 1: Home & About Us side-by-side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Link to="/" onClick={() => setMenuOpen(false)} style={{
                padding: '10px 12px',
                borderRadius: 10,
                fontWeight: 800,
                color: location.pathname === '/' ? '#38bdf8' : '#e2e8f0',
                textDecoration: 'none',
                textAlign: 'center',
                fontSize: '0.88rem',
                background: location.pathname === '/' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: location.pathname === '/' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                🏠 Home
              </Link>
              <a href="/#about" onClick={() => setMenuOpen(false)} style={{
                padding: '10px 12px',
                borderRadius: 10,
                fontWeight: 800,
                color: '#e2e8f0',
                textDecoration: 'none',
                textAlign: 'center',
                fontSize: '0.88rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
                📖 About Us
              </a>
            </div>

            {/* Row 2: Student Portal — Primary Gradient Action */}
            <Link to="/student" onClick={() => setMenuOpen(false)} style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: 12,
              fontWeight: 900,
              textDecoration: 'none',
              textAlign: 'center',
              fontSize: '0.94rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              border: '1.5px solid rgba(255,255,255,0.2)'
            }}>
              🎓 Student Portal (વિદ્યાર્થી પોર્ટલ & રિઝલ્ટ) →
            </Link>

            {/* Row 3: Teacher Login */}
            <Link to="/teacher" onClick={() => setMenuOpen(false)} style={{
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#f8fafc',
              padding: '11px 16px',
              borderRadius: 12,
              fontWeight: 800,
              textDecoration: 'none',
              textAlign: 'center',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}>
              🔐 Teacher Login (શિક્ષક પ્રવેશ)
            </Link>

            {/* Row 4: Compact WhatsApp Helpline */}
            <a href="https://wa.me/918200405300" target="_blank" rel="noreferrer" style={{
              background: 'rgba(34, 197, 94, 0.12)',
              color: '#4ade80',
              border: '1.5px solid rgba(34, 197, 94, 0.35)',
              padding: '9px 12px',
              borderRadius: 10,
              fontWeight: 800,
              textDecoration: 'none',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: '0.84rem'
            }}>
              💬 WhatsApp / Call: <strong>8200405300</strong>
            </a>
          </div>
        )}
      </nav>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          #desktop-nav { display: none !important; }
        }
        @media (min-width: 769px) {
          #hamburger-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function MobileNavItem({ to, label, onClick, active }) {
  return (
    <Link to={to} onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 10,
      fontWeight: 600,
      color: active ? '#1e3a8a' : '#374151',
      textDecoration: 'none', display: 'block',
      fontSize: '0.97rem',
      background: active ? '#eff6ff' : '#f8fafc',
      border: `1px solid ${active ? '#bfdbfe' : '#f1f5f9'}`
    }}>
      {label}
    </Link>
  );
}
