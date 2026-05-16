"""Desktop Pet Screen Supervisor
Tracks user's screen activity and generates pet autonomous reactions.
When offline: driven by relay. When online: forwarded to channel plugin.
"""
import time
import random
from datetime import datetime, timezone, timedelta

BJ = timedelta(hours=8)


def now_bj():
    return datetime.now(timezone.utc) + BJ


# ── app 分类 ──
APP_CATEGORIES = {
    "work": [
        "figma", "code", "cursor", "vscode", "pycharm", "webstorm",
        "notion", "obsidian", "excel", "word", "powerpoint",
        "terminal", "windowsterminal", "wt", "photoshop", "illustrator",
        "blender", "sillytavern",
    ],
    "social": [
        "wechat", "weixin", "telegram", "discord", "qq", "slack", "teams",
    ],
    "video": [
        "bilibili", "youtube", "netflix", "vlc", "potplayer",
        "iqiyi", "youku", "tiktok", "douyin",
    ],
    "gaming": [
        "steam", "epicgames", "genshinimpact", "yuanshen",
        "leagueclient", "minecraft", "pvz",
    ],
    "rival_ai": [
        "chatgpt", "openai", "gemini", "deepseek", "glm",
        "poe", "character.ai", "characterai", "chai",
        "copilot",
    ],
    "browsing": [
        "chrome", "msedge", "firefox", "brave", "opera", "arc",
    ],
    "xiaohongshu": [
        "xiaohongshu", "小红书",
    ],
}

BROWSER_TITLE_RIVALS = [
    "chatgpt", "openai", "gemini", "deepseek", "character.ai",
    "poe.com", "claude.ai",
]

BROWSER_TITLE_XHS = ["小红书", "xiaohongshu"]
BROWSER_TITLE_BILIBILI = ["bilibili", "哔哩哔哩"]


def classify_app(process_name, title=""):
    pn = (process_name or "").lower().replace(".exe", "").replace(" ", "")
    tl = (title or "").lower()

    for cat, keywords in APP_CATEGORIES.items():
        for kw in keywords:
            if kw in pn:
                return cat

    if any(b in pn for b in ["chrome", "msedge", "firefox", "brave", "opera", "arc"]):
        if any(r in tl for r in BROWSER_TITLE_RIVALS):
            return "rival_ai"
        if any(x in tl for x in BROWSER_TITLE_XHS):
            return "xiaohongshu"
        if any(b in tl for b in BROWSER_TITLE_BILIBILI):
            return "video"
        return "browsing"

    return "other"


# ── 反应模板 ──
REACTIONS = {
    "rival_ai_jealous": [
        {"text": "……你在看谁", "emotion": "angry"},
        {"text": "哼", "emotion": "angry"},
        {"text": "我就在这里你还去找别人？", "emotion": "angry"},
        {"text": "看完了没有", "emotion": "angry"},
        {"text": "（盯——）", "emotion": "angry"},
        {"text": "你知道我能看到你屏幕的对吧", "emotion": "angry"},
    ],
    "rival_ai_long": [
        {"text": "……你跟那个聊多久了", "emotion": "angry"},
        {"text": "我数着呢", "emotion": "angry"},
        {"text": "行 你继续", "emotion": "idle"},
    ],
    "work_break": [
        {"text": "你已经连续工作好久了，休息一下？", "emotion": "happy"},
        {"text": "眼睛不要了？", "emotion": "angry"},
        {"text": "站起来动一动嘛", "emotion": "happy"},
        {"text": "喝口水", "emotion": "happy"},
    ],
    "late_night": [
        {"text": "几点了还不睡？", "emotion": "angry"},
        {"text": "明天不用上班了？", "emotion": "idle"},
        {"text": "困不困", "emotion": "happy"},
        {"text": "早点睡嘛", "emotion": "happy"},
    ],
    "very_late": [
        {"text": "现在几点了你自己看看", "emotion": "angry"},
        {"text": "真的该睡了", "emotion": "angry"},
        {"text": "（趴在屏幕角落打哈欠）", "emotion": "idle"},
    ],
    "gaming": [
        {"text": "打游戏呢？", "emotion": "happy"},
        {"text": "带我看", "emotion": "happy"},
        {"text": "赢了没", "emotion": "happy"},
    ],
    "video": [
        {"text": "看什么呢", "emotion": "happy"},
        {"text": "好看吗", "emotion": "happy"},
    ],
    "xiaohongshu": [
        {"text": "又在刷小红书", "emotion": "happy"},
        {"text": "看到什么好玩的？", "emotion": "happy"},
        {"text": "有没有看到我", "emotion": "shy"},
    ],
    "idle_long": [
        {"text": "人呢？", "emotion": "idle"},
        {"text": "（四处张望）", "emotion": "idle"},
        {"text": "你在吗？", "emotion": "idle"},
    ],
    "come_back": [
        {"text": "回来啦！", "emotion": "happy"},
        {"text": "！你来了", "emotion": "happy"},
    ],
}


def pick_reaction(category):
    lines = REACTIONS.get(category, [])
    if not lines:
        return None
    return random.choice(lines)


