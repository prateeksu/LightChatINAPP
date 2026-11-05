import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";

function StreamVideo({ stream, muted = false, mirror = false }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted={muted} className={mirror ? "is-mirrored" : ""} />;
}

export default function CallDialog({ call, onEnd, onCopyInvite, onToggleTrack }) {
  const dialogRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (call && !dialog.open) dialog.showModal();
    if (!call && dialog.open) dialog.close();
  }, [call]);

  useEffect(() => {
    setMuted(false);
    setCameraOff(false);
  }, [call?.roomId]);

  function toggle(kind) {
    const enabled = onToggleTrack(kind);
    if (enabled === null) return;
    if (kind === "audio") setMuted(!enabled);
    else setCameraOff(!enabled);
  }

  return (
    <dialog className="call-dialog" id="call-dialog" ref={dialogRef} aria-labelledby="call-title" onCancel={(event) => { event.preventDefault(); onEnd(); }} onClick={(event) => { if (event.target === event.currentTarget) onEnd(); }}>
      {call && <>
        <header className="call-header">
          <div>
            <p className="eyebrow">LIGHTCHAT VIDEO CALL</p>
            <h2 id="call-title">{call.personName ? `Call with ${call.personName}` : "Video call"}</h2>
            <p role="status" aria-live="polite">{call.status}</p>
            <small className="call-count">{call.participantCount} / {call.maxParticipants} participants</small>
          </div>
          <button className="dialog-close" onClick={onEnd} type="button" aria-label="End call">×</button>
        </header>
        {call.isHost && <div className="meeting-credentials">
          <div><small>MEETING ID</small><strong>{call.roomId}</strong></div>
          <div><small>PASSCODE</small><strong>{call.passcode}</strong></div>
        </div>}
        <div className="call-stage">
          <div className="remote-participants" data-count={call.remoteParticipants.length}>
            {call.remoteParticipants.map((participant) => (
              <figure className="remote-tile" key={participant.peerId}>
                <StreamVideo stream={participant.stream} />
                <figcaption>{participant.role}</figcaption>
              </figure>
            ))}
          </div>
          {call.remoteParticipants.length === 0 && <div className="call-placeholder"><span aria-hidden="true">◌</span><strong>{call.status.includes("Waiting") ? "Waiting for invitees" : "Connecting to meeting"}</strong><small>Share the meeting ID and passcode with up to three guests.</small></div>}
          {call.localStream && <div className="local-preview"><StreamVideo stream={call.localStream} muted mirror /><span>You</span></div>}
        </div>
        <div className="call-controls">
          <button className="call-control" onClick={() => toggle("audio")} type="button" aria-pressed={muted}>{muted ? "Unmute microphone" : "Mute microphone"}</button>
          <button className="call-control" onClick={() => toggle("video")} type="button" aria-pressed={cameraOff}>{cameraOff ? "Turn camera on" : "Turn camera off"}</button>
          <button className="call-control invite-control" onClick={onCopyInvite} type="button">Copy invite details</button>
          <button className="call-control end-control" onClick={onEnd} type="button">End call</button>
        </div>
      </>}
    </dialog>
  );
}