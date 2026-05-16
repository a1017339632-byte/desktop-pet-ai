// ==========================================================
// ChatPage
// ==========================================================

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
  const [incomingCall, setIncomingCall] = React.useState(null); // { caller } or null
  const callRingtoneRef = React.useRef(null);
  var doSearch = function(q) {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimerRef.current = setTimeout(function() {
      if (window.electronAPI && window.electronAPI.searchChat) {
        window.electronAPI.searchChat(q.trim()).then(function(results) {
          setSearchResults(results.map(function(m) {
            var d = new Date(m.ts);
            var r = { who: m.who, txt: m.text, emotion: m.emotion || "idle", ts: d.getTime(),
              t: d.getFullYear() + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0") + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
              acked: true };
            if (m.isEvent) r.isEvent = true;
            return r;
          }));
        });
      }
    }, 300);
  };

  // === Incoming Call Listener ===
  React.useEffect(function() {
    function handleCallEvent(e) {
      var data = e.detail;
      if (data.type === 'incoming-call') {
        setIncomingCall({ caller: data.caller || '来电中...' });
        // Try to play ringtone
        try {
          var audio = new Audio('assets/ringtone.mp3');
          audio.loop = true;
          audio.play().catch(function() {});
          callRingtoneRef.current = audio;
        } catch(ex) {}
      }
      if (data.type === 'call-dismissed') {
        // Stop ringtone
        if (callRingtoneRef.current) {
          callRingtoneRef.current.pause();
          callRingtoneRef.current.currentTime = 0;
          callRingtoneRef.current = null;
        }
        if (incomingCall && data.reason === 'missed') {
          if (relay) relay.setMessages(function(m) {
            return m.concat([{
              who: 'system', txt: '\u{1F4DE} 未接来电',
              t: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              ts: Date.now(), acked: true, isCallMsg: true
            }]);
          });
        }
        setIncomingCall(null);
      }
    }
    window.addEventListener('pety-relay', handleCallEvent);
    return function() { window.removeEventListener('pety-relay', handleCallEvent); };
  }, [incomingCall, relay]);

  var acceptCall = function() {
    if (callRingtoneRef.current) {
      callRingtoneRef.current.pause();
      callRingtoneRef.current.currentTime = 0;
      callRingtoneRef.current = null;
    }
    setIncomingCall(null);
    if (window.electronAPI && window.electronAPI.callResponse) {
      window.electronAPI.callResponse('accepted');
    }
    setMode('voice');
  };

  var declineCall = function() {
    if (callRingtoneRef.current) {
      callRingtoneRef.current.pause();
      callRingtoneRef.current.currentTime = 0;
      callRingtoneRef.current = null;
    }
    if (window.electronAPI && window.electronAPI.callResponse) {
      window.electronAPI.callResponse('declined');
    }
    if (relay) relay.setMessages(function(m) {
      return m.concat([{
        who: 'system', txt: '\u{1F4DE} 已拒绝通话',
        t: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        ts: Date.now(), acked: true, isCallMsg: true
      }]);
    });
    setIncomingCall(null);
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
              var msg = {
                who: m.who === "pet" ? "pet" : "me",
                t: tStr,
                txt: m.text,
                ts: new Date(m.ts).getTime(),
                acked: true,
                audioFile: m.audioFile || null,
                thinking: m.thinking || null,
              };
              if (m.isEvent) msg.isEvent = true;
              return msg;
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
  const vadCooldownRef = React.useRef(0);

  const micStartingRef = React.useRef(false);
  const audioCtxRef = React.useRef(null);
  const startMic = async () => {
    if (micActive || micStartingRef.current) return;
    micStartingRef.current = true;
    try {
      // NOTE: Do NOT call electronAPI.startVoiceServer() here.
      // The mode useEffect already calls it via IPC. Calling it here
      // creates a feedback loop: startVoiceServer -> setVoiceMode -> broadcast
      // -> globalVoice useEffect -> setMode -> mode useEffect -> startMic -> loop
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Close any leaked AudioContext from a previous session
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch(_) {}
      }
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
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
          if (vadCooldownRef.current > 0) { vadCooldownRef.current--; voiceCountRef.current = 0; return; }
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
              vadCooldownRef.current = 15;
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
    // Close AudioContext to prevent accumulation (browsers limit ~6-8 active contexts)
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch(_) {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    isRecordingRef.current = false;
    micStartingRef.current = false;
    setMicActive(false);
  };

  // Track whether the mode change was triggered by a globalVoice broadcast
  // to avoid sending redundant IPC back to main.js (which would cause a loop)
  const modeFromGlobalRef = React.useRef(false);

  const prevGlobalVoice = React.useRef(relay && relay.globalVoice);
  React.useEffect(() => {
    var gv = relay && relay.globalVoice;
    if (gv && mode !== "voice") {
      modeFromGlobalRef.current = true;
      setMode("voice");
    }
    if (prevGlobalVoice.current && !gv && mode === "voice") {
      modeFromGlobalRef.current = true;
      setMode("text");
    }
    prevGlobalVoice.current = gv;
  }, [relay && relay.globalVoice]);

  const prevMode = React.useRef(mode);
  React.useEffect(() => {
    var fromGlobal = modeFromGlobalRef.current;
    modeFromGlobalRef.current = false;
    if (mode === "voice" && prevMode.current !== "voice") {
      // Start mic locally; only tell main.js if WE initiated the mode change
      // (if fromGlobal, main.js already started the server via setVoiceMode)
      if (!fromGlobal && window.electronAPI && window.electronAPI.startVoiceServer) {
        window.electronAPI.startVoiceServer();
      }
      startMic();
    } else if (mode !== "voice" && prevMode.current === "voice") {
      stopMic();
      // Only tell main.js if WE initiated the mode change
      // (if fromGlobal, main.js already stopped the server via setVoiceMode)
      if (!fromGlobal && window.electronAPI && window.electronAPI.stopVoiceServer) {
        window.electronAPI.stopVoiceServer();
      }
    }
    prevMode.current = mode;
  }, [mode]);

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
            <div style={{ fontWeight: 700, fontSize: 15 }}>{(window.__petConfig||{}).charName||'AI'}</div>
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

        {/* incoming call banner */}
        {incomingCall && (
          <div style={{
            padding: "12px 20px",
            background: "linear-gradient(135deg, rgba(102,178,102,0.15), rgba(86,160,208,0.15))",
            borderBottom: "1px solid rgba(102,178,102,0.3)",
            display: "flex", alignItems: "center", gap: 12,
            animation: "call-banner-pulse 2s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 22, animation: "call-ring-anim 1.2s ease-in-out infinite" }}>📞</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e0d8d0" }}>{incomingCall.caller}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>来电中...</div>
            </div>
            <button className="btn" onClick={acceptCall} style={{
              background: "rgba(102,178,102,0.85)", padding: "8px 16px", fontSize: 12, borderRadius: 20, border: "none", color: "#fff", cursor: "pointer",
            }}>接听</button>
            <button className="btn" onClick={declineCall} style={{
              background: "rgba(229,64,64,0.7)", padding: "8px 16px", fontSize: 12, borderRadius: 20, border: "none", color: "#fff", cursor: "pointer",
            }}>拒绝</button>
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
              var isCallMsg = m.isCallMsg || (m.txt && m.txt.indexOf('\u{1F4DE}') === 0);
              var isEventMsg = m.isEvent;
              return <React.Fragment key={i}>
                {showDivider && <TimeDivider text={dividerText} />}
                {isCallMsg || isEventMsg ? <SystemEventMessage text={m.txt} /> : <Bubble m={m} petHue={tweaks.petHue} searchQuery={searchQuery} />}
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

const SystemEventMessage = ({ text }) => {
  return (
    <div style={{ textAlign: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{text}</span>
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

// Markdown renderer helper
const renderMarkdown = (text) => {
  if (!text) return "";
  if (typeof marked === "undefined") return text;
  // Configure marked for safe output
  marked.setOptions({ breaks: true, gfm: true });
  var rawHtml = marked.parse(text);
  // Sanitize with DOMPurify if available
  if (typeof DOMPurify !== "undefined") {
    rawHtml = DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['p','br','strong','em','b','i','code','pre','ul','ol','li','a','blockquote','h1','h2','h3','h4','h5','h6','hr','del','table','thead','tbody','tr','th','td','span'], ALLOWED_ATTR: ['href','target','rel','class'] });
  }
  // Remove wrapping <p> for single-paragraph messages to avoid extra spacing
  var trimmed = rawHtml.trim();
  if (trimmed.startsWith("<p>") && trimmed.endsWith("</p>") && trimmed.indexOf("<p>", 3) === -1) {
    trimmed = trimmed.slice(3, -4);
  }
  return trimmed;
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
        {m.txt && (searchQuery
          ? <span className="tg-txt">{React.createElement(HighlightText, { text: m.txt, query: searchQuery })}</span>
          : <span className="tg-txt markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.txt) }}></span>
        )}
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

Object.assign(window, { ChatPage });
