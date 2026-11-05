export default function Topbar({ title, onJoin, onSchedule, onSearch }) {
  const today = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date());
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>My workspace</span><span className="breadcrumb-slash">/</span><strong>{title}</strong></div>
      <div className="topbar-actions">
        <div className="today-label">{today}</div>
        <button className="icon-button" onClick={onSearch} type="button" aria-label="Search people and meetings" title="Search">⌕</button>
        <button className="join-meeting-button" onClick={onJoin} type="button" aria-label="Join a meeting by ID">Join</button>
        <button className="schedule-button" onClick={onSchedule} type="button"><span aria-hidden="true">＋</span> Schedule a chat</button>
      </div>
    </header>
  );
}