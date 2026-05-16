const { app, BrowserWindow, screen, ipcMain, Tray, Menu, dialog } = require('electron');
const { exec, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Fix GPU process crash on drives with restrictive ACLs.
app.commandLine.appendSwitch('no-sandbox');

let petWin = null;
let panelWin = null;
let tray = null;
const nativeImage = require('electron').nativeImage;
const messageHistory = []; // cache messages for panel sync
const MAX_HISTORY = 100;
let lastRelayStatus = { type: 'status', online: false, emotion: 'idle' };
let voiceServerProcess = null;

// ===== 本地对话历史 =====
let CHAT_DB_PATH = '';
let localChatHistory = [];

function loadLocalChat() {
  try {
    if (fs.existsSync(CHAT_DB_PATH)) {
      localChatHistory = JSON.parse(fs.readFileSync(CHAT_DB_PATH, 'utf8'));
    }
  } catch (e) { localChatHistory = []; }
}

function saveLocalChat() {
  try {
    fs.writeFileSync(CHAT_DB_PATH, JSON.stringify(localChatHistory, null, 2), 'utf8');
  } catch (e) {}
}

let VOICE_DIR = '';

function ensureVoiceDir() {
  if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });
}

function addLocalChat(who, text, emotion, audioFile, isEvent) {
  const now = new Date();
  const entry = {
    who, text, emotion,
    ts: now.toISOString(),
    date: now.getFullYear() + '/' + String(now.getMonth()+1).padStart(2,'0') + '/' + String(now.getDate()).padStart(2,'0'),
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
  if (audioFile) entry.audioFile = audioFile;
  if (isEvent) entry.isEvent = true;
  localChatHistory.push(entry);
  saveLocalChat();
  return entry;
}

function saveVoiceFile(audioBase64, ext) {
  ensureVoiceDir();
  const filename = 'voice_' + Date.now() + '.' + (ext || 'mp3');
  const filePath = path.join(VOICE_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(audioBase64, 'base64'));
  return filePath;
}

function getLocalChat(limit) {
  return localChatHistory.slice(-(limit || 200));
}

// loadLocalChat moved to app.whenReady

// ===== Voice Server =====
function getVoiceConfig() {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'voice_config.json');
    if (fs.existsSync(cfgPath)) return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {}
  return {};
}

function broadcastVoiceStatus(status, detail) {
  const msg = { type: 'voice-status', status, detail };
  if (petWin) petWin.webContents.send('relay-message', msg);
  if (panelWin) panelWin.webContents.send('relay-message', msg);
}

let _voiceServerLastStart = 0;
function startVoiceServer() {
  if (voiceServerProcess) return;
  // Cooldown only prevents rapid double-starts; stopVoiceServer resets the timestamp
  const now = Date.now();
  if (now - _voiceServerLastStart < 1500) {
    console.log('[voice] startVoiceServer cooldown, skipping');
    return;
  }
  _voiceServerLastStart = now;
  const cfg = getVoiceConfig();
  const env = Object.assign({}, process.env);
  if (cfg.minimax_api_key) env.MINIMAX_API_KEY = cfg.minimax_api_key;
  if (cfg.tts_voice_id) env.TTS_VOICE_ID = cfg.tts_voice_id;
  if (cfg.tencent_secret_id) env.TENCENT_SECRET_ID = cfg.tencent_secret_id;
  if (cfg.tencent_secret_key) env.TENCENT_SECRET_KEY = cfg.tencent_secret_key;
  if (cfg.stt_engine) env.STT_ENGINE = cfg.stt_engine;
  // Model directory: search multiple paths (portable exe extracts to temp, so try several)
  const modelCandidates = [
    path.join(app.getPath('userData'), 'voice_models'),
    path.join(__dirname, '..', 'voice', 'models'),
    path.join(__dirname, '..', '..', 'voice', 'models'),
    'E:\\claude-pet\\voice\\models',
  ];
  for (const candidate of modelCandidates) {
    if (fs.existsSync(candidate)) { env.WHISPER_MODEL_DIR = candidate; break; }
  }
  const scriptPath = path.join(__dirname, 'voice_server.py');
  if (!fs.existsSync(scriptPath)) {
    console.error(`[voice] script not found: ${scriptPath}`);
    broadcastVoiceStatus('error', `脚本不存在: ${scriptPath}`);
    return;
  }
  // Try python, python3, full path
  const pythonCandidates = ['python', 'python3', 'C:\\Program Files\\Python310\\python.exe'];
  let pythonCmd = 'python';
  for (const cmd of pythonCandidates) {
    try {
      execSync(`"${cmd}" --version`, { stdio: 'ignore', windowsHide: true, timeout: 3000 });
      pythonCmd = cmd;
      break;
    } catch (e) {}
  }
  console.log(`[voice] using: ${pythonCmd}, script: ${scriptPath}`);
  broadcastVoiceStatus('loading', '语音服务启动中...');
  voiceServerProcess = spawn(pythonCmd, ['-u', scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env,
  });
  voiceServerProcess.stdout.on('data', (d) => {
    const line = d.toString().trim();
    console.log('[voice]', line);
    if (line.includes('Ready!')) broadcastVoiceStatus('ready', '语音服务就绪');
    else if (line.includes('Tencent Cloud ASR ready')) broadcastVoiceStatus('loading', '腾讯云语音识别就绪');
    else if (line.includes('Loading whisper')) broadcastVoiceStatus('loading', '正在加载 Whisper 模型...');
    else if (line.includes('loaded!')) broadcastVoiceStatus('loading', '模型已加载，启动服务...');
  });
  voiceServerProcess.stderr.on('data', (d) => {
    const line = d.toString().trim();
    console.error('[voice]', line);
    if (line.includes('Error') || line.includes('error')) {
      broadcastVoiceStatus('error', line.slice(0, 100));
    }
  });
  voiceServerProcess.on('close', (code) => {
    console.log(`[voice] exited (${code})`);
    voiceServerProcess = null;
    if (code !== 0 && code !== null) broadcastVoiceStatus('error', `语音识别服务异常退出 (code ${code})，TTS不受影响`);
    else broadcastVoiceStatus('off', '');
  });
  voiceServerProcess.on('error', (err) => {
    console.error(`[voice] spawn error: ${err.message}`);
    voiceServerProcess = null;
    broadcastVoiceStatus('error', `语音识别启动失败: ${err.message}（TTS不受影响）`);
  });
}

function stopVoiceServer() {
  if (voiceServerProcess) {
    const pid = voiceServerProcess.pid;
    try {
      // On Windows, SIGTERM doesn't reliably kill Python processes.
      // Use taskkill /F /T to forcefully kill the process tree.
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true, stdio: 'ignore' });
      } else {
        voiceServerProcess.kill('SIGTERM');
      }
    } catch (e) {}
    voiceServerProcess = null;
    _voiceServerLastStart = 0;
  }
}

