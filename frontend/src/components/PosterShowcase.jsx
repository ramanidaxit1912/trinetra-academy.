const POSTERS = [
  {
    img: '/images/poster_maths.png',
    subject: 'TET-2 ગણિત (ધોરણ ૬-૮)',
    desc: 'ચેપ્ટર વાઈઝ MCQ ટેસ્ટ સિરીઝ + પ્રેક્ટીસ PDF (નવા પાઠ્યપુસ્તક સાથે)',
    price: '₹149', oldPrice: '₹299',
    tag: '50% OFF',
    tagColor: '#2563eb',
    features: ['ધોરણ-6 નવા પાઠ્યપુસ્તક', 'Chapter-wise MCQ Test', 'Solution PDF'],
    wa: 'I want TET-2 Maths Test Series Rs.149',
    badge: 'BEST SELLER',
    highlight: true,
  },
  {
    img: '/images/poster_science.png',
    subject: 'TET-2 વિજ્ઞાન (ધોરણ ૬-૮)',
    desc: 'ચેપ્ટર વાઈઝ ઓનલાઈન MCQ ટેસ્ટ + કૂતૂહલ & પાઠ્યપુસ્તક PDF',
    price: '₹149', oldPrice: '₹299',
    tag: '50% OFF',
    tagColor: '#059669',
    features: ['કૂતૂહલ Coverage', 'Chapter-wise Test', 'Full PDF Material'],
    wa: 'I want TET-2 Science Test Series Rs.149',
  },
  {
    img: '/images/poster_social.png',
    subject: 'TET-2 સામાજિક વિજ્ઞાન',
    desc: 'ભારત અને તેના આગળ, સમાજ શોધયાત્રા - Chapter-wise MCQ',
    price: '₹149', oldPrice: '₹299',
    tag: '50% OFF',
    tagColor: '#7c3aed',
    features: ['Social Science Full', 'Chapter-wise Practice', 'MCQ + Explanation'],
    wa: 'I want TET-2 Social Science Test Series Rs.149',
  },
  {
    img: '/images/poster_gujarati.png',
    subject: 'ગુજરાતી વર્ણનાત્મક PDF',
    desc: 'ALL Lecture PDF, ગુજરાતી વ્યાકરણ PDF, સંદર્ભ સાહિત્ય + FULL Mock Test PDF',
    price: '₹99',
    tag: 'SUPER SAVER',
    tagColor: '#d97706',
    features: ['ALL Lecture PDF', 'Grammar PDF', 'Full Mock Test'],
    wa: 'I want Gujarati Varnanatmak Material PDF Rs.99',
  },
];

export default function PosterShowcase({ onPosterClick }) {
  return (
    <section id="courses" style={{ padding: 'clamp(36px,6vw,64px) 16px', background: '#0b1120' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-block', background: 'rgba(37,99,235,0.15)', color: '#60a5fa', fontWeight: 800, fontSize: '0.8rem', padding: '4px 14px', borderRadius: 20, marginBottom: 8, border: '1px solid rgba(37,99,235,0.3)' }}>
            📚 વિષયવાર કોર્સ
          </div>
          <h2 style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 900, color: 'white', marginBottom: 8 }}>
            TET-2 Study Material & Test Series
          </h2>
          <p className="gu-text" style={{ color: '#94a3b8', fontSize: 'clamp(0.88rem,3vw,1rem)' }}>
            Trinetra Academy ના ઉચ્ચ ગુણવત્તાવાળા MCQ ટેસ્ટ સિરીઝ અને PDF મટીરીયલ
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 20 }}>
          {POSTERS.map((p, i) => (
            <div key={i}
              style={{
                background: '#1e293b',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 36px rgba(0,0,0,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
            >
              
              {p.badge && (
                <div style={{ position: 'absolute', top: 12, left: 12, background: '#f59e0b', color: 'white', fontWeight: 900, fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20, zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                  {p.badge}
                </div>
              )}

              <div
                onClick={() => onPosterClick?.(p.img)}
                style={{ background: '#0f172a', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: onPosterClick ? 'zoom-in' : 'default', position: 'relative' }}
                title="ક્લિક કરીને મોટું પોસ્ટર જુઓ"
              >
                <img src={p.img} alt={p.subject} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              </div>

              <div style={{ padding: '18px 18px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ background: p.tagColor + '25', color: p.tagColor, border: `1px solid ${p.tagColor}50`, fontWeight: 800, fontSize: '0.74rem', padding: '3px 9px', borderRadius: 6, marginBottom: 10, display: 'inline-block' }}>
                    {p.tag}
                  </span>
                  <h3 className="gu-text" style={{ fontWeight: 900, fontSize: '1.05rem', color: '#ffffff', marginBottom: 8 }}>{p.subject}</h3>
                  <p className="gu-text" style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.55, marginBottom: 12 }}>{p.desc}</p>

                  <ul style={{ listStyle: 'none', marginBottom: 16, padding: 0 }}>
                    {p.features.map((f, j) => (
                      <li key={j} style={{ color: '#cbd5e1', fontSize: '0.84rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#4ade80', fontWeight: 800 }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                    {p.oldPrice && <span style={{ textDecoration: 'line-through', color: '#64748b', fontSize: '0.92rem' }}>{p.oldPrice}</span>}
                    <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#4ade80' }}>{p.price}</span>
                  </div>

                  <a
                    href={`https://wa.me/918200405300?text=${encodeURIComponent(p.wa)}`}
                    target="_blank" rel="noreferrer"
                    className="btn-whatsapp"
                    style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex', padding: '11px 0', borderRadius: 8, fontWeight: 900, fontSize: '0.88rem' }}
                  >
                    💬 WhatsApp કરો
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

