import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getMarketingItems } from '../services/api';
import { ChevronLeft, ChevronRight, Sparkles, ExternalLink, Maximize2, X, Ticket, Copy, Check } from 'lucide-react';

const DEFAULT_CAROUSEL = [
  {
    id: 1,
    title: 'TET-2 ગણિત સ્પેશિયલ (ધોરણ ૬-૮)',
    subtitle: 'Chapter-wise MCQ ટેસ્ટ સિરીઝ + પ્રેક્ટીસ PDF',
    imageUrl: '/images/poster_maths.png',
    badge: 'BEST SELLER',
    price: '₹149',
    oldPrice: '₹299',
    tagColor: '#2563eb',
    waMessage: 'મને TET-2 ગણિત ટેસ્ટ સિરીઝ ₹149 માટે વિગત આપો.',
    linkUrl: '/exam'
  },
  {
    id: 2,
    title: 'TET-2 વિજ્ઞાન & ટેકનોલોજી',
    subtitle: 'કૂતૂહલ & પાઠ્યપુસ્તક આધારિત ઓનલાઇન ટેસ્ટ',
    imageUrl: '/images/poster_science.png',
    badge: '50% OFF',
    price: '₹149',
    oldPrice: '₹299',
    tagColor: '#059669',
    waMessage: 'મને TET-2 વિજ્ઞાન ટેસ્ટ સિરીઝ ₹149 માટે વિગત આપો.',
    linkUrl: '/exam'
  },
  {
    id: 3,
    title: 'TET-2 સામાજિક વિજ્ઞાન',
    subtitle: 'સમાજ શોધયાત્રા - Chapter-wise MCQ',
    imageUrl: '/images/poster_social.png',
    badge: 'POPULAR',
    price: '₹149',
    oldPrice: '₹299',
    tagColor: '#7c3aed',
    waMessage: 'મને TET-2 સામાજિક વિજ્ઞાન ટેસ્ટ સિરીઝ ₹149 માટે વિગત આપો.',
    linkUrl: '/exam'
  },
  {
    id: 4,
    title: 'ગુજરાતી વર્ણનાત્મક & વ્યાકરણ PDF',
    subtitle: 'ALL Lecture PDF + વ્યાકરણ + Mock Test',
    imageUrl: '/images/poster_gujarati.png',
    badge: 'SUPER SAVER',
    price: '₹99',
    oldPrice: '₹199',
    tagColor: '#d97706',
    waMessage: 'મને ગુજરાતી વર્ણનાત્મક PDF ₹99 માટે વિગત આપો.',
    linkUrl: '/materials'
  },
];

const DEFAULT_OFFERS = [
  {
    id: 1,
    badge: '🔥 SUPER SAVER',
    tagColor: '#d97706',
    couponCode: 'GUJ99',
    title: 'ગુજરાતી વર્ણનાત્મક PDF',
    description: 'ALL Lecture PDF, Grammar PDF, Reference + Full Mock Test',
    price: '₹99',
    oldPrice: '₹199',
    waMessage: 'નમસ્તે Trinetra Academy, મને ગુજરાતી વર્ણનાત્મક PDF ₹99 વાળી ધમાકા ઓફર [કૂપન: GUJ99] સાથે લેવી છે.',
    imageUrl: '/images/poster_gujarati.png'
  },
  {
    id: 2,
    badge: '💥 50% DISCOUNT',
    tagColor: '#2563eb',
    couponCode: 'TET50',
    title: 'TET-2 SPECIAL (ગણિત/વિજ્ઞાન/સામ.)',
    description: 'ધોરણ ૬,૭,૮ Chapter-wise MCQ Test + PDF (નવા Textbook)',
    price: '₹149',
    oldPrice: '₹299',
    waMessage: 'નમસ્તે Trinetra Academy, મને TET-2 સ્પેશિયલ ₹149 વાળી ધમાકા ઓફર [કૂપન: TET50] સાથે લેવી છે.',
    imageUrl: '/images/poster_maths.png'
  }
];

