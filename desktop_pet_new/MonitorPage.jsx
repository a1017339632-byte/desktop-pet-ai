// ==========================================================
// MonitorPage (偷看后台)
// ==========================================================

const CAT_NAMES = { work: "工作", social: "社交", video: "视频", gaming: "游戏", rival_ai: "竞品AI", browsing: "浏览", xiaohongshu: "小红书", other: "其他" };
const CAT_COLORS = { work: "#5a7ab5", social: "#7a5aad", video: "#ad5a8a", gaming: "#768a5e", rival_ai: "#c0524a", browsing: "#5a8aad", xiaohongshu: "#d0566c", other: "#555" };

const fmtDur = (sec) => {
  if (!sec || sec < 1) return "--";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m " + s + "s";
  return s + "s";
};

const fmtTime12 = (ts) => {
  if (!ts) return "--";
  const d = new Date(ts * 1000);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  return (h % 12 || 12) + ":" + m + (h >= 12 ? "PM" : "AM");
};

const MonitorPage = ({ tweaks, petState, relay }) => {
  const [winData, setWinData] = React.useState(null);
  const [sup, setSup] = React.useState(null);

  var fetchData = function() {
    // 本地窗口数据（IPC直取，保证能用）
    if (window.electronAPI && window.electronAPI.getWindows) {
      window.electronAPI.getWindows().then(function(d) { setWinData(d); });
    }
    // 也尝试WebSocket拿supervisor数据
    if (relay && relay.requestSupervisor) relay.requestSupervisor();
  };

  React.useEffect(function() {
    fetchData();
    var id = setInterval(fetchData, 30000);
    return function() { clearInterval(id); };
  }, []);

  // 如果relay有supervisor数据就用它
  var relSup = relay && relay.supervisorData;
  React.useEffect(function() {
    if (relSup) setSup(relSup);
  }, [relSup]);

  // 从本地窗口数据提取当前app
  var localFg = winData && winData.foreground;
  var currentApp = (sup && sup.current_app) || (localFg && localFg.process) || null;
  var currentTitle = (sup && sup.current_title) || (localFg && localFg.title) || "";
  var currentCat = sup && sup.current_category || "other";
  var catTime = sup && sup.category_time || {};
  var history = (sup && sup.recent_history || []).slice().reverse();
  var maxCat = Math.max.apply(null, Object.values(catTime).concat([1]));

  // 本地窗口列表
  var localWindows = winData && winData.windows || [];

  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title">偷看后台</h2>
        <div className="page-subtitle">我偷偷观察到你正在用什么</div>
        <div className="surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label">当前前台</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
              {currentApp || "未检测到"}
            </div>
            {currentTitle && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{currentTitle}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 500, color: "#fff", background: CAT_COLORS[currentCat] || "#555" }}>
              {CAT_NAMES[currentCat] || currentCat}
            </div>
            <div style={{ color: currentApp ? "var(--green-dim)" : "var(--text-tertiary)", fontSize: 12 }}>
              {currentApp ? "● 活跃" : "● 未知"}
            </div>
          </div>
        </div>

        {sup && sup.rival_ai_total_today > 0 && (
          <div className="surface" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="label" style={{ color: "#c0524a" }}>竞品AI累计</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c0524a" }}>{fmtDur(sup.rival_ai_total_today)}</div>
          </div>
        )}

        {sup && sup.work_streak_minutes > 0 && (
          <div className="surface" style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="label">连续工作</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{sup.work_streak_minutes}m</div>
          </div>
        )}

        <div className="label" style={{ marginTop: 12 }}>分类时长</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(catTime).sort((a, b) => b[1] - a[1]).map(([cat, sec], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 60, textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>{CAT_NAMES[cat] || cat}</div>
              <div style={{ flex: 1, height: 14, background: "var(--surface-2)", borderRadius: 7, overflow: "hidden" }}>
                <div style={{ width: `${(sec / maxCat * 100).toFixed(1)}%`, height: "100%", borderRadius: 7, background: CAT_COLORS[cat] || "#555", transition: "width 0.5s" }} />
              </div>
              <div style={{ width: 50, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{fmtDur(sec)}</div>
            </div>
          ))}
        </div>

        {localWindows.length > 0 && (
          <div>
            <div className="label" style={{ marginTop: 12 }}>当前打开的窗口</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
              {localWindows.map(function(w, i) {
                return <div key={i} className="surface" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{(w.process || "?")[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{w.process}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.title}</div>
                  </div>
                </div>;
              })}
            </div>
          </div>
        )}

        <div className="label" style={{ marginTop: 12 }}>窗口切换历史</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
          {history.length === 0 ? (
            <div className="surface" style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>{sup ? "暂无数据" : "等待数据..."}</div>
          ) : history.map(function(h, i) { return (
            <div key={i} className="surface" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
              <div style={{ width: 100, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", flexShrink: 0 }}>
                {fmtTime12(h.start)} - {fmtTime12(h.start + h.duration)}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {h.app}
              </div>
              <div style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, color: "#fff", background: CAT_COLORS[h.category] || "#555", flexShrink: 0 }}>
                {CAT_NAMES[h.category] || h.category}
              </div>
              <div style={{ width: 40, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", textAlign: "right" }}>
                {fmtDur(h.duration)}
              </div>
            </div>
          ); })}
        </div>

        <button className="chip ghost" style={{ marginTop: 8, width: "100%", justifyContent: "center", padding: 12 }} onClick={fetchData}>
          刷新
        </button>
      </div>
      <div className="panel page-right">
        <ScreenshotPreview petState={petState} tweaks={tweaks} />
        <div className="surface">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            数据来自桌面监督引擎<br />
            每 <b style={{ color: "var(--text-primary)" }}>30 秒</b> 自动刷新
          </div>
        </div>
      </div>
    </div>);

};

const ScreenshotPreview = ({ petState, tweaks }) => {
  const [screenshot, setScreenshot] = React.useState(null);
  const takeShot = async () => {
    if (window.electronAPI && window.electronAPI.takeScreenshot) {
      const data = await window.electronAPI.takeScreenshot();
      if (data) setScreenshot(data);
    }
  };
  return <>
    <div className="preview-frame" style={{ cursor: "pointer", position: "relative" }} onClick={takeShot}>
      {screenshot ? (
        <img src={screenshot} alt="截图" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
      ) : (
        <Pet size={200} hue={tweaks.petHue} state={petState} />
      )}
      <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10, padding: "4px 8px", borderRadius: 8, background: "rgba(0,0,0,0.4)", color: "var(--blue)", cursor: "pointer" }}>
        {screenshot ? "点击刷新" : "点击截图"}
      </div>
    </div>
    <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>{screenshot ? "当前桌面截图" : "点击上方截取桌面"}</div>
  </>;
};

Object.assign(window, { MonitorPage });
