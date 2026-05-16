// ==========================================================
// Pages part 2: Area, Touch, FormSwitch + VoiceCallOverlay
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

// ─── Touch / 互动区域 ───
const PARTS = [
  { id: "head", label: "头", x: 50, y: 20, hint: "摸摸头" },
  { id: "cheek-l", label: "左脸", x: 28, y: 38, hint: "戳戳脸" },
  { id: "cheek-r", label: "右脸", x: 72, y: 38, hint: "戳戳脸" },
  { id: "belly", label: "肚子", x: 50, y: 55, hint: "摸肚子" },
  { id: "arm-l", label: "左手", x: 12, y: 55, hint: "牵手" },
  { id: "arm-r", label: "右手", x: 88, y: 55, hint: "牵手" },
  { id: "leg-l", label: "左腿", x: 38, y: 85, hint: "提溜" },
  { id: "leg-r", label: "右腿", x: 62, y: 85, hint: "提溜" },
];
const DEFAULT_PROMPTS = {
  "head": "用户摸了摸你的头。表现出开心害羞的反应，可以眯眼睛+脸红。",
  "cheek-l": "用户戳了一下你的左脸。表现出被戳的反应，可以轻微抱怨或者害羞。",
  "cheek-r": "用户戳了一下你的右脸。同上。",
  "belly": "用户摸了肚子。这是敏感部位，表现出惊讶或者撒娇，可以跳开。",
  "arm-l": "用户牵了左手。可以温柔回应，表示愿意一起。",
  "arm-r": "用户牵了右手。同上。",
  "leg-l": "用户提溜了左腿。表现出挣扎或抗议，可以说\"放我下来~\"",
  "leg-r": "用户提溜了右腿。同上。",
};

const TOUCH_STORAGE_KEY = "pety-touch-config";

