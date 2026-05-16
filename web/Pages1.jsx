// ==========================================================
// Pages part 1: Home, Animation, Monitor, Chat
// ==========================================================

// ─── Home ───
const HomePage = ({ tweaks, setState, petState, relay }) => {
  const activities = relay && relay.activities && relay.activities.length > 0 ? relay.activities : [];

  return (
    <div className="page">
      <div className="panel page-main" style={{ width: "50px" }}>
        <h2 className="page-title">最近动态</h2>
        <div className="page-subtitle">桌宠偷偷干了些什么</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {activities.length > 0 ? activities.map((a, i) =>
          <div key={i} className="surface" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label">{a.t}</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{a.txt}</div>
            </div>
          ) : (
            <div className="surface" style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>等待桌宠上线...</div>
            </div>
          )}
        </div>
        <div className="view-more-link" style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, cursor: "pointer", transition: "color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--blue)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>查看更多 →</div>
        <div className="surface" style={{ background: "rgba(153,102,229,0.1)", marginTop: 8 }}>
          <div className="label">💭 心声</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            {relay && relay.thought ? relay.thought : "连接桌宠后显示"}
          </div>
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={240} hue={tweaks.petHue} state={petState} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>桌宠预览 · 点击试试</div>
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>1. 桌宠权限可自选，超字数轮播</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>2. 身体各部位点击反应可在「互动区域」配置</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>3. 思考动画会一缩一缩脉冲</div>
        </div>
      </div>
    </div>);

};

// ─── Animation Settings ───
const ANIM_TAGS = ["开心", "吃醋", "难过", "跑动", "睡觉", "发呆", "冷漠", "亲热", "眨眼", "求摸", "吵闹", "炸毛", "偷看", "看书", "戴墨镜", "写文件", "翻网页"];
const FORMS = [
{ id: "dog", name: "Q 版小狗", sub: "默认形态", active: true },
{ id: "anime", name: "二次元", sub: "Live 2D · 动漫画风" },
{ id: "3d", name: "伪 2D 立绘", sub: "3D 模型 · 未上传" }];


const AnimationPage = ({ tweaks, petState, selectedEmotion, setSelectedEmotion }) => {
  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title" style={{ fontSize: 16 }}>情绪与动作</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ANIM_TAGS.map((t) =>
          <button key={t} className={`chip ${selectedEmotion === t ? "active" : ""}`} onClick={() => setSelectedEmotion(t)}>{t}</button>
          )}
          <button className="chip ghost">+ 自定义</button>
        </div>
        <div className="surface" style={{ marginTop: 8 }}>
          <div className="label">Live 2D 动作指令</div>
          <textarea className="textarea" style={{ marginTop: 10 }} placeholder={`告诉模型：当用户选择"${selectedEmotion || "开心"}"时，桌宠该怎么做...`} defaultValue={selectedEmotion ? `当触发"${selectedEmotion}"时，模型应该让桌宠…` : ""} />
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={240} hue={tweaks.petHue} state={petState} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>动画效果预览</div>
        <div className="surface">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            1. 点击标签导入对应 gif/png 图片<br />
            2. 支持导入 Live 2D 文件<br />
            3. Live 2D 支持自定义动作和表情控制
          </div>
        </div>
      </div>
    </div>);

};

// ─── Monitor (偷看后台) ───
const RELAY_API = "http://119.91.115.102:8765";

const CAT_NAMES = { work: "工作", social: "社交", video: "视频", gaming: "游戏", rival_ai: "竞品AI", browsing: "浏览", xiaohongshu: "小红书", other: "其他" };
const CAT_COLORS = { work: "#5a7ab5", social: "#7a5aad", video: "#ad5a8a", gaming: "#768a5e", rival_ai: "#c0524a", browsing: "#5a8aad", xiaohongshu: "#d0566c", other: "#555" };

const fmtDur = (sec) => {
  if (!sec || sec < 1) return "--";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};
