// ==========================================================
// FormSwitchPage (切换形态)
// ==========================================================

const FormSwitchPage = ({ tweaks, setTweakValue }) => {
  const forms = [
    { id: "default", hue: 25, name: "Q 版小狗", sub: "内置 · 经典形态", avail: true },
    { id: "claude", hue: 25, name: "Claude", sub: "橘色logo · 自定义皮肤", avail: true },
    { id: "gemini", hue: 160, name: "Gemini", sub: "彩色logo · 自定义皮肤", avail: true },
    { id: "gpt", hue: 300, name: "GPT", sub: "黑色logo · 自定义皮肤", avail: true },
  ];
  const [active, setActive] = React.useState(() => localStorage.getItem('pety-skin') || 'default');
  const pick = (f) => {
    setActive(f.id);
    localStorage.setItem('pety-skin', f.id);
    setTweakValue("petHue", f.hue);
    if (window.electronAPI && window.electronAPI.petWalk) {
      window.electronAPI.relaySend({ type: 'skin-change', skin: f.id });
    }
  };
  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title">切换形态</h2>
        <div className="page-subtitle">选一个当前宠物形象 · 每个形态独立的表情动作</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
          {forms.map(f => (
            <div key={f.id} onClick={()=>f.avail&&pick(f)} style={{
              borderRadius: 12, padding: 14, cursor: f.avail?"pointer":"not-allowed",
              background: active === f.id ? "rgba(128,178,255,0.12)" : "var(--surface-1)",
              border: active === f.id ? "1px solid rgba(128,178,255,0.4)" : "1px solid transparent",
              opacity: 1,
              display: "flex", gap: 12, alignItems: "center", transition: "all 0.2s",
              position: "relative"
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {f.id === "default" ? <Pet size={56} hue={f.hue} state="idle" limbsVisible={false} /> :
                  <img src={`assets/skins/${f.id}/drag_start_left.gif`} style={{ width: 56, height: 56, objectFit: "contain" }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{f.sub}</div>
                {active === f.id && <div style={{ fontSize: 10, color: "var(--blue)", marginTop: 4 }}>● 使用中</div>}
              </div>
            </div>
          ))}
          <div className="chip ghost" style={{ gridColumn: "1 / 3", justifyContent: "center", padding: 18 }}>+ 上传新形态</div>
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={260} hue={active} state="happy" />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>形态预览</div>
        <div className="surface">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            · 点击形态卡片切换当前形象<br/>
            · 支持 gif/png/Live 2D<br/>
            · 每个形态独立管理表情与动作
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { FormSwitchPage });
