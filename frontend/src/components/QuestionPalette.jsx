export default function QuestionPalette({ total, currentIndex, answers, questions, onJump }) {
  const getStatus = (index) => {
    const q = questions[index];
    if (!q) return 'unanswered';
    if (index === currentIndex) return 'current';
    const ans = answers[q.id];
    if (ans && (ans.selectedOpt || ans.answerText)) return 'answered';
    return 'unanswered';
  };

  const answeredCount = questions.filter(q => {
    const a = answers[q?.id];
    return a && (a.selectedOpt || a.answerText);
  }).length;

  return (
    <div className="card" style={{ padding: 16, position: 'sticky', top: 80 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          📋 Question Palette
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
            Current
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
            Answered
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e2e8f0', border: '1px solid #cbd5e1', display: 'inline-block' }} />
            Pending
          </span>
        </div>
      </div>

      {/* Number Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {Array.from({ length: total }, (_, i) => {
          const status = getStatus(i);
          return (
            <button
              key={i}
              className={`palette-btn ${status}`}
              onClick={() => onJump(i)}
              title={`Question ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginBottom: 4 }}>
          <span>✅ Answered</span>
          <strong style={{ color: '#059669' }}>{answeredCount}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b' }}>
          <span>⬜ Pending</span>
          <strong style={{ color: '#ef4444' }}>{total - answeredCount}</strong>
        </div>
      </div>
    </div>
  );
}
