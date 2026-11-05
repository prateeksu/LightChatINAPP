export default function MeetingDate({ date }) {
  return <span className="date-tile"><strong>{date.getDate()}</strong><small>{new Intl.DateTimeFormat(undefined, { month: "short" }).format(date)}</small></span>;
}