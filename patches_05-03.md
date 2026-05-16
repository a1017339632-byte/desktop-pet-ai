# 2026-05-03 桌宠大更新 · 补丁清单

按功能拆分，每个独立测试。从git commit `e45652f`（最后能用的版本）开始，逐个加。

---

## 补丁1：桌面监督引擎（纯新文件，不影响现有功能）
**文件**：`backend/screen_supervisor.py`（新建）
**内容**：app分类引擎 + 自主反应 + 时长统计
**测试**：部署到服务器，curl `/api/supervisor` 看数据

---

## 补丁2：relay集成监督 + HTTP API
**文件**：`backend/relay_server.py`
**改动点**：
- `import screen_supervisor`
- 加 `supervisor = ScreenSupervisor()`
- `handle_monitor_message` 里调 `supervisor.on_window_change()`
- `handle_frontend_message` 加 `window_change`/`request_supervisor` 转发
- `broadcast_to_frontends` 加 `monitor_update` 消息
- `supervisor_tick_loop()` 异步循环
- HTTP handler: `/api/status` `/api/supervisor` `/api/pet` `/api/chat` `/dashboard`
**测试**：重启relay，curl API

---

## 补丁3：relay对话历史SQLite
**文件**：`backend/relay_server.py`
**改动点**：
- `import sqlite3`
- `init_db()` / `add_chat()` / `get_chat_history()` / `mark_all_read()`
- `handle_frontend_message.chat` 里调 `add_chat("user",...)`
- `handle_plugin_message.reply` 里调 `add_chat("pet",...)`
- 前端连接时推送 `unread_messages`
- `request_chat_history` handler
**测试**：发消息后查 `sqlite3 chat_history.db`

---

## 补丁4：relay delivery回执 + 文件转发
**文件**：`backend/relay_server.py`
**改动点**：
- reply里判断 `delivered = len(frontend_clients) > 0`，没送达发 `delivery_status` 给plugin
- chat/reply里转发 `file` 和 `audio` 数据
**测试**：关桌宠→发消息→看plugin是否收到delivery_status

---

## 补丁5：PETY偷看后台页面
**文件**：`desktop_pet_new/Pages1.jsx` MonitorPage部分
**改动点**：
- 常量：`CAT_NAMES` `CAT_COLORS` `fmtDur` `fmtTime12`
- `MonitorPage`：用 `relay.supervisorData` + `electronAPI.getWindows()` 双数据源
- 分类时长柱状图 + 切换历史（带时间范围）+ 本地窗口列表
**依赖**：补丁2（relay API）+ ws-bridge的supervisorData
**测试**：打开偷看后台看数据

---

## 补丁6：ws-bridge新增功能
**文件**：`desktop_pet_new/ws-bridge.jsx`
**改动点**：
- 加 `supervisorData` state + `setSupervisorData`
- `handleData` 加 `supervisor_status` / `unread_messages` / `chat_history` 处理
- 加 `requestSupervisor` / `requestChatHistory` / `sendFile` / `setMessages` 方法
- return里暴露这些新字段
- `addMessage` 加 `ts: Date.now()` 和完整日期时间格式
- audio数据接收：收到 `data.audio` 时设 `audioUrl`
**测试**：各功能分别测

---

## 补丁7：对话记录增强（时间分割线+搜索+高亮）
**文件**：`desktop_pet_new/Pages1.jsx` ChatPage部分
**改动点**：
- `TimeDivider` 组件（居中日期两边横线）
- `HighlightText` 组件（亮黄高亮）
- `getTimeOnly` 函数（气泡只显示时间不显示日期）
- `Bubble` 组件加 `searchQuery` prop + 图片显示 + `has-image` class
- ChatPage加 `searchQuery`/`searchMode`/`pendingImage` state
- 搜索栏UI + 过滤逻辑
- 加载历史记录（`requestChatHistory` on mount）
**依赖**：补丁6
**测试**：聊几条消息看时间线，搜索测高亮

---

## 补丁8：图片发送+显示
**文件**：`desktop_pet_new/Pages1.jsx` + `extras.css` + `preload.js` + `main.js`
**改动点**：
- `extras.css`：`.tg-bubble.has-image` 样式 + `.tg-bubble img` 约束
- `preload.js`：加 `pickFile`
- `main.js`：加 `pick-file` IPC handler（dialog.showOpenDialog）
- `Pages1.jsx`：附件按钮onClick调pickFile→setPendingImage，粘贴图片→setPendingImage，send()发图片+文字
**测试**：粘贴图片/选文件/发送

---

## 补丁9：本地对话存储
**文件**：`desktop_pet_new/main.js` + `preload.js`
**改动点**：
- `main.js`：`CHAT_DB_PATH` `localChatHistory` `loadLocalChat` `saveLocalChat` `addLocalChat` `getLocalChat`
- ⚠️ `CHAT_DB_PATH`/`VOICE_DIR`/`loadLocalChat` 必须在 `app.whenReady()` 之后初始化
- relay消息接收处加 `addLocalChat`
- `relay-send` chat处加 `addLocalChat`
- `preload.js`：加 `getLocalChat` `uploadChat` `saveVoice`
- `main.js`：加对应IPC handlers
**测试**：聊天后检查userData/chat_history.json

---

## 补丁10：窗口监控EncodedCommand
**文件**：`desktop_pet_new/main.js`
**改动点**：
- `ALL_WINDOWS_SCRIPT` 合并脚本（前台+窗口列表）
- `ENCODED_SCRIPT` base64编码
- `refreshCache()` 异步exec解析FG:/W:前缀
- `cachedWindowData` 缓存
- `startMonitor()` 用缓存，延30秒首次调用
- `get-windows` IPC返回缓存
- ⚠️ 需要 `const { exec } = require('child_process')` 
**测试**：启动后等30秒查偷看后台

---

## 补丁11：channel plugin新工具
**文件**：`server.js`（plugin cache + marketplace两处）
**改动点**：
- 加 `http` `fs` `path` `os` require
- 加 `httpGet` `INBOX_DIR` `ensureInbox`
- 加 `deliveryResolve` `screenshotResolve` `appActionResolve`
- `handleRelayMessage` 加 `delivery_status` `screenshot_result` `app_action_result` `supervisor_status` 处理
- 图片保存到inbox
- `reply` 工具等2秒delivery回执
- 新工具：`voice_reply` `get_activity` `get_pet_status` `take_screenshot` `open_app` `close_app`
- instructions更新
**测试**：重启CC后调用各工具

---

## 补丁12：语音通话流程
**文件**：`desktop_pet_new/voice_server.py` + `Pages1.jsx` + `main.js`
**改动点**：
- `voice_server.py`：MiniMax API key + voice_id硬编码，域名改 `api.minimaxi.com`
- `Pages1.jsx` ChatPage：收到pet消息带audioUrl时播放，sendAudio加[语音]前缀
- `main.js`：`VOICE_DIR` `saveVoiceFile` `save-voice` IPC
- plugin `server.js`：`voice_reply` 工具调localhost:9800/tts生成音频
**依赖**：voice_server运行中 + 补丁11
**测试**：语音模式说话→识别→回复→播放

---

## 加载顺序建议
1→2→3→4（服务端，不碰前端）
6→7→8→5（前端UI，逐个测）
9→10（main.js，注意app.whenReady初始化顺序）
11→12（plugin，需重启CC）

每加一个补丁打包测试一次，确认穿透没坏再加下一个。