const fmtTime12 = (ts) => {
  if (!ts) return "--";
  const d = new Date(ts * 1000);
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m}${h >= 12 ? "PM" : "AM"}`;
};

const MonitorPage = ({ tweaks, petState, relay }) => {
  const [sup, setSup] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RELAY_API}/api/supervisor`);
      setSup(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  React.useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id); }, []);

  const currentApp = sup?.current_app || null;
  const currentCat = sup?.current_category || "other";
  const catTime = sup?.category_time || {};
  const history = (sup?.recent_history || []).slice().reverse();
  const maxCat = Math.max(...Object.values(catTime), 1);

  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title">偷看后台</h2>
        <div className="page-subtitle">我偷偷观察到你正在用什么</div>
        <div className="surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label">当前前台</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{currentApp || "未检测到"}</div>
            {sup?.current_title && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{sup.current_title}</div>}
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

        {sup?.rival_ai_total_today > 0 && (
          <div className="surface" style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <div className="label" style={{ color: "#c0524a" }}>竞品AI累计</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c0524a" }}>{fmtDur(sup.rival_ai_total_today)}</div>
          </div>
        )}

        <div className="label" style={{ marginTop: 12 }}>分类时长</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(catTime).sort((a, b) => b[1] - a[1]).map(([cat, sec], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 60, textAlign: "right", fontSize: 11, color: "var(--text-tertiary)" }}>{CAT_NAMES[cat] || cat}</div>
              <div style={{ flex: 1, height: 14, background: "var(--surface-2)", borderRadius: 7, overflow: "hidden" }}>
                <div style={{ width: `${(sec / maxCat * 100).toFixed(1)}%`, height: "100%", borderRadius: 7, background: CAT_COLORS[cat] || "#555" }} />
              </div>
              <div style={{ width: 50, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace" }}>{fmtDur(sec)}</div>
            </div>
          ))}
        </div>

        <div className="label" style={{ marginTop: 12 }}>窗口切换历史</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
          {loading ? (
            <div className="surface" style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>加载中...</div>
          ) : history.length === 0 ? (
            <div className="surface" style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>暂无数据</div>
          ) : history.map((h, i) => (
            <div key={i} className="surface" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px" }}>
              <div style={{ width: 100, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", flexShrink: 0 }}>
                {fmtTime12(h.start)} - {fmtTime12(h.start + h.duration)}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.app}</div>
              <div style={{ padding: "1px 6px", borderRadius: 8, fontSize: 9, color: "#fff", background: CAT_COLORS[h.category] || "#555", flexShrink: 0 }}>
                {CAT_NAMES[h.category] || h.category}
              </div>
              <div style={{ width: 40, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "monospace", textAlign: "right" }}>{fmtDur(h.duration)}</div>
            </div>
          ))}
        </div>

        <button className="chip ghost" style={{ marginTop: 8, width: "100%", justifyContent: "center", padding: 12 }} onClick={fetchData}>刷新</button>
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

// ─── Chat ───
const ChatPage = ({ tweaks, relay }) => {
  const [mode, setMode] = React.useState("text"); // 'text' | 'voice'
  const [chatVisible, setChatVisible] = React.useState(true);
  const [voiceStage, setVoiceStage] = React.useState("idle");
  const [voiceTimer, setVoiceTimer] = React.useState(0);
  const msgs = relay ? relay.messages : [];
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const scrollRef = React.useRef();

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);

  // voice timer
  React.useEffect(() => {
    if (mode !== "voice") { setVoiceTimer(0); return; }
    const id = setInterval(() => setVoiceTimer(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [mode]);

  // VAD voice recording
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const streamRef = React.useRef(null);
  const analyserRef = React.useRef(null);
  const vadIntervalRef = React.useRef(null);
  const silenceCountRef = React.useRef(0);
  const isRecordingRef = React.useRef(false);
  const [voiceText, setVoiceText] = React.useState("");
  const [petVoiceText, setPetVoiceText] = React.useState("");
  const [micActive, setMicActive] = React.useState(false);
  const VOICE_SERVER = "http://localhost:9800";
  const SILENCE_THRESHOLD = 0.015;
  const SILENCE_TIMEOUT = 20; // 20 * 100ms = 2 seconds
  const VOICE_START_COUNT = 3; // 3 * 100ms = 300ms of voice to start
  const voiceCountRef = React.useRef(0);

  const startMic = async () => {
    try {
      if (window.electronAPI && window.electronAPI.startVoiceServer) {
        window.electronAPI.startVoiceServer();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      setMicActive(true);
      setVoiceText("说话就会自动录音");
      setVoiceStage("idle");

      vadIntervalRef.current = setInterval(() => {
        const data = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);

        if (!isRecordingRef.current) {
          if (rms > SILENCE_THRESHOLD) {
            voiceCountRef.current++;
            if (voiceCountRef.current >= VOICE_START_COUNT) {
              isRecordingRef.current = true;
              silenceCountRef.current = 0;
              audioChunksRef.current = [];
              const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
              mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
              mr.onstop = () => sendAudio();
              mr.start();
              mediaRecorderRef.current = mr;
              setVoiceStage("listening");
              setVoiceText("");
            }
          } else {
            voiceCountRef.current = 0;
          }
        } else {
          if (rms < SILENCE_THRESHOLD) {
            silenceCountRef.current++;
            if (silenceCountRef.current >= SILENCE_TIMEOUT) {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
              }
              isRecordingRef.current = false;
              voiceCountRef.current = 0;
            }
          } else {
            silenceCountRef.current = 0;
          }
        }
      }, 100);
    } catch (e) {
      setVoiceText("麦克风权限被拒绝");
    }
  };

  const sendAudio = async () => {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    if (blob.size < 500) { setVoiceStage("idle"); return; }
    setVoiceStage("thinking");
    setVoiceText("识别中...");
    try {
      const resp = await fetch(`${VOICE_SERVER}/stt`, { method: "POST", body: blob, headers: { "Content-Type": "audio/webm" } });
      const result = await resp.json();
      if (result.text) {
        setVoiceText(result.text);
        if (relay) relay.sendChat(result.text);
        setVoiceStage("speaking");
        setPetVoiceText("等待回复...");
      } else {
        setVoiceText("没听清");
        setVoiceStage("idle");
      }
    } catch (e) {
      setVoiceText("语音服务连接失败");
      setVoiceStage("idle");
    }
  };

  const stopMic = () => {
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    isRecordingRef.current = false;
    setMicActive(false);
    if (window.electronAPI && window.electronAPI.stopVoiceServer) {
      window.electronAPI.stopVoiceServer();
    }
  };

  React.useEffect(() => {
    if (mode === "voice" && !micActive) startMic();
    if (mode !== "voice" && micActive) stopMic();
    return () => { if (mode !== "voice") stopMic(); };
  }, [mode]);

  // Watch for relay messages during voice mode to update pet response
  const prevMsgLen = React.useRef(msgs.length);
  React.useEffect(() => {
    if (mode === "voice" && msgs.length > prevMsgLen.current) {
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.who === "pet") {
        setPetVoiceText(lastMsg.txt);
        setVoiceStage("speaking");
        setTimeout(() => setVoiceStage("idle"), 3000);
      }
    }
    prevMsgLen.current = msgs.length;
  }, [msgs, mode]);

  const send = () => {
    if (!draft.trim()) return;
    if (relay) {
      relay.sendChat(draft);
    }
    setDraft("");
    setTyping(true);
    setTimeout(() => setTyping(false), 5000);
  };

  const voiceLabels = { idle: "待机", listening: "聆听中", thinking: "思考中", speaking: "回答中" };
  const voiceLabelColors = { idle: "var(--text-tertiary)", listening: "var(--blue)", thinking: "var(--yellow)", speaking: "var(--green)" };
  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const showChat = mode === "text" || chatVisible;

  return (
    <div className="page">
      <div className="panel page-main" style={{ padding: 0, overflow: "hidden" }}>
        {/* header */}
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(153,102,77,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Pet size={30} hue={tweaks.petHue} state={mode==="voice"?voiceStage:"idle"} limbsVisible={false} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>桌宠</div>
            <div style={{ fontSize: 11, color: mode==="voice" ? voiceLabelColors[voiceStage] : "var(--green-dim)" }}>
              {mode==="voice" ? <>● {voiceLabels[voiceStage]} · {fmt(voiceTimer)}</> : "● 在线"}
            </div>
          </div>
          {/* mode toggle */}
          <div className="tabs" style={{ padding: 3 }}>
            <div className={`tab ${mode==="text"?"active":""}`} style={{ padding: "6px 14px", fontSize: 12 }} onClick={()=>setMode("text")}>
              文字
            </div>
            <div className={`tab ${mode==="voice"?"active":""}`} style={{ padding: "6px 14px", fontSize: 12 }} onClick={()=>setMode("voice")}>
              语音
            </div>
          </div>
          {mode === "voice" && (
            <button className="btn icon ghost" title={chatVisible?"隐藏聊天":"显示聊天"} onClick={()=>setChatVisible(v=>!v)}>
              <Icon name={chatVisible?"eye":"chat"} />
            </button>
          )}
        </div>

        {/* messages — stays on top */}
        {showChat && (
          <div ref={scrollRef} className="scrollable" style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            {msgs.map((m, i) => <Bubble key={i} m={m} petHue={tweaks.petHue} />)}
            {typing &&
            <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "var(--surface-1)", display: "flex", gap: 4 }}>
                <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
              </div>
            }
          </div>
        )}

        {/* voice visual — shown in voice mode, now BELOW chat */}
        {mode === "voice" && (
          <div className="voice-stage" data-state={voiceStage} style={{ position: "relative", padding: "28px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, borderTop: chatVisible ? "1px solid rgba(255,255,255,0.05)" : "none", flex: chatVisible ? "0 0 auto" : 1, overflow: "hidden", minHeight: chatVisible ? 260 : 0, justifyContent: chatVisible ? "flex-start" : "center" }}>
            {!chatVisible && petVoiceText && (
              <div className="voice-caption voice-caption-pet" data-visible={voiceStage === "speaking"}>
                {petVoiceText}
              </div>
            )}

            <VoiceOrb variant={tweaks.orbVariant} state={voiceStage} hue={tweaks.orbHue} sensitivity={tweaks.sensitivity} size={chatVisible ? 140 : 180} />

            {!chatVisible && voiceText && (
              <div className="voice-caption voice-caption-me" data-visible={voiceStage === "listening" || voiceStage === "thinking"}>
                {voiceText}{voiceStage === "listening" && <span className="voice-caret">|</span>}
              </div>
            )}

            {voiceStage === "thinking" && chatVisible && (
              <div style={{ fontSize: 12, color: "rgba(242,191,77,0.85)", position: "relative", zIndex: 1 }}>识别中...</div>
            )}
            {voiceStage === "idle" && micActive && (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>自由麦已开启 · 说话即录音</div>
            )}
            {voiceStage === "listening" && (
              <div style={{ fontSize: 12, color: "var(--blue)", animation: "pulse-dot 1.5s ease infinite" }}>录音中 · 停顿2秒自动发送</div>
            )}
          </div>
        )}

        {/* input row — text mode only */}
        {mode === "text" && (
          <div style={{ padding: "12px 18px", display: "flex", gap: 10, background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button className="btn icon" title="添加附件" style={{ color: "var(--text-secondary)" }}><Icon name="paperclip" /></button>
            <input className="input" style={{ borderRadius: 20, flex: 1 }} placeholder="说点什么..." value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn icon" onClick={send}><Icon name="send" /></button>
            <button className="btn icon" onClick={()=>setMode("voice")} title="切到语音"><Icon name="mic" /></button>
          </div>
        )}

        {/* voice end button — with inline wavebars reacting to user voice */}
        {mode === "voice" && (
          <div style={{ padding: "12px 18px", display: "flex", gap: 12, alignItems: "center", background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button className="btn" style={{ background: "rgba(229,64,64,0.55)", flexShrink: 0 }} onClick={()=>setMode("text")}>
              <Icon name="x" /> 结束语音
            </button>
            <div style={{ flex: 1, height: 34, display: "flex", alignItems: "center", justifyContent: "center", opacity: (voiceStage === "listening" || voiceStage === "speaking") ? 1 : 0.3, transition: "opacity 0.3s" }}>
              {tweaks.showWave && (
                <WaveBars bars={22} state={voiceStage === "listening" ? "listening" : voiceStage === "speaking" ? "speaking" : "idle"} hue={tweaks.orbHue} sensitivity={tweaks.sensitivity} />
              )}
            </div>
          </div>
        )}
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={220} hue={tweaks.petHue} state={mode==="voice"?voiceStage:(typing ? "thinking" : "idle")} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>聊天伙伴</div>
        <div className="surface">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            · 文字 / 语音 随时切<br/>
            · 语音模式下，聊天可隐藏<br/>
            · 语音对话自动记入文字记录
          </div>
        </div>
      </div>
    </div>);

};

const Bubble = ({ m, petHue }) => {
  const isMe = m.who === "me";
  return (
    <div className={`tg-row ${isMe ? "me" : "pet"}`}>
      <div className={`tg-bubble ${isMe ? "me" : "pet"}`}>
        <span className="tg-txt">{m.txt}</span>
        <span className="tg-time">{m.t}{isMe && <span className="tg-tick"> ✓✓</span>}</span>
      </div>
    </div>
  );
};


Object.assign(window, { HomePage, AnimationPage, MonitorPage, ChatPage });