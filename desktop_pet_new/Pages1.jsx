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
        <div className="page-subtitle">{`${(window.__petConfig||{}).charName||'Pety'}偷偷干了些什么`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {activities.length > 0 ? activities.map((a, i) =>
          <div key={i} className="surface" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label">{a.t}</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{a.txt}</div>
            </div>
          ) : (
            <div className="surface" style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{`等待${(window.__petConfig||{}).charName||'Pety'}上线...`}</div>
            </div>
          )}
        </div>
        <div className="view-more-link" style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, cursor: "pointer", transition: "color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--blue)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>查看更多 →</div>
        <div className="surface" style={{ background: "rgba(153,102,229,0.1)", marginTop: 8 }}>
          <div className="label">💭 心声</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            {relay && relay.thought ? relay.thought : "连接后显示"}
          </div>
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={240} hue={tweaks.petHue} state={petState} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>宠物预览 · 点击试试</div>
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>1. 宠物权限可自选，超字数轮播</div>
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
          <textarea className="textarea" style={{ marginTop: 10 }} placeholder={`告诉模型：当用户选择"${selectedEmotion || "开心"}"时，宠物该怎么做...`} defaultValue={selectedEmotion ? `当触发"${selectedEmotion}"时，模型应该让宠物…` : ""} />
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

// ─── Chat ───
const ChatPage = ({ tweaks, relay }) => {
  const [mode, _setMode] = React.useState(localStorage.getItem('pety-chat-mode') || "text");
  const setMode = (m) => { localStorage.setItem('pety-chat-mode', m); _setMode(m); };
  const [chatVisible, setChatVisible] = React.useState(true);
  const [voiceStage, setVoiceStage] = React.useState("idle");
  const [voiceTimer, setVoiceTimer] = React.useState(0);
  const msgs = relay ? relay.messages : [];
  const [draft, setDraft] = React.useState("");
  const [pendingImage, setPendingImage] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState(null);
  const searchTimerRef = React.useRef(null);
  var doSearch = function(q) {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimerRef.current = setTimeout(function() {
      if (window.electronAPI && window.electronAPI.searchChat) {
        window.electronAPI.searchChat(q.trim()).then(function(results) {
          setSearchResults(results.map(function(m) {
            var d = new Date(m.ts);
            return { who: m.who, txt: m.text, emotion: m.emotion || "idle", ts: d.getTime(),
              t: d.getFullYear() + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0") + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
              acked: true };
          }));
        });
      }
    }, 300);
  };

  // 从本地加载对话历史
  const historyLoaded = React.useRef(false);
  const [uploadUrl, setUploadUrl] = React.useState("");
  const [showUpload, setShowUpload] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState("");
  const [downloadStatus, setDownloadStatus] = React.useState("");

  React.useEffect(function() {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    // 优先读本地历史
    if (window.electronAPI && window.electronAPI.getLocalChat) {
      window.electronAPI.getLocalChat(200).then(function(hist) {
        if (hist && hist.length > 0) {
          if (relay) {
            relay.setMessages(hist.map(function(m) {
              var tStr = m.date + " " + m.time;
              return {
                who: m.who === "pet" ? "pet" : "me",
                t: tStr,
                txt: m.text,
                ts: new Date(m.ts).getTime(),
                acked: true,
                audioFile: m.audioFile || null,
              };
            }));
          }
        } else {
          // 本地空→拉云端
          if (relay && relay.requestChatHistory) relay.requestChatHistory();
        }
      });
    } else if (relay && relay.requestChatHistory) {
      relay.requestChatHistory();
    }
  }, [relay]);

  var doUpload = function() {
    if (!uploadUrl.trim()) return;
    setUploadStatus("上传中...");
    if (window.electronAPI && window.electronAPI.uploadChat) {
      window.electronAPI.uploadChat(uploadUrl.trim()).then(function(r) {
        setUploadStatus(r.success ? "上传成功！" : "失败: " + r.error);
        setTimeout(function() { setUploadStatus(""); }, 3000);
      });
    }
  };
  var doDownload = function() {
    if (!uploadUrl.trim()) return;
    setDownloadStatus("导入中...");
    if (window.electronAPI && window.electronAPI.downloadChat) {
      window.electronAPI.downloadChat(uploadUrl.trim()).then(function(r) {
        if (r.success) {
          setDownloadStatus("导入成功！" + r.count + "条，重新加载...");
          setTimeout(function() { window.location.reload(); }, 1500);
        } else {
          setDownloadStatus("失败: " + r.error);
        }
        setTimeout(function() { setDownloadStatus(""); }, 3000);
      });
    }
  };
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
  const SILENCE_TIMEOUT = 30; // 30 * 100ms = 3 seconds
  const VOICE_START_COUNT = 3; // 3 * 100ms = 300ms of voice to start
  const voiceCountRef = React.useRef(0);

  const micStartingRef = React.useRef(false);
  const startMic = async () => {
    if (micActive || micStartingRef.current) return;
    micStartingRef.current = true;
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
      micStartingRef.current = false;
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
      micStartingRef.current = false;
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
        if (relay) relay.sendChat("[语音] " + result.text);
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
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    isRecordingRef.current = false;
    micStartingRef.current = false;
    setMicActive(false);
  };

  React.useEffect(() => {
    if (relay && relay.globalVoice) {
      if (mode !== "voice") setMode("voice");
      return;
    }
    if (mode === "voice" && !micActive && !micStartingRef.current) {
      startMic();
    } else if (mode !== "voice" && micActive) {
      stopMic();
      if (window.electronAPI && window.electronAPI.stopVoiceServer) {
        window.electronAPI.stopVoiceServer();
      }
    }
    return () => {
      if (!relay || !relay.globalVoice) {
        stopMic();
      }
    };
  }, [mode, relay && relay.globalVoice]);

  // Watch for relay messages during voice mode to update pet response
  const prevMsgLen = React.useRef(msgs.length);
  const mountedTs = React.useRef(Date.now());
  React.useEffect(function() {
    var isGlobal = relay && relay.globalVoice;
    if (mode === "voice" && msgs.length > prevMsgLen.current) {
      var lastMsg = msgs[msgs.length - 1];
      console.log('[tts-debug] new msg:', lastMsg && lastMsg.who, 'ts:', lastMsg && lastMsg.ts, 'mounted:', mountedTs.current, 'isGlobal:', isGlobal, 'audioUrl:', !!(lastMsg && lastMsg.audioUrl));
      if (lastMsg && lastMsg.who === "pet" && lastMsg.txt && lastMsg.ts > mountedTs.current) {
        setPetVoiceText(lastMsg.txt);
        if (isGlobal) {
          console.log('[tts-debug] → isGlobal branch (skipping TTS)');
          setVoiceStage("speaking");
          setTimeout(function() { setVoiceStage("idle"); }, 3000);
        } else if (lastMsg.audioUrl) {
          setVoiceStage("speaking");
          var audio = new Audio(lastMsg.audioUrl);
          audio.onended = function() { setVoiceStage("idle"); };
          audio.play();
        } else {
          // TTS handled by main.js autoTtsForMessage, just update stage
          setVoiceStage("speaking");
          setTimeout(function() { setVoiceStage("idle"); }, 5000);
        }
      }
    }
    prevMsgLen.current = msgs.length;
  }, [msgs, mode]);

  var send = function() {
    if (pendingImage) {
      if (relay && relay.sendFile) {
        relay.sendFile(pendingImage);
      }
      if (draft.trim() && relay) {
        relay.sendChat(draft);
      }
      setPendingImage(null);
      setDraft("");
      setTyping(true);
      setTimeout(function() { setTyping(false); }, 5000);
      return;
    }
    if (!draft.trim()) return;
    if (relay) {
      relay.sendChat(draft);
    }
    setDraft("");
    setTyping(true);
    setTimeout(function() { setTyping(false); }, 5000);
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
            <div style={{ fontWeight: 700, fontSize: 15 }}>{(window.__petConfig||{}).charName||'Pety'}</div>
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
          <button className="btn icon ghost" title="搜索" onClick={function(){ setSearchMode(function(v){ return !v; }); setSearchQuery(""); }}
            style={{ fontSize: 14, padding: 6 }}>🔍</button>
          {mode === "voice" && (
            <button className="btn icon ghost" title={chatVisible?"隐藏聊天":"显示聊天"} onClick={()=>setChatVisible(v=>!v)}>
              <Icon name={chatVisible?"eye":"chat"} />
            </button>
          )}
        </div>

        {/* search bar */}
        {searchMode && (
          <div style={{ padding: "8px 20px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, alignItems: "center" }}>
            <input type="text" value={searchQuery} onChange={function(e){ doSearch(e.target.value); }}
              placeholder="搜索全部聊天记录..." autoFocus
              style={{ flex: 1, background: "var(--surface-2)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "var(--text-primary)", outline: "none" }} />
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              {searchResults ? (searchResults.length + " 条") : ""}
            </span>
            <button className="chip ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={function(){ setSearchMode(false); setSearchQuery(""); setSearchResults(null); }}>✕</button>
          </div>
        )}

        {/* messages — stays on top */}
        {showChat && (
          <div ref={scrollRef} className="scrollable" style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            {(searchResults ? searchResults : msgs).map(function(m, i, arr) {
              var showDivider = false;
              var dividerText = "";
              if (i === 0) {
                showDivider = true;
                dividerText = m.t || "";
              } else if (m.ts && arr[i-1].ts) {
                var gap = m.ts - arr[i-1].ts;
                if (gap > 5 * 60 * 1000) {
                  showDivider = true;
                  dividerText = m.t || "";
                }
              }
              return <React.Fragment key={i}>
                {showDivider && <TimeDivider text={dividerText} />}
                <Bubble m={m} petHue={tweaks.petHue} searchQuery={searchQuery} />
              </React.Fragment>;
            })}
            {typing &&
            <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: "var(--surface-1)", display: "flex", gap: 4 }}>
                <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
              </div>
            }
          </div>
        )}

        {/* voice visual — shown in voice mode, now BELOW chat */}
        {mode === "voice" && relay && relay.voiceServiceStatus && relay.voiceServiceStatus.status !== 'ready' && relay.voiceServiceStatus.status !== 'off' && (
          <div style={{ padding: "8px 16px", background: relay.voiceServiceStatus.status === 'error' ? "rgba(229,64,64,0.15)" : "rgba(242,191,77,0.15)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: relay.voiceServiceStatus.status === 'error' ? "rgba(229,64,64,0.9)" : "rgba(242,191,77,0.9)" }}>
              {relay.voiceServiceStatus.status === 'loading' ? '⏳' : '⚠️'} {relay.voiceServiceStatus.detail || '语音服务状态未知'}
            </span>
          </div>
        )}
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
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.04)" }}>
            {pendingImage && (
              <div style={{ padding: "8px 18px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <img src={pendingImage.dataUrl} style={{ height: 60, borderRadius: 6 }} alt="" />
                <button className="chip ghost" style={{ fontSize: 10, padding: "2px 6px" }} onClick={function(){ setPendingImage(null); }}>✕</button>
              </div>
            )}
            <div style={{ padding: "12px 18px", display: "flex", gap: 10 }}>
              <button className="btn icon" title="添加附件" style={{ color: "var(--text-secondary)" }} onClick={function(){
                if (window.electronAPI && window.electronAPI.pickFile) {
                  window.electronAPI.pickFile().then(function(f) {
                    if (f) setPendingImage(f);
                  });
                }
              }}><Icon name="paperclip" /></button>
              <input className="input" style={{ borderRadius: 20, flex: 1 }} placeholder={pendingImage ? "添加说明文字..." : "说点什么..."} value={draft} onChange={function(e){ setDraft(e.target.value); }}
                onKeyDown={function(e){ if (e.key === "Enter") send(); }}
                onPaste={function(e){
                  var items = e.clipboardData && e.clipboardData.items;
                  if (!items) return;
                  for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") >= 0) {
                      e.preventDefault();
                      var blob = items[i].getAsFile();
                      var reader = new FileReader();
                      reader.onload = function(ev) {
                        setPendingImage({ name: "paste.png", mime: "image/png", isImage: true, dataUrl: ev.target.result });
                      };
                      reader.readAsDataURL(blob);
                      break;
                    }
                  }
                }} />
              <button className="btn icon" onClick={send}><Icon name="send" /></button>
              <button className="btn icon" onClick={function(){setMode("voice");}} title="切到语音"><Icon name="mic" /></button>
            </div>
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
            · 对话记录存在本地<br/>
            · 文字 / 语音 随时切<br/>
            · 语音对话自动记入文字记录
          </div>
        </div>
        <div className="surface" style={{ marginTop: 8 }}>
          <div className="label">云端备份</div>
          {showUpload ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <input type="text" value={uploadUrl} onChange={function(e){ setUploadUrl(e.target.value); }}
                placeholder="输入上传地址..."
                style={{ background: "var(--surface-2)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text-primary)", outline: "none" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button className="chip" style={{ flex: 1, justifyContent: "center", padding: 8, fontSize: 11 }} onClick={doUpload}>上传</button>
                <button className="chip" style={{ flex: 1, justifyContent: "center", padding: 8, fontSize: 11 }} onClick={doDownload}>导入</button>
                <button className="chip ghost" style={{ padding: 8, fontSize: 11 }} onClick={function(){ setShowUpload(false); }}>取消</button>
              </div>
              {uploadStatus && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{uploadStatus}</div>}
              {downloadStatus && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{downloadStatus}</div>}
            </div>
          ) : (
            <button className="chip ghost" style={{ width: "100%", justifyContent: "center", padding: 8, fontSize: 11, marginTop: 6 }} onClick={function(){ setShowUpload(true); }}>
              云端同步
            </button>
          )}
        </div>
      </div>
    </div>);

};

const TimeDivider = ({ text }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0", padding: "0 20px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }}></div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap", padding: "2px 8px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>{text}</div>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }}></div>
    </div>
  );
};

