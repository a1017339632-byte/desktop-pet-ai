// ==========================================================
// Pages part 2: Area, Touch, FormSwitch + VoiceCallOverlay
// ==========================================================

const AreaPage = ({ tweaks, petState }) => {
  const [zones, setZones] = React.useState({ left: true, right: true, top: false, bottomL: true, bottomR: true, center: false });
  const toggle = k => setZones(z => ({ ...z, [k]: !z[k] }));
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
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7, marginTop: 6 }}>
            · 禁区内：桌宠自动跑开，不会遮挡视频/全屏游戏<br/>
            · 允许区：可自由行走、睡觉、发呆<br/>
            · 被丢到禁区：<span style={{color:"var(--yellow)"}}>自由落体</span>到最近的允许区边缘
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

const TouchPage = ({ tweaks }) => {
  const [selected, setSelected] = React.useState("head");
  const [poked, setPoked] = React.useState(null);
  const [prompts, setPrompts] = React.useState(DEFAULT_PROMPTS);
  const [mode, setMode] = React.useState("preset"); // preset | draw
  const [customs, setCustoms] = React.useState([]); // {id, name, points:[[x,y],...]}
  const [drawing, setDrawing] = React.useState(null); // {points:[...]}
  const svgRef = React.useRef();
  const containerRef = React.useRef();

  // Draggable hotspot positions: override PARTS defaults
  const [hotspotPos, setHotspotPos] = React.useState(() => {
    const init = {};
    PARTS.forEach(p => { init[p.id] = { x: p.x, y: p.y }; });
    return init;
  });
  const dragRef = React.useRef(null); // { id, startMouseX, startMouseY, startX, startY }

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
    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

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
            {mode==="preset" && PARTS.map(p => {
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
          {mode==="preset" ? "点一下任意部位预览反应" : "松开鼠标自动生成区域"}
        </div>

        {/* 自定义区域 list */}
        <div className="surface" style={{ marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="label" style={{ margin: 0 }}>自定义区域 · {customs.length}</div>
            <button className="chip" onClick={()=>setMode("draw")} style={{ fontSize: 11 }}>+ 新建</button>
          </div>
          {customs.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-quat)", padding: "16px 0", textAlign: "center" }}>
              还没有自定义区域。切到「自由画线」在桌宠身上划一圈，就能给不同部位配置专属反应，比如「头顶呆毛」「尾巴尖」「左爪」…
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
        <button className="btn" style={{ width: "100%" }}>保存配置</button>
      </div>
    </div>
  );
};

// ─── FormSwitch / 切换形态 ───
const FormSwitchPage = ({ tweaks, setTweakValue }) => {
  const forms = [
    { id: 25, name: "Q 版小狗 · 默认", sub: "内置 · 24 个表情", avail: true },
    { id: 45, name: "小黄鸭", sub: "内置 · 18 个表情", avail: true },
    { id: 160, name: "薄荷鸟", sub: "内置 · 22 个表情", avail: true },
    { id: 300, name: "夜光精灵", sub: "内置 · 20 个表情", avail: true },
    { id: 200, name: "二次元 · 绿发少女", sub: "Live 2D · 未上传", avail: false },
    { id: 120, name: "伪 2D 立绘", sub: "3D 模型 · 即将到来", avail: false },
  ];
  const [active, setActive] = React.useState(tweaks.petHue);
  const pick = (h) => { setActive(h); setTweakValue("petHue", h); };
  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title">切换形态</h2>
        <div className="page-subtitle">选一个当前桌宠形象 · 每个形态独立的表情动作</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
          {forms.map(f => (
            <div key={f.id} onClick={()=>f.avail&&pick(f.id)} style={{
              borderRadius: 12, padding: 14, cursor: f.avail?"pointer":"not-allowed",
              background: active === f.id ? "rgba(128,178,255,0.12)" : "var(--surface-1)",
              border: active === f.id ? "1px solid rgba(128,178,255,0.4)" : "1px solid transparent",
              opacity: 1,
              display: "flex", gap: 12, alignItems: "center", transition: "all 0.2s",
              position: "relative"
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {f.avail ? <Pet size={56} hue={f.id} state="idle" limbsVisible={false} /> : <Icon name="layers" />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{f.sub}</div>
                {active === f.id && <div style={{ fontSize: 10, color: "var(--blue)", marginTop: 4 }}>● 使用中</div>}
                {!f.avail && <div style={{ fontSize: 9, color: "var(--yellow)", marginTop: 4, fontWeight: 600, letterSpacing: 1 }}>开发中</div>}
              </div>
            </div>
          ))}
          <div className="chip ghost" style={{ gridColumn: "1 / 3", justifyContent: "center", padding: 18 }}>+ 上传新形态（gif/png/Live 2D）</div>
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
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>桌宠：</div>
            <div style={{ fontSize: 15, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.5 }}>{subtitles[stage].pet}</div>
          </>)}
        </div>

        <div className="voice-ambient"></div>

        <div className="voice-controls">
          <button className="voice-ctrl" onClick={()=>setShowPet(p=>!p)}>
            <div className="voice-ctrl-icon"><Icon name={showPet?"layers":"spark"} /></div>
            <div>{showPet?"用小球":"用桌宠"}</div>
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

Object.assign(window, { AreaPage, TouchPage, FormSwitchPage, VoiceCallOverlay });