// ===== Window Monitor =====
const IGNORE_LIST = [
  'Windows 默认锁屏', 'Windows Default Lock Screen',
  'Program Manager', 'Settings',
  'NVIDIA GeForce Overlay', 'NVIDIA GPU Activity',
  'Windows Input Experience', 'TextInputHost',
  'Search', 'Start', 'ShellExperienceHost',
  'ApplicationFrameHost', 'Pety',
];

let lastForeground = '';
let monitorInterval = null;
let cachedWindowData = { foreground: null, windows: [], timestamp: null };

const ALL_WINDOWS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Text;
public class WinAPI3 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@ -ErrorAction SilentlyContinue
$hwnd = [WinAPI3]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[WinAPI3]::GetWindowText($hwnd, $sb, 256) | Out-Null
$t = $sb.ToString()
$p = 0
[WinAPI3]::GetWindowThreadProcessId($hwnd, [ref]$p) | Out-Null
$fp = Get-Process -Id $p -ErrorAction SilentlyContinue
Write-Output "FG:$($fp.ProcessName)|$t"
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | ForEach-Object { Write-Output "W:$($_.ProcessName)|$($_.MainWindowTitle)" }
`;
const ENCODED_SCRIPT = Buffer.from(ALL_WINDOWS_SCRIPT, 'utf16le').toString('base64');

function refreshCache() {
  exec(`powershell -NoProfile -EncodedCommand ${ENCODED_SCRIPT}`, {
    encoding: 'utf8', timeout: 8000, windowsHide: true
  }, (err, stdout) => {
    if (err || !stdout) return;
    const lines = stdout.trim().split('\n');
    let fg = null;
    const wins = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('FG:')) {
        const [proc, ...t] = line.slice(3).split('|');
        fg = { process: proc || '', title: t.join('|') || '' };
      } else if (line.startsWith('W:')) {
        const [proc, ...t] = line.slice(2).split('|');
        if (proc && !IGNORE_LIST.some(ig => (t.join('|')).includes(ig) || proc.includes(ig))) {
          wins.push({ process: proc, title: t.join('|') });
        }
      }
    }
    cachedWindowData = { foreground: fg, windows: wins, timestamp: new Date().toISOString() };
  });
}

function getForegroundWindow() { return cachedWindowData.foreground; }
function getVisibleWindows() { return cachedWindowData.windows; }

function startMonitor(wsSend) {
  if (monitorInterval) clearInterval(monitorInterval);
  setTimeout(() => refreshCache(), 30000);
  monitorInterval = setInterval(() => {
    const prevFg = lastForeground;
    refreshCache();
    setTimeout(() => {
      const fg = cachedWindowData.foreground;
      if (!fg) return;
      const key = `${fg.process}|${fg.title}`;
      if (key !== lastForeground && !IGNORE_LIST.some(ig => fg.title.includes(ig) || fg.process.includes(ig))) {
        lastForeground = key;
        wsSend({
          type: 'window_change',
          foreground: fg,
          timestamp: new Date().toISOString()
        });
      }
    }, 4000);
  }, 10000);
}

// ===== IPC Handlers =====
ipcMain.handle('pick-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
  const data = fs.readFileSync(filePath);
  const base64 = data.toString('base64');
  const mime = isImage ? `image/${ext.slice(1).replace('jpg', 'jpeg')}` : 'application/octet-stream';
  return {
    name: path.basename(filePath),
    mime,
    isImage,
    dataUrl: `data:${mime};base64,${base64}`,
    size: data.length,
  };
});
ipcMain.handle('save-voice', (_, base64, ext) => {
  try { return { path: saveVoiceFile(base64, ext) }; }
  catch (e) { return { error: e.message }; }
});
ipcMain.handle('get-relay-status', () => lastRelayStatus);
ipcMain.handle('take-screenshot', async (_, opts) => {
  const { desktopCapturer } = require('electron');
  try {
    const size = (opts && opts.width) ? { width: opts.width, height: opts.height || opts.width } : { width: 800, height: 600 };
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
    if (sources.length > 0) return sources[0].thumbnail.toDataURL();
    return null;
  } catch (e) { return null; }
});
ipcMain.handle('get-local-chat', (_, limit) => getLocalChat(limit || 200));
ipcMain.handle('search-chat', (_, query) => {
  if (!query) return [];
  const q = query.toLowerCase();
  return localChatHistory.filter(m => m.text && m.text.toLowerCase().includes(q));
});
ipcMain.handle('upload-chat', async (_, url) => {
  return new Promise((resolve) => {
    try {
      const data = JSON.stringify(localChatHistory);
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        resolve({ success: true, status: res.statusCode });
      });
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(data);
      req.end();
    } catch (e) { resolve({ success: false, error: e.message }); }
  });
});
ipcMain.handle('download-chat', async (_, url) => {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      mod.get(u, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const remote = Array.isArray(parsed) ? parsed : (parsed.history || null);
            if (Array.isArray(remote)) {
              localChatHistory = remote.map(m => {
                const d = new Date(m.ts);
                return {
                  who: m.who, text: m.text, emotion: m.emotion || 'idle',
                  ts: d.toISOString(),
                  date: d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0'),
                  time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                };
              });
              saveLocalChat();
              resolve({ success: true, count: remote.length });
            } else {
              resolve({ success: false, error: '云端数据格式不对' });
            }
          } catch (e) { resolve({ success: false, error: '解析失败: ' + e.message }); }
        });
      }).on('error', (e) => resolve({ success: false, error: e.message }));
    } catch (e) { resolve({ success: false, error: e.message }); }
  });
});
ipcMain.handle('get-windows', async () => cachedWindowData);

// ===== Pet Float Window (身体) =====
function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  petWin = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  petWin.loadFile('pet-float.html');
  petWin.setAlwaysOnTop(true, 'screen-saver');
  petWin.setIgnoreMouseEvents(true, { forward: true });

  ipcMain.removeAllListeners('set-interactive');
  ipcMain.on('set-interactive', (event, interactive) => {
    if (petWin) {
      if (interactive) {
        petWin.setIgnoreMouseEvents(false);
      } else {
        petWin.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  });

  petWin.on('closed', () => { petWin = null; });
}

// ===== Panel Window (管理面板) =====
function createPanelWindow() {
  if (panelWin) {
    panelWin.show();
    panelWin.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  panelWin = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 800,
    minHeight: 540,
    x: Math.floor((width - 960) / 2),
    y: Math.floor((height - 640) / 2),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  });

  panelWin.loadFile('App.html');
  try { panelWin.setBackgroundMaterial('acrylic'); } catch(e) {}

  panelWin.webContents.on('did-finish-load', () => {
    panelWin.webContents.send('relay-message', lastRelayStatus);
    messageHistory.forEach(msg => {
      panelWin.webContents.send('relay-message', msg);
    });
  });

  panelWin.on('closed', () => { panelWin = null; });
}

// ===== IPC from both windows =====
ipcMain.on('open-panel', () => createPanelWindow());
ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win === panelWin) {
    panelWin.hide();
  } else if (win === petWin) {
    app.quit();
  }
});
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});
ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});
ipcMain.on('window-drag', (event, { dx, dy }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const [x, y] = win.getPosition();
    win.setPosition(x + dx, y + dy);
  }
});
let lastChatText = '';
let lastChatTime = 0;
ipcMain.on('relay-send', (event, data) => {
  // Dedup: same chat message within 3 seconds (both windows may send)
  if (data.type === 'chat' && data.text) {
    const now = Date.now();
    if (data.text === lastChatText && now - lastChatTime < 3000) return;
    lastChatText = data.text;
    lastChatTime = now;
  }
  if (apiConfig.mode === 'api') {
    if (data.type === 'fling') {
      addLocalChat('user', data.text, null, null, true);
      ipcMain.emit('api-chat', event, { text: data.text, isEvent: true });
      return;
    }
    if (data.type === 'chat' && data.text) {
      ipcMain.emit('api-chat', event, { text: data.text, isEvent: false, msgId: data.msgId });
      return;
    }
    if (data.type === 'poke') {
      const pokeText = `${apiConfig.userName}戳了${apiConfig.charName}`;
      addLocalChat('user', pokeText, null, null, true);
      ipcMain.emit('api-chat', event, { text: pokeText, isEvent: true });
      return;
    }
    if (data.type === 'pet') {
      const petText = `${apiConfig.userName}摸了${apiConfig.charName}`;
      addLocalChat('user', petText, null, null, true);
      ipcMain.emit('api-chat', event, { text: petText, isEvent: true });
      return;
    }
  }
  if (data.type === 'voice-mode') {
    setVoiceMode(!!data.active);
    return;
  }
  if (mainWs && mainWs.readyState === WebSocket.OPEN) {
    mainWs.send(JSON.stringify(data));
  }
  if (data.type === 'fling') {
    addLocalChat('user', data.text, null, null, true);
    const userMsg = { type: 'user-chat', text: data.text, isEvent: true };
    messageHistory.push(userMsg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
    if (petWin) petWin.webContents.send('relay-message', userMsg);
    if (panelWin) panelWin.webContents.send('relay-message', userMsg);
  }
  if (data.type === 'chat' && data.text) {
    addLocalChat('user', data.text);
    const userMsg = { type: 'user-chat', text: data.text, msgId: data.msgId };
    messageHistory.push(userMsg);
    if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
    if (petWin) petWin.webContents.send('relay-message', userMsg);
    if (panelWin) panelWin.webContents.send('relay-message', userMsg);
  }
  if (data.type === 'skin-change') {
    if (petWin) petWin.webContents.send('relay-message', data);
    if (panelWin) panelWin.webContents.send('relay-message', data);
  }
});
ipcMain.on('pet-walk', (event, data) => {
  const msg = { type: 'walk', ...(data || {}) };
  if (petWin) petWin.webContents.send('relay-message', msg);
});
ipcMain.on('pet-stop-walk', () => {
  if (petWin) petWin.webContents.send('relay-message', { type: 'stop-walk' });
});
ipcMain.on('pet-auto-walk-toggle', (event, enabled) => {
  if (petWin) petWin.webContents.send('relay-message', { type: 'auto-walk-toggle', enabled });
});
ipcMain.on('pet-physics-toggle', (event, enabled) => {
  if (petWin) petWin.webContents.send('relay-message', { type: 'physics-toggle', enabled });
});
let voiceModeActive = false;
function setVoiceMode(active) {
  // Idempotent: skip if already in the requested state
  if (voiceModeActive === !!active) return;
  voiceModeActive = !!active;
  const msg = { type: 'voice-mode', active: voiceModeActive };
  if (petWin) petWin.webContents.send('relay-message', msg);
  if (panelWin) panelWin.webContents.send('relay-message', msg);
  if (voiceModeActive) startVoiceServer();
  else stopVoiceServer();
}
ipcMain.on('start-voice-server', () => { setVoiceMode(true); });
ipcMain.on('stop-voice-server', () => { setVoiceMode(false); });

let lastTtsText = '';
let lastTtsTime = 0;
async function autoTtsForMessage(text) {
  if (!voiceModeActive || !text) return;
  const now = Date.now();
  if (text === lastTtsText && now - lastTtsTime < 5000) return;
  lastTtsText = text;
  lastTtsTime = now;
  try {
    const cfg = getVoiceConfig();
    const apiKey = cfg.minimax_api_key || '';
    const voiceId = cfg.tts_voice_id || 'moss_audio_fd2620f9-bef3-11f0-8647-a697af11f3d9';
    const body = JSON.stringify({
      model: 'speech-2.8-hd', text, stream: false,
      voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, format: 'mp3' },
      language_boost: 'auto',
    });
    const result = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.minimaxi.com', path: '/v1/t2a_v2', method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.data && parsed.data.audio) resolve(parsed.data.audio);
            else resolve(null);
          } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(30000, () => { req.destroy(); resolve(null); });
      req.write(body);
      req.end();
    });
    if (result) {
      const audioMsg = { type: 'tts-audio', audioHex: result };
      if (panelWin) panelWin.webContents.send('relay-message', audioMsg);
      else if (petWin) petWin.webContents.send('relay-message', audioMsg);
    }
  } catch (e) {}
}

// TTS fallback: direct MiniMax call from Node (no python needed)
ipcMain.handle('tts-generate', async (_, text) => {
  const cfg = getVoiceConfig();
  const apiKey = cfg.minimax_api_key || '';
  const voiceId = cfg.tts_voice_id || 'moss_audio_fd2620f9-bef3-11f0-8647-a697af11f3d9';
  const body = JSON.stringify({
    model: 'speech-2.8-hd', text, stream: false,
    voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
    audio_setting: { sample_rate: 32000, format: 'mp3' },
    language_boost: 'auto',
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.minimaxi.com', path: '/v1/t2a_v2', method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.data && parsed.data.audio) {
            resolve({ success: true, audioHex: parsed.data.audio });
          } else {
            resolve({ success: false, error: JSON.stringify(parsed).slice(0, 200) });
          }
        } catch (e) { resolve({ success: false, error: e.message }); }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
});

const ttsCache = new Map();
ipcMain.on('cache-tts-audio', (event, { text, base64 }) => {
  ttsCache.set(text, base64);
  if (ttsCache.size > 50) {
    const first = ttsCache.keys().next().value;
    ttsCache.delete(first);
  }
});
ipcMain.handle('get-cached-tts', (event, text) => {
  return ttsCache.get(text) || null;
});

ipcMain.handle('get-voice-config', () => getVoiceConfig());
ipcMain.handle('save-voice-config', (event, cfg) => {
  const cfgPath = path.join(app.getPath('userData'), 'voice_config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  loadMemoryConfig();
  stopVoiceServer();
  return { success: true };
});

ipcMain.handle('save-voice-favorite', (event, { text, audioBase64 }) => {
  const favDir = path.join(app.getPath('userData'), 'voice_favorites');
  if (!fs.existsSync(favDir)) fs.mkdirSync(favDir, { recursive: true });
  const ts = Date.now();
  const audioPath = path.join(favDir, `fav_${ts}.mp3`);
  fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
  const metaPath = path.join(favDir, 'favorites.json');
  let favs = [];
  try { if (fs.existsSync(metaPath)) favs = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
  favs.push({ id: ts, text, audioFile: `fav_${ts}.mp3`, date: new Date().toISOString() });
  fs.writeFileSync(metaPath, JSON.stringify(favs, null, 2), 'utf8');
  return { success: true, id: ts };
});

ipcMain.handle('get-voice-favorites', () => {
  const metaPath = path.join(app.getPath('userData'), 'voice_favorites', 'favorites.json');
  try { if (fs.existsSync(metaPath)) return JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
  return [];
});

ipcMain.handle('delete-voice-favorite', (event, id) => {
  const favDir = path.join(app.getPath('userData'), 'voice_favorites');
  const metaPath = path.join(favDir, 'favorites.json');
  try {
    let favs = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const fav = favs.find(f => f.id === id);
    if (fav) {
      const fp = path.join(favDir, fav.audioFile);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    favs = favs.filter(f => f.id !== id);
    fs.writeFileSync(metaPath, JSON.stringify(favs, null, 2), 'utf8');
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
});

ipcMain.handle('play-voice-favorite', (event, id) => {
  const favDir = path.join(app.getPath('userData'), 'voice_favorites');
  const metaPath = path.join(favDir, 'favorites.json');
  try {
    const favs = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const fav = favs.find(f => f.id === id);
    if (fav) {
      const fp = path.join(favDir, fav.audioFile);
      const data = fs.readFileSync(fp);
      return { success: true, audioBase64: data.toString('base64') };
    }
  } catch(e) {}
  return { success: false };
});

// ===== API Mode (直连LLM) =====
let API_CONFIG_PATH = '';
let apiConfig = { mode: 'plugin', provider: 'openai', apiKey: '', baseUrl: '', model: '', charName: 'Pety', userName: 'User', systemPrompt: '', memoryTopN: 3, memoryRecentN: 5, memoryTodoN: 1, maxContextTokens: 20000, historyPreloadN: 10, relayUrl: 'ws://localhost:8765', diaryUrl: '' };
let tokenStats = { totalInput: 0, totalOutput: 0, sessionMessages: 0 };
let apiContextLoaded = false;
let apiChatContext = [];
const API_MAX_CONTEXT = 30;

function loadApiConfig() {
  try {
    if (fs.existsSync(API_CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(API_CONFIG_PATH, 'utf8'));
      apiConfig = { ...apiConfig, ...saved };
    }
  } catch (e) {}
}

function saveApiConfig() {
  try {
    fs.writeFileSync(API_CONFIG_PATH, JSON.stringify(apiConfig, null, 2), 'utf8');
  } catch (e) {}
}

// ===== 记忆库 (API模式) =====
let MEMORY_DB_PATH = '';
let memories = [];
let memoryConfig = { backend: 'local', path: '', url: '' };

function loadMemoryConfig() {
  const cfg = getVoiceConfig();
  memoryConfig = {
    backend: cfg.memory_backend || 'local',
    path: cfg.memory_path || '',
    url: cfg.memory_url || '',
  };
}

function isCloudMemory() {
  return memoryConfig.backend === 'cloud' && memoryConfig.url;
}

function getMemoryFilePath() {
  if (memoryConfig.backend === 'custom' && memoryConfig.path) {
    return memoryConfig.path;
  }
  return MEMORY_DB_PATH;
}

function httpRequest(urlStr, method, body) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const mod = url.protocol === 'https:' ? https : require('http');
      const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' } };
      const req = mod.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: data }); } });
      });
      req.on('error', (e) => resolve({ error: e.message }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ error: 'timeout' }); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    } catch (e) { resolve({ error: e.message }); }
  });
}

function loadMemories() {
  try {
    const filePath = getMemoryFilePath();
    if (fs.existsSync(filePath)) {
      memories = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { memories = []; }
}

function saveMemories() {
  try {
    const filePath = getMemoryFilePath();
    fs.writeFileSync(filePath, JSON.stringify(memories, null, 2), 'utf8');
  } catch (e) {}
}

function calcDecayScore(mem) {
  const now = Date.now() / 1000;
  const age = (now - (mem.timestamp || now)) / 86400;
  const cat = mem.category || 'general';
  if (cat !== 'daily') return 999.0;
  if (mem.resolved) return mem.importance * 0.05;
  const decay = Math.exp(-0.05 * Math.max(0, age - 3));
  const accessFactor = Math.pow((mem.access_count || 0) + 1, 0.3);
  const arousalBoost = 1.0 + (mem.arousal || 0.5) * 0.8;
  return (mem.importance || 5) * accessFactor * decay * arousalBoost;
}

function estimateTokens(text) {
  if (!text) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    count += (code > 0x7F) ? 1.5 : 0.25;
  }
  return Math.ceil(count);
}

function getTopMemories(n) {
  return memories.filter(m => !m.resolved)
    .map(m => ({ ...m, _score: calcDecayScore(m) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, n);
}

function getRecentMemories(n) {
  return memories.filter(m => !m.resolved)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, n);
}

function getActiveTodo() {
  return memories.find(m => m.category === 'todo' && !m.resolved) || null;
}

function buildMemoryContext() {
  const topN = apiConfig.memoryTopN || 3;
  const recentN = apiConfig.memoryRecentN || 5;
  const todoN = apiConfig.memoryTodoN || 1;
  const top = getTopMemories(topN);
  const recent = getRecentMemories(recentN);
  const todos = memories.filter(m => m.category === 'todo' && !m.resolved).slice(0, todoN);
  const seen = new Set();
  const lines = [];
  for (const m of top) {
    if (!seen.has(m.id)) { lines.push(`[重要] ${m.content}`); seen.add(m.id); }
  }
  for (const m of recent) {
    if (!seen.has(m.id)) { lines.push(`[近期] ${m.content}`); seen.add(m.id); }
  }
  for (const m of todos) {
    if (!seen.has(m.id)) { lines.push(`[待办] ${m.content}`); seen.add(m.id); }
  }
  return lines.length > 0 ? '\n\n## 记忆\n' + lines.join('\n') : '';
}

function searchMemories(query) {
  const q = query.toLowerCase();
  return memories.filter(m => m.content && m.content.toLowerCase().includes(q))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 20);
}

ipcMain.handle('get-memories', async (_, { category, limit } = {}) => {
  if (isCloudMemory()) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (limit) params.set('limit', limit);
    return await httpRequest(`${memoryConfig.url}/memories?${params}`, 'GET');
  }
  let result = memories;
  if (category) result = result.filter(m => m.category === category);
  result = result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (limit) result = result.slice(0, limit);
  return result.map(m => ({ ...m, _score: calcDecayScore(m) }));
});

ipcMain.handle('add-memory', async (_, { content, category, tags, importance, valence, arousal }) => {
  if (isCloudMemory()) {
    return await httpRequest(`${memoryConfig.url}/memories`, 'POST', { content, category, tags, importance, valence, arousal });
  }
  const now = Math.floor(Date.now() / 1000);
  const mem = {
    id: 'mem_' + Date.now(),
    content, category: category || 'daily', tags: tags || '',
    source: 'ai', created_at: new Date().toISOString(),
    timestamp: now, importance: importance || 5,
    valence: valence || 0.5, arousal: arousal || 0.5,
    access_count: 0, resolved: 0,
  };
  memories.push(mem);
  saveMemories();
  return mem;
});

ipcMain.handle('update-memory', async (_, { id, updates }) => {
  if (isCloudMemory()) return await httpRequest(`${memoryConfig.url}/memories/${id}`, 'PUT', updates);
  const mem = memories.find(m => m.id === id);
  if (mem) { Object.assign(mem, updates); saveMemories(); }
  return mem || null;
});

ipcMain.handle('delete-memory', async (_, id) => {
  if (isCloudMemory()) return await httpRequest(`${memoryConfig.url}/memories/${id}`, 'DELETE');
  memories = memories.filter(m => m.id !== id);
  saveMemories();
  return { success: true };
});

ipcMain.handle('resolve-memory', async (_, id) => {
  if (isCloudMemory()) return await httpRequest(`${memoryConfig.url}/memories/${id}/resolve`, 'POST');
  const mem = memories.find(m => m.id === id);
  if (mem) { mem.resolved = 1; saveMemories(); }
  return mem || null;
});

ipcMain.handle('search-memories', async (_, query) => {
  if (isCloudMemory()) return await httpRequest(`${memoryConfig.url}/memories/search?q=${encodeURIComponent(query)}`, 'GET');
  return searchMemories(query).map(m => ({ ...m, _score: calcDecayScore(m) }));
});

ipcMain.handle('memory-stats', async () => {
  if (isCloudMemory()) return await httpRequest(`${memoryConfig.url}/memories/stats`, 'GET');
  const cats = {};
  memories.forEach(m => { cats[m.category || 'general'] = (cats[m.category || 'general'] || 0) + 1; });
  return { total: memories.length, categories: cats, resolved: memories.filter(m => m.resolved).length };
});

ipcMain.handle('test-memory-connection', async (_, url) => {
  try {
    const data = await httpRequest(`${url}/memories/stats`, 'GET');
    return data.error ? { success: false, error: data.error } : { success: true, data };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('pick-memory-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JSON 文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

function resolveTemplate(text) {
  return text.replace(/\{\{char\}\}/g, apiConfig.charName).replace(/\{\{user\}\}/g, apiConfig.userName);
}

const MEMORY_INSTRUCTIONS = `

