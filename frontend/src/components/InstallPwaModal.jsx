import { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share2, PlusSquare, Sparkles, CheckCircle2 } from 'lucide-react';

let deferredPromptGlobal = null;

export default function InstallPwaModal({ isOpen, onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(deferredPromptGlobal);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone = 
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && (navigator.standalone || navigator.windowControlsOverlay?.visible));
    
    if (isStandalone) {
      setIsInstalled(true);
    }

    // Check iOS
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIos(iosDevice);

    // Capture beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptGlobal = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallSuccess(true);
      deferredPromptGlobal = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallSuccess(true);
        setTimeout(() => {
          if (onClose) onClose();
        }, 2200);
      }
      deferredPromptGlobal = null;
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(7, 13, 26, 0.88)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d1b38 0%, #081022 100%)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: 22,
        maxWidth: 480,
        width: '100%',
        padding: '24px 22px',
        color: '#ffffff',
        position: 'relative',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), 0 0 35px rgba(37, 99, 235, 0.25)',
        boxSizing: 'border-box'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#94a3b8',
            borderRadius: '50%',
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <X size={18} />
        </button>

        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            padding: 4,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.35)',
            border: '2px solid #38bdf8'
          }}>
            <img src="/trinetra-logo.png" alt="Trinetra Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '0 0 6px 0' }}>
            📲 ત્રિનેત્ર એકેડેમી એપ ઇન્સ્ટોલ કરો
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0 }}>
            પ્લે-સ્ટોર વગર સીધી જ તમારા મોબાઈલની હોમ સ્ક્રીન પર ઍપ તરીકે સેવ કરો.
          </p>
        </div>

        {/* Success Feedback */}
        {installSuccess ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1.5px solid #22c55e',
            borderRadius: 14,
            padding: '16px',
            textAlign: 'center',
            color: '#86efac',
            marginBottom: 16
          }}>
            <CheckCircle2 size={36} color="#22c55e" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>🎉 અભિનંદન! એપ ઇન્સ્ટોલ થઈ ગઈ છે!</div>
            <div style={{ fontSize: '0.82rem', marginTop: 4 }}>હવે તમે તમારા મોબાઈલની હોમ સ્ક્રીન પરથી સીધી જ એપ ખોલી શકશો.</div>
          </div>
        ) : isInstalled ? (
          <div style={{
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid #38bdf8',
            borderRadius: 14,
            padding: '14px',
            textAlign: 'center',
            color: '#e0f2fe',
            marginBottom: 16
          }}>
            ✅ <strong>આ એપ તમારા મોબાઈલમાં પહેલેથી જ ઇન્સ્ટોલ છે!</strong>
          </div>
        ) : isIos ? (
          /* iOS Safari Step-by-Step Instructions */
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 14,
            padding: '16px 14px',
            marginBottom: 18
          }}>
            <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.86rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={16} /> iPhone / iPad પર ઇન્સ્ટોલ કરવાની રીત:
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.65 }}>
              <li>Safari બ્રાઉઝરમાં નીચે આપેલ <strong>શેર (Share) બટન <Share2 size={13} style={{ display: 'inline', verticalAlign: 'middle', color: '#38bdf8' }} /></strong> દબાવો.</li>
              <li>નીચે સ્ક્રોલ કરીને <strong>'Add to Home Screen' <PlusSquare size={13} style={{ display: 'inline', verticalAlign: 'middle', color: '#38bdf8' }} /></strong> પસંદ કરો.</li>
              <li>ઉપર જમણી બાજુએ <strong>'Add'</strong> દબાવો. તમારા હોમ સ્ક્રીન પર ત્રિનેત્ર એપ બની જશે!</li>
            </ol>
          </div>
        ) : (
          /* Android / Desktop Instant 1-Click Install */
          <div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 18,
              fontSize: '0.82rem',
              color: '#cbd5e1',
              lineHeight: 1.6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontWeight: 800, marginBottom: 6 }}>
                <Sparkles size={16} /> ઍપ ઇન્સ્ટોલ કરવાના ફાયદા:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>🚀 <strong>ફુલ-સ્ક્રીન અનુભવ:</strong> ઉપર URL બાર વગર અસલી એપ જેવો અનુભવ.</li>
                <li>⚡ <strong>ઝડપી લોડિંગ:</strong> નબળા ઇન્ટરનેટમાં પણ પેપર ફટાફટ ખૂલશે.</li>
                <li>📱 <strong>હોમ સ્ક્રીન શોર્ટકટ:</strong> ૧-ક્લિકમાં સીધી પરીક્ષા શરૂ કરો.</li>
              </ul>
            </div>

            <button
              onClick={handleInstallClick}
              disabled={!deferredPrompt}
              style={{
                width: '100%',
                background: deferredPrompt ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: '1rem',
                cursor: deferredPrompt ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: deferredPrompt ? '0 4px 18px rgba(16, 185, 129, 0.4)' : 'none',
                fontFamily: 'Hind Vadodara, sans-serif'
              }}
            >
              <Download size={20} />
              {deferredPrompt ? '📲 હમણાં જ ઍપ ઇન્સ્ટોલ કરો' : 'બ્રાઉઝર મેનૂમાંથી "Add to Home Screen" કરો'}
            </button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            પછીથી કરીશ / બંધ કરો
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom Floating Smart PWA Install Bar
 * Displays automatically if user visits on mobile browser and has not installed the app yet.
 */
export function FloatingPwaBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(deferredPromptGlobal);

  useEffect(() => {
    // If running in standalone (already installed), never show banner
    const isStandalone = 
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && (navigator.standalone || navigator.windowControlsOverlay?.visible));

    if (isStandalone) return;

    // Check if dismissed within last 24 hours
    try {
      const dismissedUntil = localStorage.getItem('trinetra_pwa_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch (_) {}

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptGlobal = e;
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If on iOS Safari, show the install banner after a 3s delay
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isIos = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    if (isIos && !isStandalone) {
      const timer = setTimeout(() => setShowBanner(true), 3500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      // Dismiss for 24 hours
      localStorage.setItem('trinetra_pwa_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
    } catch (_) {}
  };

  const handleOpenInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setShowBanner(false);
      });
    } else {
      setShowModal(true);
    }
  };

  if (!showBanner) {
    return showModal ? <InstallPwaModal isOpen={true} onClose={() => setShowModal(false)} /> : null;
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        right: 12,
        maxWidth: 500,
        margin: '0 auto',
        zIndex: 9998,
        background: 'linear-gradient(135deg, #0b1329 0%, #0d1e44 100%)',
        border: '1.5px solid #38bdf8',
        borderRadius: 16,
        padding: '10px 14px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.7), 0 0 20px rgba(56,189,248,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1.5px solid #38bdf8',
            overflow: 'hidden'
          }}>
            <img src="/trinetra-logo.png" alt="Trinetra" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '0.84rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ત્રિનેત્ર એકેડેમી એપ
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              હોમ સ્ક્રીન પર ઍપ ઇન્સ્ટોલ કરો
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={handleOpenInstall}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '7px 12px',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
              fontFamily: 'Hind Vadodara, sans-serif'
            }}
          >
            <Download size={14} /> ઇન્સ્ટોલ
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showModal && <InstallPwaModal isOpen={true} onClose={() => setShowModal(false)} />}
    </>
  );
}
