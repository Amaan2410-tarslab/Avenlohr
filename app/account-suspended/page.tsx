import Link from "next/link";

export default function AccountSuspended() {
  return (
    <main className="page">
      <section className="hero container" style={{ maxWidth: 760 }}>
        <span className="eyebrow">ACCOUNT SUSPENDED</span>
        <h1>Your Avenlo access is temporarily suspended.</h1>
        <p>Sign-in remains available, but protected workspaces are disabled while the account is suspended. Contact Avenlo support if you believe this was a mistake.</p>
        <div className="actions">
          <Link className="btn primary" href="/login">Back to sign in</Link>
          <Link className="btn" href="/">Public site</Link>
        </div>
      </section>
    </main>
  );
}