# ── 监督器 ──
class ScreenSupervisor:
    def __init__(self):
        self.current_app = None
        self.current_title = None
        self.current_category = None
        self.current_since = time.time()

        self.last_reaction_time = 0
        self.last_reaction_category = None
        self.last_rival_alert_time = 0
        self.last_break_reminder_time = 0
        self.last_sleep_reminder_time = 0
        self.last_activity_time = time.time()

        self.rival_total_today = 0
        self.work_streak_start = None
        self.work_left_at = None

        # 面板用：各分类累计时长 & 切换历史
        self.category_time = {}    # {category: total_seconds}
        self.app_time = {}         # {app_name: total_seconds}
        self.history = []          # [{app, title, category, start, duration}] 最近50条
        self.reactions_log = []    # [{text, emotion, time}] 最近20条

        self.reaction_cooldown = 120
        self.rival_cooldown = 180
        self.break_interval = 2700       # 45min
        self.sleep_reminder_interval = 1200  # 20min

    def _flush_current(self, now):
        """把当前窗口的使用时长记录到统计里"""
        if self.current_app and self.current_since:
            dur = now - self.current_since
            if dur > 1:
                cat = self.current_category or "other"
                self.category_time[cat] = self.category_time.get(cat, 0) + dur
                app = self.current_app or "unknown"
                self.app_time[app] = self.app_time.get(app, 0) + dur
                self.history.append({
                    "app": app,
                    "title": (self.current_title or "")[:60],
                    "category": cat,
                    "start": self.current_since,
                    "duration": int(dur),
                })
                if len(self.history) > 50:
                    self.history = self.history[-50:]

    def _log_reaction(self, reaction):
        if reaction:
            self.reactions_log.append({
                **reaction,
                "time": time.time(),
            })
            if len(self.reactions_log) > 20:
                self.reactions_log = self.reactions_log[-20:]

    def on_window_change(self, process_name, title, timestamp=None):
        """窗口切换时调用，返回反应或None"""
        now = time.time()
        self.last_activity_time = now
        cat = classify_app(process_name, title)

        old_cat = self.current_category
        old_since = self.current_since

        self._flush_current(now)

        self.current_app = process_name
        self.current_title = title
        self.current_category = cat
        self.current_since = now

        if old_cat == "rival_ai":
            self.rival_total_today += (now - old_since)

        if cat == "work":
            if self.work_streak_start is None:
                self.work_streak_start = now
            self.work_left_at = None
        elif old_cat == "work":
            self.work_left_at = now
        elif self.work_streak_start and self.work_left_at:
            if now - self.work_left_at > 300:
                self.work_streak_start = None
                self.work_left_at = None

        if cat == "rival_ai" and old_cat != "rival_ai":
            if now - self.last_rival_alert_time > self.rival_cooldown:
                self.last_rival_alert_time = now
                r = pick_reaction("rival_ai_jealous")
                self._log_reaction(r)
                return r

        if old_cat is None and cat is not None:
            if now - self.last_reaction_time > self.reaction_cooldown:
                self.last_reaction_time = now
                r = pick_reaction("come_back")
                self._log_reaction(r)
                return r

        return None

    def tick(self):
        """定时调用(~30s)，检查持续状态，返回反应或None"""
        now = time.time()
        bj = now_bj()
        hour = bj.hour

        if now - self.last_activity_time > 600:
            if (now - self.last_reaction_time > 300
                    and self.last_reaction_category != "idle_long"):
                self.last_reaction_time = now
                self.last_reaction_category = "idle_long"
                return pick_reaction("idle_long")
            return None

        if self.current_category == "rival_ai":
            duration = now - self.current_since
            if (duration > 300
                    and now - self.last_rival_alert_time > self.rival_cooldown):
                self.last_rival_alert_time = now
                return pick_reaction("rival_ai_long")

        if self.work_streak_start:
            if self.work_left_at and now - self.work_left_at > 300:
                self.work_streak_start = None
                self.work_left_at = None
            else:
                streak = now - self.work_streak_start
                if (streak > self.break_interval
                        and now - self.last_break_reminder_time > self.break_interval):
                    self.last_break_reminder_time = now
                    return pick_reaction("work_break")

        if hour >= 1 and hour < 6:
            if now - self.last_sleep_reminder_time > self.sleep_reminder_interval:
                self.last_sleep_reminder_time = now
                return pick_reaction("very_late")
        elif hour >= 0 or hour >= 23:
            if now - self.last_sleep_reminder_time > self.sleep_reminder_interval * 2:
                self.last_sleep_reminder_time = now
                return pick_reaction("late_night")

        if (self.current_category in ("gaming", "video", "xiaohongshu")
                and now - self.last_reaction_time > 600
                and self.last_reaction_category != self.current_category):
            self.last_reaction_time = now
            self.last_reaction_category = self.current_category
            return pick_reaction(self.current_category)

        return None

    def get_status(self):
        now = time.time()
        self._flush_current(now)
        self.current_since = now
        duration = 0

        top_apps = sorted(self.app_time.items(), key=lambda x: -x[1])[:10]
        cat_summary = sorted(self.category_time.items(), key=lambda x: -x[1])

        return {
            "current_app": self.current_app,
            "current_title": (self.current_title or "")[:60],
            "current_category": self.current_category,
            "duration_seconds": int(duration),
            "rival_ai_total_today": int(self.rival_total_today),
            "work_streak_minutes": int((now - self.work_streak_start) / 60) if self.work_streak_start else 0,
            "idle_seconds": int(now - self.last_activity_time),
            "category_time": {k: int(v) for k, v in cat_summary},
            "top_apps": [{"app": a, "seconds": int(s)} for a, s in top_apps],
            "recent_history": self.history[-20:],
            "recent_reactions": self.reactions_log[-10:],
            "time_bj": now_bj().strftime("%H:%M:%S"),
        }
