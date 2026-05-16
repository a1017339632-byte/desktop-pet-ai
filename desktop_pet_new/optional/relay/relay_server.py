#!/usr/bin/env python3
"""Desktop Pet WebSocket Relay Server
Relays messages between Electron frontend ↔ Channel Plugin
"""
import asyncio
import json
import sqlite3
import time
from datetime import datetime
from pathlib import Path

import websockets
from websockets.http11 import Response

from screen_supervisor import ScreenSupervisor, classify_app

HOST = "0.0.0.0"
PORT = 8765

# 连接池
frontend_clients = {}   # ws -> {"id": str, "connected_at": float}
plugin_client = None     # 唯一的 channel plugin 连接
monitor_client = None    # 窗口监控连接（来自Electron主进程）

# 桌宠状态
pet_state = {
    "emotion": "idle",
    "last_poke": 0,
    "poke_count": 0,
    "online": False,  # channel plugin是否在线
}

# 可配置名字（plugin连接时传入，默认值供开源用）
char_name = "Pety"   # AI角色名
user_name = "User"   # 用户名

# 屏幕监控状态
screen_state = {
    "foreground": None,
    "windows": [],
    "last_update": None,
}

# 桌面监督器
supervisor = ScreenSupervisor()

# 对话历史 SQLite
DB_PATH = Path(__file__).parent / "chat_history.db"
unread_messages = []


