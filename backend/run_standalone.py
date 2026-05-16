#!/usr/bin/env python3
"""Desktop Pet Standalone Mode - No MCP needed, direct WebSocket+Claude API
For testing and demo. Production mode uses MCP channel to connect Claude Code.
"""
import asyncio
import json
import sys
import os
from datetime import datetime

import websockets

try:
    import anthropic
    client = anthropic.Anthropic()
    HAS_API = True
except Exception:
    HAS_API = False

WS_PORT = 8765
ws_clients = set()

SYSTEM = """You are a desktop pet living on the user's screen.
Personality: clingy, playful, expressive.
Keep responses short - one or two sentences.

Available expressions: idle, happy, angry, shy, shocked
Reply strictly in JSON: {"text": "your message", "emotion": "expression_name"}"""

history = []

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
    {"text": "我要生气了哦", "emotion": "angry"},
    {"text": "…你手这么闲吗", "emotion": "idle"},
]
poke_idx = 0


async def ask_claude(text):
    if not HAS_API:
        return {"text": "API没配好，先戳我玩吧", "emotion": "shocked"}

    history.append({"role": "user", "content": text})
    if len(history) > 20:
        history[:] = history[-20:]

    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            system=SYSTEM,
            messages=history,
        )
        raw = resp.content[0].text.strip()
        # 有时LLM会用markdown代码块包裹JSON
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            result = json.loads(raw)
            if "text" not in result:
                result = {"text": raw, "emotion": "idle"}
        except json.JSONDecodeError:
            result = {"text": raw, "emotion": "idle"}

        history.append({"role": "assistant", "content": raw})
        return result
    except Exception as e:
        return {"text": f"出错了: {str(e)[:60]}", "emotion": "shocked"}


async def handler(websocket):
    global poke_idx
    ws_clients.add(websocket)
    print(f"[{datetime.now():%H:%M:%S}] 前端已连接")

    await websocket.send(json.dumps(
        {"type": "chat_reply", "text": "你来了～", "emotion": "happy"},
        ensure_ascii=False,
    ))

    try:
        async for raw in websocket:
            data = json.loads(raw)
            evt = data.get("type", "")
            print(f"[{datetime.now():%H:%M:%S}] {evt}")

            if evt == "poke":
                resp = POKE_LINES[poke_idx % len(POKE_LINES)]
                poke_idx += 1
                await websocket.send(json.dumps(
                    {"type": "reaction", **resp}, ensure_ascii=False
                ))

            elif evt == "chat":
                text = data.get("text", "")
                await websocket.send(json.dumps(
                    {"type": "chat_reply", "text": "思考中…", "emotion": "idle"},
                    ensure_ascii=False,
                ))
                result = await ask_claude(text)
                await websocket.send(json.dumps(
                    {"type": "chat_reply", **result}, ensure_ascii=False
                ))

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        ws_clients.discard(websocket)
        print(f"[{datetime.now():%H:%M:%S}] 前端断开")


async def main():
    print(f"Pet backend started ws://localhost:{WS_PORT}")
    print(f"Claude API: {'OK' if HAS_API else '未配置'}")
    print("等待Electron前端连接...")
    async with websockets.serve(handler, "127.0.0.1", WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
