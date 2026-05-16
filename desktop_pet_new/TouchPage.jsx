// ==========================================================
// TouchPage (互动区域)
// ==========================================================

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

Object.assign(window, { TouchPage });
