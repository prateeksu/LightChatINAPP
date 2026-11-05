import { useEffect, useRef, useState } from "react";

export default function JoinDialog({ open, initialRoomId = "", onJoin, onClose }) {
  const dialogRef = useRef(null);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    if (open) setRoomId(initialRoomId);
  }, [open, initialRoomId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function submit(event) {
    event.preventDefault();
    onJoin({ roomId: roomId.trim(), passcode: passcode.trim() });
    setPasscode("");
  }

  return (
    <dialog className="schedule-dialog" id="join-dialog" ref={dialogRef} aria-labelledby="join-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit}>
        <div className="dialog-header"><div><p className="eyebrow">JOIN A MEETING</p><h2 id="join-dialog-title">Enter meeting details</h2></div><button className="dialog-close" onClick={onClose} type="button" aria-label="Close">×</button></div>
        <label className="field-label" htmlFor="join-meeting-id">Meeting ID</label>
        <input className="text-input" id="join-meeting-id" value={roomId} onChange={(event) => setRoomId(event.target.value)} autoComplete="off" placeholder="Paste the meeting ID" required />
        <label className="field-label" htmlFor="join-passcode">Passcode</label>
        <input className="text-input" id="join-passcode" value={passcode} onChange={(event) => setPasscode(event.target.value)} type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6-digit passcode" required />
        <div className="dialog-footer"><span className="dialog-note">The host must start the meeting first.</span><button className="schedule-button" type="submit">Join meeting <span aria-hidden="true">→</span></button></div>
      </form>
    </dialog>
  );
}