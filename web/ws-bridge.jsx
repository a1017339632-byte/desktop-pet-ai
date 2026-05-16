// ==========================================================
// ws-bridge.jsx — Relay 连接管理
// Electron里用IPC（共享主进程的连接），浏览器里用WebSocket
// ==========================================================

const RELAY_URL = "ws://119.91.115.102:8765";

const useRelay = () => {
  const [connected, setConnected] = React.useState(false);
  const [online, setOnline] = React.useState(false);
  const [emotion, setEmotion] = React.useState("idle");
  const [messages, setMessages] = React.useState([]);
  const [screenInfo, setScreenInfo] = React.useState({ foreground: null, windows: [] });
  const isElectron = !!window.electronAPI;

  const addMessage = React.useCallback((who, txt) => {
    const now = new Date();
    const hh = now.getHours();
    const mer = hh >= 12 ? "PM" : "AM";
    const hh12 = ((hh + 11) % 12) + 1;
    const t = `${String(hh12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ${mer}`;
    setMessages((m) => [...m.slice(-99), { who, t, txt }]);
  }, []);

  const handleData = React.useCallback((data) => {
    if (data.type === "status") {
      setOnline(!!data.online);
      setEmotion(data.emotion || "idle");
      if (data.text) addMessage("pet", data.text);
    } else if (data.type === "emotion") {
      setEmotion(data.emotion || "idle");
    } else if (data.type === "screen_info") {
      setScreenInfo({
        foreground: data.foreground,
        windows: data.windows || [],
        lastUpdate: data.last_update,
      });
    } else if (data.type === "user-chat") {
      addMessage("me", data.text);
    } else if (data.text) {
      addMessage("pet", data.text);
      if (data.emotion) setEmotion(data.emotion);
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

  // Listen for cross-window user-chat events (Tauri)
  React.useEffect(() => {
    if (!window.__TAURI__) return;
    let unlisten;
    window.__TAURI__.event.listen('user-chat', (event) => {
      addMessage("me", event.payload.text);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, [addMessage]);

  const sendChat = React.useCallback((text) => {
    addMessage("me", text);
    if (isElectron) {
      window.electronAPI.relaySend({ type: "chat", text });
    } else {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "chat", text }));
      }
      if (window.__TAURI__) {
        window.__TAURI__.event.emit('user-chat', { text });
        try { window.__TAURI__.webviewWindow.WebviewWindow.getByLabel('main')?.emit('user-chat', { text }); } catch(e) {}
      }
    }
  }, [isElectron, addMessage]);

  // Poll screen info in Tauri mode
  React.useEffect(() => {
    if (!window.__TAURI__) return;
    const poll = async () => {
      try {
        const info = await window.__TAURI__.core.invoke('get_screen_info');
        setScreenInfo({
          foreground: info.foreground,
          windows: info.windows || [],
        });
      } catch(e) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const sendPoke = React.useCallback(() => {
    if (isElectron) {
      window.electronAPI.relaySend({ type: "poke" });
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "poke" }));
    }
  }, [isElectron]);

  return {
    connected,
    online,
    emotion,
    messages,
    screenInfo,
    sendChat,
    sendPoke,
    ws: wsRef,
  };
};

const useDesktopBlur = () => null;

Object.assign(window, { useRelay, useDesktopBlur, RELAY_URL });
