// ==========================================================
// HomePage + AnimationPage
// ==========================================================

// ─── Home ───
const HomePage = ({ tweaks, setState, petState, relay }) => {
  const activities = relay && relay.activities && relay.activities.length > 0 ? relay.activities : [];

  return (
    <div className="page">
      <div className="panel page-main" style={{ width: "50px" }}>
        <h2 className="page-title">最近动态</h2>
        <div className="page-subtitle">{`${(window.__petConfig||{}).charName||'Pety'}偷偷干了些什么`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {activities.length > 0 ? activities.map((a, i) =>
          <div key={i} className="surface" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="label">{a.t}</div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{a.txt}</div>
            </div>
          ) : (
            <div className="surface" style={{ padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "var(--text-tertiary)" }}>{`等待${(window.__petConfig||{}).charName||'Pety'}上线...`}</div>
            </div>
          )}
        </div>
        <div className="view-more-link" style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, cursor: "pointer", transition: "color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--blue)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>查看更多 →</div>
        <div className="surface" style={{ background: "rgba(153,102,229,0.1)", marginTop: 8 }}>
          <div className="label">💭 心声</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            {relay && relay.thought ? relay.thought : "连接后显示"}
          </div>
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={240} hue={tweaks.petHue} state={petState} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>宠物预览 · 点击试试</div>
        <div className="surface" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>1. 宠物权限可自选，超字数轮播</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>2. 身体各部位点击反应可在「互动区域」配置</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>3. 思考动画会一缩一缩脉冲</div>
        </div>
      </div>
    </div>);

};

// ─── Animation Settings ───
const ANIM_TAGS = ["开心", "吃醋", "难过", "跑动", "睡觉", "发呆", "冷漠", "亲热", "眨眼", "求摸", "吵闹", "炸毛", "偷看", "看书", "戴墨镜", "写文件", "翻网页"];
const FORMS = [
{ id: "dog", name: "Q 版小狗", sub: "默认形态", active: true },
{ id: "anime", name: "二次元", sub: "Live 2D · 动漫画风" },
{ id: "3d", name: "伪 2D 立绘", sub: "3D 模型 · 未上传" }];


const AnimationPage = ({ tweaks, petState, selectedEmotion, setSelectedEmotion }) => {
  return (
    <div className="page">
      <div className="panel page-main">
        <h2 className="page-title" style={{ fontSize: 16 }}>情绪与动作</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ANIM_TAGS.map((t) =>
          <button key={t} className={`chip ${selectedEmotion === t ? "active" : ""}`} onClick={() => setSelectedEmotion(t)}>{t}</button>
          )}
          <button className="chip ghost">+ 自定义</button>
        </div>
        <div className="surface" style={{ marginTop: 8 }}>
          <div className="label">Live 2D 动作指令</div>
          <textarea className="textarea" style={{ marginTop: 10 }} placeholder={`告诉模型：当用户选择"${selectedEmotion || "开心"}"时，宠物该怎么做...`} defaultValue={selectedEmotion ? `当触发"${selectedEmotion}"时，模型应该让宠物…` : ""} />
        </div>
      </div>
      <div className="panel page-right">
        <div className="preview-frame">
          <Pet size={240} hue={tweaks.petHue} state={petState} />
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-tertiary)" }}>动画效果预览</div>
        <div className="surface">
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            1. 点击标签导入对应 gif/png 图片<br />
            2. 支持导入 Live 2D 文件<br />
            3. Live 2D 支持自定义动作和表情控制
          </div>
        </div>
      </div>
    </div>);

};

Object.assign(window, { HomePage, AnimationPage });
