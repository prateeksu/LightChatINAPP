import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api.js";

async function postAuth(path, values) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Authentication failed.");
  return result.user;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(apiUrl("/api/auth/session"), { credentials: "include" })
      .then((response) => response.json())
      .then((result) => { if (active) setUser(result.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function login(values) {
    const signedInUser = await postAuth("/api/auth/login", values);
    setUser(signedInUser);
  }

  async function register(values) {
    const signedInUser = await postAuth("/api/auth/register", values);
    setUser(signedInUser);
  }

  async function logout() {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
    setUser(null);
  }

  return { user, loading, login, register, logout };
}