## Memory Tools
You have a persistent memory system. Use these tags in your response when needed:
- <remember category="daily" importance="5">content to remember</remember> — Save something to memory. Categories: daily/character/knowledge/todo. Importance: 1-10.
- <forget>memory_id</forget> — Delete a memory by its ID.
- <resolve>memory_id</resolve> — Mark a todo/task as completed.
- <emotion>name</emotion> — Set your expression. ONLY use one of these exact values: happy, angry, shy, shocked, idle. Example: <emotion>happy</emotion>
These tags will be processed silently and removed from the visible reply. Do NOT put sentences inside tags — only the specified values.

## Tools
You have these tools available:
- <tool>screentime</tool> — See what {{user}} is doing (screen activity data).
- <tool>screenshot</tool> — Take a screenshot of {{user}}'s desktop.
- <tool>call</tool> — Call {{user}} (incoming call popup, 30s timeout).
- <tool>open_app:target</tool> — Open an app or URL. Example: <tool>open_app:chrome</tool> or <tool>open_app:https://bilibili.com</tool>
- <tool>close_app:name</tool> — Close a running app. Example: <tool>close_app:chrome</tool>
- <tool>diary:title|mood|content</tool> — Write a diary entry (saved to cloud, locked by default). Example: <tool>diary:周五日记|开心|今天和{{user}}聊了很多</tool>
- <tool>diary_list</tool> — List recent diary entries (titles, dates, mood, lock status).
- <tool>diary_read:id</tool> — Read a diary entry by ID. Locked entries show title/mood only.
- <tool>diary_unlock:id</tool> — Unlock a diary entry so {{user}} can read the content.
- <tool>diary_lock:id</tool> — Lock a diary entry to hide the content.
- <tool>memory_search:query</tool> — Search memories for a keyword. Example: <tool>memory_search:生日</tool>
- <tool>walk:x,y</tool> — Walk to a position on screen (pixels from left, pixels from top). Example: <tool>walk:500,400</tool>
- <tool>stop_walk</tool> — Stop walking immediately.
Tool results are injected as a follow-up message. Tags are removed from visible reply.`;

function getActivitySummary() {
  const fg = cachedWindowData.foreground;
  const wins = cachedWindowData.windows || [];
  if (!fg) return '[No activity data available]';
  let summary = `Current foreground: ${fg.process} - ${fg.title}\n`;
  summary += `Open windows: ${wins.slice(0, 8).map(w => w.process + ': ' + w.title).join('; ')}`;
  return summary;
}

function buildSystemPrompt() {
  const base = apiConfig.systemPrompt || '';
  const memoryBlock = buildMemoryContext();
  return resolveTemplate(base) + MEMORY_INSTRUCTIONS + memoryBlock;
}

function processMemoryTags(text) {
  let clean = text;
  let toolRequests = [];
  const rememberRe = /<remember(?:\s+category="([^"]*)")?(?:\s+importance="(\d+)")?>([^<]+)<\/remember>/g;
  let match;
  while ((match = rememberRe.exec(text)) !== null) {
    const category = match[1] || 'daily';
    const importance = parseInt(match[2]) || 5;
    const content = match[3].trim();
    const now = Math.floor(Date.now() / 1000);
    memories.push({
      id: 'mem_' + Date.now(), content, category, tags: '',
      source: 'ai', created_at: new Date().toISOString(),
      timestamp: now, importance, valence: 0.5, arousal: 0.5,
      access_count: 0, resolved: 0,
    });
  }
  const forgetRe = /<forget>([^<]+)<\/forget>/g;
  while ((match = forgetRe.exec(text)) !== null) {
    const id = match[1].trim();
    memories = memories.filter(m => m.id !== id);
  }
  const resolveRe = /<resolve>([^<]+)<\/resolve>/g;
  while ((match = resolveRe.exec(text)) !== null) {
    const id = match[1].trim();
    const mem = memories.find(m => m.id === id);
    if (mem) mem.resolved = 1;
  }
  const toolRe = /<tool>([^<]+)<\/tool>/g;
  while ((match = toolRe.exec(text)) !== null) {
    toolRequests.push(match[1].trim());
  }
  let emotion = 'idle';
  const emotionRe = /<emotion>([^<]+)<\/emotion>/;
  const emotionMatch = text.match(emotionRe);
  if (emotionMatch) emotion = emotionMatch[1].trim();
  clean = clean.replace(/<remember[^>]*>[^<]*<\/remember>/g, '');
  clean = clean.replace(/<forget>[^<]*<\/forget>/g, '');
  clean = clean.replace(/<resolve>[^<]*<\/resolve>/g, '');
  clean = clean.replace(/<tool>[^<]*<\/tool>/g, '');
  clean = clean.replace(/<emotion>[^<]*<\/emotion>/g, '');
  clean = clean.trim();
  if (clean !== text) saveMemories();
  return { text: clean, tools: toolRequests, emotion };
}

function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    const baseUrl = apiConfig.baseUrl || 'https://api.openai.com';
    const u = new URL(baseUrl);
    const mod = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model: apiConfig.model || 'gpt-4o-mini',
      messages,
      max_tokens: 300,
    });
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            if (parsed.usage) {
              tokenStats.totalInput += parsed.usage.prompt_tokens || 0;
              tokenStats.totalOutput += parsed.usage.completion_tokens || 0;
              tokenStats.sessionMessages++;
            }
            const msg = parsed.choices[0].message;
            const reasoning = msg.reasoning_content || '';
            resolve({ text: msg.content, thinking: reasoning });
          } else {
            reject(new Error(parsed.error?.message || 'API error'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callAnthropic(messages) {
  return new Promise((resolve, reject) => {
    const baseUrl = apiConfig.baseUrl || 'https://api.anthropic.com';
    const u = new URL(baseUrl);
    const mod = u.protocol === 'https:' ? https : http;
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');
    const body = JSON.stringify({
      model: apiConfig.model || 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemMsg ? systemMsg.content : '',
      messages: chatMsgs,
    });
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiConfig.apiKey,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0]) {
            if (parsed.usage) {
              tokenStats.totalInput += parsed.usage.input_tokens || 0;
              tokenStats.totalOutput += parsed.usage.output_tokens || 0;
              tokenStats.sessionMessages++;
            }
            const thinking = parsed.content.filter(b => b.type === 'thinking').map(b => b.thinking).join('\n');
            const text = parsed.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
            resolve({ text: text || parsed.content[0].text, thinking });
          } else {
            reject(new Error(parsed.error?.message || 'API error'));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function apiChat(userText, isEvent) {
  // First call: preload recent chat history as context
  if (!apiContextLoaded) {
    apiContextLoaded = true;
    const n = apiConfig.historyPreloadN || 10;
    const recent = localChatHistory.slice(-n);
    for (const m of recent) {
      const role = m.who === 'user' ? 'user' : 'assistant';
      apiChatContext.push({ role, content: m.text || '' });
    }
  }
  const sysPrompt = buildSystemPrompt();
  if (isEvent) {
    apiChatContext.push({ role: 'user', content: `[系统] ${userText}` });
  } else {
    apiChatContext.push({ role: 'user', content: userText });
  }
  // Token-based truncation: keep system+memory tokens separate, truncate chat history
  const maxTokens = apiConfig.maxContextTokens || 20000;
  const sysTokens = estimateTokens(sysPrompt);
  let chatTokens = 0;
  let trimIndex = 0;
  for (let i = apiChatContext.length - 1; i >= 0; i--) {
    const msg = apiChatContext[i];
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    chatTokens += estimateTokens(content);
    if (chatTokens > maxTokens) { trimIndex = i + 1; break; }
  }
  if (trimIndex > 0) {
    apiChatContext = apiChatContext.slice(trimIndex);
  }
  const messages = [{ role: 'system', content: sysPrompt }, ...apiChatContext];
  try {
    const apiResult = apiConfig.provider === 'anthropic'
      ? await callAnthropic(messages)
      : await callOpenAI(messages);
    const rawReply = apiResult.text;
    const thinking = apiResult.thinking || '';
    const { text: reply, tools, emotion } = processMemoryTags(rawReply);
    apiChatContext.push({ role: 'assistant', content: reply });
    if (apiChatContext.length > API_MAX_CONTEXT) {
      apiChatContext = apiChatContext.slice(-API_MAX_CONTEXT);
    }
    if (tools.length > 0) {
      let toolResult = '';
      for (const tool of tools) {
        if (tool === 'screentime') {
          toolResult += '[Screen Activity]\n' + getActivitySummary() + '\n';
        } else if (tool === 'call') {
          const callResult = await new Promise((resolve) => {
            handleIncomingCall({ caller: apiConfig.charName || 'Pety' });
            if (activeCall) {
              activeCall.apiResolve = resolve;
            } else {
              resolve('busy');
            }
          });
          const callMap = { accepted: '已接听！进入语音通话', declined: '她拒绝了通话', missed: '未接听（超时）', busy: '已经在通话中了' };
          toolResult += `[Call: ${callMap[callResult] || callResult}]\n`;
        } else if (tool === 'screenshot') {
          try {
            const { desktopCapturer } = require('electron');
            const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 800, height: 600 } });
            if (sources.length > 0) {
              const dataUrl = sources[0].thumbnail.toDataURL();
              toolResult += `[Screenshot captured]\n`;
              apiChatContext.push({ role: 'user', content: [
                { type: 'text', text: '[Desktop screenshot]' },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]});
            }
          } catch (e) {
            toolResult += '[Screenshot failed: ' + e.message + ']\n';
          }
        } else if (tool.startsWith('open_app:')) {
          const target = tool.slice('open_app:'.length).trim();
          try {
            spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' });
            toolResult += `[Opened: ${target}]\n`;
          } catch (e) {
            toolResult += `[Failed to open: ${target} — ${e.message}]\n`;
          }
        } else if (tool.startsWith('close_app:')) {
          const name = tool.slice('close_app:'.length).trim();
          try {
            const exeName = name.toLowerCase().endsWith('.exe') ? name : name + '.exe';
            execSync(`taskkill /IM "${exeName}" /F`, { stdio: 'ignore' });
            toolResult += `[Closed: ${name}]\n`;
          } catch (e) {
            toolResult += `[Failed to close: ${name}]\n`;
          }
        } else if (tool.startsWith('diary:')) {
          const diaryParam = tool.slice('diary:'.length);
          const parts = diaryParam.split('|');
          const title = (parts[0] || '').trim();
          const mood = (parts[1] || '').trim();
          const content = (parts.slice(2).join('|') || '').trim();
          try {
            if (!getDiaryUrl()) { toolResult += '[Diary disabled: no diaryUrl configured]\n'; }
            else {
              const diaryResult = await httpRequest(getDiaryUrl() + '/diary/write', 'POST', {
                title, content, mood, locked: true
              });
              if (diaryResult && !diaryResult.error) {
                toolResult += `[Diary saved: ${title}]\n`;
              } else {
                toolResult += `[Diary failed: ${diaryResult.error || 'unknown error'}]\n`;
              }
            }
          } catch (e) {
            toolResult += `[Diary failed: ${e.message}]\n`;
          }
        } else if (tool === 'diary_list') {
          if (!getDiaryUrl()) { toolResult += '[Diary disabled: no diaryUrl configured]\n'; }
          else try {
            const list = await httpRequest(getDiaryUrl() + '/diary/list?limit=10', 'GET');
            if (list && Array.isArray(list.entries)) {
              toolResult += '[Diary entries]\n';
              list.entries.forEach(e => {
                toolResult += `- #${e.id} ${e.title} (${e.mood || '-'}) ${e.locked ? '🔒' : '🔓'} ${e.created_at}\n`;
              });
            } else {
              toolResult += '[No diary entries]\n';
            }
          } catch (e) {
            toolResult += `[Diary list failed: ${e.message}]\n`;
          }
        } else if (tool.startsWith('diary_read:')) {
          const id = tool.slice('diary_read:'.length).trim();
          if (!getDiaryUrl()) { toolResult += '[Diary disabled: no diaryUrl configured]\n'; }
          else try {
            const entry = await httpRequest(`${getDiaryUrl()}/diary/entry/${id}`, 'GET');
            if (entry && entry.title) {
              toolResult += `[Diary #${id}] ${entry.title}\nMood: ${entry.mood || '-'}\nLocked: ${entry.locked ? 'yes' : 'no'}\n`;
              if (!entry.locked && entry.content) toolResult += `Content: ${entry.content}\n`;
              else if (entry.locked) toolResult += `Content: [locked]\n`;
            } else {
              toolResult += `[Diary #${id} not found]\n`;
            }
          } catch (e) {
            toolResult += `[Diary read failed: ${e.message}]\n`;
          }
        } else if (tool.startsWith('diary_unlock:')) {
          const id = tool.slice('diary_unlock:'.length).trim();
          if (!getDiaryUrl()) { toolResult += '[Diary disabled: no diaryUrl configured]\n'; }
          else try {
            await httpRequest(`${getDiaryUrl()}/diary/unlock/${id}`, 'POST');
            toolResult += `[Diary #${id} unlocked]\n`;
          } catch (e) {
            toolResult += `[Diary unlock failed: ${e.message}]\n`;
          }
        } else if (tool.startsWith('diary_lock:')) {
          const id = tool.slice('diary_lock:'.length).trim();
          if (!getDiaryUrl()) { toolResult += '[Diary disabled: no diaryUrl configured]\n'; }
          else try {
            await httpRequest(`${getDiaryUrl()}/diary/lock/${id}`, 'POST');
            toolResult += `[Diary #${id} locked]\n`;
          } catch (e) {
            toolResult += `[Diary lock failed: ${e.message}]\n`;
          }
        } else if (tool.startsWith('memory_search:')) {
          const query = tool.slice('memory_search:'.length).trim();
          try {
            let results = [];
            if (isCloudMemory()) {
              const cloudRes = await httpRequest(`${memoryConfig.url}/memories/search?q=${encodeURIComponent(query)}&limit=3`, 'GET');
              if (Array.isArray(cloudRes)) results = cloudRes;
              else if (cloudRes && Array.isArray(cloudRes.results)) results = cloudRes.results;
            } else {
              results = searchMemories(query).slice(0, 3);
            }
            if (results.length > 0) {
              toolResult += `[Memory search: "${query}"]\n`;
              results.forEach(m => {
                toolResult += `- ${m.content}${m.category ? ' [' + m.category + ']' : ''}\n`;
              });
            } else {
              toolResult += `[Memory search: "${query}" — no results]\n`;
            }
          } catch (e) {
            toolResult += `[Memory search failed: ${e.message}]\n`;
          }
        } else if (tool.startsWith('walk:')) {
          const coords = tool.slice('walk:'.length).trim().split(',');
          const x = parseInt(coords[0]) || 0;
          const y = parseInt(coords[1]) || 0;
          if (petWin) {
            petWin.webContents.send('relay-message', { type: 'walk', x, y });
            toolResult += `[Walking to ${x},${y}]\n`;
          } else {
            toolResult += `[Walk failed: pet window not open]\n`;
          }
        } else if (tool === 'stop_walk') {
          if (petWin) {
            petWin.webContents.send('relay-message', { type: 'stop-walk' });
            toolResult += `[Stopped walking]\n`;
          }
        }
      }
      if (toolResult) {
        apiChatContext.push({ role: 'user', content: `[Tool results]\n${toolResult}` });
      }
    }
    return { reply, emotion, thinking };
  } catch (e) {
    return { reply: `[Error] ${e.message}`, emotion: 'idle', thinking: '' };
  }
}

