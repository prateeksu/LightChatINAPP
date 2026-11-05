import { useState } from "react";

export default function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "register") await onRegister(values);
      else await onLogin(values);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <a className="brand auth-brand" href="#overview" aria-label="LightChat home"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>lightchat</span></a>
        <p className="eyebrow">A LITTLE SPACE TO CONNECT</p>
        <h1>{mode === "login" ? <>Good to <em>see you.</em></> : <>Make yourself <em>at home.</em></>}</h1>
        <p className="heading-subtitle">{mode === "login" ? "Sign in to find your people and meetings." : "Create an account to start making time."}</p>
        <div className="auth-tabs" role="group" aria-label="Account action">
          <button className={mode === "login" ? "is-selected" : ""} onClick={() => { setMode("login"); setError(""); }} type="button">Sign in</button>
          <button className={mode === "register" ? "is-selected" : ""} onClick={() => { setMode("register"); setError(""); }} type="button">Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <><label className="field-label" htmlFor="auth-name">Your name</label><input className="text-input" id="auth-name" name="name" autoComplete="name" maxLength={48} required /></>}
          <label className="field-label" htmlFor="auth-email">Email</label>
          <input className="text-input" id="auth-email" name="email" type="email" autoComplete="email" required />
          <label className="field-label" htmlFor="auth-password">Password</label>
          <input className="text-input" id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="schedule-button auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-footnote">Accounts are stored on this app server. Passwords are hashed before they are saved.</p>
      </section>
      <div className="auth-aside" aria-hidden="true"><span>GOOD TALKS<br />START HERE.</span><div className="auth-aside-orbit" /></div>
    </main>
  );
}