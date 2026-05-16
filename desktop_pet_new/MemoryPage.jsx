// ==========================================================
// MemoryPage (记忆库)
// ==========================================================

const MemoryPage = ({ tweaks }) => {
  const [mems, setMems] = React.useState([]);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [stats, setStats] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newContent, setNewContent] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("daily");
  const [newImportance, setNewImportance] = React.useState(5);

  const load = () => {
    if (!window.electronAPI) return;
    const opts = {};
    if (filter !== "all") opts.category = filter;
    opts.limit = 100;
    window.electronAPI.getMemories(opts).then(m => setMems(m || []));
    window.electronAPI.memoryStats().then(s => setStats(s));
  };

  React.useEffect(() => { load(); }, [filter]);

  const doSearch = (q) => {
    setSearch(q);
    if (!q.trim()) { load(); return; }
    if (window.electronAPI) {
      window.electronAPI.searchMemories(q.trim()).then(m => setMems(m || []));
    }
  };

  const doAdd = () => {
    if (!newContent.trim() || !window.electronAPI) return;
    window.electronAPI.addMemory({ content: newContent.trim(), category: newCategory, importance: newImportance }).then(() => {
      setNewContent(""); setShowAdd(false); load();
    });
  };

  const doDelete = (id) => {
    if (!window.electronAPI) return;
    window.electronAPI.deleteMemory(id).then(() => load());
  };

  const doResolve = (id) => {
    if (!window.electronAPI) return;
    window.electronAPI.resolveMemory(id).then(() => load());
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e0d8d0",
    fontSize: 13, fontFamily: "'Noto Sans SC', sans-serif", outline: "none",
  };
  const btnStyle = {
    padding: "4px 12px", background: "rgba(208,116,86,0.8)", border: "none",
    borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer",
  };
  const catColors = { daily: "#d07456", character: "#56a0d0", knowledge: "#56d078", todo: "#d0a856", general: "#a0a0a0" };
  const catLabels = { daily: "日常", character: "人物", knowledge: "知识", todo: "待办", general: "通用" };

  return (
    <div className="page">
      <div className="panel page-main" style={{ overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 className="page-title" style={{ margin: 0 }}>记忆库</h2>
          {stats && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>共 {stats.total} 条 · 已完成 {stats.resolved}</span>}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {["all", "daily", "character", "knowledge", "todo"].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              ...btnStyle, padding: "4px 10px", fontSize: 11,
              background: filter === cat ? (catColors[cat] || "rgba(208,116,86,0.8)") : "rgba(255,255,255,0.06)",
              color: filter === cat ? "#fff" : "rgba(255,255,255,0.5)",
            }}>{cat === "all" ? "全部" : catLabels[cat]}</button>
          ))}
          <button onClick={() => setShowAdd(!showAdd)} style={{ ...btnStyle, padding: "4px 10px", fontSize: 11, background: "rgba(102,178,102,0.7)", marginLeft: "auto" }}>+ 新增</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <input type="text" value={search} onChange={e => doSearch(e.target.value)} placeholder="搜索记忆..." style={inputStyle} />
        </div>

        {showAdd && (
          <div style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="记忆内容..." style={{ ...inputStyle, height: 60, resize: "vertical", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                {Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>重要度</label>
              <input type="range" min="1" max="10" value={newImportance} onChange={e => setNewImportance(+e.target.value)} style={{ width: 80 }} />
              <span style={{ fontSize: 11, color: "#e0d8d0", minWidth: 16 }}>{newImportance}</span>
              <button onClick={doAdd} style={btnStyle}>保存</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {mems.map(m => (
            <div key={m.id} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: catColors[m.category] || "#a0a0a0", color: "#fff", whiteSpace: "nowrap", marginTop: 2 }}>
                  {catLabels[m.category] || m.category}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: m.resolved ? "rgba(255,255,255,0.3)" : "#e0d8d0", textDecoration: m.resolved ? "line-through" : "none" }}>{m.content}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4, display: "flex", gap: 8 }}>
                    <span>重要度 {m.importance}</span>
                    {m._score !== undefined && m._score < 999 && <span>权重 {m._score.toFixed(1)}</span>}
                    <span>{new Date(m.created_at).toLocaleString("zh-CN")}</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{m.id}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {!m.resolved && m.category === "todo" && (
                    <button onClick={() => doResolve(m.id)} style={{ ...btnStyle, padding: "2px 8px", fontSize: 10, background: "rgba(102,178,102,0.6)" }} title="标记完成">✓</button>
                  )}
                  <button onClick={() => doDelete(m.id)} style={{ ...btnStyle, padding: "2px 8px", fontSize: 10, background: "rgba(229,64,64,0.5)" }} title="删除">✕</button>
                </div>
              </div>
            </div>
          ))}
          {mems.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              {search ? "没有找到匹配的记忆" : "还没有记忆，AI对话时会自动存储"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { MemoryPage });
