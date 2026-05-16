// ==========================================================
// AreaPage
// ==========================================================

const AREA_STORAGE_KEY = "pety-area-config";
const AREA_DEFAULTS = { left: true, right: true, top: false, bottomL: true, bottomR: true, center: false };

const AreaPage = ({ tweaks, petState }) => {
  const [zones, setZones] = React.useState(() => {
    try { const s = localStorage.getItem(AREA_STORAGE_KEY); if (s) return JSON.parse(s); } catch(e) {}
    return AREA_DEFAULTS;
  });
  const [autoWalk, setAutoWalk] = React.useState(() => localStorage.getItem('pety-auto-walk') !== 'off');
  const [physics, setPhysics] = React.useState(() => localStorage.getItem('pety-physics') === 'on');
  React.useEffect(() => {
    try { localStorage.setItem(AREA_STORAGE_KEY, JSON.stringify(zones)); } catch(e) {}
  }, [zones]);
  const toggle = k => setZones(z => ({ ...z, [k]: !z[k] }));
  const toggleAutoWalk = () => {
    const next = !autoWalk;
    setAutoWalk(next);
    localStorage.setItem('pety-auto-walk', next ? 'on' : 'off');
    if (window.electronAPI && window.electronAPI.petAutoWalkToggle) {
      window.electronAPI.petAutoWalkToggle(next);
    }
  };
  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title">限制区域</h2>
        <div className="page-subtitle">点击区域切换允许/禁止 · 绿色=可活动 · 灰色=禁区</div>
        <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", overflow: "hidden", marginTop: 8 }}>
          {[
            { k: "top", style: { left: "20%", right: "20%", top: 8, height: "18%" }, label: "顶部" },
            { k: "left", style: { left: 8, top: "26%", bottom: "26%", width: "18%" }, label: "左侧" },
            { k: "right", style: { right: 8, top: "26%", bottom: "26%", width: "18%" }, label: "右侧" },
            { k: "center", style: { left: "30%", right: "30%", top: "32%", bottom: "32%" }, label: "屏幕中央" },
            { k: "bottomL", style: { left: 8, bottom: 8, width: "42%", height: "22%" }, label: "左下角" },
            { k: "bottomR", style: { right: 8, bottom: 8, width: "42%", height: "22%" }, label: "右下角" },
          ].map(z => (
            <div key={z.k} onClick={()=>toggle(z.k)} style={{
              position: "absolute", ...z.style, borderRadius: 10, cursor: "pointer",
              background: zones[z.k] ? "rgba(102,217,128,0.18)" : "rgba(255,255,255,0.04)",
              border: `1.5px ${zones[z.k]?"solid":"dashed"} ${zones[z.k]?"rgba(102,217,128,0.5)":"rgba(255,255,255,0.15)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: zones[z.k] ? "var(--green-dim)" : "var(--text-tertiary)", fontWeight: 500, transition: "all 0.2s"
            }}>{z.label} {zones[z.k]?"✓":""}</div>
          ))}
          <div style={{ position: "absolute", right: "12%", bottom: "14%", pointerEvents: "none" }}>
            <Pet size={64} hue={tweaks.petHue} state="idle" />
          </div>
        </div>
        <div className="surface" style={{ marginTop: 4 }}>
          <div className="label">行为</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>自动溜达</span>
            <div onClick={toggleAutoWalk} style={{
              width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "all 0.2s",
              background: autoWalk ? "rgba(102,217,128,0.6)" : "rgba(255,255,255,0.15)",
              position: "relative"
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2,
                left: autoWalk ? 20 : 2, transition: "left 0.2s"
              }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>物理模式</span>
            <div onClick={function() {
              const next = !physics;
              setPhysics(next);
              localStorage.setItem('pety-physics', next ? 'on' : 'off');
              if (window.electronAPI && window.electronAPI.petPhysicsToggle) {
                window.electronAPI.petPhysicsToggle(next);
              }
            }} style={{
              width: 40, height: 22, borderRadius: 11, cursor: "pointer", transition: "all 0.2s",
              background: physics ? "rgba(102,217,128,0.6)" : "rgba(255,255,255,0.15)",
              position: "relative"
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2,
                left: physics ? 20 : 2, transition: "left 0.2s"
              }} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {physics ? (<>
              · 小狗有<span style={{color:"var(--yellow)"}}>重力</span>，拖起来松手会掉下去<br/>
              · 落地站在屏幕底部（任务栏上方）<br/>
              · 走路只在底部水平移动
            </>) : (<>
              · 禁区内：宠物自动跑开，不会遮挡视频/全屏游戏<br/>
              · 允许区：可自由行走、睡觉、发呆<br/>
              · 被丢到禁区：<span style={{color:"var(--yellow)"}}>自由落体</span>到最近的允许区边缘
            </>)}
          </div>
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={200} hue={tweaks.petHue} state={petState} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>预览</div>
      </div>
    </div>
  );
};

Object.assign(window, { AreaPage });
