import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";

function messageTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function ContactsView({ people, conversations, activeConversation, messages, currentUser, error, onSelect, onCreateGroup, onSend, onCall, onJoinCall }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileShowingChat, setMobileShowingChat] = useState(Boolean(activeConversation));
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [groupError, setGroupError] = useState("");
  const messageEndRef = useRef(null);
  const filteredConversations = conversations.filter((conversation) => {
    const searchable = conversation.type === "group"
      ? `${conversation.name} ${conversation.members.map((member) => member.name).join(" ")}`
      : `${conversation.name} ${conversation.email}`;
    return searchable.toLowerCase().includes(query.toLowerCase());
  });

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeConversation?.key]);

  function selectConversation(conversation) {
    onSelect(conversation);
    setMobileShowingChat(true);
  }

  function toggleGroupMember(personId) {
    setSelectedMemberIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId)
      : current.length < 3 ? [...current, personId] : current);
  }

  async function submitGroup(event) {
    event.preventDefault();
    setGroupError("");
    try {
      await onCreateGroup(groupName, selectedMemberIds);
      setCreatingGroup(false);
      setGroupName("");
      setSelectedMemberIds([]);
      setMobileShowingChat(true);
    } catch (createError) {
      setGroupError(createError.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const result = await onSend(text);
    if (result?.ok) setDraft("");
    setSending(false);
  }

  return (
    <section className={`people-chat-workspace ${mobileShowingChat ? "mobile-chat-open" : ""}`} aria-label="People and messages">
      <aside className="people-list-pane" aria-label="People list">
        <div className="people-pane-heading"><div><p className="eyebrow">YOUR PEOPLE</p><h1>Messages</h1></div><button className="new-group-button" onClick={() => setCreatingGroup(true)} type="button" title="Create group chat" aria-label="Create group chat">＋</button></div>
        <label className="people-search"><span aria-hidden="true">⌕</span><input aria-label="Search people" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find someone" /></label>
        <div className="people-list-scroll">
          {filteredConversations.map((conversation) => (
            <button className={`conversation-person ${activeConversation?.key === conversation.key ? "is-selected" : ""}`} key={conversation.key} onClick={() => selectConversation(conversation)} type="button">
              {conversation.type === "group" ? <span className="group-avatar" aria-hidden="true">{conversation.members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.name} />)}</span> : <Avatar name={conversation.name} />}
              <span className="conversation-person-copy"><strong>{conversation.name}</strong><small>{conversation.type === "group" ? `${conversation.members.length} people · Group chat` : conversation.email}</small></span>
              {conversation.type === "direct" && <span className="person-online-dot" aria-label="Available" />}
            </button>
          ))}
          {filteredConversations.length === 0 && <p className="people-list-empty">{conversations.length ? "No conversations match that search." : "No other accounts yet. Add another account to start a conversation."}</p>}
        </div>
      </aside>

      <section className="conversation-pane" aria-label={activeConversation ? `Conversation with ${activeConversation.name}` : "Conversation"}>
        {activeConversation ? <>
          <header className="conversation-header">
            <button className="back-to-people" onClick={() => setMobileShowingChat(false)} type="button" aria-label="Back to people">←</button>
            {activeConversation.type === "group" ? <span className="group-avatar group-header-avatar" aria-hidden="true">{activeConversation.members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.name} />)}</span> : <Avatar name={activeConversation.name} />}
            <div className="conversation-header-copy"><strong>{activeConversation.name}</strong><small>{activeConversation.type === "group" ? activeConversation.members.map((member) => member.name).join(", ") : activeConversation.email}</small></div>
            <button className="conversation-call-button" onClick={() => onCall(activeConversation)} type="button" aria-label={`Start video call with ${activeConversation.name}`} title="Start video call">▣</button>
          </header>

          <div className="conversation-messages" aria-live="polite">
            {messages.length === 0 && <div className="conversation-start"><span aria-hidden="true">✳</span><strong>{activeConversation.type === "group" ? `Say hello to ${activeConversation.name}.` : `Say hello to ${activeConversation.name.split(" ")[0]}.`}</strong><p>Your conversation starts here.</p></div>}
            {messages.map((message) => {
              const isOwn = message.sender?.id === currentUser.id;
              if (message.type === "call") return <article className={`message-row call-event-row ${isOwn ? "is-own" : ""}`} key={message.id}>
                <div className="call-event"><span className="call-event-icon" aria-hidden="true">▣</span><div className="call-event-copy"><strong>{message.text}</strong><small>{messageTime(message.sentAt)} · Video call</small></div><button className="join-event-button" onClick={() => onJoinCall(message)} type="button">Join call</button></div>
              </article>;
              return <article className={`message-row ${isOwn ? "is-own" : ""}`} key={message.id}>
                {!isOwn && <Avatar name={message.sender?.name || activeConversation.name} />}
                <div className="message-bubble-wrap"><div className="message-bubble">{message.text}</div><small className="message-time">{isOwn ? "You · " : ""}{messageTime(message.sentAt)}</small></div>
              </article>;
            })}
            <div ref={messageEndRef} />
          </div>

          {error && <div className="conversation-error" role="status">{error}</div>}
          <form className="message-composer" onSubmit={submit}>
            <input aria-label="Write a message" autoComplete="off" maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${activeConversation.name}…`} />
            <button className="composer-call-button" onClick={() => onCall(activeConversation)} type="button" aria-label="Start video call" title="Start video call">▣</button>
            <button className="send-message-button" disabled={!draft.trim() || sending} type="submit" aria-label="Send message" title="Send message">↑</button>
          </form>
        </> : <div className="conversation-unselected"><span aria-hidden="true">◫</span><h2>Your conversations</h2><p>Choose someone from your people list to open a chat.</p></div>}
      </section>
      {creatingGroup && <dialog className="schedule-dialog group-dialog" open aria-labelledby="group-dialog-title">
        <form onSubmit={submitGroup}>
          <div className="dialog-header"><div><p className="eyebrow">MAKE A ROOM FOR EVERYONE</p><h2 id="group-dialog-title">New group chat</h2></div><button className="dialog-close" onClick={() => setCreatingGroup(false)} type="button" aria-label="Close">×</button></div>
          <label className="field-label" htmlFor="group-name">Group name</label>
          <input className="text-input" id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={64} placeholder="Weekend plans" required />
          <p className="group-selection-label">Choose up to 3 people</p>
          <div className="group-member-options">{people.map((person) => <label className="group-member-option" key={person.id}><input type="checkbox" checked={selectedMemberIds.includes(person.id)} onChange={() => toggleGroupMember(person.id)} disabled={!selectedMemberIds.includes(person.id) && selectedMemberIds.length >= 3} /><Avatar name={person.name} /><span><strong>{person.name}</strong><small>{person.email}</small></span></label>)}</div>
          {groupError && <p className="auth-error" role="alert">{groupError}</p>}
          <div className="dialog-footer"><span className="dialog-note">Up to 4 people, including you.</span><button className="schedule-button" disabled={!groupName.trim() || selectedMemberIds.length === 0} type="submit">Create group <span aria-hidden="true">→</span></button></div>
        </form>
      </dialog>}
    </section>
  );
}