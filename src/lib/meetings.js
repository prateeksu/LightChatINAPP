const STORAGE_KEY = "lightchat.meetings.v1";

function storageKey(userId) {
  return `${STORAGE_KEY}.${userId}`;
}

export const PEOPLE = [
  { name: "Sam Rivera", detail: "The one with the good book recs", color: "#e8c1ac" },
  { name: "Jamie Chen", detail: "In another time zone, never far away", color: "#d8c8e3" },
  { name: "Nina Patel", detail: "Always up for a little catch-up", color: "#e6d58e" },
  { name: "Theo Brooks", detail: "Your favorite brainstorm partner", color: "#b8d2c4" },
  { name: "Maya Lewis", detail: "Hasn't heard your news yet", color: "#e9b2ad" },
  { name: "Rory Kim", detail: "Just a call away", color: "#c2d2e0" },
];

export function makeRoomId() {
  return `room-${crypto.randomUUID()}`;
}

export function makePasscode() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1000000).padStart(6, "0");
}

function seedMeetings() {
  const now = new Date();
  const startsAt = (offset, hour, minute = 0) => new Date(
    now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute,
  ).toISOString();
  return [
    { id: crypto.randomUUID(), title: "A proper catch-up", person: "Sam Rivera", startsAt: startsAt(1, 16, 30), duration: 30, roomId: makeRoomId(), passcode: makePasscode() },
    { id: crypto.randomUUID(), title: "Weekend plans & other important things", person: "Jamie Chen", startsAt: startsAt(2, 18), duration: 45, roomId: makeRoomId(), passcode: makePasscode() },
    { id: crypto.randomUUID(), title: "Coffee, but make it virtual", person: "Nina Patel", startsAt: startsAt(4, 10), duration: 30, roomId: makeRoomId(), passcode: makePasscode() },
  ];
}

export function readMeetings(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)));
    if (Array.isArray(saved)) {
      const migrated = saved.map((meeting) => meeting.passcode ? meeting : { ...meeting, passcode: makePasscode() });
      if (migrated.some((meeting, index) => meeting.passcode !== saved[index].passcode)) {
        localStorage.setItem(storageKey(userId), JSON.stringify(migrated));
      }
      return migrated;
    }
  } catch (error) {
    console.warn("Could not load saved LightChat meetings.", error);
  }
  const meetings = seedMeetings();
  localStorage.setItem(storageKey(userId), JSON.stringify(meetings));
  return meetings;
}

export function saveMeetings(meetings, userId) {
  localStorage.setItem(storageKey(userId), JSON.stringify(meetings));
}

export function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDay(date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}