export default function HomePage() {
  const [carouselList, setCarouselList] = useState(DEFAULT_CAROUSEL);
  const [offersList, setOffersList] = useState(DEFAULT_OFFERS);
  const [heroIdx, setHeroIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [zoomPoster, setZoomPoster] = useState(null);

  // Fetch live marketing items from backend
  useEffect(() => {
    getMarketingItems()
      .then(res => {
        if (res.data?.data && res.data.data.length > 0) {
          const items = res.data.data;
          const carouselItems = items.filter(i => i.category === 'CAROUSEL' && i.isActive !== false && i.showInHome !== false);
          const offerItems = items.filter(i => i.category === 'DHAMAKA_OFFER' && i.isActive !== false && i.showInHome !== false);

          if (carouselItems.length > 0) setCarouselList(carouselItems);
          if (offerItems.length > 0) setOffersList(offerItems);
        }
      })
      .catch(err => {
        console.warn('Using default marketing items:', err.message);
      });
  }, []);

  // Auto slide carousel
  useEffect(() => {
    if (carouselList.length <= 1) return;
    const timer = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setHeroIdx(i => (i + 1) % carouselList.length);
        setFadeIn(true);
      }, 250);
    }, 4500);
    return () => clearInterval(timer);
  }, [carouselList.length]);

  const currentPoster = carouselList[heroIdx] || carouselList[0] || {};

  const handlePrev = (e) => {
    e?.stopPropagation();
    setFadeIn(false);
    setTimeout(() => {
      setHeroIdx(i => (i - 1 + carouselList.length) % carouselList.length);
      setFadeIn(true);
    }, 150);
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    setFadeIn(false);
    setTimeout(() => {
      setHeroIdx(i => (i + 1) % carouselList.length);
      setFadeIn(true);
    }, 150);
  };

  return (
    <div style={{ minHeight: '100vh', overflowX: 'clip', background: '#090d16' }}>
      <Navbar />

      {/* ── Hero Section with Dynamic Carousel ── */}
      <section className="hero-section" style={{ position: 'relative', padding: ' clamp(30px, 5vw, 60px) 16px', background: 'radial-gradient(ellipse at top, #1e3a8a 0%, #090d16 70%)' }}>
        <div style={{
          maxWidth: 1180, margin: '0 auto', width: '100%',
          display: 'flex', alignItems: 'center', gap: 32,
          flexDirection: 'row',
          flexWrap: 'wrap'
        }}>

          {/* Left Text / CTA Content */}
          <div style={{ flex: '1 1 420px', minWidth: 0, zIndex: 1, textAlign: 'left' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#0f172a',
              color: '#fbbf24',
              fontWeight: 900, fontSize: '0.82rem',
              padding: '6px 14px', borderRadius: 20, marginBottom: 16,
              border: '1.5px solid #d97706',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
            }}>
              <Sparkles size={14} /> Trinetra Online Academy — શિક્ષક ભરતી સ્પેશિયલ
            </div>

            <h1 style={{
              fontSize: 'clamp(1.42rem, 5.2vw, 2.4rem)',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.35,
              marginBottom: 12,
              letterSpacing: '-0.2px'
            }}>
              <div>મહેનત તમારી, માર્ગદર્શન અમારું</div>
              <div style={{ color: '#fbbf24', textShadow: '0 2px 14px rgba(251,191,36,0.4)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>✨ સફળતા તમારી! 🏆</span>
              </div>
            </h1>

            <p className="gu-text" style={{
              color: '#93c5fd', fontSize: 'clamp(0.88rem, 2.5vw, 1.02rem)',
              marginBottom: 18, lineHeight: 1.65, maxWidth: 540
            }}>
              TET-1, TET-2, TAT (માધ્યમિક & ઉચ્ચતર માધ્યમિક) અને તમામ શિક્ષક ભરતી પરીક્ષાઓ માટે વિષયવાર MCQ ટેસ્ટ, પાઠ્યપુસ્તક આધારિત PDF મટીરીયલ અને ઓનલાઇન મોક ટેસ્ટ પ્લેટફોર્મ.
            </p>

            {/* Micro Highlights Glass Badges */}
            <div style={{ display: 'flex', gap: 7, marginTop: 12, marginBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ background: '#052e16', border: '1.5px solid #22c55e', color: '#86efac', fontSize: '0.76rem', fontWeight: 800, padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                ✓ TET & TAT ટેસ્ટ સિરીઝ
              </span>
              <span style={{ background: '#082f49', border: '1.5px solid #38bdf8', color: '#7dd3fc', fontSize: '0.76rem', fontWeight: 800, padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                ✓ NCERT / GCERT મટીરીયલ
              </span>
              <span style={{ background: '#451a03', border: '1.5px solid #f59e0b', color: '#fde68a', fontSize: '0.76rem', fontWeight: 800, padding: '4px 10px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                ✓ ઓલ ગુજરાત લાઈવ રેન્ક
              </span>
            </div>


          </div>

          {/* Right Marketing Carousel Container */}
          <div style={{ flex: '1 1 340px', maxWidth: 420, margin: '0 auto', width: '100%', zIndex: 1 }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(30,58,138,0.5), rgba(15,23,42,0.85))',
              borderRadius: 20,
              padding: 12,
              border: '1.5px solid rgba(245,158,11,0.3)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(245,158,11,0.1)',
              position: 'relative'
            }}>
              
              {/* Active Poster Image Frame */}
              <div
                onClick={() => setZoomPoster(currentPoster.imageUrl)}
                style={{
                  width: '100%',
                  height: 'clamp(260px, 42vw, 340px)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'zoom-in',
                  background: '#0b0f19'
                }}
                title="ક્લિક કરીને મોટું પોસ્ટર જુઓ (Zoom HD)"
              >
                {/* Poster Badge */}
                {currentPoster.badge && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12,
                    background: currentPoster.tagColor || '#f59e0b',
                    color: 'white', fontWeight: 900, fontSize: '0.74rem',
                    padding: '4px 10px', borderRadius: 20, zIndex: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}>
                    {currentPoster.badge}
                  </div>
                )}

                {/* Zoom Icon Hint */}
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: 'rgba(0,0,0,0.6)', color: 'white',
                  borderRadius: '50%', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 3, backdropFilter: 'blur(4px)'
                }}>
                  <Maximize2 size={14} />
                </div>

                <img
                  src={currentPoster.imageUrl}
                  alt={currentPoster.title || 'Marketing Poster'}
                  style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    opacity: fadeIn ? 1 : 0,
                    transition: 'opacity 0.25s ease-in-out',
                    display: 'block'
                  }}
                  onError={(e) => {
                    e.target.src = '/images/poster_maths.png';
                  }}
                />

                {/* Overlay Poster Title & Price on Image bottom */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
                  padding: '16px 14px 10px',
                  color: 'white',
                  zIndex: 2
                }}>
                  <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#fbbf24', marginBottom: 2 }}>
                    {currentPoster.title}
                  </div>
                  {currentPoster.subtitle && (
                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentPoster.subtitle}
                    </div>
                  )}
                  {currentPoster.price && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ color: '#4ade80', fontWeight: 900, fontSize: '1.05rem' }}>{currentPoster.price}</span>
                      {currentPoster.oldPrice && (
                        <span style={{ color: '#94a3b8', textDecoration: 'line-through', fontSize: '0.8rem' }}>{currentPoster.oldPrice}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Left/Right Navigation Arrows */}
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.65)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 4, backdropFilter: 'blur(4px)'
                  }}
                  aria-label="Previous Poster"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.65)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 4, backdropFilter: 'blur(4px)'
                  }}
                  aria-label="Next Poster"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Bottom Direct Action Bar on Carousel Card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, padding: '0 4px' }}>
                <a
                  href="https://play.google.com/store/apps/details?id=co.bolton.unhnx"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)',
                    color: 'white',
                    padding: '9px 14px',
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: '0.84rem',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    flex: 1,
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  📱 એપ્લિકેશન પર મેળવો
                </a>

                {currentPoster.linkUrl && (
                  <Link
                    to={currentPoster.linkUrl.startsWith('/') ? currentPoster.linkUrl : '/exam'}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: '#93c5fd',
                      border: '1px solid rgba(255,255,255,0.15)',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    ટેસ્ટ <ExternalLink size={13} />
                  </Link>
                )}
              </div>

              {/* Dot Indicators */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                {carouselList.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setFadeIn(false);
                      setTimeout(() => {
                        setHeroIdx(i);
                        setFadeIn(true);
                      }, 150);
                    }}
                    style={{
                      width: heroIdx === i ? 22 : 6, height: 6,
                      borderRadius: 4, border: 'none', cursor: 'pointer',
                      background: heroIdx === i ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                      transition: 'all 0.25s ease', padding: 0
                    }}
                  />
                ))}
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ── Quick Stats Strip ── */}
      <div style={{
        background: '#1e3a8a', color: 'white',
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8, textAlign: 'center'
        }}>
          {[
            { num: '500+', label: 'સક્રિય વિદ્યાર્થીઓ' },
            { num: '1000+', label: 'MCQ પ્રશ્નોત્તરી' },
            { num: '4+', label: 'મુખ્ય વિષયો (TET-2)' },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 'clamp(1rem, 4vw, 1.5rem)', fontWeight: 900, color: '#fbbf24' }}>{s.num}</div>
              <div style={{ fontSize: 'clamp(0.68rem, 2vw, 0.82rem)', color: '#93c5fd', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── About Us Section ── */}
      <section id="about" style={{ padding: 'clamp(36px,6vw,64px) 16px', background: '#0f172a' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Heading */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'inline-block', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: 800, fontSize: '0.8rem', padding: '5px 16px', borderRadius: 20, marginBottom: 12, border: '1.5px solid rgba(59,130,246,0.35)', boxShadow: '0 4px 14px rgba(37,99,235,0.2)' }}>
              🏛️ Trinetra Online Academy — શિક્ષક સજ્જતા મંચ
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem,4vw,2.1rem)', fontWeight: 900, color: '#ffffff', marginBottom: 12, letterSpacing: '-0.2px' }}>
              ત્રિનેત્ર ઓનલાઇન એકેડેમી વિશે
            </h2>
            <p className="gu-text" style={{ color: '#93c5fd', fontSize: 'clamp(0.88rem,3vw,1.05rem)', maxWidth: 780, margin: '0 auto', lineHeight: 1.8 }}>
              TET-1, TET-2, TAT (માધ્યમિક & ઉચ્ચતર) અને HMAT પરીક્ષાઓ માટે ગુજરાતનું સર્વશ્રેષ્ઠ અને વિશ્વસનીય સ્માર્ટ ઓનલાઇન મોક ટેસ્ટ & પ્રિપેરેશન પ્લેટફોર્મ.
            </p>
          </div>

          {/* Info Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 18, marginBottom: 32 }}>
            {[
              { emoji: '🎯', title: 'અમારું લક્ષ્ય (Our Mission)', desc: 'ગુજરાતના ભાવિ સરકારી શિક્ષકોને આધુનિક સ્માર્ટ ટેકનોલોજી દ્વારા પ્રથમ પ્રયાસે સફળ બનાવવા.' },
              { emoji: '📚', title: 'GCERT / NCERT કવરેજ', desc: 'ધોરણ ૬ થી ૧૨ ના નવા પાઠ્યપુસ્તકો અને શૈક્ષણિક મનોવિજ્ઞાન આધારિત ચેપ્ટર-વાઇઝ MCQ ટેસ્ટ.' },
              { emoji: '🧠', title: 'SEB પરીક્ષા પદ્ધતિ & Opt-E', desc: 'રાજ્ય પરીક્ષા બોર્ડ (SEB) ના નવા નેગેટિવ માર્કિંગ અને ૫-ઓપ્શન (Option E) મુજબ સચોટ પ્રેક્ટિસ.' },
              { emoji: '📊', title: 'લાઈવ એનાલિટિક્સ & PDF', desc: 'ઓલ ગુજરાત લાઈવ રેન્ક, વિગતવાર પ્રશ્નવાર સોલ્યુશન અને સેકન્ડોમાં કલરફુલ PDF સ્કોરકાર્ડ.' },
            ].map((c, i) => (
              <div key={i} style={{
                background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                border: '1.5px solid rgba(255,255,255,0.09)',
                padding: '24px 20px',
                borderRadius: 16,
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                transition: 'transform 0.2s, border-color 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
              >
                <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>{c.emoji}</div>
                <h3 className="gu-text" style={{ fontWeight: 900, fontSize: '1rem', color: '#f8fafc', marginBottom: 8, lineHeight: 1.4 }}>{c.title}</h3>
                <p className="gu-text" style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dynamic Dhamaka Offers Section ── */}
      <section id="offers" style={{ padding: 'clamp(36px,6vw,64px) 16px', background: '#0a0f1e' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-block', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 800, fontSize: '0.8rem', padding: '4px 14px', borderRadius: 20, marginBottom: 8, border: '1px solid rgba(239,68,68,0.3)' }}>
              🔥 ખાસ સમય મર્યાદિત ઑફર્સ
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, color: 'white', marginBottom: 6 }}>
              ધમાકા ઑફર્સ (Dhamaka Offers)
            </h2>
            <p className="gu-text" style={{ color: '#94a3b8', fontSize: 'clamp(0.85rem, 3vw, 0.98rem)' }}>
              TET-2 અને સ્પર્ધાત્મક પરીક્ષાની તૈયારી માટે ખાસ ડિસ્કાઉન્ટ પેકેજ & કૂપન કોડ્સ
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            gap: 24
          }}>
            {offersList.map((offer, i) => (
              <OfferCard key={offer.id || i} offer={offer} onZoom={(url) => setZoomPoster(url)} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Fullscreen Zoom Poster Modal ── */}
      {zoomPoster && (
        <div
          onClick={() => setZoomPoster(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16, backdropFilter: 'blur(8px)'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', maxWidth: 500, width: '100%',
              background: '#1e293b', borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <button
              onClick={() => setZoomPoster(null)}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'rgba(0,0,0,0.7)', color: 'white',
                border: 'none', borderRadius: '50%', width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10
              }}
            >
              <X size={20} />
            </button>

            <img
              src={zoomPoster}
              alt="Full Preview"
              style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block', background: '#000' }}
              onError={(e) => {
                e.target.src = '/images/poster_maths.png';
              }}
            />

            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: '#0f172a' }}>
              <span style={{ color: '#93c5fd', fontSize: '0.85rem', fontWeight: 700 }}>
                🎓 Trinetra Online Academy
              </span>
              <a
                href="https://play.google.com/store/apps/details?id=co.bolton.unhnx"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  color: 'white', padding: '8px 16px',
                  borderRadius: 8, fontWeight: 900, fontSize: '0.82rem',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 10px rgba(37,99,235,0.4)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                📱 એપ્લિકેશન પર મેળવો
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{
        background: '#060911', color: '#64748b',
        textAlign: 'center', padding: '24px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ marginBottom: 6, color: 'white', fontWeight: 800, fontSize: 'clamp(0.95rem,3vw,1.1rem)' }}>
          🎓 Trinetra Online Academy
        </div>
        <div style={{ fontSize: 'clamp(0.85rem,3vw,0.95rem)', color: '#94a3b8' }}>
          📞 WhatsApp: <strong style={{ color: '#f59e0b' }}>8200405300</strong>
        </div>
        <div style={{ fontSize: 'clamp(0.72rem,2.5vw,0.8rem)', marginTop: 8, color: '#475569' }}>
          © 2026 Trinetra Online Academy. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function OfferCard({ offer, onZoom }) {
  const {
    badge = '🔥 SPECIAL OFFER',
    tagColor = '#f59e0b',
    title,
    subtitle,
    description,
    price,
    oldPrice,
    couponCode,
    imageUrl,
    waMessage,
    buttonText = '💬 WhatsApp કરો'
  } = offer;

  const [copied, setCopied] = useState(false);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const defaultWaText = couponCode
    ? `નમસ્તે Trinetra Academy, મને ${title} ઑફર [કૂપન કોડ: ${couponCode}] સાથે એડમિશન / મટીરીયલ આપો.`
    : `નમસ્તે Trinetra Academy, મને ${title} ઑફર માટે વિગત આપો.`;

  return (
    <div
      style={{
        background: '#131d31',
        border: '1.5px solid rgba(245,158,11,0.28)',
        borderRadius: 16,
        padding: '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        maxWidth: 520,
        width: '100%',
        margin: '0 auto'
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 36px rgba(245,158,11,0.18)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; }}
    >
      <div>
        {/* Badge & Poster Preview */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{
            background: tagColor || '#f59e0b',
            color: 'white',
            fontWeight: 900,
            fontSize: '0.74rem',
            padding: '4px 12px',
            borderRadius: 20,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            {badge}
          </span>

          {imageUrl && (
            <span style={{ color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              🔍 ઝૂમ માટે ક્લિક કરો
            </span>
          )}
        </div>

        {/* 🌟 Direct Poster Image UI (Prominent Visual Showcase) 🌟 */}
        {imageUrl && (
          <div
            onClick={() => onZoom?.(imageUrl)}
            style={{
              width: '100%',
              height: 280,
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 16,
              cursor: 'zoom-in',
              background: 'radial-gradient(circle at center, #1e293b 0%, #0b0f19 100%)',
              border: '1.5px solid rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.4)'
            }}
            title="ક્લિક કરીને ફુલ સાઈઝ મોટું પોસ્ટર જુઓ (Zoom HD)"
          >
            <img
              src={imageUrl}
              alt={title || 'Course Poster'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              background: 'rgba(15,23,42,0.85)',
              border: '1px solid rgba(56,189,248,0.4)',
              color: '#38bdf8',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backdropFilter: 'blur(6px)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
            }}>
              <Maximize2 size={12} /> Zoom HD
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className="gu-text" style={{ fontWeight: 900, fontSize: '1.15rem', color: '#ffffff', marginBottom: 6, lineHeight: 1.35 }}>
          {title}
        </h3>

        {subtitle && (
          <div style={{ color: '#fbbf24', fontSize: '0.84rem', fontWeight: 800, marginBottom: 8 }}>
            {subtitle}
          </div>
        )}

        <p className="gu-text" style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: 14 }}>
          {description}
        </p>
      </div>

      <div>
        {/* ── Coupon Code Voucher Box ── */}
        {couponCode && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(15,23,42,0.6))',
            border: '1.5px dashed rgba(245,158,11,0.55)',
            borderRadius: 10,
            padding: '8px 12px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            boxShadow: 'inset 0 0 12px rgba(245,158,11,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ticket size={16} />
              </div>
              <div>
                <div style={{ color: '#93c5fd', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                  🎟️ કૂપન કોડ (COUPON):
                </div>
                <div style={{ color: '#fde047', fontWeight: 900, fontSize: '0.96rem', letterSpacing: '1px', fontFamily: 'monospace' }}>
                  {couponCode}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopyCode(couponCode)}
              style={{
                background: copied ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'rgba(255,255,255,0.12)',
                color: copied ? 'white' : '#fde047',
                border: copied ? '1px solid #22c55e' : '1px solid rgba(245,158,11,0.4)',
                padding: '5px 11px',
                borderRadius: 6,
                fontSize: '0.74rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'Hind Vadodara, sans-serif',
                transition: 'all 0.2s',
                boxShadow: copied ? '0 2px 8px rgba(34,197,94,0.4)' : 'none'
              }}
              title="કૂપન કોડ કૉપી કરો"
            >
              {copied ? (
                <>
                  <Check size={13} /> કૉપી થયું!
                </>
              ) : (
                <>
                  <Copy size={13} /> કૉપી કરો
                </>
              )}
            </button>
          </div>
        )}

        {/* Pricing */}
        {price && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
            {oldPrice && (
              <span style={{ textDecoration: 'line-through', color: '#64748b', fontSize: '1rem', fontWeight: 700 }}>
                {oldPrice}
              </span>
            )}
            <span style={{ fontSize: '1.55rem', fontWeight: 900, color: '#4ade80' }}>
              {price}
            </span>
          </div>
        )}

        {/* CTA WhatsApp Button */}
        <a
          href="https://play.google.com/store/apps/details?id=co.bolton.unhnx"
          target="_blank"
          rel="noreferrer"
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)',
            color: 'white',
            width: '100%',
            justifyContent: 'center',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 0',
            borderRadius: 10,
            fontWeight: 900,
            fontSize: '0.92rem',
            boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}
        >
          📱 એપ્લિકેશન પર મેળવો →
        </a>
      </div>
    </div>
  );
}

