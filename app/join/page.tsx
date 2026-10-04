import Link from "next/link";

export default function Join() {
  return <main className="page"><div className="container hero" style={{maxWidth:820}}><span className="eyebrow">JOIN AVENLO</span><h1>Build your private candidate profile.</h1><p>Avenlo is a private talent network. Your information is used to understand your professional profile and support human-led opportunities.</p><div className="card"><h2>Candidate onboarding</h2><p className="muted">The production onboarding flow will collect professional information, skills, career preferences, CV and email verification through Supabase.</p><Link className="btn primary" href="/login">Continue</Link></div></div></main>;
}
