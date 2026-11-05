import { useEffect, useRef, useState } from "react";

function getDefaultDateTime() {
  const date = new Date();
  const roundedMinutes = Math.ceil((date.getMinutes() + 1) / 15) * 15;
  date.setMinutes(roundedMinutes, 0, 0);
  if (roundedMinutes >= 60) date.setHours(date.getHours() + 1);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  return { date: localDate.slice(0, 10), time: localDate.slice(11, 16) };
}

export default function ScheduleDialog({ open, onClose, onSave }) {
  const dialogRef = useRef(null);
  const [dateTime, setDateTime] = useState(getDefaultDateTime);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      setDateTime(getDefaultDateTime());
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (await onSave(data)) event.currentTarget.reset();
  }

  return (
    <dialog className="schedule-dialog" ref={dialogRef} aria-labelledby="schedule-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit}>
        <div className="dialog-header"><div><p className="eyebrow">MAKE A LITTLE TIME</p><h2 id="schedule-dialog-title">Schedule a chat</h2></div><button className="dialog-close" onClick={onClose} type="button" aria-label="Close">×</button></div>
        <label className="field-label" htmlFor="meeting-title">What are you catching up about?</label>
        <input className="text-input" id="meeting-title" name="title" placeholder="A proper catch-up" maxLength={72} required />
        <label className="field-label" htmlFor="meeting-person">Who are you meeting?</label>
        <input className="text-input" id="meeting-person" name="person" placeholder="Name" maxLength={48} required />
        <div className="field-row">
          <div className="field-column"><label className="field-label" htmlFor="meeting-date">Date</label><input className="text-input" id="meeting-date" name="date" type="date" min={getDefaultDateTime().date} value={dateTime.date} onChange={(event) => setDateTime({ ...dateTime, date: event.target.value })} required /></div>
          <div className="field-column"><label className="field-label" htmlFor="meeting-time">Time</label><input className="text-input" id="meeting-time" name="time" type="time" value={dateTime.time} onChange={(event) => setDateTime({ ...dateTime, time: event.target.value })} required /></div>
        </div>
        <label className="field-label" htmlFor="meeting-duration">How long?</label>
        <select className="text-input" id="meeting-duration" name="duration"><option value="15">15 minutes</option><option value="30" defaultValue="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option></select>
        <div className="dialog-footer"><span className="dialog-note">A dedicated video room and passcode are included.</span><button className="schedule-button" type="submit">Save chat <span aria-hidden="true">→</span></button></div>
      </form>
    </dialog>
  );
}