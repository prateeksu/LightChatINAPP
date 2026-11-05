import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL, apiUrl } from "../lib/api.js";

export function useDirectMessages(user) {
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeConversationKey, setActiveConversationKey] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const socketRef = useRef(null);
  const activeConversationRef = useRef(null);
  const activeRoomRef = useRef(null);
  const conversations = [
    ...people.map((person) => ({ ...person, type: "direct", key: `direct:${person.id}` })),
    ...groups.map((group) => ({ ...group, type: "group", key: `group:${group.id}` })),
  ];

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    Promise.all([
      fetch(apiUrl("/api/people"), { credentials: "include" }).then((response) => response.json()),
      fetch(apiUrl("/api/groups"), { credentials: "include" }).then((response) => response.json()),
    ]).then(([peopleResult, groupsResult]) => {
      if (active) {
        setPeople(peopleResult.people || []);
        setGroups(groupsResult.groups || []);
      }
    }).catch((requestError) => { if (active) setError(requestError.message); });

    const socket = io(API_BASE_URL, { withCredentials: true });
    socketRef.current = socket;
    const joinActiveConversation = () => {
      const conversation = activeConversationRef.current;
      if (!conversation) return;
      const payload = conversation.type === "group" ? { groupId: conversation.id } : { peerId: conversation.id };
      socket.emit("direct:join", payload, (result) => {
        if (!active || activeConversationRef.current?.key !== conversation.key) return;
        if (!result?.ok) {
          setError(result?.error || "Could not open this conversation.");
          return;
        }
        setError("");
        activeRoomRef.current = result.roomId;
        setMessages(result.messages || []);
      });
    };
    socket.on("connect", joinActiveConversation);
    socket.on("direct:message", (message) => {
      if (!activeConversationRef.current || message.conversationKey !== activeRoomRef.current) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });
    socket.on("connect_error", () => setError("Chat server connection failed. Check your connection and retry."));

    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  useEffect(() => {
    const conversation = conversations.find((item) => item.key === activeConversationKey) || null;
    activeConversationRef.current = conversation;
    activeRoomRef.current = null;
    setMessages([]);
    setError("");
    if (conversation && socketRef.current?.connected) {
      const payload = conversation.type === "group" ? { groupId: conversation.id } : { peerId: conversation.id };
      socketRef.current.emit("direct:join", payload, (result) => {
        if (activeConversationRef.current?.key !== conversation.key) return;
        if (!result?.ok) {
          setError(result?.error || "Could not open this conversation.");
          return;
        }
        activeRoomRef.current = result.roomId;
        setMessages(result.messages || []);
      });
    }
  }, [activeConversationKey, people, groups]);

  function selectConversation(conversation) {
    setActiveConversationKey(conversation.key);
  }

  async function createGroup(name, memberIds) {
    const response = await fetch(apiUrl("/api/groups"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, memberIds }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create group.");
    setGroups((current) => [...current.filter((group) => group.id !== result.group.id), result.group]);
    setActiveConversationKey(`group:${result.group.id}`);
    return result.group;
  }

  function sendText(text) {
    const conversation = activeConversationRef.current;
    const socket = socketRef.current;
    return new Promise((resolve) => {
      if (!conversation || !socket?.connected) return resolve({ ok: false, error: "Open a conversation to send a message." });
      const target = conversation.type === "group" ? { groupId: conversation.id } : { peerId: conversation.id };
      socket.emit("direct:send", { ...target, text }, (result) => {
        if (!result?.ok) setError(result?.error || "Could not send this message.");
        resolve(result || { ok: false });
      });
    });
  }

  function logCallEvent({ roomId, passcode, url }) {
    const conversation = activeConversationRef.current;
    const socket = socketRef.current;
    return new Promise((resolve) => {
      if (!conversation || !socket?.connected) return resolve({ ok: false, error: "Open a conversation before starting a call." });
      const target = conversation.type === "group" ? { groupId: conversation.id } : { peerId: conversation.id };
      socket.emit("direct:call-event", { ...target, roomId, passcode, url }, (result) => {
        if (!result?.ok) setError(result?.error || "Could not record the video call event.");
        resolve(result || { ok: false });
      });
    });
  }

  return {
    people,
    groups,
    conversations,
    activeConversationKey,
    activeConversation: conversations.find((item) => item.key === activeConversationKey) || null,
    messages,
    error,
    selectConversation,
    createGroup,
    sendText,
    logCallEvent,
  };
}
