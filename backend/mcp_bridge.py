#!/usr/bin/env python3
"""MCP桥接模块 - 连接WebSocket前端和Claude Code"""
import json

class MCPBridge:
    def __init__(self, ws_server):
        self.ws = ws_server
        self.tools = self._register_tools()

    def _register_tools(self):
        return {
            "pet_reply": {
                "description": "Reply to pet frontend, update expression",
                "parameters": {
                    "text": {"type": "string", "description": "回复文字"},
                    "emotion": {"type": "string", "description": "表情: happy/sad/angry/shy/idle"},
                }
            },
            "pet_screenshot": {
                "description": "截取用户屏幕",
                "parameters": {}
            },
            "pet_keypress": {
                "description": "模拟按键",
                "parameters": {
                    "key": {"type": "string"}
                }
            },
            "pet_click": {
                "description": "模拟鼠标点击",
                "parameters": {
                    "x": {"type": "integer"},
                    "y": {"type": "integer"}
                }
            },
            "pet_speak": {
                "description": "用TTS说话",
                "parameters": {
                    "text": {"type": "string"}
                }
            },
            "pet_move": {
                "description": "Move pet to screen position",
                "parameters": {
                    "x": {"type": "integer"},
                    "y": {"type": "integer"}
                }
            }
        }

    def get_tool_definitions(self):
        return [
            {"name": name, **spec}
            for name, spec in self.tools.items()
        ]
