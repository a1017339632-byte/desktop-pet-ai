// ==========================================================
// ws-bridge.jsx — Relay 连接管理
// Electron里用IPC（共享主进程的连接），浏览器里用WebSocket
// ==========================================================

const RELAY_URL = (window.__PETY_CONFIG__ && window.__PETY_CONFIG__.relayUrl) || localStorage.getItem('pety-relay-url') || "ws://localhost:8765";

const useRelay = () => {
  const [connected, setConnected] = React.useState(false);
  const [online, setOnline] = React.useState(false);
  const [emotion, setEmotion] = React.useState("idle");
  const [messages, setMessages] = React.useState([]);
  const [screenInfo, setScreenInfo] = React.useState({ foreground: null, windows: [] });
  const [supervisorData, setSupervisorData] = React.useState(null);
  // Voice state is driven by main.js (source of truth). Do NOT init from
  // localStorage — stale values cause panel/float desync after restart.
  const [globalVoice, setGlobalVoice] = React.useState(false);
  const [voiceServiceStatus, setVoiceServiceStatus] = React.useState({ status: 'off', detail: '' });
  const isElectron = !!window.electronAPI;

  const addMessage = React.useCallback((who, txt, msgId, thinking, isEvent) => {
    const now = new Date();
    const hh = now.getHours();
    const mer = hh >= 12 ? "PM" : "AM";
    const hh12 = ((hh + 11) % 12) + 1;
    const t = String(hh12).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") + " " + mer;
    const dateStr = now.getFullYear() + "/" + String(now.getMonth()+1).padStart(2,"0") + "/" + String(now.getDate()).padStart(2,"0");
    const fullTime = dateStr + " " + t;
    const msg = { who, t: fullTime, txt, msgId, acked: who !== "me", ts: Date.now() };
    if (thinking) msg.thinking = thinking;
    if (isEvent) msg.isEvent = true;
    setMessages((m) => [...m.slice(-99), msg]);
  }, []);

  const handleData = React.useCallback((data) => {
    if (data.type === "ack" && data.msgId) {
      setTimeout(() => {
        setMessages((m) => m.map((msg) => msg.msgId === data.msgId ? { ...msg, acked: true } : msg));
      }, 1500);
      return;
    }
    if (data.type === "status") {
      setOnline(!!data.online);
      setEmotion(data.emotion || "idle");
    } else if (data.type === "emotion") {
      setEmotion(data.emotion || "idle");
    } else if (data.type === "screen_info") {
      setScreenInfo({
        foreground: data.foreground,
        windows: data.windows || [],
        lastUpdate: data.last_update,
      });
    } else if (data.type === "supervisor_status") {
      setSupervisorData(data);
    } else if (data.type === "unread_messages") {
      var msgs = data.messages || [];
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        addMessage(m.who === "pet" ? "pet" : "me", m.text);
      }
    } else if (data.type === "chat_history") {
      var hist = data.history || [];
      setMessages(function(prev) {
        if (prev.length > 0) return prev;
        return hist.map(function(m) {
          var tStr = "";
          var tsMs = 0;
          if (m.ts) {
            var d = new Date(m.ts);
            tsMs = d.getTime();
            var hh = d.getHours();
            var mer = hh >= 12 ? "PM" : "AM";
            var hh12 = ((hh + 11) % 12) + 1;
            var mm2 = String(d.getMinutes()).padStart(2, "0");
            var dateStr = d.getFullYear() + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + String(d.getDate()).padStart(2,"0");
            tStr = dateStr + " " + String(hh12).padStart(2, "0") + ":" + mm2 + " " + mer;
          }
          var entry = {
            who: m.who === "pet" ? "pet" : "me",
            t: tStr,
            txt: m.text,
            ts: tsMs,
            acked: true,
          };
          if (m.isEvent) entry.isEvent = true;
          return entry;
        });
      });
    } else if (data.type === "voice-mode") {
      setGlobalVoice(!!data.active);
      localStorage.setItem('pety-voice-global', data.active ? 'on' : 'off');
    } else if (data.type === "voice-status") {
      setVoiceServiceStatus({ status: data.status, detail: data.detail });
    } else if (data.type === "tts-audio" && data.audioHex) {
      try {
        var bytes = new Uint8Array(data.audioHex.length / 2);
        for (var i = 0; i < data.audioHex.length; i += 2) bytes[i/2] = parseInt(data.audioHex.substr(i, 2), 16);
        var blob = new Blob([bytes], { type: 'audio/mp3' });
        var url = URL.createObjectURL(blob);
        window._ttsQueue = window._ttsQueue || [];
        window._ttsPlaying = window._ttsPlaying || false;
        window._ttsQueue.push(url);
        if (!window._ttsPlaying) {
          (function playNext() {
            if (window._ttsQueue.length === 0) { window._ttsPlaying = false; return; }
            window._ttsPlaying = true;
            var nextUrl = window._ttsQueue.shift();
            var a = new Audio(nextUrl);
            a.onended = function() { URL.revokeObjectURL(nextUrl); playNext(); };
            a.onerror = function() { URL.revokeObjectURL(nextUrl); playNext(); };
            a.play().catch(function() { playNext(); });
          })();
        }
      } catch(e) {}
    } else if (data.type === "user-chat") {
      addMessage("me", data.text, data.msgId, null, data.isEvent);
    } else if (data.text) {
      addMessage("pet", data.text, null, data.thinking);
      if (data.emotion) setEmotion(data.emotion);
      var imgUrl = data.image || (data.file && data.file.isImage ? data.file.dataUrl : null);
      if (imgUrl) {
        setMessages(function(m) {
          var last = m[m.length - 1];
          if (last && last.who === "pet") {
            var updated = m.slice();
            updated[updated.length - 1] = Object.assign({}, last, { imageUrl: imgUrl });
            return updated;
          }
          return m;
        });
      }
      if (data.audio) {
        setMessages(function(m) {
          var last = m[m.length - 1];
          if (last && last.who === "pet") {
            var updated = m.slice();
            updated[updated.length - 1] = Object.assign({}, last, { audioUrl: data.audio });
            return updated;
          }
          return m;
        });
      }
    }
  }, [addMessage]);

  // === Electron: use IPC relay from main process ===
  React.useEffect(() => {
    if (!isElectron) return;
    setConnected(true);

    // Register IPC listener once
    if (window.electronAPI.onRelayMessage) {
      window.electronAPI.onRelayMessage(() => {});
    }

    // Use CustomEvent for React-safe updates
    const handler = (e) => handleData(e.detail);
    window.addEventListener('pety-relay', handler);

    // Pull current status after mount (avoids race with did-finish-load)
    if (window.electronAPI.getRelayStatus) {
      window.electronAPI.getRelayStatus().then((status) => {
        if (status) handleData(status);
      });
    }

    return () => window.removeEventListener('pety-relay', handler);
  }, [isElectron, handleData]);

  // === Browser: use direct WebSocket ===
  const wsRef = React.useRef(null);
  const reconnectRef = React.useRef(null);

  React.useEffect(() => {
    if (isElectron) return;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      const ws = new WebSocket(RELAY_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify({ role: "frontend", id: "pety-browser-" + Date.now() }));
        setConnected(true);
      };
      ws.onmessage = (evt) => {
        try { handleData(JSON.parse(evt.data)); } catch (e) {}
      };
      ws.onclose = () => {
        setConnected(false); setOnline(false); wsRef.current = null;
        reconnectRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isElectron, handleData]);

  const sendChat = React.useCallback((text) => {
    const msgId = "msg_" + Date.now();
    if (isElectron) {
      window.electronAPI.relaySend({ type: "chat", text, msgId });
    } else {
      addMessage("me", text, msgId);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "chat", text, msgId }));
      }
    }
  }, [isElectron, addMessage]);

  const sendPoke = React.useCallback(() => {
    if (isElectron) {
      window.electronAPI.relaySend({ type: "poke" });
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "poke" }));
    }
  }, [isElectron]);

  const sendFile = React.useCallback((file) => {
    var msgId = "msg_" + Date.now();
    var txt = file.isImage ? "[图片]" : "[文件] " + file.name;
    if (isElectron) {
      window.electronAPI.relaySend({ type: "chat", text: txt, msgId, file: { name: file.name, mime: file.mime, dataUrl: file.dataUrl } });
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text: txt, msgId, file: { name: file.name, mime: file.mime, dataUrl: file.dataUrl } }));
    }
    addMessage("me", txt, msgId);
    if (file.isImage) {
      setMessages(function(m) {
        return m.map(function(msg) {
          return msg.msgId === msgId ? Object.assign({}, msg, { imageUrl: file.dataUrl }) : msg;
        });
      });
    }
  }, [isElectron, addMessage]);

  const requestChatHistory = React.useCallback(() => {
    if (isElectron) {
      window.electronAPI.relaySend({ type: "request_chat_history" });
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "request_chat_history" }));
    }
  }, [isElectron]);

  const requestSupervisor = React.useCallback(() => {
    if (isElectron) {
      window.electronAPI.relaySend({ type: "request_supervisor" });
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "request_supervisor" }));
    }
  }, [isElectron]);

  return {
    connected,
    online,
    emotion,
    messages,
    screenInfo,
    supervisorData,
    globalVoice,
    voiceServiceStatus,
    sendChat,
    sendFile,
    sendPoke,
    requestSupervisor,
    requestChatHistory,
    setMessages,
    ws: wsRef,
  };
};

const useDesktopBlur = () => null;

Object.assign(window, { useRelay, useDesktopBlur, RELAY_URL });
