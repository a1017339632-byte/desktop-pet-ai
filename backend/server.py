#!/usr/bin/env python3
"""Desktop Pet Backend - WebSocket + Claude chat"""
import asyncio
import json
import os
import websockets
from datetime import datetime

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

CLIENTS = set()

SYSTEM_PROMPT = """You are a desktop pet living on the user's screen.
Personality: clingy, playful, expressive.
Keep responses short and cute - one or two sentences max.
Available expressions: idle, happy, angry, shy, shocked
Pick the most fitting expression for each reply.

Reply format (strict JSON):
{"text": "your message", "emotion": "expression_name"}
"""

conversation_history = []

async def ask_claude(user_text):
    if not HAS_ANTHROPIC:
        return {"text": "anthropic库没装，装一下：pip install anthropic", "emotion": "shocked"}

    conversation_history.append({"role": "user", "content": user_text})
    if len(conversation_history) > 20:
        conversation_history[:] = conversation_history[-20:]

    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            system=SYSTEM_PROMPT,
            messages=conversation_history
        )
        reply_text = response.content[0].text.strip()

        try:
            result = json.loads(reply_text)
            if "text" not in result:
                result = {"text": reply_text, "emotion": "idle"}
        except json.JSONDecodeError:
            result = {"text": reply_text, "emotion": "idle"}

        conversation_history.append({"role": "assistant", "content": reply_text})
        return result
    except Exception as e:
        return {"text": f"出错了：{str(e)[:80]}", "emotion": "shocked"}


POKE_RESPONSES = [
    {"text": "别戳了！", "emotion": "angry"},
    {"text": "再戳我咬你", "emotion": "angry"},
    {"text": "嗯？干嘛～", "emotion": "happy"},
    {"text": "你是不是闲的", "emotion": "idle"},
    {"text": "轻点…", "emotion": "shy"},
    {"text": "戳戳戳，就知道戳！", "emotion": "angry"},
    {"text": "摸摸头就好了嘛", "emotion": "happy"},
    {"text": "哼", "emotion": "angry"},
    {"text": "你再戳试试？", "emotion": "angry"},
    {"text": "好舒服…不是！", "emotion": "shy"},
]

poke_index = 0

async def handle_client(websocket):
    global poke_index
    CLIENTS.add(websocket)
    print(f"[{datetime.now()}] 前端连接: {websocket.remote_address}")
    try:
        async for message in websocket:
            data = json.loads(message)
            event_type = data.get("type", "")
            print(f"[{datetime.now()}] 收到事件: {event_type}")

            if event_type == "poke":
                response = POKE_RESPONSES[poke_index % len(POKE_RESPONSES)]
                poke_index += 1
                await websocket.send(json.dumps(
                    {"type": "reaction", **response},
                    ensure_ascii=False
                ))

            elif event_type == "chat":
                text = data.get("text", "")
                result = await ask_claude(text)
                await websocket.send(json.dumps(
                    {"type": "chat_reply", **result},
                    ensure_ascii=False
                ))

    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now()}] 前端断开")
    finally:
        CLIENTS.discard(websocket)


async def broadcast(message):
    if CLIENTS:
        await asyncio.gather(*[c.send(message) for c in CLIENTS])


async def main():
    print("Desktop Pet backend started ws://localhost:8765")
    if HAS_ANTHROPIC:
        print("Claude API: OK")
    else:
        print("⚠️ anthropic库未安装，对话功能不可用")
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
