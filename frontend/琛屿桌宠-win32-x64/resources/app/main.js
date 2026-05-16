const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let win;

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

  // 拖动窗口
  ipcMain.on('window-drag', (event, { dx, dy }) => {
    const [x, y] = win.getPosition();
    win.setPosition(x + dx, y + dy);
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
