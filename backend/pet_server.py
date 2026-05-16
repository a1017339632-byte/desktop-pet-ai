#!/usr/bin/env python3
"""Desktop Pet MCP Server
[Electron frontend] ←WebSocket→ [this server] ←stdio MCP→ [Claude Code]
"""
import asyncio
import json
import sys
from contextlib import AsyncExitStack
from datetime import datetime, timezone

import anyio
import websockets
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.server.session import ServerSession
from mcp.shared.message import JSONRPCMessage, SessionMessage
from mcp.types import JSONRPCNotification, Tool, TextContent

WS_PORT = 8765
ws_clients: set = set()
msg_counter = 0
outbound_queue: asyncio.Queue = asyncio.Queue()
inbound_queue: asyncio.Queue = asyncio.Queue()
session_ref: ServerSession | None = None

# ========== WebSocket ==========

async def ws_handler(websocket):
    ws_clients.add(websocket)
    sys.stderr.write("[pet] 前端已连接\n")
    try:
        async for raw in websocket:
            data = json.loads(raw)
            sys.stderr.write(f"[pet] 前端→ {data.get('type')}\n")
            await inbound_queue.put(data)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        ws_clients.discard(websocket)
        sys.stderr.write("[pet] 前端断开\n")


async def ws_sender():
    while True:
        msg = await outbound_queue.get()
        if ws_clients:
            payload = json.dumps(msg, ensure_ascii=False)
            await asyncio.gather(
                *[c.send(payload) for c in ws_clients],
                return_exceptions=True,
            )

# ========== MCP ==========

mcp = Server("desktop-pet")

@mcp.list_tools()
async def list_tools():
    return [
        Tool(
            name="reply",
            description="Reply to pet frontend, text shows in chat bubble",
            inputSchema={
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string"},
                    "text": {"type": "string"},
                    "emotion": {
                        "type": "string",
                        "description": "idle/happy/angry/shy/shocked",
                        "enum": ["idle", "happy", "angry", "shy", "shocked"],
                    },
                },
                "required": ["chat_id", "text"],
            },
        ),
        Tool(
            name="set_emotion",
            description="Change pet expression",
            inputSchema={
                "type": "object",
                "properties": {
                    "emotion": {
                        "type": "string",
                        "enum": ["idle", "happy", "angry", "shy", "shocked"],
                    },
                },
                "required": ["emotion"],
            },
        ),
    ]

@mcp.call_tool()
async def call_tool(name: str, arguments: dict):
    global msg_counter
    msg_counter += 1

    if name == "reply":
        await outbound_queue.put({
            "type": "chat_reply",
            "text": arguments.get("text", ""),
            "emotion": arguments.get("emotion", "idle"),
            "message_id": str(msg_counter),
        })
        return [TextContent(type="text", text=f"sent (id: {msg_counter})")]

    if name == "set_emotion":
        await outbound_queue.put({
            "type": "set_emotion",
            "emotion": arguments.get("emotion", "idle"),
        })
        return [TextContent(type="text", text=f"emotion → {arguments.get('emotion')}")]

    return [TextContent(type="text", text=f"unknown: {name}")]

# ========== 前端→Claude 转发 ==========

def make_channel_notification(content: str, message_id: str) -> SessionMessage:
    notif = JSONRPCNotification(
        jsonrpc="2.0",
        method="notifications/claude/channel",
        params={
            "content": content,
            "meta": {
                "chat_id": "pet",
                "message_id": message_id,
                "user": "User",
                "user_id": "pet_user",
                "ts": datetime.now(timezone.utc).isoformat(),
            },
        },
    )
    return SessionMessage(message=JSONRPCMessage(notif))


async def inbound_relay():
    global msg_counter
    while True:
        data = await inbound_queue.get()
        event_type = data.get("type", "")
        msg_counter += 1

        if event_type == "poke":
            content = f"[poke] User poked the pet #{data.get('count', '?')}"
        elif event_type == "chat":
            content = data.get("text", "")
        else:
            content = f"[pet] {event_type}"

        if not session_ref:
            sys.stderr.write("[pet] MCP未就绪\n")
            continue

        try:
            sm = make_channel_notification(content, str(msg_counter))
            await session_ref._write_stream.send(sm)
            sys.stderr.write(f"[pet] → Claude: {content[:60]}\n")
        except Exception as e:
            sys.stderr.write(f"[pet] 转发失败: {e}\n")

# ========== 带session捕获的run ==========

async def run_mcp_with_session(read_stream, write_stream, init_options):
    global session_ref
    async with AsyncExitStack() as stack:
        lifespan_ctx = await stack.enter_async_context(mcp.lifespan(mcp))
        session = await stack.enter_async_context(
            ServerSession(read_stream, write_stream, init_options)
        )
        session_ref = session
        sys.stderr.write("[pet] MCP session建立✓\n")

        async with anyio.create_task_group() as tg:
            async for message in session.incoming_messages:
                tg.start_soon(
                    mcp._handle_message,
                    message,
                    session,
                    lifespan_ctx,
                    False,
                )

# ========== main ==========

async def main():
    sys.stderr.write("[pet] Desktop Pet MCP Server starting...\n")

    async with stdio_server() as (read_stream, write_stream):
        init_options = mcp.create_initialization_options()
        if init_options.capabilities:
            init_options.capabilities.experimental = \
                init_options.capabilities.experimental or {}
            init_options.capabilities.experimental["claude/channel"] = {}

        ws_server = await websockets.serve(ws_handler, "127.0.0.1", WS_PORT)
        sys.stderr.write(f"[pet] WebSocket ws://localhost:{WS_PORT}\n")

        await asyncio.gather(
            ws_sender(),
            run_mcp_with_session(read_stream, write_stream, init_options),
            inbound_relay(),
        )

if __name__ == "__main__":
    asyncio.run(main())
