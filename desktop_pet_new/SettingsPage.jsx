// ==========================================================
// SettingsPage
// ==========================================================

const SettingsPage = ({ tweaks }) => {
  const [apiKey, setApiKey] = React.useState("");
  const [voiceId, setVoiceId] = React.useState("");
  const [ringtonePath, setRingtonePath] = React.useState("");
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
  const [relayUrl, setRelayUrl] = React.useState("ws://localhost:8765");
  const [diaryUrl, setDiaryUrl] = React.useState("");
  const [screentimeUrl, setScreentimeUrl] = React.useState("");
  const [tokenStats, setTokenStats] = React.useState(null);
  const [tokenBreakdown, setTokenBreakdown] = React.useState(null);
  const [apiSaved, setApiSaved] = React.useState("");

  const [memBackend, setMemBackend] = React.useState("local");
  const [memPath, setMemPath] = React.useState("");
  const [memUrl, setMemUrl] = React.useState("");
  const [memSaved, setMemSaved] = React.useState("");
  const [memTestResult, setMemTestResult] = React.useState("");

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
        if (cfg.ringtone_path) setRingtonePath(cfg.ringtone_path);
        if (cfg.stt_engine) setSttEngine(cfg.stt_engine);
        if (cfg.tencent_secret_id) setTencentSecretId(cfg.tencent_secret_id);
        if (cfg.tencent_secret_key) setTencentSecretKey(cfg.tencent_secret_key);
        if (cfg.memory_backend) setMemBackend(cfg.memory_backend);
        if (cfg.memory_url) setMemUrl(cfg.memory_url);
        if (cfg.memory_path) setMemPath(cfg.memory_path);
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
        setRelayUrl(cfg.relayUrl || "ws://localhost:8765");
        setDiaryUrl(cfg.diaryUrl || "");
        setScreentimeUrl(cfg.screentimeUrl || "");
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
    const cfg = { stt_engine: sttEngine, memory_backend: memBackend, memory_path: memPath, memory_url: memUrl, ringtone_path: ringtonePath.trim() };
    if (apiKey.trim()) cfg.minimax_api_key = apiKey.trim();
    if (voiceId.trim()) cfg.tts_voice_id = voiceId.trim();
    if (tencentSecretId.trim()) cfg.tencent_secret_id = tencentSecretId.trim();
    if (tencentSecretKey.trim()) cfg.tencent_secret_key = tencentSecretKey.trim();
    window.electronAPI.saveVoiceConfig(cfg).then(() => {
      setSaved("已保存！语音服务重启中...");
      setTimeout(() => setSaved(""), 4000);
    });
  };

  const saveMemConfig = () => {
    if (!window.electronAPI || !window.electronAPI.getVoiceConfig) return;
    window.electronAPI.getVoiceConfig().then(existing => {
      const cfg = { ...existing, memory_backend: memBackend, memory_path: memPath, memory_url: memUrl };
      window.electronAPI.saveVoiceConfig(cfg).then(() => {
        setMemSaved("已保存！");
        setTimeout(() => setMemSaved(""), 3000);
      });
    });
  };

  const browseMemFile = () => {
    if (window.electronAPI && window.electronAPI.pickMemoryFile) {
      window.electronAPI.pickMemoryFile().then(filePath => {
        if (filePath) setMemPath(filePath);
      });
    }
  };

  const saveApiCfg = () => {
    if (!window.electronAPI || !window.electronAPI.saveApiConfig) return;
    window.electronAPI.saveApiConfig({
      mode: connMode, provider: llmProvider, apiKey: llmApiKey,
      baseUrl: llmBaseUrl, model: llmModel, charName, userName, systemPrompt,
      memoryTopN, memoryRecentN, memoryTodoN, maxContextTokens, historyPreloadN,
      relayUrl, diaryUrl, screentimeUrl,
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

          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <label style={labelStyle}>Relay URL (中继服务器 WebSocket)</label>
            <input type="text" value={relayUrl} onChange={e => setRelayUrl(e.target.value)} placeholder="ws://localhost:8765" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Diary URL (日记服务器，留空禁用)</label>
            <input type="text" value={diaryUrl} onChange={e => setDiaryUrl(e.target.value)} placeholder="http://localhost:9801" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Screen Time URL (可选，需自行部署手机屏幕时间追踪服务)</label>
            <input type="text" value={screentimeUrl} onChange={e => setScreentimeUrl(e.target.value)} placeholder="留空禁用" style={inputStyle} />
          </div>

          {connMode === "api" && (<>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Provider</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["openai", "OpenAI 格式"], ["anthropic", "Anthropic"]].map(([val, label]) => (
                  <button key={val} onClick={() => {
                    setLlmProvider(val);
                    if (val === "anthropic") {
                      setLlmBaseUrl("https://api.anthropic.com");
                      if (!llmModel || llmModel.startsWith("gpt")) setLlmModel("claude-sonnet-4-6");
                    } else {
                      setLlmBaseUrl("https://api.openai.com");
                      if (!llmModel || llmModel.startsWith("claude")) setLlmModel("gpt-4o-mini");
                    }
                  }} style={{
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
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>来电铃声</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={ringtonePath} onChange={e => setRingtonePath(e.target.value)} placeholder="留空使用默认铃声 (assets/ringtone.mp3)" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={function() {
                if (window.electronAPI && window.electronAPI.pickFile) {
                  window.electronAPI.pickFile().then(function(f) {
                    if (f && f.path) setRingtonePath(f.path);
                    else if (f && f.name) setRingtonePath(f.name);
                  });
                }
              }} style={{ ...btnStyle, background: "rgba(86,160,208,0.7)", whiteSpace: "nowrap" }}>浏览</button>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              自定义来电铃声文件路径 · 支持 mp3/wav/ogg
            </div>
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

        <div style={{ marginTop: 16, padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 14, color: "#e0d8d0", marginBottom: 12 }}>记忆库后端</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["local", "内置"], ["custom", "本地文件"], ["cloud", "云端"]].map(([val, label]) => (
              <button key={val} onClick={() => setMemBackend(val)} style={{
                ...btnStyle, flex: 1, background: memBackend === val ? "rgba(208,116,86,0.8)" : "rgba(255,255,255,0.06)",
                color: memBackend === val ? "#fff" : "rgba(255,255,255,0.5)",
              }}>{label}</button>
            ))}
          </div>
          {memBackend === "custom" && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>记忆库文件路径</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={memPath} onChange={e => setMemPath(e.target.value)} placeholder="C:\path\to\memories.json" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={browseMemFile} style={{ ...btnStyle, background: "rgba(86,160,208,0.7)", whiteSpace: "nowrap" }}>浏览</button>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                指定你自己的记忆库JSON文件路径 · 会直接读写该文件
              </div>
            </div>
          )}
          {memBackend === "cloud" && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>云端记忆库 URL</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={memUrl} onChange={e => setMemUrl(e.target.value)} placeholder="http://your-server:9527" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={function() {
                  if (!memUrl.trim()) return;
                  setMemTestResult("测试中...");
                  if (window.electronAPI && window.electronAPI.testMemoryConnection) {
                    window.electronAPI.testMemoryConnection(memUrl.trim()).then(function(r) {
                      setMemTestResult(r.success ? "连接成功！" + (r.data && r.data.total !== undefined ? " 共" + r.data.total + "条记忆" : "") : "失败: " + (r.error || "unknown"));
                      setTimeout(function() { setMemTestResult(""); }, 4000);
                    });
                  }
                }} style={{ ...btnStyle, background: "rgba(86,160,208,0.7)", whiteSpace: "nowrap" }}>测试连接</button>
              </div>
              {memTestResult && <div style={{ marginTop: 4, fontSize: 11, color: memTestResult.includes("成功") ? "rgba(102,178,102,0.9)" : "rgba(229,100,100,0.9)" }}>{memTestResult}</div>}
              <div style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                接入你自己搭建的记忆库服务 · 需实现标准API接口
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={saveMemConfig} style={btnStyle}>保存</button>
            {memSaved && <span style={{ fontSize: 12, color: "rgba(102,178,102,0.9)" }}>{memSaved}</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.6, margin: 0 }}>
          如果有 bug 可发送邮件至 <span style={{ color: "rgba(255,255,255,0.5)" }}>1017339632@qq.com</span>，有时间就会修复~
          <br />最好附带 bug 复现条件以及触发 bug 的截图或者报错
        </p>
      </div>
    </div>
  );
};

Object.assign(window, { SettingsPage });
