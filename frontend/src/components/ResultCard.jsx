import { ConfettiCanvas, AchievementBadges } from './ConfettiBadges';

const isImg = (val) => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return (
    s.startsWith('data:image/') ||
    s.startsWith('blob:') ||
    s.includes(';base64,') ||
    /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(s) ||
    /^https?:\/\/.*\.(png|jpg|jpeg|gif|webp|svg)/i.test(s) ||
    s.startsWith('<img')
  );
};

const extractImgSrc = (val) => {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (s.startsWith('<img')) {
    const m = s.match(/src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }
  return s;
};

export default function ResultCard({ result, questions, answers, onRetry }) {
  const { mcqScore, totalMCQ, percentage, submittedAt } = result;
  const isPassing = percentage >= 60;

  // Calculate average time per question
  const answeredQuestions = Object.values(answers || {});
  const totalTimeSpent = answeredQuestions.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
  const avgTimePerQ = answeredQuestions.length > 0 ? (totalTimeSpent / answeredQuestions.length) : 0;

  const getGrade = (pct) => {
    if (pct >= 90) return { label: 'A+ Outstanding!', color: '#059669' };
    if (pct >= 75) return { label: 'A Very Good!', color: '#2563eb' };
    if (pct >= 60) return { label: 'B Pass!', color: '#d97706' };
    return { label: 'C Need Improvement', color: '#ef4444' };
  };

  const grade = percentage != null ? getGrade(percentage) : null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
      
      {/* 🎊 Celebration Confetti Burst on Good Score */}
      {isPassing && <ConfettiCanvas duration={4000} />}

      {/* Score Banner */}
      <div className="card" style={{ padding: '32px 24px', textAlign: 'center', marginBottom: 20, background: isPassing ? 'linear-gradient(135deg,#ecfdf5,#d1fae5)' : 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: isPassing ? '2px solid #6ee7b7' : '2px solid #fca5a5' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>
          {isPassing ? '🎉' : '📖'}
        </div>

        {percentage != null ? (
          <>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: isPassing ? '#059669' : '#ef4444', lineHeight: 1.2, marginBottom: 4 }}>
              {mcqScore} / {totalMCQ}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              ટકાવારી: {percentage}%
            </div>
            {grade && (
              <span className="badge" style={{ background: grade.color + '20', color: grade.color, fontSize: '0.95rem', padding: '6px 18px', fontWeight: 800 }}>
                {grade.label}
              </span>
            )}
          </>
        ) : (
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
            📝 ટેસ્ટ સફળતાપૂર્વક સબમિટ!
          </div>
        )}

        <p className="gu-text" style={{ color: '#475569', fontSize: '0.9rem', marginTop: 14 }}>
          ⏰ {new Date(submittedAt).toLocaleString('gu-IN')}
        </p>
      </div>

      {/* 🎖️ Achievement Badges Section */}
      <AchievementBadges
        score={mcqScore || 0}
        totalMarks={totalMCQ || 1}
        avgTimePerQ={avgTimePerQ}
        totalSubmissions={1}
      />

      {/* Question Analysis (MCQ only) */}
      {totalMCQ > 0 && questions && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontWeight: 800, color: '#0f172a', margin: 0, fontSize: '1.05rem' }}>
              📊 પ્રશ્નવાર પરિણામ & સ્પીડોમીટર (Question Analysis)
            </h3>
            {avgTimePerQ > 0 && (
              <span style={{ fontSize: '0.78rem', background: '#eff6ff', color: '#1e40af', padding: '3px 10px', borderRadius: 20, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                ⚡ સરેરાશ સ્પીડ: {Math.round(avgTimePerQ)}s / પ્રશ્ન
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.filter(q => q.type === 'mcq').map((q, idx) => {
              const ans = answers[q.id];
              const selected = ans?.selectedOpt;
              const isCorrect = selected && selected === q.correctOpt;
              const isWrong   = selected && selected !== q.correctOpt;
              const skipped   = !selected;
              const timeSpent = ans?.timeSpent || 0;

              const rawA = q.optionA || q.optA || (q.options && (q.options.A || q.options[0])) || '';
              const rawB = q.optionB || q.optB || (q.options && (q.options.B || q.options[1])) || '';
              const rawC = q.optionC || q.optC || (q.options && (q.options.C || q.options[2])) || '';
              const rawD = q.optionD || q.optD || (q.options && (q.options.D || q.options[3])) || '';

              const imgA = q.optionA_img || q.optA_img || (isImg(rawA) ? extractImgSrc(rawA) : '');
              const imgB = q.optionB_img || q.optB_img || (isImg(rawB) ? extractImgSrc(rawB) : '');
              const imgC = q.optionC_img || q.optC_img || (isImg(rawC) ? extractImgSrc(rawC) : '');
              const imgD = q.optionD_img || q.optD_img || (isImg(rawD) ? extractImgSrc(rawD) : '');

              const textA = isImg(rawA) ? '' : rawA;
              const textB = isImg(rawB) ? '' : rawB;
              const textC = isImg(rawC) ? '' : rawC;
              const textD = isImg(rawD) ? '' : rawD;

              const opts = [
                { key: 'A', text: textA, img: imgA },
                { key: 'B', text: textB, img: imgB },
                { key: 'C', text: textC, img: imgC },
                { key: 'D', text: textD, img: imgD }
              ].filter(o => o.text || o.img);

              return (
                <div key={q.id} style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: isCorrect ? '#f0fdf4' : isWrong ? '#fef2f2' : '#f8fafc',
                  border: `1.5px solid ${isCorrect ? '#86efac' : isWrong ? '#fca5a5' : '#e2e8f0'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div className="gu-text" style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', flex: 1 }}>
                      પ્રશ્ન {idx + 1}: {q.text}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {timeSpent > 0 && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: timeSpent <= 30 ? '#dcfce7' : timeSpent <= 60 ? '#fef3c7' : '#fee2e2', color: timeSpent <= 30 ? '#166534' : timeSpent <= 60 ? '#92400e' : '#991b1b' }}>
                          ⏱️ {timeSpent}s {timeSpent <= 30 ? '⚡' : ''}
                        </span>
                      )}
                      <span style={{ fontSize: '1.1rem' }}>
                        {isCorrect ? '✅ (+1)' : isWrong ? '❌ (0)' : '⬜ (0)'}
                      </span>
                    </div>
                  </div>

                  {/* Question Image if any */}
                  {(q.image || q.imageUrl) && (
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      <img src={q.image || q.imageUrl} alt="Q" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    </div>
                  )}

                  {/* 4 Options Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginBottom: 10 }}>
                    {opts.map(o => {
                      const isSel = selected === o.key;
                      const isTarget = q.correctOpt === o.key;
                      let bg = '#ffffff';
                      let bdr = '#e2e8f0';
                      let badge = null;

                      if (isTarget) {
                        bg = '#dcfce7';
                        bdr = '#86efac';
                        badge = <span style={{ color: '#166534', fontWeight: 800, fontSize: '0.75rem', marginLeft: 6 }}>[🎯 સાચો જવાબ]</span>;
                      }
                      if (isSel) {
                        if (isCorrect) {
                          badge = <span style={{ color: '#166534', fontWeight: 800, fontSize: '0.75rem', marginLeft: 6 }}>[✓ તમારો સાચો જવાબ]</span>;
                        } else {
                          bg = '#fee2e2';
                          bdr = '#fca5a5';
                          badge = <span style={{ color: '#991b1b', fontWeight: 800, fontSize: '0.75rem', marginLeft: 6 }}>[✕ તમે પસંદ કરેલ]</span>;
                        }
                      }

                      return (
                        <div key={o.key} style={{ padding: '8px 12px', borderRadius: 8, background: bg, border: `1.5px solid ${bdr}`, fontSize: '0.85rem', color: '#1e293b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>
                            <strong>{o.key}.</strong> {o.text} {badge}
                          </div>
                          {o.img && (
                            <div style={{ marginTop: 2, textAlign: 'center' }}>
                              <img src={o.img} alt={`Opt ${o.key}`} style={{ maxHeight: 70, maxWidth: '100%', borderRadius: 4, border: '1px solid #cbd5e1' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: 6 }}>
                    <span>તમે ટીક કરેલ જવાબ: <strong style={{ color: isCorrect ? '#166534' : isWrong ? '#991b1b' : '#64748b' }}>{selected || 'અનુત્તર'}</strong></span>
                    <span>સાચો જવાબ: <strong style={{ color: '#166534' }}>{q.correctOpt}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher Remarks (if any) */}
      {result.teacherMarks && (
        <div className="card" style={{ padding: 20, marginBottom: 20, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <h3 style={{ fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>📋 Teacher Evaluation</h3>
          <div style={{ fontSize: '1rem' }}>
            <span style={{ color: '#059669', fontWeight: 700 }}>Marks: {result.teacherMarks}</span>
          </div>
          {result.remarks && (
            <p className="gu-text" style={{ color: '#1e293b', marginTop: 8, fontStyle: 'italic' }}>
              "{result.remarks}"
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={onRetry} style={{ flex: 1, justifyContent: 'center', minWidth: 140 }}>
          🔄 ફરી ટેસ્ટ આપો
        </button>
        <a
          href={`https://wa.me/918200405300?text=${encodeURIComponent('🎯 Trinetra Online Academy - ટેસ્ટ આપ્યો! Score: ' + (mcqScore || '') + '/' + (totalMCQ || ''))}`}
          target="_blank"
          rel="noreferrer"
          className="btn-whatsapp"
          style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', minWidth: 140, display: 'flex', alignItems: 'center' }}
        >
          💬 WhatsApp Share
        </a>
      </div>
    </div>
  );
}