const getTimeOnly = function(t) {
  if (!t) return "";
  var parts = (t || "").split(" ");
  if (parts.length >= 3) return parts[1] + " " + parts[2];
  return t;
};

const HighlightText = function({ text, query }) {
  if (!query || !text) return text || "";
  var lower = text.toLowerCase();
  var q = query.toLowerCase();
  var parts = [];
  var lastIdx = 0;
  var idx = lower.indexOf(q);
  while (idx >= 0) {
    if (idx > lastIdx) parts.push(React.createElement("span", { key: lastIdx }, text.slice(lastIdx, idx)));
    parts.push(React.createElement("mark", { key: "h" + idx, style: { background: "#f5d75e", color: "#1a1a1a", borderRadius: 3, padding: "0 2px" } }, text.slice(idx, idx + q.length)));
    lastIdx = idx + q.length;
    idx = lower.indexOf(q, lastIdx);
  }
  if (lastIdx < text.length) parts.push(React.createElement("span", { key: lastIdx }, text.slice(lastIdx)));
  return parts;
};

const ThinkingBlock = ({ thinking }) => {
  const [open, setOpen] = React.useState(false);
  if (!thinking) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={() => setOpen(!open)} style={{ cursor: "pointer", fontSize: 11, color: "rgba(242,191,77,0.7)", display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
        <span>思考过程</span>
      </div>
      {open && (
        <div style={{ marginTop: 4, padding: "6px 8px", background: "rgba(242,191,77,0.08)", borderRadius: 6, fontSize: 11, color: "rgba(255,255,255,0.5)", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto", lineHeight: 1.5 }}>
          {thinking}
        </div>
      )}
    </div>
  );
};

const Bubble = ({ m, petHue, searchQuery }) => {
  const isMe = m.who === "me";
  var hasImage = !!m.imageUrl;
  const [favSaving, setFavSaving] = React.useState(false);
  const [favDone, setFavDone] = React.useState(false);

  const saveFavorite = async () => {
    if (!window.electronAPI || !m.txt || isMe) return;
    setFavSaving(true);
    try {
      let b64 = null;
      if (window.electronAPI.getCachedTts) {
        b64 = await window.electronAPI.getCachedTts(m.txt);
      }
      if (!b64) {
        const resp = await fetch("http://localhost:9800/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: m.txt }),
        });
        if (!resp.ok) throw new Error("tts failed");
        const blob = await resp.blob();
        const buf = await blob.arrayBuffer();
        var bytes2 = new Uint8Array(buf), s2 = '';
        for (var i2 = 0; i2 < bytes2.length; i2 += 8192) s2 += String.fromCharCode.apply(null, bytes2.subarray(i2, i2 + 8192));
        b64 = btoa(s2);
      }
      await window.electronAPI.saveVoiceFavorite({ text: m.txt, audioBase64: b64 });
      setFavDone(true);
    } catch(e) {}
    setFavSaving(false);
  };

  return (
    <div className={`tg-row ${isMe ? "me" : "pet"}`}>
      <div className={`tg-bubble ${isMe ? "me" : "pet"}${hasImage ? " has-image" : ""}`}>
        {m.thinking && <ThinkingBlock thinking={m.thinking} />}
        {m.imageUrl && <img src={m.imageUrl} alt="图片" />}
        {m.txt && <span className="tg-txt">{searchQuery ? React.createElement(HighlightText, { text: m.txt, query: searchQuery }) : m.txt}</span>}
        <span className="tg-time">
          {getTimeOnly(m.t)}
          {isMe && <span className={`tg-tick${m.acked ? " acked" : ""}`}>{m.acked ? " ✓✓" : " ✓"}</span>}
          {!isMe && m.txt && (
            <span onClick={saveFavorite} style={{ marginLeft: 4, cursor: "pointer", opacity: favDone ? 1 : 0.4, fontSize: 11 }} title="收藏语音">
              {favSaving ? "..." : favDone ? "♥" : "♡"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};


Object.assign(window, { HomePage, AnimationPage, MonitorPage, ChatPage });