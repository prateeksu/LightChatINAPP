import { useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL, apiUrl } from "../lib/api.js";

function makeSnapshot(record) {
  return {
    roomId: record.roomId,
    passcode: record.passcode,
    personName: record.personName,
    isHost: record.isHost,
    role: record.role,
    status: record.status,
    participantCount: record.participantCount,
    maxParticipants: record.maxParticipants,
    localStream: record.localStream,
    remoteParticipants: [...record.peers].map(([peerId, peer]) => ({
      peerId,
      role: peerId === record.hostId ? "Host" : peer.name || "Invitee",
      stream: peer.stream,
    })),
  };
}

export function useMeetingCall() {
  const [call, setCall] = useState(null);
  const currentCall = useRef(null);

  function publish(record) {
    if (currentCall.current === record) setCall(makeSnapshot(record));
  }

  function setStatus(record, status) {
    record.status = status;
    publish(record);
  }

  function sendSignal(record, target, data) {
    record.socket?.emit("meeting:signal", { target, data }, (result) => {
      if (!result?.ok && currentCall.current === record) setStatus(record, result?.error || "Could not send signaling data.");
    });
  }

  function addPeer(record, peerId, user = {}) {
    if (record.peers.has(peerId)) return record.peers.get(peerId).connection;
    const connection = new RTCPeerConnection({ iceServers: record.iceServers });
    const peer = { connection, pendingCandidates: [], stream: new MediaStream(), name: user.name || "Invitee" };
    record.peers.set(peerId, peer);
    record.localStream.getTracks().forEach((track) => connection.addTrack(track, record.localStream));
    connection.onicecandidate = (event) => {
      if (event.candidate) sendSignal(record, peerId, { candidate: event.candidate.toJSON() });
    };
    connection.ontrack = (event) => {
      if (event.streams[0]) peer.stream = event.streams[0];
      else if (!peer.stream.getTracks().some((track) => track.id === event.track.id)) peer.stream.addTrack(event.track);
      record.connectedPeers.add(peerId);
      setStatus(record, `${record.connectedPeers.size} participant${record.connectedPeers.size === 1 ? "" : "s"} connected.`);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "connected") {
        record.connectedPeers.add(peerId);
        setStatus(record, `${record.connectedPeers.size} participant${record.connectedPeers.size === 1 ? "" : "s"} connected.`);
      } else if (connection.connectionState === "failed") {
        setStatus(record, "Direct connection failed. Configure a TURN relay and retry.");
      }
    };
    publish(record);
    return connection;
  }

  function updateParticipantStatus(record) {
    if (record.connectedPeers.size > 0) {
      setStatus(record, `${record.connectedPeers.size} participant${record.connectedPeers.size === 1 ? "" : "s"} connected.`);
    } else if (record.role === "host") {
      setStatus(record, "You're hosting · Waiting for invitees…");
    } else {
      setStatus(record, "Joined · Waiting for other participants…");
    }
  }

  async function processMessage(record, message) {
    if (currentCall.current !== record || record.closed) return;
    if (!record.ready) {
      record.pendingMessages.push(message);
      return;
    }

    if (message.type === "peer-joined") {
      record.participantCount = message.participantCount;
      const connection = addPeer(record, message.peerId, message.user);
      updateParticipantStatus(record);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      sendSignal(record, message.peerId, { description: connection.localDescription.toJSON() });
      return;
    }

    if (message.type === "signal") {
      const connection = record.peers.get(message.from)?.connection || addPeer(record, message.from, message.user);
      const peer = record.peers.get(message.from);
      if (message.data.description) {
        await connection.setRemoteDescription(message.data.description);
        for (const candidate of peer.pendingCandidates.splice(0)) await connection.addIceCandidate(candidate);
        if (message.data.description.type === "offer") {
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          sendSignal(record, message.from, { description: connection.localDescription.toJSON() });
        }
      }
      if (message.data.candidate) {
        if (connection.remoteDescription) await connection.addIceCandidate(message.data.candidate);
        else peer.pendingCandidates.push(message.data.candidate);
      }
      return;
    }

    if (message.type === "peer-left") {
      record.participantCount = message.participantCount;
      record.peers.get(message.peerId)?.connection.close();
      record.peers.delete(message.peerId);
      record.connectedPeers.delete(message.peerId);
      updateParticipantStatus(record);
      return;
    }

    if (message.type === "presence") {
      record.participantCount = message.participantCount;
      publish(record);
      return;
    }

    if (message.type === "chat-message") {
      record.messages.push(message);
      publish(record);
    }
  }

  async function onRoomJoined(record, result) {
    if (currentCall.current !== record || record.closed) return;
    if (!result?.ok) {
      record.rejected = true;
      setStatus(record, result?.error || "Could not join this meeting.");
      return;
    }

    record.selfPeerId = result.peerId;
    record.hostId = result.isHost ? result.peerId : result.peers[0];
    record.role = result.isHost ? "host" : "guest";
    record.participantCount = result.participantCount;
    record.maxParticipants = result.maxParticipants;
    setStatus(record, "Meeting verified. Allow camera and microphone access.");
    try {
      record.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } },
      });
    } catch (error) {
      record.rejected = true;
      setStatus(record, error.name === "NotAllowedError" ? "Camera or microphone permission was denied." : "Could not access a camera and microphone.");
      record.socket.emit("meeting:leave");
      return;
    }

    if (currentCall.current !== record) {
      record.localStream.getTracks().forEach((track) => track.stop());
      return;
    }
    record.ready = true;
    for (const peerId of result.peers) addPeer(record, peerId, peerId === result.peers[0] && !result.isHost ? { name: result.hostName } : {});
    updateParticipantStatus(record);
    for (const queued of record.pendingMessages.splice(0)) await processMessage(record, queued);
  }

  function endCall() {
    const record = currentCall.current;
    currentCall.current = null;
    if (record) {
      record.closed = true;
      record.socket?.emit("meeting:leave");
      record.socket?.disconnect();
      record.peers.forEach((peer) => peer.connection.close());
      record.localStream?.getTracks().forEach((track) => track.stop());
    }
    setCall(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState(null, "", url);
  }

  async function startCall({ roomId, passcode, personName = "", isHost = false }) {
    endCall();
    const record = {
      roomId,
      passcode,
      personName,
      isHost,
      role: isHost ? "host" : "guest",
      status: "Checking meeting ID and passcode…",
      participantCount: 1,
      maxParticipants: 4,
      hostId: null,
      selfPeerId: null,
      peers: new Map(),
      connectedPeers: new Set(),
      pendingMessages: [],
      messages: [],
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      localStream: null,
      socket: null,
      ready: false,
      closed: false,
      rejected: false,
    };
    currentCall.current = record;
    publish(record);

    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setStatus(record, "Use a current browser over localhost or HTTPS to join calls.");
      return;
    }

    try {
      const validation = await fetch(apiUrl(`/api/meetings/${encodeURIComponent(roomId)}/validate`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = await validation.json();
      if (!validation.ok) {
        record.rejected = true;
        setStatus(record, result.error || "Meeting validation failed.");
        return;
      }
      if (currentCall.current !== record) return;

      const iceResponse = await fetch(apiUrl("/api/ice-config"), { credentials: "include" });
      if (iceResponse.ok) {
        const iceConfig = await iceResponse.json();
        record.iceServers = iceConfig.iceServers || record.iceServers;
      }

      record.socket = io(API_BASE_URL, { withCredentials: true, reconnection: false });
      record.socket.on("connect_error", (error) => {
        if (currentCall.current === record) setStatus(record, error.message || "Could not connect to meeting signaling.");
      });
      record.socket.on("meeting:peer-joined", (message) => {
        processMessage(record, { type: "peer-joined", ...message }).catch((error) => {
          console.error("Could not negotiate a peer connection.", error);
          setStatus(record, "Could not establish the peer connection.");
        });
      });
      record.socket.on("meeting:signal", (message) => {
        processMessage(record, { type: "signal", ...message }).catch((error) => {
          console.error("Could not process WebRTC signaling.", error);
          setStatus(record, "Could not process connection details.");
        });
      });
      record.socket.on("meeting:peer-left", (message) => processMessage(record, { type: "peer-left", ...message }));
      record.socket.on("meeting:presence", (message) => processMessage(record, { type: "presence", ...message }));
      record.socket.on("meeting:chat-message", (message) => processMessage(record, { type: "chat-message", ...message }));
      record.socket.on("connect", () => {
        record.socket.emit("meeting:join", { roomId, passcode }, (joined) => {
          onRoomJoined(record, joined).catch((error) => {
            console.error("Could not initialize meeting media.", error);
            setStatus(record, "Could not initialize camera and microphone.");
          });
        });
      });
    } catch (error) {
      record.rejected = true;
      setStatus(record, error.message || "Could not validate this meeting.");
    }
  }

  function toggleTrack(kind) {
    const tracks = kind === "audio" ? currentCall.current?.localStream?.getAudioTracks() : currentCall.current?.localStream?.getVideoTracks();
    if (!tracks?.[0]) return false;
    tracks[0].enabled = !tracks[0].enabled;
    return tracks[0].enabled;
  }

  function sendChat(text) {
    return new Promise((resolve) => {
      if (!currentCall.current?.socket?.connected) return resolve({ ok: false, error: "Not connected to a meeting." });
      currentCall.current.socket.emit("meeting:chat", { text }, resolve);
    });
  }

  return { call, startCall, endCall, toggleTrack, sendChat };
}
