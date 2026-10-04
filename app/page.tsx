import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <nav className="nav container"><span className="brand">AVENLO</span><div className="actions"><Link href="/login">Log in</Link><Link className="btn primary" href="/join">Join Avenlo</Link></div></nav>
      <section className="hero container">
        <span className="eyebrow">PRIVATE TALENT NETWORK</span>
        <h1>Talent intelligence. Human decisions.</h1>
        <p>Avenlo brings together structured candidate intelligence, company requirements, and explainable matching — while keeping final decisions human.</p>
        <div className="actions"><Link className="btn primary" href="/join">Build your profile</Link><Link className="btn" href="/companies">For companies</Link></div>
      </section>
      <section className="section"><div className="container"><div className="grid"><article className="card"><span className="eyebrow">01</span><h2>Private by design</h2><p className="muted">Candidate information is treated as private professional intelligence, not a public résumé directory.</p></article><article className="card"><span className="eyebrow">02</span><h2>Structured intelligence</h2><p className="muted">Skills, experience, preferences and company requirements become usable signals.</p></article><article className="card"><span className="eyebrow">03</span><h2>Human-led matching</h2><p className="muted">Technology surfaces signals. Avenlo people make the final decisions.</p></article></div></div></section>
    </main>
  );
}