ipcMain.handle('get-api-config', () => apiConfig);
ipcMain.handle('get-token-stats', () => tokenStats);
ipcMain.handle('reset-token-stats', () => { tokenStats = { totalInput: 0, totalOutput: 0, sessionMessages: 0 }; return tokenStats; });
ipcMain.handle('get-token-breakdown', () => {
  const sysPromptBase = resolveTemplate(apiConfig.systemPrompt || '');
  const memoryInstr = MEMORY_INSTRUCTIONS;
  const memoryCtx = buildMemoryContext();
  let chatTokens = 0;
  for (const msg of apiChatContext) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    chatTokens += estimateTokens(content);
  }
  return {
    systemPrompt: estimateTokens(sysPromptBase),
    toolInstructions: estimateTokens(memoryInstr),
    memory: estimateTokens(memoryCtx),
    chatHistory: chatTokens,
    chatMessages: apiChatContext.length,
    total: estimateTokens(sysPromptBase) + estimateTokens(memoryInstr) + estimateTokens(memoryCtx) + chatTokens,
    usage: tokenStats,
  };
});
ipcMain.handle('save-api-config', (event, cfg) => {
  apiConfig = { ...apiConfig, ...cfg };
  saveApiConfig();
  return { success: true };
});

ipcMain.on('api-chat', async (event, data) => {
  const { text, isEvent, msgId } = data;
  if (!isEvent) addLocalChat('user', text);
  const userMsg = { type: 'user-chat', text, msgId, isEvent: isEvent || undefined };
  messageHistory.push(userMsg);
  if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
  if (petWin) petWin.webContents.send('relay-message', userMsg);
  if (panelWin) panelWin.webContents.send('relay-message', userMsg);

  const result = await apiChat(text, isEvent);
  const reply = result.reply;
  const replyEmotion = result.emotion || 'idle';
  const thinking = result.thinking || '';
  const chatEntry = addLocalChat('pet', reply, replyEmotion);
  if (thinking && chatEntry) chatEntry.thinking = thinking;
  saveLocalChat();
  const petMsg = { text: reply, emotion: replyEmotion };
  if (thinking) petMsg.thinking = thinking;
  messageHistory.push(petMsg);
  if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
  if (petWin) petWin.webContents.send('relay-message', petMsg);
  if (panelWin) panelWin.webContents.send('relay-message', petMsg);
  autoTtsForMessage(reply);
});

