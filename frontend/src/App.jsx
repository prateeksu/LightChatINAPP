import { useEffect, useMemo, useState } from "react";
import CallDialog from "./components/CallDialog.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import ContactsView from "./components/ContactsView.jsx";
import JoinDialog from "./components/JoinDialog.jsx";
import Overview from "./components/Overview.jsx";
import ScheduleDialog from "./components/ScheduleDialog.jsx";
import ScheduleView from "./components/ScheduleView.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import { readMeetings, saveMeetings } from "./lib/meetings.js";
import { useAuth } from "./hooks/useAuth.js";
import { useDirectMessages } from "./hooks/useDirectMessages.js";
import { useMeetingCall } from "./hooks/useMeetingCall.js";
import { apiUrl } from "./lib/api.js";
import "./styles.css";

const titles = { overview: "Overview", schedule: "Schedule", contacts: "People" };

export default function App() {
  const initialRoomId = new URLSearchParams(window.location.search).get("room") || "";
  const auth = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [meetingOwnerId, setMeetingOwnerId] = useState(null);
  const [view, setView] = useState(["overview", "schedule", "contacts"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview");
  const [filter, setFilter] = useState("upcoming");
  const [joinOpen, setJoinOpen] = useState(Boolean(initialRoomId));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toast, setToast] = useState("");
  const { call, startCall, endCall, toggleTrack } = useMeetingCall();
  const directMessages = useDirectMessages(auth.user);
  const upcomingCount = useMemo(() => meetings.filter((meeting) => new Date(meeting.startsAt) >= new Date()).length, [meetings]);

  useEffect(() => {
    if (!auth.user) {
      setMeetings([]);
      setMeetingOwnerId(null);
      return;
    }
    setMeetings(readMeetings(auth.user.id));
    setMeetingOwnerId(auth.user.id);
  }, [auth.user?.id]);
  useEffect(() => {
    if (auth.user?.id && meetingOwnerId === auth.user.id) saveMeetings(meetings, auth.user.id);
  }, [auth.user?.id, meetingOwnerId, meetings]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(message) {
    setToast(message);
  }

  function changeView(nextView) {
    setView(nextView);
    window.location.hash = nextView;
  }

  async function shareInvite(roomId, passcode, personName = "") {
    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.set("room", roomId);
    const inviteText = `${personName ? `Join me for a video call, ${personName}.` : "Join my LightChat meeting."}\nMeeting ID: ${roomId}\nPasscode: ${passcode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "LightChat video call", text: inviteText, url: inviteUrl.toString() });
        showToast("Meeting invite shared.");
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(`${inviteText}\nJoin: ${inviteUrl}`);
      showToast("Meeting ID, passcode, and link copied.");
    } catch (error) {
      if (error.name === "AbortError") return;
      window.prompt("Copy these meeting details:", `${inviteText}\nJoin: ${inviteUrl}`);
    }
  }

  async function startHostMeeting(person = "") {
    const conversation = typeof person === "object" ? person : null;
    const isGroup = conversation?.type === "group";
    const recipient = conversation && !isGroup ? conversation : null;
    const personName = conversation?.name || person || "";
    const meetingBody = recipient
      ? { recipientId: recipient.id }
      : isGroup
        ? { recipientIds: conversation.members.filter((member) => member.id !== auth.user.id).map((member) => member.id) }
        : null;
    try {
      const response = await fetch(apiUrl("/api/meetings"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meetingBody || {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create meeting.");
      startCall({ roomId: result.roomId, passcode: result.passcode, personName, isHost: true });
      if (conversation) {
        const inviteUrl = new URL(window.location.href);
        inviteUrl.searchParams.set("room", result.roomId);
        const logged = await directMessages.logCallEvent({ roomId: result.roomId, passcode: result.passcode, url: inviteUrl.toString() });
        if (!logged.ok) showToast(logged.error || "Call started, but its event could not be added to chat.");
      } else {
        shareInvite(result.roomId, result.passcode, personName);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  function joinMeeting({ roomId, passcode }) {
    setJoinOpen(false);
    startCall({ roomId, passcode, isHost: false });
  }

  async function createMeeting(data) {
    const [year, month, day] = data.date.split("-").map(Number);
    const [hour, minute] = data.time.split(":").map(Number);
    const startsAt = new Date(year, month - 1, day, hour, minute);
    if (startsAt <= new Date()) {
      showToast("Choose a time in the future to schedule your chat.");
      return false;
    }
    try {
      const response = await fetch(apiUrl("/api/meetings"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const meeting = await response.json();
      if (!response.ok) throw new Error(meeting.error || "Could not create meeting.");
      setMeetings((current) => [...current, {
      id: crypto.randomUUID(),
      title: data.title.trim(),
      person: data.person.trim(),
      startsAt: startsAt.toISOString(),
      duration: Number(data.duration),
      roomId: meeting.roomId,
      passcode: meeting.passcode,
      }]);
      setScheduleOpen(false);
      setView("schedule");
      window.location.hash = "schedule";
      showToast("Your chat is on the calendar.");
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  }

  function copyInvite(meeting) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", meeting.roomId);
    const text = `Meeting ID: ${meeting.roomId}\nPasscode: ${meeting.passcode}\nJoin: ${url}`;
    if (!navigator.clipboard?.writeText) {
      window.prompt("Copy these meeting details:", text);
      return;
    }
    navigator.clipboard.writeText(text).then(() => showToast("Meeting invite details copied."))
      .catch(() => window.prompt("Copy these meeting details:", text));
  }

  function joinScheduledMeeting(meeting) {
    startCall({ roomId: meeting.roomId, passcode: meeting.passcode, personName: meeting.person, isHost: true });
  }

  function joinCallEvent(message) {
    startCall({ roomId: message.roomId, passcode: message.passcode, personName: message.sender?.name || "", isHost: false });
  }

  async function signOut() {
    endCall();
    await auth.logout();
  }

  if (auth.loading) return <main className="auth-loading" aria-live="polite">Loading your LightChat session…</main>;
  if (!auth.user) return <AuthScreen onLogin={auth.login} onRegister={auth.register} />;

  return (
    <div className="app-shell">
      <Sidebar view={view} upcomingCount={upcomingCount} user={auth.user} onChange={changeView} onLogout={signOut} />
      <main className="main-area">
        <Topbar title={titles[view]} onJoin={() => setJoinOpen(true)} onSchedule={() => setScheduleOpen(true)} onSearch={() => changeView("contacts")} />
        {view === "overview" && <Overview meetings={meetings} onJoin={joinScheduledMeeting} onView={changeView} onStartCall={() => startHostMeeting()} onSchedule={() => setScheduleOpen(true)} onCallPerson={startHostMeeting} />}
        {view === "schedule" && <ScheduleView meetings={meetings} filter={filter} onFilter={setFilter} onJoin={joinScheduledMeeting} onCopy={copyInvite} onSchedule={() => setScheduleOpen(true)} />}
        {view === "contacts" && <ContactsView
          people={directMessages.people}
          conversations={directMessages.conversations}
          activeConversation={directMessages.activeConversation}
          messages={directMessages.messages}
          currentUser={auth.user}
          error={directMessages.error}
          onSelect={directMessages.selectConversation}
          onCreateGroup={directMessages.createGroup}
          onSend={directMessages.sendText}
          onCall={startHostMeeting}
          onJoinCall={joinCallEvent}
        />}
        <footer className="app-footer"><span>LIGHTCHAT</span><span>Make time for each other.</span></footer>
      </main>
      <JoinDialog open={joinOpen} initialRoomId={initialRoomId} onJoin={joinMeeting} onClose={() => setJoinOpen(false)} />
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSave={createMeeting} />
      <CallDialog call={call} onEnd={endCall} onCopyInvite={() => call && copyInvite(call)} onToggleTrack={toggleTrack} />
      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}