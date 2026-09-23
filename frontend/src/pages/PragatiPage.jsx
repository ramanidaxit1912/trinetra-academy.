import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function PragatiPage() {
  const params = useParams();
  const [mobile, setMobile] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let resolvedMobile = params.mobile || '';
    if (!resolvedMobile) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        resolvedMobile = u.mobile || '';
      } catch (e) {}
    }
    const clean = String(resolvedMobile).replace(/\D/g, '').replace(/^(91|0)/, '');
    setMobile(clean);
    setLoading(false);
  }, [params]);

  const handleDownloadPdf = () => {
    if (!mobile) return;
    setDownloadingPdf(true);
    window.open(`/api/submissions/pragati/${mobile}/pdf`, '_blank');
    setTimeout(() => setDownloadingPdf(false), 2000);
  };

  const handlePrint = () => {
    const iframe = document.getElementById('pragati-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📊</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>પ્રગતિ રિપોર્ટ લોડ થઈ રહ્યો છે...</h3>
          </div>
        </div>
      </div>
    );
  }

  if (!mobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc' }}>
        <Navbar />
        <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32 }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginBottom: 10 }}>
              પ્રગતિ રિપોર્ટ માટે મોબાઈલ નંબર જરૂરી છે
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: 20 }}>
              કૃપા કરીને પહેલાં પોર્ટલ પર લોગિન કરો અથવા સાચો મોબાઈલ નંબર દાખલ કરો.
            </p>
            <Link to="/" style={{ display: 'inline-block', background: '#2563eb', color: '#ffffff', padding: '10px 24px', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>
              🏠 હોમ પેજ પર જાઓ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b1329', color: '#f8fafc', paddingBottom: 60, fontFamily: 'Plus Jakarta Sans, Noto Sans Gujarati, sans-serif' }}>
      <Navbar />

      <div style={{ maxWidth: 940, margin: '20px auto', padding: '0 12px' }}>
        {/* Top Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#94a3b8', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
            ← હોમ પેજ
          </Link>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handlePrint}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', padding: '8px 16px', borderRadius: 10, fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}
            >
              🖨️ પ્રિન્ટ / સેવ
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', padding: '8px 20px', borderRadius: 10, fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}
            >
              {downloadingPdf ? '⏳ PDF તૈયાર થઈ રહી છે...' : '📥 Download Pragati PDF'}
            </button>
          </div>
        </div>

        {/* Official Pragati Report (Exact 100% PDF Formation View) */}
        <div style={{ background: '#ffffff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <iframe
            id="pragati-iframe"
            title="Official Trinetra Pragati Report"
            src={`/api/submissions/pragati/${mobile}/html`}
            style={{
              width: '100%',
              height: '840px',
              border: 'none',
              display: 'block',
              background: '#ffffff'
            }}
          />
        </div>
      </div>
    </div>
  );
}
