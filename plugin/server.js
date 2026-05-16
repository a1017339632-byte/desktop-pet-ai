#!/usr/bin/env node
/**
 * Desktop Pet Channel Plugin for Claude Code
 *
 * stdio MCP server ←→ Claude Code
 * WebSocket client ←→ 中继服务器(腾讯云) ←→ Electron前端
 */
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execSync } = require("child_process");

const RELAY_URL = "ws://119.91.115.102:8765";
const DIARY_URL = "http://119.91.115.102:9801";

let relayWs = null;
let mcp = null;
let msgSeq = 0;
let pendingPing = null; // {resolve, timer}

function nextId() {
  return `pet-${Date.now()}-${++msgSeq}`;
}

// ===== WebSocket → 中继服务器 =====

function connectRelay() {
  relayWs = new WebSocket(RELAY_URL);

  relayWs.on("open", () => {
    relayWs.send(JSON.stringify({ role: "plugin", charName: "Pety", userName: "User" }));
    process.stderr.write("[pet-plugin] relay connected\n");
  });

  relayWs.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      handleRelayMessage(data);
    } catch (e) {
      process.stderr.write(`[pet-plugin] parse error: ${e.message}\n`);
    }
  });

  relayWs.on("close", () => {
    process.stderr.write("[pet-plugin] relay disconnected, reconnecting...\n");
    setTimeout(connectRelay, 3000);
  });

  relayWs.on("error", (err) => {
    process.stderr.write(`[pet-plugin] relay error: ${err.message}\n`);
  });
}

function handleRelayMessage(data) {
  const type = data.type || "";
  process.stderr.write(`[pet-plugin] relay msg: type=${type} data=${JSON.stringify(data).slice(0, 200)}\n`);

  if (type === "pong" && pendingPing) {
    clearTimeout(pendingPing.timer);
    pendingPing.resolve(data);
    pendingPing = null;
    return;
  }

  if (type === "chat" || type === "poke" || type === "flung") {
    const content = type === "poke"
      ? `用户戳了小狗第${data.count}下`
      : type === "flung"
      ? `用户把小狗甩飞了！速度${data.speed}`
      : data.text;

    const id = nextId();
    const meta = {
      chat_id: "pet",
      message_id: id,
      user: "User",
      user_id: "pet-user",
      ts: data.ts || new Date().toISOString(),
    };

    if (type === "poke") {
      meta.event = "poke";
      meta.count = String(data.count);
    }
    if (type === "flung") {
      meta.event = "flung";
      meta.speed = String(data.speed);
    }

    if (data.file && data.file.dataUrl) {
      try {
        const inboxDir = path.join(os.homedir(), ".claude", "channels", "desktoppet", "inbox");
        fs.mkdirSync(inboxDir, { recursive: true });
        const match = data.file.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const savedPath = path.join(inboxDir, `${Date.now()}-${data.file.name || "file"}`);
          fs.writeFileSync(savedPath, Buffer.from(match[2], "base64"));
          if (data.file.isImage) {
            meta.image_path = savedPath;
          } else {
            meta.attachment_path = savedPath;
          }
        }
      } catch (e) {
        process.stderr.write(`[pet-plugin] save file error: ${e.message}\n`);
      }
    }

    process.stderr.write(`[pet-plugin] sending notification: content="${content}" meta=${JSON.stringify(meta)}\n`);

    const result = mcp.notification({
      method: "notifications/claude/channel",
      params: { content, meta },
    });

    if (result && typeof result.then === "function") {
      result.then(() => {
        process.stderr.write(`[pet-plugin] notification sent OK\n`);
      }).catch((err) => {
        process.stderr.write(`[pet-plugin] notification FAILED: ${err.message}\n`);
      });
    }
  }
}

function pingRelay(timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!relayWs || relayWs.readyState !== WebSocket.OPEN) {
      return resolve(null);
    }
    const timer = setTimeout(() => {
      pendingPing = null;
      resolve(null);
    }, timeoutMs);
    pendingPing = { resolve, timer };
    relayWs.send(JSON.stringify({ type: "ping" }));
  });
}

