// ==========================================================
// Sidebar + Icons
// ==========================================================

const NAV = [
{ id: "home", label: "启动", icon: "home" },
{ id: "monitor", label: "偷看后台", icon: "eye" },
{ id: "chat", label: "对话记录", icon: "chat" },
{ id: "area", label: "限制区域", icon: "grid" },
{ id: "touch", label: "互动区域", icon: "hand" },
{ id: "form", label: "切换形态", icon: "layers" },
{ id: "diary", label: "日记", icon: "book" },
{ id: "memory", label: "记忆库", icon: "brain" },
{ id: "settings", label: "设置", icon: "gear" }];


const Icon = ({ name }) => {
  const s = { width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":return <svg {...s} viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>;
    case "spark":return <svg {...s} viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" /></svg>;
    case "eye":return <svg {...s} viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "chat":return <svg {...s} viewBox="0 0 24 24"><path d="M3 5h18v12H7l-4 4z" /></svg>;
    case "grid":return <svg {...s} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>;
    case "hand":return <svg {...s} viewBox="0 0 24 24"><path d="M7 11V6a1.5 1.5 0 013 0v4m0-2.5a1.5 1.5 0 013 0V10m0-1a1.5 1.5 0 013 0v6a6 6 0 01-12 0v-4" /></svg>;
    case "layers":return <svg {...s} viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" /></svg>;
    case "book":return <svg {...s} viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /><path d="M8 7h8M8 11h6" /></svg>;
    case "mic":return <svg {...s} viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0014 0v-1M12 19v3" /></svg>;
    case "send":return <svg {...s} viewBox="0 0 24 24"><path d="M3 12l18-9-7 18-3-7-8-2z" /></svg>;
    case "x":return <svg {...s} viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "plus":return <svg {...s} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
    case "paperclip":return <svg {...s} viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.5 3.5 0 014.95 4.95l-8.48 8.49a1.5 1.5 0 01-2.12-2.12l7.07-7.07" /></svg>;
    case "brain":return <svg {...s} viewBox="0 0 24 24"><path d="M12 2a7 7 0 00-5.6 11.2L12 20l5.6-6.8A7 7 0 0012 2z" /><circle cx="12" cy="9" r="2" /></svg>;
    case "gear":return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
    default:return null;
  }
};

const Sidebar = ({ active, onNav, petMood, connected = false, online = false }) => {
  const winClose = () => { if (window.electronAPI) window.electronAPI.close(); else window.close(); };
  const winMin = () => { if (window.electronAPI) window.electronAPI.minimize(); };
  return (
    <div className="panel panel-sidebar sidebar">
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="sidebar-logo-dot"></span>
          <span>Pety</span>
        </div>
        <div style={{ display: 'flex', gap: 4, WebkitAppRegion: 'no-drag' }}>
          <div onClick={winMin} style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(242,191,77,0.7)', cursor: 'pointer', WebkitAppRegion: 'no-drag' }} title="最小化"></div>
          <div onClick={winClose} style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(229,64,64,0.7)', cursor: 'pointer', WebkitAppRegion: 'no-drag' }} title="关闭"></div>
        </div>
      </div>
      {NAV.map((n) =>
      <div key={n.id} className={`nav-item ${active === n.id ? "active" : ""}`} onClick={() => onNav(n.id)}>
          <Icon name={n.icon} />
          <span>{n.label}</span>
        </div>
      )}
      <div className="sidebar-status">
        <div className="status-chip"><span className={`status-dot ${online ? "green" : connected ? "orange" : "red"}`}></span>{online ? `${(window.__petConfig||{}).charName||'Pety'}在线` : connected ? "等待连接" : "离线"}</div>
        <div className="status-chip"><span className="status-dot orange"></span>{petMood || "心情愉悦"}</div>
      </div>
    </div>);

};

Object.assign(window, { Sidebar, Icon, NAV });