import Avatar from "./Avatar.jsx";
import MeetingDate from "./MeetingDate.jsx";
import { formatDay, formatTime } from "../lib/meetings.js";

export default function ScheduleView({ meetings, filter, onFilter, onJoin, onCopy, onSchedule }) {
    const now = new Date();
    const items = [...meetings].filter((meeting) => filter === "upcoming" ? new Date(meeting.startsAt) >= now : new Date(meeting.startsAt) < now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return (
        <section className="view-panel secondary-view" aria-labelledby="schedule-title">
            <div className="page-heading secondary-heading"><div><p className="eyebrow">MAKE ROOM FOR EACH OTHER</p><h1 id="schedule-title">Your <em>schedule.</em></h1><p className="heading-subtitle">A little planning makes the best conversations happen.</p></div><button className="schedule-button" onClick={onSchedule} type="button"><span aria-hidden="true">＋</span> Schedule a chat</button></div>
            <div className="schedule-toolbar"><div className="filter-tabs" role="group" aria-label="Filter meetings"><button className={`filter-tab ${filter === "upcoming" ? "is-selected" : ""}`} onClick={() => onFilter("upcoming")} type="button">Upcoming</button><button className={`filter-tab ${filter === "past" ? "is-selected" : ""}`} onClick={() => onFilter("past")} type="button">Past</button></div><span className="schedule-meta">{items.length} {items.length === 1 ? "chat" : "chats"}</span></div>
            {items.length > 0 ? <div className="full-meeting-list">{items.map((meeting) => {
                const date = new Date(meeting.startsAt);
                return <article className="full-meeting" key={meeting.id}><MeetingDate date={date} /><div className="meeting-copy"><strong>{meeting.title}</strong><small>{meeting.duration} min · Video chat</small></div><div className="attendee"><Avatar name={meeting.person} /><span>{meeting.person}</span></div><div className="meeting-actions"><span className="meeting-time">{formatDay(date)}<small>{formatTime(date)}</small></span>{filter === "upcoming" && <><button className="join-button" onClick={() => onJoin(meeting)} type="button">Join room</button><button className="copy-button" onClick={() => onCopy(meeting)} type="button" title="Copy meeting ID and passcode" aria-label="Copy meeting invite details">↗</button></>}</div></article>;
            })}</div> : <div className="schedule-empty"><span aria-hidden="true">☼</span><h2>{filter === "upcoming" ? "Nothing on the calendar." : "No past chats yet."}</h2><p>{filter === "upcoming" ? "Make a little time for someone you like." : "Your past conversations will find a home here."}</p>{filter === "upcoming" && <button className="schedule-button" onClick={onSchedule} type="button">＋ Schedule a chat</button>}</div>}
        </section>
    );
}