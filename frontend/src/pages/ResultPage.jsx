import { useState } from 'react';
import Navbar from '../components/Navbar';
import { getMySubmissions } from '../services/api';
import ResultCard from '../components/ResultCard';

export default function ResultPage() {
  const [mobile, setMobile] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (mobile.length !== 10) { setError('10 digits mobile number આપો.'); return; }
    setError('');
    setLoading(true);
    try {
      // Use token from localStorage if available, else prompt
      const res = await getMySubmissions();
      setSubmissions(res.data);
      setSearched(true);
    } catch (err) {
      setError('Result ન મળ્યું. Mobile number ચેક કરો.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <Navbar />
      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 16px' }}>
        <div className="card animate-fade-in" style={{ padding: '32px', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📊</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
            ટેસ્ટ Results
          </h2>
          <p className="gu-text" style={{ color: '#64748b', marginBottom: 24 }}>
            Login ના Mobile Numberથી Results ચેક કરો
          </p>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, maxWidth: 380, margin: '0 auto' }}>
            <input
              className="input-field"
              type="tel" inputMode="numeric" maxLength={10}
              placeholder="Mobile Number (10 digits)"
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳' : '🔍'}
            </button>
          </form>
          {error && <p style={{ color: '#ef4444', marginTop: 12, fontWeight: 600, fontSize: '0.9rem' }}>{error}</p>}
        </div>

        {searched && submissions.length === 0 && (
          <div className="card" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <p className="gu-text">આ mobile number નો કોઈ submission નથી.</p>
          </div>
        )}

        {submissions.map((sub, i) => (
          <ResultCard
            key={sub.id}
            result={sub}
            questions={[]}
            answers={{}}
            onRetry={() => window.location.href = '/exam'}
          />
        ))}
      </div>
    </div>
  );
}
