import React, { Component } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store/useStore';
import HomePage from './pages/HomePage';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import TeacherPage from './pages/TeacherPage';
import StudentDashboard from './pages/StudentDashboard';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Captured React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    localStorage.removeItem('role');
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: 20, color: 'white', fontFamily: 'Hind Vadodara, system-ui, sans-serif' }}>
          <div style={{ background: '#1e293b', border: '1.5px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: '32px 24px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 8px 0', color: '#fca5a5' }}>
              ત્રિનેત્ર એકેડેમી પોર્ટલ - પેજ લોડ ક્ષતિ
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              {this.state.error?.message || 'બ્રાઉઝર કેશ અથવા ડેટા લોડિંગ ક્ષતિ. કૃપા કરીને નીચે આપેલા બટન પર ક્લિક કરો.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: 'linear-gradient(135deg, #2563eb, #38bdf8)', color: 'white', border: 'none', padding: '10px 22px', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                🔄 ફરીથી લોડ કરો (Refresh)
              </button>
              <button
                onClick={this.handleReset}
                style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', padding: '10px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                🏠 હોમ પેજ પર જાઓ
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"        element={<HomePage />} />
            <Route path="/exam"    element={<ExamPage />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/result"  element={<ResultPage />} />
            <Route path="/teacher" element={<TeacherPage />} />
            <Route path="/trinetra-secure-desk" element={<TeacherPage />} />
            <Route path="*"        element={<HomePage />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  );
}
