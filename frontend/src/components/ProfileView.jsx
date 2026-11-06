import Avatar from "./Avatar.jsx";

export default function ProfileView({ user, onLogout }) {
  return (
    <section className="view-panel" aria-labelledby="page-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1 id="page-title">Your <em>profile.</em></h1>
          <p className="heading-subtitle">The account details connected to your LightChat sign-in.</p>
        </div>
      </div>
      <section className="profile-summary" aria-label="Profile summary">
        <Avatar name={user.name} className="profile-large-avatar" />
        <div className="profile-summary-copy">
          <p className="eyebrow">LIGHTCHAT MEMBER</p>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
        <span className="profile-account-status"><span className="online-dot" /> Account active</span>
      </section>
      <div className="profile-details-grid">
        <section className="profile-details" aria-labelledby="profile-details-title">
          <p className="eyebrow">ACCOUNT INFORMATION</p>
          <h2 id="profile-details-title">Personal details</h2>
          <dl>
            <div><dt>Full name</dt><dd>{user.name}</dd></div>
            <div><dt>Email address</dt><dd>{user.email}</dd></div>
          </dl>
        </section>
        <aside className="profile-security" aria-labelledby="profile-security-title">
          <p className="eyebrow">SIGN-IN &amp; SECURITY</p>
          <h2 id="profile-security-title">Your password stays private</h2>
          <p>LightChat never displays your password. It is stored as a secure hash.</p>
          <button className="profile-signout" onClick={onLogout} type="button">Sign out <span aria-hidden="true">↗</span></button>
        </aside>
      </div>
    </section>
  );
}