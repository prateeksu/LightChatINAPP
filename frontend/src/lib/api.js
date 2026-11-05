export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}