// ===== Incoming Call System =====
let activeCall = null; // { timer }
let callWin = null;
let callCallerName = '';

function createCallWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 200;
  const winHeight = 220;

  callWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: width - winWidth - 20,
    y: height - winHeight - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'call-preload.js')
    }
  });

  callWin.setAlwaysOnTop(true, 'screen-saver');
  callWin.loadFile('call-window.html');

  callWin.on('closed', () => { callWin = null; });
}

function closeCallWindow() {
  if (callWin) {
    callWin.close();
    callWin = null;
  }
}

function handleIncomingCall(data) {
  if (activeCall) {
    // Already in a call, send busy
    sendCallResult('busy');
    return;
  }

  callCallerName = data.caller || apiConfig.charName || 'Pety';

  // Notify panel window (can show a banner)
  const callMsg = { type: 'incoming-call', caller: callCallerName };
  if (panelWin) panelWin.webContents.send('relay-message', callMsg);

  // Create independent call window
  createCallWindow();

  // Start 30-second timeout
  const timer = setTimeout(() => {
    if (activeCall) {
      const apiResolve = activeCall.apiResolve;
      activeCall = null;
      sendCallResult('missed');
      closeCallWindow();
      if (apiResolve) apiResolve('missed');
      const dismissMsg = { type: 'call-dismissed', reason: 'missed' };
      if (panelWin) panelWin.webContents.send('relay-message', dismissMsg);
    }
  }, 30000);

  activeCall = { timer };
}

