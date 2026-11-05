import Avatar from "./Avatar.jsx";

const items = [
  { id: "overview", icon: "◫", label: "Overview" },
  { id: "schedule", icon: "▦", label: "Schedule" },
  { id: "contacts", icon: "◉", label: "People" },
];

export default function Sidebar({ view, upcomingCount, user, onChange, onLogout }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <a className="brand" href="#overview" aria-label="LightChat home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span>lightchat</span>
      </a>
      <div className="workspace-label">YOUR SPACE</div>
      <nav className="primary-nav">
        {items.map((item) => (
          <button key={item.id} className={`nav-item ${view === item.id ? "is-active" : ""}`} onClick={() => onChange(item.id)} type="button">
            <span className="nav-icon">{item.icon}</span>{item.label}
            {item.id === "schedule" && <span className="nav-count">{upcomingCount}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="availability"><span className="online-dot" /><span>You're available</span><span className="availability-chevron">⌄</span></div>
        <div className="profile-button">
          <Avatar name={user.name} className="avatar-you" />
          <span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span>
        </div>
        <button className="logout-button" onClick={onLogout} type="button">Sign out <span aria-hidden="true">↗</span></button>
      </div>
    </aside>
  );
}