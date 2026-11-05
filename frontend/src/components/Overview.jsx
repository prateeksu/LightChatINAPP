import Avatar from "./Avatar.jsx";
import MeetingDate from "./MeetingDate.jsx";
import { formatDay, formatTime } from "../lib/meetings.js";

export default function Overview({ meetings, onJoin, onView, onStartCall, onSchedule, onCallPerson }) {
  const now = new Date();
  const upcoming = [...meetings].filter((meeting) => new Date(meeting.startsAt) >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).slice(0, 3);
  const hour = now.getHours();
  const greeting = hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";

  return (
    <section className="view-panel" aria-labelledby="page-title">
      <div className="page-heading">
        <div><p className="eyebrow">{greeting}, ALEX</p><h1 id="page-title">Make time for <em>good talks.</em></h1><p className="heading-subtitle">Your conversations, all in one place.</p></div>
        <button className="text-action" onClick={onStartCall} type="button"><span className="call-spark" aria-hidden="true">↗</span> Start an instant call</button>
      </div>
      <div className="overview-grid">
        <section className="call-banner" aria-label="Start a video call">
          <div className="call-banner-content">
            <span className="live-label"><span className="live-pulse" /> YOUR ROOM IS READY</span>
            <h2>One click from<br />a face-to-face.</h2>
            <p>Create a meeting ID and passcode, then share them with your guests.</p>
            <button className="banner-button" onClick={onStartCall} type="button">Start a video call <span aria-hidden="true">↗</span></button>
          </div>
          <div className="call-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sun" /><div className="art-person person-back"><span className="person-head" /><span className="person-body" /></div><div className="art-person person-front"><span className="person-head" /><span className="person-body" /></div><div className="art-caption">BETTER TOGETHER, EVEN FROM HERE</div></div>
        </section>
        <section className="up-next-section" aria-labelledby="up-next-title">
          <div className="section-heading"><div><p className="eyebrow">ON YOUR CALENDAR</p><h2 id="up-next-title">Coming up</h2></div><button className="link-button" onClick={() => onView("schedule")} type="button">See schedule <span aria-hidden="true">→</span></button></div>
          {upcoming.length > 0 ? <div className="meeting-list">{upcoming.map((meeting) => {
            const date = new Date(meeting.startsAt);
            return <article className="meeting-card" key={meeting.id}><MeetingDate date={date} /><div className="meeting-copy"><strong>{meeting.title}</strong><small>{meeting.person} · {formatDay(date)}, {formatTime(date)}</small></div><button className="join-button" onClick={() => onJoin(meeting)} type="button">Join</button></article>;
          })}</div> : <div className="empty-state"><span className="empty-mark">＋</span><p>No chats lined up yet.</p><button className="link-button" onClick={onSchedule} type="button">Plan your first one →</button></div>}
        </section>
        <section className="people-strip" aria-labelledby="people-title">
          <div className="section-heading compact-heading"><div><p className="eyebrow">YOUR PEOPLE</p><h2 id="people-title">Good to see you</h2></div><button className="link-button" onClick={() => onView("contacts")} type="button">All people <span aria-hidden="true">→</span></button></div>
          <div className="people-list">{["Sam Rivera", "Jamie Chen", "Nina Patel", "Theo Brooks"].map((name) => <button className="person-chip" key={name} onClick={() => onCallPerson(name)} type="button"><Avatar name={name} /><span>{name.split(" ")[0]}</span></button>)}</div>
        </section>
        <aside className="note-panel"><span className="note-symbol">✳</span><p>Some conversations are better when you just show up.</p><button className="note-link" onClick={onStartCall} type="button">Open & share a room <span aria-hidden="true">↗</span></button></aside>
      </div>
    </section>
  );
}