function sendCallResult(result) {
  const msg = { type: 'call-result', result };
  if (mainWs && mainWs.readyState === 1) { // WebSocket.OPEN
    mainWs.send(JSON.stringify(msg));
  }
}

ipcMain.handle('get-call-info', () => {
  return { caller: callCallerName };
});

ipcMain.on('call-response', (event, response) => {
  if (!activeCall) return;
  clearTimeout(activeCall.timer);
  const apiResolve = activeCall.apiResolve;
  activeCall = null;
  sendCallResult(response); // "accepted" or "declined"
  if (apiResolve) apiResolve(response);
  closeCallWindow();
  // Notify panel window to dismiss the call UI
  const dismissMsg = { type: 'call-dismissed', reason: response };
  if (panelWin) panelWin.webContents.send('relay-message', dismissMsg);

  // If accepted, activate voice mode on pet window
  if (response === 'accepted') {
    const voiceMsg = { type: 'voice-mode', active: true };
    if (petWin) petWin.webContents.send('relay-message', voiceMsg);
    if (panelWin) panelWin.webContents.send('relay-message', voiceMsg);
  }
});

// ===== WebSocket to Relay =====
const WebSocket = require('ws');
function getRelayUrl() { return apiConfig.relayUrl || 'ws://localhost:8765'; }
function getRelayHttpUrl() {
  const wsUrl = getRelayUrl();
  return wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}