const loadTouchConfig = () => {
  try {
    const saved = localStorage.getItem(TOUCH_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

const saveTouchConfig = (hotspotPos, customs, prompts, disabled) => {
  try {
    localStorage.setItem(TOUCH_STORAGE_KEY, JSON.stringify({ hotspotPos, customs, prompts, disabled }));
  } catch (e) {}
};

const TouchPage = ({ tweaks }) => {
  const saved = React.useMemo(() => loadTouchConfig(), []);
  const [selected, setSelected] = React.useState("head");
  const [poked, setPoked] = React.useState(null);
  const [prompts, setPrompts] = React.useState(saved?.prompts || DEFAULT_PROMPTS);
  const [mode, setMode] = React.useState("preset");
  const [customs, setCustoms] = React.useState(saved?.customs || []);
  const [disabled, setDisabled] = React.useState(saved?.disabled || []);
  const [drawing, setDrawing] = React.useState(null);
  const svgRef = React.useRef();
  const containerRef = React.useRef();

  const [hotspotPos, setHotspotPos] = React.useState(() => {
    if (saved?.hotspotPos) return saved.hotspotPos;
    const init = {};
    PARTS.forEach(p => { init[p.id] = { x: p.x, y: p.y }; });
    return init;
  });
  const dragRef = React.useRef(null);

  const onHotspotMouseDown = (e, partId) => {
    if (mode !== "preset") return;
    e.preventDefault();
    e.stopPropagation();
    const pos = hotspotPos[partId];
    dragRef.current = { id: partId, startMouseX: e.clientX, startMouseY: e.clientY, startX: pos.x, startY: pos.y };
    const onMouseMove = (ev) => {
      const d = dragRef.current;
      if (!d || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - d.startMouseX) / rect.width) * 100;
      const dy = ((ev.clientY - d.startMouseY) / rect.height) * 100;
      const nx = Math.max(0, Math.min(100, d.startX + dx));
      const ny = Math.max(0, Math.min(100, d.startY + dy));
      setHotspotPos(prev => ({ ...prev, [d.id]: { x: nx, y: ny } }));
    };
    const onMouseUp = (ev) => {
      const d = dragRef.current;
      if (d && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) {
          setDisabled(prev => prev.includes(d.id) ? prev : [...prev, d.id]);
          setHotspotPos(prev => ({ ...prev, [d.id]: { x: PARTS.find(p=>p.id===d.id)?.x||50, y: PARTS.find(p=>p.id===d.id)?.y||50 } }));
        }
      }
      dragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  React.useEffect(() => {
    saveTouchConfig(hotspotPos, customs, prompts, disabled);
  }, [hotspotPos, customs, prompts, disabled]);

  const onPoke = (id) => {
    setSelected(id);
    setPoked(id);
    setTimeout(()=>setPoked(null), 700);
  };

  const getPct = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const ev = e.touches ? e.touches[0] : e;
    return [
      Math.max(0, Math.min(100, ((ev.clientX - r.left)/r.width)*100)),
      Math.max(0, Math.min(100, ((ev.clientY - r.top)/r.height)*100)),
    ];
  };
  const startDraw = (e) => { if (mode!=="draw") return; e.preventDefault(); setDrawing({ points: [getPct(e)] }); };
  const moveDraw = (e) => { if (!drawing) return; e.preventDefault(); setDrawing(d => ({ points: [...d.points, getPct(e)] })); };
  const endDraw = () => {
    if (!drawing) return;
    if (drawing.points.length > 4) {
      const id = "custom-" + Date.now();
      const name = `自定义区域 ${customs.length + 1}`;
      setCustoms(c => [...c, { id, name, points: drawing.points }]);
      setPrompts(p => ({...p, [id]: "用户触发了自定义区域，给出合适的反应。"}));
      setSelected(id);
    }
    setDrawing(null);
  };

  const allPart = [...PARTS, ...customs].find(p=>p.id===selected);
  const pathD = (pts) => pts.length ? "M" + pts.map(([x,y])=>`${x},${y}`).join("L") + "Z" : "";

  const renameCustom = (id) => {
    const name = prompt("区域名称：", customs.find(c=>c.id===id)?.name || "");
    if (name) setCustoms(c => c.map(x => x.id===id ? {...x, name} : x));
  };
  const deleteCustom = (id) => {
    setCustoms(c => c.filter(x => x.id !== id));
    if (selected === id) setSelected("head");
  };

  return (
    <div className="page">
      <div className="panel page-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 className="page-title">互动区域</h2>
            <div className="page-subtitle">告诉 AI：点击每个部位时，让它怎么反应</div>
          </div>
          <div className="tabs" style={{ padding: 3, flexShrink: 0 }}>
            <div className={`tab ${mode==="preset"?"active":""}`} style={{ padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" }} onClick={()=>setMode("preset")}>预设热区</div>
            <div className={`tab ${mode==="draw"?"active":""}`} style={{ padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" }} onClick={()=>setMode("draw")}>✏️ 自由画线</div>
          </div>
        </div>

        <div style={{ position: "relative", alignSelf: "center", marginTop: 8 }}>
          <div ref={containerRef} className="surface" style={{ width: 340, height: 340, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: mode==="draw"?"crosshair":"default", overflow: "hidden" }}>
            <Pet size={260} hue={tweaks.petHue} state={poked ? "poke" : "idle"} />

            {/* custom regions SVG overlay */}
            <svg ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }}
              onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}>
              {customs.map(c => (
                <path key={c.id} d={pathD(c.points)}
                  fill={selected===c.id ? "rgba(128,191,255,0.22)" : "rgba(255,255,255,0.04)"}
                  stroke={selected===c.id ? "var(--blue)" : "rgba(255,255,255,0.35)"}
                  strokeWidth="0.4" strokeDasharray={selected===c.id ? "0" : "1 1"}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: mode==="preset"?"pointer":"crosshair", pointerEvents: mode==="preset"?"auto":"none" }}
                  onClick={mode==="preset" ? (e)=>{e.stopPropagation(); onPoke(c.id);} : undefined}
                />
              ))}
              {drawing && (
                <path d={pathD(drawing.points)} fill="rgba(128,191,255,0.15)" stroke="var(--blue)" strokeWidth="0.5" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />
              )}
              {/* labels on custom regions */}
              {customs.map(c => {
                const cx = c.points.reduce((s,[x])=>s+x,0)/c.points.length;
                const cy = c.points.reduce((s,[,y])=>s+y,0)/c.points.length;
                return <text key={c.id+"-t"} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={selected===c.id?"var(--blue)":"rgba(255,255,255,0.6)"} fontSize="3" fontWeight="600" style={{ pointerEvents: "none" }}>{c.name}</text>;
              })}
            </svg>

            {/* preset hotspots */}
            {mode==="preset" && PARTS.filter(p => !disabled.includes(p.id)).map(p => {
              const pos = hotspotPos[p.id] || { x: p.x, y: p.y };
              return (
              <div key={p.id}
                onClick={()=>onPoke(p.id)}
                onMouseDown={(e)=>onHotspotMouseDown(e, p.id)}
                style={{
                position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)",
                width: 36, height: 36, borderRadius: "50%", cursor: "grab",
                border: selected === p.id ? "2px solid var(--blue)" : "1.5px dashed rgba(255,255,255,0.25)",
                background: selected === p.id ? "rgba(128,191,255,0.15)" : "transparent",
                transition: dragRef.current?.id === p.id ? "none" : "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: selected === p.id ? "var(--blue)" : "var(--text-tertiary)", fontWeight: 500,
                zIndex: 2, userSelect: "none",
              }}>{p.label}</div>
              );
            })}

            {mode==="draw" && !drawing && (
              <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "var(--blue)", background: "rgba(0,0,0,0.4)", padding: "4px 10px", borderRadius: 10, backdropFilter: "blur(6px)", pointerEvents: "none" }}>
                按住拖动，画出一块自定义区域
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
          {mode==="preset" ? "拖到图片外面 = 禁用该部位" : "松开鼠标自动生成区域"}
        </div>

        {/* 已禁用的部位 */}
        {disabled.length > 0 && (
          <div className="surface" style={{ marginTop: 4 }}>
            <div className="label" style={{ marginBottom: 6 }}>已禁用 · {disabled.length}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {disabled.map(id => {
                const p = PARTS.find(x => x.id === id);
                return p ? (
                  <div key={id} className="chip" style={{ fontSize: 11, padding: "5px 10px", opacity: 0.6, cursor: "pointer" }}
                    onClick={() => setDisabled(prev => prev.filter(x => x !== id))}>
                    {p.label} ✕ 恢复
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* 自定义区域 list */}
        <div className="surface" style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="label" style={{ margin: 0 }}>自定义区域 · {customs.length}</div>
            <button className="chip" onClick={()=>setMode("draw")} style={{ fontSize: 11 }}>+ 新建</button>
          </div>
          {customs.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-quat)", padding: "16px 0", textAlign: "center" }}>
              还没有自定义区域。切到「自由画线」在宠物身上划一圈，就能给不同部位配置专属反应，比如「头顶呆毛」「尾巴尖」「左爪」…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {customs.map(c => (
                <div key={c.id} onClick={()=>onPoke(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: selected===c.id?"rgba(128,191,255,0.12)":"rgba(255,255,255,0.03)", border: selected===c.id?"1px solid rgba(128,191,255,0.35)":"1px solid transparent", cursor: "pointer" }}>
                  <svg viewBox="0 0 100 100" style={{ width: 28, height: 28, flexShrink: 0, background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                    <path d={pathD(c.points)} fill="rgba(128,191,255,0.35)" stroke="var(--blue)" strokeWidth="1.5" />
                  </svg>
                  <div style={{ flex: 1, fontSize: 13 }}>{c.name}</div>
                  <button className="chip" style={{ fontSize: 10, padding: "3px 8px" }} onClick={(e)=>{e.stopPropagation(); renameCustom(c.id);}}>重命名</button>
                  <button className="chip" style={{ fontSize: 10, padding: "3px 8px", color: "var(--red)" }} onClick={(e)=>{e.stopPropagation(); deleteCustom(c.id);}}>删除</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="panel page-right">
        <div className="surface-2">
          <div className="label">当前部位</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{allPart?.label || allPart?.name || "—"}</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
            {allPart?.hint ? `触发线索：${allPart.hint}` : "自定义区域"}
          </div>
        </div>
        <div className="surface" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="label">告诉 AI 该怎么反应</div>
          <textarea className="textarea" style={{ marginTop: 10, flex: 1, minHeight: 120 }}
            value={prompts[selected] || ""}
            onChange={e=>setPrompts(p=>({...p, [selected]: e.target.value}))} />
          <div style={{ fontSize: 11, color: "var(--text-quat)", marginTop: 6, lineHeight: 1.6 }}>
            表情和动作在「动画设置」里预配置，AI 会从中挑选合适的组合。
          </div>
        </div>
        <button className="btn" style={{ width: "100%" }} onClick={() => { saveTouchConfig(hotspotPos, customs, prompts); alert("配置已保存"); }}>保存配置</button>
      </div>
    </div>
  );
};

// ─── FormSwitch / 切换形态 ───
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

// ─── Voice Call Overlay ───
const VoiceCallOverlay = ({ tweaks, onClose }) => {
  const [stage, setStage] = React.useState("idle"); // idle → listening → thinking → speaking → idle
  const [autoCycle, setAutoCycle] = React.useState(true);
  const [showPet, setShowPet] = React.useState(false);
  const [timer, setTimer] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!autoCycle) return;
    const seq = { idle: ["listening", 1200], listening: ["thinking", 2600], thinking: ["speaking", 2800], speaking: ["idle", 3400] };
    const [next, delay] = seq[stage];
    const id = setTimeout(() => setStage(next), delay);
    return () => clearTimeout(id);
  }, [stage, autoCycle]);

  const labels = { idle: "待机", listening: "聆听中", thinking: "思考中", speaking: "回答中" };
  const labelColor = { idle: "var(--text-tertiary)", listening: "var(--blue)", thinking: "var(--yellow)", speaking: "var(--green)" };
  const subtitles = {
    idle: { you: "", pet: "按下说话开始" },
    listening: { you: "", pet: "" },
    thinking: { you: "", pet: "" },
    speaking: { you: "", pet: "" },
  };
  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div className="voice-overlay">
      <div className="voice-overlay-bg" onClick={onClose}></div>
      <div className="panel panel-dark voice-panel">
        <div className="voice-top">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: labelColor[stage], boxShadow: `0 0 8px ${labelColor[stage]}` }}></div>
            <span style={{ fontSize: 13, fontWeight: 500, color: labelColor[stage] }}>{labels[stage]}</span>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontFamily: "var(--font-en)" }}>{fmt(timer)}</span>
        </div>

        <div className="voice-visual">
          {showPet ? (
            <Pet size={200} hue={tweaks.petHue} state={stage} />
          ) : (
            <VoiceOrb variant={tweaks.orbVariant} state={stage} hue={tweaks.orbHue} sensitivity={tweaks.sensitivity} size={200} />
          )}
          {stage === "thinking" && <div style={{ marginTop: 24, fontSize: 13, color: "rgba(242,191,77,0.7)" }}>思考 2.{Math.floor(Math.random()*9)}s</div>}
          {(stage === "listening" || stage === "speaking") && tweaks.showWave && (
            <div style={{ width: "80%", height: 60, marginTop: 20 }}>
              <WaveBars bars={29} state={stage} hue={tweaks.orbHue} sensitivity={tweaks.sensitivity} />
            </div>
          )}
        </div>

        <div className="voice-subtitles">
          {subtitles[stage].you && (<>
            <div style={{ fontSize: 12, color: "var(--text-quat)" }}>你：</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>{subtitles[stage].you}</div>
          </>)}
          {subtitles[stage].pet && (<>
            <div className="divider" style={{ width: 200, margin: "4px auto" }}></div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{(window.__petConfig||{}).charName||'AI'}：</div>
            <div style={{ fontSize: 15, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.5 }}>{subtitles[stage].pet}</div>
          </>)}
        </div>

        <div className="voice-ambient"></div>

        <div className="voice-controls">
          <button className="voice-ctrl" onClick={()=>setShowPet(p=>!p)}>
            <div className="voice-ctrl-icon"><Icon name={showPet?"layers":"spark"} /></div>
            <div>{showPet?"用小球":"用Pet"}</div>
          </button>
          <button className="voice-ctrl voice-ctrl-main" style={{ background: "rgba(229,64,64,0.6)" }} onClick={onClose}>
            <div className="voice-ctrl-icon"><Icon name="x" /></div>
            <div>结束通话</div>
          </button>
          <button className="voice-ctrl" onClick={()=>setAutoCycle(a=>!a)}>
            <div className="voice-ctrl-icon" style={{ fontSize: 10, fontWeight: 700 }}>{autoCycle?"⏸":"▶"}</div>
            <div>{autoCycle?"暂停演示":"播放演示"}</div>
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingBottom: 16 }}>
          {["idle","listening","thinking","speaking"].map(s => (
            <button key={s} onClick={()=>{setAutoCycle(false); setStage(s);}} className={`chip ${stage===s?"active":""}`} style={{ fontSize: 11, padding: "4px 10px" }}>{labels[s]}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Diary ───
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

// ─── Settings Page ───
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

const SettingsPage = ({ tweaks }) => {
  const [apiKey, setApiKey] = React.useState("");
  const [voiceId, setVoiceId] = React.useState("");
  const [sttEngine, setSttEngine] = React.useState("tencent");
  const [tencentSecretId, setTencentSecretId] = React.useState("");
  const [tencentSecretKey, setTencentSecretKey] = React.useState("");
  const [saved, setSaved] = React.useState("");
  const [favorites, setFavorites] = React.useState([]);
  const [playingId, setPlayingId] = React.useState(null);
  const audioRef = React.useRef(null);

  const [connMode, setConnMode] = React.useState("plugin");
  const [llmProvider, setLlmProvider] = React.useState("openai");
  const [llmApiKey, setLlmApiKey] = React.useState("");
  const [llmBaseUrl, setLlmBaseUrl] = React.useState("");
  const [llmModel, setLlmModel] = React.useState("");
  const [charName, setCharName] = React.useState("");
  const [userName, setUserName] = React.useState("");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [memoryTopN, setMemoryTopN] = React.useState(3);
  const [memoryRecentN, setMemoryRecentN] = React.useState(5);
  const [memoryTodoN, setMemoryTodoN] = React.useState(1);
  const [maxContextTokens, setMaxContextTokens] = React.useState(20000);
  const [historyPreloadN, setHistoryPreloadN] = React.useState(10);
  const [tokenStats, setTokenStats] = React.useState(null);
  const [tokenBreakdown, setTokenBreakdown] = React.useState(null);
  const [apiSaved, setApiSaved] = React.useState("");

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      if (audioRef.current._url) URL.revokeObjectURL(audioRef.current._url);
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  React.useEffect(() => {
    return () => stopAudio();
  }, []);

  React.useEffect(() => {
    if (window.electronAPI && window.electronAPI.getVoiceConfig) {
      window.electronAPI.getVoiceConfig().then(cfg => {
        if (cfg.minimax_api_key) setApiKey(cfg.minimax_api_key);
        if (cfg.tts_voice_id) setVoiceId(cfg.tts_voice_id);
        if (cfg.stt_engine) setSttEngine(cfg.stt_engine);
        if (cfg.tencent_secret_id) setTencentSecretId(cfg.tencent_secret_id);
        if (cfg.tencent_secret_key) setTencentSecretKey(cfg.tencent_secret_key);
      });
    }
    if (window.electronAPI && window.electronAPI.getApiConfig) {
      window.electronAPI.getApiConfig().then(cfg => {
        setConnMode(cfg.mode || "plugin");
        setLlmProvider(cfg.provider || "openai");
        setLlmApiKey(cfg.apiKey || "");
        setLlmBaseUrl(cfg.baseUrl || "");
        setLlmModel(cfg.model || "");
        setCharName(cfg.charName || "");
        setUserName(cfg.userName || "");
        setSystemPrompt(cfg.systemPrompt || "");
        setMemoryTopN(cfg.memoryTopN ?? 3);
        setMemoryRecentN(cfg.memoryRecentN ?? 5);
        setMemoryTodoN(cfg.memoryTodoN ?? 1);
        setMaxContextTokens(cfg.maxContextTokens ?? 20000);
        setHistoryPreloadN(cfg.historyPreloadN ?? 10);
      });
    }
    if (window.electronAPI && window.electronAPI.getTokenStats) {
      window.electronAPI.getTokenStats().then(s => setTokenStats(s));
    }
    if (window.electronAPI && window.electronAPI.getTokenBreakdown) {
      window.electronAPI.getTokenBreakdown().then(b => setTokenBreakdown(b));
    }
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    if (window.electronAPI && window.electronAPI.getVoiceFavorites) {
      window.electronAPI.getVoiceFavorites().then(f => setFavorites(f || []));
    }
  };

  const saveConfig = () => {
    if (!window.electronAPI || !window.electronAPI.saveVoiceConfig) return;
    const cfg = { stt_engine: sttEngine };
    if (apiKey.trim()) cfg.minimax_api_key = apiKey.trim();
    if (voiceId.trim()) cfg.tts_voice_id = voiceId.trim();
    if (tencentSecretId.trim()) cfg.tencent_secret_id = tencentSecretId.trim();
    if (tencentSecretKey.trim()) cfg.tencent_secret_key = tencentSecretKey.trim();
    window.electronAPI.saveVoiceConfig(cfg).then(() => {
      setSaved("已保存！语音服务重启中...");
      setTimeout(() => setSaved(""), 4000);
    });
  };

  const saveApiCfg = () => {
    if (!window.electronAPI || !window.electronAPI.saveApiConfig) return;
    window.electronAPI.saveApiConfig({
      mode: connMode, provider: llmProvider, apiKey: llmApiKey,
      baseUrl: llmBaseUrl, model: llmModel, charName, userName, systemPrompt,
      memoryTopN, memoryRecentN, memoryTodoN, maxContextTokens, historyPreloadN,
    }).then(() => {
      setApiSaved("已保存！");
      setTimeout(() => setApiSaved(""), 3000);
    });
  };

  const refreshTokenStats = () => {
    if (window.electronAPI && window.electronAPI.getTokenStats) {
      window.electronAPI.getTokenStats().then(s => setTokenStats(s));
    }
    if (window.electronAPI && window.electronAPI.getTokenBreakdown) {
      window.electronAPI.getTokenBreakdown().then(b => setTokenBreakdown(b));
    }
  };

  const resetStats = () => {
    if (window.electronAPI && window.electronAPI.resetTokenStats) {
      window.electronAPI.resetTokenStats().then(s => setTokenStats(s));
    }
  };

  const playFav = (id) => {
    if (!window.electronAPI) return;
    if (playingId === id) {
      stopAudio();
      return;
    }
    stopAudio();
    setPlayingId(id);
    window.electronAPI.playVoiceFavorite(id).then(r => {
      if (r.success) {
        const blob = new Blob([Uint8Array.from(atob(r.audioBase64), c => c.charCodeAt(0))], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        a._url = url;
        a.onended = () => { stopAudio(); };
        a.play();
        audioRef.current = a;
      } else {
        setPlayingId(null);
      }
    });
  };

  const deleteFav = (id) => {
    if (!window.electronAPI) return;
    window.electronAPI.deleteVoiceFavorite(id).then(() => loadFavorites());
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e0d8d0",
    fontSize: 13, fontFamily: "'Noto Sans SC', sans-serif", outline: "none",
  };
  const labelStyle = { fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4, display: "block" };
  const btnStyle = {
    padding: "8px 20px", background: "rgba(208,116,86,0.8)", border: "none",
    borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer",
  };

  return (
    <div className="page">
      <div className="panel page-main" style={{ overflowY: "auto" }}>
        <h2 className="page-title">设置</h2>

        <div style={{ marginTop: 16, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>连接模式</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["plugin", "MCP 插件"], ["api", "API 直连"]].map(([val, label]) => (
              <button key={val} onClick={() => setConnMode(val)} style={{
                ...btnStyle, flex: 1, background: connMode === val ? "rgba(208,116,86,0.8)" : "rgba(255,255,255,0.06)",
                color: connMode === val ? "#fff" : "rgba(255,255,255,0.5)",
              }}>{label}</button>
            ))}
          </div>

          {connMode === "api" && (<>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Provider</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["openai", "OpenAI 格式"], ["anthropic", "Anthropic"]].map(([val, label]) => (
                  <button key={val} onClick={() => setLlmProvider(val)} style={{
                    ...btnStyle, flex: 1, padding: "6px 12px", fontSize: 12,
                    background: llmProvider === val ? "rgba(102,178,102,0.7)" : "rgba(255,255,255,0.06)",
                    color: llmProvider === val ? "#fff" : "rgba(255,255,255,0.5)",
                  }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>API Key</label>
              <input type="password" value={llmApiKey} onChange={e => setLlmApiKey(e.target.value)} placeholder="sk-..." style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Base URL (留空使用默认)</label>
              <input type="text" value={llmBaseUrl} onChange={e => setLlmBaseUrl(e.target.value)}
                placeholder={llmProvider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com"} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Model</label>
              <input type="text" value={llmModel} onChange={e => setLlmModel(e.target.value)}
                placeholder={llmProvider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini"} style={inputStyle} />
            </div>
          </>)}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>角色名称</h3>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>AI 名字 {"{{char}}"}</label>
                <input type="text" value={charName} onChange={e => setCharName(e.target.value)} placeholder="Pety" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>用户名字 {"{{user}}"}</label>
                <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="User" style={inputStyle} />
              </div>
            </div>
          </div>

          {connMode === "api" && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>System Prompt (可选)</label>
              <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                placeholder={"在这里写你的 System Prompt...（留空则不发送system消息）"}
                style={{ ...inputStyle, height: 80, resize: "vertical" }} />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                使用 {"{{char}}"} 和 {"{{user}}"} 作为占位符，会自动替换为上面填的名字
              </div>
            </div>
          )}

          {connMode === "api" && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>上下文管理</h3>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>聊天上下文上限 (tokens)</label>
                  <input type="number" value={maxContextTokens} onChange={e => setMaxContextTokens(+e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>启动时加载历史条数</label>
                  <input type="number" min="0" max="50" value={historyPreloadN} onChange={e => setHistoryPreloadN(+e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>记忆·重要</label>
                  <input type="number" min="0" max="20" value={memoryTopN} onChange={e => setMemoryTopN(+e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>记忆·最近</label>
                  <input type="number" min="0" max="20" value={memoryRecentN} onChange={e => setMemoryRecentN(+e.target.value)} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>记忆·待办</label>
                  <input type="number" min="0" max="10" value={memoryTodoN} onChange={e => setMemoryTodoN(+e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                超过上限自动截断最早的聊天记录，记忆tokens独立计算不占额度
              </div>
            </div>
          )}

          {connMode === "api" && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, color: "#e0d8d0", margin: 0 }}>Token 统计</h3>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={refreshTokenStats} style={{ ...btnStyle, padding: "2px 8px", fontSize: 10, background: "rgba(255,255,255,0.1)" }}>刷新</button>
                  {tokenStats && <button onClick={resetStats} style={{ ...btnStyle, padding: "2px 8px", fontSize: 10, background: "rgba(229,64,64,0.4)" }}>清零累计</button>}
                </div>
              </div>
              {tokenBreakdown && (<>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>提示词预估 · 总词符数: <b style={{ color: "#e0d8d0", fontSize: 13 }}>{tokenBreakdown.total.toLocaleString()}</b></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {[
                    { label: "System Prompt", tokens: tokenBreakdown.systemPrompt, color: "rgba(208,116,86,0.7)" },
                    { label: "工具指令", tokens: tokenBreakdown.toolInstructions, color: "rgba(102,178,102,0.7)" },
                    { label: "记忆召回", tokens: tokenBreakdown.memory, color: "rgba(86,160,208,0.7)" },
                    { label: `聊天记录 (${tokenBreakdown.chatMessages}条)`, tokens: tokenBreakdown.chatHistory, color: "rgba(208,168,86,0.7)" },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: "#e0d8d0", fontWeight: 600, minWidth: 50, textAlign: "right" }}>{item.tokens.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
                  {[
                    { tokens: tokenBreakdown.systemPrompt, color: "rgba(208,116,86,0.8)" },
                    { tokens: tokenBreakdown.toolInstructions, color: "rgba(102,178,102,0.8)" },
                    { tokens: tokenBreakdown.memory, color: "rgba(86,160,208,0.8)" },
                    { tokens: tokenBreakdown.chatHistory, color: "rgba(208,168,86,0.8)" },
                  ].map((s, i) => (
                    <div key={i} style={{ width: `${(s.tokens / Math.max(tokenBreakdown.total, 1)) * 100}%`, background: s.color, minWidth: s.tokens > 0 ? 2 : 0 }} />
                  ))}
                </div>
              </>)}
              {tokenStats && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 16, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  <span>累计输入: <b style={{ color: "rgba(255,255,255,0.7)" }}>{tokenStats.totalInput.toLocaleString()}</b></span>
                  <span>累计输出: <b style={{ color: "rgba(255,255,255,0.7)" }}>{tokenStats.totalOutput.toLocaleString()}</b></span>
                  <span>消息数: <b style={{ color: "rgba(255,255,255,0.7)" }}>{tokenStats.sessionMessages}</b></span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={saveApiCfg} style={btnStyle}>保存连接配置</button>
            {apiSaved && <span style={{ fontSize: 12, color: "rgba(102,178,102,0.9)" }}>{apiSaved}</span>}
          </div>
          {connMode === "plugin" && (
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              插件模式通过 Claude Code MCP 连接，需要运行 Claude Code
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>语音识别 STT</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>识别引擎</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["tencent", "腾讯云"], ["whisper", "本地 Whisper"]].map(([val, label]) => (
                <button key={val} onClick={() => setSttEngine(val)} style={{
                  ...btnStyle, flex: 1, background: sttEngine === val ? "rgba(102,178,102,0.7)" : "rgba(255,255,255,0.08)",
                  color: sttEngine === val ? "#fff" : "rgba(255,255,255,0.5)", border: sttEngine === val ? "1px solid rgba(102,178,102,0.5)" : "1px solid rgba(255,255,255,0.1)",
                }}>{label}</button>
              ))}
            </div>
          </div>
          {sttEngine === "tencent" && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>腾讯云 SecretId</label>
                <input type="text" value={tencentSecretId} onChange={e => setTencentSecretId(e.target.value)} placeholder="AKIDxxxxxxxx" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>腾讯云 SecretKey</label>
                <input type="password" value={tencentSecretKey} onChange={e => setTencentSecretKey(e.target.value)} placeholder="xxxxxxxx" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                留空则使用内置默认密钥 · 一句话识别 · 15元/30小时
              </div>
            </>
          )}
          {sttEngine === "whisper" && (
            <div style={{ marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              使用本地 Whisper Medium 模型 · 首次加载较慢 · 免费
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>语音合成 TTS</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>MiniMax API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-api-..." style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>语音 Voice ID</label>
            <input type="text" value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="moss_audio_..." style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={saveConfig} style={btnStyle}>保存配置</button>
            {saved && <span style={{ fontSize: 12, color: "rgba(102,178,102,0.9)" }}>{saved}</span>}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            留空则使用内置默认配置 · 保存后语音服务会重启
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => {
              setSaved("测试中...");
              if (window.electronAPI && window.electronAPI.ttsGenerate) {
                window.electronAPI.ttsGenerate("你好，我是" + ((window.__petConfig||{}).charName||'AI')).then(r => {
                  if (r.success && r.audioHex) {
                    setSaved("API成功! 音频长度:" + r.audioHex.length + " 播放中...");
                    var bytes = new Uint8Array(r.audioHex.length / 2);
                    for (var i = 0; i < r.audioHex.length; i += 2) bytes[i/2] = parseInt(r.audioHex.substr(i, 2), 16);
                    var blob = new Blob([bytes], { type: 'audio/mp3' });
                    var url = URL.createObjectURL(blob);
                    var a = new Audio(url);
                    a.onended = () => { URL.revokeObjectURL(url); setSaved("播放完毕!"); };
                    a.onerror = (e) => setSaved("播放失败: " + e.type);
                    a.play().catch(e => setSaved("play()失败: " + e.message));
                  } else {
                    setSaved("API失败: " + (r.error || "unknown"));
                  }
                }).catch(e => setSaved("IPC错误: " + e.message));
              } else {
                setSaved("ttsGenerate不可用");
              }
            }} style={{ ...btnStyle, background: "rgba(86,160,208,0.7)" }}>测试 TTS</button>
          </div>
        </div>

        <div style={{ marginTop: 20, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>语音收藏 ({favorites.length})</h3>
          {favorites.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: "20px 0", textAlign: "center" }}>
              对话时点击消息旁的 ♡ 收藏语音
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {favorites.slice().reverse().map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                  <button onClick={() => playFav(f.id)} style={{ ...btnStyle, padding: "4px 10px", fontSize: 12, background: playingId === f.id ? "rgba(102,178,102,0.8)" : "rgba(208,116,86,0.6)" }}>
                    {playingId === f.id ? "■ 停止" : "▶"}
                  </button>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 12, color: "#e0d8d0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.text}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{new Date(f.date).toLocaleString("zh-CN")}</div>
                  </div>
                  <button onClick={() => deleteFav(f.id)} style={{ ...btnStyle, padding: "4px 8px", fontSize: 11, background: "rgba(229,64,64,0.5)" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { AreaPage, TouchPage, FormSwitchPage, VoiceCallOverlay, DiaryPage, MemoryPage, SettingsPage });
