"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="container hero" style={{ maxWidth: 720 }}>
        <span className="eyebrow">AVENLO ACCOUNT</span>
        <h1>Welcome back.</h1>
        <form className="card form" onSubmit={submit}>
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required type="password" minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
          <p className="muted">New to Avenlo? <Link href="/join">Create an account</Link></p>
        </form>
      </div>
    </main>
  );
}