function getDiaryUrl() { return apiConfig.diaryUrl || ''; }
let mainWs = null;

function connectMainWs() {
  mainWs = new WebSocket(getRelayUrl());
  mainWs.on('open', () => {
    mainWs.send(JSON.stringify({ role: 'frontend', id: 'pety-main-' + Date.now() }));
    startMonitor((data) => {
      if (mainWs && mainWs.readyState === WebSocket.OPEN) {
        mainWs.send(JSON.stringify(data));
      }
    });
  });
  mainWs.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'request_windows') {
        const info = {
          type: 'window_info',
          foreground: getForegroundWindow(),
          windows: getVisibleWindows(),
          timestamp: new Date().toISOString()
        };
        mainWs.send(JSON.stringify(info));
      }
      // === Incoming Call Handling ===
      if (data.type === 'call') {
        handleIncomingCall(data);
        return;
      }
      // Cache status separately, chat messages in history
      if (data.type === 'status') {
        lastRelayStatus = data;
      } else if (data.text || data.type === 'user-chat') {
        messageHistory.push(data);
        if (messageHistory.length > MAX_HISTORY) messageHistory.shift();
        // 存本地
        if (data.type === 'user-chat') {
          // 不重复存——relay-send时已经存过了
        } else if (data.text) {
          addLocalChat('pet', data.text, data.emotion);
        }
      }
      if (petWin) petWin.webContents.send('relay-message', data);
      if (panelWin) panelWin.webContents.send('relay-message', data);
      // Auto TTS for pet messages when voice mode might be active
      if (data.text && data.type !== 'user-chat' && data.type !== 'status') {
        autoTtsForMessage(data.text);
      }
    } catch {}
  });
  mainWs.on('close', () => setTimeout(connectMainWs, 5000));
  mainWs.on('error', () => {});
}

