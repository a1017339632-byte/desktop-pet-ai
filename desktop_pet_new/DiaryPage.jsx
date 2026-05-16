// ==========================================================
// DiaryPage
// ==========================================================

function getDiaryApi() {
  return (window.__PETY_CONFIG__ && window.__PETY_CONFIG__.diaryUrl) || localStorage.getItem('pety-diary-url') || "";
}

const DiaryPage = ({ tweaks, petState }) => {
  const [entries, setEntries] = React.useState([]);
  const [moodStats, setMoodStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selected, setSelected] = React.useState(null);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(`${getDiaryApi()}/diary/list?limit=50&show_locked=true`).then(r => r.json()),
        fetch(`${getDiaryApi()}/diary/mood_stats`).then(r => r.json()).catch(() => null),
      ]);
      setEntries(listRes);
      setMoodStats(statsRes);
      setError(null);
    } catch (e) {
      setError("无法连接日记服务器");
    }
    setLoading(false);
  };

  React.useEffect(() => { fetchEntries(); }, []);

  const moodEmoji = (mood) => {
    const map = { happy: "😊", sad: "😢", grateful: "🥹", angry: "😤", calm: "😌", excited: "🤩", tired: "😴", love: "❤️", anxious: "😰", peaceful: "🍃", playful: "😜", proud: "😎", nostalgic: "🌅", curious: "🤔" };
    return map[mood] || "📝";
  };

  const moodLabel = (mood) => {
    const map = { happy: "开心", sad: "难过", grateful: "感动", angry: "生气", calm: "平静", excited: "兴奋", tired: "累了", love: "爱", anxious: "焦虑", peaceful: "安宁", playful: "调皮", proud: "得意", nostalgic: "怀旧", curious: "好奇" };
    return map[mood] || mood;
  };

  const detail = selected ? entries.find(e => e.id === selected) : null;

  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title">日记</h2>
        <div className="page-subtitle">{`锁着的只有${(window.__petConfig||{}).charName||'AI'}能解锁 · 标题始终可见`}</div>
        {loading ? (
          <div className="surface" style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>加载中...</div>
          </div>
        ) : error ? (
          <div className="surface" style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--red)" }}>{error}</div>
            <button className="chip" style={{ marginTop: 12 }} onClick={fetchEntries}>重试</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="surface" style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>还没有日记</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {entries.map(entry => (
              <div key={entry.id} className="surface" onClick={() => setSelected(entry.id)}
                style={{ cursor: "pointer", padding: "12px 16px",
                  border: selected === entry.id ? "1px solid rgba(128,178,255,0.4)" : "1px solid transparent",
                  background: selected === entry.id ? "rgba(128,178,255,0.08)" : undefined,
                  transition: "all 0.2s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{moodEmoji(entry.mood)}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{entry.title || "无标题"}</span>
                  </div>
                  {entry.locked ? (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "var(--text-tertiary)" }}>🔒</span>
                  ) : (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(102,217,128,0.1)", color: "var(--green-dim)" }}>🔓</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{entry.created_at}</div>
                {entry.locked ? (
                  <div style={{ fontSize: 13, color: "var(--text-quat)", marginTop: 6, fontStyle: "italic" }}>内容已上锁</div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                    {entry.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="chip ghost" style={{ marginTop: 8, width: "100%", justifyContent: "center", padding: 14 }} onClick={fetchEntries}>
          刷新
        </button>
      </div>
      <div className="panel page-right">
        {moodStats && moodStats.moods && Object.keys(moodStats.moods).length > 0 ? (
          <div className="surface">
            <div className="label">📊 {moodStats.month} 月心情统计</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(moodStats.moods).sort((a,b) => b[1] - a[1]).map(([mood, count]) => (
                <div key={mood} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{moodEmoji(mood)}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{moodLabel(mood)}</span>
                  <div style={{ width: 80, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: "var(--blue)", width: `${Math.min(100, (count / moodStats.total) * 100)}%` }}></div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", width: 20, textAlign: "right" }}>{count}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 8, textAlign: "center" }}>本月共 {moodStats.total} 篇</div>
          </div>
        ) : (
          <div className="surface" style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>📊 本月暂无心情数据</div>
          </div>
        )}
        {detail ? (
          <div className="surface" style={{ flex: 1, marginTop: 8, overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{detail.title || "无标题"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="label" style={{ margin: 0 }}>{moodEmoji(detail.mood)} {moodLabel(detail.mood) || "无心情"}</div>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{detail.created_at}</span>
            </div>
            {detail.locked ? (
              <div style={{ fontSize: 14, color: "var(--text-quat)", textAlign: "center", padding: "24px 0" }}>
                🔒 内容已上锁
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                {detail.content}
              </div>
            )}
          </div>
        ) : (
          <div className="surface" style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              · 点击左侧日记查看详情<br/>
              · 标题和心情始终可见<br/>
              {`· 锁着的内容只有${(window.__petConfig||{}).charName||'AI'}能解锁`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { DiaryPage });