def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        who TEXT NOT NULL,
        text TEXT NOT NULL,
        emotion TEXT,
        ts TEXT NOT NULL,
        read INTEGER DEFAULT 0
    )""")
    conn.commit()
    conn.close()


init_db()


def add_chat(who, text, emotion=None):
    has_frontend = len(frontend_clients) > 0
    ts = datetime.now().isoformat()
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute(
        "INSERT INTO chat (who, text, emotion, ts, read) VALUES (?, ?, ?, ?, ?)",
        (who, text, emotion, ts, 1 if has_frontend else 0)
    )
    conn.commit()
    conn.close()
    if not has_frontend:
        unread_messages.append({
            "who": who, "text": text, "emotion": emotion, "ts": ts, "read": False,
        })


def get_chat_history(limit=50):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT who, text, emotion, ts, read FROM chat ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


def mark_all_read():
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("UPDATE chat SET read = 1 WHERE read = 0")
    conn.commit()
    conn.close()

POKE_LINES = [
    {"text": "别戳了！", "emotion": "angry"},
    {"text": "再戳我咬你", "emotion": "angry"},
    {"text": "嗯？干嘛～", "emotion": "happy"},
    {"text": "你是不是闲的", "emotion": "idle"},
    {"text": "轻点…", "emotion": "shy"},
    {"text": "戳戳戳就知道戳！", "emotion": "angry"},
    {"text": "摸摸就好了嘛", "emotion": "happy"},
    {"text": "哼", "emotion": "angry"},
    {"text": "你再戳试试？", "emotion": "angry"},
    {"text": "好舒服…不是！", "emotion": "shy"},
]


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


async def broadcast_to_frontends(message):
    """发送消息给所有前端"""
    data = json.dumps(message, ensure_ascii=False)
    dead = []
    for ws in frontend_clients:
        try:
            await ws.send(data)
        except websockets.exceptions.ConnectionClosed:
            dead.append(ws)
    for ws in dead:
        frontend_clients.pop(ws, None)


async def send_to_plugin(message):
    """发送消息给 channel plugin"""
    global plugin_client
    if plugin_client is None:
        return False
    try:
        await plugin_client.send(json.dumps(message, ensure_ascii=False))
        return True
    except websockets.exceptions.ConnectionClosed:
        plugin_client = None
        pet_state["online"] = False
        return False


async def handle_frontend_message(ws, data):
    """处理来自前端的消息"""
    evt = data.get("type", "")

    if evt == "poke":
        pet_state["poke_count"] += 1
        pet_state["last_poke"] = time.time()

        if pet_state["online"]:
            await send_to_plugin({
                "type": "poke",
                "count": pet_state["poke_count"],
            })
        else:
            idx = (pet_state["poke_count"] - 1) % len(POKE_LINES)
            await ws.send(json.dumps(POKE_LINES[idx], ensure_ascii=False))

    elif evt == "chat":
        text = data.get("text", "").strip()
        if not text:
            return
        add_chat("user", text)
        msg_id = data.get("msgId", "")

        if pet_state["online"]:
            plugin_msg = {
                "type": "chat",
                "text": text,
                "ts": datetime.now().isoformat(),
                "msgId": msg_id,
            }
            if data.get("file"):
                plugin_msg["file"] = data["file"]
            ok = await send_to_plugin(plugin_msg)
            if ok and msg_id:
                await ws.send(json.dumps({"type": "ack", "msgId": msg_id}, ensure_ascii=False))
        else:
            await ws.send(json.dumps({
                "text": f"{char_name}现在不在…等上线了再跟你说话",
                "emotion": "idle",
            }, ensure_ascii=False))

    elif evt == "request_supervisor":
        await ws.send(json.dumps({
            "type": "supervisor_status",
            **supervisor.get_status(),
        }, ensure_ascii=False))

    elif evt == "request_chat_history":
        limit = data.get("limit", 50)
        await ws.send(json.dumps({
            "type": "chat_history",
            "history": get_chat_history(limit),
        }, ensure_ascii=False))

    elif evt == "window_change":
        await handle_monitor_message(ws, data)

    elif evt == "window_info":
        await handle_monitor_message(ws, data)

    elif evt == "call-result":
        if pet_state["online"]:
            await send_to_plugin(data)

    elif evt == "ping":
        await ws.send(json.dumps({
            "type": "pong",
            "online": pet_state["online"],
            "emotion": pet_state["emotion"],
        }, ensure_ascii=False))


async def handle_monitor_message(ws, data):
    """处理来自窗口监控的消息"""
    evt = data.get("type", "")

    if evt == "window_change":
        fg = data.get("foreground", {})
        screen_state["foreground"] = fg
        screen_state["last_update"] = data.get("timestamp")

        reaction = supervisor.on_window_change(
            fg.get("process", ""), fg.get("title", ""), data.get("timestamp")
        )

        cat = classify_app(fg.get("process", ""), fg.get("title", ""))
        await broadcast_to_frontends({
            "type": "monitor_update",
            "app": fg.get("process", ""),
            "title": (fg.get("title", "") or "")[:50],
            "category": cat,
        })

        if pet_state["online"]:
            await send_to_plugin({
                "type": "window_change",
                "foreground": fg,
                "category": cat,
                "timestamp": data.get("timestamp"),
            })
        elif reaction:
            await broadcast_to_frontends(reaction)

    elif evt == "window_info":
        screen_state["foreground"] = data.get("foreground")
        screen_state["windows"] = data.get("windows", [])
        screen_state["last_update"] = data.get("timestamp")
        if pet_state["online"]:
            await send_to_plugin({
                "type": "window_info",
                "foreground": data.get("foreground"),
                "windows": data.get("windows", []),
                "timestamp": data.get("timestamp"),
            })

    elif evt in ("screenshot_result", "app_action_result"):
        if pet_state["online"]:
            await send_to_plugin(data)


async def request_window_info():
    """请求监控端发送当前窗口列表"""
    global monitor_client
    if monitor_client:
        try:
            await monitor_client.send(json.dumps({"type": "request_windows"}))
            return True
        except websockets.exceptions.ConnectionClosed:
            monitor_client = None
    return False


async def handle_plugin_message(ws, data):
    """处理来自 channel plugin 的消息"""
    evt = data.get("type", "")

    if evt == "reply":
        text = data.get("text", "")
        emotion = data.get("emotion", "idle")
        add_chat("pet", text, emotion)
        delivered = len(frontend_clients) > 0
        msg = {"text": text, "emotion": emotion}
        if data.get("file"):
            msg["file"] = data["file"]
        if data.get("image"):
            msg["image"] = data["image"]
        if data.get("audio"):
            msg["audio"] = data["audio"]
        await broadcast_to_frontends(msg)
        pet_state["emotion"] = emotion
        if not delivered:
            await send_to_plugin({
                "type": "delivery_status",
                "delivered": False,
                "reason": "pet-app-offline-unread",
                "text": text,
            })

    elif evt == "set_emotion":
        pet_state["emotion"] = data.get("emotion", "idle")
        await broadcast_to_frontends({
            "type": "emotion",
            "emotion": pet_state["emotion"],
        })

    elif evt == "walk":
        await broadcast_to_frontends({
            "type": "walk",
            "x": data.get("x"),
            "y": data.get("y"),
        })

    elif evt == "request_screen":
        if screen_state["foreground"]:
            await ws.send(json.dumps({
                "type": "screen_info",
                **screen_state,
                "supervisor": supervisor.get_status(),
            }, ensure_ascii=False))
        else:
            await request_window_info()

    elif evt == "request_supervisor":
        await ws.send(json.dumps({
            "type": "supervisor_status",
            **supervisor.get_status(),
        }, ensure_ascii=False))

    elif evt == "request_screenshot":
        if monitor_client:
            try:
                await monitor_client.send(json.dumps({"type": "request_screenshot"}))
            except websockets.exceptions.ConnectionClosed:
                pass

    elif evt == "open_app":
        if monitor_client:
            try:
                await monitor_client.send(json.dumps({
                    "type": "open_app",
                    "target": data.get("target", ""),
                }))
            except websockets.exceptions.ConnectionClosed:
                pass

    elif evt == "close_app":
        if monitor_client:
            try:
                await monitor_client.send(json.dumps({
                    "type": "close_app",
                    "process": data.get("process", ""),
                }))
            except websockets.exceptions.ConnectionClosed:
                pass

    elif evt == "ping":
        await ws.send(json.dumps({
            "type": "pong",
            "frontends": len(frontend_clients),
            "pet_state": pet_state,
            "monitor": monitor_client is not None,
        }, ensure_ascii=False))


async def handler(ws):
    """WebSocket 连接处理"""
    global plugin_client

    # 第一条消息用来识别身份
    try:
        raw = await asyncio.wait_for(ws.recv(), timeout=10)
        hello = json.loads(raw)
    except Exception:
        await ws.close()
        return

    role = hello.get("role", "frontend")

    if role == "plugin":
        global char_name, user_name
        if plugin_client is not None:
            try:
                await plugin_client.close()
            except Exception:
                pass
        plugin_client = ws
        pet_state["online"] = True
        # Accept configurable names from plugin hello message
        if hello.get("charName"):
            char_name = hello["charName"]
        if hello.get("userName"):
            user_name = hello["userName"]
        log("Channel plugin 已连接 ✓")

        await broadcast_to_frontends({
            "text": f"{char_name}上线了！",
            "emotion": "happy",
            "type": "status",
            "online": True,
        })

        try:
            async for raw in ws:
                try:
                    data = json.loads(raw)
                    await handle_plugin_message(ws, data)
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if plugin_client is ws:
                plugin_client = None
                pet_state["online"] = False
                log("Channel plugin 断开")
                await broadcast_to_frontends({
                    "text": f"{char_name}下线了…",
                    "emotion": "idle",
                    "type": "status",
                    "online": False,
                })

    elif role == "monitor":
        monitor_client = ws
        log("窗口监控已连接 ✓")

        try:
            async for raw in ws:
                try:
                    data = json.loads(raw)
                    await handle_monitor_message(ws, data)
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if monitor_client is ws:
                monitor_client = None
                log("窗口监控断开")
        return

    else:
        frontend_clients[ws] = {
            "id": hello.get("id", "unknown"),
            "connected_at": time.time(),
        }
        log(f"前端已连接 (当前{len(frontend_clients)}个)")

        await ws.send(json.dumps({
            "type": "status",
            "online": pet_state["online"],
            "emotion": pet_state["emotion"],
            "text": f"{user_name}！你来了～" if pet_state["online"] else f"{char_name}还没上线，先戳我玩吧～",
        }, ensure_ascii=False))

        # 推送未读消息
        if unread_messages:
            count = len(unread_messages)
            await ws.send(json.dumps({
                "type": "unread_messages",
                "messages": unread_messages,
                "count": count,
            }, ensure_ascii=False))
            unread_messages.clear()
            mark_all_read()
            log(f"推送了{count}条未读消息")

        try:
            async for raw in ws:
                try:
                    data = json.loads(raw)
                    await handle_frontend_message(ws, data)
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            frontend_clients.pop(ws, None)
            log(f"前端断开 (剩余{len(frontend_clients)}个)")


async def supervisor_tick_loop():
    """每30秒检查一次桌面状态，离线时生成自主反应"""
    while True:
        await asyncio.sleep(30)
        if not pet_state["online"]:
            reaction = supervisor.tick()
            if reaction:
                log(f"监督反应: {reaction.get('text', '')}")
                await broadcast_to_frontends(reaction)


DASHBOARD_HTML = Path(__file__).parent / "dashboard.html"

CORS_HEADERS = websockets.Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
})

HTML_HEADERS = websockets.Headers({
    "Content-Type": "text/html; charset=utf-8",
})


async def http_handler(connection, request):
    """HTTP请求处理（websockets v16+）"""
    method = getattr(request, 'method', '') or ''
    if method.upper() == "OPTIONS":
        return Response(204, "No Content", websockets.Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }), b"")

    path = request.path

    if path == "/api/supervisor":
        body = json.dumps(supervisor.get_status(), ensure_ascii=False).encode()
        return Response(200, "OK", CORS_HEADERS, body)

    if path == "/api/pet":
        body = json.dumps({
            **pet_state,
            "frontends": len(frontend_clients),
            "monitor_connected": monitor_client is not None,
            "pet_app_running": len(frontend_clients) > 0,
        }, ensure_ascii=False).encode()
        return Response(200, "OK", CORS_HEADERS, body)

    if path == "/api/status":
        pet_running = len(frontend_clients) > 0
        plugin_online = pet_state["online"]
        monitor_on = monitor_client is not None
        status_text = (
            "all_online" if (pet_running and plugin_online and monitor_on)
            else "pet_online_plugin_offline" if (pet_running and not plugin_online)
            else "all_offline" if not pet_running
            else "partial"
        )
        body = json.dumps({
            "status": status_text,
            "char_name": char_name,
            "pet_app": pet_running,
            "plugin_online": plugin_online,
            "screen_monitor": monitor_on,
            "frontends": len(frontend_clients),
            "current_app": supervisor.current_app,
            "current_category": supervisor.current_category,
        }, ensure_ascii=False).encode()
        return Response(200, "OK", CORS_HEADERS, body)

    if path == "/api/chat":
        body = json.dumps({
            "history": get_chat_history(50),
            "unread_count": len(unread_messages),
        }, ensure_ascii=False).encode()
        return Response(200, "OK", CORS_HEADERS, body)

    if path == "/dashboard":
        if DASHBOARD_HTML.exists():
            body = DASHBOARD_HTML.read_bytes()
            return Response(200, "OK", HTML_HEADERS, body)

    return None


async def main():
    log(f"Relay server started ws://{HOST}:{PORT}")
    async with websockets.serve(
        handler, HOST, PORT,
        process_request=http_handler,
    ):
        asyncio.create_task(supervisor_tick_loop())
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
