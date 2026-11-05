import { initials, PEOPLE } from "../lib/meetings.js";

export default function Avatar({ name, className = "" }) {
  const person = PEOPLE.find((item) => item.name === name);
  return <span className={`avatar ${className}`} style={{ background: person?.color || "#d6e5bb" }} aria-hidden="true">{initials(name)}</span>;
}