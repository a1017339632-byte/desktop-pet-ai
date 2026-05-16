// ==========================================================
// VoiceCallOverlay
// ==========================================================

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
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{(window.__petConfig||{}).charName||'Pety'}：</div>
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

Object.assign(window, { VoiceCallOverlay });
