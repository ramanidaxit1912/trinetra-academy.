import { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  KeyRound,
  Smartphone,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Copy,
  Check,
  UserCheck,
  UserX,
  FileSpreadsheet
} from 'lucide-react';
import {
  getEnrolledStudentsOtps,
  resetOtpByMobile,
  resetStudentSession,
  grantMasterByMobile
} from '../services/api';

export default function EnrolledStudentsOtpManager({ showToast }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'has_otp' | 'logged_in' | 'pending'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedMobile, setCopiedMobile] = useState(null);

  const fetchEnrolledOtps = async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    try {
      const res = await getEnrolledStudentsOtps({ q: search });
      setStudents(res.data?.students || []);
    } catch (err) {
      console.error('Fetch Enrolled OTPs error:', err);
      showToast?.('એડમિશન OTP ડેટા લોડ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      if (showLoadingState) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrolledOtps(true);
    // Auto-poll every 12 seconds to see live incoming OTP requests
    const interval = setInterval(() => {
      fetchEnrolledOtps(false);
    }, 12000);
    return () => clearInterval(interval);
  }, [search]);

  // Copy mobile to clipboard
  const handleCopyMobile = (mobile) => {
    navigator.clipboard.writeText(mobile);
    setCopiedMobile(mobile);
    showToast?.(`📋 નંબર ${mobile} કૉપી થયો!`, 'success');
    setTimeout(() => setCopiedMobile(null), 2000);
  };

  // 1-Click Reset OTP Limit
  const handleResetOtp = async (student) => {
    if (!window.confirm(`શું તમે વિદ્યાર્થી "${student.name}" (${student.mobile}) ની OTP મર્યાદા રીસેટ કરવા માંગો છો?\nઆનાથી વિદ્યાર્થી તરત જ નવો OTP મંગાવી શકશે.`)) return;
    setActionLoadingId(`otp_${student.id}`);
    try {
      const res = await resetOtpByMobile({ mobile: student.mobile });
      showToast?.(res.data?.message || '✅ OTP મર્યાદા રીસેટ થઈ ગઈ!', 'success');
      fetchEnrolledOtps(false);
    } catch {
      showToast?.('OTP રીસેટ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Reset Device Session
  const handleResetSession = async (student) => {
    if (!student.registeredStudentId) {
      return showToast?.('વિદ્યાર્થીએ હજુ એકપણ વાર લૉગિન નથી કર્યું.', 'warning');
    }
    if (!window.confirm(`શું તમે વિદ્યાર્થી "${student.name}" (${student.mobile}) નું ડિવાઇસ સેશન અનલોક કરવા માંગો છો?`)) return;
    setActionLoadingId(`session_${student.id}`);
    try {
      const res = await resetStudentSession(student.registeredStudentId);
      showToast?.(res.data?.message || '✅ સેશન અનલોક થયું!', 'success');
      fetchEnrolledOtps(false);
    } catch {
      showToast?.('સેશન રીસેટ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Grant 60-min Master PIN
  const handleGrantMasterPin = async (student) => {
    const isCurrentlyAllowed = student.masterAccessAllowed && (!student.masterAccessExpiresAt || new Date(student.masterAccessExpiresAt) > new Date());
    const actionText = isCurrentlyAllowed ? 'રદ (Revoke)' : '૬૦ મિનિટ માટે મંજૂર (Grant 1 Hour)';
    if (!window.confirm(`શું તમે "${student.name}" (${student.mobile}) માટે Master PIN (191219) એક્સેસ ${actionText} કરવા માંગો છો?`)) return;

    setActionLoadingId(`master_${student.id}`);
    try {
      const res = await grantMasterByMobile({
        mobile: student.mobile,
        name: student.name || 'Student',
        minutes: isCurrentlyAllowed ? 0 : 60
      });
      showToast?.(res.data?.message || '✅ Master Access અપડેટ થયો!', 'success');
      fetchEnrolledOtps(false);
    } catch {
      showToast?.('Master Access આપવામાં ભૂલ આવી.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    if (filterMode === 'has_otp') return !!s.latestOtp;
    if (filterMode === 'logged_in') return s.isRegistered;
    if (filterMode === 'pending') return !s.isRegistered;
    return true;
  });

  // Calculate stats
  const totalEnrolled = students.length;
  const loggedInCount = students.filter(s => s.isRegistered).length;
  const pendingCount = students.filter(s => !s.isRegistered).length;
  const activeOtpCount = students.filter(s => s.latestOtp && !s.latestOtp.isExpired && !s.latestOtp.used).length;

  // ─── Export Styled Excel (.xlsx) ──────────────────────────────
  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'ત્રિનેત્ર ઓનલાઇન એકેડેમી';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('એડમિશન OTP & લૉગિન ડેટા', {
        views: [{ showGridLines: true }]
      });

      // Title Banner
      worksheet.mergeCells('A1:I1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = '🎓 ત્રિનેત્ર એકેડેમી — એડમિશન વિદ્યાર્થીઓનો OTP & લૉગિન ડેટા રિપોર્ટ';
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 32;

      // Table Header Row
      const headerRow = worksheet.addRow([
        'ક્રમ (No.)',
        'વિદ્યાર્થીનું નામ (Name)',
        'મોબાઈલ નંબર (Mobile)',
        'બેચ (Batch)',
        'લૉગિન સ્થિતિ (Status)',
        'છેલ્લો OTP કોડ (Latest OTP)',
        'OTP સ્થિતિ (OTP Status)',
        'OTP મંગાવ્યાનો સમય (Time)',
        'આપેલી કસોટીઓ (Tests)'
      ]);
      headerRow.height = 26;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Data Rows
      filteredStudents.forEach((s, idx) => {
        const isEven = idx % 2 === 0;
        const otpText = s.latestOtp ? s.latestOtp.otp : '—';
        let otpStatusText = 'કોઈ OTP નથી';
        if (s.latestOtp) {
          if (s.latestOtp.used) otpStatusText = 'વપરાયેલ (Used)';
          else if (s.latestOtp.isExpired) otpStatusText = 'સમય સમાપ્ત (Expired)';
          else otpStatusText = 'સક્રિય (Active)';
        }
        const otpTime = s.latestOtp?.createdAt
          ? new Date(s.latestOtp.createdAt).toLocaleString('gu-IN', { dateStyle: 'short', timeStyle: 'short' })
          : '—';

        const row = worksheet.addRow([
          idx + 1,
          s.name || 'વિદ્યાર્થી',
          s.mobile ? String(s.mobile) : '',
          s.batch || 'Trinetra Regular',
          s.isRegistered ? 'લૉગિન થયેલ' : 'લૉગિન બાકી',
          otpText,
          otpStatusText,
          otpTime,
          s.submissionsCount || 0
        ]);
        row.height = 22;

        const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          if (colNum === 1 || colNum === 4 || colNum === 5 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 9) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.numFmt = '@';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }

          // Highlight OTP column
          if (colNum === 6 && s.latestOtp) {
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E40AF' } };
          }
        });
      });

      worksheet.columns = [
        { width: 12 }, // No.
        { width: 28 }, // Name
        { width: 20 }, // Mobile
        { width: 22 }, // Batch
        { width: 18 }, // Status
        { width: 20 }, // Latest OTP
        { width: 20 }, // OTP Status
        { width: 24 }, // Time
        { width: 18 }, // Tests
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Trinetra_Admission_OTP_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      showToast?.('📥 એક્સેલ રિપોર્ટ સફળતાપૂર્વક ડાઉનલોડ થયો!', 'success');
    } catch (e) {
      console.error('Export error:', e);
      showToast?.('એક્સેલ એક્સપોર્ટ કરવામાં ક્ષતિ આવી.', 'error');
    }
  };

  return (
    <div className="animate-fade-in">
      {/* ── Stats Overview ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#93c5fd', fontSize: '0.76rem', fontWeight: 800 }}>કુલ એડમિશન વિદ્યાર્થીઓ</span>
            <ShieldCheck size={18} color="#60a5fa" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffffff' }}>{totalEnrolled}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>એક્સેલ વ્હાઇટલિસ્ટમાં નોંધાયેલા</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#6ee7b7', fontSize: '0.76rem', fontWeight: 800 }}>લૉગિન થયેલા (Active)</span>
            <UserCheck size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>{loggedInCount}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>એકાઉન્ટ બનાવી સક્રિય થયા</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(146, 64, 14, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#fde68a', fontSize: '0.76rem', fontWeight: 800 }}>પ્રથમ લૉગિન બાકી</span>
            <UserX size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fbbf24' }}>{pendingCount}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>હજુ સુધી લૉગિન નથી કર્યું</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 14,
          padding: '14px 16px',
          boxShadow: '0 4px 14px rgba(168, 85, 247, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#d8b4fe', fontSize: '0.76rem', fontWeight: 800 }}>લાઇવ / સક્રિય OTPs</span>
            <KeyRound size={18} color="#c084fc" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#c084fc' }}>{activeOtpCount}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>હાલમાં માન્ય OTP કોડ્સ</div>
        </div>
      </div>

      {/* ── Search, Filter & Action Bar ── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: '14px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="વિદ્યાર્થીનું નામ, ૧૦ આંકડાનો મોબાઈલ કે બેચ શોધો..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              paddingLeft: 36,
              paddingRight: 12,
              background: 'rgba(2, 6, 23, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 10,
              color: '#ffffff',
              fontSize: '0.84rem',
              outline: 'none',
              fontFamily: 'Hind Vadodara, sans-serif'
            }}
          />
        </div>

        {/* Filter Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `તમામ (${students.length})` },
            { id: 'has_otp', label: `🔐 OTP ધરાવતા (${students.filter(s => s.latestOtp).length})` },
            { id: 'logged_in', label: `🟢 લૉગિન થયેલા (${loggedInCount})` },
            { id: 'pending', label: `🟡 લૉગિન બાકી (${pendingCount})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterMode(f.id)}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: filterMode === f.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                background: filterMode === f.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: filterMode === f.id ? '#38bdf8' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'Hind Vadodara, sans-serif'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Action Buttons: Refresh & Excel Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => fetchEnrolledOtps(true)}
            disabled={loading}
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'Hind Vadodara, sans-serif'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>રીફ્રેશ</span>
          </button>

          <button
            onClick={exportExcel}
            style={{
              height: 38,
              padding: '0 16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              fontFamily: 'Hind Vadodara, sans-serif'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Excel ડાઉનલોડ</span>
          </button>
        </div>
      </div>

      {/* ── Table View ── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        {loading && students.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#38bdf8' }} />
            <div style={{ fontWeight: 800 }}>એડમિશન OTP ડેટા લોડ થઈ રહ્યો છે...</div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <KeyRound size={36} style={{ margin: '0 auto 12px', color: '#64748b', opacity: 0.6 }} />
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#cbd5e1' }}>કોઈ વિદ્યાર્થી મળ્યા નથી</div>
            <div style={{ fontSize: '0.82rem', marginTop: 4 }}>શોધ શબ્દ બદલીને ફરી પ્રયાસ કરો.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1.5px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800, width: 60 }}>ક્રમ</th>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>વિદ્યાર્થી & બેચ</th>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>મોબાઈલ નંબર</th>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>છેલ્લો OTP કોડ</th>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>લૉગિન સ્થિતિ</th>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800 }}>કસોટીઓ</th>
                  <th style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.78rem', fontWeight: 800, textAlign: 'center' }}>શિક્ષક કંટ્રોલ્સ</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s, idx) => {
                  const hasActiveOtp = s.latestOtp && !s.latestOtp.isExpired && !s.latestOtp.used;
                  const isMasterAllowed = s.masterAccessAllowed && (!s.masterAccessExpiresAt || new Date(s.masterAccessExpiresAt) > new Date());

                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: hasActiveOtp ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = hasActiveOtp ? 'rgba(56, 189, 248, 0.05)' : 'transparent'; }}
                    >
                      {/* No. */}
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>
                        {idx + 1}
                      </td>

                      {/* Name & Batch */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9rem' }}>
                          {s.name || 'વિદ્યાર્થી'}
                        </div>
                        <span style={{
                          display: 'inline-block',
                          marginTop: 4,
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#fbbf24',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6
                        }}>
                          🎓 {s.batch || 'Trinetra Regular'}
                        </span>
                      </td>

                      {/* Mobile */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.04em' }}>
                            +91 {s.mobile}
                          </span>
                          <button
                            onClick={() => handleCopyMobile(s.mobile)}
                            title="નંબર કૉપી કરો"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedMobile === s.mobile ? '#34d399' : '#64748b',
                              cursor: 'pointer',
                              padding: 4,
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            {copiedMobile === s.mobile ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>

                      {/* Latest OTP Code */}
                      <td style={{ padding: '14px 16px' }}>
                        {s.latestOtp ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{
                                background: hasActiveOtp
                                  ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                                  : s.latestOtp.used
                                  ? 'rgba(100, 116, 139, 0.3)'
                                  : 'rgba(239, 68, 68, 0.2)',
                                border: hasActiveOtp
                                  ? '1.5px solid #38bdf8'
                                  : s.latestOtp.used
                                  ? '1px solid rgba(148, 163, 184, 0.3)'
                                  : '1px solid rgba(239, 68, 68, 0.4)',
                                color: hasActiveOtp ? '#ffffff' : s.latestOtp.used ? '#cbd5e1' : '#f87171',
                                fontSize: '1.05rem',
                                fontWeight: 900,
                                fontFamily: 'monospace',
                                letterSpacing: '0.12em',
                                padding: '4px 10px',
                                borderRadius: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: hasActiveOtp ? '0 0 12px rgba(56, 189, 248, 0.4)' : 'none'
                              }}>
                                <KeyRound size={14} />
                                {s.latestOtp.otp}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {hasActiveOtp ? (
                                <span style={{ color: '#38bdf8', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
                                  સક્રિય (Active)
                                </span>
                              ) : s.latestOtp.used ? (
                                <span style={{ color: '#10b981', fontWeight: 700 }}>✓ વપરાયેલ (Used)</span>
                              ) : (
                                <span style={{ color: '#f87171', fontWeight: 700 }}>⏰ સમય સમાપ્ત (Expired)</span>
                              )}
                              <span>•</span>
                              <span>{new Date(s.latestOtp.createdAt).toLocaleTimeString('gu-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            હજુ OTP નથી મંગાવ્યો
                          </span>
                        )}
                      </td>

                      {/* Login Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {s.isRegistered ? (
                          <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#34d399', fontWeight: 800, fontSize: '0.82rem' }}>
                              <CheckCircle2 size={14} />
                              <span>સક્રિય એકાઉન્ટ</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                              છેલ્લું લૉગિન: {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('gu-IN') : '—'}
                            </div>
                            {isMasterAllowed && (
                              <span style={{
                                display: 'inline-block',
                                marginTop: 3,
                                background: 'rgba(234, 88, 12, 0.2)',
                                border: '1px solid rgba(234, 88, 12, 0.4)',
                                color: '#fb923c',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: 4
                              }}>
                                🔑 Master PIN ચાલુ
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#fbbf24', fontWeight: 800, fontSize: '0.82rem' }}>
                            <Clock size={14} />
                            <span>લૉગિન બાકી</span>
                          </div>
                        )}
                      </td>

                      {/* Tests Taken */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          padding: '3px 8px',
                          borderRadius: 8
                        }}>
                          {s.submissionsCount || 0} કસોટીઓ
                        </span>
                      </td>

                      {/* Teacher Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {/* Reset OTP Rate-limit */}
                          <button
                            onClick={() => handleResetOtp(s)}
                            disabled={actionLoadingId === `otp_${s.id}`}
                            title="OTP લિમિટ રીસેટ કરો (વિદ્યાર્થી નવો OTP તરત મંગાવી શકે)"
                            style={{
                              background: 'rgba(56, 189, 248, 0.12)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'Hind Vadodara, sans-serif'
                            }}
                          >
                            <RefreshCw size={13} className={actionLoadingId === `otp_${s.id}` ? 'animate-spin' : ''} />
                            <span>OTP રીસેટ</span>
                          </button>

                          {/* Unlock Device Session */}
                          <button
                            onClick={() => handleResetSession(s)}
                            disabled={!s.isRegistered || actionLoadingId === `session_${s.id}`}
                            title={s.isRegistered ? "સિંગલ ડિવાઇસ લૉગિન અનલોક કરો" : "વિદ્યાર્થી હજુ રજીસ્ટર્ડ નથી"}
                            style={{
                              background: s.isRegistered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                              border: s.isRegistered ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: s.isRegistered ? '#34d399' : '#64748b',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: s.isRegistered ? 'pointer' : 'not-allowed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'Hind Vadodara, sans-serif'
                            }}
                          >
                            <Unlock size={13} className={actionLoadingId === `session_${s.id}` ? 'animate-spin' : ''} />
                            <span>સેશન અનલોક</span>
                          </button>

                          {/* Master PIN Access */}
                          <button
                            onClick={() => handleGrantMasterPin(s)}
                            disabled={actionLoadingId === `master_${s.id}`}
                            title="SMS/WhatsApp મોડું થાય તો Master PIN (191219) એક્સેસ આપો"
                            style={{
                              background: isMasterAllowed ? 'rgba(234, 88, 12, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                              border: isMasterAllowed ? '1px solid #f97316' : '1px solid rgba(255, 255, 255, 0.12)',
                              color: isMasterAllowed ? '#fb923c' : '#cbd5e1',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontFamily: 'Hind Vadodara, sans-serif'
                            }}
                          >
                            <KeyRound size={13} className={actionLoadingId === `master_${s.id}` ? 'animate-spin' : ''} />
                            <span>{isMasterAllowed ? 'PIN સક્રિય' : 'Master PIN'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
