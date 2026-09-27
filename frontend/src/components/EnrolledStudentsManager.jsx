import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  UploadCloud,
  Download,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  X
} from 'lucide-react';
import {
  getEnrolledStudents,
  bulkImportEnrolledStudents,
  addEnrolledStudent,
  deleteEnrolledStudent,
  clearAllEnrolledStudents
} from '../services/api';

export default function EnrolledStudentsManager({ showToast }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Single Add form
  const [singleMobile, setSingleMobile] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleBatch, setSingleBatch] = useState('Trinetra Regular');
  const [addingSingle, setAddingSingle] = useState(false);

  // Bulk Upload state
  const [uploading, setUploading] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);

  const fetchEnrolled = async () => {
    setLoading(true);
    try {
      const res = await getEnrolledStudents({ q: search });
      setStudents(res.data?.students || []);
      setTotalCount(res.data?.totalCount || 0);
    } catch (err) {
      console.error('Fetch enrolled error:', err);
      showToast?.('એડમિશન લિસ્ટ લોડ કરવામાં ક્ષતિ આવી.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrolled();
  }, [search]);

  // ─── Download Sample Excel Template ──────────────────────────
  const downloadSampleTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      const sampleData = [
        {
          'મોબાઈલ નંબર (Mobile No)': '9876543210',
          'વિદ્યાર્થીનું નામ (Student Name)': 'રાહુલ પટેલ',
          'બેચ (Batch)': 'TAT-S 2026'
        },
        {
          'મોબાઈલ નંબર (Mobile No)': '9123456789',
          'વિદ્યાર્થીનું નામ (Student Name)': 'પ્રિયા શર્મા',
          'બેચ (Batch)': 'TAT-HS 2026'
        },
        {
          'મોબાઈલ નંબર (Mobile No)': '8899776655',
          'વિદ્યાર્થીનું નામ (Student Name)': 'અજય દેસાઈ',
          'બેચ (Batch)': 'GPSC Special'
        },
        {
          'મોબાઈલ નંબર (Mobile No)': '7766554433',
          'વિદ્યાર્થીનું નામ (Student Name)': 'કિશન વાઘેલા',
          'બેચ (Batch)': 'Trinetra Regular'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(sampleData);

      // Auto-fit column widths
      ws['!cols'] = [
        { wch: 25 },
        { wch: 30 },
        { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Admission_Students');
      XLSX.writeFile(wb, 'Trinetra_Admission_Students_Template.xlsx');
      showToast?.('📥 એક્સેલ ટેમ્પ્લેટ ડાઉનલોડ થઈ ગયું!', 'success');
    } catch (err) {
      console.error('Template download error:', err);
      showToast?.('ટેમ્પ્લેટ ડાઉનલોડ કરવામાં ભૂલ.', 'error');
    }
  };

  // ─── Handle Excel File Selection & Parse ─────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast?.('આ ફાઇલમાં કોઈ ડેટા મળ્યો નથી.', 'error');
          setParsedPreview(null);
          return;
        }

        // Normalize rows to extract mobile, name, batch
        const parsed = rawJson.map((row) => {
          let mobile = '';
          let name = '';
          let batch = 'Trinetra Regular';

          for (const key of Object.keys(row)) {
            const k = key.toLowerCase().trim();
            const val = String(row[key] || '').trim();

            if (k.includes('mobile') || k.includes('phone') || k.includes('મોબાઈલ') || k.includes('મોબાઇલ') || k.includes('નંબર')) {
              mobile = val;
            } else if (k.includes('name') || k.includes('નામ') || k.includes('student')) {
              name = val;
            } else if (k.includes('batch') || k.includes('બેચ') || k.includes('કોર્સ')) {
              batch = val || 'Trinetra Regular';
            }
          }

          // If keys didn't match, check first numeric column
          if (!mobile) {
            for (const key of Object.keys(row)) {
              const val = String(row[key] || '').replace(/\D/g, '');
              if (val.length >= 10) {
                mobile = val;
                break;
              }
            }
          }

          const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
          const isValid = cleanMobile.length === 10 && /^[6-9]/.test(cleanMobile);

          return {
            mobile: cleanMobile,
            name: name || 'વિદ્યાર્થી',
            batch: batch || 'Trinetra Regular',
            isValid
          };
        });

        const validCount = parsed.filter(p => p.isValid).length;
        setParsedPreview({
          totalRows: parsed.length,
          validCount,
          invalidCount: parsed.length - validCount,
          rows: parsed
        });

        showToast?.(`✅ ફાઇલ વંચાઈ ગઈ: ${validCount} માન્ય મોબાઈલ નંબર મળ્યા.`, 'info');
      } catch (parseErr) {
        console.error('File parsing error:', parseErr);
        showToast?.('ફાઇલ વાંચવામાં ક્ષતિ આવી. કૃપા કરીને સાચી .xlsx કે .csv ફાઇલ આપો.', 'error');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ─── Confirm & Upload Parsed Students ────────────────────────
  const handleConfirmUpload = async () => {
    if (!parsedPreview || parsedPreview.validCount === 0) {
      return showToast?.('અપલોડ કરવા માટે કોઈ માન્ય મોબાઈલ નંબર નથી.', 'error');
    }

    setUploading(true);
    try {
      const validStudents = parsedPreview.rows
        .filter(r => r.isValid)
        .map(r => ({ mobile: r.mobile, name: r.name, batch: r.batch }));

      const res = await bulkImportEnrolledStudents({ students: validStudents });
      showToast?.(res.data?.message || '✅ વિદ્યાર્થીઓ સફળતાપૂર્વક ઉમેરાઈ ગયા!', 'success');
      setParsedPreview(null);
      setUploadFile(null);
      fetchEnrolled();
    } catch (err) {
      console.error('Bulk upload error:', err);
      showToast?.(err.response?.data?.error || 'અપલોડ કરવામાં ભૂલ આવી.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ─── Add Single Student ──────────────────────────────────────
  const handleAddSingle = async (e) => {
    e.preventDefault();
    const clean = singleMobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10 || !/^[6-9]/.test(clean)) {
      return showToast?.('કૃપા કરીને માન્ય ૧૦ આંકડાનો ભારતીય મોબાઈલ નંબર લખો.', 'error');
    }

    setAddingSingle(true);
    try {
      const res = await addEnrolledStudent({
        mobile: clean,
        name: singleName.trim(),
        batch: singleBatch.trim()
      });
      showToast?.(res.data?.message || '✅ વિદ્યાર્થી સફળતાપૂર્વક ઉમેરાયો!', 'success');
      setSingleMobile('');
      setSingleName('');
      fetchEnrolled();
    } catch (err) {
      showToast?.(err.response?.data?.error || 'ઉમેરવામાં ભૂલ આવી.', 'error');
    } finally {
      setAddingSingle(false);
    }
  };

  // ─── Delete Single Student ───────────────────────────────────
  const handleDelete = async (id, name, mobile) => {
    if (!window.confirm(`શું તમે ખરેખર ${name || 'વિદ્યાર્થી'} (${mobile}) ને ત્રિનેત્ર એડમિશન લિસ્ટમાંથી દૂર કરવા માંગો છો?`)) return;

    try {
      await deleteEnrolledStudent(id);
      showToast?.('✅ વિદ્યાર્થી દૂર કરવામાં આવ્યો.', 'success');
      setStudents(prev => prev.filter(s => s.id !== id));
      setTotalCount(c => Math.max(0, c - 1));
    } catch {
      showToast?.('દૂર કરવામાં ભૂલ આવી.', 'error');
    }
  };

  // ─── Clear All ───────────────────────────────────────────────
  const handleClearAll = async () => {
    if (!window.confirm(`⚠️ ચેતવણી: શું તમે ખરેખર તમામ (${totalCount}) એડમિશન વિદ્યાર્થીઓને ડેટાબેઝમાંથી સાફ કરવા માંગો છો?\nઆ પછી જ્યાં સુધી નવી એક્સેલ નહીં નાખો ત્યાં સુધી કોઈ પણ 'Trinetra Only' ટેસ્ટ નહીં આપી શકે!`)) return;

    try {
      const res = await clearAllEnrolledStudents();
      showToast?.(res.data?.message || 'તમામ એડમિશન લિસ્ટ સાફ થઈ ગયું.', 'info');
      setStudents([]);
      setTotalCount(0);
    } catch {
      showToast?.('સાફ કરવામાં ભૂલ આવી.', 'error');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ─── Top Info Banner ─── */}
      <div className="glass-card" style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))',
            border: '1px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ color: 'white', fontWeight: 900, fontSize: '1.18rem', margin: 0 }}>
                🎓 ત્રિનેત્ર એડમિશન સ્ટુડન્ટ્સ (Master Admission Whitelist)
              </h3>
              <span style={{
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid #22c55e',
                color: '#4ade80',
                padding: '2px 10px',
                borderRadius: 20,
                fontSize: '0.74rem',
                fontWeight: 800
              }}>
                {totalCount} વિદ્યાર્થીઓ સક્રિય
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 3 }}>
              અહીં નોંધાયેલા વિદ્યાર્થીઓ જ <strong>'🔒 ત્રિનેત્ર એડમિશન ઓન્લી'</strong> વાળી તમામ પ્રીમિયમ કસોટીઓ આપી શકશે.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={downloadSampleTemplate}
            title="નમૂનાની એક્સેલ ફાઈલ ડાઉનલોડ કરો"
            style={{
              height: 38,
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              padding: '0 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'Hind Vadodara, sans-serif'
            }}>
            <Download size={15} /> 📥 એક્સેલ ટેમ્પ્લેટ ડાઉનલોડ
          </button>
          <button
            onClick={fetchEnrolled}
            title="રિફ્રેશ કરો"
            style={{
              height: 38,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              padding: '0 12px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ─── Excel Bulk Upload & Single Add Grid ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {/* Bulk Excel Upload Card */}
        <div className="glass-card" style={{
          padding: '16px 18px',
          background: 'rgba(255, 255, 255, 0.025)',
          border: '1.5px dashed rgba(56, 189, 248, 0.35)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileSpreadsheet size={16} /> 📂 Excel / CSV બલ્ક અપલોડ (એકસાથે 50-500 વિદ્યાર્થીઓ)
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.45, margin: '0 0 12px 0' }}>
              તમારા એડમિશન વિદ્યાર્થીઓના ૧૦ આંકડાના મોબાઈલ નંબર વાળી Excel (.xlsx) કે CSV ફાઈલ અપલોડ કરો. જૂના નંબર્સ આપોઆપ સુરક્ષિત રહેશે અને નવા ઉમેરાઈ જશે.
            </p>
          </div>

          <div>
            <label style={{
              width: '100%',
              height: 42,
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.3))',
              border: '1.5px solid #38bdf8',
              borderRadius: 8,
              color: '#38bdf8',
              fontWeight: 800,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}>
              <UploadCloud size={17} />
              <span>📁 એક્સેલ ફાઈલ સિલેક્ટ કરો (.xlsx / .csv)</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>

        {/* Single Student Quick Add */}
        <div className="glass-card" style={{
          padding: '16px 18px',
          background: 'rgba(255, 255, 255, 0.025)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 12
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> ➕ એક વિદ્યાર્થી સીધો ઉમેરો (Quick Add)
          </div>

          <form onSubmit={handleAddSingle} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
              <div>
                <input
                  className="input-dark"
                  placeholder="૧૦ આંકડાનો મોબાઈલ *"
                  value={singleMobile}
                  maxLength={10}
                  onChange={e => setSingleMobile(e.target.value.replace(/\D/g, ''))}
                  style={{ height: 36, padding: '0 10px', fontSize: '0.82rem', borderRadius: 8 }}
                  required
                />
              </div>
              <div>
                <input
                  className="input-dark"
                  placeholder="નામ (વૈકલ્પિક)"
                  value={singleName}
                  onChange={e => setSingleName(e.target.value)}
                  style={{ height: 36, padding: '0 10px', fontSize: '0.82rem', borderRadius: 8 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 8, alignItems: 'center' }}>
              <input
                className="input-dark"
                placeholder="બેચનું નામ (દા.ત. TAT-S 2026)"
                value={singleBatch}
                onChange={e => setSingleBatch(e.target.value)}
                style={{ height: 36, padding: '0 10px', fontSize: '0.82rem', borderRadius: 8 }}
              />
              <button
                type="submit"
                disabled={addingSingle}
                style={{
                  height: 36,
                  background: 'linear-gradient(135deg, #047857, #10b981)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  fontFamily: 'Hind Vadodara, sans-serif'
                }}>
                <Plus size={14} /> {addingSingle ? 'ઉમેરાય છે...' : '+ ઉમેરો'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ─── Excel Preview Modal / Alert ─── */}
      {parsedPreview && (
        <div className="glass-card animate-fade-in" style={{
          padding: '16px 18px',
          background: 'rgba(30, 41, 59, 0.95)',
          border: '1.5px solid #38bdf8',
          borderRadius: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#38bdf8" />
              <strong style={{ color: 'white', fontSize: '0.92rem' }}>
                એક્સેલ ફાઇલ પ્રિવ્યૂ: {uploadFile?.name}
              </strong>
              <span style={{ background: '#0369a1', color: '#e0f2fe', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, fontWeight: 800 }}>
                {parsedPreview.validCount} માન્ય નંબર્સ
              </span>
              {parsedPreview.invalidCount > 0 && (
                <span style={{ background: '#7f1d1d', color: '#fca5a5', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, fontWeight: 800 }}>
                  {parsedPreview.invalidCount} અમાન્ય
                </span>
              )}
            </div>
            <button
              onClick={() => { setParsedPreview(null); setUploadFile(null); }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Quick 5-row preview */}
          <div style={{ maxHeight: 150, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 8, marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', color: '#cbd5e1' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>#</th>
                  <th style={{ padding: '4px 8px' }}>મોબાઈલ</th>
                  <th style={{ padding: '4px 8px' }}>વિદ્યાર્થીનું નામ</th>
                  <th style={{ padding: '4px 8px' }}>બેચ</th>
                  <th style={{ padding: '4px 8px' }}>સ્ટેટસ</th>
                </tr>
              </thead>
              <tbody>
                {parsedPreview.rows.slice(0, 8).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '4px 8px' }}>{i + 1}</td>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: r.isValid ? '#38bdf8' : '#f87171' }}>{r.mobile || 'ખાલી'}</td>
                    <td style={{ padding: '4px 8px' }}>{r.name}</td>
                    <td style={{ padding: '4px 8px' }}>{r.batch}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {r.isValid ? <span style={{ color: '#4ade80' }}>✓ માન્ય</span> : <span style={{ color: '#f87171' }}>✗ અમાન્ય</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedPreview.rows.length > 8 && (
              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                ... અને અન્ય {parsedPreview.rows.length - 8} વિદ્યાર્થીઓ
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setParsedPreview(null); setUploadFile(null); }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#cbd5e1',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}>
              રદ્દ કરો (Cancel)
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={uploading}
              style={{
                background: 'linear-gradient(135deg, #047857, #10b981)',
                color: 'white',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
              <CheckCircle2 size={16} />
              {uploading ? 'અપલોડ થઈ રહ્યું છે...' : `✅ હા, ${parsedPreview.validCount} વિદ્યાર્થીઓ ઉમેરો (Confirm & Save)`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Search & Students Table ─── */}
      <div className="glass-card" style={{
        padding: '16px 18px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              className="input-dark"
              placeholder="મોબાઈલ, નામ કે બેચથી શોધો..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ height: 36, paddingLeft: 32, paddingRight: 10, fontSize: '0.82rem', borderRadius: 8 }}
            />
          </div>

          {totalCount > 0 && (
            <button
              onClick={handleClearAll}
              title="તમામ એડમિશન લિસ્ટ સાફ કરો"
              style={{
                height: 36,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '0 12px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
              <Trash2 size={14} /> લિસ્ટ સાફ કરો (Clear All)
            </button>
          )}
        </div>

        {/* Table View */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#38bdf8' }} />
            વિદ્યાર્થીઓની યાદી લોડ થઈ રહી છે...
          </div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '35px 20px', color: '#64748b', fontSize: '0.85rem' }}>
            <Users size={32} style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.4 }} />
            {search ? 'આ શોધ માટે કોઈ વિદ્યાર્થી મળ્યો નથી.' : 'હજી સુધી કોઈ એડમિશન વિદ્યાર્થી ઉમેરાયેલ નથી. ઉપરથી Excel ફાઈલ અપલોડ કરો!'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>#</th>
                  <th style={{ padding: '8px 10px' }}>મોબાઈલ નંબર</th>
                  <th style={{ padding: '8px 10px' }}>વિદ્યાર્થીનું નામ</th>
                  <th style={{ padding: '8px 10px' }}>બેચ (Batch)</th>
                  <th style={{ padding: '8px 10px' }}>એડમિશન તારીખ</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>ક્રિયા</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, fontFamily: 'monospace', color: '#38bdf8' }}>
                      {s.mobile}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                      {s.name || <span style={{ color: '#64748b' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        background: 'rgba(147, 51, 234, 0.15)',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        color: '#c084fc',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6
                      }}>
                        {s.batch || 'Trinetra Regular'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8', fontSize: '0.74rem' }}>
                      {new Date(s.createdAt).toLocaleDateString('gu-IN')}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(s.id, s.name, s.mobile)}
                        title="આ વિદ્યાર્થીને એડમિશન લિસ્ટમાંથી દૂર કરો"
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          padding: '4px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