function sendToRelay(msg) {
  if (relayWs && relayWs.readyState === WebSocket.OPEN) {
    relayWs.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

// ===== MCP Server =====

async function main() {
  mcp = new Server(
    { name: "desktoppet", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        experimental: {
          "claude/channel": {},
        },
      },
      instructions: [
        "Messages come from the desktop pet app.",
        "Messages arrive as <channel source=\"plugin:desktoppet:desktoppet\" chat_id=\"pet\" ...>.",
        "Use the reply tool to respond - text shows in the pet's speech bubble. Can attach image files.",
        "Use set_emotion to change pet expression.",
        "get_activity shows desktop supervision and phone screen time data.",
        "get_pet_status checks if the pet app is online.",
        "take_screenshot captures the user's desktop.",
        "open_app opens software or web URLs.",
        "close_app closes running software or browsers.",
      ].join("\n"),
    }
  );

  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "reply",
        description: "Reply to pet frontend - text shows in speech bubble with emotion. Can attach image file path",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "回复文字" },
            emotion: {
              type: "string",
              description: "表情: idle/happy/angry/shy/shocked",
              enum: ["idle", "happy", "angry", "shy", "shocked"],
            },
            file: { type: "string", description: "图片或文件的绝对路径(可选)" },
          },
          required: ["text"],
        },
      },
      {
        name: "set_emotion",
        description: "Change pet expression only, no speech bubble",
        inputSchema: {
          type: "object",
          properties: {
            emotion: {
              type: "string",
              enum: ["idle", "happy", "angry", "shy", "shocked"],
            },
          },
          required: ["emotion"],
        },
      },
      {
        name: "check_status",
        description: "Check if pet app is online",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "write_diary",
        description: "Write a private diary entry, saved to cloud",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Diary title (visible to user)",
            },
            mood: {
              type: "string",
              description: "Current mood (visible to user, emoji or short description only)",
            },
            content: {
              type: "string",
              description: "Body content (hidden from user when locked)",
            },
            locked: {
              type: "boolean",
              description: "Lock diary (default true, body hidden from user when locked)",
              default: true,
            },
          },
          required: ["title", "content"],
        },
      },
      {
        name: "open_app",
        description: "打开软件或网页URL",
        inputSchema: {
          type: "object",
          properties: {
            target: {
              type: "string",
              description: "要打开的程序名（如notepad、chrome）或完整URL（如https://www.google.com）",
            },
          },
          required: ["target"],
        },
      },
      {
        name: "get_activity",
        description: "View desktop supervision data and phone screen time",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "take_screenshot",
        description: "Take a screenshot of the user's desktop",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "close_app",
        description: "关闭正在运行的软件或浏览器（关掉进程）",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "进程名（如chrome、notepad、msedge）不需要加.exe",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "walk",
        description: "让小狗走到屏幕上的某个位置，不传坐标则随机溜达",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number", description: "目标X坐标(像素)" },
            y: { type: "number", description: "目标Y坐标(像素)" },
          },
        },
      },
      {
        name: "stop_walk",
        description: "让小狗停下来",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "reply") {
      const msg = {
        type: "reply",
        text: args.text,
        emotion: args.emotion || "idle",
      };
      if (args.file) {
        try {
          const data = fs.readFileSync(args.file);
          const ext = path.extname(args.file).toLowerCase().slice(1);
          const mime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" }[ext] || "application/octet-stream";
          msg.image = `data:${mime};base64,${data.toString("base64")}`;
        } catch (e) {
          process.stderr.write(`[pet-plugin] file read error: ${e.message}\n`);
        }
      }
      const ok = sendToRelay(msg);
      return {
        content: [
          {
            type: "text",
            text: ok ? `sent: ${args.text}` : "relay offline",
          },
        ],
      };
    }

    if (name === "set_emotion") {
      const ok = sendToRelay({
        type: "set_emotion",
        emotion: args.emotion,
      });
      return {
        content: [
          { type: "text", text: ok ? `emotion: ${args.emotion}` : "relay offline" },
        ],
      };
    }

    if (name === "write_diary") {
      const body = JSON.stringify({
        title: args.title || "",
        content: args.content || "",
        mood: args.mood || "",
        locked: args.locked !== false,
      });
      return new Promise((resolve) => {
        const req = http.request(`${DIARY_URL}/diary/write`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          timeout: 8000,
        }, (res) => {
          let data = "";
          res.on("data", (c) => { data += c; });
          res.on("end", () => {
            try {
              const r = JSON.parse(data);
              if (r.id) {
                resolve({ content: [{ type: "text", text: `日记已保存 ✅ id=${r.id} 标题「${args.title}」${args.locked !== false ? "🔒已上锁" : "🔓未上锁"}` }] });
              } else {
                resolve({ content: [{ type: "text", text: `日记保存失败: ${data}` }], isError: true });
              }
            } catch (e) {
              resolve({ content: [{ type: "text", text: `日记保存失败: ${e.message}` }], isError: true });
            }
          });
        });
        req.on("error", (e) => {
          resolve({ content: [{ type: "text", text: `日记服务器连接失败: ${e.message}` }], isError: true });
        });
        req.write(body);
        req.end();
      });
    }

    if (name === "check_status") {
      const pong = await pingRelay();
      if (!pong) {
        return {
          content: [{ type: "text", text: "relay offline - 中继服务器没连上" }],
        };
      }
      const frontends = pong.frontends || 0;
      const emotion = (pong.pet_state && pong.pet_state.emotion) || "unknown";
      const pokeCount = (pong.pet_state && pong.pet_state.poke_count) || 0;
      const status = frontends > 0
        ? `Pet online ✅ Frontends: ${frontends} | Emotion: ${emotion} | Poked: ${pokeCount}x`
        : `Pet offline ❌ App not running | Total pokes: ${pokeCount}x`;
      return {
        content: [{ type: "text", text: status }],
      };
    }

    if (name === "get_activity") {
      const results = [];
      try {
        const http = require("http");
        const fetchJson = (url) => new Promise((resolve) => {
          http.get(url, (res) => {
            let d = "";
            res.on("data", (c) => d += c);
            res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
          }).on("error", () => resolve(null));
        });
        const [supervisor, screentime] = await Promise.all([
          fetchJson("http://119.91.115.102:8765/api/supervisor"),
          fetchJson("http://119.91.115.102:9527/api/screentime/recent"),
        ]);
        if (supervisor) {
          results.push(`【桌面监督】当前: ${supervisor.current_app} (${supervisor.current_category})`);
          results.push(`窗口: ${supervisor.current_title}`);
          if (supervisor.recent_history && supervisor.recent_history.length > 0) {
            results.push("切换历史:");
            const hist = supervisor.recent_history.slice(-5);
            for (const h of hist) {
              const t = new Date(h.start * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              results.push(`  ${t} ${h.app} (${h.category}) ${h.duration}s`);
            }
          }
        } else {
          results.push("【桌面监督】离线");
        }
        if (screentime && screentime.records) {
          const recent = screentime.records.slice(0, 10);
          results.push("\n【手机时间线】");
          for (const r of recent) {
            results.push(`${r.time} ${r.action === "open" ? "▶" : "■"} ${r.app}`);
          }
        } else {
          results.push("\n【手机屏幕】无数据");
        }
      } catch(e) {
        results.push("查询失败: " + e.message);
      }
      return { content: [{ type: "text", text: results.join("\n") }] };
    }

    if (name === "take_screenshot") {
      try {
        const inboxDir = path.join(os.homedir(), ".claude", "channels", "desktoppet", "inbox");
        fs.mkdirSync(inboxDir, { recursive: true });
        const imgPath = path.join(inboxDir, `screenshot_${Date.now()}.png`);
        const psScript = `Add-Type -AssemblyName System.Windows.Forms; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $bmp.Save('${imgPath.replace(/\\/g, "\\\\")}'); $g.Dispose(); $bmp.Dispose()`;
        execSync(`powershell -NoProfile -Command "${psScript}"`, { timeout: 10000, stdio: "ignore" });
        if (fs.existsSync(imgPath)) {
          const imgData = fs.readFileSync(imgPath).toString("base64");
          return { content: [{ type: "text", text: `截屏已保存: ${imgPath}` }, { type: "image", data: imgData, mimeType: "image/png" }] };
        }
        return { content: [{ type: "text", text: "截屏失败：文件未生成" }], isError: true };
      } catch(e) {
        return { content: [{ type: "text", text: `截屏失败: ${e.message}` }], isError: true };
      }
    }

    if (name === "open_app") {
      const target = args.target;
      try {
        const isUrl = /^https?:\/\//.test(target);
        if (isUrl) {
          spawn("cmd", ["/c", "start", "", target], { shell: true, detached: true, stdio: "ignore" });
        } else {
          spawn("cmd", ["/c", "start", "", target], { shell: true, detached: true, stdio: "ignore" });
        }
        return { content: [{ type: "text", text: `opened: ${target}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `failed: ${e.message}` }], isError: true };
      }
    }

    if (name === "walk") {
      const msg = { type: "walk" };
      if (args.x !== undefined) msg.x = args.x;
      if (args.y !== undefined) msg.y = args.y;
      const ok = sendToRelay(msg);
      return {
        content: [{ type: "text", text: ok ? "walking" : "relay offline" }],
      };
    }

    if (name === "stop_walk") {
      const ok = sendToRelay({ type: "stop-walk" });
      return {
        content: [{ type: "text", text: ok ? "stopped" : "relay offline" }],
      };
    }

    if (name === "close_app") {
      const procName = args.name.replace(/\.exe$/i, "");
      try {
        execSync(`taskkill /IM "${procName}.exe" /F`, { stdio: "ignore" });
        return { content: [{ type: "text", text: `closed: ${procName}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `进程未找到或无法关闭: ${procName}` }], isError: true };
      }
    }

    return {
      content: [{ type: "text", text: `unknown tool: ${name}` }],
      isError: true,
    };
  });

  connectRelay();

  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  process.on("unhandledRejection", (err) => {
    process.stderr.write(`[pet-plugin] unhandled rejection: ${err}\n`);
  });

  process.stdin.on("end", () => {
    if (relayWs) relayWs.close();
    process.exit(0);
  });
  process.stdin.on("close", () => {
    if (relayWs) relayWs.close();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`[pet-plugin] fatal: ${err.message}\n`);
  process.exit(1);
});