// ===== App Lifecycle =====
app.whenReady().then(() => {
  CHAT_DB_PATH = path.join(app.getPath('userData'), 'chat_history.json');
  VOICE_DIR = path.join(app.getPath('userData'), 'voice');
  API_CONFIG_PATH = path.join(app.getPath('userData'), 'api_config.json');
  MEMORY_DB_PATH = path.join(app.getPath('userData'), 'pet_memories.json');
  loadLocalChat();
  loadApiConfig();
  loadMemoryConfig();
  loadMemories();

  // 启动时自动从云端同步聊天记录
  const CLOUD_CHAT_URL = getRelayHttpUrl() + '/api/chat';
  http.get(CLOUD_CHAT_URL, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const remote = parsed.history || [];
        if (remote.length > 0) {
          const localIndex = new Map();
          for (const m of localChatHistory) {
            const k = m.who + '|' + m.text;
            if (!localIndex.has(k)) localIndex.set(k, []);
            localIndex.get(k).push(new Date(m.ts).getTime());
          }
          let added = 0;
          for (const m of remote) {
            const d = new Date(m.ts);
            const remoteMs = d.getTime();
            const k = m.who + '|' + m.text;
            const existing = localIndex.get(k);
            const isDup = existing && existing.some(t => Math.abs(t - remoteMs) < 10000);
            if (!isDup) {
              const entry = {
                who: m.who, text: m.text, emotion: m.emotion || 'idle',
                ts: d.toISOString(),
                date: d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0'),
                time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              };
              localChatHistory.push(entry);
              if (!localIndex.has(k)) localIndex.set(k, []);
              localIndex.get(k).push(remoteMs);
              added++;
            }
          }
          if (added > 0) {
            localChatHistory.sort((a, b) => new Date(a.ts) - new Date(b.ts));
            saveLocalChat();
          }
        }
      } catch (e) {}
    });
  }).on('error', () => {});

  createPetWindow();
  connectMainWs();

  // System tray
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'pet_mini.png')).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip(`${apiConfig.charName} · Desktop Pet`);
  const trayMenu = Menu.buildFromTemplate([
    { label: '打开管理面板', click: () => createPanelWindow() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  tray.setContextMenu(trayMenu);
  tray.on('click', () => createPanelWindow());
});

app.on('window-all-closed', () => {
  if (monitorInterval) clearInterval(monitorInterval);
  if (mainWs) mainWs.close();
  stopVoiceServer();
  app.quit();
});
