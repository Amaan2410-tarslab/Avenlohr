import Link from "next/link";

export default function Companies() {
  return (
    <main className="page">
      <nav className="nav container"><span className="brand">AVENLO</span><Link className="btn" href="/">Back</Link></nav>
      <section className="hero container" style={{ maxWidth: 900 }}>
        <span className="eyebrow">FOR COMPANIES</span>
        <h1>Bring us the requirement. We bring the human-led search.</h1>
        <p>Avenlo helps companies turn hiring requirements into structured signals and a focused candidate shortlist. Matching is explainable and final decisions remain human.</p>
        <div className="actions"><Link className="btn primary" href="/join">Create an account</Link><Link className="btn" href="/login">Company sign in</Link></div>
      </section>
      <section className="section"><div className="container grid"><article className="card"><span className="eyebrow">01</span><h2>Structured requirements</h2><p className="muted">Capture role, skill, experience, location, work mode and industry signals in a consistent format.</p></article><article className="card"><span className="eyebrow">02</span><h2>Explainable matches</h2><p className="muted">See the signals behind a recommendation instead of relying on an opaque ranking.</p></article><article className="card"><span className="eyebrow">03</span><h2>Human review</h2><p className="muted">Avenlo staff review and manage the final candidate relationship and hiring workflow.</p></article></div></section>
    </main>
  );
}
