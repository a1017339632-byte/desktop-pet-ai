const { app, BrowserWindow, screen, ipcMain, desktopCapturer } = require('electron');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let win;

// === 窗口监控模块 ===
const IGNORE_LIST = [
  'Windows 默认锁屏', 'Windows Default Lock Screen',
  'Program Manager', 'Settings',
  'NVIDIA GeForce Overlay', 'NVIDIA GPU Activity',
  'Windows Input Experience', 'TextInputHost',
  'Search', 'Start', 'ShellExperienceHost',
  'ApplicationFrameHost',
];

let lastForeground = '';
let monitorInterval = null;

function getForegroundWindow() {
  try {
    const ps = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
      $hwnd = [WinAPI]::GetForegroundWindow()
      $sb = New-Object System.Text.StringBuilder 256
      [WinAPI]::GetWindowText($hwnd, $sb, 256) | Out-Null
      $title = $sb.ToString()
      $pid = 0
      [WinAPI]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      "$($proc.ProcessName)|$title"
    `;
    const result = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8', timeout: 3000, windowsHide: true
    }).trim();
    const [processName, ...titleParts] = result.split('|');
    return { process: processName || '', title: titleParts.join('|') || '' };
  } catch {
    return null;
  }
}

function getVisibleWindows() {
  try {
    const ps = `
      Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
      Select-Object ProcessName, MainWindowTitle |
      ForEach-Object { "$($_.ProcessName)|$($_.MainWindowTitle)" }
    `;
    const result = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8', timeout: 5000, windowsHide: true
    }).trim();
    return result.split('\n')
      .map(line => {
        const [proc, ...t] = line.trim().split('|');
        return { process: proc, title: t.join('|') };
      })
      .filter(w => !IGNORE_LIST.some(ig => w.title.includes(ig) || w.process.includes(ig)));
  } catch {
    return [];
  }
}

function startMonitor(wsSend) {
  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = setInterval(() => {
    const fg = getForegroundWindow();
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
  }, 5000);
}

// IPC: 渲染进程请求窗口列表
ipcMain.handle('get-windows', async () => {
  return {
    foreground: getForegroundWindow(),
    windows: getVisibleWindows(),
    timestamp: new Date().toISOString()
  };
});

// === 截图模块 ===
async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    if (sources.length > 0) {
      const png = sources[0].thumbnail.toPNG();
      const filePath = path.join(app.getPath('temp'), `pet_screenshot_${Date.now()}.png`);
      fs.writeFileSync(filePath, png);
      return { success: true, path: filePath, size: png.length };
    }
    return { success: false, error: 'no screen source' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// === 软件/网页控制模块 ===
function openApp(target) {
  try {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      exec(`start "" "${target}"`, { windowsHide: true });
      return { success: true, action: 'open_url', target };
    }
    exec(`start "" "${target}"`, { windowsHide: true });
    return { success: true, action: 'open_app', target };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function closeApp(processName) {
  try {
    execSync(`taskkill /IM "${processName}" /F`, {
      encoding: 'utf8', timeout: 5000, windowsHide: true
    });
    return { success: true, action: 'close_app', process: processName };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

ipcMain.handle('capture-screen', captureScreen);
ipcMain.handle('open-app', (_, target) => openApp(target));
ipcMain.handle('close-app', (_, processName) => closeApp(processName));

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 600,
    height: 600,
    x: width - 650,
    y: height - 650,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'screen-saver');

  // 默认点击穿透，forward: true 让鼠标事件仍能触发 mouseenter/mouseleave
  win.setIgnoreMouseEvents(true, { forward: true });

  // 渲染进程通知：鼠标进入/离开可交互区域
  ipcMain.on('set-interactive', (event, interactive) => {
    if (interactive) {
      win.setIgnoreMouseEvents(false);
    } else {
      win.setIgnoreMouseEvents(true, { forward: true });
    }
  });

  // 关闭窗口
  ipcMain.on('window-close', () => {
    win.close();
  });

  // 打开管理面板窗口
  ipcMain.on('open-dashboard', () => {
    const dashWin = new BrowserWindow({
      width: 800,
      height: 700,
      title: '琛屿桌宠 · 桌面监督',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });
    dashWin.loadURL('http://119.91.115.102:8765/dashboard');
  });

  // 拖动窗口
  ipcMain.on('window-drag', (event, { dx, dy }) => {
    const [x, y] = win.getPosition();
    win.setPosition(x + dx, y + dy);
  });
}

// === 主进程 WebSocket（用于监控数据） ===
const WebSocket = require('ws');
const RELAY_URL = 'ws://119.91.115.102:8765';
let mainWs = null;

function connectMainWs() {
  mainWs = new WebSocket(RELAY_URL);
  mainWs.on('open', () => {
    mainWs.send(JSON.stringify({ role: 'monitor' }));
    startMonitor((data) => {
      if (mainWs && mainWs.readyState === WebSocket.OPEN) {
        mainWs.send(JSON.stringify(data));
      }
    });
  });
  mainWs.on('message', async (raw) => {
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
      if (data.type === 'request_screenshot') {
        const result = await captureScreen();
        if (result.success) {
          const pngData = fs.readFileSync(result.path);
          mainWs.send(JSON.stringify({
            type: 'screenshot_result',
            path: result.path,
            base64: pngData.toString('base64').substring(0, 500) + '...',
            size: result.size,
            timestamp: new Date().toISOString()
          }));
        } else {
          mainWs.send(JSON.stringify({ type: 'screenshot_result', error: result.error }));
        }
      }
      if (data.type === 'open_app') {
        const result = openApp(data.target || '');
        mainWs.send(JSON.stringify({ type: 'app_action_result', ...result }));
      }
      if (data.type === 'close_app') {
        const result = closeApp(data.process || '');
        mainWs.send(JSON.stringify({ type: 'app_action_result', ...result }));
      }
    } catch {}
  });
  mainWs.on('close', () => setTimeout(connectMainWs, 5000));
  mainWs.on('error', () => {});
}

app.whenReady().then(() => {
  createWindow();
  connectMainWs();
});

app.on('window-all-closed', () => {
  if (monitorInterval) clearInterval(monitorInterval);
  if (mainWs) mainWs.close();
  app.quit();
});
