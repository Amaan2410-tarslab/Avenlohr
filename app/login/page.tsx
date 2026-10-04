import Link from "next/link";

export default function Login() {
  return <main className="page"><div className="container hero" style={{maxWidth:720}}><span className="eyebrow">AVENLO ACCOUNT</span><h1>Welcome back.</h1><div className="card"><p className="muted">Authentication is connected to Supabase in the production implementation. Configure your environment before enabling account actions.</p><Link className="btn primary" href="/join">Create an account</Link></div></div></main>;
}
